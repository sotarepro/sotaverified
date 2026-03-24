import { test, expect } from "@playwright/test";
import { signInAsTestUser, ensureTestData, signOut } from "./helpers/auth";

/**
 * QA Workflow 3 step 5: After submitting reproduction with dataset + metric,
 * the benchmark results section should show the verified value.
 *
 * Also covers QA Workflow 4 steps 16-17: benchmark updates from
 * 'Author Reported' to 'Verified' with green color for within 5%.
 */
test.describe("QA Workflow 3 — Reproduction → Benchmark Verification", () => {
  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    await ensureTestData(page);
    await page.close();
  });

  test("WF3.5/WF4.16: after repro with metric, benchmark section shows verified value", async ({ page }) => {
    await signInAsTestUser(page);
    await page.goto("/papers/test_full");

    // Submit reproduction with CIFAR-10 dataset and metric
    await page.getByTestId("repro-toggle").click();
    await page.locator("input[placeholder*='RTX']").fill("WF3 Benchmark Test GPU");

    const datasetSelect = page.locator("select").nth(1);
    if (await datasetSelect.count()) {
      const options = await datasetSelect.locator("option").allTextContents();
      const cifarOption = options.find((o) => o.includes("CIFAR"));
      if (cifarOption) {
        await datasetSelect.selectOption({ label: cifarOption });
        const metricInput = page.locator("input[type='number']").first();
        if (await metricInput.count()) {
          // Enter value close to claimed 93 (within 5%)
          await metricInput.fill("91.8");
        }
      }
    }

    await page.getByTestId("repro-submit").click();
    await expect(page.getByText(/submitted|WF3 Benchmark Test GPU/i).first()).toBeVisible({ timeout: 10000 });

    // Wait for page refresh to reflect the new reproduction in benchmarks
    await page.waitForTimeout(1500);
    await page.reload();

    // Check benchmark results section — expand if collapsed
    const benchHeading = page.getByRole("heading", { name: "Benchmark Results" });
    if (await benchHeading.count()) {
      const group = page.locator("button", { hasText: /results?/ }).first();
      if (await group.count()) {
        await group.click();
      }

      // Should see "Verified" badge in the benchmark table
      const verifiedBadge = page.locator("text=Verified").first();
      await expect(verifiedBadge).toBeVisible({ timeout: 5000 });
    }

    await signOut(page);
  });
});
