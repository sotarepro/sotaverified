-- Stage 2.5: Populate junction tables from denormalised arrays
-- Safe to re-run (ON CONFLICT DO NOTHING throughout).

BEGIN;

-- ─── paper_tasks ─────────────────────────────────────────────────────────────
-- Insert tasks that don't exist yet (task names from papers not in eval tables)
INSERT INTO tasks (id, name)
SELECT DISTINCT
    lower(regexp_replace(regexp_replace(t, '[^\w\s-]', '', 'g'), '[\s_-]+', '-', 'g')) AS id,
    t AS name
FROM papers, unnest(tasks) AS t
WHERE t <> ''
ON CONFLICT (id) DO NOTHING;

-- Populate paper_tasks from the denormalised array
INSERT INTO paper_tasks (paper_id, task_id)
SELECT DISTINCT
    p.id AS paper_id,
    tk.id AS task_id
FROM papers p
JOIN unnest(p.tasks) AS t ON true
JOIN tasks tk ON tk.name = t
WHERE t <> ''
ON CONFLICT DO NOTHING;

-- ─── paper_methods ───────────────────────────────────────────────────────────
-- Insert methods that don't exist yet
INSERT INTO methods (id, name)
SELECT DISTINCT
    lower(regexp_replace(regexp_replace(m, '[^\w\s-]', '', 'g'), '[\s_-]+', '-', 'g')) AS id,
    m AS name
FROM papers, unnest(methods) AS m
WHERE m <> ''
ON CONFLICT (id) DO NOTHING;

-- Populate paper_methods from the denormalised array
INSERT INTO paper_methods (paper_id, method_id)
SELECT DISTINCT
    p.id AS paper_id,
    mt.id AS method_id
FROM papers p
JOIN unnest(p.methods) AS m ON true
JOIN methods mt ON mt.name = m
WHERE m <> ''
ON CONFLICT DO NOTHING;

COMMIT;

-- Report
SELECT
    (SELECT count(*) FROM paper_tasks)   AS paper_tasks,
    (SELECT count(*) FROM paper_methods) AS paper_methods,
    (SELECT count(*) FROM tasks)         AS total_tasks,
    (SELECT count(*) FROM methods)       AS total_methods;
