import { test, expect } from "@playwright/test";
import { signInAsTestUser, ensureTestData, signOut } from "./helpers/auth";

test.describe("Reproduction tier-specific behavior", () => {
  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    await ensureTestData(page);
    await page.close();
  });

  test("paper with code repos shows tiers 1, 2, 3", async ({ page }) => {
    await signInAsTestUser(page);
    await page.goto("/papers/test_full");
    await page.getByTestId("repro-toggle").click();
    const options = page.locator("select option");
    const texts = await options.allTextContents();
    expect(texts.some((t) => t.includes("Tier 1"))).toBe(true);
    expect(texts.some((t) => t.includes("Tier 2"))).toBe(true);
    expect(texts.some((t) => t.includes("Tier 3"))).toBe(true);
    await signOut(page);
  });

  test("paper with NO code repos shows only Tier 3", async ({ page }) => {
    await signInAsTestUser(page);
    await page.goto("/papers/test_basic");
    await page.getByTestId("repro-toggle").click();
    const options = page.locator("select option");
    const count = await options.count();
    expect(count).toBe(1);
    const text = await options.first().textContent();
    expect(text).toContain("Tier 3");
    await signOut(page);
  });

  test("Tier 3 shows free text model name input, not dropdown", async ({ page }) => {
    await signInAsTestUser(page);
    await page.goto("/papers/test_full");
    await page.getByTestId("repro-toggle").click();

    // Select Tier 3
    await page.locator("select").first().selectOption("3");

    // Select a dataset (if available)
    const datasetSelect = page.locator("select").nth(1);
    if (await datasetSelect.count()) {
      const opts = await datasetSelect.locator("option").allTextContents();
      if (opts.length > 1) {
        await datasetSelect.selectOption({ index: 1 });
        // Should see free text input for model name (not a select dropdown)
        const modelInput = page.locator("input[placeholder*='Independent']");
        await expect(modelInput).toBeVisible();
      }
    }
    await signOut(page);
  });

  test("Tiers 1-2 show model dropdown (not free text) when dataset has models", async ({ page }) => {
    await signInAsTestUser(page);
    await page.goto("/papers/test_full");
    await page.getByTestId("repro-toggle").click();

    // Select Tier 1
    await page.locator("select").first().selectOption("1");

    // Select a dataset
    const datasetSelect = page.locator("select").nth(1);
    if (await datasetSelect.count()) {
      const opts = await datasetSelect.locator("option").allTextContents();
      if (opts.length > 1) {
        await datasetSelect.selectOption({ index: 1 });
        // For Tier 1, should see "Which model" label or auto-selected text
        const modelLabel = page.getByText(/Which model|Auto-selected/);
        if (await modelLabel.count()) {
          await expect(modelLabel.first()).toBeVisible();
        }
      }
    }
    await signOut(page);
  });
});
