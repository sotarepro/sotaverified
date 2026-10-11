-- Maintenance-mode catalog trim. Run ONLY against a scratch copy of the prod dump
-- (never prod). Keeps: papers with user-generated data + top 2,000 by hype_score
-- (ties broken by max code-link stars, then id). See REVIVAL.md to undo.
-- Usage: psql -d sotaverified_trimmed -v ON_ERROR_STOP=1 -f scripts/maintenance_trim.sql
BEGIN;

CREATE TEMP TABLE keep_papers ON COMMIT DROP AS
WITH user_touched AS (
  SELECT paper_id FROM reproductions
  UNION SELECT paper_id FROM paper_authors
  UNION SELECT paper_id FROM upvotes
  UNION SELECT paper_id FROM leaderboard_results WHERE source <> 'pwc_import'
  UNION SELECT paper_id FROM activity_log WHERE paper_id IS NOT NULL
),
top_hype AS (
  SELECT p.id
  FROM papers p
  LEFT JOIN (SELECT paper_id, max(stars) AS stars FROM paper_code_links GROUP BY 1) s
    ON s.paper_id = p.id
  WHERE NOT p.is_test
  ORDER BY p.hype_score DESC, s.stars DESC NULLS LAST, p.id
  LIMIT 2000
)
SELECT paper_id AS id FROM user_touched
UNION
SELECT id FROM top_hype;

-- sitemap_papers.paper_id has an ON DELETE CASCADE FK but no index, so cascading
-- 500k deletes would seq-scan it per row (took >11 min). It is rebuilt below.
TRUNCATE sitemap_papers;

-- leaderboard_results.paper_id FK is NO ACTION, so clear it first; every other
-- dependent (code links, methods, tasks, authors, reproductions, sitemap_papers)
-- cascades from papers.
DELETE FROM leaderboard_results WHERE paper_id NOT IN (SELECT id FROM keep_papers);
DELETE FROM papers WHERE id NOT IN (SELECT id FROM keep_papers);

-- Rebuild sitemap_papers with contiguous positions (chunking is keyset on position).
INSERT INTO sitemap_papers (position, paper_id, updated_at)
SELECT row_number() OVER (ORDER BY id), id, updated_at FROM papers;

COMMIT;
