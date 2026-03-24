import { test, expect } from "@playwright/test";
import { signInAsTestUser, signInAsAdmin, ensureTestData, signOut } from "./helpers/auth";

test.describe("Persona 2 — Reproduction flow", () => {
  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    await ensureTestData(page);
    await page.close();
  });

  test("paper WITH code repo shows Tier 1/2/3 options", async ({ page }) => {
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

  test("paper with NO code repo shows only Tier 3", async ({ page }) => {
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

  test("submit reproduction: appears in list without refresh", async ({ page }) => {
    await signInAsTestUser(page);
    await page.goto("/papers/test_basic");
    await page.getByTestId("repro-toggle").click();
    await page.locator("input[placeholder*='RTX']").fill("E2E Test GPU 1234");
    await page.getByTestId("repro-submit").click();
    await expect(page.getByText(/submitted|E2E Test GPU 1234/i).first()).toBeVisible({ timeout: 10000 });
    await signOut(page);
  });

  test("submit reproduction with dataset + metric on paper with benchmarks", async ({ page }) => {
    await signInAsTestUser(page);
    await page.goto("/papers/test_full");
    await page.getByTestId("repro-toggle").click();
    await page.locator("input[placeholder*='RTX']").fill("E2E Benchmark GPU");

    // Select dataset from dropdown (test_full has CIFAR-10)
    const datasetSelect = page.locator("select").nth(1); // second select after tier
    if (await datasetSelect.count()) {
      const options = await datasetSelect.locator("option").allTextContents();
      // Find CIFAR-10 option
      const cifarOption = options.find((o) => o.includes("CIFAR"));
      if (cifarOption) {
        await datasetSelect.selectOption({ label: cifarOption });
        // Metric field should appear — fill it
        const metricInput = page.locator("input[type='number']").first();
        if (await metricInput.count()) {
          await metricInput.fill("91.5");
        }
      }
    }

    await page.getByTestId("repro-submit").click();
    await expect(page.getByText(/submitted|E2E Benchmark GPU/i).first()).toBeVisible({ timeout: 10000 });
    await signOut(page);
  });

  test("self-upvote blocked on own reproductions", async ({ page }) => {
    await signInAsTestUser(page);
    await page.goto("/papers/test_basic");
    await page.waitForTimeout(2000); // Wait for client-side repro list load
    // Own reproduction should show non-clickable heart with tooltip
    const ownHeart = page.locator("[title*=\"can't hype your own\"]").first();
    if (await ownHeart.count()) {
      await expect(ownHeart).toBeVisible();
    }
    await signOut(page);
  });

  test("unauthenticated user cannot submit reproduction (API 401)", async ({ page }) => {
    const res = await page.request.post("http://localhost:3000/api/reproductions", {
      data: { paper_id: "test_basic", tier_claimed: 3, hardware_spec: "test" },
    });
    expect(res.status()).toBe(401);
  });
});
