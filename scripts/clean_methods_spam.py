#!/usr/bin/env python3
"""
One-time cleanup: delete SEO spam methods injected into PWC data.
Safe to re-run (idempotent).

Usage:
  python3 scripts/clean_methods_spam.py --db "dbname=pwc"
"""

import argparse
import psycopg2

# Patterns that indicate spam methods
PHONE_REGEX = r"\+?\d[\d\-\s]{7,}"

SPAM_KEYWORDS = [
    "customer service",
    "file a claim",
    "how do i contact",
    "comment contacter",
    "come contattare",
    "how do i file",
    "service clientèle",
    "livraison billet",
]

SPAM_BRANDS = [
    "expedia",
    "air france",
    "lufthansa",
    "swissair",
    "swiss air",
]


def main():
    parser = argparse.ArgumentParser(description="Delete spam methods from PWC data")
    parser.add_argument("--db", default=os.environ.get("DATABASE_PUBLIC_URL", os.environ.get("DATABASE_URL")), help="Postgres connection string")
    parser.add_argument("--dry-run", action="store_true", help="Show what would be deleted without deleting")
    args = parser.parse_args()

    if not args.db:
        print("Error: provide --db or set DATABASE_PUBLIC_URL", file=sys.stderr)
        sys.exit(1)
    conn = psycopg2.connect(args.db)
    cur = conn.cursor()

    # Build OR conditions for keywords and brands (case-insensitive)
    keyword_conditions = " OR ".join(
        f"m.name ILIKE '%{kw}%'" for kw in SPAM_KEYWORDS
    )
    brand_conditions = " OR ".join(
        f"m.name ILIKE '%{b}%'" for b in SPAM_BRANDS
    )

    where_clause = f"""
        m.name ~ '{PHONE_REGEX}'
        OR ({keyword_conditions})
        OR ({brand_conditions})
    """

    # Count spam methods
    cur.execute(f"SELECT COUNT(*) FROM methods m WHERE {where_clause}")
    spam_count = cur.fetchone()[0]
    print(f"Found {spam_count} spam methods")

    if spam_count == 0:
        print("Nothing to clean up.")
        conn.close()
        return

    if args.dry_run:
        cur.execute(f"SELECT m.name FROM methods m WHERE {where_clause} ORDER BY m.name LIMIT 20")
        print("Sample spam methods:")
        for row in cur.fetchall():
            print(f"  - {row[0][:80]}")
        conn.close()
        return

    # Delete from paper_methods first (FK)
    cur.execute(f"""
        DELETE FROM paper_methods
        WHERE method_id IN (
            SELECT m.id FROM methods m WHERE {where_clause}
        )
    """)
    pm_deleted = cur.rowcount
    print(f"Deleted {pm_deleted} paper_methods rows")

    # Delete from methods
    cur.execute(f"DELETE FROM methods m WHERE {where_clause}")
    m_deleted = cur.rowcount
    print(f"Deleted {m_deleted} methods rows")

    # Also clean up the papers.methods TEXT[] column
    # Remove spam entries from the array
    cur.execute("""
        UPDATE papers
        SET methods = array_remove_matching
        FROM (
            SELECT p.id,
                   ARRAY(
                       SELECT unnest(p.methods)
                       EXCEPT
                       SELECT m_name FROM (
                           SELECT unnest(p.methods) AS m_name
                       ) sub
                       WHERE m_name ~ %s
                          OR m_name ~* %s
                          OR m_name ~* %s
                   ) AS array_remove_matching
            FROM papers p
            WHERE p.methods IS NOT NULL AND array_length(p.methods, 1) > 0
        ) sub
        WHERE papers.id = sub.id AND papers.methods != sub.array_remove_matching
    """, (
        PHONE_REGEX,
        "|".join(SPAM_KEYWORDS),
        "|".join(SPAM_BRANDS),
    ))
    papers_updated = cur.rowcount
    print(f"Updated {papers_updated} papers (removed spam from methods array)")

    conn.commit()
    print("Done. Changes committed.")
    conn.close()


if __name__ == "__main__":
    main()
