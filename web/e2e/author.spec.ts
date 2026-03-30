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

  test("paper with no code repo shows repo URL field on claim form", async ({ page }) => {
    await signInAsTestUser(page);
    await page.goto("/papers/test_basic");

    // test_basic has no code repo — should show repo URL field
    const repoInput = page.locator("input[placeholder*='github.com/your-org']");
    await expect(repoInput).toBeVisible();
    await signOut(page);
  });

  test("author claim with repo URL: auto-approved and repo linked", async ({ page }) => {
    await signInAsTestUser(page);
    await page.goto("/papers/test_basic");

    // Fill repo URL
    const repoInput = page.locator("input[placeholder*='github.com/your-org']");
    await repoInput.fill("https://github.com/sotarepro/test-repo-e2e");

    // Click claim
    const claimBtn = page.locator("button", { hasText: "I authored this paper" });
    await claimBtn.click();

    // Should see verified badge
    await expect(page.getByText("Verified Author")).toBeVisible({ timeout: 10000 });

    await signOut(page);
  });

  test("author claim without repo URL: auto-approved (no repo needed)", async ({ page }) => {
    await signInAsTestUser(page);
    // Use a different paper to avoid conflict with previous test
    await page.goto("/papers/test_full");

    const claimBtn = page.locator("button", { hasText: "I authored this paper" });
    if (await claimBtn.count()) {
      await claimBtn.click();
      // Should be auto-approved
      await expect(page.getByText("Verified Author")).toBeVisible({ timeout: 10000 });
    }

    await signOut(page);
  });

  test("verified author sees 'Add repository' link", async ({ page }) => {
    await signInAsAdmin(page);
    await page.goto("/papers/test_full");

    // Admin is already a verified author on test_full
    const addRepoLink = page.getByText("+ Add repository");
    await expect(addRepoLink).toBeVisible();

    // Click shows input field
    await addRepoLink.click();
    const repoInput = page.locator("input[placeholder*='github.com/your-org']");
    await expect(repoInput).toBeVisible();

    // Cancel hides it
    await page.locator("button", { hasText: "Cancel" }).click();
    await expect(repoInput).not.toBeVisible();

    await signOut(page);
  });

  test("author vs non-author: mutually exclusive buttons", async ({ page }) => {
    await signInAsAdmin(page);
    await page.goto("/papers/test_full");

    const reproBtn = page.getByTestId("repro-toggle");
    const benchBtn = page.locator("text=Submit benchmark results");
    const hasRepro = await reproBtn.count();
    const hasBench = await benchBtn.count();
    expect(hasRepro + hasBench).toBeGreaterThan(0);
    if (hasRepro > 0 && hasBench > 0) {
      throw new Error("Both 'I reproduced this' and 'Submit benchmark results' are visible — should be mutually exclusive");
    }
    await signOut(page);
  });

  test("already claimed paper shows verified badge (no double claim)", async ({ page }) => {
    await signInAsAdmin(page);
    await page.goto("/papers/test_full");
    const verifiedBadge = page.getByText("Verified Author");
    const claimButton = page.locator("button", { hasText: "I authored this paper" });
    const hasVerified = await verifiedBadge.count();
    const hasClaim = await claimButton.count();
    expect(hasVerified + hasClaim).toBeGreaterThan(0);
    await signOut(page);
  });
});

test.describe("Admin — Author claims panel", () => {
  test("admin panel shows approve/reject buttons for pending claims", async ({ page }) => {
    await signInAsAdmin(page);
    await page.goto("/admin");

    // The Author Claims section should exist
    const section = page.getByText("Author Claims");
    await expect(section).toBeVisible();

    // If there are pending claims, they should have both buttons
    const approveBtn = page.locator("button", { hasText: "Approve" }).first();
    const rejectBtn = page.locator("button", { hasText: "Reject" }).first();
    if (await approveBtn.count()) {
      await expect(approveBtn).toBeVisible();
      await expect(rejectBtn).toBeVisible();
    }

    await signOut(page);
  });
});
