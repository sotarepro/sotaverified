import { test, expect } from "@playwright/test";
import { signInAsAdmin, signIn, ensureTestData, signOut } from "./helpers/auth";

test.describe("Persona 4 — Admin", () => {
  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    await ensureTestData(page);
    await page.close();
  });

  test("admin can access /admin and sees all sections", async ({ page }) => {
    await signInAsAdmin(page);
    await page.goto("/admin");
    await expect(page.locator("h1")).toContainText(/admin/i);
    // Activity feed section
    await expect(page.getByRole("heading", { name: /Activity Feed/ })).toBeVisible();
    // Author claims section
    await expect(page.getByRole("heading", { name: /Author Claims/ })).toBeVisible();
    // Agent submissions section
    await expect(page.getByRole("heading", { name: /Agent Submissions/ })).toBeVisible();
  });

  test("admin activity feed shows events with timestamps", async ({ page }) => {
    await signInAsAdmin(page);
    await page.goto("/admin");
    // Feed should show at least one event (from test data setup)
    const feedItems = page.locator("text=/ago$/");
    // At least some timestamped items should exist
    await expect(feedItems.first()).toBeVisible({ timeout: 5000 });
  });

  test("non-admin user gets not-found on /admin", async ({ page }) => {
    await signIn(page, "non_admin_user", "regular_user");
    await page.goto("/admin");
    await expect(page.getByText("This page could not be found")).toBeVisible();
    await signOut(page);
  });

  test("unauthenticated gets not-found on /admin", async ({ page }) => {
    await signOut(page);
    await page.goto("/admin");
    await expect(page.getByText("This page could not be found")).toBeVisible();
  });

  test("admin test tools visible in dev mode", async ({ page }) => {
    await signInAsAdmin(page);
    await page.goto("/admin");
    // Test tools section should be visible (ENABLE_TEST_TOOLS=true in dev)
    await expect(page.getByText("Test Tools")).toBeVisible();
    // Create user buttons
    await expect(page.getByText("+ Test User").first()).toBeVisible();
    await expect(page.getByText("+ Test Author").first()).toBeVisible();
    // Reset button
    await expect(page.getByRole("button", { name: "Reset Test Data" })).toBeVisible();
  });
});
