import { unstable_cache, revalidatePath, revalidateTag } from "next/cache";
import { areaSlug } from "./areas";

/**
 * Maintenance-mode caching. Anonymous page views must never touch the database
 * (the free Neon compute only lasts if it sleeps), so every public read goes
 * through the Next Data Cache with NO time-based expiry. Entries are only dropped by
 * on-demand revalidation after a write — and a write only drops what it changed:
 *
 *   tabs:all | tabs:task:<id> | tabs:area:<slug>   paper lists (hype / badges / rankings)
 *   task:<id>                                      a task's leaderboard + datasets
 *   paper:<id>                                     a paper's public reproduction list
 *   profile:<username>                             one public profile
 *   leaderboard                                    /leaderboard (top users + needs-verification)
 *   papers-index | sota-corpus | site-stats | arxiv:<id> | users-index   small shared indexes
 *
 * Every entry also carries TAG_CATALOG, which ONLY `revalidateEverything()` (admin / test
 * tools / catalog replacement) expires. See lib/revalidate.ts for the write-side helpers.
 */
export const TAG_CATALOG = "catalog";

export const tag = {
  tabsAll: "tabs:all",
  tabsTask: (id: string) => `tabs:task:${id}`,
  tabsArea: (slug: string) => `tabs:area:${slug}`,
  task: (id: string) => `task:${id}`,
  paper: (id: string) => `paper:${id}`,
  profile: (username: string) => `profile:${username}`,
  arxiv: (arxivId: string) => `arxiv:${arxivId}`,
  leaderboard: "leaderboard",
  papersIndex: "papers-index",
  sotaCorpus: "sota-corpus",
  siteStats: "site-stats",
  usersIndex: "users-index",
} as const;

/** Tag for a paper-list scope (all papers, one task, or one research area). */
export function scopeTag(scope?: { taskId?: string; area?: string }): string {
  if (scope?.taskId) return tag.tabsTask(scope.taskId);
  if (scope?.area) return tag.tabsArea(areaSlug(scope.area));
  return tag.tabsAll;
}

/**
 * Bump (or set CATALOG_VERSION in the environment) whenever the catalog is replaced
 * wholesale — e.g. a trim, a restore, the move to Neon, or REVIVAL.md. The Next Data
 * Cache persists across deployments, so this guarantees entries built from an older
 * database are never reused.
 */
export const CATALOG_VERSION = process.env.CATALOG_VERSION ?? "mm1";

/**
 * Wrap a DB read in the persistent data cache with fixed tags. `name` + args form the cache key.
 * Under jest (no Next incremental cache) this is a pass-through.
 */
export function cached<A extends unknown[], R>(
  name: string,
  fn: (...args: A) => Promise<R>,
  tags: string[] = [],
): (...args: A) => Promise<R> {
  if (process.env.NODE_ENV === "test") return fn;
  return unstable_cache(fn, [name, CATALOG_VERSION], { tags: [...tags, TAG_CATALOG], revalidate: false });
}

/** Like `cached`, but the tags depend on the arguments (per-task, per-profile, ...). */
export function cachedBy<A extends unknown[], R>(
  name: string,
  fn: (...args: A) => Promise<R>,
  // Callbacks may declare fewer params than the wrapped function (e.g. just the task id).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tagsFor: (...args: any[]) => string[],
): (...args: A) => Promise<R> {
  if (process.env.NODE_ENV === "test") return fn;
  return (...args: A) =>
    unstable_cache(fn, [name, CATALOG_VERSION], {
      tags: [...tagsFor(...(args as unknown[])), TAG_CATALOG],
      revalidate: false,
    })(...args);
}

export function expireTags(tags: Iterable<string>) {
  for (const t of new Set(tags)) {
    try {
      // Route handlers need an explicit immediate expiry for read-your-own-writes.
      revalidateTag(t, { expire: 0 });
    } catch {
      /* outside a Next request scope (tests, scripts) */
    }
  }
}

export function revalidatePaths(paths: Iterable<string>) {
  for (const p of new Set(paths)) {
    try {
      revalidatePath(p);
    } catch {
      /* outside a Next request scope */
    }
  }
}

/**
 * Drop EVERYTHING cached. Admin / test tools / catalog replacement only — never call this
 * from a normal user write (use the narrow helpers in lib/revalidate.ts).
 */
export function revalidateEverything() {
  expireTags([TAG_CATALOG]);
  for (const [p, type] of [
    ["/", "page"],
    ["/tasks", "layout"],
    ["/browse", "layout"],
    ["/data", "layout"],
    ["/leaderboard", "page"],
    ["/profile/[username]", "page"],
    ["/papers/[id]", "page"],
  ] as const) {
    try {
      revalidatePath(p, type);
    } catch {
      /* outside a Next request scope */
    }
  }
}
