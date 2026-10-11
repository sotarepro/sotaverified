import { unstable_cache, revalidatePath, revalidateTag } from "next/cache";

/**
 * Maintenance-mode caching. Anonymous page views must never touch the database
 * (the free Neon compute only lasts if it sleeps), so every public read goes
 * through the Next Data Cache with NO time-based expiry. Entries are only
 * dropped by `revalidateCatalog()` / `revalidatePaper()` after a write.
 */
export const TAG_CATALOG = "catalog"; // lists, counts, tabs, leaderboards, search corpus
export const TAG_USERS = "users"; // public profiles, user leaderboard
export const paperTag = (id: string) => `paper:${id}`;

/**
 * Bump (or set CATALOG_VERSION in the environment) whenever the catalog is replaced
 * wholesale — e.g. a trim, a restore, the move to Neon, or REVIVAL.md. The Next Data
 * Cache persists across deployments, so this guarantees entries built from an older
 * database are never reused.
 */
export const CATALOG_VERSION = process.env.CATALOG_VERSION ?? "mm1";

/**
 * Wrap a DB read in the persistent data cache. `name` + args form the cache key.
 * Under jest (no Next incremental cache) this is a pass-through.
 */
export function cached<A extends unknown[], R>(
  name: string,
  fn: (...args: A) => Promise<R>,
  tags: string[] = [TAG_CATALOG],
): (...args: A) => Promise<R> {
  if (process.env.NODE_ENV === "test") return fn;
  return unstable_cache(fn, [name, CATALOG_VERSION], { tags, revalidate: false });
}

function expire(tag: string) {
  try {
    // Route handlers need an explicit immediate expiry for read-your-own-writes.
    revalidateTag(tag, { expire: 0 });
  } catch {
    /* outside a Next request scope (tests, scripts) */
  }
}

function path(p: string, type?: "page" | "layout") {
  try {
    if (type) revalidatePath(p, type);
    else revalidatePath(p);
  } catch {
    /* outside a Next request scope */
  }
}

/** Call after any write that changes what anonymous visitors see. Never throws. */
export function revalidateAfterWrite(opts: { paperId?: string | null; users?: boolean } = {}) {
  expire(TAG_CATALOG);
  if (opts.users !== false) expire(TAG_USERS);
  if (opts.paperId) {
    expire(paperTag(opts.paperId));
    path(`/papers/${opts.paperId}`);
  }
  // Server-rendered pages whose output embeds catalog data.
  path("/", "page");
  path("/tasks", "layout");
  path("/browse", "layout"); // /tasks?area=X rewrite targets
  path("/data", "layout"); // static JSON behind the client-side tabs / task lists
  path("/leaderboard", "page");
  path("/profile/[username]", "page");
}

/** Narrow variant for sign-ins: only public profile data changes. */
export function revalidateUsers() {
  expire(TAG_USERS);
  path("/profile/[username]", "page");
  path("/leaderboard", "page");
}
