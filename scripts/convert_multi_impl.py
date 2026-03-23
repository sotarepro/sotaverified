#!/usr/bin/env python3
"""
Convert duplicate/multi-value leaderboard entries into reproductions.

Targets:
- Exact duplicates (same paper+dataset+metric+model+value): deduplicate, keep one
- Same-model-diff-value (same paper+dataset+metric+model, different values):
  keep best value as canonical, convert others to reproductions

Does NOT touch different-model groups (e.g. ResNet-50 vs ResNet-101) — those
are legitimate separate leaderboard entries.

Safe to re-run: skips groups that already have source='pwc_import' reproductions.

Usage:
    python scripts/convert_multi_impl.py --db "dbname=pwc"
    python scripts/convert_multi_impl.py --dry-run
"""

import argparse
import os
import sys

try:
    import psycopg2
    import psycopg2.extras
except ImportError:
    print("psycopg2 required: pip install psycopg2-binary", file=sys.stderr)
    sys.exit(1)


def main():
    parser = argparse.ArgumentParser(description="Convert multi-impl leaderboard entries to reproductions")
    parser.add_argument("--db", default=os.environ.get("DATABASE_URL", "dbname=pwc"))
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    conn = psycopg2.connect(args.db)
    cur = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)

    # Step 1: Find exact duplicates (same model name AND same value)
    cur.execute("""
        SELECT paper_id, dataset_id, best_metric_name, model_name, best_metric_value,
               array_agg(id ORDER BY id) as ids
        FROM leaderboard_results
        WHERE paper_id IS NOT NULL AND best_metric_value IS NOT NULL
        GROUP BY paper_id, dataset_id, best_metric_name, model_name, best_metric_value
        HAVING COUNT(*) > 1
    """)
    exact_dupes = cur.fetchall()
    print(f"Exact duplicate groups: {len(exact_dupes)}")

    dupe_delete_ids = []
    for row in exact_dupes:
        ids = row["ids"]
        # Keep first, delete rest
        dupe_delete_ids.extend(ids[1:])

    print(f"  Duplicate rows to delete: {len(dupe_delete_ids)}")

    # Step 2: Find same-model-diff-value groups
    cur.execute("""
        SELECT paper_id, dataset_id, best_metric_name, model_name,
               array_agg(id ORDER BY best_metric_value DESC) as ids,
               array_agg(best_metric_value ORDER BY best_metric_value DESC) as values
        FROM leaderboard_results
        WHERE paper_id IS NOT NULL AND best_metric_value IS NOT NULL
        GROUP BY paper_id, dataset_id, best_metric_name, model_name
        HAVING COUNT(*) > 1 AND COUNT(DISTINCT best_metric_value) > 1
    """)
    same_model_groups = cur.fetchall()
    print(f"\nSame-model-diff-value groups: {len(same_model_groups)}")

    # For each group, get the best repo URL for notes
    repro_inserts = []
    convert_delete_ids = []

    for row in same_model_groups:
        ids = row["ids"]
        values = row["values"]
        paper_id = row["paper_id"]
        dataset_id = row["dataset_id"]
        metric_name = row["best_metric_name"]
        model_name = row["model_name"]

        # First ID (highest value) is canonical — keep it
        canonical_id = ids[0]

        # Check if already converted (has pwc_import reproductions for this combo)
        cur.execute("""
            SELECT 1 FROM reproductions
            WHERE paper_id = %s AND dataset_id = %s AND source = 'pwc_import'
            LIMIT 1
        """, (paper_id, dataset_id))
        if cur.fetchone():
            continue  # Already processed

        # Get repo URL for this paper (best non-shared repo)
        cur.execute("""
            SELECT repo_url FROM paper_code_links
            WHERE paper_id = %s AND is_shared_repo = false
            ORDER BY stars DESC NULLS LAST LIMIT 1
        """, (paper_id,))
        repo_row = cur.fetchone()
        repo_url = repo_row["repo_url"] if repo_row else "Unknown"

        # Get paper's published date
        cur.execute("SELECT published FROM papers WHERE id = %s", (paper_id,))
        pub_row = cur.fetchone()
        published = pub_row["published"] if pub_row else None

        # Convert non-canonical entries to reproductions
        for i in range(1, len(ids)):
            lr_id = ids[i]
            metric_value = values[i]
            repro_inserts.append({
                "paper_id": paper_id,
                "dataset_id": dataset_id,
                "metric_name": metric_name,
                "metric_value": metric_value,
                "model_name": model_name,
                "repo_url": repo_url,
                "published": published,
            })
            convert_delete_ids.append(lr_id)

    print(f"  Reproductions to create: {len(repro_inserts)}")
    print(f"  Leaderboard rows to convert: {len(convert_delete_ids)}")

    # Summary
    total_affected_papers = len(set(r["paper_id"] for r in repro_inserts))
    print(f"\nTotal papers affected: {total_affected_papers}")
    print(f"Total rows to delete (dupes + converts): {len(dupe_delete_ids) + len(convert_delete_ids)}")

    if args.dry_run:
        print("\n[DRY RUN] No changes written.")
        conn.close()
        return

    # Execute: delete exact duplicates
    if dupe_delete_ids:
        cur.execute(
            "DELETE FROM leaderboard_results WHERE id = ANY(%s)",
            (dupe_delete_ids,)
        )
        conn.commit()
        print(f"\nDeleted {len(dupe_delete_ids)} exact duplicate rows")

    # Execute: insert reproductions and delete converted rows
    created = 0
    for r in repro_inserts:
        notes = f"Auto-imported from Papers With Code. {r['model_name']} implementation."
        cur.execute("""
            INSERT INTO reproductions
              (paper_id, user_id, tier_claimed, hardware_spec, run_log_url,
               dataset_id, actual_metric_name, actual_metric_value,
               notes, status, source, created_at)
            VALUES
              (%s, 'system', 2, 'Unknown (PWC import)', %s,
               %s, %s, %s,
               %s, 'community', 'pwc_import', COALESCE(%s, NOW()))
        """, (
            r["paper_id"], r["repo_url"],
            r["dataset_id"], r["metric_name"], r["metric_value"],
            notes, r["published"],
        ))
        created += 1

    if convert_delete_ids:
        cur.execute(
            "DELETE FROM leaderboard_results WHERE id = ANY(%s)",
            (convert_delete_ids,)
        )

    conn.commit()
    print(f"Created {created} reproductions")
    print(f"Deleted {len(convert_delete_ids)} converted leaderboard rows")

    # Step 4: Recompute verification scores for affected papers
    affected_papers = list(set(r["paper_id"] for r in repro_inserts))
    print(f"\nRecomputing verification scores for {len(affected_papers)} papers...")
    for i, pid in enumerate(affected_papers):
        # Simplified score recompute (just set based on repro count)
        cur.execute("""
            UPDATE papers SET verification_score = (
                SELECT COALESCE(
                    (CASE WHEN EXISTS(SELECT 1 FROM paper_code_links WHERE paper_id = %s AND is_official = true) THEN 5 ELSE 0 END) +
                    (CASE WHEN EXISTS(SELECT 1 FROM paper_authors WHERE paper_id = %s AND status = 'verified') THEN 10 ELSE 0 END) +
                    (SELECT COUNT(*)::int * 10 FROM reproductions WHERE paper_id = %s AND status NOT IN ('hidden', 'removed')),
                0)
            )
            WHERE id = %s
        """, (pid, pid, pid, pid))
        if (i + 1) % 100 == 0:
            conn.commit()
            print(f"  Progress: {i+1}/{len(affected_papers)}")

    conn.commit()
    conn.close()

    print(f"\nDone. {created} reproductions created from {len(same_model_groups)} groups.")
    print(f"{len(dupe_delete_ids)} exact duplicates removed.")

    # Write summary
    summary = f"""# Multi-Implementation Conversion Summary
Generated: {__import__('datetime').date.today()}

## Stats
- Exact duplicate groups found: {len(exact_dupes)}
- Duplicate rows deleted: {len(dupe_delete_ids)}
- Same-model-diff-value groups: {len(same_model_groups)}
- Reproductions created: {created}
- Leaderboard rows converted: {len(convert_delete_ids)}
- Papers with new verified metrics: {total_affected_papers}
"""
    with open("/home/david/multi_impl_conversion.md", "w") as f:
        f.write(summary)
    print(f"Summary written to /home/david/multi_impl_conversion.md")


if __name__ == "__main__":
    main()
