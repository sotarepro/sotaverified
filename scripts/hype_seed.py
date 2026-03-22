#!/usr/bin/env python3
"""
One-time hype seeding script — converts GitHub star counts to hype_score.

Usage:
    python scripts/hype_seed.py --db "dbname=pwc"
    python scripts/hype_seed.py --dry-run
"""

import argparse
import os
import sys

try:
    import psycopg2
except ImportError:
    print("psycopg2 required: pip install psycopg2-binary", file=sys.stderr)
    sys.exit(1)


def stars_to_hype(stars: int) -> int:
    if stars >= 2000:
        return 10
    elif stars >= 500:
        return 5
    elif stars >= 100:
        return 3
    elif stars >= 10:
        return 1
    else:
        return 0


def main():
    parser = argparse.ArgumentParser(description="Seed hype_score from GitHub star counts")
    parser.add_argument("--db", default=os.environ.get("DATABASE_URL", "dbname=pwc"),
                        help="PostgreSQL connection string (default: dbname=pwc)")
    parser.add_argument("--dry-run", action="store_true",
                        help="Print summary without writing to DB")
    args = parser.parse_args()

    conn = psycopg2.connect(args.db)
    cur = conn.cursor()

    # Get max stars per paper across all linked repos
    cur.execute("""
        SELECT p.id, COALESCE(MAX(pcl.stars), 0) AS max_stars
        FROM papers p
        LEFT JOIN paper_code_links pcl ON pcl.paper_id = p.id
        WHERE p.hype_score = 0
        GROUP BY p.id
        HAVING MAX(pcl.stars) > 0
    """)
    rows = cur.fetchall()

    print(f"Found {len(rows)} papers with star data and hype_score = 0")

    # Compute scores
    updates = []
    score_dist = {0: 0, 1: 0, 3: 0, 5: 0, 10: 0}

    for paper_id, max_stars in rows:
        score = stars_to_hype(max_stars)
        score_dist[score] = score_dist.get(score, 0) + 1
        if score > 0:
            updates.append((score, paper_id))

    print(f"\nScore distribution (papers that will be updated):")
    for score in sorted(score_dist.keys()):
        label = {
            0: "0 (0-9 stars)",
            1: "1 (10-99 stars)",
            3: "3 (100-499 stars)",
            5: "5 (500-1999 stars)",
            10: "10 (2000+ stars)",
        }[score]
        print(f"  hype_score={label}: {score_dist[score]} papers")

    print(f"\nWill update {len(updates)} papers with hype_score > 0")

    if args.dry_run:
        print("\n[DRY RUN] No changes written.")
        conn.close()
        return

    # Apply updates in batches
    batch_size = 500
    total_updated = 0

    for i in range(0, len(updates), batch_size):
        batch = updates[i:i + batch_size]
        for score, paper_id in batch:
            cur.execute("""
                UPDATE papers SET hype_score = %s WHERE id = %s AND hype_score = 0
            """, (score, paper_id))
        conn.commit()
        total_updated += len(batch)
        print(f"  Committed batch {i // batch_size + 1}: {total_updated}/{len(updates)} updated")

    conn.close()
    print(f"\nDone. {total_updated} papers updated.")


if __name__ == "__main__":
    main()
