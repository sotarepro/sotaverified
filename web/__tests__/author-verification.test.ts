/**
 * Unit tests for Stage 3e author verification (claim-author).
 * All DB and external fetch calls are mocked — no real network or DB connections.
 */

// Mock the postgres db module before importing routes
const mockSql = jest.fn();
jest.mock("@/lib/db", () => {
  const sql = (..._args: unknown[]) => mockSql();
  return { __esModule: true, default: sql };
});

jest.mock("next-auth", () => ({
  getServerSession: jest.fn(),
}));

jest.mock("@/lib/verification", () => ({
  recomputeVerificationScore: jest.fn().mockResolvedValue(0),
}));

import { getServerSession } from "next-auth";
import { POST } from "@/app/api/papers/[id]/claim-author/route";
import { NextRequest } from "next/server";

const mockGetServerSession = getServerSession as jest.MockedFunction<typeof getServerSession>;

// Mock global fetch for GitHub API calls
global.fetch = jest.fn();
const mockFetch = fetch as jest.MockedFunction<typeof fetch>;

function makeReq(method = "POST"): NextRequest {
  return new NextRequest(new URL("http://localhost/api/papers/paper123/claim-author"), { method });
}

function makeSession(githubId = "12345", username = "testuser") {
  return {
    user: { github_id: githubId, username, name: "Test User", email: "t@example.com" },
    expires: "2099-01-01",
  };
}

const fakePaperRow = { id: "paper123" };
const fakeOfficialRepoRow = { repo_url: "https://github.com/tensorflow/tensor2tensor" };

describe("POST /api/papers/[id]/claim-author", () => {
  beforeEach(() => {
    mockSql.mockClear();
    mockGetServerSession.mockClear();
    mockFetch.mockClear();
  });

  it("returns 401 when unauthenticated", async () => {
    mockGetServerSession.mockResolvedValueOnce(null);

    const req = makeReq();
    const params = { params: Promise.resolve({ id: "paper123" }) };
    const res = await POST(req, params);

    expect(res.status).toBe(401);
    expect(mockSql).not.toHaveBeenCalled();
  });

  it("returns 404 when paper is not found", async () => {
    mockGetServerSession.mockResolvedValueOnce(makeSession());
    // Paper lookup → empty
    mockSql.mockResolvedValueOnce([]);

    const req = makeReq();
    const params = { params: Promise.resolve({ id: "paper123" }) };
    const res = await POST(req, params);

    expect(res.status).toBe(404);
  });

  it("returns pending_admin when no official repo is found", async () => {
    mockGetServerSession.mockResolvedValueOnce(makeSession());
    // Paper found
    mockSql.mockResolvedValueOnce([fakePaperRow]);
    // No official repo
    mockSql.mockResolvedValueOnce([]);
    // INSERT paper_authors with pending_admin
    mockSql.mockResolvedValueOnce([]);

    const req = makeReq();
    const params = { params: Promise.resolve({ id: "paper123" }) };
    const res = await POST(req, params);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.status).toBe("pending_admin");
    // fetch should NOT have been called (no repo to check)
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("returns verified when user IS in GitHub contributors", async () => {
    mockGetServerSession.mockResolvedValueOnce(makeSession("12345", "testuser"));
    // Paper found
    mockSql.mockResolvedValueOnce([fakePaperRow]);
    // Official repo found
    mockSql.mockResolvedValueOnce([fakeOfficialRepoRow]);
    // GitHub API response: user is a contributor
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [{ login: "testuser" }, { login: "otherdev" }],
    } as Response);
    // INSERT paper_authors with verified
    mockSql.mockResolvedValueOnce([]);

    const req = makeReq();
    const params = { params: Promise.resolve({ id: "paper123" }) };
    const res = await POST(req, params);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.status).toBe("verified");
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("tensorflow/tensor2tensor"),
      expect.any(Object)
    );
  });

  it("returns pending_admin when user is NOT in GitHub contributors", async () => {
    mockGetServerSession.mockResolvedValueOnce(makeSession("12345", "testuser"));
    // Paper found
    mockSql.mockResolvedValueOnce([fakePaperRow]);
    // Official repo found
    mockSql.mockResolvedValueOnce([fakeOfficialRepoRow]);
    // GitHub API: user is not listed
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [{ login: "otheruser" }, { login: "anotherdev" }],
    } as Response);
    // INSERT paper_authors with pending_admin
    mockSql.mockResolvedValueOnce([]);

    const req = makeReq();
    const params = { params: Promise.resolve({ id: "paper123" }) };
    const res = await POST(req, params);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.status).toBe("pending_admin");
  });

  it("falls back to pending_admin gracefully when GitHub API fetch throws", async () => {
    mockGetServerSession.mockResolvedValueOnce(makeSession("12345", "testuser"));
    // Paper found
    mockSql.mockResolvedValueOnce([fakePaperRow]);
    // Official repo found
    mockSql.mockResolvedValueOnce([fakeOfficialRepoRow]);
    // GitHub API call fails
    mockFetch.mockRejectedValueOnce(new Error("Network error"));
    // INSERT paper_authors with pending_admin (fallback)
    mockSql.mockResolvedValueOnce([]);

    const req = makeReq();
    const params = { params: Promise.resolve({ id: "paper123" }) };
    const res = await POST(req, params);
    const json = await res.json();

    // Should NOT throw — graceful fallback
    expect(res.status).toBe(200);
    expect(json.status).toBe("pending_admin");
  });
});
