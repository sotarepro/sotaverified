import { test, expect } from "@playwright/test";
import { signIn, signInAsAdmin, signInAsTestUser, ensureTestData, signOut } from "./helpers/auth";

const BASE = "http://localhost:3000";

/**
 * Flagged reproduction admin flow: flag → auto-hide → restore → remove.
 */
test.describe("Flagged reproduction queue", () => {
  let reproId: number | null = null;
  const PAPER = "attention-is-all-you-need";
  const HW = `FQ-${Date.now()}`; // unique per run to avoid collision

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    await ensureTestData(page);
    await signInAsAdmin(page);
    const res = await page.context().request.post(`${BASE}/api/reproductions`, {
      data: { paper_id: PAPER, tier_claimed: 3, hardware_spec: HW },
    });
    if (res.ok()) reproId = (await res.json()).id;
    await signOut(page);
    await page.close();
  });

  test("1. first flag: count=1, not hidden", async ({ page }) => {
    test.skip(!reproId, "No reproduction");
    await signInAsTestUser(page);
    const res = await page.context().request.post(`${BASE}/api/reproductions/${reproId}/flag`);
    expect(res.ok()).toBe(true);
    const data = await res.json();
    expect(data.flagged).toBe(true);
    expect(data.count).toBe(1);
    expect(data.hidden).toBeFalsy();
    await signOut(page);
  });

  test("2. second flag: auto-hide", async ({ page }) => {
    test.skip(!reproId, "No reproduction");
    // Use test_author (exists in DB) as the second flagger
    await signIn(page, "test_author", "test_author");
    const res = await page.context().request.post(`${BASE}/api/reproductions/${reproId}/flag`);
    expect(res.ok()).toBe(true);
    const data = await res.json();
    expect(data.flagged).toBe(true);
    expect(data.count).toBe(2);
    expect(data.hidden).toBe(true);
    await signOut(page);
  });

  test("3. hidden not visible on paper page", async ({ page }) => {
    test.skip(!reproId, "No reproduction");
    await page.goto(`/papers/${PAPER}`);
    await page.waitForTimeout(2000);
    expect(await page.getByText(HW).count()).toBe(0);
  });

  test("4. admin restores it", async ({ page }) => {
    test.skip(!reproId, "No reproduction");
    await signInAsAdmin(page);
    const res = await page.context().request.patch(`${BASE}/api/admin/reproductions/${reproId}`, {
      data: { action: "restore" },
    });
    expect(res.ok()).toBe(true);
    // Now visible
    await page.goto(`/papers/${PAPER}`);
    await page.waitForTimeout(2000);
    await expect(page.getByText(HW).first()).toBeVisible();
    await signOut(page);
  });

  test("5. admin removes permanently", async ({ page }) => {
    test.skip(!reproId, "No reproduction");
    await signInAsAdmin(page);
    const res = await page.context().request.patch(`${BASE}/api/admin/reproductions/${reproId}`, {
      data: { action: "remove" },
    });
    expect(res.ok()).toBe(true);
    // Verify via API that it's not in public list
    const listRes = await page.context().request.get(`${BASE}/api/reproductions?paper_id=${PAPER}`);
    const repros = await listRes.json();
    const found = repros.find((r: { id: number }) => r.id === reproId);
    expect(found).toBeUndefined(); // removed reproductions filtered out
    await signOut(page);
  });
});
