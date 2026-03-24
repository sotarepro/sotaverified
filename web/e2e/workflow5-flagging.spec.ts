import { test, expect } from "@playwright/test";
import { signInAsAdmin, signInAsTestUser, signIn, ensureTestData, signOut } from "./helpers/auth";

/**
 * QA Workflow 5: Flagging and Moderation
 * Full flag lifecycle: flag → auto-hide at threshold → admin restore.
 * Uses API calls for the second flag since we need a different user session.
 */
test.describe("QA Workflow 5 — Flagging and Moderation", () => {
  let reproId: number | null = null;

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    await ensureTestData(page);

    // Create a reproduction to flag (via API as admin, on a real paper so it always exists)
    await signInAsAdmin(page);
    const res = await page.context().request.post("http://localhost:3000/api/reproductions", {
      data: {
        paper_id: "attention-is-all-you-need",
        tier_claimed: 3,
        hardware_spec: "WF5 Flag Test GPU",
      },
    });
    if (res.ok()) {
      const data = await res.json();
      reproId = data.id;
    }
    await signOut(page);
    await page.close();
  });

  test("WF5.2-3: first flag increments count, reproduction stays visible", async ({ page }) => {
    test.skip(!reproId, "No reproduction to flag");

    // Sign in as test_user (different from admin who submitted)
    await signInAsTestUser(page);

    // Flag via API
    const res = await page.context().request.post(`http://localhost:3000/api/reproductions/${reproId}/flag`);
    expect(res.ok()).toBe(true);
    const data = await res.json();
    expect(data.flagged).toBe(true);
    expect(data.count).toBe(1);
    expect(data.hidden).toBeFalsy();

    await signOut(page);
  });

  test("WF5.4-5: second flag from different user → auto-hide at 2 flags", async ({ page }) => {
    test.skip(!reproId, "No reproduction to flag");

    // Sign in as a different user to flag
    await signIn(page, "flag_user_2", "flag_user_2");

    const res = await page.context().request.post(`http://localhost:3000/api/reproductions/${reproId}/flag`);
    expect(res.ok()).toBe(true);
    const data = await res.json();
    expect(data.flagged).toBe(true);
    expect(data.count).toBe(2);
    // FLAGS_TO_HIDE = 2, so this should trigger auto-hide
    expect(data.hidden).toBe(true);

    await signOut(page);
  });

  test("WF5.6: admin activity feed shows events", async ({ page }) => {
    await signInAsAdmin(page);
    await page.goto("/admin");
    // Activity feed heading should exist with event count
    await expect(page.getByRole("heading", { name: /Activity Feed/ })).toBeVisible();
    // Should have at least some feed entries (from all the test actions)
    const feedEntries = page.locator("[class*='rounded-lg'][class*='border'][class*='p-3']");
    await expect(feedEntries.first()).toBeVisible();
    await signOut(page);
  });

  test("WF5.7-8: admin restores hidden reproduction", async ({ page }) => {
    test.skip(!reproId, "No reproduction to restore");

    await signInAsAdmin(page);

    // Restore via API
    const res = await page.context().request.patch(`http://localhost:3000/api/admin/reproductions/${reproId}`, {
      data: { action: "restore" },
    });
    expect(res.ok()).toBe(true);

    // Verify it's visible again — check via GET reproductions API
    const listRes = await page.context().request.get(`http://localhost:3000/api/reproductions?paper_id=test_basic`);
    const repros = await listRes.json();
    const restored = repros.find((r: { id: number }) => r.id === reproId);
    expect(restored).toBeDefined();
    expect(restored.status).toBe("community");

    await signOut(page);
  });
});
