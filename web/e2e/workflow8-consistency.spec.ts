import { test, expect } from "@playwright/test";
import { signInAsAdmin, ensureTestData, signOut } from "./helpers/auth";

/**
 * QA Workflow 8: Cross-page Consistency
 * Verifies data is consistent across different views of the same paper.
 */
test.describe("QA Workflow 8 — Cross-page Consistency", () => {
  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    await ensureTestData(page);
    await page.close();
  });

  test("WF8.3: search verification badge matches paper detail badge", async ({ page }) => {
    // Search for a known paper
    await page.goto("/search?q=attention+is+all+you+need", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Search results" })).toBeVisible({ timeout: 15000 });

    // Get the badge text from search results (first paper row, status column)
    const searchStatusCell = page.locator("tbody tr:first-child td:nth-child(3) span").first();
    const searchBadge = await searchStatusCell.textContent();

    // Navigate to the paper detail page
    await page.locator("a[href^='/papers/']").first().click();
    await page.waitForURL(/\/papers\//);

    // Get the badge text from paper detail (should match search)
    // The detail page shows the badge near the top
    const detailBadge = page.locator("[class*='rounded'][class*='text-xs'][class*='font-medium']").first();
    const detailBadgeText = await detailBadge.textContent();

    // Both should show the same badge type (e.g., "Code Available")
    expect(detailBadgeText).toContain(searchBadge!.trim());
  });

  test("WF8.4: leaderboard reputation matches profile page", async ({ page }) => {
    await page.goto("/leaderboard");
    // Find a user row with reputation
    const userRow = page.locator("tbody tr").first();
    if (await userRow.count()) {
      // Get username from the row
      const usernameLink = userRow.locator("a[href^='/profile/']");
      if (await usernameLink.count()) {
        const profileHref = await usernameLink.getAttribute("href");
        // Get reputation from leaderboard
        const repCell = userRow.locator("td:nth-child(3)");
        const leaderboardRep = (await repCell.textContent())?.trim();

        // Navigate to profile
        await page.goto(profileHref!);
        // Profile should show the same reputation
        const profileRep = page.getByText(/reputation/i).first();
        if (await profileRep.count()) {
          const profileText = await profileRep.textContent();
          expect(profileText).toContain(leaderboardRep!);
        }
      }
    }
  });
});
