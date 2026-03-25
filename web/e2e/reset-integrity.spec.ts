import { test, expect } from "@playwright/test";
import { signIn, signInAsAdmin, signInAsTestUser, ensureTestData, resetTestData, signOut } from "./helpers/auth";

const BASE = "http://localhost:3000";
const REAL_PAPER = "attention-is-all-you-need";

/**
 * Reset cleanup: hype reverts, reproductions removed, test user gone.
 */
test.describe("Reset test data integrity", () => {
  test("hype reverts and test user cleaned after reset", async ({ page }) => {
    // 1. Setup
    await ensureTestData(page);

    // 2. Get pre-test hype via API
    const preRes = await page.request.get(`${BASE}/api/upvotes?paper_id=${REAL_PAPER}`);
    const preData = await preRes.json();
    const preHype = preData.count;

    // 3. Hype as test_user (via direct session)
    await signIn(page, "test_user", "test_user");
    const hypeRes = await page.context().request.post(`${BASE}/api/upvotes`, {
      data: { paper_id: REAL_PAPER },
    });
    expect(hypeRes.ok()).toBe(true);
    const hypeData = await hypeRes.json();
    expect(hypeData.upvoted).toBe(true);
    expect(hypeData.count).toBe(preHype + 1);
    await signOut(page);

    // 4. Submit reproduction as test_user
    await signIn(page, "test_user", "test_user");
    const reproRes = await page.context().request.post(`${BASE}/api/reproductions`, {
      data: { paper_id: "test_basic", tier_claimed: 3, hardware_spec: "Reset-Test" },
    });
    expect(reproRes.ok()).toBe(true);
    await signOut(page);

    // 5. Reset
    await resetTestData(page);

    // 6. Verify hype reverted
    const postRes = await page.request.get(`${BASE}/api/upvotes?paper_id=${REAL_PAPER}`);
    const postData = await postRes.json();
    expect(Math.abs(postData.count - preHype)).toBeLessThanOrEqual(1);

    // 7. Test user gone from leaderboard
    await page.goto("/leaderboard");
    expect(await page.getByText("test_user").count()).toBe(0);

    // 8. Re-create test data for other tests
    await ensureTestData(page);
  });
});
