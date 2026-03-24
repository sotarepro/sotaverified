import { test, expect } from "@playwright/test";
import { signIn, signInAsAdmin, signInAsTestUser, ensureTestData, signOut } from "./helpers/auth";

/**
 * QA Workflow 7: Admin Functions
 * Covers: remove/restore reproduction, impersonation banner,
 * exit impersonation, test tools create/reset.
 */
test.describe("QA Workflow 7 — Admin Functions", () => {
  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    await ensureTestData(page);
    await page.close();
  });

  test("WF7.4-5: admin removes reproduction via API, then restores it", async ({ page }) => {
    // Create a reproduction as test_user (direct session, not impersonation)
    await signIn(page, "test_user", "test_user");
    const createRes = await page.context().request.post("http://localhost:3000/api/reproductions", {
      data: {
        paper_id: "attention-is-all-you-need",
        tier_claimed: 3,
        hardware_spec: "WF7 Admin Test GPU",
      },
    });
    expect(createRes.ok()).toBe(true);
    const { id: reproId } = await createRes.json();
    await signOut(page);

    // Admin removes it
    const removeRes = await page.context().request.patch(`http://localhost:3000/api/admin/reproductions/${reproId}`, {
      data: { action: "remove" },
    });
    expect(removeRes.ok()).toBe(true);

    // Admin restores it
    const restoreRes = await page.context().request.patch(`http://localhost:3000/api/admin/reproductions/${reproId}`, {
      data: { action: "restore" },
    });
    expect(restoreRes.ok()).toBe(true);

    // Verify it's back via GET API
    const listRes = await page.context().request.get("http://localhost:3000/api/reproductions?paper_id=attention-is-all-you-need");
    const repros = await listRes.json();
    const restored = repros.find((r: { id: number }) => r.id === reproId);
    expect(restored).toBeDefined();
    expect(restored.status).not.toBe("removed");

    await signOut(page);
  });

  test("WF7.8: impersonation shows banner with test user name", async ({ page }) => {
    await signInAsTestUser(page);
    await page.goto("/");

    // Impersonation banner should be visible
    await expect(page.getByText("Impersonating")).toBeVisible();
    await expect(page.getByText("@test_user")).toBeVisible();
    // Exit button should be present
    await expect(page.getByText("Exit impersonation")).toBeVisible();

    await signOut(page);
  });

  test("WF7.9: exit impersonation restores admin access", async ({ page }) => {
    await signInAsTestUser(page);
    await page.goto("/");
    await expect(page.getByText("Impersonating")).toBeVisible();

    // Click exit impersonation
    await page.getByText("Exit impersonation").click();
    // Should redirect to /admin
    await page.waitForURL(/\/admin/, { timeout: 5000 });

    // Admin page should load (not 404)
    await expect(page.locator("h1")).toContainText(/admin/i);
    // Banner should be gone
    await expect(page.getByText("Impersonating")).not.toBeVisible();

    await signOut(page);
  });

  test("WF7.10-11: reset test data cleans up artifacts", async ({ page }) => {
    await signInAsAdmin(page);

    // First verify test data exists
    const beforeRes = await page.context().request.get("http://localhost:3000/api/admin/test/users");
    const beforeUsers = await beforeRes.json();
    expect(beforeUsers.length).toBeGreaterThan(0);

    // Reset
    const resetRes = await page.context().request.post("http://localhost:3000/api/admin/test/reset");
    expect(resetRes.ok()).toBe(true);

    // Verify test users are gone
    const afterRes = await page.context().request.get("http://localhost:3000/api/admin/test/users");
    const afterUsers = await afterRes.json();
    expect(afterUsers.length).toBe(0);

    // Recreate for other tests
    await ensureTestData(page);

    await signOut(page);
  });
});
