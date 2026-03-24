import { test, expect } from "@playwright/test";
import { signInAsTestUser, ensureTestData, signOut } from "./helpers/auth";

test.describe("Persona 2 — Hype flow", () => {
  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    await ensureTestData(page);
    await page.close();
  });

  test("hype toggle: heart state and count toggle correctly", async ({ page }) => {
    await signInAsTestUser(page);
    await page.goto("/");

    const firstHypeBtn = page.locator("[data-testid^='hype-btn-']").first();
    await expect(firstHypeBtn).toBeVisible();

    const paperId = (await firstHypeBtn.getAttribute("data-testid"))!.replace("hype-btn-", "");
    const countEl = page.getByTestId(`hype-count-${paperId}`);
    const initialHyped = (await firstHypeBtn.getAttribute("data-hyped")) === "true";
    const initialCount = parseInt(await countEl.textContent() ?? "0");

    // Toggle on
    await firstHypeBtn.click();
    await expect(firstHypeBtn).toHaveAttribute("data-hyped", String(!initialHyped));
    const expectedCount = initialHyped ? initialCount - 1 : initialCount + 1;
    await expect(countEl).toHaveText(String(expectedCount));

    // Wait for server round-trip to complete before toggling back
    await page.waitForTimeout(1000);

    // Toggle off to restore
    await firstHypeBtn.click();
    await expect(firstHypeBtn).toHaveAttribute("data-hyped", String(initialHyped), { timeout: 5000 });
    await expect(countEl).toHaveText(String(initialCount));

    await signOut(page);
  });

  test("hype count consistent between table and paper detail", async ({ page }) => {
    await signInAsTestUser(page);
    await page.goto("/");

    const firstHypeBtn = page.locator("[data-testid^='hype-btn-']").first();
    const paperId = (await firstHypeBtn.getAttribute("data-testid"))!.replace("hype-btn-", "");
    const countEl = page.getByTestId(`hype-count-${paperId}`);

    // Toggle to a known state
    const wasHyped = (await firstHypeBtn.getAttribute("data-hyped")) === "true";
    if (!wasHyped) {
      await firstHypeBtn.click();
      await expect(firstHypeBtn).toHaveAttribute("data-hyped", "true");
    }
    const tableCount = await countEl.textContent();

    // Navigate to detail page — count should match
    await page.waitForTimeout(500);
    await page.goto(`/papers/${paperId}`);
    const detailCount = page.getByTestId("detail-hype-count");
    await expect(detailCount).toHaveText(tableCount!);

    // Restore: unhype
    if (!wasHyped) {
      const detailBtn = page.getByTestId("detail-hype-btn");
      await detailBtn.click();
    }

    await signOut(page);
  });

  test("unauthenticated user cannot hype (API returns 401)", async ({ page }) => {
    const res = await page.request.post("http://localhost:3000/api/upvotes", {
      data: { paper_id: "attention-is-all-you-need" },
    });
    expect(res.status()).toBe(401);
  });

  test("cannot double-hype same paper (unique constraint)", async ({ page }) => {
    await signInAsTestUser(page);
    await page.goto("/");

    const btn = page.locator("[data-testid^='hype-btn-']").first();
    const paperId = (await btn.getAttribute("data-testid"))!.replace("hype-btn-", "");
    const countEl = page.getByTestId(`hype-count-${paperId}`);

    const initialCount = parseInt(await countEl.textContent() ?? "0");
    const initialHyped = (await btn.getAttribute("data-hyped")) === "true";

    // Rapid double-click
    await btn.click();
    await btn.click();
    // After two clicks, should be back to initial state (toggle on then off)
    await page.waitForTimeout(1000);
    await expect(btn).toHaveAttribute("data-hyped", String(initialHyped));

    await signOut(page);
  });
});
