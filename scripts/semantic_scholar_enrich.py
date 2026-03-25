#!/usr/bin/env python3
"""
Semantic Scholar enrichment — fetches citation counts for papers.

Usage:
    python scripts/semantic_scholar_enrich.py --limit 1000
    python scripts/semantic_scholar_enrich.py --limit 500 --db "dbname=pwc"
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

try:
    import requests
except ImportError:
    print("requests required: pip install requests", file=sys.stderr)
    sys.exit(1)

SS_API_BASE = "https://api.semanticscholar.org/graph/v1/paper"
FIELDS = "citationCount,influentialCitationCount"


def get_rate_limit_sleep(has_key: bool) -> float:
    return 0.1 if has_key else 1.0


def fetch_ss_paper(arxiv_id: str, api_key: str | None) -> dict | None:
    url = f"{SS_API_BASE}/arXiv:{arxiv_id}?fields={FIELDS}"
    headers = {}
    if api_key:
        headers["x-api-key"] = api_key
    try:
        resp = requests.get(url, headers=headers, timeout=15)
        if resp.status_code == 404:
            return None
        if resp.status_code == 429:
            print(f"  Rate limited, sleeping 60s...")
            time.sleep(60)
            return None
        resp.raise_for_status()
        return resp.json()
    except requests.RequestException as e:
        print(f"  Error fetching {arxiv_id}: {e}")
        return None


def main():
    parser = argparse.ArgumentParser(description="Enrich papers with Semantic Scholar citation counts")
    parser.add_argument("--limit", type=int, default=1000,
                        help="Number of papers to process per run (default: 1000)")
    parser.add_argument("--db", default=os.environ.get("DATABASE_PUBLIC_URL", os.environ.get("DATABASE_URL", "dbname=pwc")),
                        help="PostgreSQL connection string (default: dbname=pwc)")
    args = parser.parse_args()

    api_key = os.environ.get("SEMANTIC_SCHOLAR_KEY")
    sleep_time = get_rate_limit_sleep(bool(api_key))

    if api_key:
        print(f"Using Semantic Scholar API key (10 req/sec)")
    else:
        print(f"No API key — rate limited to 1 req/sec")

    if not args.db:
        print("Error: provide --db or set DATABASE_PUBLIC_URL", file=sys.stderr)
        sys.exit(1)
    conn = psycopg2.connect(args.db)
    cur = conn.cursor()

    # Fetch papers with arxiv_id that don't yet have citation_count
    cur.execute("""
        SELECT id, arxiv_id
        FROM papers
        WHERE arxiv_id IS NOT NULL
          AND citation_count IS NULL
        ORDER BY id
        LIMIT %s
    """, (args.limit,))
    papers = cur.fetchall()

    print(f"Processing {len(papers)} papers...")

    updated = 0
    skipped = 0

    for i, (paper_id, arxiv_id) in enumerate(papers):
        data = fetch_ss_paper(arxiv_id, api_key)

        if data is None:
            skipped += 1
        else:
            citation_count = data.get("citationCount")
            influential_count = data.get("influentialCitationCount")
            cur.execute("""
                UPDATE papers
                SET citation_count = %s
                WHERE id = %s
            """, (citation_count, paper_id))
            conn.commit()
            updated += 1

        if (i + 1) % 100 == 0:
            print(f"  Progress: {i + 1}/{len(papers)} — {updated} updated, {skipped} skipped")

        time.sleep(sleep_time)

    conn.close()
    print(f"\nDone. Updated: {updated}, Skipped/not found: {skipped}")


if __name__ == "__main__":
    main()
