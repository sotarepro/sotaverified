import { test, expect } from "@playwright/test";

test.describe("Persona 1 — Search", () => {
  test("search for known paper returns results with paper links", async ({ page }) => {
    await page.goto("/search?q=attention+is+all+you+need", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Search results" })).toBeVisible({ timeout: 15000 });
    await expect(page.locator("a[href^='/papers/']").first()).toBeVisible();
  });

  test("search result links go to /papers/[id]", async ({ page }) => {
    await page.goto("/search?q=attention+is+all+you+need", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Search results" })).toBeVisible({ timeout: 15000 });
    const firstResult = page.locator("a[href^='/papers/']").first();
    const href = await firstResult.getAttribute("href");
    expect(href).toMatch(/^\/papers\//);
  });

  test("search results show verification badge and hype count", async ({ page }) => {
    await page.goto("/search?q=attention+is+all+you+need", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Search results" })).toBeVisible({ timeout: 15000 });
    // Status column should have a badge
    const statusCell = page.locator("tbody tr:first-child td:nth-child(3)");
    await expect(statusCell).not.toBeEmpty();
    // Hype column should have a number
    const hypeCell = page.locator("tbody tr:first-child td:nth-child(4)");
    await expect(hypeCell).not.toBeEmpty();
  });

  test("search for task shows task results above papers", async ({ page }) => {
    await page.goto("/search?q=object+detection", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Search results" })).toBeVisible({ timeout: 15000 });
    // Tasks section should appear
    await expect(page.getByRole("heading", { name: "Tasks" })).toBeVisible();
  });

  test("search for task: task links go to /tasks/[slug]", async ({ page }) => {
    await page.goto("/search?q=object+detection", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Tasks" })).toBeVisible({ timeout: 15000 });
    const taskLink = page.locator("a[href^='/tasks/']").first();
    if (await taskLink.count()) {
      const href = await taskLink.getAttribute("href");
      expect(href).toMatch(/^\/tasks\//);
    }
  });

  test("empty search shows helpful message", async ({ page }) => {
    await page.goto("/search?q=", { waitUntil: "domcontentloaded" });
    await expect(page.getByText("Enter a query")).toBeVisible({ timeout: 15000 });
  });
});
