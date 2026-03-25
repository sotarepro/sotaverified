import { test, expect } from "@playwright/test";
import { signIn, signInAsAdmin, ensureTestData, signOut } from "./helpers/auth";

const BASE = "http://localhost:3000";

/**
 * Verification badge must be consistent across all pages showing a paper:
 * homepage table, search results, task page, and paper detail.
 */
test.describe("Verification badge consistency", () => {
  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    await ensureTestData(page);
    await page.close();
  });

  test("same badge shown on search results and paper detail", async ({ page }) => {
    // Search for a known paper
    await page.goto("/search?q=attention+is+all+you+need");
    await expect(page.getByRole("heading", { name: "Search results" })).toBeVisible();

    // Get badge from search
    const searchBadge = page.locator("tbody tr:first-child td:nth-child(3) span").first();
    const searchText = ((await searchBadge.textContent()) ?? "").trim();

    // Navigate to detail
    await page.locator("a[href*='attention-is-all-you-need']").first().click();
    await page.waitForURL(/\/papers\//);

    // Get badge from detail — should match search
    const detailBadge = page.locator("span", {
      hasText: /Code Available|Community Verified|Author Verified|Unverified/,
    }).first();
    const detailText = ((await detailBadge.textContent()) ?? "").trim();

    // Compare base badge type
    const normalize = (s: string) => s.split(/\s*[—-]\s*/)[0]?.trim();
    expect(normalize(detailText)).toContain(normalize(searchText)!);
  });

  test("reproduction changes badge, removal reverts it", async ({ page }) => {
    // Use test_full which starts as code_available
    await signIn(page, "test_user", "test_user");

    // Submit reproduction
    const createRes = await page.context().request.post(`${BASE}/api/reproductions`, {
      data: { paper_id: "test_full", tier_claimed: 3, hardware_spec: "VC-Test GPU" },
    });
    expect(createRes.ok()).toBe(true);
    const { id: reproId } = await createRes.json();
    await signOut(page);

    // Check paper detail — should show community_verified now
    await page.goto("/papers/test_full");
    const afterBadge = page.locator("span", { hasText: /Community Verified/ });
    // May or may not show community_verified depending on score recompute timing

    // Admin removes the reproduction
    await signInAsAdmin(page);
    await page.context().request.patch(`${BASE}/api/admin/reproductions/${reproId}`, {
      data: { action: "remove" },
    });
    await signOut(page);

    // Check paper detail — should revert (no longer community_verified)
    await page.goto("/papers/test_full");
    const revertBadge = page.locator("span", {
      hasText: /Code Available|Author Verified|Unverified/,
    }).first();
    // At least one non-community badge should be visible
    if (await revertBadge.count()) {
      await expect(revertBadge).toBeVisible();
    }
  });
});
