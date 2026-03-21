#!/usr/bin/env python3
"""
arXiv OAI-PMH backfill script.
Fetches papers from arXiv for specified date range and inserts into the papers table.

Usage:
    python scripts/arxiv_backfill.py --from 2025-07-01
    python scripts/arxiv_backfill.py --from 2025-07-01 --until 2025-12-31
    python scripts/arxiv_backfill.py --from 2025-07-01 --db postgresql://user@host/db
"""

import argparse
import os
import sys
import time
import xml.etree.ElementTree as ET
from datetime import date, datetime
from urllib.parse import urlencode
from urllib.request import urlopen, Request
from urllib.error import URLError, HTTPError

try:
    import psycopg2
except ImportError:
    print("psycopg2 required: pip install psycopg2-binary", file=sys.stderr)
    sys.exit(1)

OAI_BASE = "https://export.arxiv.org/oai2"
CATEGORIES = ["cs.CV", "cs.LG", "cs.CL", "cs.AI", "cs.NE", "stat.ML"]
NS = {
    "oai": "http://www.openarchives.org/OAI/2.0/",
    "dc": "http://purl.org/dc/elements/1.1/",
    "oai_dc": "http://www.openarchives.org/OAI/2.0/oai_dc/",
    "arxiv": "http://arxiv.org/OAI/arXiv/",
}
SLEEP_BETWEEN_REQUESTS = 20  # OAI-PMH polite crawling requirement
SLEEP_RETRY = 60


def oai_list_records(from_date: str, until_date: str, resumption_token: str | None = None) -> str:
    if resumption_token:
        params = {"verb": "ListRecords", "resumptionToken": resumption_token}
    else:
        params = {
            "verb": "ListRecords",
            "from": from_date,
            "until": until_date,
            "metadataPrefix": "arXiv",
            "set": "cs",
        }
    url = f"{OAI_BASE}?{urlencode(params)}"
    req = Request(url, headers={"User-Agent": "sotaverified-backfill/1.0"})
    for attempt in range(3):
        try:
            with urlopen(req, timeout=60) as resp:
                return resp.read().decode("utf-8")
        except HTTPError as e:
            if e.code == 503:
                retry_after = int(e.headers.get("Retry-After", SLEEP_RETRY))
                print(f"  503 received, sleeping {retry_after}s...")
                time.sleep(retry_after)
            else:
                raise
        except URLError as e:
            print(f"  Network error (attempt {attempt+1}/3): {e}")
            if attempt < 2:
                time.sleep(SLEEP_RETRY)
            else:
                raise
    raise RuntimeError("Failed after 3 attempts")


def parse_records(xml_text: str) -> tuple[list[dict], str | None]:
    root = ET.fromstring(xml_text)
    records = []

    for record in root.findall(".//oai:record", NS):
        header = record.find("oai:header", NS)
        if header is not None and header.get("status") == "deleted":
            continue

        metadata = record.find("oai:metadata", NS)
        if metadata is None:
            continue

        arXiv = metadata.find("arxiv:arXiv", NS)
        if arXiv is None:
            continue

        arxiv_id_raw = arXiv.findtext("arxiv:id", default="", namespaces=NS).strip()
        if not arxiv_id_raw:
            continue

        # Normalize: strip version suffix, ensure NNNN.NNNNN format
        arxiv_id = arxiv_id_raw.split("v")[0]

        title_el = arXiv.find("arxiv:title", NS)
        title = " ".join(title_el.text.split()) if title_el is not None and title_el.text else ""

        abstract_el = arXiv.find("arxiv:abstract", NS)
        abstract = " ".join(abstract_el.text.split()) if abstract_el is not None and abstract_el.text else None

        # Authors
        authors = []
        for author_el in arXiv.findall("arxiv:authors/arxiv:author", NS):
            keyname = author_el.findtext("arxiv:keyname", default="", namespaces=NS)
            forenames = author_el.findtext("arxiv:forenames", default="", namespaces=NS)
            name = f"{forenames} {keyname}".strip() if forenames else keyname.strip()
            if name:
                authors.append(name)

        # Date
        created_el = arXiv.find("arxiv:created", NS)
        published = created_el.text.strip() if created_el is not None and created_el.text else None

        # Filter by target categories
        categories_el = arXiv.find("arxiv:categories", NS)
        cats = categories_el.text.strip().split() if categories_el is not None and categories_el.text else []
        if not any(c in CATEGORIES for c in cats):
            continue

        records.append({
            "arxiv_id": arxiv_id,
            "title": title,
            "abstract": abstract,
            "authors": authors,
            "published": published,
        })

    # Check for resumption token
    token_el = root.find(".//oai:resumptionToken", NS)
    resumption_token = None
    if token_el is not None and token_el.text and token_el.text.strip():
        resumption_token = token_el.text.strip()

    return records, resumption_token


def insert_papers(conn, records: list[dict]) -> int:
    if not records:
        return 0
    cur = conn.cursor()
    inserted = 0
    for r in records:
        # Build paper ID: strip dot from arxiv_id
        paper_id = r["arxiv_id"].replace(".", "")
        cur.execute(
            """
            INSERT INTO papers
              (id, arxiv_id, title, abstract, authors, published,
               url_abs, url_pdf, tasks, methods, verification)
            VALUES
              (%s, %s, %s, %s, %s, %s,
               %s, %s, '{}', '{}', 'unverified')
            ON CONFLICT (arxiv_id) DO NOTHING
            """,
            (
                paper_id,
                r["arxiv_id"],
                r["title"],
                r["abstract"],
                r["authors"],  # psycopg2 converts Python list to text[]
                r["published"],
                f"https://arxiv.org/abs/{r['arxiv_id']}",
                f"https://arxiv.org/pdf/{r['arxiv_id']}",
            ),
        )
        if cur.rowcount > 0:
            inserted += 1
    conn.commit()
    cur.close()
    return inserted


def main():
    parser = argparse.ArgumentParser(description="Backfill arXiv papers via OAI-PMH")
    parser.add_argument("--from", dest="from_date", default="2025-07-01",
                        help="Start date YYYY-MM-DD (default: 2025-07-01)")
    parser.add_argument("--until", dest="until_date",
                        default=date.today().isoformat(),
                        help="End date YYYY-MM-DD (default: today)")
    parser.add_argument("--db", default=os.environ.get("DATABASE_URL", "postgresql://david@localhost/pwc"),
                        help="PostgreSQL connection string")
    args = parser.parse_args()

    print(f"Backfilling arXiv papers from {args.from_date} to {args.until_date}")
    print(f"Categories: {', '.join(CATEGORIES)}")

    conn = psycopg2.connect(args.db)

    total_inserted = 0
    total_seen = 0
    resumption_token = None
    page = 0

    while True:
        page += 1
        print(f"  Fetching page {page}...", end="", flush=True)
        try:
            xml_text = oai_list_records(args.from_date, args.until_date, resumption_token)
        except Exception as e:
            print(f"\nFATAL: {e}")
            break

        records, resumption_token = parse_records(xml_text)
        print(f" {len(records)} records", end="")

        inserted = insert_papers(conn, records)
        total_inserted += inserted
        total_seen += len(records)
        print(f" ({inserted} new, {total_inserted} total inserted)")

        if resumption_token is None:
            break

        time.sleep(SLEEP_BETWEEN_REQUESTS)

    conn.close()
    print(f"\nDone. Total papers seen: {total_seen}, inserted: {total_inserted}")


if __name__ == "__main__":
    main()
