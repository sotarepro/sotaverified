import { type Page, type BrowserContext, expect } from "@playwright/test";

const BASE = "http://localhost:3000";

const ADMIN_GITHUB_ID = process.env.ADMIN_GITHUB_ID ?? "252498040";
const ADMIN_USERNAME = "uberdavid-bot";

/**
 * Sign in by creating a NextAuth JWT session via the test endpoint.
 * Uses the browser context's request so cookies are shared with page navigation.
 */
async function apiPost(context: BrowserContext, url: string, data: Record<string, string>) {
  // Retry once on 500 — Next.js dev mode can fail on first compilation of a route
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await context.request.post(url, { data });
    if (res.ok()) return res;
    if (res.status() === 500 && attempt === 0) {
      await new Promise((r) => setTimeout(r, 2000));
      continue;
    }
    const body = await res.text().catch(() => "");
    throw new Error(`POST ${url} failed: ${res.status()} — ${body.slice(0, 200)}`);
  }
  throw new Error(`POST ${url} failed after retries`);
}

export async function signIn(page: Page, githubId: string, username: string) {
  await apiPost(page.context(), `${BASE}/api/test/session`, { github_id: githubId, username });
}

export async function signInAsAdmin(page: Page) {
  await signIn(page, ADMIN_GITHUB_ID, ADMIN_USERNAME);
}

export async function signInAsTestUser(page: Page) {
  await signIn(page, ADMIN_GITHUB_ID, ADMIN_USERNAME);
  await apiPost(page.context(), `${BASE}/api/admin/test/impersonate`, { github_id: "test_user" });
}

export async function signInAsTestAuthor(page: Page) {
  await signIn(page, ADMIN_GITHUB_ID, ADMIN_USERNAME);
  await apiPost(page.context(), `${BASE}/api/admin/test/impersonate`, { github_id: "test_author" });
}

export async function signOut(page: Page) {
  await page.context().request.delete(`${BASE}/api/test/session`);
}

export async function ensureTestData(page: Page) {
  await signInAsAdmin(page);
  await apiPost(page.context(), `${BASE}/api/admin/test/users`, { preset: "test_user" });
  await apiPost(page.context(), `${BASE}/api/admin/test/users`, { preset: "author" });
  await apiPost(page.context(), `${BASE}/api/admin/test/papers`, { preset: "basic" });
  await signOut(page);
}

export async function resetTestData(page: Page) {
  await signInAsAdmin(page);
  await page.context().request.post(`${BASE}/api/admin/test/reset`);
  await signOut(page);
}
