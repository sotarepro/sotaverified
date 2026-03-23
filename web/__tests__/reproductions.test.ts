/**
 * Unit tests for Stage 3d reproduction submission and flagging.
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

jest.mock("@/lib/verification", () => ({
  recomputeVerificationScore: jest.fn().mockResolvedValue(0),
}));

import { getServerSession } from "next-auth";
import { POST } from "@/app/api/reproductions/route";
import { POST as FLAG_POST } from "@/app/api/reproductions/[id]/flag/route";
import { PATCH } from "@/app/api/admin/reproductions/[id]/route";
import { NextRequest } from "next/server";

const mockGetServerSession = getServerSession as jest.MockedFunction<typeof getServerSession>;

function makeReq(method: string, body?: unknown): NextRequest {
  return new NextRequest(new URL("http://localhost/api/test"), {
    method,
    body: body ? JSON.stringify(body) : undefined,
    headers: body ? { "content-type": "application/json" } : {},
  });
}

function makeSession(githubId = "user123", username = "testuser") {
  return {
    user: { github_id: githubId, username, name: "Test User", email: "t@example.com" },
    expires: "2099-01-01",
  };
}

const validReproBody = {
  paper_id: "paper-42",
  tier_claimed: 2,
  hardware_spec: "RTX 3090, 24GB, Ubuntu 22.04",
  run_log_url: "https://github.com/gist/abc123",
  notes: "Reproduced BLEU 28.4",
};

// ── POST /api/reproductions ───────────────────────────────────────────────────

describe("POST /api/reproductions", () => {
  beforeEach(() => {
    mockSql.mockClear();
    mockGetServerSession.mockClear();
  });

  it("returns 401 when unauthenticated", async () => {
    mockGetServerSession.mockResolvedValueOnce(null);
    const req = makeReq("POST", validReproBody);
    const res = await POST(req);

    expect(res.status).toBe(401);
    expect(mockSql).not.toHaveBeenCalled();
  });

  it("returns 400 when required fields are missing", async () => {
    mockGetServerSession.mockResolvedValueOnce(makeSession());
    const req = makeReq("POST", {
      paper_id: "paper-42",
      // missing tier_claimed, hardware_spec, run_log_url
    });
    const res = await POST(req);

    expect(res.status).toBe(400);
  });

  it("returns 201 with {id} for valid submission", async () => {
    mockGetServerSession.mockResolvedValueOnce(makeSession());
    // INSERT → returns id
    mockSql.mockResolvedValueOnce([{ id: 42 }]);

    const req = makeReq("POST", validReproBody);
    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(201);
    expect(json).toHaveProperty("id", 42);
  });

  it("calls sql INSERT when submission is valid", async () => {
    mockGetServerSession.mockResolvedValueOnce(makeSession());
    mockSql.mockResolvedValueOnce([{ id: 99 }]);
    // logEvent INSERT (activity_log)
    mockSql.mockResolvedValueOnce([]);

    const req = makeReq("POST", validReproBody);
    await POST(req);

    // Called 2 times: INSERT + logEvent (no age gate check)
    expect(mockSql).toHaveBeenCalledTimes(2);
  });
});

// ── POST /api/reproductions/[id]/flag ─────────────────────────────────────────

describe("POST /api/reproductions/[id]/flag", () => {
  beforeEach(() => {
    mockSql.mockClear();
    mockGetServerSession.mockClear();
  });

  it("returns 401 when unauthenticated", async () => {
    mockGetServerSession.mockResolvedValueOnce(null);
    const req = makeReq("POST");
    const params = { params: Promise.resolve({ id: "42" }) };
    const res = await FLAG_POST(req, params);

    expect(res.status).toBe(401);
    expect(mockSql).not.toHaveBeenCalled();
  });

  it("inserts flag and returns {flagged: true, count: 1} when no prior flag", async () => {
    mockGetServerSession.mockResolvedValueOnce(makeSession());
    // Check existing → none
    mockSql.mockResolvedValueOnce([]);
    // INSERT flag
    mockSql.mockResolvedValueOnce([]);
    // UPDATE increment
    mockSql.mockResolvedValueOnce([]);
    // Fetch current state (count < 3, no auto-hide)
    mockSql.mockResolvedValueOnce([{ flag_count: 1, status: "community", user_id: "u1", paper_id: "paper-1" }]);
    // logEvent INSERT (activity_log)
    mockSql.mockResolvedValueOnce([]);

    const req = makeReq("POST");
    const params = { params: Promise.resolve({ id: "42" }) };
    const res = await FLAG_POST(req, params);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.flagged).toBe(true);
    expect(json.count).toBe(1);
  });

  it("deletes flag and returns {flagged: false, count: 0} when prior flag exists", async () => {
    mockGetServerSession.mockResolvedValueOnce(makeSession());
    // Check existing → flag found
    mockSql.mockResolvedValueOnce([{}]);
    // DELETE flag
    mockSql.mockResolvedValueOnce([]);
    // UPDATE decrement
    mockSql.mockResolvedValueOnce([]);
    // Fetch updated count + paper_id (unflag path)
    mockSql.mockResolvedValueOnce([{ flag_count: 0, paper_id: "paper-1" }]);
    // logEvent INSERT (activity_log)
    mockSql.mockResolvedValueOnce([]);

    const req = makeReq("POST");
    const params = { params: Promise.resolve({ id: "42" }) };
    const res = await FLAG_POST(req, params);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.flagged).toBe(false);
    expect(json.count).toBe(0);
  });

  it("auto-hides reproduction when flag_count reaches 3 and calls additional UPDATE", async () => {
    mockGetServerSession.mockResolvedValueOnce(makeSession());
    // Check existing → none (new flag)
    mockSql.mockResolvedValueOnce([]);
    // INSERT flag
    mockSql.mockResolvedValueOnce([]);
    // UPDATE increment
    mockSql.mockResolvedValueOnce([]);
    // Fetch current state → 3 flags, still community status
    mockSql.mockResolvedValueOnce([{ flag_count: 3, status: "community", user_id: "u1", paper_id: "paper-1" }]);
    // logEvent INSERT (activity_log)
    mockSql.mockResolvedValueOnce([]);
    // UPDATE status='hidden'
    mockSql.mockResolvedValueOnce([]);
    // UPDATE user rep -20
    mockSql.mockResolvedValueOnce([]);

    const req = makeReq("POST");
    const params = { params: Promise.resolve({ id: "42" }) };
    const res = await FLAG_POST(req, params);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.flagged).toBe(true);
    expect(json.count).toBe(3);
    // Total calls: check + insert + update_count + fetch + logEvent + update_hidden + update_rep = 7
    expect(mockSql).toHaveBeenCalledTimes(7);
  });
});

// ── PATCH /api/admin/reproductions/[id] ───────────────────────────────────────

describe("PATCH /api/admin/reproductions/[id]", () => {
  const ADMIN_ID = "admin-github-id-999";

  beforeEach(() => {
    mockSql.mockClear();
    mockGetServerSession.mockClear();
    process.env.ADMIN_GITHUB_ID = ADMIN_ID;
  });

  afterAll(() => {
    delete process.env.ADMIN_GITHUB_ID;
  });

  it("returns 403 for non-admin session", async () => {
    mockGetServerSession.mockResolvedValueOnce(makeSession("not-admin", "regular-user"));
    const req = makeReq("PATCH", { action: "approve" });
    const params = { params: Promise.resolve({ id: "42" }) };
    const res = await PATCH(req, params);

    expect(res.status).toBe(403);
    expect(mockSql).not.toHaveBeenCalled();
  });

  it("returns 403 when no session", async () => {
    mockGetServerSession.mockResolvedValueOnce(null);
    const req = makeReq("PATCH", { action: "approve" });
    const params = { params: Promise.resolve({ id: "42" }) };
    const res = await PATCH(req, params);

    expect(res.status).toBe(403);
  });

  it("admin approve: updates status to verified and awards tier-based rep, returns {ok: true}", async () => {
    mockGetServerSession.mockResolvedValueOnce(makeSession(ADMIN_ID, "admin"));
    // UPDATE status='verified'
    mockSql.mockResolvedValueOnce([]);
    // Fetch reproduction (user_id + status + tier_claimed + paper_id)
    mockSql.mockResolvedValueOnce([{ user_id: "u1", status: "community", tier_claimed: 2, paper_id: "paper-1" }]);
    // UPDATE rep (tier 2 = +10)
    mockSql.mockResolvedValueOnce([]);

    const req = makeReq("PATCH", { action: "approve" });
    const params = { params: Promise.resolve({ id: "42" }) };
    const res = await PATCH(req, params);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toEqual({ ok: true });
    // 3 sql calls: update + fetch + update_rep
    expect(mockSql).toHaveBeenCalledTimes(3);
  });

  it("admin remove: updates status to removed, returns {ok: true}", async () => {
    mockGetServerSession.mockResolvedValueOnce(makeSession(ADMIN_ID, "admin"));
    // UPDATE status='removed'
    mockSql.mockResolvedValueOnce([]);
    // Fetch reproduction to get paper_id (for recomputeVerificationScore)
    mockSql.mockResolvedValueOnce([{ user_id: "u1", status: "community", paper_id: "paper-1" }]);

    const req = makeReq("PATCH", { action: "remove" });
    const params = { params: Promise.resolve({ id: "42" }) };
    const res = await PATCH(req, params);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toEqual({ ok: true });
    // 2 sql calls: UPDATE + fetch for paper_id (recomputeVerificationScore itself is mocked)
    expect(mockSql).toHaveBeenCalledTimes(2);
  });

  it("returns 400 for invalid action", async () => {
    mockGetServerSession.mockResolvedValueOnce(makeSession(ADMIN_ID, "admin"));

    const req = makeReq("PATCH", { action: "invalidAction" });
    const params = { params: Promise.resolve({ id: "42" }) };
    const res = await PATCH(req, params);

    expect(res.status).toBe(400);
    expect(mockSql).not.toHaveBeenCalled();
  });
});
