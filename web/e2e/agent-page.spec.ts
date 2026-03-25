import { test, expect } from "@playwright/test";

test.describe("Agent page — read vs write access clarity", () => {
  test("read endpoints shown as open, no key required", async ({ page }) => {
    await page.goto("/agents");
    await expect(page.getByText("Read endpoints").first()).toBeVisible();
    await expect(page.getByText(/No API key required/i).first()).toBeVisible();
  });

  test("write endpoint shown as closed beta", async ({ page }) => {
    await page.goto("/agents");
    await expect(page.getByText("Write endpoint").first()).toBeVisible();
    await expect(page.getByText(/closed beta/i).first()).toBeVisible();
  });

  test("GET /api/v1/papers works without auth (open read)", async ({ request }) => {
    const res = await request.get("/api/v1/papers/1706.03762");
    expect(res.ok()).toBe(true);
    const data = await res.json();
    expect(data.arxiv_id).toBe("1706.03762");
  });

  test("POST /api/v1/reproductions without auth returns 401", async ({ request }) => {
    const res = await request.post("/api/v1/reproductions", {
      data: { paper_id: "test", tier_claimed: 1, hardware_spec: "test" },
    });
    expect(res.status()).toBe(401);
  });
});
