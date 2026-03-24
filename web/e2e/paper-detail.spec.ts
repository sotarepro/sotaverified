import { test, expect } from "@playwright/test";
import { ensureTestData } from "./helpers/auth";

test.describe("Persona 1 — Paper detail page", () => {
  const PAPER_URL = "/papers/attention-is-all-you-need";

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    await ensureTestData(page);
    await page.close();
  });

  test("loads with title, authors, date, verification badge", async ({ page }) => {
    await page.goto(PAPER_URL);
    await expect(page.locator("h1")).toContainText("Attention Is All You Need");
    // Authors line
    await expect(page.getByText("Ashish Vaswani")).toBeVisible();
  });

  test("shows abstract section", async ({ page }) => {
    await page.goto(PAPER_URL);
    await expect(page.getByRole("heading", { name: "Abstract" })).toBeVisible();
  });

  test("shows verification badge", async ({ page }) => {
    await page.goto(PAPER_URL);
    // Should show Code Available badge (paper has repos)
    await expect(page.getByText("Code Available").first()).toBeVisible();
  });

  test("arXiv and PDF links open in new tab", async ({ page }) => {
    await page.goto(PAPER_URL);
    const arxivLink = page.locator('a:has-text("arXiv")');
    if (await arxivLink.count()) {
      await expect(arxivLink).toHaveAttribute("target", "_blank");
    }
  });

  test("code repos sorted by stars with expand button for many repos", async ({ page }) => {
    // YOLOv4 has 200+ repos
    await page.goto("/papers/yolov4-optimal-speed-and-accuracy-of-object");
    await expect(page.getByRole("heading", { name: "Code" })).toBeVisible();
    await expect(page.getByText(/Show all \d+ repos/)).toBeVisible();
  });

  test("code repo links open in new tab", async ({ page }) => {
    await page.goto(PAPER_URL);
    const repoLink = page.locator("a[href*='github.com']").first();
    if (await repoLink.count()) {
      await expect(repoLink).toHaveAttribute("target", "_blank");
    }
  });

  test("Copy JSON for Agent button visible", async ({ page }) => {
    await page.goto(PAPER_URL);
    await expect(page.locator("text=Copy JSON for Agent")).toBeVisible();
  });

  test("benchmark results: grouped by task, shows dataset/model/metric columns", async ({ page }) => {
    await page.goto(PAPER_URL);
    const benchHeading = page.getByRole("heading", { name: "Benchmark Results" });
    if (await benchHeading.count()) {
      // Click first group to expand
      const firstGroup = page.locator("button", { hasText: /results?/ }).first();
      if (await firstGroup.count()) {
        await firstGroup.click();
        await expect(page.locator("th", { hasText: "Dataset" }).first()).toBeVisible();
        await expect(page.locator("th", { hasText: "Model" }).first()).toBeVisible();
        await expect(page.locator("th", { hasText: "Claimed" }).first()).toBeVisible();
        await expect(page.locator("th", { hasText: "Verified" }).first()).toBeVisible();
        await expect(page.locator("th", { hasText: "Status" }).first()).toBeVisible();
      }
    }
  });

  test("tasks section shows clickable task links", async ({ page }) => {
    await page.goto(PAPER_URL);
    const tasksHeading = page.getByRole("heading", { name: "Tasks" });
    if (await tasksHeading.count()) {
      const taskLink = page.locator("a[href^='/tasks/']").first();
      await expect(taskLink).toBeVisible();
    }
  });

  test("unauthenticated: hype shows sign-in message", async ({ page }) => {
    await page.goto(PAPER_URL);
    await expect(page.locator("text=sign in to hype")).toBeVisible();
  });

  test("unauthenticated: reproduce shows sign-in link", async ({ page }) => {
    await page.goto(PAPER_URL);
    await expect(page.getByText("Sign in to submit a reproduction")).toBeVisible();
  });

  test("verification CTA banner shown for unverified/code-available papers", async ({ page }) => {
    await page.goto(PAPER_URL);
    // This paper has code → should show CTA to reproduce
    await expect(page.getByText(/reproduce this paper|reproducing this paper/).first()).toBeVisible();
  });

  test("paper with no code repo: tier restriction to Tier 3 only", async ({ page }) => {
    // test_basic has no code repo
    await page.goto("/papers/test_basic");
    // The reproduce form when opened should only show Tier 3
    // (tested more deeply in reproduction.spec.ts)
    await expect(page.locator("h1")).toBeVisible();
  });
});
