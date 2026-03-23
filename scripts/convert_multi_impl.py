#!/usr/bin/env python3
"""
Deduplicate exact-duplicate leaderboard entries.

Targets exact duplicates only: same paper+dataset+metric+model+value appearing
more than once. Keeps one copy, deletes the rest.

Does NOT convert model variants to reproductions — different metric values for
the same model are configuration variants from the same study, not independent
reproductions. Different model names (ResNet-50 vs ResNet-101) are legitimate
separate leaderboard entries and are never touched.

Safe to re-run (idempotent).

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

    print(f"\nTotal duplicate rows to delete: {len(dupe_delete_ids)}")

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
    else:
        print("\nNo duplicates to delete.")

    conn.close()
    print("Done.")


if __name__ == "__main__":
    main()
