import { test, expect } from "@playwright/test";
import { signInAsTestUser, ensureTestData, signOut } from "./helpers/auth";

const BASE = "http://localhost:3000";

/**
 * Author claim should check ALL repos (not just official).
 * Papers with only community-linked repos should still allow claim attempts.
 */
test.describe("Author claim via non-official repos", () => {
  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    await ensureTestData(page);
    await page.close();
  });

  test("paper with code links does NOT say 'no linked code repository'", async ({ page }) => {
    await signInAsTestUser(page);

    // Use a real paper that has code links but not necessarily is_official=true
    // YOLOv11 has repos (Code Available badge)
    await page.goto("/papers/yolov11-an-overview-of-the-key-architectural");

    // Click claim button
    const claimBtn = page.locator("button", { hasText: "I authored this paper" });
    if (await claimBtn.count()) {
      await claimBtn.click();
      // Wait for the API response
      await page.waitForTimeout(5000);

      // Should NOT see "no linked code repository"
      const noRepoMsg = await page.getByText("no linked code repository").count();
      expect(noRepoMsg).toBe(0);

      // Should see either: verified, pending review, or contributor check message
      const responseMsg = page.getByText(/admin review|contributor|Verified Author/i);
      await expect(responseMsg.first()).toBeVisible();
    }

    await signOut(page);
  });

  test("paper with ZERO code links shows descriptive no-repo message", async ({ page }) => {
    await signInAsTestUser(page);
    await page.goto("/papers/test_basic");

    const claimBtn = page.locator("button", { hasText: "I authored this paper" });
    if (await claimBtn.count()) {
      await claimBtn.click();
      await page.waitForTimeout(3000);

      // Should see the no-repo message
      await expect(page.getByText(/no linked code repository/i).first()).toBeVisible();
    }

    await signOut(page);
  });
});
