import sql from "./db";
import { areaSlug } from "./areas";
import { expireTags, revalidatePaths, tag } from "./cache";
import { getLeaderboardData } from "./public-data";

export { revalidateEverything } from "./cache";

/**
 * Write-side revalidation. A write refreshes only what it changed (see the tag map in
 * lib/cache.ts). Everything here is best-effort: it never throws, and it is a no-op under jest.
 * `revalidateEverything()` (re-exported above) is for admin / test tooling only.
 */
const inTest = () => process.env.NODE_ENV === "test";

interface TaskInfo {
  id: string;
  area: string | null;
  is_visible: boolean;
  in_tabs: boolean; // appears in the paper's paper_tasks (its paper lists), vs only a leaderboard row
}

async function paperScope(paperId: string): Promise<{ tasks: TaskInfo[]; arxivId: string | null }> {
  const [tasks, papers] = await Promise.all([
    sql<TaskInfo[]>`
      WITH ids AS (
        SELECT task_id FROM paper_tasks WHERE paper_id = ${paperId}
        UNION
        SELECT task_id FROM leaderboard_results WHERE paper_id = ${paperId} AND task_id IS NOT NULL
      )
      SELECT t.id, t.area, t.is_visible,
             EXISTS(SELECT 1 FROM paper_tasks pt WHERE pt.paper_id = ${paperId} AND pt.task_id = t.id) AS in_tabs
      FROM tasks t JOIN ids ON ids.task_id = t.id
    `,
    sql<{ arxiv_id: string | null }[]>`SELECT arxiv_id FROM papers WHERE id = ${paperId}`,
  ]);
  return { tasks, arxivId: papers[0]?.arxiv_id ?? null };
}

/** Is this paper in (or about to enter) the /leaderboard "needs verification" top 10? */
async function inNeedsVerification(paperId: string, newHype?: number): Promise<boolean> {
  const { needsVerification } = await getLeaderboardData();
  if (needsVerification.some((p) => p.id === paperId)) return true;
  if (newHype === undefined) return false;
  return needsVerification.length < 10 || newHype >= needsVerification[needsVerification.length - 1].hype_score;
}

/**
 * Hype / unhype on one paper: the paper page, the home page + all-papers tab JSON, the paper's
 * task pages (+ their tab JSON) and research-area pages, and /leaderboard only if the paper
 * is (or just became) one of its "needs verification" rows.
 */
export async function revalidatePaperHype(paperId: string, newHype?: number): Promise<void> {
  if (inTest()) return;
  try {
    const { tasks } = await paperScope(paperId);
    const tags: string[] = [tag.papersIndex, tag.tabsAll];
    const paths: string[] = [`/papers/${paperId}`, "/", "/data/tabs/all"];
    for (const t of tasks.filter((t) => t.in_tabs)) {
      tags.push(tag.tabsTask(t.id));
      if (t.is_visible) paths.push(`/tasks/${t.id}`, `/data/tabs/task/${t.id}`);
      if (t.area) {
        tags.push(tag.tabsArea(areaSlug(t.area)));
        paths.push(`/browse/area/${areaSlug(t.area)}`, `/data/tabs/area/${areaSlug(t.area)}`);
      }
    }
    if (await inNeedsVerification(paperId, newHype)) {
      tags.push(tag.leaderboard);
      paths.push("/leaderboard");
    }
    expireTags(tags);
    revalidatePaths(paths);
  } catch (err) {
    console.error("[revalidate] paper hype failed", err);
  }
}

/**
 * A change to what a paper shows publicly (reproduction, author claim, code link, benchmark,
 * moderation): its page, reproduction list, home / task / area lists, the leaderboards of the
 * tasks it has results in, the API views, and /leaderboard if the paper appears there.
 * Called from recomputeVerificationScore(), which every such write already ends with.
 */
export async function revalidatePaperChange(paperId: string): Promise<void> {
  if (inTest()) return;
  try {
    const { tasks, arxivId } = await paperScope(paperId);
    const tags: string[] = [tag.papersIndex, tag.sotaCorpus, tag.paper(paperId), tag.tabsAll];
    const paths: string[] = [`/papers/${paperId}`, "/", "/data/tabs/all"];
    if (arxivId) tags.push(tag.arxiv(arxivId));
    for (const t of tasks) {
      tags.push(tag.task(t.id)); // leaderboard rows + dataset list
      if (t.is_visible) paths.push(`/tasks/${t.id}`);
      if (!t.in_tabs) continue;
      tags.push(tag.tabsTask(t.id));
      if (t.is_visible) paths.push(`/data/tabs/task/${t.id}`);
      if (t.area) {
        tags.push(tag.tabsArea(areaSlug(t.area)));
        paths.push(`/browse/area/${areaSlug(t.area)}`, `/data/tabs/area/${areaSlug(t.area)}`);
      }
    }
    if (await inNeedsVerification(paperId)) {
      tags.push(tag.leaderboard);
      paths.push("/leaderboard");
    }
    expireTags(tags);
    revalidatePaths(paths);
  } catch (err) {
    console.error("[revalidate] paper change failed", err);
  }
}

/**
 * Specific users' public profiles. `reputation: true` when their reputation changed, which also
 * reorders /leaderboard. (Other users' "#rank" on their own profiles is left to refresh on their
 * next write — only the changed users' profiles are regenerated.)
 */
export async function revalidateProfiles(
  userIds: Array<string | null | undefined>,
  opts: { reputation?: boolean } = {},
): Promise<void> {
  if (inTest()) return;
  try {
    const ids = [...new Set(userIds.filter((x): x is string => !!x))];
    const tags: string[] = [];
    const paths: string[] = [];
    if (ids.length) {
      const rows = await sql<{ username: string }[]>`SELECT username FROM users WHERE github_id = ANY(${ids})`;
      for (const r of rows) {
        tags.push(tag.profile(r.username));
        paths.push(`/profile/${r.username}`);
      }
    }
    if (opts.reputation) {
      tags.push(tag.leaderboard);
      paths.push("/leaderboard");
    }
    expireTags(tags);
    revalidatePaths(paths);
  } catch (err) {
    console.error("[revalidate] profiles failed", err);
  }
}

/** A sign-in upserts one user's GitHub profile fields. A brand-new user also changes the username index. */
export async function revalidateSignIn(githubId: string, username: string, isNew: boolean): Promise<void> {
  if (inTest()) return;
  try {
    const tags = [tag.profile(username)];
    const paths = [`/profile/${username}`];
    if (isNew) tags.push(tag.usersIndex);
    const { users } = await getLeaderboardData();
    if (users.some((u) => u.github_id === githubId)) {
      tags.push(tag.leaderboard);
      paths.push("/leaderboard");
    }
    expireTags(tags);
    revalidatePaths(paths);
  } catch (err) {
    console.error("[revalidate] sign-in failed", err);
  }
}

/** A code link was added: the hero "code links" count on the home page changes. */
export function revalidateSiteStats(): void {
  if (inTest()) return;
  expireTags([tag.siteStats]);
  revalidatePaths(["/"]);
}

/** Only a paper's reproduction list changed (flag / unflag / reproduction upvote): its page + list cache. */
export function revalidatePaperRepros(paperId: string): void {
  if (inTest()) return;
  expireTags([tag.paper(paperId)]);
  revalidatePaths([`/papers/${paperId}`]);
}
