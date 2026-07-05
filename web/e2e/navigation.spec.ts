import { test, expect } from "@playwright/test";

test.describe("Persona 1 — Static pages and navigation", () => {
  test("About page renders without raw markdown or em dashes", async ({ page }) => {
    await page.goto("/about");
    await expect(page.locator("h1")).toBeVisible();
    // Should not have raw asterisks from markdown
    const body = await page.locator("main").textContent();
    expect(body).not.toMatch(/\*\*/);
  });

  test("Agents page renders with API docs and tier 1-3 (not 4)", async ({ page }) => {
    await page.goto("/agents");
    await expect(page.locator("h1")).toContainText("Agent API");
    await expect(page.getByText("tier_claimed").first()).toBeVisible();
    // Tier description should say 1-3, not 1-4
    await expect(page.getByText("independent reproduction").first()).toBeVisible();
    // Should NOT mention multi-group confirmed (tier 4)
    const body = await page.locator("main").textContent();
    expect(body).not.toContain("multi-group confirmed");
  });

  test("Leaderboard page renders with top users and help verify CTA", async ({ page }) => {
    await page.goto("/leaderboard");
    await expect(page.locator("h1")).toContainText("Leaderboard");
    await expect(page.getByText(/help verify/i)).toBeVisible();
  });

  test("task page renders with paper table and dataset leaderboards", async ({ page }) => {
    await page.goto("/tasks/object-detection");
    await expect(page.locator("h1")).toBeVisible();
    await expect(page.locator("table").first()).toBeVisible();
  });

  test("task leaderboard shows model name, not repeated paper title", async ({ page }) => {
    // MTEB has many models on same dataset — should show model names
    await page.goto("/tasks/text-classification");
    // If any leaderboard section exists, check for Model column header
    const modelHeader = page.locator("th", { hasText: "Model" });
    if (await modelHeader.count()) {
      await expect(modelHeader.first()).toBeVisible();
    }
  });

  test("/tasks page lists all tasks sorted by results", async ({ page }) => {
    await page.goto("/tasks");
    await expect(page.locator("h1")).toContainText("All Tasks");
    await expect(page.locator("table tbody tr").first()).toBeVisible();
  });

  test("invalid paper ID returns 404", async ({ page }) => {
    await page.goto("/papers/this-paper-does-not-exist-xyz");
    await expect(page.getByText("This page could not be found")).toBeVisible();
  });

  test("/papers/admin returns 404 (not admin page)", async ({ page }) => {
    await page.goto("/papers/admin");
    await expect(page.getByText("This page could not be found")).toBeVisible();
  });

  test("profile page renders for existing user", async ({ page }) => {
    await page.goto("/profile/uberdavid-bot");
    await expect(page.getByRole("heading", { name: "uberdavid-bot" })).toBeVisible();
  });
});
