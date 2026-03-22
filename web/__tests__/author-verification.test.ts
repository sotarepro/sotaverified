/**
 * Unit tests for Stage 3-author author verification (claim-author).
 * All DB and external fetch calls are mocked — no real network or DB connections.
 *
 * Behavior (updated Stage 3-author spec):
 * - no_repo: returns {status:"no_repo"} with explanation, no DB write
 * - not_contributor: returns {status:"not_contributor"} with explanation, no DB write
 * - check_failed: returns {status:"check_failed"} with explanation, no DB write
 * - verified: DB insert + rep +10, returns {status:"verified"}
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

jest.mock("@/lib/activity", () => ({
  logEvent: jest.fn().mockResolvedValue(undefined),
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
    // mockReset clears both call history AND queued mockResolvedValueOnce values
    mockSql.mockReset();
    mockGetServerSession.mockReset();
    mockFetch.mockReset();
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
    mockSql.mockResolvedValueOnce([]);  // paper lookup → empty

    const req = makeReq();
    const params = { params: Promise.resolve({ id: "paper123" }) };
    const res = await POST(req, params);

    expect(res.status).toBe(404);
  });

  it("returns no_repo when no official repo is found — no DB write", async () => {
    mockGetServerSession.mockResolvedValueOnce(makeSession());
    mockSql.mockResolvedValueOnce([fakePaperRow]);  // paper found
    mockSql.mockResolvedValueOnce([]);              // no official repo

    const req = makeReq();
    const params = { params: Promise.resolve({ id: "paper123" }) };
    const res = await POST(req, params);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.status).toBe("no_repo");
    expect(json.message).toMatch(/no linked code repository/i);
    // Only 2 SQL calls (paper + repo lookup), no INSERT
    expect(mockSql).toHaveBeenCalledTimes(2);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("returns verified when user IS in GitHub contributors", async () => {
    mockGetServerSession.mockResolvedValueOnce(makeSession("12345", "testuser"));
    mockSql.mockResolvedValueOnce([fakePaperRow]);        // paper found
    mockSql.mockResolvedValueOnce([fakeOfficialRepoRow]); // official repo found
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [{ login: "testuser" }, { login: "otherdev" }],
    } as Response);
    mockSql.mockResolvedValueOnce([]);  // INSERT paper_authors
    mockSql.mockResolvedValueOnce([]);  // UPDATE users rep

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

  it("returns not_contributor when user is NOT in contributors — no DB write", async () => {
    mockGetServerSession.mockResolvedValueOnce(makeSession("12345", "testuser"));
    mockSql.mockResolvedValueOnce([fakePaperRow]);        // paper found
    mockSql.mockResolvedValueOnce([fakeOfficialRepoRow]); // official repo found
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [{ login: "otheruser" }, { login: "anotherdev" }],
    } as Response);

    const req = makeReq();
    const params = { params: Promise.resolve({ id: "paper123" }) };
    const res = await POST(req, params);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.status).toBe("not_contributor");
    expect(json.message).toMatch(/@testuser/);
    // Only 2 SQL calls (paper + repo), no INSERT
    expect(mockSql).toHaveBeenCalledTimes(2);
  });

  it("returns check_failed gracefully when GitHub API fetch throws — no DB write", async () => {
    mockGetServerSession.mockResolvedValueOnce(makeSession("12345", "testuser"));
    mockSql.mockResolvedValueOnce([fakePaperRow]);        // paper found
    mockSql.mockResolvedValueOnce([fakeOfficialRepoRow]); // official repo found
    mockFetch.mockRejectedValueOnce(new Error("Network error"));

    const req = makeReq();
    const params = { params: Promise.resolve({ id: "paper123" }) };
    const res = await POST(req, params);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.status).toBe("check_failed");
    expect(json.message).toMatch(/try again later/i);
    // Only 2 SQL calls (paper + repo), no INSERT
    expect(mockSql).toHaveBeenCalledTimes(2);
  });
});
