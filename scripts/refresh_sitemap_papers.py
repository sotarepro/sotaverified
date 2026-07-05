#!/usr/bin/env python3
"""
Refresh the sitemap_papers population table.

sitemap_papers precomputes which papers have any verifiable signal (code
link, leaderboard result, reproduction, hype, upvote, or activity), assigns
each a stable `position` ordered by paper id, and is what app/sitemap.ts
reads at build/revalidate time instead of running the underlying filter
(6-way EXISTS/UNION over the papers table) live. That live query took ~31s
on prod (~2s locally) and risked build timeouts / OOM on the resource-limited
Railway instance.

Idempotent: truncates and reinserts inside a single transaction, so a
partial run leaves the table in its prior state, never a half-populated one.

Usage:
    python3 scripts/refresh_sitemap_papers.py --db postgresql://user@host/db
    python3 scripts/refresh_sitemap_papers.py   # uses DATABASE_PUBLIC_URL / DATABASE_URL / local pwc
"""

import argparse
import os
import sys
import time

try:
    import psycopg2
except ImportError:
    print("psycopg2 required: pip install psycopg2-binary", file=sys.stderr)
    sys.exit(1)

REFRESH_SQL = """
TRUNCATE sitemap_papers;

INSERT INTO sitemap_papers (position, paper_id, updated_at)
SELECT row_number() OVER (ORDER BY p.id), p.id, p.updated_at
FROM papers p
JOIN (
    SELECT paper_id FROM paper_code_links
    UNION
    SELECT paper_id FROM leaderboard_results
    UNION
    SELECT paper_id FROM reproductions
    UNION
    SELECT paper_id FROM upvotes
    UNION
    SELECT paper_id FROM activity_log WHERE paper_id IS NOT NULL
    UNION
    SELECT id FROM papers WHERE hype_score > 0
) signal ON signal.paper_id = p.id
WHERE p.is_test = false;
"""


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--db",
        default=os.environ.get("DATABASE_PUBLIC_URL", os.environ.get("DATABASE_URL", "postgresql://david@localhost/pwc")),
        help="Postgres connection string",
    )
    args = parser.parse_args()

    # Never silently guess which DB this touches — it's a full truncate+reinsert.
    safe_target = args.db.split("@")[-1] if "@" in args.db else args.db
    print(f"Refreshing sitemap_papers on: {safe_target}")

    conn = psycopg2.connect(args.db)
    try:
        cur = conn.cursor()
        start = time.time()
        cur.execute(REFRESH_SQL)
        cur.execute("SELECT count(*) FROM sitemap_papers")
        (count,) = cur.fetchone()
        conn.commit()
        elapsed = time.time() - start
        print(f"Done. {count} papers indexed in {elapsed:.1f}s.")
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


if __name__ == "__main__":
    main()
