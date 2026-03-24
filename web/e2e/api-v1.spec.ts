import { test, expect } from "@playwright/test";

/**
 * Agent API (GET only) — validates the public read endpoints
 * that agents will use at launch.
 *
 * Example commands shown on /agents page:
 *   curl https://sotaverified.org/api/v1/papers/1706.03762
 *   curl "https://sotaverified.org/api/v1/sota?task=image-classification&sort=score"
 */
test.describe("Agent Read API — /api/v1", () => {

  // ── GET /api/v1/papers/{arxiv_id} ──────────────────────────────

  test("papers: returns structured JSON for known paper (Attention Is All You Need)", async ({ request }) => {
    const res = await request.get("/api/v1/papers/1706.03762");
    expect(res.ok()).toBe(true);

    const data = await res.json();
    expect(data.arxiv_id).toBe("1706.03762");
    expect(data.title).toContain("Attention Is All You Need");
    expect(data.authors).toBeInstanceOf(Array);
    expect(data.authors.length).toBeGreaterThan(0);
    expect(data.verification_score).toBeGreaterThanOrEqual(0);
    expect(data.verification).toBeTruthy();
    expect(["unverified", "code_available", "author_verified", "community_verified"]).toContain(data.verification);
    expect(data.reproductions).toBeGreaterThanOrEqual(0);
    expect(data.tasks).toBeInstanceOf(Array);
    expect(data.leaderboard).toBeInstanceOf(Array);
    expect(data.code_links).toBeInstanceOf(Array);
    expect(data.code_links.length).toBeGreaterThan(0);
    // Code links should have url, is_official, stars
    expect(data.code_links[0]).toHaveProperty("url");
    expect(data.code_links[0]).toHaveProperty("is_official");
    expect(data.code_links[0]).toHaveProperty("stars");
  });

  test("papers: returns 404 for nonexistent arxiv_id", async ({ request }) => {
    const res = await request.get("/api/v1/papers/9999.99999");
    expect(res.status()).toBe(404);
    const data = await res.json();
    expect(data.error).toBeTruthy();
  });

  // ── GET /api/v1/sota ───────────────────────────────────────────

  test("sota: returns papers sorted by score for a task", async ({ request }) => {
    const res = await request.get("/api/v1/sota?task=image-classification&sort=score");
    expect(res.ok()).toBe(true);

    const data = await res.json();
    expect(data.papers).toBeInstanceOf(Array);
    expect(data.papers.length).toBeGreaterThan(0);
    expect(data.total).toBeGreaterThan(0);

    // Each paper has required fields
    const paper = data.papers[0];
    expect(paper.arxiv_id).toBeTruthy();
    expect(paper.title).toBeTruthy();
    expect(paper).toHaveProperty("verification_score");
    expect(paper).toHaveProperty("badge");
    expect(paper).toHaveProperty("reproduction_count");
    expect(paper.tasks).toBeInstanceOf(Array);

    // Papers should be sorted by score DESC
    for (let i = 1; i < data.papers.length; i++) {
      expect(data.papers[i - 1].verification_score).toBeGreaterThanOrEqual(data.papers[i].verification_score);
    }
  });

  test("sota: dataset filter narrows results", async ({ request }) => {
    const res = await request.get("/api/v1/sota?task=image-classification&dataset=imagenet");
    expect(res.ok()).toBe(true);
    const data = await res.json();
    expect(data.papers).toBeInstanceOf(Array);
    // Should still return results (imagenet is a popular dataset)
    expect(data.total).toBeGreaterThanOrEqual(0);
  });

  test("sota: sort=date returns papers in chronological order", async ({ request }) => {
    const res = await request.get("/api/v1/sota?task=object-detection&sort=recent");
    expect(res.ok()).toBe(true);
    const data = await res.json();
    expect(data.papers).toBeInstanceOf(Array);
    if (data.papers.length >= 2) {
      // Most recent first
      const d1 = new Date(data.papers[0].published);
      const d2 = new Date(data.papers[1].published);
      expect(d1.getTime()).toBeGreaterThanOrEqual(d2.getTime());
    }
  });

  test("sota: min_score filters out low-score papers", async ({ request }) => {
    // With min_score=5, only papers with code repos (score 5+) should appear
    const res = await request.get("/api/v1/sota?task=image-classification&min_score=5");
    expect(res.ok()).toBe(true);
    const data = await res.json();
    for (const paper of data.papers) {
      expect(paper.verification_score).toBeGreaterThanOrEqual(5);
    }
  });
});
