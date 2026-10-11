-- Recompute tasks.paper_count / result_count from the rows actually present, and
-- set tasks.is_visible = (task has >=1 paper or >=1 result). Listings, area cards,
-- search and the sitemap only show visible tasks; zero-paper task pages redirect
-- to /maintenance. Idempotent; run after any catalog change (trim, restore, Neon load).
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/recompute_task_counts.sql
BEGIN;

UPDATE tasks t SET
  paper_count  = COALESCE((SELECT COUNT(*) FROM paper_tasks pt WHERE pt.task_id = t.id), 0),
  result_count = COALESCE((SELECT COUNT(*) FROM leaderboard_results lr WHERE lr.task_id = t.id), 0);

UPDATE tasks SET is_visible = (paper_count > 0 OR result_count > 0);

COMMIT;

SELECT COUNT(*) FILTER (WHERE is_visible) AS visible_tasks,
       COUNT(*) FILTER (WHERE NOT is_visible) AS hidden_tasks,
       SUM(paper_count) AS paper_task_links
FROM tasks;
