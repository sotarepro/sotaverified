#!/usr/bin/env python3
"""
Production update pipeline — single command to keep SOTAVerified current.

Runs weekly (or on-demand):
  1. arxiv_delta          — fetch new papers from arXiv
  2. repo_discover_abstracts — regex scan abstracts for GitHub URLs (no API calls)
  3. repo_discover_hf     — find repos via HF API for remaining papers
  4. github_enrich        — get star/fork counts for repos
  5. backup               — backup user-generated data
  6. refresh_sitemap_papers — rebuild the sitemap population table (must run
     last — it reflects the code links / hype / etc. touched by steps 1-4)

Environment variables (required):
  DATABASE_URL   — Railway PostgreSQL connection string
  GITHUB_TOKEN   — GitHub PAT for API enrichment

Usage:
    export DATABASE_URL="postgresql://..."
    export GITHUB_TOKEN="ghp_..."
    python3 scripts/update_pipeline.py
    python3 scripts/update_pipeline.py --days 14 --enrich-limit 5000
    python3 scripts/update_pipeline.py --dry-run
"""

import argparse
import os
import subprocess
import sys
import time
from pathlib import Path

SCRIPT_DIR = Path(__file__).parent


def check_env():
    """Validate required environment variables."""
    errors = []
    if not os.environ.get("DATABASE_URL"):
        errors.append("Error: DATABASE_URL not set. Export it: export DATABASE_URL='postgresql://...'")
    if not os.environ.get("GITHUB_TOKEN"):
        errors.append("Error: GITHUB_TOKEN not set. Export it: export GITHUB_TOKEN='ghp_...'")
    if errors:
        for e in errors:
            print(e, file=sys.stderr)
        sys.exit(1)


def run_step(name: str, cmd: list[str], dry_run: bool = False) -> tuple[bool, float]:
    """Run a pipeline step. Returns (success, elapsed_seconds)."""
    print(f"\n{'='*60}")
    print(f"STEP: {name}")
    print(f"{'='*60}")

    if dry_run:
        print(f"  [DRY RUN] Would run: {' '.join(cmd)}")
        return True, 0.0

    start = time.time()
    try:
        result = subprocess.run(cmd, text=True)
        elapsed = time.time() - start
        if result.returncode != 0:
            print(f"\n  FAILED (exit code {result.returncode}, {elapsed:.0f}s)")
            return False, elapsed
        print(f"\n  OK ({elapsed:.0f}s)")
        return True, elapsed
    except Exception as e:
        elapsed = time.time() - start
        print(f"\n  ERROR: {e} ({elapsed:.0f}s)")
        return False, elapsed


def main():
    parser = argparse.ArgumentParser(
        description="SOTAVerified production update pipeline"
    )
    parser.add_argument("--days", type=int, default=7,
                        help="How far back arxiv_delta looks (default: 7)")
    parser.add_argument("--hf-limit", type=int, default=2000,
                        help="Papers to check on HF for repos (default: 2000)")
    parser.add_argument("--hf-since", default="2025-01-01",
                        help="Only check HF for papers published since (default: 2025-01-01)")
    parser.add_argument("--enrich-limit", type=int, default=2000,
                        help="Repos to enrich with GitHub stars (default: 2000)")
    parser.add_argument("--skip-backup", action="store_true",
                        help="Skip the backup step")
    parser.add_argument("--skip-sitemap-refresh", action="store_true",
                        help="Skip the sitemap_papers refresh step")
    parser.add_argument("--dry-run", action="store_true",
                        help="Print what would run without executing")
    args = parser.parse_args()

    check_env()

    db_url = os.environ["DATABASE_URL"]
    python = sys.executable
    pipeline_start = time.time()

    print("SOTAVerified Update Pipeline")
    print(f"  Database: {db_url[:40]}...")
    print(f"  GitHub token: {os.environ['GITHUB_TOKEN'][:8]}...")
    print(f"  arXiv lookback: {args.days} days")
    print(f"  HF limit: {args.hf_limit} papers (since {args.hf_since})")
    print(f"  Enrich limit: {args.enrich_limit} repos")
    if args.dry_run:
        print("  MODE: DRY RUN")

    steps = [
        (
            "arXiv delta (last {days} days)".format(days=args.days),
            [python, str(SCRIPT_DIR / "arxiv_delta.py"),
             "--days", str(args.days), "--db", db_url],
        ),
        (
            "Abstract repo discovery (pass 1 — papers with no code links)",
            [python, str(SCRIPT_DIR / "repo_discover_abstracts.py"),
             "--pass", "1", "--db", db_url],
        ),
        (
            "HF repo discovery ({limit} papers since {since})".format(
                limit=args.hf_limit, since=args.hf_since),
            [python, str(SCRIPT_DIR / "repo_discover_hf.py"),
             "--limit", str(args.hf_limit), "--since", args.hf_since,
             "--db", db_url],
        ),
        (
            "GitHub enrichment ({limit} repos)".format(limit=args.enrich_limit),
            [python, str(SCRIPT_DIR / "github_enrich.py"),
             "--limit", str(args.enrich_limit), "--db", db_url],
        ),
    ]

    if not args.skip_backup:
        steps.append((
            "Backup user-generated data",
            [str(SCRIPT_DIR / "backup_reproductions.sh"), db_url],
        ))

    if not args.skip_sitemap_refresh:
        steps.append((
            "Refresh sitemap_papers",
            [python, str(SCRIPT_DIR / "refresh_sitemap_papers.py"), "--db", db_url],
        ))

    results = []
    for name, cmd in steps:
        ok, elapsed = run_step(name, cmd, args.dry_run)
        results.append((name, ok, elapsed))

    # Summary
    total_elapsed = time.time() - pipeline_start
    print(f"\n{'='*60}")
    print("PIPELINE COMPLETE")
    print(f"{'='*60}")

    failed = []
    for name, ok, elapsed in results:
        status = "OK" if ok else "FAILED"
        print(f"  [{status:>6}] {name} ({elapsed:.0f}s)")
        if not ok:
            failed.append(name)

    print(f"\n  Total runtime: {total_elapsed:.0f}s ({total_elapsed/60:.1f}m)")

    if failed:
        print(f"\n  {len(failed)} step(s) failed: {', '.join(failed)}")
        sys.exit(1)
    else:
        print("\n  All steps succeeded.")


if __name__ == "__main__":
    main()
