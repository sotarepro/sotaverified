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
    await page.goto("/search?q=attention+is+all+you+need", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Search results" })).toBeVisible();

    // Get the badge text from search results
    const searchBadge = page.locator("tbody tr:first-child td:nth-child(3) span").first();
    const searchBadgeText = (await searchBadge.textContent())?.trim() ?? "";

    // Navigate to paper detail
    await page.locator("a[href*='attention-is-all-you-need']").first().click();
    await page.waitForURL(/\/papers\//);

    // Detail page should show a badge — verify it exists and contains recognizable text
    const detailBadge = page.locator("span", {
      hasText: /Code Available|Community Verified|Author Verified|Unverified/,
    }).first();
    const detailText = (await detailBadge.textContent())?.trim() ?? "";

    // Both badges should reference the same verification state
    // Extract just the badge type before any " — N reproductions" suffix
    const normalize = (s: string) => s.split(/\s*[—-]\s*/)[0]?.trim();
    expect(normalize(searchBadgeText)).toBeTruthy();
    expect(normalize(detailText)).toContain(normalize(searchBadgeText)!);
  });

  test("WF8.4: leaderboard reputation matches profile page", async ({ page }) => {
    await page.goto("/leaderboard");
    const userRow = page.locator("tbody tr").first();
    if (await userRow.count()) {
      const usernameLink = userRow.locator("a[href^='/profile/']");
      if (await usernameLink.count()) {
        const profileHref = await usernameLink.getAttribute("href");
        const repCell = userRow.locator("td:nth-child(3)");
        const leaderboardRep = (await repCell.textContent())?.trim();

        await page.goto(profileHref!);
        const profileRep = page.getByText(/reputation/i).first();
        if (await profileRep.count()) {
          const profileText = await profileRep.textContent();
          expect(profileText).toContain(leaderboardRep!);
        }
      }
    }
  });
});
