/**
 * Unit tests for Stage 3b upvote API.
 * All DB and session calls are mocked — no real network or DB connections.
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

import { getServerSession } from "next-auth";
import { GET, POST } from "@/app/api/upvotes/route";
import { NextRequest } from "next/server";

const mockGetServerSession = getServerSession as jest.MockedFunction<typeof getServerSession>;

function makeReq(
  method: string,
  body?: unknown,
  searchParams?: Record<string, string>
): NextRequest {
  const url = new URL("http://localhost/api/upvotes");
  if (searchParams) {
    for (const [k, v] of Object.entries(searchParams)) url.searchParams.set(k, v);
  }
  return new NextRequest(url, {
    method,
    body: body ? JSON.stringify(body) : undefined,
    headers: body ? { "content-type": "application/json" } : {},
  });
}

function makeSession(githubId = "user123") {
  return {
    user: { github_id: githubId, username: "testuser", name: "Test User", email: "t@example.com" },
    expires: "2099-01-01",
  };
}

describe("GET /api/upvotes", () => {
  beforeEach(() => {
    mockSql.mockClear();
    mockGetServerSession.mockClear();
  });

  it("returns {count, upvoted: false} without session", async () => {
    mockGetServerSession.mockResolvedValueOnce(null);
    // First sql call: count query
    mockSql.mockResolvedValueOnce([{ count: 5 }]);

    const req = makeReq("GET", undefined, { paper_id: "paper-abc" });
    const res = await GET(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.count).toBe(5);
    expect(json.upvoted).toBe(false);
    // Only one sql call (no user check without session)
    expect(mockSql).toHaveBeenCalledTimes(1);
  });

  it("returns {count, upvoted: true} when user has voted", async () => {
    mockGetServerSession.mockResolvedValueOnce(makeSession("user123"));
    // First call: count query
    mockSql.mockResolvedValueOnce([{ count: 3 }]);
    // Second call: check if user voted — returns a row
    mockSql.mockResolvedValueOnce([{ "?column?": 1 }]);

    const req = makeReq("GET", undefined, { paper_id: "paper-abc" });
    const res = await GET(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.count).toBe(3);
    expect(json.upvoted).toBe(true);
    expect(mockSql).toHaveBeenCalledTimes(2);
  });

  it("returns {count, upvoted: false} when user has NOT voted", async () => {
    mockGetServerSession.mockResolvedValueOnce(makeSession("user123"));
    // First call: count
    mockSql.mockResolvedValueOnce([{ count: 2 }]);
    // Second call: check if voted — returns empty
    mockSql.mockResolvedValueOnce([]);

    const req = makeReq("GET", undefined, { paper_id: "paper-abc" });
    const res = await GET(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.upvoted).toBe(false);
  });

  it("returns 400 when paper_id is missing", async () => {
    const req = makeReq("GET");
    const res = await GET(req);

    expect(res.status).toBe(400);
    expect(mockSql).not.toHaveBeenCalled();
  });
});

describe("POST /api/upvotes", () => {
  beforeEach(() => {
    mockSql.mockClear();
    mockGetServerSession.mockClear();
  });

  it("returns 401 without session", async () => {
    mockGetServerSession.mockResolvedValueOnce(null);
    const req = makeReq("POST", { paper_id: "paper-abc" });
    const res = await POST(req);

    expect(res.status).toBe(401);
    expect(mockSql).not.toHaveBeenCalled();
  });

  it("inserts upvote when no prior vote exists → {upvoted: true, count: 1}", async () => {
    mockGetServerSession.mockResolvedValueOnce(makeSession("user123"));
    // Call 1: author check → not author
    mockSql.mockResolvedValueOnce([]);
    // Call 2: check existing → none found
    mockSql.mockResolvedValueOnce([]);
    // Call 3: INSERT
    mockSql.mockResolvedValueOnce([]);
    // Call 4: count
    mockSql.mockResolvedValueOnce([{ count: 1 }]);
    // Call 5: logEvent INSERT (activity_log)
    mockSql.mockResolvedValueOnce([]);

    const req = makeReq("POST", { paper_id: "paper-abc" });
    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.upvoted).toBe(true);
    expect(json.count).toBe(1);
    expect(mockSql).toHaveBeenCalledTimes(5);
  });

  it("blocks self-hype when user is verified author", async () => {
    mockGetServerSession.mockResolvedValueOnce(makeSession("user123"));
    // Call 1: author check → IS author
    mockSql.mockResolvedValueOnce([{ paper_id: "paper-abc" }]);

    const req = makeReq("POST", { paper_id: "paper-abc" });
    const res = await POST(req);
    expect(res.status).toBe(403);
    expect(mockSql).toHaveBeenCalledTimes(1);
  });

  it("deletes upvote when prior vote exists → {upvoted: false, count: 0}", async () => {
    mockGetServerSession.mockResolvedValueOnce(makeSession("user123"));
    // Call 1: author check → not author
    mockSql.mockResolvedValueOnce([]);
    // Call 2: check existing → found
    mockSql.mockResolvedValueOnce([{}]);
    // Call 3: DELETE
    mockSql.mockResolvedValueOnce([]);
    // Call 4: count
    mockSql.mockResolvedValueOnce([{ count: 0 }]);
    // Call 5: logEvent INSERT (activity_log)
    mockSql.mockResolvedValueOnce([]);

    const req = makeReq("POST", { paper_id: "paper-abc" });
    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.upvoted).toBe(false);
    expect(json.count).toBe(0);
    expect(mockSql).toHaveBeenCalledTimes(5);
  });
});
