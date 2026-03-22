import sql from "./db";
import type { TaskRow, LeaderboardRow, PaperDetail, CodeLink, AreaSummary } from "./types";

export type TabPaperRow = {
  id: string;
  arxiv_id: string | null;
  title: string;
  published: string | null;
  tasks: string[];
  verification: string;
  upvote_count: number;
};

export async function getTabPapers(
  tab: "recent" | "hyped" | "unverified",
  limit = 10,
  scope?: { taskId?: string; area?: string }
): Promise<TabPaperRow[]> {
  if (scope?.taskId) {
    if (tab === "recent") {
      return sql<TabPaperRow[]>`
        SELECT p.id, p.arxiv_id, p.title, p.published::text, p.tasks, p.verification,
               COUNT(u.paper_id)::int AS upvote_count
        FROM papers p
        JOIN paper_tasks pt ON pt.paper_id = p.id
        LEFT JOIN upvotes u ON u.paper_id = p.id
        WHERE pt.task_id = ${scope.taskId}
        GROUP BY p.id
        ORDER BY p.published DESC NULLS LAST, p.created_at DESC
        LIMIT ${limit}
      `;
    } else if (tab === "hyped") {
      return sql<TabPaperRow[]>`
        SELECT p.id, p.arxiv_id, p.title, p.published::text, p.tasks, p.verification,
               COUNT(u.paper_id)::int AS upvote_count
        FROM papers p
        JOIN paper_tasks pt ON pt.paper_id = p.id
        LEFT JOIN upvotes u ON u.paper_id = p.id
        WHERE pt.task_id = ${scope.taskId}
        GROUP BY p.id
        ORDER BY (COUNT(u.paper_id) + p.hype_score) DESC, p.published DESC NULLS LAST
        LIMIT ${limit}
      `;
    } else {
      return sql<TabPaperRow[]>`
        SELECT p.id, p.arxiv_id, p.title, p.published::text, p.tasks, p.verification,
               COUNT(u.paper_id)::int AS upvote_count
        FROM papers p
        JOIN paper_tasks pt ON pt.paper_id = p.id
        LEFT JOIN upvotes u ON u.paper_id = p.id
        WHERE pt.task_id = ${scope.taskId}
          AND p.verification = 'unverified'
        GROUP BY p.id
        ORDER BY upvote_count DESC, p.published DESC NULLS LAST
        LIMIT ${limit}
      `;
    }
  } else if (scope?.area) {
    if (tab === "recent") {
      return sql<TabPaperRow[]>`
        SELECT p.id, p.arxiv_id, p.title, p.published::text, p.tasks, p.verification,
               COUNT(u.paper_id)::int AS upvote_count
        FROM papers p
        JOIN paper_tasks pt ON pt.paper_id = p.id
        JOIN tasks t ON t.id = pt.task_id
        LEFT JOIN upvotes u ON u.paper_id = p.id
        WHERE t.area = ${scope.area}
        GROUP BY p.id
        ORDER BY p.published DESC NULLS LAST, p.created_at DESC
        LIMIT ${limit}
      `;
    } else if (tab === "hyped") {
      return sql<TabPaperRow[]>`
        SELECT p.id, p.arxiv_id, p.title, p.published::text, p.tasks, p.verification,
               COUNT(u.paper_id)::int AS upvote_count
        FROM papers p
        JOIN paper_tasks pt ON pt.paper_id = p.id
        JOIN tasks t ON t.id = pt.task_id
        LEFT JOIN upvotes u ON u.paper_id = p.id
        WHERE t.area = ${scope.area}
        GROUP BY p.id
        ORDER BY (COUNT(u.paper_id) + p.hype_score) DESC, p.published DESC NULLS LAST
        LIMIT ${limit}
      `;
    } else {
      return sql<TabPaperRow[]>`
        SELECT p.id, p.arxiv_id, p.title, p.published::text, p.tasks, p.verification,
               COUNT(u.paper_id)::int AS upvote_count
        FROM papers p
        JOIN paper_tasks pt ON pt.paper_id = p.id
        JOIN tasks t ON t.id = pt.task_id
        LEFT JOIN upvotes u ON u.paper_id = p.id
        WHERE t.area = ${scope.area}
          AND p.verification = 'unverified'
        GROUP BY p.id
        ORDER BY upvote_count DESC, p.published DESC NULLS LAST
        LIMIT ${limit}
      `;
    }
  } else {
    if (tab === "recent") {
      return sql<TabPaperRow[]>`
        SELECT p.id, p.arxiv_id, p.title, p.published::text, p.tasks, p.verification,
               COUNT(u.paper_id)::int AS upvote_count
        FROM papers p
        LEFT JOIN upvotes u ON u.paper_id = p.id
        GROUP BY p.id
        ORDER BY p.published DESC NULLS LAST, p.created_at DESC
        LIMIT ${limit}
      `;
    } else if (tab === "hyped") {
      return sql<TabPaperRow[]>`
        SELECT p.id, p.arxiv_id, p.title, p.published::text, p.tasks, p.verification,
               COUNT(u.paper_id)::int AS upvote_count
        FROM papers p
        LEFT JOIN upvotes u ON u.paper_id = p.id
        GROUP BY p.id
        ORDER BY (COUNT(u.paper_id) + p.hype_score) DESC, p.published DESC NULLS LAST
        LIMIT ${limit}
      `;
    } else {
      return sql<TabPaperRow[]>`
        SELECT p.id, p.arxiv_id, p.title, p.published::text, p.tasks, p.verification,
               COUNT(u.paper_id)::int AS upvote_count
        FROM papers p
        LEFT JOIN upvotes u ON u.paper_id = p.id
        WHERE p.verification = 'unverified'
        GROUP BY p.id
        ORDER BY upvote_count DESC, p.published DESC NULLS LAST
        LIMIT ${limit}
      `;
    }
  }
}

export async function searchPapers(q: string): Promise<TabPaperRow[]> {
  return sql<TabPaperRow[]>`
    SELECT p.id, p.arxiv_id, p.title, p.published::text, p.tasks, p.verification,
           COUNT(u.paper_id)::int AS upvote_count
    FROM papers p
    LEFT JOIN upvotes u ON u.paper_id = p.id
    WHERE p.title ILIKE ${"%" + q + "%"}
    GROUP BY p.id
    ORDER BY upvote_count DESC, p.published DESC NULLS LAST
    LIMIT 20
  `;
}

export async function getAreaSummaries(): Promise<AreaSummary[]> {
  const rows = await sql<{
    area: string;
    task_count: number;
    paper_count: number;
    result_count: number;
  }[]>`
    SELECT
      area,
      COUNT(*)::int         AS task_count,
      SUM(paper_count)::int AS paper_count,
      SUM(result_count)::int AS result_count
    FROM tasks
    WHERE parent_id IS NULL AND area IS NOT NULL
    GROUP BY area
    ORDER BY paper_count DESC
  `;

  // Fetch top 3 tasks per area in one query
  const topTasks = await sql<{ area: string; name: string }[]>`
    SELECT area, name FROM (
      SELECT area, name,
        ROW_NUMBER() OVER (PARTITION BY area ORDER BY result_count DESC, paper_count DESC) AS rn
      FROM tasks
      WHERE parent_id IS NULL AND area IS NOT NULL
    ) sub
    WHERE rn <= 3
    ORDER BY area, rn
  `;

  const tasksByArea = new Map<string, string[]>();
  for (const t of topTasks) {
    const list = tasksByArea.get(t.area) ?? [];
    list.push(t.name);
    tasksByArea.set(t.area, list);
  }

  return rows.map((r) => ({
    ...r,
    top_tasks: tasksByArea.get(r.area) ?? [],
  }));
}

export async function getTaskList(
  page = 1,
  pageSize = 50,
  area?: string
): Promise<TaskRow[]> {
  const offset = (page - 1) * pageSize;
  const rows = await sql<TaskRow[]>`
    SELECT
      id,
      name,
      description,
      parent_id,
      area,
      paper_count,
      result_count
    FROM tasks
    WHERE parent_id IS NULL
      AND (${area ?? null}::text IS NULL OR area = ${area ?? null})
    ORDER BY result_count DESC, paper_count DESC, name
    LIMIT ${pageSize} OFFSET ${offset}
  `;
  return rows;
}

export async function getTaskCount(area?: string): Promise<number> {
  const [row] = await sql`
    SELECT COUNT(*)::int AS n FROM tasks
    WHERE parent_id IS NULL
      AND (${area ?? null}::text IS NULL OR area = ${area ?? null})
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
      area,
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
  datasetId?: string,
  sort: "metric" | "upvotes" = "metric"
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
      p.url_abs               AS paper_url_abs,
      lr.evaluated_on::text,
      lr.uses_extra_data,
      lr.verification,
      COALESCE(uv.upvote_count, 0) AS paper_upvotes
    FROM leaderboard_results lr
    JOIN datasets d ON d.id = lr.dataset_id
    LEFT JOIN papers p ON p.id = lr.paper_id
    LEFT JOIN (
      SELECT paper_id, COUNT(*)::int AS upvote_count
      FROM upvotes
      GROUP BY paper_id
    ) uv ON uv.paper_id = lr.paper_id
    WHERE lr.task_id = ${taskId}
      AND (${datasetId ?? null}::text IS NULL OR lr.dataset_id = ${datasetId ?? null})
      AND lr.best_metric_value IS NOT NULL
      AND lr.best_metric_value < 1e15
    ORDER BY d.name,
      ${sort === "upvotes" ? sql`uv.upvote_count DESC NULLS LAST, lr.best_metric_value DESC` : sql`lr.best_metric_value DESC`}
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
    SELECT repo_url, framework, is_official, mentioned_in_paper, stars, forks
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

export async function getPaperUpvoteInfo(
  paperId: string,
  userId: string | null
): Promise<{ count: number; upvoted: boolean }> {
  const [{ count }] = await sql<[{ count: number }]>`
    SELECT COUNT(*)::int AS count FROM upvotes WHERE paper_id = ${paperId}
  `;
  let upvoted = false;
  if (userId) {
    const rows = await sql`
      SELECT 1 FROM upvotes WHERE paper_id = ${paperId} AND user_id = ${userId}
    `;
    upvoted = rows.length > 0;
  }
  return { count, upvoted };
}

export async function getSiteStats(): Promise<{
  paper_count: number;
  code_links_count: number;
}> {
  const [{ paper_count, code_links_count }] = await sql<
    [{ paper_count: number; code_links_count: number }]
  >`
    SELECT
      (SELECT COUNT(*)::int FROM papers) AS paper_count,
      (SELECT COUNT(*)::int FROM paper_code_links) AS code_links_count
  `;
  return { paper_count, code_links_count };
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
