/**
 * Tests for author claim — early launch mode (auto-approve).
 * With SKIP_CONTRIBUTOR_CHECK=true, all claims are immediately verified
 * without GitHub API calls or repo checks.
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

jest.mock("@/lib/verification", () => ({
  recomputeVerificationScore: jest.fn().mockResolvedValue(0),
}));

jest.mock("@/lib/activity", () => ({
  logEvent: jest.fn().mockResolvedValue(undefined),
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

describe("Author claim — auto-approve mode", () => {
  it("auto-approves without checking repos (early launch)", async () => {
    mockGSS.mockResolvedValueOnce(makeSession("12345", "testuser"));
    mockSql.mockResolvedValueOnce([{ id: "paper1" }]); // paper exists
    mockSql.mockResolvedValueOnce([]); // INSERT paper_authors
    mockSql.mockResolvedValueOnce([]); // UPDATE users rep

    const { POST } = await import("@/app/api/papers/[id]/claim-author/route");
    const req = new NextRequest("http://localhost/api/papers/paper1/claim-author", {
      method: "POST",
    });
    const res = await POST(req, { params: Promise.resolve({ id: "paper1" }) });
    const json = await res.json();

    expect(json.status).toBe("verified");
    // No GitHub API calls
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("auto-approves even when paper has no code links", async () => {
    mockGSS.mockResolvedValueOnce(makeSession("12345", "testuser"));
    mockSql.mockResolvedValueOnce([{ id: "paper1" }]); // paper exists
    mockSql.mockResolvedValueOnce([]); // INSERT paper_authors
    mockSql.mockResolvedValueOnce([]); // UPDATE users rep

    const { POST } = await import("@/app/api/papers/[id]/claim-author/route");
    const req = new NextRequest("http://localhost/api/papers/paper1/claim-author", {
      method: "POST",
    });
    const res = await POST(req, { params: Promise.resolve({ id: "paper1" }) });
    const json = await res.json();

    expect(json.status).toBe("verified");
  });

  it("returns 404 for nonexistent paper", async () => {
    mockGSS.mockResolvedValueOnce(makeSession("12345", "testuser"));
    mockSql.mockResolvedValueOnce([]); // paper not found

    const { POST } = await import("@/app/api/papers/[id]/claim-author/route");
    const req = new NextRequest("http://localhost/api/papers/paper1/claim-author", {
      method: "POST",
    });
    const res = await POST(req, { params: Promise.resolve({ id: "paper1" }) });

    expect(res.status).toBe(404);
  });
});
