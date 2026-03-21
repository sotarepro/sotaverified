#!/usr/bin/env python3
"""
Papers with Code — data ingestion script.

Downloads Parquet shards from the pwc-archive namespace on Hugging Face,
parses them, and upserts everything into Postgres.

Usage:
    python ingest.py [--dsn "postgresql://..."] [--skip-download] [--only papers links ...]

Requires:
    pip install psycopg[binary] pyarrow requests tqdm
"""

import argparse
import io
import json
import logging
import os
import re
import sys
from pathlib import Path
from typing import Any

import pyarrow.parquet as pq
import requests
from tqdm import tqdm

import psycopg

# ─── Configuration ────────────────────────────────────────────────────────────

DATA_DIR = Path(__file__).parent.parent / "data"

HF_BASE = "https://huggingface.co/api/datasets/pwc-archive"

# Maps logical name → HF dataset slug
DATASETS = {
    "papers":    "papers-with-abstracts",
    "links":     "links-between-paper-and-code",
    "methods":   "methods",
    "datasets":  "datasets",
    "eval":      "evaluation-tables",
}

BATCH_SIZE = 500
LOG = logging.getLogger("pwc_ingest")


# ─── Helpers ──────────────────────────────────────────────────────────────────

def slugify(text: str) -> str:
    text = text.lower().strip()
    text = re.sub(r"[^\w\s-]", "", text)
    text = re.sub(r"[\s_-]+", "-", text)
    return text[:200]


def parquet_urls(hf_slug: str) -> list[str]:
    """Return all train-split parquet shard URLs for a HF dataset."""
    resp = requests.get(f"{HF_BASE}/{hf_slug}/parquet", timeout=30)
    resp.raise_for_status()
    return resp.json().get("default", {}).get("train", [])


def download_parquet(name: str, hf_slug: str, dest: Path, force: bool = False) -> list[Path]:
    """Download all shards; return list of local paths."""
    dest.mkdir(parents=True, exist_ok=True)
    urls = parquet_urls(hf_slug)
    paths = []
    for i, url in enumerate(urls):
        local = dest / f"{name}_{i:04d}.parquet"
        if local.exists() and not force:
            LOG.info("  [cache] %s", local.name)
        else:
            LOG.info("  [download] shard %d/%d  %s", i + 1, len(urls), local.name)
            resp = requests.get(url, stream=True, timeout=120)
            resp.raise_for_status()
            total = int(resp.headers.get("content-length", 0))
            with open(local, "wb") as fh, tqdm(
                total=total, unit="B", unit_scale=True, desc=local.name, leave=False
            ) as bar:
                for chunk in resp.iter_content(65536):
                    fh.write(chunk)
                    bar.update(len(chunk))
        paths.append(local)
    return paths


def load_parquet(paths: list[Path]) -> list[dict]:
    """Read all shards, return list of row dicts."""
    rows = []
    for p in paths:
        tbl = pq.read_table(p)
        rows.extend(tbl.to_pylist())
    LOG.info("  loaded %d rows", len(rows))
    return rows


def batch(iterable, n: int):
    buf = []
    for item in iterable:
        buf.append(item)
        if len(buf) >= n:
            yield buf
            buf = []
    if buf:
        yield buf


def paper_id_from_url(url: str | None) -> str | None:
    if not url:
        return None
    return url.rstrip("/").split("/")[-1] or None


def safe_year(val) -> int | None:
    try:
        y = int(val)
        return y if 1900 < y < 2100 else None
    except (TypeError, ValueError):
        return None


def listify(val) -> list:
    if val is None:
        return []
    if isinstance(val, list):
        return val
    return [val]


def pick_best_metric(metrics: dict[str, Any], ordered_names: list[str]) -> tuple[str | None, float | None]:
    for name in ordered_names:
        val = metrics.get(name)
        if val is not None and val != "":
            try:
                return name, float(str(val).replace("%", "").replace(",", ""))
            except (ValueError, TypeError):
                pass
    for name, val in metrics.items():
        if val is not None and val != "":
            try:
                return name, float(str(val).replace("%", "").replace(",", ""))
            except (ValueError, TypeError):
                pass
    return None, None


# ─── Ingestion ────────────────────────────────────────────────────────────────

def ingest_papers(conn, rows: list[dict]) -> None:
    LOG.info("[papers] upserting %d rows …", len(rows))
    q = """
        INSERT INTO papers
            (id, arxiv_id, title, abstract, url_abs, url_pdf,
             published, authors, proceeding, tasks, methods)
        VALUES
            (%(id)s, %(arxiv_id)s, %(title)s, %(abstract)s,
             %(url_abs)s, %(url_pdf)s, %(published)s,
             %(authors)s, %(proceeding)s, %(tasks)s, %(methods)s)
        ON CONFLICT (id) DO UPDATE SET
            arxiv_id   = EXCLUDED.arxiv_id,
            title      = EXCLUDED.title,
            abstract   = EXCLUDED.abstract,
            url_abs    = EXCLUDED.url_abs,
            url_pdf    = EXCLUDED.url_pdf,
            published  = EXCLUDED.published,
            authors    = EXCLUDED.authors,
            proceeding = EXCLUDED.proceeding,
            tasks      = EXCLUDED.tasks,
            methods    = EXCLUDED.methods,
            updated_at = now()
    """
    for chunk in tqdm(list(batch(rows, BATCH_SIZE)), desc="papers"):
        records = []
        for r in chunk:
            pid = paper_id_from_url(r.get("paper_url")) or r.get("arxiv_id")
            if not pid or not r.get("title"):
                continue
            # methods is a list of structs; flatten to name list
            raw_methods = r.get("methods") or []
            method_names = [m["name"] for m in raw_methods if isinstance(m, dict) and m.get("name")]
            pub = r.get("date")
            if hasattr(pub, "date"):
                pub = pub.date()
            records.append({
                "id":         pid,
                "arxiv_id":   r.get("arxiv_id"),
                "title":      r.get("title", ""),
                "abstract":   r.get("abstract"),
                "url_abs":    r.get("url_abs") or r.get("paper_url"),
                "url_pdf":    r.get("url_pdf"),
                "published":  pub,
                "authors":    listify(r.get("authors")),
                "proceeding": r.get("proceeding"),
                "tasks":      listify(r.get("tasks")),
                "methods":    method_names,
            })
        with conn.cursor() as cur:
            cur.executemany(q, records)
        conn.commit()


def ingest_code_links(conn, rows: list[dict]) -> None:
    LOG.info("[code_links] upserting %d rows …", len(rows))
    q = """
        INSERT INTO paper_code_links
            (paper_id, repo_url, framework, is_official, mentioned_in_paper)
        SELECT %(paper_id)s, %(repo_url)s, %(framework)s,
               %(is_official)s, %(mentioned_in_paper)s
        WHERE EXISTS (SELECT 1 FROM papers WHERE id = %(paper_id)s)
        ON CONFLICT DO NOTHING
    """
    seen: set[tuple] = set()
    for chunk in tqdm(list(batch(rows, BATCH_SIZE)), desc="code_links"):
        records = []
        for r in chunk:
            pid = paper_id_from_url(r.get("paper_url")) or paper_id_from_url(r.get("paper_url_abs"))
            repo = r.get("repo_url", "")
            if not pid or not repo:
                continue
            key = (pid, repo)
            if key in seen:
                continue
            seen.add(key)
            records.append({
                "paper_id":          pid,
                "repo_url":          repo,
                "framework":         r.get("framework"),
                "is_official":       bool(r.get("is_official")),
                "mentioned_in_paper": bool(r.get("mentioned_in_paper")),
            })
        with conn.cursor() as cur:
            cur.executemany(q, records)
        conn.commit()


def ingest_methods(conn, rows: list[dict]) -> None:
    LOG.info("[methods] upserting %d rows …", len(rows))
    q = """
        INSERT INTO methods
            (id, name, full_name, description, category, main_collection,
             introduced_year, url)
        VALUES
            (%(id)s, %(name)s, %(full_name)s, %(description)s,
             %(category)s, %(main_collection)s, %(introduced_year)s, %(url)s)
        ON CONFLICT (id) DO UPDATE SET
            full_name       = EXCLUDED.full_name,
            description     = EXCLUDED.description,
            category        = EXCLUDED.category,
            main_collection = EXCLUDED.main_collection,
            introduced_year = EXCLUDED.introduced_year,
            url             = EXCLUDED.url,
            updated_at      = now()
    """
    for chunk in tqdm(list(batch(rows, BATCH_SIZE)), desc="methods"):
        records = []
        for r in chunk:
            name = r.get("name", "")
            if not name:
                continue
            # collections is list of {area, area_id, collection} structs
            collections = r.get("collections") or []
            category = None
            main_coll = None
            if collections:
                first = collections[0]
                if isinstance(first, dict):
                    category = first.get("area")
                    main_coll = first.get("collection")
            records.append({
                "id":               slugify(name),
                "name":             name,
                "full_name":        r.get("full_name"),
                "description":      r.get("description"),
                "category":         category,
                "main_collection":  main_coll,
                "introduced_year":  safe_year(r.get("introduced_year")),
                "url":              r.get("url") or r.get("source_url"),
            })
        with conn.cursor() as cur:
            cur.executemany(q, records)
        conn.commit()


def ingest_datasets(conn, rows: list[dict]) -> None:
    LOG.info("[datasets] upserting %d rows …", len(rows))
    q = """
        INSERT INTO datasets
            (id, name, full_name, description, url, introduced_year,
             modalities, languages)
        VALUES
            (%(id)s, %(name)s, %(full_name)s, %(description)s, %(url)s,
             %(introduced_year)s, %(modalities)s, %(languages)s)
        ON CONFLICT (id) DO UPDATE SET
            full_name      = EXCLUDED.full_name,
            description    = EXCLUDED.description,
            url            = EXCLUDED.url,
            introduced_year= EXCLUDED.introduced_year,
            modalities     = EXCLUDED.modalities,
            languages      = EXCLUDED.languages,
            updated_at     = now()
    """
    for chunk in tqdm(list(batch(rows, BATCH_SIZE)), desc="datasets"):
        records = []
        for r in chunk:
            name = r.get("name", "")
            if not name:
                continue
            introduced = r.get("introduced_date") or r.get("introduced_year")
            # introduced_date is a string like "2018-01-01" or just "2018"
            year = None
            if introduced:
                m = re.match(r"(\d{4})", str(introduced))
                if m:
                    year = safe_year(m.group(1))
            records.append({
                "id":               slugify(name),
                "name":             name,
                "full_name":        r.get("full_name"),
                "description":      r.get("description") or r.get("short_description"),
                "url":              r.get("url") or r.get("homepage"),
                "introduced_year":  year,
                "modalities":       listify(r.get("modalities")),
                "languages":        listify(r.get("languages")),
            })
        with conn.cursor() as cur:
            cur.executemany(q, records)
        conn.commit()


def _sparse_struct(scalar) -> dict:
    """
    Convert a pyarrow StructScalar to a Python dict, skipping null/empty values.
    This avoids materialising the ~2000-field metrics struct with mostly-null values.
    """
    if scalar is None or not scalar.is_valid:
        return {}
    result = {}
    for key, val in scalar.items():
        if val.is_valid:
            py = val.as_py()
            if py is not None and py != "":
                result[key] = py
    return result


def ingest_eval_tables_streaming(conn, paths: list[Path]) -> None:
    """
    Process evaluation-tables parquet shards one row at a time using the
    pyarrow scalar API to avoid materialising the huge metrics struct.
    Each top-level table row is one task; nested datasets/sota/rows contain
    the leaderboard data.
    """
    task_q = """
        INSERT INTO tasks (id, name, description)
        VALUES (%(id)s, %(name)s, %(description)s)
        ON CONFLICT (id) DO UPDATE SET
            description = EXCLUDED.description,
            updated_at  = now()
    """
    ds_q = "INSERT INTO datasets (id, name) VALUES (%(id)s, %(name)s) ON CONFLICT (id) DO NOTHING"
    dt_q = "INSERT INTO dataset_tasks (dataset_id, task_id) VALUES (%s, %s) ON CONFLICT DO NOTHING"
    lb_q = """
        INSERT INTO leaderboard_results
            (task_id, dataset_id, paper_id, model_name,
             metrics, best_metric_name, best_metric_value,
             evaluated_on, uses_extra_data, uses_ensemble)
        SELECT %(task_id)s, %(dataset_id)s,
               CASE WHEN EXISTS (SELECT 1 FROM papers WHERE id = %(paper_id)s)
                    THEN %(paper_id)s ELSE NULL END,
               %(model_name)s,
               %(metrics)s, %(best_metric_name)s, %(best_metric_value)s,
               %(evaluated_on)s, %(uses_extra_data)s, %(uses_ensemble)s
        WHERE EXISTS (SELECT 1 FROM tasks    WHERE id = %(task_id)s)
          AND EXISTS (SELECT 1 FROM datasets WHERE id = %(dataset_id)s)
        ON CONFLICT DO NOTHING
    """

    def _process_task_scalar(task_scalar, parent_id=None):
        """Yield (task_row, ds_row, dt_row, lb_row) tuples from one task scalar."""
        task_name = task_scalar["task"].as_py() if task_scalar["task"].is_valid else None
        if not task_name:
            return
        tid = slugify(task_name)
        desc_s = task_scalar["description"]
        desc = desc_s.as_py() if desc_s.is_valid else None
        yield ("task", {"id": tid, "name": task_name, "description": desc})

        # Subtasks (recursive — but depth is shallow in practice)
        subtasks_s = task_scalar["subtasks"]
        if subtasks_s.is_valid:
            for sub in subtasks_s.as_py() or []:  # subtasks are simpler, no metrics struct
                if not isinstance(sub, dict):
                    continue
                sub_name = sub.get("task", "")
                if not sub_name:
                    continue
                sub_id = slugify(sub_name)
                yield ("task", {"id": sub_id, "name": sub_name, "description": sub.get("description")})

        # Datasets
        datasets_s = task_scalar["datasets"]
        if not datasets_s.is_valid:
            return
        for ds_entry in datasets_s:  # pyarrow list iteration
            if not ds_entry.is_valid:
                continue
            ds_name_s = ds_entry["dataset"]
            ds_name = ds_name_s.as_py() if ds_name_s.is_valid else None
            if not ds_name:
                continue
            ds_id = slugify(ds_name)
            yield ("ds",   {"id": ds_id, "name": ds_name})
            yield ("dt",   (ds_id, tid))

            sota_s = ds_entry["sota"]
            if not sota_s.is_valid:
                continue
            metrics_list_s = sota_s["metrics"]
            metrics_order = metrics_list_s.as_py() if metrics_list_s.is_valid else []

            rows_s = sota_s["rows"]
            if not rows_s.is_valid:
                continue
            for lr_s in rows_s:
                if not lr_s.is_valid:
                    continue
                model_s = lr_s["model_name"]
                model_name = model_s.as_py() if model_s.is_valid else ""
                paper_url_s = lr_s["paper_url"]
                paper_url = paper_url_s.as_py() if paper_url_s.is_valid else None
                date_s = lr_s["paper_date"]
                pub_date = date_s.as_py() if date_s.is_valid else None
                if pub_date and hasattr(pub_date, "date"):
                    pub_date = pub_date.date()
                extra_s = lr_s["uses_additional_data"]

                # Key: use _sparse_struct to avoid materialising nulls
                metrics_s = lr_s["metrics"]
                clean_metrics = _sparse_struct(metrics_s)
                best_name, best_val = pick_best_metric(clean_metrics, metrics_order)

                yield ("lb", {
                    "task_id":           tid,
                    "dataset_id":        ds_id,
                    "paper_id":          paper_id_from_url(paper_url),
                    "model_name":        model_name or "",
                    "metrics":           json.dumps(clean_metrics),
                    "best_metric_name":  best_name,
                    "best_metric_value": best_val,
                    "evaluated_on":      pub_date,
                    "uses_extra_data":   bool(extra_s.as_py()) if extra_s.is_valid else False,
                    "uses_ensemble":     False,
                })

    total_tasks = total_ds = total_lb = 0

    for path in paths:
        LOG.info("  [eval] streaming %s …", path.name)
        pf = pq.ParquetFile(path)
        task_buf, ds_buf, dt_buf, lb_buf = [], [], [], []

        for record_batch in pf.iter_batches(batch_size=1):
            # Each batch is one top-level task row
            for row_idx in range(len(record_batch)):
                # Build a StructScalar from the single-row batch columns
                # We need to access the row as a struct scalar — use pyarrow's take
                for col_name in ["task"]:
                    task_name_val = record_batch[col_name][row_idx].as_py()
                if not task_name_val:
                    continue

                # Convert only the lightweight columns to Python; handle metrics specially
                task_name = task_name_val
                tid = slugify(task_name)
                desc_arr = record_batch["description"]
                desc = desc_arr[row_idx].as_py() if desc_arr[row_idx].is_valid else None
                task_buf.append({"id": tid, "name": task_name, "description": desc})

                # Subtasks: convert to Python (no metrics struct here)
                sub_arr = record_batch["subtasks"][row_idx]
                if sub_arr.is_valid:
                    for sub in (sub_arr.as_py() or []):
                        if not isinstance(sub, dict):
                            continue
                        sub_name = sub.get("task", "")
                        if sub_name:
                            task_buf.append({"id": slugify(sub_name), "name": sub_name,
                                             "description": sub.get("description")})

                # Datasets: iterate via pyarrow to avoid expanding metrics
                datasets_arr = record_batch["datasets"][row_idx]
                if not datasets_arr.is_valid:
                    continue

                for ds_entry in datasets_arr:
                    if not ds_entry.is_valid:
                        continue
                    ds_name_s = ds_entry["dataset"]
                    ds_name = ds_name_s.as_py() if ds_name_s.is_valid else None
                    if not ds_name:
                        continue
                    ds_id = slugify(ds_name)
                    ds_buf.append({"id": ds_id, "name": ds_name})
                    dt_buf.append((ds_id, tid))

                    sota_s = ds_entry["sota"]
                    if not sota_s.is_valid:
                        continue
                    metrics_order_s = sota_s["metrics"]
                    metrics_order = metrics_order_s.as_py() if metrics_order_s.is_valid else []

                    rows_s = sota_s["rows"]
                    if not rows_s.is_valid:
                        continue

                    for lr_s in rows_s:
                        if not lr_s.is_valid:
                            continue
                        model_s = lr_s["model_name"]
                        model_name = model_s.as_py() if model_s.is_valid else ""
                        paper_url_s = lr_s["paper_url"]
                        paper_url = paper_url_s.as_py() if paper_url_s.is_valid else None
                        date_s = lr_s["paper_date"]
                        pub_date = date_s.as_py() if date_s.is_valid else None
                        if pub_date and hasattr(pub_date, "date"):
                            pub_date = pub_date.date()

                        metrics_struct_s = lr_s["metrics"]
                        clean_metrics = _sparse_struct(metrics_struct_s)
                        best_name, best_val = pick_best_metric(clean_metrics, metrics_order)

                        extra_s = lr_s["uses_additional_data"]
                        lb_buf.append({
                            "task_id":           tid,
                            "dataset_id":        ds_id,
                            "paper_id":          paper_id_from_url(paper_url),
                            "model_name":        model_name or "",
                            "metrics":           json.dumps(clean_metrics),
                            "best_metric_name":  best_name,
                            "best_metric_value": best_val,
                            "evaluated_on":      pub_date,
                            "uses_extra_data":   bool(extra_s.as_py()) if extra_s.is_valid else False,
                            "uses_ensemble":     False,
                        })

            # Flush after each shard's worth of rows to keep memory low
            if len(lb_buf) >= BATCH_SIZE * 10:
                with conn.cursor() as cur:
                    cur.executemany(task_q, task_buf)
                    cur.executemany(ds_q, ds_buf)
                    cur.executemany(dt_q, dt_buf)
                conn.commit()
                for chunk in batch(lb_buf, BATCH_SIZE):
                    with conn.cursor() as cur:
                        cur.executemany(lb_q, chunk)
                conn.commit()
                total_tasks += len(task_buf)
                total_ds += len(ds_buf)
                total_lb += len(lb_buf)
                LOG.info("    flushed %d lb rows (total %d)", len(lb_buf), total_lb)
                task_buf, ds_buf, dt_buf, lb_buf = [], [], [], []

        # Final flush for this shard
        if task_buf or lb_buf:
            with conn.cursor() as cur:
                cur.executemany(task_q, task_buf)
                cur.executemany(ds_q, ds_buf)
                cur.executemany(dt_q, dt_buf)
            conn.commit()
            for chunk in batch(lb_buf, BATCH_SIZE):
                with conn.cursor() as cur:
                    cur.executemany(lb_q, chunk)
            conn.commit()
            total_tasks += len(task_buf)
            total_ds += len(ds_buf)
            total_lb += len(lb_buf)

    LOG.info("[eval] done: tasks=%d datasets=%d lb_rows=%d", total_tasks, total_ds, total_lb)


# ─── Main ─────────────────────────────────────────────────────────────────────

def main() -> None:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s  %(levelname)-8s  %(message)s",
        stream=sys.stderr,
    )

    parser = argparse.ArgumentParser(description="Ingest Papers with Code data into Postgres")
    parser.add_argument(
        "--dsn",
        default=os.environ.get("DATABASE_URL", "postgresql://david@/pwc"),
        help="Postgres DSN",
    )
    parser.add_argument("--skip-download", action="store_true")
    parser.add_argument("--only", choices=list(DATASETS.keys()), nargs="+")
    args = parser.parse_args()

    targets = set(args.only or DATASETS.keys())

    # Download
    local_files: dict[str, list[Path]] = {}
    LOG.info("=== %s ===", "Downloading" if not args.skip_download else "Locating cached")
    for name, hf_slug in DATASETS.items():
        if name not in targets:
            continue
        local_files[name] = download_parquet(
            name, hf_slug, DATA_DIR, force=False if args.skip_download else False
        )

    # Connect
    LOG.info("=== Connecting to Postgres ===")
    conn = psycopg.connect(args.dsn, autocommit=False)

    order = ["papers", "links", "methods", "datasets", "eval"]
    ingestors = {
        "papers":   lambda rows: ingest_papers(conn, rows),
        "links":    lambda rows: ingest_code_links(conn, rows),
        "methods":  lambda rows: ingest_methods(conn, rows),
        "datasets": lambda rows: ingest_datasets(conn, rows),
    }

    for name in order:
        if name not in targets:
            continue
        LOG.info("=== Ingesting %s ===", name)
        if name == "eval":
            # Streaming path — avoids materialising the huge metrics struct
            ingest_eval_tables_streaming(conn, local_files["eval"])
        else:
            rows = load_parquet(local_files[name])
            ingestors[name](rows)

    conn.close()
    LOG.info("=== Done ===")


if __name__ == "__main__":
    main()
