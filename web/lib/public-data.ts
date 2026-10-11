import sql from "./db";
import { cached, TAG_CATALOG, TAG_USERS } from "./cache";

// Public user-facing reads, served from the persistent data cache (expired by
// revalidateAfterWrite()). The session is read in the pages (JWT, no DB), never here.

async function leaderboardDataUncached() {
  // Top 50 users by reputation
  const users = await sql<{
    github_id: string;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
    reputation_score: number;
    repro_count: number;
    authored_count: number;
  }[]>`
    SELECT
      u.github_id,
      u.username,
      u.display_name,
      u.avatar_url,
      u.reputation_score,
      (SELECT COUNT(*)::int FROM reproductions r
       WHERE r.user_id = u.github_id AND r.status NOT IN ('hidden', 'removed')) AS repro_count,
      (SELECT COUNT(*)::int FROM paper_authors pa
       WHERE pa.user_id = u.github_id AND pa.status = 'verified') AS authored_count
    FROM users u
    WHERE COALESCE(u.is_system, false) = false AND u.reputation_score > 0
    ORDER BY u.reputation_score DESC
    LIMIT 50
  `;

  // Papers needing verification (same as "Needs Verification" tab)
  const needsVerification = await sql<{
    id: string;
    title: string;
    hype_score: number;
    published: string | null;
  }[]>`
    SELECT p.id, p.title,
      p.hype_score,
      p.published::text
    FROM papers p
    ORDER BY p.hype_score DESC, p.verification_score ASC
    LIMIT 10
  `;

  return { users, needsVerification };
}
export const getLeaderboardData = cached("getLeaderboardData", leaderboardDataUncached, [TAG_USERS, TAG_CATALOG]);

async function usernameIndexUncached(): Promise<string[]> {
  const rows = await sql<{ username: string }[]>`
    SELECT username FROM users WHERE COALESCE(is_system, false) = false
  `;
  return rows.map((r) => r.username);
}
export const getUsernameIndex = cached("getUsernameIndex", usernameIndexUncached, [TAG_USERS]);

async function profileDataUncached(username: string) {
  const [user] = await sql<{
    github_id: string;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
    bio: string | null;
    company: string | null;
    location: string | null;
    reputation_score: number;
    created_at: string;
  }[]>`
    SELECT github_id, username, display_name, avatar_url, bio, company, location,
           reputation_score, created_at::text
    FROM users WHERE username = ${username} AND COALESCE(is_system, false) = false
  `;

  if (!user) return null;

  const reproductions = await sql<{
    id: number;
    paper_id: string;
    paper_title: string | null;
    tier_claimed: number;
    status: string;
    created_at: string;
  }[]>`
    SELECT r.id, r.paper_id, p.title AS paper_title,
           r.tier_claimed, r.status, r.created_at::text
    FROM reproductions r
    LEFT JOIN papers p ON p.id = r.paper_id
    WHERE r.user_id = ${user.github_id}
      AND r.status NOT IN ('hidden', 'removed')
    ORDER BY r.created_at DESC
    LIMIT 50
  `;

  const authoredPapers = await sql<{
    paper_id: string;
    paper_title: string | null;
  }[]>`
    SELECT pa.paper_id, p.title AS paper_title
    FROM paper_authors pa
    LEFT JOIN papers p ON p.id = pa.paper_id
    WHERE pa.user_id = ${user.github_id} AND pa.status = 'verified'
    ORDER BY p.published DESC NULLS LAST
    LIMIT 50
  `;

  const [rankRow] = await sql<[{ rank: number }]>`
    SELECT COUNT(*)::int + 1 AS rank FROM users
    WHERE reputation_score > ${user.reputation_score} AND COALESCE(is_system, false) = false
  `;

  return { user, reproductions, authoredPapers, rank: rankRow.rank };
}
export const getProfileData = cached("getProfileData", profileDataUncached, [TAG_USERS, TAG_CATALOG]);

export type SotaPaper = {
  id: string;
  arxiv_id: string | null;
  title: string;
  verification_score: number;
  repro_count: number;
  tasks: string[];
  published: string | null;
  has_repo: boolean;
  has_author: boolean;
};

/** One cached read of the whole (small) catalog; /api/v1/sota filters and sorts it in memory. */
async function sotaCorpusUncached(): Promise<SotaPaper[]> {
  return sql<SotaPaper[]>`
    SELECT p.id, p.arxiv_id, p.title, p.verification_score,
           (SELECT COUNT(*)::int FROM reproductions r
            WHERE r.paper_id = p.id AND r.status NOT IN ('hidden','removed')) AS repro_count,
           p.tasks, p.published::text AS published,
           EXISTS(SELECT 1 FROM paper_code_links cl WHERE cl.paper_id = p.id) AS has_repo,
           EXISTS(SELECT 1 FROM paper_authors pa WHERE pa.paper_id = p.id AND pa.status = 'verified') AS has_author
    FROM papers p
  `;
}
export const getSotaCorpus = cached("getSotaCorpus", sotaCorpusUncached, [TAG_CATALOG]);

async function apiPaperUncached(arxivId: string) {
  const papers = await sql<{
    id: string; arxiv_id: string; title: string; abstract: string | null; authors: string[];
    tasks: string[]; published: string | null; verification_score: number;
    has_repo: boolean; has_author: boolean; repro_count: number;
  }[]>`
    SELECT p.id, p.arxiv_id, p.title, p.abstract, p.authors, p.tasks, p.published::text,
      p.verification_score,
      EXISTS(SELECT 1 FROM paper_code_links WHERE paper_id = p.id) AS has_repo,
      EXISTS(SELECT 1 FROM paper_authors WHERE paper_id = p.id AND status = 'verified') AS has_author,
      (SELECT COUNT(*)::int FROM reproductions WHERE paper_id = p.id AND status NOT IN ('hidden','removed')) AS repro_count
    FROM papers p
    WHERE p.arxiv_id = ${arxivId}
    LIMIT 1
  `;
  if (papers.length === 0) return null;
  const paper = papers[0];
  const [lbResults, codeLinks] = await Promise.all([
    sql<{
      task_name: string; dataset_name: string; model_name: string;
      metric_name: string | null; metric_value: number | null; verification: string;
    }[]>`
      SELECT t.name AS task_name, d.name AS dataset_name, lr.model_name,
             lr.best_metric_name AS metric_name, lr.best_metric_value AS metric_value, lr.verification
      FROM leaderboard_results lr
      JOIN tasks t ON t.id = lr.task_id
      JOIN datasets d ON d.id = lr.dataset_id
      WHERE lr.paper_id = ${paper.id} AND lr.best_metric_value IS NOT NULL
      ORDER BY t.name, d.name
      LIMIT 50
    `,
    sql<{ url: string; is_official: boolean; framework: string | null; stars: number | null }[]>`
      SELECT repo_url AS url, is_official, framework, stars
      FROM paper_code_links WHERE paper_id = ${paper.id}
      ORDER BY is_official DESC, stars DESC NULLS LAST
    `,
  ]);
  return { paper, lbResults, codeLinks };
}
/** Per-paper API payload. Callers must validate arxivId against getPaperIndex() first. */
export const getApiPaper = cached("getApiPaper", apiPaperUncached, [TAG_CATALOG]);

async function paperReproductionsUncached(paperId: string) {
  return sql<{
    id: number;
    user_id: string;
    username: string | null;
    display_name: string | null;
    tier_claimed: number;
    hardware_spec: string;
    run_log_url: string | null;
    notes: string | null;
    upvote_count: number;
    flag_count: number;
    status: string;
    created_at: string;
    actual_metric_name: string | null;
    actual_metric_value: number | null;
    model_name: string | null;
    dataset_name: string | null;
  }[]>`
    SELECT
      r.id,
      r.user_id,
      u.username,
      u.display_name,
      r.tier_claimed,
      r.hardware_spec,
      r.run_log_url,
      r.notes,
      r.upvote_count,
      r.flag_count,
      r.status,
      r.created_at::text,
      r.actual_metric_name,
      r.actual_metric_value,
      r.model_name,
      d.name AS dataset_name
    FROM reproductions r
    LEFT JOIN users u ON u.github_id = r.user_id
    LEFT JOIN datasets d ON d.id = r.dataset_id
    WHERE r.paper_id = ${paperId}
      AND r.status NOT IN ('hidden', 'removed')
    ORDER BY r.created_at DESC
  `;
}
/** Public reproduction list for a paper (no per-user state). Validate paperId against the index first. */
export const getPaperReproductions = cached("getPaperReproductions", paperReproductionsUncached, [TAG_CATALOG, TAG_USERS]);
