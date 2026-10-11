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

// GET reads the count from the cached catalog index (no DB).
jest.mock("@/lib/queries", () => ({ getPaperIndex: jest.fn() }));

jest.mock("next-auth", () => ({
  getServerSession: jest.fn(),
}));

import { getServerSession } from "next-auth";
import { getPaperIndex } from "@/lib/queries";
import { GET, POST } from "@/app/api/upvotes/route";
import { NextRequest } from "next/server";

const mockIndex = getPaperIndex as jest.Mock;
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
    mockIndex.mockResolvedValueOnce([{ id: "paper-abc", upvote_count: 5 }]);

    const req = makeReq("GET", undefined, { paper_id: "paper-abc" });
    const res = await GET(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.count).toBe(5);
    expect(json.upvoted).toBe(false);
    // Anonymous: served from the cached index — zero DB calls
    expect(mockSql).not.toHaveBeenCalled();
    expect(res.headers.get("cache-control")).toContain("s-maxage");
  });

  it("returns {count, upvoted: true} when user has voted", async () => {
    mockGetServerSession.mockResolvedValueOnce(makeSession("user123"));
    mockIndex.mockResolvedValueOnce([{ id: "paper-abc", upvote_count: 3 }]);
    // Only call: check if user voted — returns a row
    mockSql.mockResolvedValueOnce([{ "?column?": 1 }]);

    const req = makeReq("GET", undefined, { paper_id: "paper-abc" });
    const res = await GET(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.count).toBe(3);
    expect(json.upvoted).toBe(true);
    expect(mockSql).toHaveBeenCalledTimes(1);
  });

  it("returns {count, upvoted: false} when user has NOT voted", async () => {
    mockGetServerSession.mockResolvedValueOnce(makeSession("user123"));
    mockIndex.mockResolvedValueOnce([{ id: "paper-abc", upvote_count: 2 }]);
    // Only call: check if voted — returns empty
    mockSql.mockResolvedValueOnce([]);

    const req = makeReq("GET", undefined, { paper_id: "paper-abc" });
    const res = await GET(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.upvoted).toBe(false);
  });

  it("returns 404 without touching the DB for a paper outside the catalog", async () => {
    mockGetServerSession.mockResolvedValueOnce(null);
    mockIndex.mockResolvedValueOnce([{ id: "other", upvote_count: 1 }]);
    const res = await GET(makeReq("GET", undefined, { paper_id: "dropped-paper" }));
    expect(res.status).toBe(404);
    expect(mockSql).not.toHaveBeenCalled();
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

  it("returns 404 for a paper that is not in the database", async () => {
    mockGetServerSession.mockResolvedValueOnce(makeSession("user123"));
    mockSql.mockResolvedValueOnce([]); // paper existence check → none
    const res = await POST(makeReq("POST", { paper_id: "dropped-paper" }));
    expect(res.status).toBe(404);
    expect(mockSql).toHaveBeenCalledTimes(1);
  });

  it("inserts upvote when no prior vote exists → {upvoted: true, count: 1}", async () => {
    mockGetServerSession.mockResolvedValueOnce(makeSession("user123"));
    // Call 0: paper exists in the catalog
    mockSql.mockResolvedValueOnce([{ "?column?": 1 }]);
    // Call 1: check existing → none found
    mockSql.mockResolvedValueOnce([]);
    // Call 2: INSERT upvote
    mockSql.mockResolvedValueOnce([]);
    // Call 3: UPDATE papers hype_score + 1
    mockSql.mockResolvedValueOnce([]);
    // Call 4: SELECT hype_score as count
    mockSql.mockResolvedValueOnce([{ count: 1 }]);
    // Call 5: logEvent INSERT (activity_log)
    mockSql.mockResolvedValueOnce([]);

    const req = makeReq("POST", { paper_id: "paper-abc" });
    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.upvoted).toBe(true);
    expect(json.count).toBe(1);
    expect(mockSql).toHaveBeenCalledTimes(6);
  });

  it("deletes upvote when prior vote exists → {upvoted: false, count: 0}", async () => {
    mockGetServerSession.mockResolvedValueOnce(makeSession("user123"));
    // Call 0: paper exists in the catalog
    mockSql.mockResolvedValueOnce([{ "?column?": 1 }]);
    // Call 1: check existing → found
    mockSql.mockResolvedValueOnce([{}]);
    // Call 2: DELETE upvote
    mockSql.mockResolvedValueOnce([]);
    // Call 3: UPDATE papers hype_score - 1
    mockSql.mockResolvedValueOnce([]);
    // Call 4: SELECT hype_score as count
    mockSql.mockResolvedValueOnce([{ count: 0 }]);
    // Call 5: logEvent INSERT (activity_log)
    mockSql.mockResolvedValueOnce([]);

    const req = makeReq("POST", { paper_id: "paper-abc" });
    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.upvoted).toBe(false);
    expect(json.count).toBe(0);
    expect(mockSql).toHaveBeenCalledTimes(6);
  });
});
