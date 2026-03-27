/**
 * Unit tests for author verification (claim-author).
 * All DB and external fetch calls are mocked — no real network or DB connections.
 *
 * Current behavior (early launch, SKIP_CONTRIBUTOR_CHECK = true):
 * - All claims auto-approved immediately
 * - No GitHub contributor check
 * - Rep awarded, verification score recomputed
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

describe("POST /api/papers/[id]/claim-author", () => {
  beforeEach(() => {
    mockSql.mockReset();
    mockGetServerSession.mockReset();
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

  it("auto-approves claim immediately (early launch mode)", async () => {
    mockGetServerSession.mockResolvedValueOnce(makeSession("12345", "testuser"));
    mockSql.mockResolvedValueOnce([fakePaperRow]);  // paper found
    mockSql.mockResolvedValueOnce([]);               // INSERT paper_authors
    mockSql.mockResolvedValueOnce([]);               // UPDATE users rep

    const req = makeReq();
    const params = { params: Promise.resolve({ id: "paper123" }) };
    const res = await POST(req, params);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.status).toBe("verified");
    // No GitHub API calls (contributor check skipped)
    expect(mockSql).toHaveBeenCalledTimes(3);
  });

  it("awards rep on auto-approved claim", async () => {
    mockGetServerSession.mockResolvedValueOnce(makeSession("12345", "testuser"));
    mockSql.mockResolvedValueOnce([fakePaperRow]);  // paper found
    mockSql.mockResolvedValueOnce([]);               // INSERT paper_authors
    mockSql.mockResolvedValueOnce([]);               // UPDATE users rep

    const req = makeReq();
    const params = { params: Promise.resolve({ id: "paper123" }) };
    await POST(req, params);

    // 3 SQL calls: paper check, INSERT paper_authors, UPDATE users rep
    expect(mockSql).toHaveBeenCalledTimes(3);
  });
});
