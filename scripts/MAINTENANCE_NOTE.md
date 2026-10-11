# Ingestion is OFF (maintenance mode, 2026-10-10)

The scripts in this directory — `update_pipeline.py`, `arxiv_delta.py`, `arxiv_backfill.py`,
`repo_discover_*.py`, `github_enrich.py`, `refresh_sitemap_papers.py`, `backup_reproductions.sh`,
etc. — are kept for revival but are **not scheduled anywhere**. There was never a `vercel.json`
cron or a `.github/workflows` job for them (the pipeline was run by hand), and none must be added
while the site runs on Neon Free: ingestion against the trimmed 2k-paper catalog would re-grow the
database past the 0.5 GB limit and keep the compute awake.

Catalog-shaping scripts for this mode:
- `maintenance_trim.sql` — trim a scratch restore of the prod dump to the kept papers.
- `recompute_task_counts.sql` — recompute `tasks.paper_count/result_count/is_visible`
  (rerun after any catalog change, including the Neon load).

To restore ingestion see `REVIVAL.md` (written in Phase 4).
