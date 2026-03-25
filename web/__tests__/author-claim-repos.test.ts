/**
 * Tests for author claim checking ALL repos (not just official).
 */

const mockSql = jest.fn();
jest.mock("@/lib/db", () => {
  const sql = (..._args: unknown[]) => mockSql();
  sql.unsafe = (..._args: unknown[]) => mockSql();
  return { __esModule: true, default: sql };
});

jest.mock("next-auth", () => ({
  getServerSession: jest.fn(),
}));

const mockCookieStore = { get: jest.fn(), set: jest.fn(), delete: jest.fn() };
jest.mock("next/headers", () => ({
  cookies: jest.fn().mockResolvedValue(mockCookieStore),
}));

const mockFetch = jest.fn();
global.fetch = mockFetch as unknown as typeof fetch;

import { getServerSession } from "next-auth";
import { NextRequest } from "next/server";

const mockGSS = getServerSession as jest.MockedFunction<typeof getServerSession>;

function makeSession(githubId: string, username: string) {
  return { user: { github_id: githubId, username }, expires: "2099" };
}

beforeEach(() => {
  mockSql.mockReset();
  mockGSS.mockReset();
  mockFetch.mockReset();
});

describe("Author claim — repo scoping", () => {
  it("checks non-official repos when no official repo exists", async () => {
    mockGSS.mockResolvedValueOnce(makeSession("12345", "testuser"));
    // Paper exists
    mockSql.mockResolvedValueOnce([{ id: "paper1" }]);
    // paper_code_links: one non-official repo
    mockSql.mockResolvedValueOnce([
      { repo_url: "https://github.com/someuser/somerepo" },
    ]);
    // GitHub API: contributors (user found!)
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [{ login: "testuser" }],
    } as Response);
    // GitHub API: repo owner
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ owner: { login: "someuser" } }),
    } as Response);
    // INSERT paper_authors + UPDATE users rep + recomputeVerificationScore + logEvent
    mockSql.mockResolvedValueOnce([]); // INSERT
    mockSql.mockResolvedValueOnce([]); // UPDATE rep
    mockSql.mockResolvedValueOnce([{ has_repo: true }]); // recompute: has_repo
    mockSql.mockResolvedValueOnce([{ has_author: true }]); // recompute: has_author
    mockSql.mockResolvedValueOnce([]); // recompute: repros
    mockSql.mockResolvedValueOnce([{ best_metric_value: null }]); // recompute: claimed
    mockSql.mockResolvedValueOnce([]); // recompute: UPDATE
    mockSql.mockResolvedValueOnce([]); // logEvent

    const { POST } = await import("@/app/api/papers/[id]/claim-author/route");
    const req = new NextRequest("http://localhost/api/papers/paper1/claim-author", {
      method: "POST",
    });
    const res = await POST(req, { params: Promise.resolve({ id: "paper1" }) });
    const json = await res.json();
    expect(json.status).toBe("verified");
    mockSql.mockReset();
  });

  it("returns no_repo when paper has zero code links", async () => {
    mockGSS.mockResolvedValueOnce(makeSession("12345", "testuser"));
    mockSql.mockResolvedValueOnce([{ id: "paper1" }]); // paper exists
    mockSql.mockResolvedValueOnce([]);                  // no code links

    const { POST } = await import("@/app/api/papers/[id]/claim-author/route");
    const req = new NextRequest("http://localhost/api/papers/paper1/claim-author", {
      method: "POST",
    });
    const res = await POST(req, { params: Promise.resolve({ id: "paper1" }) });
    const json = await res.json();
    expect(json.status).toBe("no_repo");
    expect(json.message).toMatch(/no linked code repository/i);
  });

  it("checks multiple repos and finds user on second one", async () => {
    mockGSS.mockResolvedValueOnce(makeSession("12345", "testuser"));
    mockSql.mockResolvedValueOnce([{ id: "paper1" }]);
    // Two code links
    mockSql.mockResolvedValueOnce([
      { repo_url: "https://github.com/other/repo1" },
      { repo_url: "https://github.com/myorg/repo2" },
    ]);
    // First repo: contributors (user NOT found)
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [{ login: "otheruser" }],
    } as Response);
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ owner: { login: "other" } }),
    } as Response);
    // Second repo: contributors (user found!)
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [{ login: "testuser" }, { login: "teammate" }],
    } as Response);
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ owner: { login: "myorg" } }),
    } as Response);
    // INSERT paper_authors + UPDATE users rep + recomputeVerificationScore + logEvent
    mockSql.mockResolvedValueOnce([]); // INSERT
    mockSql.mockResolvedValueOnce([]); // UPDATE rep
    mockSql.mockResolvedValueOnce([{ has_repo: true }]); // recompute: has_repo
    mockSql.mockResolvedValueOnce([{ has_author: true }]); // recompute: has_author
    mockSql.mockResolvedValueOnce([]); // recompute: repros
    mockSql.mockResolvedValueOnce([{ best_metric_value: null }]); // recompute: claimed
    mockSql.mockResolvedValueOnce([]); // recompute: UPDATE
    mockSql.mockResolvedValueOnce([]); // logEvent

    const { POST } = await import("@/app/api/papers/[id]/claim-author/route");
    const req = new NextRequest("http://localhost/api/papers/paper1/claim-author", {
      method: "POST",
    });
    const res = await POST(req, { params: Promise.resolve({ id: "paper1" }) });
    const json = await res.json();
    expect(json.status).toBe("verified");
    mockSql.mockReset();
  });
});
