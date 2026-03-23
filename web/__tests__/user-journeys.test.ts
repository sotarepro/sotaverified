/**
 * Comprehensive user journey tests covering all 4 personas.
 * Tests the MISSING coverage identified during verification audit.
 */

const mockSql = jest.fn();
jest.mock("@/lib/db", () => {
  const sql = (..._args: unknown[]) => mockSql();
  return { __esModule: true, default: sql };
});

jest.mock("@/lib/effective-session", () => ({
  getEffectiveSession: jest.fn(),
}));

jest.mock("@/lib/verification", () => ({
  recomputeVerificationScore: jest.fn().mockResolvedValue(0),
}));

import { getEffectiveSession } from "@/lib/effective-session";
import { NextRequest } from "next/server";

const mockSession = getEffectiveSession as jest.MockedFunction<typeof getEffectiveSession>;

function makeReq(method: string, body?: unknown, url = "http://localhost/api/test"): NextRequest {
  return new NextRequest(new URL(url), {
    method,
    body: body ? JSON.stringify(body) : undefined,
    headers: body ? { "content-type": "application/json" } : {},
  });
}

function userSession(id = "user1", name = "testuser") {
  return { user: { github_id: id, username: name, name, email: "t@test.com" }, expires: "2099-01-01" };
}

// ── PERSONA 1: Unauthenticated — interactive endpoints reject ──────────────

describe("Persona 1: Unauthenticated access control", () => {
  beforeEach(() => { mockSql.mockReset(); mockSession.mockReset(); });

  it("POST /api/upvotes returns 401", async () => {
    mockSession.mockResolvedValueOnce(null);
    const { POST } = await import("@/app/api/upvotes/route");
    const res = await POST(makeReq("POST", { paper_id: "p1" }));
    expect(res.status).toBe(401);
  });

  it("POST /api/reproductions returns 401", async () => {
    mockSession.mockResolvedValueOnce(null);
    const { POST } = await import("@/app/api/reproductions/route");
    const res = await POST(makeReq("POST", { paper_id: "p1", tier_claimed: 1, hardware_spec: "gpu" }));
    expect(res.status).toBe(401);
  });

  it("POST /api/reproductions/[id]/upvote returns 401", async () => {
    mockSession.mockResolvedValueOnce(null);
    const { POST } = await import("@/app/api/reproductions/[id]/upvote/route");
    const res = await POST(makeReq("POST"), { params: Promise.resolve({ id: "1" }) });
    expect(res.status).toBe(401);
  });

  it("POST /api/reproductions/[id]/flag returns 401", async () => {
    mockSession.mockResolvedValueOnce(null);
    const { POST } = await import("@/app/api/reproductions/[id]/flag/route");
    const res = await POST(makeReq("POST"), { params: Promise.resolve({ id: "1" }) });
    expect(res.status).toBe(401);
  });

  it("POST /api/reproductions/[id]/promote returns 401", async () => {
    mockSession.mockResolvedValueOnce(null);
    const { POST } = await import("@/app/api/reproductions/[id]/promote/route");
    const res = await POST(makeReq("POST"), { params: Promise.resolve({ id: "1" }) });
    expect(res.status).toBe(401);
  });
});

// ── PERSONA 2: Authenticated user journey ──────────────────────────────────

describe("Persona 2: Authenticated user — hype toggle", () => {
  beforeEach(() => { mockSql.mockReset(); mockSession.mockReset(); });

  it("hype adds upvote, unhype removes it (full toggle)", async () => {
    const { POST } = await import("@/app/api/upvotes/route");

    // Hype
    mockSession.mockResolvedValueOnce(userSession());
    mockSql.mockResolvedValueOnce([]);              // no existing upvote
    mockSql.mockResolvedValueOnce([]);              // INSERT upvote
    mockSql.mockResolvedValueOnce([]);              // UPDATE papers hype_score + 1
    mockSql.mockResolvedValueOnce([{ count: 1 }]); // SELECT hype_score
    mockSql.mockResolvedValueOnce([]);              // logEvent
    let res = await POST(makeReq("POST", { paper_id: "p1" }));
    let json = await res.json();
    expect(json.upvoted).toBe(true);
    expect(json.count).toBe(1);

    // Unhype
    mockSession.mockResolvedValueOnce(userSession());
    mockSql.mockResolvedValueOnce([{}]);            // existing upvote found
    mockSql.mockResolvedValueOnce([]);              // DELETE upvote
    mockSql.mockResolvedValueOnce([]);              // UPDATE papers hype_score - 1
    mockSql.mockResolvedValueOnce([{ count: 0 }]); // SELECT hype_score
    mockSql.mockResolvedValueOnce([]);              // logEvent
    res = await POST(makeReq("POST", { paper_id: "p1" }));
    json = await res.json();
    expect(json.upvoted).toBe(false);
    expect(json.count).toBe(0);
  });
});

describe("Persona 2: Reproduction submission validation", () => {
  beforeEach(() => { mockSql.mockReset(); mockSession.mockReset(); });

  it("rejects missing tier_claimed", async () => {
    mockSession.mockResolvedValueOnce(userSession());
    const { POST } = await import("@/app/api/reproductions/route");
    const res = await POST(makeReq("POST", { paper_id: "p1", hardware_spec: "gpu" }));
    expect(res.status).toBe(400);
  });

  it("rejects missing hardware_spec", async () => {
    mockSession.mockResolvedValueOnce(userSession());
    const { POST } = await import("@/app/api/reproductions/route");
    const res = await POST(makeReq("POST", { paper_id: "p1", tier_claimed: 2 }));
    expect(res.status).toBe(400);
  });

  it("rejects invalid tier (0)", async () => {
    mockSession.mockResolvedValueOnce(userSession());
    const { POST } = await import("@/app/api/reproductions/route");
    const res = await POST(makeReq("POST", { paper_id: "p1", tier_claimed: 0, hardware_spec: "gpu" }));
    expect(res.status).toBe(400);
  });

  it("rejects invalid tier (5)", async () => {
    mockSession.mockResolvedValueOnce(userSession());
    const { POST } = await import("@/app/api/reproductions/route");
    const res = await POST(makeReq("POST", { paper_id: "p1", tier_claimed: 5, hardware_spec: "gpu" }));
    expect(res.status).toBe(400);
  });

  it("accepts valid minimal reproduction", async () => {
    mockSession.mockResolvedValueOnce(userSession());
    const { POST } = await import("@/app/api/reproductions/route");
    mockSql.mockResolvedValueOnce([{ id: 1 }]);                         // INSERT
    mockSql.mockResolvedValueOnce([]);                                   // logEvent
    const res = await POST(makeReq("POST", {
      paper_id: "p1", tier_claimed: 1, hardware_spec: "RTX 3090",
    }));
    expect(res.status).toBe(201);
  });

  it("accepts reproduction with dataset_id and metric", async () => {
    mockSession.mockResolvedValueOnce(userSession());
    const { POST } = await import("@/app/api/reproductions/route");
    mockSql.mockResolvedValueOnce([{ id: 2 }]);
    mockSql.mockResolvedValueOnce([]);
    const res = await POST(makeReq("POST", {
      paper_id: "p1", tier_claimed: 3, hardware_spec: "A100",
      dataset_id: "ds1", actual_metric_name: "BLEU", actual_metric_value: 28.4,
    }));
    expect(res.status).toBe(201);
  });
});

describe("Persona 2: Reproduction self-upvote blocked", () => {
  beforeEach(() => { mockSql.mockReset(); mockSession.mockReset(); });

  it("returns 403 when upvoting own reproduction", async () => {
    mockSession.mockResolvedValueOnce(userSession("user1"));
    const { POST } = await import("@/app/api/reproductions/[id]/upvote/route");
    mockSql.mockResolvedValueOnce([{ id: 1 }]); // owner check → is owner
    const res = await POST(makeReq("POST"), { params: Promise.resolve({ id: "42" }) });
    expect(res.status).toBe(403);
  });
});

describe("Persona 2: Promote agent reproduction (any user)", () => {
  beforeEach(() => { mockSql.mockReset(); mockSession.mockReset(); });

  it("any logged-in user can promote", async () => {
    mockSession.mockResolvedValueOnce(userSession());
    const { POST } = await import("@/app/api/reproductions/[id]/promote/route");
    mockSql.mockResolvedValueOnce([{ source: "api", status: "agent_pending", paper_id: "p1" }]);
    mockSql.mockResolvedValueOnce([]); // UPDATE
    mockSql.mockResolvedValueOnce([]); // logEvent
    const res = await POST(makeReq("POST"), { params: Promise.resolve({ id: "42" }) });
    expect(res.status).toBe(200);
  });

  it("rejects promote of non-agent reproduction", async () => {
    mockSession.mockResolvedValueOnce(userSession());
    const { POST } = await import("@/app/api/reproductions/[id]/promote/route");
    mockSql.mockResolvedValueOnce([{ source: "community", status: "community", paper_id: "p1" }]);
    const res = await POST(makeReq("POST"), { params: Promise.resolve({ id: "42" }) });
    expect(res.status).toBe(400);
  });

  it("returns 404 for nonexistent reproduction", async () => {
    mockSession.mockResolvedValueOnce(userSession());
    const { POST } = await import("@/app/api/reproductions/[id]/promote/route");
    mockSql.mockResolvedValueOnce([]); // empty → undefined
    const res = await POST(makeReq("POST"), { params: Promise.resolve({ id: "999" }) });
    expect(res.status).toBe(404);
  });
});

// ── PERSONA 3: Author ──────────────────────────────────────────────────────

describe("Persona 3: Author benchmark submission", () => {
  beforeEach(() => { mockSql.mockReset(); mockSession.mockReset(); });

  it("returns 403 for non-author", async () => {
    mockSession.mockResolvedValueOnce(userSession());
    const { POST } = await import("@/app/api/papers/[id]/benchmarks/route");
    mockSql.mockResolvedValueOnce([]); // not a verified author
    const res = await POST(makeReq("POST", {
      task_id: "t1", dataset_id: "d1", metric_name: "BLEU", metric_value: 28.4,
    }), { params: Promise.resolve({ id: "p1" }) });
    expect(res.status).toBe(403);
  });

  it("creates leaderboard_results row for verified author", async () => {
    mockSession.mockResolvedValueOnce(userSession());
    const { POST } = await import("@/app/api/papers/[id]/benchmarks/route");
    mockSql.mockResolvedValueOnce([{ id: 1 }]);  // author check → verified
    mockSql.mockResolvedValueOnce([{ id: 1 }]);  // task exists
    mockSql.mockResolvedValueOnce([{ id: 1 }]);  // dataset exists
    mockSql.mockResolvedValueOnce([{ id: 99 }]); // INSERT leaderboard_results
    mockSql.mockResolvedValueOnce([]);            // logEvent
    const res = await POST(makeReq("POST", {
      task_id: "t1", dataset_id: "d1", metric_name: "Accuracy", metric_value: 93.8,
    }), { params: Promise.resolve({ id: "p1" }) });
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.id).toBe(99);
  });

  it("rejects benchmark with missing fields", async () => {
    mockSession.mockResolvedValueOnce(userSession());
    const { POST } = await import("@/app/api/papers/[id]/benchmarks/route");
    mockSql.mockResolvedValueOnce([{ id: 1 }]); // is author
    const res = await POST(makeReq("POST", {
      task_id: "t1", // missing dataset_id, metric_name, metric_value
    }), { params: Promise.resolve({ id: "p1" }) });
    expect(res.status).toBe(400);
  });
});

// ── PERSONA 4: Admin ───────────────────────────────────────────────────────

describe("Persona 4: Admin reproduction management", () => {
  const ADMIN_ID = "admin-42";

  beforeEach(() => {
    mockSql.mockReset();
    process.env.ADMIN_GITHUB_ID = ADMIN_ID;
  });

  // Need to mock next-auth for admin routes which use getServerSession
  jest.mock("next-auth", () => ({
    getServerSession: jest.fn(),
  }));

  it("admin can restore a removed reproduction", async () => {
    const { getServerSession } = await import("next-auth");
    const mockGSS = getServerSession as jest.MockedFunction<typeof getServerSession>;
    mockGSS.mockResolvedValueOnce({ user: { github_id: ADMIN_ID }, expires: "2099" });

    const { PATCH } = await import("@/app/api/admin/reproductions/[id]/route");
    mockSql.mockResolvedValueOnce([]);                // UPDATE status=community
    mockSql.mockResolvedValueOnce([{ paper_id: "p1" }]); // fetch paper_id
    const res = await PATCH(
      makeReq("PATCH", { action: "restore" }),
      { params: Promise.resolve({ id: "42" }) }
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
  });
});

// ── CROSS-CUTTING: Thresholds ──────────────────────────────────────────────

describe("Cross-cutting: thresholds.ts exports", () => {
  it("exports all expected threshold values", async () => {
    const { THRESHOLDS, tierRepGain } = await import("@/lib/thresholds");
    expect(THRESHOLDS.LEGITIMACY_SCORE_THRESHOLD).toBe(25);
    expect(THRESHOLDS.UPVOTES_TO_VERIFY).toBe(1);
    expect(THRESHOLDS.FLAGS_TO_HIDE).toBe(2);
    expect(THRESHOLDS.PROMOTES_TO_ACTIVATE).toBe(1);
    expect(THRESHOLDS.AGENT_SUBMISSIONS_PER_DAY).toBe(2);
    expect(THRESHOLDS.REP_TIER_1).toBe(2);
    expect(THRESHOLDS.REP_TIER_2).toBe(5);
    expect(THRESHOLDS.REP_TIER_3).toBe(10);
    expect(THRESHOLDS.REP_TIER_4).toBe(15);
    expect(THRESHOLDS.REP_METRIC_MATCH_BONUS).toBe(5);
    expect(THRESHOLDS.REP_PER_UPVOTE).toBe(1);
    expect(THRESHOLDS.REP_AUTHOR_VERIFIED).toBe(5);
    expect(THRESHOLDS.REP_SPAM_PENALTY).toBe(-20);
    expect(tierRepGain(1)).toBe(2);
    expect(tierRepGain(2)).toBe(5);
    expect(tierRepGain(3)).toBe(10);
    expect(tierRepGain(4)).toBe(15);
  });
});

// ── CROSS-CUTTING: Search entities API ─────────────────────────────────────

describe("Cross-cutting: GET /api/search-entities", () => {
  beforeEach(() => mockSql.mockReset());

  it("returns empty for short query", async () => {
    const { GET } = await import("@/app/api/search-entities/route");
    const res = await GET(makeReq("GET", undefined, "http://localhost/api/search-entities?type=tasks&q=a"));
    const json = await res.json();
    expect(json).toEqual([]);
  });

  it("returns task results for valid query", async () => {
    const { GET } = await import("@/app/api/search-entities/route");
    mockSql.mockResolvedValueOnce([{ id: "t1", name: "Image Classification" }]);
    const res = await GET(makeReq("GET", undefined, "http://localhost/api/search-entities?type=tasks&q=image"));
    const json = await res.json();
    expect(json).toHaveLength(1);
    expect(json[0].name).toBe("Image Classification");
  });

  it("returns dataset results for valid query", async () => {
    const { GET } = await import("@/app/api/search-entities/route");
    mockSql.mockResolvedValueOnce([{ id: "d1", name: "ImageNet" }]);
    const res = await GET(makeReq("GET", undefined, "http://localhost/api/search-entities?type=datasets&q=imagenet"));
    const json = await res.json();
    expect(json).toHaveLength(1);
  });
});
