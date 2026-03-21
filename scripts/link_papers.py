#!/usr/bin/env python3
"""
Post-ingest fix: link leaderboard_results.paper_id to papers via arxiv_id.

The eval-tables Parquet stores paper_url as direct arxiv/venue URLs, not PWC
slugs, so the FK check in ingest.py silently set paper_id = NULL for every row.
This script reads the cached eval Parquet, extracts arxiv IDs from those URLs,
looks up the matching papers.id, and back-fills leaderboard_results.paper_id.

Run:
    python scripts/link_papers.py
    python scripts/link_papers.py --dry-run   # count matches without writing
"""
import argparse
import logging
import re
import sys
from pathlib import Path

import psycopg
import pyarrow.parquet as pq

LOG = logging.getLogger("link_papers")
DATA_DIR = Path(__file__).parent.parent / "data"


def arxiv_id_from_url(url: str | None) -> str | None:
    """Extract bare arxiv ID from any arxiv.org URL, stripping version suffix."""
    if not url:
        return None
    m = re.search(r"arxiv\.org/(?:abs|pdf)/([0-9]{4}\.[0-9]+)", url, re.I)
    if m:
        return re.sub(r"v\d+$", "", m.group(1))  # strip v1/v2/...
    return None


def slugify(text: str) -> str:
    text = text.lower().strip()
    text = re.sub(r"[^\w\s-]", "", text)
    text = re.sub(r"[\s_-]+", "-", text)
    return text[:200]


def main() -> None:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s  %(levelname)-8s  %(message)s",
        stream=sys.stderr,
    )

    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true", help="Count matches without writing")
    args = parser.parse_args()

    conn = psycopg.connect("host=/var/run/postgresql dbname=pwc", autocommit=False)

    # Build arxiv_id → paper_id lookup (strip version from stored ids too)
    LOG.info("Loading arxiv_id → paper_id map …")
    with conn.cursor() as cur:
        cur.execute("SELECT id, arxiv_id FROM papers WHERE arxiv_id IS NOT NULL")
        arxiv_map: dict[str, str] = {}
        for paper_id, arxiv_id in cur.fetchall():
            # Store both with and without version suffix
            arxiv_map[arxiv_id] = paper_id
            base = re.sub(r"v\d+$", "", arxiv_id)
            arxiv_map.setdefault(base, paper_id)
    LOG.info("  %d arxiv IDs indexed (%d papers)", len(arxiv_map), len(set(arxiv_map.values())))

    # Scan eval Parquet and collect (paper_id, task_id, dataset_id, model_name) tuples
    eval_shards = sorted(DATA_DIR.glob("eval_*.parquet"))
    if not eval_shards:
        LOG.error("No eval_*.parquet found in %s — run ingest.py first", DATA_DIR)
        sys.exit(1)

    LOG.info("Scanning %d eval shards for paper_url → arxiv_id matches …", len(eval_shards))
    # (task_id, dataset_id, model_name) → paper_id
    updates: dict[tuple[str, str, str], str] = {}
    no_arxiv = 0

    for path in eval_shards:
        LOG.info("  %s", path.name)
        pf = pq.ParquetFile(path)
        for rb in pf.iter_batches(batch_size=1):
            for row_idx in range(len(rb)):
                task_name = rb["task"][row_idx].as_py()
                if not task_name:
                    continue
                tid = slugify(task_name)

                ds_arr = rb["datasets"][row_idx]
                if not ds_arr.is_valid:
                    continue

                for ds_entry in ds_arr:
                    if not ds_entry.is_valid:
                        continue
                    ds_name_s = ds_entry["dataset"]
                    ds_name = ds_name_s.as_py() if ds_name_s.is_valid else None
                    if not ds_name:
                        continue
                    ds_id = slugify(ds_name)

                    sota_s = ds_entry["sota"]
                    if not sota_s.is_valid:
                        continue
                    rows_s = sota_s["rows"]
                    if not rows_s.is_valid:
                        continue

                    for lr_s in rows_s:
                        if not lr_s.is_valid:
                            continue
                        paper_url_s = lr_s["paper_url"]
                        paper_url = paper_url_s.as_py() if paper_url_s.is_valid else None
                        model_s = lr_s["model_name"]
                        model_name = model_s.as_py() if model_s.is_valid else None
                        if not model_name or not paper_url:
                            continue

                        arxiv_id = arxiv_id_from_url(paper_url)
                        if not arxiv_id:
                            no_arxiv += 1
                            continue

                        paper_id = arxiv_map.get(arxiv_id)
                        if not paper_id:
                            continue

                        key = (tid, ds_id, model_name)
                        updates[key] = paper_id

    LOG.info(
        "Matches: %d linkable | %d paper_urls had no arxiv ID (IEEE/ACL/etc.)",
        len(updates), no_arxiv,
    )

    if args.dry_run:
        LOG.info("Dry run — not writing to DB.")
        conn.close()
        return

    LOG.info("Back-filling leaderboard_results.paper_id …")
    updated_rows = 0
    BATCH = 500
    items = list(updates.items())
    for i in range(0, len(items), BATCH):
        chunk = items[i : i + BATCH]
        with conn.cursor() as cur:
            for (task_id, dataset_id, model_name), paper_id in chunk:
                cur.execute(
                    """
                    UPDATE leaderboard_results
                    SET paper_id = %s
                    WHERE task_id = %s
                      AND dataset_id = %s
                      AND model_name = %s
                      AND paper_id IS NULL
                    """,
                    (paper_id, task_id, dataset_id, model_name),
                )
                updated_rows += cur.rowcount
        conn.commit()
        LOG.info("  committed batch %d/%d (%d rows updated so far)", i // BATCH + 1, -(-len(items) // BATCH), updated_rows)

    LOG.info("Done — updated paper_id for %d leaderboard_results rows", updated_rows)
    conn.close()


if __name__ == "__main__":
    main()
