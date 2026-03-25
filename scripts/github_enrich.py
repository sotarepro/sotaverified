#!/usr/bin/env python3
"""
GitHub enrichment — fetches star and fork counts for repos in paper_code_links.

Usage:
    python scripts/github_enrich.py --limit 500
    python scripts/github_enrich.py --limit 200 --db "dbname=pwc"
    python scripts/github_enrich.py --since 2023-01-01 --db "dbname=pwc"
    python scripts/github_enrich.py --since 2020-01-01 --limit 100000 --db "dbname=pwc"
"""

import argparse
import os
import re
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

GITHUB_API_BASE = "https://api.github.com/repos"
GITHUB_URL_RE = re.compile(r"github\.com/([^/]+/[^/]+?)(?:\.git)?/?$", re.IGNORECASE)


def extract_owner_repo(url: str) -> tuple[str, str] | None:
    m = GITHUB_URL_RE.search(url)
    if not m:
        return None
    parts = m.group(1).split("/")
    if len(parts) != 2:
        return None
    return parts[0], parts[1]


def fetch_repo_info(owner: str, repo: str, token: str | None) -> dict | None:
    url = f"{GITHUB_API_BASE}/{owner}/{repo}"
    headers = {"Accept": "application/vnd.github.v3+json"}
    if token:
        headers["Authorization"] = f"token {token}"
    try:
        resp = requests.get(url, headers=headers, timeout=15)
        rate_remaining = resp.headers.get("X-RateLimit-Remaining", "?")

        if resp.status_code == 404:
            return None
        if resp.status_code == 403:
            print(f"  Rate limited or forbidden (remaining: {rate_remaining}), sleeping 60s...")
            time.sleep(60)
            return None
        if resp.status_code == 429:
            print(f"  Rate limited, sleeping 60s...")
            time.sleep(60)
            return None
        resp.raise_for_status()
        data = resp.json()
        data["_rate_remaining"] = rate_remaining
        return data
    except requests.RequestException as e:
        print(f"  Error fetching {owner}/{repo}: {e}")
        return None


def main():
    parser = argparse.ArgumentParser(description="Enrich paper_code_links with GitHub star/fork counts")
    parser.add_argument("--limit", type=int, default=500,
                        help="Number of repos to process per run (default: 500)")
    parser.add_argument("--since", default=None,
                        help="Only enrich links for papers published on or after this date (YYYY-MM-DD)")
    parser.add_argument("--db", default=os.environ.get("DATABASE_PUBLIC_URL", os.environ.get("DATABASE_URL", "dbname=pwc"),
                        help="PostgreSQL connection string (default: dbname=pwc)")
    args = parser.parse_args()

    token = os.environ.get("GITHUB_TOKEN")
    sleep_time = 0.1 if token else 1.0

    if token:
        print("Using GITHUB_TOKEN (rate limit: 5000/hr)")
    else:
        print("No GITHUB_TOKEN — rate limited to 60/hr")

    if not args.db:
        print("Error: provide --db or set DATABASE_PUBLIC_URL", file=sys.stderr)
        sys.exit(1)
    conn = psycopg2.connect(args.db)
    cur = conn.cursor()

    since_clause = ""
    query_params: list = [args.limit]
    if args.since:
        since_clause = """
          AND EXISTS (
            SELECT 1 FROM papers p
            WHERE p.id = pcl.paper_id
              AND p.published >= %s
          )"""
        query_params = [args.since, args.limit]

    cur.execute(f"""
        SELECT pcl.repo_url
        FROM paper_code_links pcl
        WHERE pcl.repo_url LIKE '%%github.com%%'
          AND (pcl.last_enriched_at IS NULL
               OR pcl.last_enriched_at < NOW() - INTERVAL '7 days')
          {since_clause}
        ORDER BY pcl.last_enriched_at NULLS FIRST
        LIMIT %s
    """, query_params)
    repos = [row[0] for row in cur.fetchall()]

    since_msg = f" (papers published since {args.since})" if args.since else ""
    print(f"Processing {len(repos)} repos{since_msg}...")

    updated = 0
    skipped = 0

    for i, repo_url in enumerate(repos):
        parsed = extract_owner_repo(repo_url)
        if not parsed:
            print(f"  Skipping unparseable URL: {repo_url}")
            skipped += 1
            continue

        owner, repo = parsed
        data = fetch_repo_info(owner, repo, token)

        if data is None:
            # Still mark as enriched to avoid retrying immediately
            cur.execute("""
                UPDATE paper_code_links
                SET last_enriched_at = NOW()
                WHERE repo_url = %s
            """, (repo_url,))
            conn.commit()
            skipped += 1
        else:
            stars = data.get("stargazers_count", 0)
            forks = data.get("forks_count", 0)
            rate_remaining = data.get("_rate_remaining", "?")

            cur.execute("""
                UPDATE paper_code_links
                SET stars = %s, forks = %s, last_enriched_at = NOW()
                WHERE repo_url = %s
            """, (stars, forks, repo_url))
            conn.commit()
            updated += 1

        if (i + 1) % 50 == 0:
            rate_info = data.get("_rate_remaining", "?") if data else "?"
            print(f"  Progress: {i + 1}/{len(repos)} — {updated} updated, {skipped} skipped | rate remaining: {rate_info}")

        time.sleep(sleep_time)

    conn.close()
    print(f"\nDone. Updated: {updated}, Skipped/not found: {skipped}")


if __name__ == "__main__":
    main()
