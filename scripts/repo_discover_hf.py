#!/usr/bin/env python3
"""
Discover GitHub repos for papers via Hugging Face Papers API.

Queries papers that have an arxiv_id but no code links in paper_code_links.
HF Papers is community-curated and returns githubRepo URLs directly.

Usage:
    python3 scripts/repo_discover_hf.py --db "dbname=pwc" --dry-run --limit 50
    python3 scripts/repo_discover_hf.py --db "dbname=pwc" --since 2024-01-01 --limit 5000
"""

import argparse
import os
import re
import sys
import time

try:
    import psycopg2
    import psycopg2.extras
except ImportError:
    print("psycopg2 required: pip install psycopg2-binary", file=sys.stderr)
    sys.exit(1)

try:
    import requests
except ImportError:
    print("requests required: pip install requests", file=sys.stderr)
    sys.exit(1)

HF_API_BASE = "https://huggingface.co/api/papers"
SLEEP_BETWEEN_REQUESTS = 1.0
MAX_RETRIES = 3


def normalize_github_url(url: str) -> str | None:
    """Normalize a GitHub URL to https://github.com/{owner}/{repo} format."""
    if not url:
        return None

    url = url.strip()
    if not url.startswith("http"):
        url = "https://" + url

    url = url.lower().rstrip("/")
    if url.endswith(".git"):
        url = url[:-4]

    # Extract owner/repo from various GitHub URL formats
    match = re.match(r"https?://github\.com/([^/]+)/([^/]+)", url)
    if not match:
        return None

    owner, repo = match.group(1), match.group(2)
    return f"https://github.com/{owner}/{repo}"


def strip_arxiv_version(arxiv_id: str) -> str:
    """Strip version suffix from arXiv ID: 2401.12345v2 → 2401.12345"""
    return re.sub(r"v\d+$", "", arxiv_id.strip())


def fetch_hf_paper(arxiv_id: str) -> dict | None:
    """Fetch paper data from HF API. Returns dict or None on 404/error."""
    url = f"{HF_API_BASE}/{arxiv_id}"

    for attempt in range(MAX_RETRIES):
        try:
            resp = requests.get(url, timeout=15)

            if resp.status_code == 404:
                return None
            if resp.status_code == 429:
                print(f"  Rate limited, sleeping 60s...")
                time.sleep(60)
                continue
            if resp.status_code >= 500:
                print(f"  Server error {resp.status_code}, retry {attempt + 1}/{MAX_RETRIES}")
                time.sleep(10)
                continue

            resp.raise_for_status()
            return resp.json()

        except requests.ConnectionError:
            print(f"  Connection error, retry {attempt + 1}/{MAX_RETRIES}")
            time.sleep(30)
        except requests.RequestException as e:
            print(f"  Request error: {e}")
            return None

    return None


def main():
    parser = argparse.ArgumentParser(description="Discover GitHub repos via Hugging Face Papers API")
    parser.add_argument("--db", required=True, help="PostgreSQL connection string")
    parser.add_argument("--limit", type=int, default=0, help="Max papers to process (0 = unlimited)")
    parser.add_argument("--since", help="Only papers published after YYYY-MM-DD")
    parser.add_argument("--offset", type=int, default=0, help="Skip first N candidates")
    parser.add_argument("--dry-run", action="store_true", help="Log but don't write to DB")
    args = parser.parse_args()

    conn = psycopg2.connect(args.db)
    cur = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)

    # Build candidate query
    where_clauses = [
        "p.arxiv_id IS NOT NULL",
        "p.arxiv_id != ''",
        "NOT EXISTS (SELECT 1 FROM paper_code_links pcl WHERE pcl.paper_id = p.id)",
    ]
    params = []

    if args.since:
        where_clauses.append("p.published >= %s")
        params.append(args.since)

    where_sql = " AND ".join(where_clauses)
    limit_sql = f"LIMIT {args.limit}" if args.limit > 0 else ""
    offset_sql = f"OFFSET {args.offset}" if args.offset > 0 else ""

    cur.execute(f"""
        SELECT p.id, p.arxiv_id, p.title
        FROM papers p
        WHERE {where_sql}
        ORDER BY p.published DESC NULLS LAST
        {limit_sql} {offset_sql}
    """, params)

    candidates = cur.fetchall()
    total = len(candidates)
    print(f"Found {total} candidate papers without code links")
    if args.since:
        print(f"  Filtered to papers published since {args.since}")
    if args.dry_run:
        print("  DRY RUN — no database writes")
    print()

    # Stats
    stats = {
        "queried": 0,
        "found_on_hf": 0,
        "has_github_repo": 0,
        "inserted": 0,
        "duplicates": 0,
        "errors": 0,
    }

    for i, row in enumerate(candidates):
        paper_id = row["id"]
        arxiv_id = strip_arxiv_version(row["arxiv_id"])
        title = row["title"]

        stats["queried"] += 1

        # Progress
        if (i + 1) % 100 == 0:
            print(f"Processed {i + 1}/{total} — {stats['inserted']} repos found")

        # Fetch from HF
        data = fetch_hf_paper(arxiv_id)

        if data is None:
            time.sleep(SLEEP_BETWEEN_REQUESTS)
            continue

        stats["found_on_hf"] += 1

        github_repo = data.get("githubRepo")
        github_stars = data.get("githubStars")

        if not github_repo:
            time.sleep(SLEEP_BETWEEN_REQUESTS)
            continue

        stats["has_github_repo"] += 1

        # Normalize URL
        normalized = normalize_github_url(github_repo)
        if not normalized:
            print(f"  WARN: Could not normalize URL: {github_repo} (paper {arxiv_id})")
            stats["errors"] += 1
            time.sleep(SLEEP_BETWEEN_REQUESTS)
            continue

        stars = int(github_stars) if github_stars else 0

        # Check for duplicate
        cur.execute(
            "SELECT 1 FROM paper_code_links WHERE paper_id = %s AND repo_url = %s",
            (paper_id, normalized),
        )
        if cur.fetchone():
            stats["duplicates"] += 1
            time.sleep(SLEEP_BETWEEN_REQUESTS)
            continue

        print(f"  + {arxiv_id} → {normalized} (★ {stars}) — {title[:60]}")

        if not args.dry_run:
            try:
                cur.execute("""
                    INSERT INTO paper_code_links
                        (paper_id, repo_url, is_official, framework, stars, forks,
                         mentioned_in_paper, is_shared_repo)
                    VALUES (%s, %s, true, NULL, %s, NULL, false, false)
                """, (paper_id, normalized, stars))
                conn.commit()
                stats["inserted"] += 1
            except Exception as e:
                conn.rollback()
                print(f"  ERROR inserting: {e}")
                stats["errors"] += 1
        else:
            stats["inserted"] += 1

        time.sleep(SLEEP_BETWEEN_REQUESTS)

    # Summary
    print(f"""
=== Hugging Face Repo Discovery Summary ===
Total papers queried:     {stats['queried']}
Found on HF:             {stats['found_on_hf']}
With GitHub repo:        {stats['has_github_repo']}
New code links inserted: {stats['inserted']}
Duplicates skipped:      {stats['duplicates']}
Errors:                  {stats['errors']}
""")

    conn.close()


if __name__ == "__main__":
    main()
