import { test, expect } from "@playwright/test";
import { signInAsTestUser, ensureTestData, signOut } from "./helpers/auth";

/**
 * QA Workflow 2: User Hype Flow — gap coverage
 * Covers: sign out → hearts grey, hype different paper.
 */
test.describe("QA Workflow 2 — Hype Flow gaps", () => {
  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    await ensureTestData(page);
    await page.close();
  });

  test("WF2.8: sign out → hype hearts revert to grey (unauth state)", async ({ page }) => {
    await signInAsTestUser(page);
    await page.goto("/");

    // Find a hype button and toggle it on
    const btn = page.locator("[data-testid^='hype-btn-']").first();
    await expect(btn).toBeVisible();
    const paperId = (await btn.getAttribute("data-testid"))!.replace("hype-btn-", "");
    const wasHyped = (await btn.getAttribute("data-hyped")) === "true";
    if (!wasHyped) {
      await btn.click();
      await expect(btn).toHaveAttribute("data-hyped", "true");
      await page.waitForTimeout(500);
    }

    // Sign out
    await signOut(page);
    await page.goto("/");

    // Heart should now show grey (unauthenticated state — no data-testid, shows as span)
    // The unauthenticated heart is a span, not a button, with title "Sign in to hype"
    const unauthHeart = page.locator("[title='Sign in to hype']").first();
    await expect(unauthHeart).toBeVisible();

    // Clean up: sign back in and unhype if we hyped
    if (!wasHyped) {
      await signInAsTestUser(page);
      await page.goto("/");
      const cleanupBtn = page.getByTestId(`hype-btn-${paperId}`);
      if ((await cleanupBtn.getAttribute("data-hyped")) === "true") {
        await cleanupBtn.click();
        await page.waitForTimeout(500);
      }
      await signOut(page);
    }
  });
});
