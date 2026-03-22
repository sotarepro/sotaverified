#!/usr/bin/env python3
"""
One-time hype seeding script — converts GitHub star counts to hype_score.

Applies recency multipliers to reduce old-paper bias:
  - Papers 2024+:  full score (1.0x)
  - Papers 2022–2023: 0.5x
  - Papers pre-2022: 0.25x

Usage:
    python scripts/hype_seed.py --db "dbname=pwc"
    python scripts/hype_seed.py --dry-run
    python scripts/hype_seed.py --reset   # zero out all scores before re-seeding
"""

import argparse
import os
import sys
from datetime import date

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


def recency_multiplier(published: date | None) -> float:
    """Return weighting factor based on publication year."""
    if published is None:
        return 0.25
    year = published.year
    if year >= 2024:
        return 1.0
    elif year >= 2022:
        return 0.5
    else:
        return 0.25


def apply_multiplier(base_score: int, multiplier: float) -> int:
    """Apply multiplier and round to nearest valid hype value (0,1,3,5,10)."""
    raw = base_score * multiplier
    if raw <= 0:
        return 0
    # Round to nearest valid tier
    tiers = [1, 3, 5, 10]
    return min(tiers, key=lambda t: abs(t - raw))


def main():
    parser = argparse.ArgumentParser(description="Seed hype_score from GitHub star counts")
    parser.add_argument("--db", default=os.environ.get("DATABASE_URL", "dbname=pwc"),
                        help="PostgreSQL connection string (default: dbname=pwc)")
    parser.add_argument("--dry-run", action="store_true",
                        help="Print summary without writing to DB")
    parser.add_argument("--reset", action="store_true",
                        help="Reset all hype_score to 0 before re-seeding (safe to re-run)")
    args = parser.parse_args()

    conn = psycopg2.connect(args.db)
    cur = conn.cursor()

    if args.reset:
        if args.dry_run:
            print("[DRY RUN] Would reset all hype_score to 0")
        else:
            cur.execute("UPDATE papers SET hype_score = 0")
            conn.commit()
            print("Reset all hype_score to 0")

    # Get max stars per paper + publication date
    cur.execute("""
        SELECT p.id, p.published, COALESCE(MAX(pcl.stars), 0) AS max_stars
        FROM papers p
        LEFT JOIN paper_code_links pcl ON pcl.paper_id = p.id
        WHERE p.hype_score = 0
        GROUP BY p.id, p.published
        HAVING MAX(pcl.stars) > 0
    """)
    rows = cur.fetchall()

    print(f"Found {len(rows)} papers with star data and hype_score = 0")

    # Compute recency-weighted scores
    updates = []
    score_dist: dict[int, int] = {}
    skipped_recency = 0

    for paper_id, published, max_stars in rows:
        base_score = stars_to_hype(max_stars)
        if base_score == 0:
            continue
        mult = recency_multiplier(published)
        final_score = apply_multiplier(base_score, mult)
        if mult < 1.0:
            skipped_recency += 1 if final_score == 0 else 0
        score_dist[final_score] = score_dist.get(final_score, 0) + 1
        if final_score > 0:
            updates.append((final_score, paper_id))

    print(f"\nScore distribution (papers that will be updated, recency-weighted):")
    for score in sorted(score_dist.keys()):
        labels = {0: "0", 1: "1", 3: "3", 5: "5", 10: "10"}
        print(f"  hype_score={labels.get(score, str(score))}: {score_dist[score]} papers")

    print(f"\nMultiplier breakdown:")
    print("  2024+: 1.0x  |  2022-2023: 0.5x  |  pre-2022: 0.25x")
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
