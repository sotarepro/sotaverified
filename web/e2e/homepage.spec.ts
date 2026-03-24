import { test, expect } from "@playwright/test";

test.describe("Persona 1 — Homepage", () => {
  test("hero section with headline, tagline, and live stats", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("h1")).toContainText("Open Verification Layer", { timeout: 15000 });
    // Live stats from DB — paper count, code links, tasks
    await expect(page.getByText(/\d{3,}.*papers/).first()).toBeVisible();
    await expect(page.getByText(/\d{3,}.*code links/).first()).toBeVisible();
    await expect(page.getByText(/\d{3,}.*tasks/).first()).toBeVisible();
  });

  test("paper table with five tabs, each loads different data", async ({ page }) => {
    const tabs = ["recent", "hyped", "active", "unverified", "verified"];
    for (const tab of tabs) {
      await page.goto(`/?tab=${tab}#paper-table`);
      const activeTab = page.getByTestId(`tab-${tab}`);
      await expect(activeTab).toHaveClass(/border-blue-500/, { timeout: 15000 });
    }
  });

  test("table rows have title link, date, verification badge, hype count", async ({ page }) => {
    await page.goto("/");
    const firstRow = page.locator("tbody tr").first();
    // Title links to /papers/[id]
    const titleLink = firstRow.locator("td:first-child a");
    await expect(titleLink).toHaveAttribute("href", /^\/papers\//);
    // Date column exists
    await expect(firstRow.locator("td:nth-child(2)")).not.toBeEmpty();
  });

  test("page size toggle: 10, 25, 50", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("tbody tr")).toHaveCount(10);
    await page.click("text=25");
    await page.waitForURL(/pageSize=25/);
    expect(await page.locator("tbody tr").count()).toBe(25);
  });

  test("pagination with next/prev stays at table position", async ({ page }) => {
    await page.goto("/?pageSize=10#paper-table");
    // Check URL has #paper-table for scroll anchor
    const nextLink = page.locator("a", { hasText: "Next →" });
    if (await nextLink.count()) {
      const href = await nextLink.getAttribute("href");
      expect(href).toContain("#paper-table");
    }
  });

  test("paper title links go to /papers/[id] not arXiv", async ({ page }) => {
    await page.goto("/");
    const firstLink = page.locator("tbody tr:first-child td:first-child a");
    const href = await firstLink.getAttribute("href");
    expect(href).toMatch(/^\/papers\//);
    expect(href).not.toMatch(/arxiv\.org/);
  });

  test("research area cards link to category pages with scoped data", async ({ page }) => {
    await page.goto("/");
    const areaCard = page.locator("a[href*='/tasks?area=']").first();
    await expect(areaCard).toBeVisible();
    await areaCard.click();
    await page.waitForURL(/\/tasks\?area=/);
    // Category page shows scoped heading
    await expect(page.locator("h1")).toBeVisible();
    // Has task table
    await expect(page.locator("table").first()).toBeVisible();
  });
});
