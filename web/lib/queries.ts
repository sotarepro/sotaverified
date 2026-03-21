import sql from "./db";
import type { TaskRow, LeaderboardRow, PaperDetail, CodeLink } from "./types";

export async function getTaskList(page = 1, pageSize = 50): Promise<TaskRow[]> {
  const offset = (page - 1) * pageSize;
  const rows = await sql<TaskRow[]>`
    SELECT
      id,
      name,
      description,
      parent_id,
      paper_count,
      result_count
    FROM tasks
    WHERE parent_id IS NULL
    ORDER BY result_count DESC, paper_count DESC, name
    LIMIT ${pageSize} OFFSET ${offset}
  `;
  return rows;
}

export async function getTaskCount(): Promise<number> {
  const [row] = await sql`
    SELECT COUNT(*)::int AS n FROM tasks WHERE parent_id IS NULL
  `;
  return row.n;
}

export async function searchTasks(q: string): Promise<TaskRow[]> {
  const rows = await sql<TaskRow[]>`
    SELECT
      id,
      name,
      description,
      parent_id,
      paper_count,
      result_count
    FROM tasks
    WHERE name ILIKE ${"%" + q + "%"}
    ORDER BY result_count DESC, paper_count DESC
    LIMIT 30
  `;
  return rows;
}

export async function getTask(
  id: string
): Promise<{ id: string; name: string; description: string | null } | null> {
  const rows = await sql<{ id: string; name: string; description: string | null }[]>`
    SELECT id, name, description FROM tasks WHERE id = ${id}
  `;
  return rows[0] ?? null;
}

export async function getLeaderboard(
  taskId: string,
  datasetId?: string
): Promise<LeaderboardRow[]> {
  const rows = await sql<LeaderboardRow[]>`
    SELECT
      lr.id,
      lr.model_name,
      d.name                  AS dataset_name,
      lr.best_metric_name,
      lr.best_metric_value,
      lr.paper_id,
      p.title                 AS paper_title,
      lr.evaluated_on::text,
      lr.uses_extra_data,
      lr.verification
    FROM leaderboard_results lr
    JOIN datasets d ON d.id = lr.dataset_id
    LEFT JOIN papers p ON p.id = lr.paper_id
    WHERE lr.task_id = ${taskId}
      AND (${datasetId ?? null}::text IS NULL OR lr.dataset_id = ${datasetId ?? null})
      AND lr.best_metric_value IS NOT NULL
      AND lr.best_metric_value < 1e15
    ORDER BY d.name, lr.best_metric_value DESC
    LIMIT 200
  `;
  return rows;
}

export async function getTaskDatasets(
  taskId: string
): Promise<{ id: string; name: string }[]> {
  return sql`
    SELECT DISTINCT d.id, d.name
    FROM leaderboard_results lr
    JOIN datasets d ON d.id = lr.dataset_id
    WHERE lr.task_id = ${taskId}
      AND lr.best_metric_value IS NOT NULL
    ORDER BY d.name
  `;
}

export async function getPaper(id: string): Promise<PaperDetail | null> {
  const [row] = await sql<PaperDetail[]>`
    SELECT
      id, arxiv_id, title, abstract,
      url_abs, url_pdf,
      published::text,
      authors, proceeding, tasks, methods,
      verification
    FROM papers
    WHERE id = ${id}
  `;
  return row ?? null;
}

export async function getPaperCodeLinks(paperId: string): Promise<CodeLink[]> {
  return sql<CodeLink[]>`
    SELECT repo_url, framework, is_official, mentioned_in_paper
    FROM paper_code_links
    WHERE paper_id = ${paperId}
    ORDER BY is_official DESC, mentioned_in_paper DESC
  `;
}

export interface PaperLbEntry {
  task_name: string;
  task_id: string;
  dataset_name: string;
  model_name: string;
  best_metric_name: string | null;
  best_metric_value: number | null;
  verification: string;
}

export async function getPaperLeaderboardEntries(
  paperId: string
): Promise<PaperLbEntry[]> {
  return sql<PaperLbEntry[]>`
    SELECT
      t.name  AS task_name,
      t.id    AS task_id,
      d.name  AS dataset_name,
      lr.model_name,
      lr.best_metric_name,
      lr.best_metric_value,
      lr.verification
    FROM leaderboard_results lr
    JOIN tasks t ON t.id = lr.task_id
    JOIN datasets d ON d.id = lr.dataset_id
    WHERE lr.paper_id = ${paperId}
      AND lr.best_metric_value IS NOT NULL
    ORDER BY t.name, d.name
    LIMIT 50
  `;
}
