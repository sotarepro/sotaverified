#!/usr/bin/env python3
# DEPRECATED: Use update_pipeline.py instead
"""
Master daily update script — runs enrichment pipeline in sequence.

DEPRECATED: Use update_pipeline.py instead. This script is kept for
reference but should not be used in production.

Usage:
    python scripts/daily_update.py
    python scripts/daily_update.py --db "dbname=pwc"
"""

import argparse
import os
import subprocess
import sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).parent


def run_step(name: str, cmd: list[str]) -> bool:
    print(f"\n{'='*60}")
    print(f"STEP: {name}")
    print(f"{'='*60}")
    result = subprocess.run(cmd, text=True)
    if result.returncode != 0:
        print(f"\nERROR: {name} failed with exit code {result.returncode}", file=sys.stderr)
        return False
    return True


def main():
    parser = argparse.ArgumentParser(description="Run daily enrichment pipeline")
    parser.add_argument("--db", default=os.environ.get("DATABASE_PUBLIC_URL", os.environ.get("DATABASE_URL", "dbname=pwc")),
                        help="PostgreSQL connection string (default: dbname=pwc)")
    args = parser.parse_args()

    python = sys.executable

    steps = [
        (
            "arXiv delta (last 1 day)",
            [python, str(SCRIPT_DIR / "arxiv_delta.py"), "--days", "1", "--db", args.db],
        ),
        (
            "Semantic Scholar enrichment (500 papers)",
            [python, str(SCRIPT_DIR / "semantic_scholar_enrich.py"), "--limit", "500", "--db", args.db],
        ),
        (
            "GitHub enrichment (200 repos)",
            [python, str(SCRIPT_DIR / "github_enrich.py"), "--limit", "200", "--db", args.db],
        ),
    ]

    print("Starting daily update pipeline...")
    failed = []

    for name, cmd in steps:
        ok = run_step(name, cmd)
        if not ok:
            failed.append(name)

    print(f"\n{'='*60}")
    print("DAILY UPDATE COMPLETE")
    if failed:
        print(f"Failed steps: {', '.join(failed)}")
        sys.exit(1)
    else:
        print("All steps succeeded.")


if __name__ == "__main__":
    main()
