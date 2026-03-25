#!/usr/bin/env python3
"""
Pre-launch sanity check — verifies no test data remains in the database.

Run before deploying to production:
    python scripts/verify_clean.py --db "dbname=pwc"

Exits non-zero if any problems are found.
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


def check(cur, description: str, query: str, params=()) -> list:
    cur.execute(query, params)
    rows = cur.fetchall()
    if rows:
        print(f"  FAIL — {description}: {len(rows)} row(s)")
        for row in rows[:5]:
            print(f"       {dict(row)}")
        if len(rows) > 5:
            print(f"       ... and {len(rows) - 5} more")
    else:
        print(f"  OK   — {description}")
    return rows


def main():
    parser = argparse.ArgumentParser(description="Verify no test data in DB before launch")
    parser.add_argument("--db", default=os.environ.get("DATABASE_PUBLIC_URL", os.environ.get("DATABASE_URL", "dbname=pwc")),
                        help="PostgreSQL connection string (default: dbname=pwc)")
    args = parser.parse_args()

    if not args.db:
        print("Error: provide --db or set DATABASE_PUBLIC_URL", file=sys.stderr)
        sys.exit(1)
    conn = psycopg2.connect(args.db)
    conn.set_session(readonly=True)
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    print("SOTAVerified pre-launch data check\n")
    issues = []

    # Test users
    issues += check(cur, "Test users (is_test=true)",
        "SELECT github_id, username FROM users WHERE is_test = true")

    # Test papers
    issues += check(cur, "Test papers (is_test=true)",
        "SELECT id, title FROM papers WHERE is_test = true")

    # Reproductions from test users that weren't cleaned up
    issues += check(cur, "Reproductions from test users",
        """SELECT r.id, r.paper_id, r.user_id FROM reproductions r
           JOIN users u ON u.github_id = r.user_id
           WHERE u.is_test = true""")

    # Author claims from test users
    issues += check(cur, "Author claims from test users",
        """SELECT pa.paper_id, pa.user_id FROM paper_authors pa
           JOIN users u ON u.github_id = pa.user_id
           WHERE u.is_test = true""")

    # Upvotes from test users
    issues += check(cur, "Upvotes from test users",
        """SELECT up.paper_id, up.user_id FROM upvotes up
           JOIN users u ON u.github_id = up.user_id
           WHERE u.is_test = true""")

    # Papers with future publication dates (> 1 year from now)
    issues += check(cur, "Papers with far-future dates",
        """SELECT id, title, published FROM papers
           WHERE published > CURRENT_DATE + INTERVAL '1 year'
           ORDER BY published DESC LIMIT 10""")

    # Orphaned reproductions (paper_id not in papers)
    issues += check(cur, "Orphaned reproductions (paper not found)",
        """SELECT r.id, r.paper_id FROM reproductions r
           LEFT JOIN papers p ON p.id = r.paper_id
           WHERE p.id IS NULL LIMIT 10""")

    # Papers with suspicious hype_score (> 10 — seeding cap)
    issues += check(cur, "Papers with hype_score > 10 (seeding anomaly)",
        "SELECT id, title, hype_score FROM papers WHERE hype_score > 10 ORDER BY hype_score DESC LIMIT 10")

    conn.close()
    print()

    if issues:
        print(f"Found {len(issues)} issue(s). Clean up before deploying.")
        sys.exit(1)
    else:
        print("All checks passed. DB looks clean for launch.")
        sys.exit(0)


if __name__ == "__main__":
    main()
