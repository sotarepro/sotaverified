import { test, expect } from "@playwright/test";
import { signIn, signInAsAdmin, ensureTestData, signOut } from "./helpers/auth";

const BASE = "http://localhost:3000";

/**
 * Reputation: tier rep on submission + upvote rep.
 * Uses API calls to avoid slow page navigations through Railway.
 */
test.describe("Reputation math", () => {
  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    await ensureTestData(page);
    // Reset test_user rep to 0
    await signInAsAdmin(page);
    await page.context().request.post(`${BASE}/api/admin/clear-user-data`, {
      data: { username: "test_user" },
    });
    await signOut(page);
    await page.close();
  });

  test("tier 3 submission gives +10 rep, upvote adds +1", async ({ page }) => {
    // Submit Tier 3 as test_user
    await signIn(page, "test_user", "test_user");
    const r1 = await page.context().request.post(`${BASE}/api/reproductions`, {
      data: { paper_id: "attention-is-all-you-need", tier_claimed: 3, hardware_spec: "Rep-T3" },
    });
    expect(r1.ok()).toBe(true);
    const { id: reproId } = await r1.json();
    await signOut(page);

    // Check profile — rep should be 10 (REP_TIER_3)
    await page.goto("/profile/test_user");
    await expect(page.getByText("10").first()).toBeVisible();

    // Upvote as admin
    await signInAsAdmin(page);
    const upRes = await page.context().request.post(`${BASE}/api/reproductions/${reproId}/upvote`);
    expect(upRes.ok()).toBe(true);
    await signOut(page);

    // Check profile — rep should be 11
    await page.goto("/profile/test_user");
    await expect(page.getByText("11").first()).toBeVisible();

    // Clean up
    await signInAsAdmin(page);
    await page.context().request.post(`${BASE}/api/admin/clear-user-data`, {
      data: { username: "test_user" },
    });
    await signOut(page);
  });
});
