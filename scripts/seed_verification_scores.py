#!/usr/bin/env python3
"""One-time script to seed verification_score for all papers with official repos."""
import psycopg2, argparse, sys

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--db", default=os.environ.get("DATABASE_PUBLIC_URL", os.environ.get("DATABASE_URL", "dbname=pwc")))
    args = parser.parse_args()

    if not args.db:
        print("Error: provide --db or set DATABASE_PUBLIC_URL", file=sys.stderr)
        sys.exit(1)
    conn = psycopg2.connect(args.db)
    cur = conn.cursor()

    # Papers with official repos: +5
    cur.execute("""
        UPDATE papers p
        SET verification_score = GREATEST(verification_score, 5)
        WHERE EXISTS (
            SELECT 1 FROM paper_code_links cl
            WHERE cl.paper_id = p.id AND cl.is_official = true
        )
        AND verification_score = 0
    """)
    print(f"Updated {cur.rowcount} papers with official repo score")

    conn.commit()
    cur.close()
    conn.close()
    print("Done.")

if __name__ == "__main__":
    main()
