#!/usr/bin/env python3
"""
Discover GitHub repos from paper abstracts via regex.

Scans papers.abstract for GitHub URLs and inserts discovered repos
into paper_code_links. Zero external API calls — pure regex over
existing DB data.

Usage:
    python3 scripts/repo_discover_abstracts.py --db "dbname=pwc" --dry-run
    python3 scripts/repo_discover_abstracts.py --db "dbname=pwc" --pass 1 --limit 5000
"""

import argparse
import os
import re
import sys

try:
    import psycopg2
    import psycopg2.extras
except ImportError:
    print("psycopg2 required: pip install psycopg2-binary", file=sys.stderr)
    sys.exit(1)

# Regex to find GitHub URLs in text (handles plain, LaTeX \url{}, \href{}{})
# Captures the full URL including path segments
GITHUB_URL_PATTERN = re.compile(
    r'(?:'
    r'\\url\{(https?://github\.com/[^}\s]+)\}'       # \url{https://github.com/...}
    r'|\\href\{(https?://github\.com/[^}\s]+)\}'     # \href{https://github.com/...}{...}
    r'|(https?://github\.com/[^\s,;)\]}\\\n]+)'      # https://github.com/...
    r'|((?<![/\w])github\.com/[^\s,;)\]}\\\n]+)'     # github.com/... (no scheme)
    r')',
    re.IGNORECASE,
)

# Known junk "repos" to skip
JUNK_OWNERS = {
    "github", "features", "topics", "trending", "orgs", "settings",
    "notifications", "marketplace", "explore", "sponsors", "about",
    "login", "signup", "join", "new", "codespaces", "security",
}


def normalize_github_url(raw: str) -> str | None:
    """Normalize a GitHub URL to https://github.com/{owner}/{repo}."""
    url = raw.strip().rstrip(".,;:!?")

    # Remove trailing ) ] } if they look like punctuation, not part of URL
    while url and url[-1] in ")]}":
        url = url[:-1]

    if not url.lower().startswith("http"):
        url = "https://" + url

    url = url.lower().rstrip("/")
    if url.endswith(".git"):
        url = url[:-4]

    # Extract owner/repo only
    match = re.match(r"https?://github\.com/([a-z0-9._-]+)/([a-z0-9._-]+)", url)
    if not match:
        return None

    owner, repo = match.group(1), match.group(2)

    # Skip junk
    if owner in JUNK_OWNERS:
        return None
    if len(owner) <= 1 or len(repo) <= 1:
        return None
    # Skip paths that aren't repos
    if repo in ("issues", "pulls", "actions", "wiki", "releases", "blob", "tree"):
        return None

    return f"https://github.com/{owner}/{repo}"


def extract_github_urls(text: str) -> set[str]:
    """Extract and normalize all GitHub repo URLs from text."""
    urls = set()
    for m in GITHUB_URL_PATTERN.finditer(text):
        # One of the capture groups will have the URL
        raw = m.group(1) or m.group(2) or m.group(3) or m.group(4)
        if raw:
            normalized = normalize_github_url(raw)
            if normalized:
                urls.add(normalized)
    return urls


def run_pass(cur, conn, pass_num: int, limit: int, dry_run: bool) -> dict:
    """Run one pass (1 = no existing links, 2 = has existing links)."""
    if pass_num == 1:
        exists_clause = "NOT EXISTS"
        label = "without code links"
    else:
        exists_clause = "EXISTS"
        label = "with existing code links"

    limit_sql = f"LIMIT {limit}" if limit > 0 else ""

    cur.execute(f"""
        SELECT p.id, p.arxiv_id, p.abstract
        FROM papers p
        WHERE p.abstract IS NOT NULL
          AND p.abstract != ''
          AND {exists_clause} (
            SELECT 1 FROM paper_code_links pcl WHERE pcl.paper_id = p.id
          )
        {limit_sql}
    """)

    rows = cur.fetchall()
    total = len(rows)
    print(f"Pass {pass_num}: {total} papers {label}")

    stats = {
        "scanned": 0,
        "with_urls": 0,
        "repos_found": 0,
        "inserted": 0,
        "duplicates": 0,
    }

    for i, row in enumerate(rows):
        paper_id = row[0]
        arxiv_id = row[1] or ""
        abstract = row[2] or ""
        stats["scanned"] += 1

        if (i + 1) % 10000 == 0:
            print(f"  Progress: {i + 1}/{total} — {stats['inserted']} new repos")

        urls = extract_github_urls(abstract)
        if not urls:
            continue

        stats["with_urls"] += 1
        stats["repos_found"] += len(urls)

        for repo_url in urls:
            # Check duplicate
            cur.execute(
                "SELECT 1 FROM paper_code_links WHERE paper_id = %s AND repo_url = %s",
                (paper_id, repo_url),
            )
            if cur.fetchone():
                stats["duplicates"] += 1
                continue

            if not dry_run:
                try:
                    cur.execute("""
                        INSERT INTO paper_code_links
                            (paper_id, repo_url, is_official, framework, stars, forks,
                             mentioned_in_paper, is_shared_repo)
                        VALUES (%s, %s, true, NULL, 0, NULL, true, false)
                    """, (paper_id, repo_url))
                    conn.commit()
                except Exception as e:
                    conn.rollback()
                    print(f"  ERROR inserting {paper_id} → {repo_url}: {e}")
                    continue

            stats["inserted"] += 1
            print(f"  + {arxiv_id or paper_id} → {repo_url}")

    return stats


def main():
    parser = argparse.ArgumentParser(description="Discover GitHub repos from paper abstracts")
    parser.add_argument("--db", default=os.environ.get("DATABASE_PUBLIC_URL", os.environ.get("DATABASE_URL")), help="PostgreSQL connection string")
    parser.add_argument("--pass", dest="pass_num", choices=["1", "2", "both"], default="both",
                        help="Which pass to run (default: both)")
    parser.add_argument("--limit", type=int, default=0, help="Max papers per pass (0 = unlimited)")
    parser.add_argument("--dry-run", action="store_true", help="Log but don't write to DB")
    args = parser.parse_args()

    if not args.db:
        print("Error: provide --db or set DATABASE_PUBLIC_URL", file=sys.stderr)
        sys.exit(1)
    conn = psycopg2.connect(args.db)
    cur = conn.cursor()

    if args.dry_run:
        print("DRY RUN — no database writes\n")

    passes = []
    if args.pass_num in ("1", "both"):
        passes.append(1)
    if args.pass_num in ("2", "both"):
        passes.append(2)

    all_stats = {}
    for p in passes:
        stats = run_pass(cur, conn, p, args.limit, args.dry_run)
        all_stats[p] = stats
        print()

    # Summary
    print("=== Abstract Repo Discovery Summary ===")
    for p, stats in all_stats.items():
        label = "no existing links" if p == 1 else "has existing links"
        print(f"\nPass {p} ({label}):")
        print(f"  Papers scanned:         {stats['scanned']}")
        print(f"  With GitHub URLs:       {stats['with_urls']}")
        print(f"  Unique repos found:     {stats['repos_found']}")
        print(f"  New code links inserted:{stats['inserted']}")
        print(f"  Duplicates skipped:     {stats['duplicates']}")

    total_inserted = sum(s["inserted"] for s in all_stats.values())
    print(f"\nTotal new code links: {total_inserted}")

    conn.close()


if __name__ == "__main__":
    main()
