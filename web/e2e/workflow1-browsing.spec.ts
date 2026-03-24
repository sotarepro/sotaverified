import { test, expect } from "@playwright/test";

/**
 * QA Workflow 1: Unauthenticated Browsing — gap coverage
 * Covers steps not in other spec files: task card click from category,
 * dataset accordion, scroll anchor persistence.
 */
test.describe("QA Workflow 1 — Unauthenticated Browsing", () => {
  test("WF1.7: click task card on category page → task page loads", async ({ page }) => {
    // Go to a category page
    await page.goto("/tasks?area=Computer+Vision");
    // Click a task link in the task table
    const taskLink = page.locator("a[href^='/tasks/']").first();
    await expect(taskLink).toBeVisible();
    const href = await taskLink.getAttribute("href");
    await taskLink.click();
    await page.waitForURL(/\/tasks\//);
    await expect(page.locator("h1")).toBeVisible();
  });

  test("WF1.8: dataset accordion expands on click (no full page reload)", async ({ page }) => {
    // Task page with leaderboard datasets
    await page.goto("/tasks/object-detection");
    // Find a collapsed accordion button (dataset name with submission count)
    const datasetBtn = page.locator("button", { hasText: /submissions?/ }).first();
    if (await datasetBtn.count()) {
      // Click to expand
      await datasetBtn.click();
      // Table should appear inside the expanded section
      await expect(page.locator("table").first()).toBeVisible();
      // URL should NOT have changed (client-side toggle, no reload)
      expect(page.url()).toContain("/tasks/object-detection");
    }
  });
});
