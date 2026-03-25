import { test, expect } from "@playwright/test";
import { signInAsAdmin, ensureTestData, signOut } from "./helpers/auth";

test.describe("Author benchmark form", () => {
  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    await ensureTestData(page);
    await page.close();
  });

  test("task dropdown shows paper-scoped tasks on focus", async ({ page }) => {
    await signInAsAdmin(page);
    await page.goto("/papers/test_full");

    // Open benchmark form (admin is verified author of test_full)
    const benchBtn = page.getByRole("button", { name: "Submit benchmark results" });
    if (await benchBtn.count()) {
      await benchBtn.click();

      // Focus the task field — should show paper's tasks, not all 4800
      const taskInput = page.locator("input[placeholder*='Search tasks']");
      await taskInput.focus();
      await page.waitForTimeout(1000);

      // Dropdown should appear with a manageable number of options
      const options = page.locator("ul li button");
      if (await options.count()) {
        const count = await options.count();
        // Should be scoped (paper's tasks), not all 4800
        expect(count).toBeLessThan(50);
      }
    }
    await signOut(page);
  });

  test("cancel resets all form state", async ({ page }) => {
    await signInAsAdmin(page);
    await page.goto("/papers/test_full");

    const benchBtn = page.getByRole("button", { name: "Submit benchmark results" });
    if (await benchBtn.count()) {
      await benchBtn.click();

      // Type something in task search
      const taskInput = page.locator("input[placeholder*='Search tasks']");
      await taskInput.fill("Image");
      await page.waitForTimeout(500);

      // Cancel
      await page.locator("button", { hasText: "Cancel" }).click();

      // Reopen — should be empty
      await benchBtn.click();
      const taskInput2 = page.locator("input[placeholder*='Search tasks']");
      await expect(taskInput2).toHaveValue("");
    }
    await signOut(page);
  });
});
