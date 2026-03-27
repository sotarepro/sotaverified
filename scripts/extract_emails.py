#!/usr/bin/env python3
"""
Extract author emails from papers via HF Papers markdown endpoint.

No database access needed — pure API + regex.

Usage:
    python3 scripts/extract_emails.py 2412.10117 2502.05512
    python3 scripts/extract_emails.py --file arxiv_ids.txt
    python3 scripts/extract_emails.py --csv 2412.10117 2502.05512
"""

import argparse
import csv
import re
import sys
import time

try:
    import requests
except ImportError:
    print("requests required: pip install requests", file=sys.stderr)
    sys.exit(1)

HF_MARKDOWN_URL = "https://huggingface.co/papers/{arxiv_id}.md"
SLEEP_BETWEEN_REQUESTS = 0.5
MAX_RETRIES = 3

# ---------- Email extraction ----------

EMAIL_PATTERN = re.compile(
    r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}'
)

JUNK_EMAIL_PATTERNS = {
    "noreply@", "example@", "example.com", "foo@bar",
    "user@", "email@", "your@", "xxx@", "abc@",
    "author@", "name@example", "firstname.lastname@",
    "john.doe@", "jane.doe@",
}

CORRESPONDING_MARKERS = ["corresponding", "correspondence", "†", "✉", "*"]


def extract_emails_with_context(text: str) -> list[dict]:
    """Extract emails with context and corresponding author detection."""
    results = []
    seen: set[str] = set()
    for m in EMAIL_PATTERN.finditer(text):
        email = m.group(0).lower().rstrip(".")
        if email in seen:
            continue
        if any(junk in email for junk in JUNK_EMAIL_PATTERNS):
            continue
        local = email.split("@")[0]
        if len(local) < 2:
            continue
        # Context: 50 chars before and after
        start = max(0, m.start() - 50)
        end = min(len(text), m.end() + 50)
        context = text[start:end].replace("\n", " ").strip()
        # Check for corresponding author markers in nearby context
        nearby_start = max(0, m.start() - 100)
        nearby_end = min(len(text), m.end() + 30)
        nearby = text[nearby_start:nearby_end].lower()
        is_corresponding = any(marker in nearby for marker in CORRESPONDING_MARKERS)
        seen.add(email)
        results.append({
            "email": email,
            "context": context,
            "is_corresponding": is_corresponding,
        })
    return results


def extract_title(markdown: str) -> str:
    """Extract paper title from HF markdown."""
    for line in markdown.split("\n")[:50]:
        stripped = line.strip()
        # "# Title" heading
        if stripped.startswith("# "):
            return stripped[2:].strip()[:120]
        # "Title: ..." metadata line (HF format)
        # Sometimes contains SVG junk before the real title, e.g.:
        # "Title: 0 0.08 0.59V...: Real Paper Title Here"
        if stripped.startswith("Title:"):
            title = stripped[6:].strip()
            # If title has letter-starting segments after a colon, take the last meaningful one
            # This handles "SVG garbage: Actual Title"
            parts = title.split(": ")
            for part in reversed(parts):
                part = part.strip()
                if len(part) > 5 and part[0].isalpha():
                    return part[:120]
            if len(title) > 5:
                return title[:120]
    return "(untitled)"


# ---------- HF fetching ----------

def strip_arxiv_version(arxiv_id: str) -> str:
    return re.sub(r"v\d+$", "", arxiv_id.strip())


def fetch_hf_markdown(arxiv_id: str) -> str | None:
    """Fetch paper markdown from HF. Returns text or None on 404/error."""
    url = HF_MARKDOWN_URL.format(arxiv_id=arxiv_id)
    for attempt in range(MAX_RETRIES):
        try:
            resp = requests.get(url, timeout=30)
            if resp.status_code == 404:
                return None
            if resp.status_code == 429:
                print("  Rate limited, sleeping 60s...", file=sys.stderr)
                time.sleep(60)
                continue
            if resp.status_code >= 500:
                print(f"  Server error {resp.status_code}, retry {attempt + 1}/{MAX_RETRIES}", file=sys.stderr)
                time.sleep(10)
                continue
            resp.raise_for_status()
            return resp.text
        except requests.ConnectionError:
            print(f"  Connection error, retry {attempt + 1}/{MAX_RETRIES}", file=sys.stderr)
            time.sleep(30)
        except requests.RequestException as e:
            print(f"  Request error: {e}", file=sys.stderr)
            return None
    return None


# ---------- Main ----------

def main():
    parser = argparse.ArgumentParser(
        description="Extract author emails from papers via HF Papers API"
    )
    parser.add_argument("arxiv_ids", nargs="*", help="arXiv IDs to process")
    parser.add_argument("--file", help="File with one arXiv ID per line")
    parser.add_argument("--csv", action="store_true", help="Output as CSV to stdout")
    args = parser.parse_args()

    # Collect arXiv IDs
    ids: list[str] = []
    if args.file:
        with open(args.file) as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#"):
                    ids.append(line)
    ids.extend(args.arxiv_ids)

    if not ids:
        print("Usage: extract_emails.py ARXIV_ID [ARXIV_ID ...]", file=sys.stderr)
        print("       extract_emails.py --file arxiv_ids.txt", file=sys.stderr)
        sys.exit(1)

    csv_writer = None
    if args.csv:
        csv_writer = csv.DictWriter(
            sys.stdout,
            fieldnames=["arxiv_id", "paper_title", "email", "is_corresponding", "context"],
        )
        csv_writer.writeheader()

    total_emails = 0
    total_found = 0

    for i, raw_id in enumerate(ids):
        arxiv_id = strip_arxiv_version(raw_id)

        if i > 0:
            time.sleep(SLEEP_BETWEEN_REQUESTS)

        markdown = fetch_hf_markdown(arxiv_id)

        if markdown is None:
            if not args.csv:
                print(f"\nPaper: {arxiv_id} — Not found on HF")
            continue

        total_found += 1
        title = extract_title(markdown)
        emails = extract_emails_with_context(markdown)
        total_emails += len(emails)

        if args.csv:
            for e in emails:
                csv_writer.writerow({  # type: ignore[union-attr]
                    "arxiv_id": arxiv_id,
                    "paper_title": title[:120],
                    "email": e["email"],
                    "is_corresponding": e["is_corresponding"],
                    "context": e["context"][:80],
                })
        else:
            short_title = title[:60] + ("..." if len(title) > 60 else "")
            print(f"\nPaper: {short_title} ({arxiv_id})")
            if not emails:
                print("  (no emails found)")
            for e in emails:
                role = "corresponding" if e["is_corresponding"] else "co-author"
                ctx = e["context"][:60]
                print(f"  * {role}: {e['email']}")
                print(f"    context: \"{ctx}\"")

    if not args.csv:
        print(f"\n--- Summary: {len(ids)} papers queried, {total_found} found on HF, {total_emails} emails extracted ---")


if __name__ == "__main__":
    main()
