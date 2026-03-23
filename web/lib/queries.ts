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
  verification_score: number;
  user_hyped: boolean; // set by server pages after getUserHypedSet(); defaults to false
};

/** Returns the set of paper IDs the user has hyped, from the given list. */
export async function getUserHypedSet(userId: string, paperIds: string[]): Promise<Set<string>> {
  if (!userId || paperIds.length === 0) return new Set();
  const rows = await sql<{ paper_id: string }[]>`
    SELECT paper_id FROM upvotes
    WHERE user_id = ${userId} AND paper_id = ANY(${paperIds})
  `;
  return new Set(rows.map((r) => r.paper_id));
}

// Shared LATERAL snippet: count organic upvotes for a paper already in scope.
// Used in all getTabPapers queries after the CTE selects the page of results.
// This avoids GROUP BY over all papers — we only count upvotes for the N rows
// that survived the sort+limit in the CTE (N = page size, typically 10–50).
export async function getTabPapers(
  tab: "recent" | "hyped" | "unverified" | "verified",
  limit = 10,
  scope?: { taskId?: string; area?: string },
  offset = 0
): Promise<TabPaperRow[]> {
  if (scope?.taskId) {
    // Scoped by task — paper_tasks_task_idx limits the scan to papers for this task
    if (tab === "recent") {
      return sql<TabPaperRow[]>`
        WITH base AS (
          SELECT DISTINCT ON (p.id) p.id, p.arxiv_id, p.title, p.published::text AS published,
                 p.tasks, p.verification, p.verification_score, p.hype_score, p.created_at
          FROM papers p
          JOIN paper_tasks pt ON pt.paper_id = p.id
          WHERE pt.task_id = ${scope.taskId}
          ORDER BY p.id, p.published DESC NULLS LAST, p.created_at DESC
        )
        SELECT b.id, b.arxiv_id, b.title, b.published, b.tasks, b.verification,
               b.verification_score,
               (COALESCE(u.cnt, 0) + b.hype_score) AS upvote_count
        FROM (SELECT * FROM base ORDER BY published DESC NULLS LAST, created_at DESC LIMIT ${limit} OFFSET ${offset}) b
        LEFT JOIN LATERAL (SELECT COUNT(*)::int AS cnt FROM upvotes WHERE paper_id = b.id) u ON true
      `;
    } else if (tab === "hyped") {
      return sql<TabPaperRow[]>`
        WITH base AS (
          SELECT DISTINCT ON (p.id) p.id, p.arxiv_id, p.title, p.published::text AS published,
                 p.tasks, p.verification, p.verification_score, p.hype_score
          FROM papers p
          JOIN paper_tasks pt ON pt.paper_id = p.id
          WHERE pt.task_id = ${scope.taskId}
          ORDER BY p.id
        )
        SELECT b.id, b.arxiv_id, b.title, b.published, b.tasks, b.verification,
               b.verification_score,
               (COALESCE(u.cnt, 0) + b.hype_score) AS upvote_count
        FROM (SELECT * FROM base ORDER BY hype_score DESC, published DESC NULLS LAST LIMIT ${limit} OFFSET ${offset}) b
        LEFT JOIN LATERAL (SELECT COUNT(*)::int AS cnt FROM upvotes WHERE paper_id = b.id) u ON true
        ORDER BY (COALESCE(u.cnt, 0) + b.hype_score) DESC, b.published DESC NULLS LAST
      `;
    } else if (tab === "unverified") {
      return sql<TabPaperRow[]>`
        WITH base AS (
          SELECT DISTINCT ON (p.id) p.id, p.arxiv_id, p.title, p.published::text AS published,
                 p.tasks, p.verification, p.verification_score, p.hype_score
          FROM papers p
          JOIN paper_tasks pt ON pt.paper_id = p.id
          WHERE pt.task_id = ${scope.taskId}
            AND p.verification_score = 0 AND p.hype_score > 0
          ORDER BY p.id
        )
        SELECT b.id, b.arxiv_id, b.title, b.published, b.tasks, b.verification,
               b.verification_score,
               (COALESCE(u.cnt, 0) + b.hype_score) AS upvote_count
        FROM (SELECT * FROM base ORDER BY hype_score DESC, published DESC NULLS LAST LIMIT ${limit} OFFSET ${offset}) b
        LEFT JOIN LATERAL (SELECT COUNT(*)::int AS cnt FROM upvotes WHERE paper_id = b.id) u ON true
        ORDER BY (COALESCE(u.cnt, 0) + b.hype_score) DESC, b.published DESC NULLS LAST
      `;
    } else {
      return sql<TabPaperRow[]>`
        WITH base AS (
          SELECT DISTINCT ON (p.id) p.id, p.arxiv_id, p.title, p.published::text AS published,
                 p.tasks, p.verification, p.verification_score, p.hype_score
          FROM papers p
          JOIN paper_tasks pt ON pt.paper_id = p.id
          WHERE pt.task_id = ${scope.taskId}
          ORDER BY p.id
        )
        SELECT b.id, b.arxiv_id, b.title, b.published, b.tasks, b.verification,
               b.verification_score,
               (COALESCE(u.cnt, 0) + b.hype_score) AS upvote_count
        FROM (SELECT * FROM base ORDER BY verification_score DESC, hype_score DESC LIMIT ${limit} OFFSET ${offset}) b
        LEFT JOIN LATERAL (SELECT COUNT(*)::int AS cnt FROM upvotes WHERE paper_id = b.id) u ON true
        ORDER BY b.verification_score DESC, (COALESCE(u.cnt, 0) + b.hype_score) DESC
      `;
    }
  } else if (scope?.area) {
    // Scoped by area — idx_tasks_area + paper_tasks_task_idx limit the scan
    if (tab === "recent") {
      return sql<TabPaperRow[]>`
        WITH base AS (
          SELECT DISTINCT ON (p.id) p.id, p.arxiv_id, p.title, p.published::text AS published,
                 p.tasks, p.verification, p.verification_score, p.hype_score, p.created_at
          FROM papers p
          JOIN paper_tasks pt ON pt.paper_id = p.id
          JOIN tasks t ON t.id = pt.task_id
          WHERE t.area = ${scope.area}
          ORDER BY p.id
        )
        SELECT b.id, b.arxiv_id, b.title, b.published, b.tasks, b.verification,
               b.verification_score,
               (COALESCE(u.cnt, 0) + b.hype_score) AS upvote_count
        FROM (SELECT * FROM base ORDER BY published DESC NULLS LAST, created_at DESC LIMIT ${limit} OFFSET ${offset}) b
        LEFT JOIN LATERAL (SELECT COUNT(*)::int AS cnt FROM upvotes WHERE paper_id = b.id) u ON true
      `;
    } else if (tab === "hyped") {
      return sql<TabPaperRow[]>`
        WITH base AS (
          SELECT DISTINCT ON (p.id) p.id, p.arxiv_id, p.title, p.published::text AS published,
                 p.tasks, p.verification, p.verification_score, p.hype_score
          FROM papers p
          JOIN paper_tasks pt ON pt.paper_id = p.id
          JOIN tasks t ON t.id = pt.task_id
          WHERE t.area = ${scope.area}
          ORDER BY p.id
        )
        SELECT b.id, b.arxiv_id, b.title, b.published, b.tasks, b.verification,
               b.verification_score,
               (COALESCE(u.cnt, 0) + b.hype_score) AS upvote_count
        FROM (SELECT * FROM base ORDER BY hype_score DESC, published DESC NULLS LAST LIMIT ${limit} OFFSET ${offset}) b
        LEFT JOIN LATERAL (SELECT COUNT(*)::int AS cnt FROM upvotes WHERE paper_id = b.id) u ON true
        ORDER BY (COALESCE(u.cnt, 0) + b.hype_score) DESC, b.published DESC NULLS LAST
      `;
    } else if (tab === "unverified") {
      return sql<TabPaperRow[]>`
        WITH base AS (
          SELECT DISTINCT ON (p.id) p.id, p.arxiv_id, p.title, p.published::text AS published,
                 p.tasks, p.verification, p.verification_score, p.hype_score
          FROM papers p
          JOIN paper_tasks pt ON pt.paper_id = p.id
          JOIN tasks t ON t.id = pt.task_id
          WHERE t.area = ${scope.area}
            AND p.verification_score = 0 AND p.hype_score > 0
          ORDER BY p.id
        )
        SELECT b.id, b.arxiv_id, b.title, b.published, b.tasks, b.verification,
               b.verification_score,
               (COALESCE(u.cnt, 0) + b.hype_score) AS upvote_count
        FROM (SELECT * FROM base ORDER BY hype_score DESC, published DESC NULLS LAST LIMIT ${limit} OFFSET ${offset}) b
        LEFT JOIN LATERAL (SELECT COUNT(*)::int AS cnt FROM upvotes WHERE paper_id = b.id) u ON true
        ORDER BY (COALESCE(u.cnt, 0) + b.hype_score) DESC, b.published DESC NULLS LAST
      `;
    } else {
      return sql<TabPaperRow[]>`
        WITH base AS (
          SELECT DISTINCT ON (p.id) p.id, p.arxiv_id, p.title, p.published::text AS published,
                 p.tasks, p.verification, p.verification_score, p.hype_score
          FROM papers p
          JOIN paper_tasks pt ON pt.paper_id = p.id
          JOIN tasks t ON t.id = pt.task_id
          WHERE t.area = ${scope.area}
          ORDER BY p.id
        )
        SELECT b.id, b.arxiv_id, b.title, b.published, b.tasks, b.verification,
               b.verification_score,
               (COALESCE(u.cnt, 0) + b.hype_score) AS upvote_count
        FROM (SELECT * FROM base ORDER BY verification_score DESC, hype_score DESC LIMIT ${limit} OFFSET ${offset}) b
        LEFT JOIN LATERAL (SELECT COUNT(*)::int AS cnt FROM upvotes WHERE paper_id = b.id) u ON true
        ORDER BY b.verification_score DESC, (COALESCE(u.cnt, 0) + b.hype_score) DESC
      `;
    }
  } else {
    // Unscoped — uses indexes on published, hype_score, verification_score
    if (tab === "recent") {
      return sql<TabPaperRow[]>`
        WITH base AS (
          SELECT p.id, p.arxiv_id, p.title, p.published::text AS published,
                 p.tasks, p.verification, p.verification_score, p.hype_score
          FROM papers p
          ORDER BY p.published DESC NULLS LAST, p.created_at DESC
          LIMIT ${limit} OFFSET ${offset}
        )
        SELECT b.id, b.arxiv_id, b.title, b.published, b.tasks, b.verification,
               b.verification_score,
               (COALESCE(u.cnt, 0) + b.hype_score) AS upvote_count
        FROM base b
        LEFT JOIN LATERAL (SELECT COUNT(*)::int AS cnt FROM upvotes WHERE paper_id = b.id) u ON true
      `;
    } else if (tab === "hyped") {
      return sql<TabPaperRow[]>`
        WITH base AS (
          SELECT p.id, p.arxiv_id, p.title, p.published::text AS published,
                 p.tasks, p.verification, p.verification_score, p.hype_score
          FROM papers p
          ORDER BY p.hype_score DESC, p.published DESC NULLS LAST
          LIMIT ${limit} OFFSET ${offset}
        )
        SELECT b.id, b.arxiv_id, b.title, b.published, b.tasks, b.verification,
               b.verification_score,
               (COALESCE(u.cnt, 0) + b.hype_score) AS upvote_count
        FROM base b
        LEFT JOIN LATERAL (SELECT COUNT(*)::int AS cnt FROM upvotes WHERE paper_id = b.id) u ON true
        ORDER BY (COALESCE(u.cnt, 0) + b.hype_score) DESC, b.published DESC NULLS LAST
      `;
    } else if (tab === "unverified") {
      return sql<TabPaperRow[]>`
        WITH base AS (
          SELECT p.id, p.arxiv_id, p.title, p.published::text AS published,
                 p.tasks, p.verification, p.verification_score, p.hype_score
          FROM papers p
          WHERE p.verification_score = 0 AND p.hype_score > 0
          ORDER BY p.hype_score DESC, p.published DESC NULLS LAST
          LIMIT ${limit} OFFSET ${offset}
        )
        SELECT b.id, b.arxiv_id, b.title, b.published, b.tasks, b.verification,
               b.verification_score,
               (COALESCE(u.cnt, 0) + b.hype_score) AS upvote_count
        FROM base b
        LEFT JOIN LATERAL (SELECT COUNT(*)::int AS cnt FROM upvotes WHERE paper_id = b.id) u ON true
        ORDER BY (COALESCE(u.cnt, 0) + b.hype_score) DESC, b.published DESC NULLS LAST
      `;
    } else {
      return sql<TabPaperRow[]>`
        WITH base AS (
          SELECT p.id, p.arxiv_id, p.title, p.published::text AS published,
                 p.tasks, p.verification, p.verification_score, p.hype_score
          FROM papers p
          WHERE p.verification_score > 0
          ORDER BY p.verification_score DESC, p.hype_score DESC
          LIMIT ${limit} OFFSET ${offset}
        )
        SELECT b.id, b.arxiv_id, b.title, b.published, b.tasks, b.verification,
               b.verification_score,
               (COALESCE(u.cnt, 0) + b.hype_score) AS upvote_count
        FROM base b
        LEFT JOIN LATERAL (SELECT COUNT(*)::int AS cnt FROM upvotes WHERE paper_id = b.id) u ON true
        ORDER BY b.verification_score DESC, (COALESCE(u.cnt, 0) + b.hype_score) DESC
      `;
    }
  }
}

export async function getTabPapersCount(
  tab: "recent" | "hyped" | "unverified" | "verified",
  scope?: { taskId?: string; area?: string }
): Promise<number> {
  if (scope?.taskId) {
    if (tab === "unverified") {
      const rows = await sql<{ n: number }[]>`
        SELECT COUNT(DISTINCT p.id)::int AS n
        FROM papers p
        JOIN paper_tasks pt ON pt.paper_id = p.id
        WHERE pt.task_id = ${scope.taskId}
          AND p.verification_score = 0 AND p.hype_score > 0
      `;
      return rows[0]?.n ?? 0;
    } else {
      const rows = await sql<{ n: number }[]>`
        SELECT COUNT(DISTINCT p.id)::int AS n
        FROM papers p
        JOIN paper_tasks pt ON pt.paper_id = p.id
        WHERE pt.task_id = ${scope.taskId}
      `;
      return rows[0]?.n ?? 0;
    }
  } else if (scope?.area) {
    if (tab === "unverified") {
      const rows = await sql<{ n: number }[]>`
        SELECT COUNT(DISTINCT p.id)::int AS n
        FROM papers p
        JOIN paper_tasks pt ON pt.paper_id = p.id
        JOIN tasks t ON t.id = pt.task_id
        WHERE t.area = ${scope.area}
          AND p.verification_score = 0 AND p.hype_score > 0
      `;
      return rows[0]?.n ?? 0;
    } else {
      const rows = await sql<{ n: number }[]>`
        SELECT COUNT(DISTINCT p.id)::int AS n
        FROM papers p
        JOIN paper_tasks pt ON pt.paper_id = p.id
        JOIN tasks t ON t.id = pt.task_id
        WHERE t.area = ${scope.area}
      `;
      return rows[0]?.n ?? 0;
    }
  } else {
    if (tab === "unverified") {
      const rows = await sql<{ n: number }[]>`
        SELECT COUNT(*)::int AS n FROM papers
        WHERE verification_score = 0 AND hype_score > 0
      `;
      return rows[0]?.n ?? 0;
    } else if (tab === "verified") {
      const rows = await sql<{ n: number }[]>`
        SELECT COUNT(*)::int AS n FROM papers
        WHERE verification_score > 0
      `;
      return rows[0]?.n ?? 0;
    } else {
      const rows = await sql<{ n: number }[]>`
        SELECT COUNT(*)::int AS n FROM papers
      `;
      return rows[0]?.n ?? 0;
    }
  }
}

export async function searchPapers(q: string, limit = 20, offset = 0): Promise<TabPaperRow[]> {
  return sql<TabPaperRow[]>`
    SELECT p.id, p.arxiv_id, p.title, p.published::text, p.tasks, p.verification,
           p.verification_score,
           (COALESCE((SELECT COUNT(*)::int FROM upvotes WHERE paper_id = p.id), 0) + p.hype_score) AS upvote_count
    FROM papers p
    WHERE p.title ILIKE ${"%" + q + "%"}
    ORDER BY upvote_count DESC, p.published DESC NULLS LAST
    LIMIT ${limit} OFFSET ${offset}
  `;
}

export async function searchPapersCount(q: string): Promise<number> {
  const [{ n }] = await sql<[{ n: number }]>`
    SELECT COUNT(*)::int AS n FROM papers WHERE title ILIKE ${"%" + q + "%"}
  `;
  return n;
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
  sort: "metric" | "verification" | "date" = "metric"
): Promise<LeaderboardRow[]> {
  const orderBy =
    sort === "verification"
      ? sql`
          CASE lr.verification
            WHEN 'official'       THEN 1
            WHEN 'community'      THEN 2
            WHEN 'auto_verified'  THEN 3
            ELSE                       4
          END ASC, lr.best_metric_value DESC`
      : sort === "date"
      ? sql`lr.evaluated_on DESC NULLS LAST, lr.best_metric_value DESC`
      : sql`lr.best_metric_value DESC`;

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
      ds_counts.submission_count
    FROM leaderboard_results lr
    JOIN datasets d ON d.id = lr.dataset_id
    LEFT JOIN papers p ON p.id = lr.paper_id
    JOIN (
      SELECT dataset_id, COUNT(*)::int AS submission_count
      FROM leaderboard_results
      WHERE task_id = ${taskId}
        AND best_metric_value IS NOT NULL
      GROUP BY dataset_id
    ) ds_counts ON ds_counts.dataset_id = lr.dataset_id
    WHERE lr.task_id = ${taskId}
      AND (${datasetId ?? null}::text IS NULL OR lr.dataset_id = ${datasetId ?? null})
      AND lr.best_metric_value IS NOT NULL
      AND lr.best_metric_value < 1e15
    ORDER BY ds_counts.submission_count DESC, d.name, ${orderBy}
    LIMIT 200
  `;
  return rows;
}

export async function getTaskDatasets(
  taskId: string
): Promise<{ id: string; name: string; submission_count: number }[]> {
  return sql`
    SELECT d.id, d.name, COUNT(*)::int AS submission_count
    FROM leaderboard_results lr
    JOIN datasets d ON d.id = lr.dataset_id
    WHERE lr.task_id = ${taskId}
      AND lr.best_metric_value IS NOT NULL
    GROUP BY d.id, d.name
    ORDER BY submission_count DESC, d.name
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
  const [row] = await sql<[{ count: number; upvoted: boolean }]>`
    SELECT
      (SELECT COUNT(*)::int FROM upvotes WHERE paper_id = ${paperId}) AS count,
      ${userId ? sql`EXISTS(SELECT 1 FROM upvotes WHERE paper_id = ${paperId} AND user_id = ${userId})` : sql`false`} AS upvoted
  `;
  return { count: row.count, upvoted: row.upvoted };
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
