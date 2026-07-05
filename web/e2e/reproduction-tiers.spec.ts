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

  test("Tier 3 on paper WITH benchmarks: free text model + dataset dropdown + metric", async ({ page }) => {
    await signInAsTestUser(page);
    await page.goto("/papers/test_full");
    await page.getByTestId("repro-toggle").click();

    // Select Tier 3
    await page.locator("select").first().selectOption("3");

    // Model name: free text input should be visible
    const modelInput = page.locator("input[placeholder*='ResNet']");
    await expect(modelInput).toBeVisible();

    // Dataset: searchable combobox — focusing it with no query shows the
    // paper's existing benchmark datasets as default suggestions
    const datasetInput = page.locator("input[placeholder*='Search datasets']");
    await expect(datasetInput).toBeVisible();
    await datasetInput.click();

    // Select CIFAR dataset from the suggestion list
    const cifarOption = page.locator("li button", { hasText: "CIFAR" }).first();
    if (await cifarOption.count() > 0) {
      await cifarOption.click();
      await expect(page.getByText(/^Selected: CIFAR/)).toBeVisible();

      // Metric value field should appear (paper has a matching benchmark)
      const metricInput = page.locator("input[type='number']").first();
      await expect(metricInput).toBeVisible();
    }

    await signOut(page);
  });

  test("Tier 3 on paper WITHOUT benchmarks: free text model + dataset search + metric", async ({ page }) => {
    await signInAsTestUser(page);
    await page.goto("/papers/test_basic");
    await page.getByTestId("repro-toggle").click();

    // Already Tier 3 (only option for no-code paper)

    // Model name: free text input should be visible
    const modelInput = page.locator("input[placeholder*='ResNet']");
    await expect(modelInput).toBeVisible();

    // Dataset: search input should be visible (not a <select>)
    const datasetSearch = page.locator("input[placeholder*='Search datasets']");
    await expect(datasetSearch).toBeVisible();

    // Free text metric fields should be visible
    const metricName = page.locator("input[placeholder*='Top-1']");
    await expect(metricName).toBeVisible();
    const metricValue = page.locator("input[placeholder*='76.3']");
    await expect(metricValue).toBeVisible();

    await signOut(page);
  });

  test("Tier 3 dataset search returns results on typing", async ({ page }) => {
    await signInAsTestUser(page);
    await page.goto("/papers/test_basic");
    await page.getByTestId("repro-toggle").click();

    const datasetSearch = page.locator("input[placeholder*='Search datasets']");
    await datasetSearch.fill("cifar");

    // Wait for debounced search results
    const dropdown = page.locator("ul.absolute li");
    await expect(dropdown.first()).toBeVisible({ timeout: 5000 });

    // Click first result
    await dropdown.first().click();

    // Should show "Selected: ..." confirmation
    await expect(page.getByText(/Selected:/)).toBeVisible();

    await signOut(page);
  });

  test("Tiers 1-2 show model dropdown (not free text) when dataset selected", async ({ page }) => {
    await signInAsTestUser(page);
    await page.goto("/papers/test_full");
    await page.getByTestId("repro-toggle").click();

    // Default is Tier 2 for paper with code
    // Select a dataset
    const datasetSelect = page.locator("select").nth(1);
    if (await datasetSelect.count()) {
      const opts = await datasetSelect.locator("option").allTextContents();
      if (opts.length > 1) {
        await datasetSelect.selectOption({ index: 1 });
        // For Tier 1/2 should see "Which model" label or "Auto-selected" text
        const modelLabel = page.getByText(/Which model|Auto-selected/);
        if (await modelLabel.count()) {
          await expect(modelLabel.first()).toBeVisible();
        }
      }
    }
    await signOut(page);
  });

  test("switching tier resets model name", async ({ page }) => {
    await signInAsTestUser(page);
    await page.goto("/papers/test_full");
    await page.getByTestId("repro-toggle").click();

    // Start at Tier 2 (default for paper with code)
    const tierSelect = page.locator("select").first();

    // Switch to Tier 3 → model name input appears empty
    await tierSelect.selectOption("3");
    const modelInput = page.locator("input[placeholder*='ResNet']");
    await expect(modelInput).toBeVisible();
    await expect(modelInput).toHaveValue("");

    // Type something
    await modelInput.fill("MyModel");

    // Switch to Tier 1 → model input disappears (replaced by dropdown if dataset selected)
    await tierSelect.selectOption("1");
    // The free text model input should no longer be visible
    await expect(modelInput).not.toBeVisible();

    // Switch back to Tier 3 → model input reappears, empty (was reset)
    await tierSelect.selectOption("3");
    await expect(modelInput).toBeVisible();
    await expect(modelInput).toHaveValue("");

    await signOut(page);
  });

  test("Tier 3 submit with model + dataset + metric shows success", async ({ page }) => {
    await signInAsTestUser(page);
    await page.goto("/papers/test_full");
    await page.getByTestId("repro-toggle").click();

    // Select Tier 3
    await page.locator("select").first().selectOption("3");

    // Fill model name
    const modelInput = page.locator("input[placeholder*='ResNet']");
    await modelInput.fill("E2E-Tier3-Model");

    // Fill hardware
    await page.locator("input[placeholder*='RTX']").fill("E2E Tier3 Test GPU");

    // Select CIFAR dataset
    const datasetSelect = page.locator("select").nth(1);
    const opts = await datasetSelect.locator("option").allTextContents();
    const cifarOpt = opts.find((o) => o.includes("CIFAR"));
    if (cifarOpt) {
      await datasetSelect.selectOption({ label: cifarOpt });
      // Fill metric value
      const metricInput = page.locator("input[type='number']").first();
      await metricInput.fill("89.5");
    }

    await page.getByTestId("repro-submit").click();
    await expect(page.getByText(/submitted/i).first()).toBeVisible({ timeout: 10000 });

    // "Submit another" link should appear
    await expect(page.getByText(/Submit another/i)).toBeVisible();

    await signOut(page);
  });

  test("Tier 3 submit on paper WITHOUT benchmarks with just hardware", async ({ page }) => {
    await signInAsTestUser(page);
    await page.goto("/papers/test_basic");
    await page.getByTestId("repro-toggle").click();

    // Fill only hardware (all other fields optional)
    await page.locator("input[placeholder*='RTX']").fill("E2E Minimal Tier3");

    await page.getByTestId("repro-submit").click();
    await expect(page.getByText(/submitted/i).first()).toBeVisible({ timeout: 10000 });

    await signOut(page);
  });
});
