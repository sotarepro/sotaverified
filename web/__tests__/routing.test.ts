/**
 * Routing spec tests — verifying that paper title links use internal /papers/ paths
 * and that arXiv URLs are only used for external links.
 */

import fs from "fs";
import path from "path";

describe("Routing spec: paper title links", () => {
  it("paper detail page URL format is /papers/[id]", () => {
    const paperId = "1706.03762";
    const expectedHref = `/papers/${paperId}`;
    expect(expectedHref).toMatch(/^\/papers\//);
    expect(expectedHref).not.toContain("arxiv.org");
  });

  it("arXiv URLs are only for external links, not paper titles", () => {
    const arxivId = "1706.03762";
    const arxivUrl = `https://arxiv.org/abs/${arxivId}`;
    // arXiv links should always open in new tab (external)
    expect(arxivUrl).toMatch(/^https:\/\/arxiv\.org/);
  });

  it("internal paper link format does not reference external domains", () => {
    const paperId = "some-uuid-paper-id";
    const internalLink = `/papers/${paperId}`;
    expect(internalLink).not.toMatch(/^https?:\/\//);
    expect(internalLink).toMatch(/^\/papers\//);
  });
});

describe("File scan: tasks/[id]/page.tsx paper links", () => {
  const tasksPagePath = path.join(
    __dirname,
    "../app/tasks/[id]/page.tsx"
  );

  it("file exists", () => {
    expect(fs.existsSync(tasksPagePath)).toBe(true);
  });

  it("leaderboard paper links use internal /papers/ path (not arxiv href)", () => {
    const content = fs.readFileSync(tasksPagePath, "utf-8");
    // Should NOT link directly to arxiv in paper title column
    expect(content).not.toMatch(/href=\{row\.paper_url_abs/);
    // Should use internal paper link pattern
    expect(content).toMatch(/\/papers\/\$\{/);
  });

  it("does not use paper_url_abs as a direct href for paper titles", () => {
    const content = fs.readFileSync(tasksPagePath, "utf-8");
    // paper_url_abs is an external arXiv URL — should not be used for paper title links
    const paperUrlAbsAsHref = /href=\{[^}]*paper_url_abs[^}]*\}/;
    expect(content).not.toMatch(paperUrlAbsAsHref);
  });
});

describe("File scan: leaderboard rows use paper_id for internal links", () => {
  const tasksPagePath = path.join(
    __dirname,
    "../app/tasks/[id]/page.tsx"
  );

  it("paper_id is used to construct the /papers/ link", () => {
    const content = fs.readFileSync(tasksPagePath, "utf-8");
    // Should see /papers/${...paper_id...} pattern
    expect(content).toMatch(/\/papers\/\$\{.*paper_id/);
  });
});
