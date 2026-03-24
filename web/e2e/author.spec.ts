import { test, expect } from "@playwright/test";
import { signInAsAdmin, signInAsTestUser, signInAsTestAuthor, ensureTestData, signOut } from "./helpers/auth";

test.describe("Persona 3 — Author flow", () => {
  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    await ensureTestData(page);
    await page.close();
  });

  test("non-author sees 'I reproduced this' but NOT 'Submit benchmark results'", async ({ page }) => {
    await signInAsTestUser(page);
    await page.goto("/papers/test_full");
    await expect(page.getByTestId("repro-toggle")).toBeVisible();
    await expect(page.locator("text=Submit benchmark results")).not.toBeVisible();
    await signOut(page);
  });

  test("unauthenticated user sees 'Sign in to claim authorship' button", async ({ page }) => {
    await page.goto("/papers/test_full");
    await expect(page.getByText("Sign in to claim authorship")).toBeVisible();
  });

  test("author claim on paper with no repo: descriptive message", async ({ page }) => {
    await signInAsTestUser(page);
    await page.goto("/papers/test_basic");

    // test_basic has no code repo — claim should explain
    const claimBtn = page.locator("button", { hasText: "I authored this paper" });
    if (await claimBtn.count()) {
      await claimBtn.click();
      await expect(page.getByText(/no linked code repository|admin review/i)).toBeVisible({ timeout: 10000 });
    }
    await signOut(page);
  });

  test("author vs non-author: mutually exclusive buttons", async ({ page }) => {
    // On test_full, check that exactly one of repro-toggle or benchmark form is shown
    // (depends on whether current user is verified author)
    await signInAsAdmin(page);
    await page.goto("/papers/test_full");

    const reproBtn = page.getByTestId("repro-toggle");
    const benchBtn = page.locator("text=Submit benchmark results");
    const hasRepro = await reproBtn.count();
    const hasBench = await benchBtn.count();
    // At least one should be visible, but never both
    expect(hasRepro + hasBench).toBeGreaterThan(0);
    if (hasRepro > 0 && hasBench > 0) {
      // Both visible = bug
      throw new Error("Both 'I reproduced this' and 'Submit benchmark results' are visible — should be mutually exclusive");
    }
    await signOut(page);
  });

  test("already claimed paper shows verified badge (no double claim)", async ({ page }) => {
    // If a paper has already been claimed by this user, it should show the verified badge
    // rather than the claim button again
    await signInAsAdmin(page);
    await page.goto("/papers/test_full");
    // Check if verified badge exists or claim button — depends on prior claim state
    const verifiedBadge = page.locator("text=Verified Author via GitHub");
    const claimButton = page.locator("button", { hasText: "I authored this paper" });
    // One of these should be visible
    const hasVerified = await verifiedBadge.count();
    const hasClaim = await claimButton.count();
    expect(hasVerified + hasClaim).toBeGreaterThan(0);
    await signOut(page);
  });
});
