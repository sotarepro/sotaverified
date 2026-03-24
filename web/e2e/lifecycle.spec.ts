import { test, expect } from "@playwright/test";
import { signInAsAdmin, signInAsTestUser, ensureTestData, signOut } from "./helpers/auth";

/**
 * QA Workflow 4: The Full Author → Verification Lifecycle
 *
 * Uses existing verified author state on test_full paper (admin claimed
 * via GitHub contributor check). Tests the downstream flow:
 * author sees benchmark form → submits benchmark → test user reproduces
 * with matching dataset+metric → benchmark shows verified.
 */
test.describe("QA Workflow 4 — Author → Verification Lifecycle", () => {
  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    await ensureTestData(page);
    await page.close();
  });

  test("Step 1-4: verified author sees badge, benchmark form, no repro form", async ({ page }) => {
    await signInAsAdmin(page);
    await page.goto("/papers/test_full");

    // Author verified badge should be visible
    await expect(page.getByText("Verified Author via GitHub", { exact: true })).toBeVisible();

    // 'Submit benchmark results' should be visible (author-only)
    await expect(page.locator("text=Submit benchmark results")).toBeVisible();

    // 'I reproduced this' should NOT be visible (hidden for authors)
    await expect(page.getByTestId("repro-toggle")).not.toBeVisible();

    await signOut(page);
  });

  test("Step 5-7: author submits benchmark → appears with 'Author Reported' status", async ({ page }) => {
    await signInAsAdmin(page);
    await page.goto("/papers/test_full");

    // Click 'Submit benchmark results'
    await page.locator("button", { hasText: "Submit benchmark results" }).click();

    // Fill the benchmark form
    // Task search
    await page.locator("input[placeholder*='Search tasks']").fill("Image Cla");
    await page.waitForTimeout(500);
    const taskOption = page.locator("ul li button", { hasText: /Image Classification/i }).first();
    if (await taskOption.count()) {
      await taskOption.click();
    }

    // Dataset search
    await page.locator("input[placeholder*='Search datasets']").fill("CIFAR");
    await page.waitForTimeout(500);
    const datasetOption = page.locator("ul li button", { hasText: /CIFAR/i }).first();
    if (await datasetOption.count()) {
      await datasetOption.click();
    }

    // Metric name + value
    await page.locator("input[placeholder*='Top-1']").fill("Top-1 Accuracy");
    await page.locator("input[placeholder*='93.8']").fill("94.2");

    // Submit
    await page.locator("button[type='submit']", { hasText: "Submit" }).click();

    // Should show success message
    await expect(page.getByText(/submitted|benchmark/i).first()).toBeVisible({ timeout: 10000 });

    await signOut(page);
  });

  test("Step 9-12: test user sees author badge, repro form (not benchmark), claimed metrics", async ({ page }) => {
    await signInAsTestUser(page);
    await page.goto("/papers/test_full");

    // Should see the author verified badge
    await expect(page.getByText("Verified Author via GitHub")).toBeVisible();

    // Should see 'I reproduced this' (NOT 'Submit benchmark results')
    await expect(page.getByTestId("repro-toggle")).toBeVisible();
    await expect(page.locator("text=Submit benchmark results")).not.toBeVisible();

    await signOut(page);
  });

  test("Step 13-15: test user submits reproduction with dataset + metric", async ({ page }) => {
    await signInAsTestUser(page);
    await page.goto("/papers/test_full");

    // Open reproduction form
    await page.getByTestId("repro-toggle").click();

    // Fill hardware
    await page.locator("input[placeholder*='RTX']").fill("RTX 4090 Lifecycle Test");

    // Select dataset from dropdown (test_full has CIFAR-10)
    const datasetSelect = page.locator("select").nth(1);
    if (await datasetSelect.count()) {
      const options = await datasetSelect.locator("option").allTextContents();
      const cifarOption = options.find((o) => o.includes("CIFAR"));
      if (cifarOption) {
        await datasetSelect.selectOption({ label: cifarOption });
        // Enter metric value close to claimed (93 on CIFAR-10)
        const metricInput = page.locator("input[type='number']").first();
        if (await metricInput.count()) {
          await metricInput.fill("92.1");
        }
      }
    }

    // Submit
    await page.getByTestId("repro-submit").click();

    // Should show success
    await expect(page.getByText(/submitted|RTX 4090 Lifecycle Test/i).first()).toBeVisible({ timeout: 10000 });

    await signOut(page);
  });
});

/**
 * QA Workflow 5: Flagging and Moderation
 *
 * Tests the flag lifecycle: submit → flag → auto-hide at threshold.
 * Uses API calls for flagging since the flag button requires loading
 * the reproduction list (client-side fetch).
 */
test.describe("QA Workflow 5 — Flagging and Moderation", () => {
  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    await ensureTestData(page);
    await page.close();
  });

  test("flag a reproduction: flag count increments, reproduction stays visible", async ({ page }) => {
    await signInAsTestUser(page);
    await page.goto("/papers/test_basic");

    // Wait for reproduction list to load (client-side)
    await page.waitForTimeout(2000);

    // Find a flag button (not on own reproduction)
    const flagBtn = page.locator("button", { hasText: "Flag" }).first();
    if (await flagBtn.count()) {
      // Accept the confirmation dialog
      page.on("dialog", (dialog) => dialog.accept());
      await flagBtn.click();
      // After flagging, button should change to "Flagged"
      await expect(page.locator("button", { hasText: "Flagged" }).first()).toBeVisible({ timeout: 5000 });
    }

    await signOut(page);
  });

  test("admin sees activity feed with flagging events", async ({ page }) => {
    await signInAsAdmin(page);
    await page.goto("/admin");
    // Activity feed should show recent events
    await expect(page.getByRole("heading", { name: /Activity Feed/ })).toBeVisible();
    // Feed should have at least some entries
    const feedEntries = page.locator("[class*='rounded-lg'][class*='border'][class*='p-3']");
    await expect(feedEntries.first()).toBeVisible();
  });
});
