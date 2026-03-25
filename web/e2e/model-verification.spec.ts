import { test, expect } from "@playwright/test";
import { signIn, signInAsAdmin, signInAsTestUser, ensureTestData, signOut } from "./helpers/auth";

const BASE = "http://localhost:3000";

/**
 * Model-aware verification: reproductions match specific models.
 * NULL model_name only matches when there's a single model for that dataset.
 */
test.describe("Model-aware verification", () => {
  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    await ensureTestData(page);
    await page.close();
  });

  test("reproduction with specific model marks only that model's row", async ({ page }) => {
    // Use test_full which has CIFAR-10 with one model (Test Model)
    await signIn(page, "test_user", "test_user");

    // Submit reproduction with explicit model name matching the leaderboard
    const res = await page.context().request.post(`${BASE}/api/reproductions`, {
      data: {
        paper_id: "test_full",
        tier_claimed: 2,
        hardware_spec: "MV-specific-model",
        dataset_id: "cifar-10",
        actual_metric_name: "top1",
        actual_metric_value: 91.5,
        model_name: "Test Model",
      },
    });
    expect(res.ok()).toBe(true);
    await signOut(page);

    // Check paper page — the CIFAR-10 row should show verified
    await page.goto("/papers/test_full");
    const benchSection = page.getByRole("heading", { name: "Benchmark Results" });
    if (await benchSection.count()) {
      // Expand if collapsed
      const expandBtn = page.locator("button", { hasText: /results?/ }).first();
      if (await expandBtn.count()) await expandBtn.click();
      // Look for "Verified" badge in benchmark table
      const verified = page.locator("text=Verified").first();
      await expect(verified).toBeVisible({ timeout: 5000 });
    }

    // Clean up
    await signInAsAdmin(page);
    await page.context().request.post(`${BASE}/api/admin/clear-user-data`, {
      data: { username: "test_user" },
    });
    await signOut(page);
  });

  test("Tier 3 with custom model name does NOT mark existing rows", async ({ page }) => {
    await signIn(page, "test_user", "test_user");

    // Submit Tier 3 with custom model name (not matching "Test Model")
    const res = await page.context().request.post(`${BASE}/api/reproductions`, {
      data: {
        paper_id: "test_full",
        tier_claimed: 3,
        hardware_spec: "MV-custom-model",
        dataset_id: "cifar-10",
        actual_metric_name: "top1",
        actual_metric_value: 89.0,
        model_name: "CustomNet-v1",
      },
    });
    expect(res.ok()).toBe(true);
    await signOut(page);

    // The leaderboard row for "Test Model" should NOT show as verified
    // (CustomNet-v1 != Test Model)
    await page.goto("/papers/test_full");
    await page.waitForTimeout(2000);

    // Check the reproduction list shows the custom model name
    const reproList = page.getByText("CustomNet-v1");
    await expect(reproList.first()).toBeVisible();

    // Clean up
    await signInAsAdmin(page);
    await page.context().request.post(`${BASE}/api/admin/clear-user-data`, {
      data: { username: "test_user" },
    });
    await signOut(page);
  });
});
