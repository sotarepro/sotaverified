#!/usr/bin/env python3
"""
arXiv delta ingestion — fetches last N days of new papers.

Usage:
    python scripts/arxiv_delta.py --days 7
    python scripts/arxiv_delta.py --days 14 --db postgresql://user@host/db
"""

import argparse
import os
import sys
from datetime import date, timedelta

# Reuse backfill logic
sys.path.insert(0, os.path.dirname(__file__))
from arxiv_backfill import oai_list_records, parse_records, insert_papers, CATEGORIES

try:
    import psycopg2
except ImportError:
    print("psycopg2 required: pip install psycopg2-binary", file=sys.stderr)
    sys.exit(1)

import time

SLEEP_BETWEEN_REQUESTS = 20


def main():
    parser = argparse.ArgumentParser(description="Fetch last N days of arXiv papers")
    parser.add_argument("--days", type=int, default=7,
                        help="Number of days to look back (default: 7)")
    parser.add_argument("--db", default=os.environ.get("DATABASE_URL", "postgresql://david@localhost/pwc"),
                        help="PostgreSQL connection string")
    args = parser.parse_args()

    until_date = date.today().isoformat()
    from_date = (date.today() - timedelta(days=args.days)).isoformat()

    print(f"Fetching arXiv papers from {from_date} to {until_date} ({args.days} days)")
    print(f"Categories: {', '.join(CATEGORIES)}")

    conn = psycopg2.connect(args.db)

    total_inserted = 0
    total_seen = 0
    resumption_token = None
    page = 0

    while True:
        page += 1
        print(f"  Page {page}...", end="", flush=True)
        try:
            xml_text = oai_list_records(from_date, until_date, resumption_token)
        except Exception as e:
            print(f"\nFATAL: {e}")
            break

        records, resumption_token = parse_records(xml_text)
        print(f" {len(records)} records", end="")

        inserted = insert_papers(conn, records)
        total_inserted += inserted
        total_seen += len(records)
        print(f" ({inserted} new)")

        if resumption_token is None:
            break

        time.sleep(SLEEP_BETWEEN_REQUESTS)

    conn.close()
    print(f"\nDelta complete. Papers seen: {total_seen}, new papers added: {total_inserted}")


if __name__ == "__main__":
    main()
