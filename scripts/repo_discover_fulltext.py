#!/usr/bin/env python3
"""
Discover GitHub repos and author emails from full paper text via HF Papers.

Fetches markdown-rendered full text from https://huggingface.co/papers/{arxiv_id}.md,
extracts GitHub repo URLs (inserts into paper_code_links) and author emails
(exports to CSV for outreach).

Usage:
    python3 scripts/repo_discover_fulltext.py --dry-run --limit 20
    python3 scripts/repo_discover_fulltext.py --limit 1000 --since 2024-01-01
    python3 scripts/repo_discover_fulltext.py --emails-only --limit 500
    python3 scripts/repo_discover_fulltext.py --repos-only --limit 500
"""

import argparse
import csv
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

HF_MARKDOWN_URL = "https://huggingface.co/papers/{arxiv_id}.md"
SLEEP_BETWEEN_REQUESTS = 1.0  # 1 req/sec — be polite
MAX_RETRIES = 3
EMAILS_CSV_PATH = "/home/david/paper_author_emails.csv"

# ---------- GitHub URL extraction (same logic as repo_discover_abstracts.py) ----------

GITHUB_URL_PATTERN = re.compile(
    r'(?:'
    r'\\url\{(https?://github\.com/[^}\s]+)\}'
    r'|\\href\{(https?://github\.com/[^}\s]+)\}'
    r'|(https?://github\.com/[^\s,;)\]}\\\n]+)'
    r'|((?<![/\w])github\.com/[^\s,;)\]}\\\n]+)'
    r')',
    re.IGNORECASE,
)

JUNK_OWNERS = {
    "github", "features", "topics", "trending", "orgs", "settings",
    "notifications", "marketplace", "explore", "sponsors", "about",
    "login", "signup", "join", "new", "codespaces", "security",
}

# Infrastructure/tool repos commonly referenced in paper text but not the paper's code
INFRA_REPOS = {
    "https://github.com/brucemiller/latexml",
    "https://github.com/arxiv/html_feedback",
    "https://github.com/arxiv/arxiv-latex-cleaner",
    "https://github.com/google-research/arxiv-latex-cleaner",
    "https://github.com/retorquere/zotero-better-bibtex",
    "https://github.com/citation-style-language/styles",
    "https://github.com/jgm/pandoc",
}


def normalize_github_url(raw: str) -> str | None:
    """Normalize a GitHub URL to https://github.com/{owner}/{repo}."""
    url = raw.strip().rstrip(".,;:!?")
    while url and url[-1] in ")]}":
        url = url[:-1]
    if not url.lower().startswith("http"):
        url = "https://" + url
    url = url.lower().rstrip("/")
    if url.endswith(".git"):
        url = url[:-4]
    match = re.match(r"https?://github\.com/([a-z0-9._-]+)/([a-z0-9._-]+)", url)
    if not match:
        return None
    owner, repo = match.group(1), match.group(2)
    if owner in JUNK_OWNERS:
        return None
    if len(owner) <= 1 or len(repo) <= 1:
        return None
    if repo in ("issues", "pulls", "actions", "wiki", "releases", "blob", "tree"):
        return None
    return f"https://github.com/{owner}/{repo}"


def extract_github_urls(text: str) -> set[str]:
    """Extract and normalize all GitHub repo URLs from text."""
    urls = set()
    for m in GITHUB_URL_PATTERN.finditer(text):
        raw = m.group(1) or m.group(2) or m.group(3) or m.group(4)
        if raw:
            normalized = normalize_github_url(raw)
            if normalized:
                urls.add(normalized)
    return urls


# ---------- Email extraction ----------

EMAIL_PATTERN = re.compile(
    r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}'
)

# Domains / patterns to skip
JUNK_EMAIL_PATTERNS = {
    "noreply@", "example@", "example.com", "foo@bar",
    "user@", "email@", "your@", "xxx@", "abc@",
    "author@", "name@example",
}


def extract_emails(text: str) -> list[tuple[str, str]]:
    """Extract emails with surrounding context. Returns [(email, context), ...]."""
    results = []
    seen = set()
    for m in EMAIL_PATTERN.finditer(text):
        email = m.group(0).lower().rstrip(".")
        if email in seen:
            continue
        # Skip junk
        if any(junk in email for junk in JUNK_EMAIL_PATTERNS):
            continue
        # Skip very short local parts (likely noise)
        local = email.split("@")[0]
        if len(local) < 2:
            continue
        # Extract context: 30 chars before and after
        start = max(0, m.start() - 30)
        end = min(len(text), m.end() + 30)
        context = text[start:end].replace("\n", " ").strip()
        seen.add(email)
        results.append((email, context))
    return results


# ---------- HF fetching ----------

def strip_arxiv_version(arxiv_id: str) -> str:
    """Strip version suffix: 2401.12345v2 -> 2401.12345"""
    return re.sub(r"v\d+$", "", arxiv_id.strip())


def fetch_hf_markdown(arxiv_id: str, sleep_time: float) -> str | None:
    """Fetch paper markdown from HF. Returns text or None on 404/error."""
    url = HF_MARKDOWN_URL.format(arxiv_id=arxiv_id)

    for attempt in range(MAX_RETRIES):
        try:
            resp = requests.get(url, timeout=30)

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
            return resp.text

        except requests.ConnectionError:
            print(f"  Connection error, retry {attempt + 1}/{MAX_RETRIES}")
            time.sleep(30)
        except requests.RequestException as e:
            print(f"  Request error: {e}")
            return None

    return None


# ---------- Main ----------

def main():
    parser = argparse.ArgumentParser(
        description="Discover GitHub repos and author emails from full paper text via HF Papers"
    )
    parser.add_argument("--db", default=os.environ.get("DATABASE_PUBLIC_URL", os.environ.get("DATABASE_URL")),
                        help="PostgreSQL connection string")
    parser.add_argument("--limit", type=int, default=1000, help="Max papers to process (default: 1000)")
    parser.add_argument("--since", help="Only papers published after YYYY-MM-DD")
    parser.add_argument("--dry-run", action="store_true", help="Log but don't write to DB")
    parser.add_argument("--emails-only", action="store_true", help="Skip repo extraction, just extract emails")
    parser.add_argument("--repos-only", action="store_true", help="Skip email extraction, just extract repos")
    parser.add_argument("--sleep", type=float, default=SLEEP_BETWEEN_REQUESTS,
                        help=f"Seconds between requests (default: {SLEEP_BETWEEN_REQUESTS})")
    parser.add_argument("--emails-csv", default=EMAILS_CSV_PATH,
                        help=f"Output CSV path for emails (default: {EMAILS_CSV_PATH})")
    args = parser.parse_args()

    if args.emails_only and args.repos_only:
        print("Error: --emails-only and --repos-only are mutually exclusive", file=sys.stderr)
        sys.exit(1)

    do_repos = not args.emails_only
    do_emails = not args.repos_only

    if not args.db:
        print("Error: provide --db or set DATABASE_PUBLIC_URL", file=sys.stderr)
        sys.exit(1)

    conn = psycopg2.connect(args.db)
    cur = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)

    # Build shared repo exclusion list (repos appearing in 5+ papers)
    shared_repos = set()
    if do_repos:
        cur.execute("""
            SELECT repo_url FROM paper_code_links
            GROUP BY repo_url HAVING COUNT(DISTINCT paper_id) >= 5
        """)
        shared_repos = {row[0].lower() for row in cur.fetchall()}
        print(f"Loaded {len(shared_repos)} shared mega-repos to exclude")

    # Build candidate query: papers with arxiv_id and no code links
    where_clauses = [
        "p.arxiv_id IS NOT NULL",
        "p.arxiv_id != ''",
    ]
    params: list = []

    if do_repos and not do_emails:
        # repos-only: only papers without code links
        where_clauses.append(
            "NOT EXISTS (SELECT 1 FROM paper_code_links pcl WHERE pcl.paper_id = p.id)"
        )

    if args.since:
        where_clauses.append("p.published >= %s")
        params.append(args.since)

    where_sql = " AND ".join(where_clauses)
    limit_sql = f"LIMIT {args.limit}" if args.limit > 0 else ""

    cur.execute(f"""
        SELECT p.id, p.arxiv_id, p.title
        FROM papers p
        WHERE {where_sql}
        ORDER BY p.published DESC NULLS LAST
        {limit_sql}
    """, params)

    candidates = cur.fetchall()
    total = len(candidates)

    print(f"Found {total} candidate papers")
    if args.since:
        print(f"  Filtered to papers published since {args.since}")
    if args.dry_run:
        print("  DRY RUN — no database writes")
    if do_repos:
        print("  Extracting: GitHub repos")
    if do_emails:
        print(f"  Extracting: author emails → {args.emails_csv}")
    print()

    stats = {
        "queried": 0,
        "found_on_hf": 0,
        "repos_found": 0,
        "repos_inserted": 0,
        "repos_duplicate": 0,
        "repos_shared_skipped": 0,
        "emails_found": 0,
        "errors": 0,
    }

    # Prepare email CSV — open file immediately so rows flush incrementally
    email_file = None
    email_writer = None
    emails_written = 0
    if do_emails:
        email_file = open(args.emails_csv, "w", newline="")
        email_writer = csv.DictWriter(email_file, fieldnames=["arxiv_id", "paper_title", "email", "context"])
        email_writer.writeheader()
        email_file.flush()

    for i, row in enumerate(candidates):
        paper_id = row["id"]
        arxiv_id_raw = row["arxiv_id"]
        title = row["title"] or ""
        arxiv_id = strip_arxiv_version(arxiv_id_raw)

        stats["queried"] += 1

        # Progress
        if (i + 1) % 50 == 0:
            print(
                f"Processed {i + 1}/{total} — "
                f"{stats['repos_inserted']} repos, {stats['emails_found']} emails found"
            )

        # Fetch markdown from HF
        markdown = fetch_hf_markdown(arxiv_id, args.sleep)
        time.sleep(args.sleep)

        if markdown is None:
            continue

        stats["found_on_hf"] += 1

        # --- Repo extraction ---
        if do_repos:
            urls = extract_github_urls(markdown)
            # Filter out shared mega-repos and known infrastructure repos
            urls = {u for u in urls if u not in shared_repos and u not in INFRA_REPOS}

            if urls:
                stats["repos_found"] += len(urls)
                for repo_url in urls:
                    # Check duplicate
                    cur.execute(
                        "SELECT 1 FROM paper_code_links WHERE paper_id = %s AND repo_url = %s",
                        (paper_id, repo_url),
                    )
                    if cur.fetchone():
                        stats["repos_duplicate"] += 1
                        continue

                    if not args.dry_run:
                        try:
                            cur.execute("""
                                INSERT INTO paper_code_links
                                    (paper_id, repo_url, is_official, framework, stars, forks,
                                     mentioned_in_paper, is_shared_repo)
                                VALUES (%s, %s, true, NULL, 0, NULL, true, false)
                            """, (paper_id, repo_url))
                            conn.commit()
                            stats["repos_inserted"] += 1
                        except Exception as e:
                            conn.rollback()
                            print(f"  ERROR inserting {paper_id} → {repo_url}: {e}")
                            stats["errors"] += 1
                            continue
                    else:
                        stats["repos_inserted"] += 1

                    print(f"  + REPO {arxiv_id} → {repo_url} — {title[:50]}")

        # --- Email extraction ---
        if do_emails and email_writer:
            emails = extract_emails(markdown)
            if emails:
                stats["emails_found"] += len(emails)
                for email, context in emails:
                    email_writer.writerow({
                        "arxiv_id": arxiv_id,
                        "paper_title": title[:120],
                        "email": email,
                        "context": context[:80],
                    })
                    emails_written += 1
                email_file.flush()  # type: ignore[union-attr]

    # Close email CSV
    if email_file:
        email_file.close()
        if emails_written > 0:
            print(f"\nWrote {emails_written} emails to {args.emails_csv}")

    # Summary
    print(f"""
=== Full-Text Discovery Summary ===
Papers queried:           {stats['queried']}
Found on HF:             {stats['found_on_hf']}
""")

    if do_repos:
        print(f"GitHub repos found:       {stats['repos_found']}")
        print(f"New code links inserted:  {stats['repos_inserted']}")
        print(f"Duplicates skipped:       {stats['repos_duplicate']}")
        print(f"Shared repos skipped:     {stats['repos_shared_skipped']}")

    if do_emails:
        print(f"Emails extracted:         {stats['emails_found']}")

    print(f"Errors:                   {stats['errors']}")

    conn.close()


if __name__ == "__main__":
    main()
