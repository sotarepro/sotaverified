/**
 * Persona-based tests: new_user, trusted_user, and author personas
 * exercising the key flows each persona can/cannot do.
 *
 * Covers: upvote auto-verify, promote gate, flag weight, age gate,
 * and author claim scenarios.
 */

const mockSql = jest.fn();
jest.mock("@/lib/db", () => {
  const sql = (..._args: unknown[]) => mockSql();
  return { __esModule: true, default: sql };
});

// All these routes use getEffectiveSession (not getServerSession)
jest.mock("@/lib/effective-session", () => ({
  getEffectiveSession: jest.fn(),
}));

jest.mock("@/lib/verification", () => ({
  recomputeVerificationScore: jest.fn().mockResolvedValue(0),
}));

import { getEffectiveSession } from "@/lib/effective-session";
import { POST as REPRO_POST } from "@/app/api/reproductions/route";
import { POST as UPVOTE_POST } from "@/app/api/reproductions/[id]/upvote/route";
import { POST as PROMOTE_POST } from "@/app/api/reproductions/[id]/promote/route";
import { POST as FLAG_POST } from "@/app/api/reproductions/[id]/flag/route";
import { NextRequest } from "next/server";

const mockSession = getEffectiveSession as jest.MockedFunction<typeof getEffectiveSession>;

// ── Persona definitions ──────────────────────────────────────────────────────

function newUserSession() {
  return {
    user: { github_id: "test_new_user", username: "new_user", name: "New User", email: "new@test.com" },
    expires: "2099-01-01",
  };
}

function trustedUserSession() {
  return {
    user: { github_id: "test_trusted_user", username: "trusted_user", name: "Trusted User", email: "trusted@test.com" },
    expires: "2099-01-01",
  };
}

function authorSession() {
  return {
    user: { github_id: "test_author", username: "test_author", name: "Author User", email: "author@test.com" },
    expires: "2099-01-01",
  };
}

function makeReq(method: string, body?: unknown): NextRequest {
  return new NextRequest(new URL("http://localhost/api/test"), {
    method,
    body: body ? JSON.stringify(body) : undefined,
    headers: body ? { "content-type": "application/json" } : {},
  });
}

const validReproBody = {
  paper_id: "paper-42",
  tier_claimed: 2,
  hardware_spec: "RTX 3090",
  run_log_url: "https://github.com/gist/abc",
};

// ── New User Persona ─────────────────────────────────────────────────────────

describe("New User persona (rep=0, age-gated)", () => {
  beforeEach(() => {
    mockSql.mockReset();
    mockSession.mockReset();
  });

  it("cannot submit reproductions (age gate blocks)", async () => {
    mockSession.mockResolvedValueOnce(newUserSession());
    // User lookup → flagged as new
    mockSql.mockResolvedValueOnce([{ is_flagged_new_account: true }]);

    const res = await REPRO_POST(makeReq("POST", validReproBody));
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error).toMatch(/new/i);
  });

  it("can promote agent reproductions (no rep gate at launch)", async () => {
    mockSession.mockResolvedValueOnce(newUserSession());
    mockSql.mockResolvedValueOnce([{ source: "api", status: "agent_pending", paper_id: "p1" }]);
    mockSql.mockResolvedValueOnce([]);  // UPDATE status
    mockSql.mockResolvedValueOnce([]);  // logEvent

    const params = { params: Promise.resolve({ id: "42" }) };
    const res = await PROMOTE_POST(makeReq("POST"), params);
    expect(res.status).toBe(200);
  });
});

// ── Trusted User Persona ─────────────────────────────────────────────────────

describe("Trusted User persona (rep=30+)", () => {
  beforeEach(() => {
    mockSql.mockReset();
    mockSession.mockReset();
  });

  it("can submit reproductions (passes age gate)", async () => {
    mockSession.mockResolvedValueOnce(trustedUserSession());
    mockSql.mockResolvedValueOnce([{ is_flagged_new_account: false }]);  // age gate
    mockSql.mockResolvedValueOnce([{ id: 42 }]);                         // INSERT
    mockSql.mockResolvedValueOnce([]);                                    // logEvent

    const res = await REPRO_POST(makeReq("POST", validReproBody));
    expect(res.status).toBe(201);
  });

  it("can promote agent reproductions (no rep gate)", async () => {
    mockSession.mockResolvedValueOnce(trustedUserSession());
    mockSql.mockResolvedValueOnce([{ source: "api", status: "agent_pending", paper_id: "p1" }]);
    mockSql.mockResolvedValueOnce([]);  // UPDATE status
    mockSql.mockResolvedValueOnce([]);  // logEvent

    const params = { params: Promise.resolve({ id: "42" }) };
    const res = await PROMOTE_POST(makeReq("POST"), params);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toEqual({ ok: true, status: "community" });
  });

  it("cannot promote non-api reproductions", async () => {
    mockSession.mockResolvedValueOnce(trustedUserSession());
    mockSql.mockResolvedValueOnce([{ source: "community", status: "community", paper_id: "p1" }]);

    const params = { params: Promise.resolve({ id: "42" }) };
    const res = await PROMOTE_POST(makeReq("POST"), params);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/only agent/i);
  });

  it("cannot promote already-promoted reproductions", async () => {
    mockSession.mockResolvedValueOnce(trustedUserSession());
    mockSql.mockResolvedValueOnce([{ source: "api", status: "community", paper_id: "p1" }]);

    const params = { params: Promise.resolve({ id: "42" }) };
    const res = await PROMOTE_POST(makeReq("POST"), params);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/not in agent_pending/i);
  });

  it("flag at 2 does NOT auto-hide (threshold is 3 for all users)", async () => {
    mockSession.mockResolvedValueOnce(trustedUserSession());
    mockSql.mockResolvedValueOnce([]);                                     // no existing flag
    mockSql.mockResolvedValueOnce([]);                                     // INSERT flag
    mockSql.mockResolvedValueOnce([]);                                     // UPDATE increment
    // Fetch state: 2 flags, community status — NOT enough to hide
    mockSql.mockResolvedValueOnce([{ flag_count: 2, status: "community", user_id: "u1", paper_id: "p1" }]);
    mockSql.mockResolvedValueOnce([]);                                     // logEvent

    const params = { params: Promise.resolve({ id: "42" }) };
    const res = await FLAG_POST(makeReq("POST"), params);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.flagged).toBe(true);
    expect(json.count).toBe(2);
    // 5 calls: check + insert + update_count + fetch + logEvent (no hide)
    expect(mockSql).toHaveBeenCalledTimes(5);
  });
});

// ── Reproduction Upvote Auto-Verify ──────────────────────────────────────────

describe("Reproduction upvote auto-verification", () => {
  beforeEach(() => {
    mockSql.mockReset();
    mockSession.mockReset();
  });

  it("auto-verifies at 3+ upvotes from any users", async () => {
    mockSession.mockResolvedValueOnce(trustedUserSession());
    mockSql.mockResolvedValueOnce([]);                                     // owner check (not owner)
    mockSql.mockResolvedValueOnce([]);                                     // no existing upvote
    mockSql.mockResolvedValueOnce([]);                                     // INSERT upvote
    mockSql.mockResolvedValueOnce([]);                                     // UPDATE count +1
    // Fetch repro: 3 upvotes, community status, tier 2
    mockSql.mockResolvedValueOnce([{ upvote_count: 3, status: "community", user_id: "repro-author", tier_claimed: 2 }]);
    mockSql.mockResolvedValueOnce([]);                                     // UPDATE status='verified'
    mockSql.mockResolvedValueOnce([]);                                     // UPDATE rep (tier 2 = +10)

    const params = { params: Promise.resolve({ id: "42" }) };
    const res = await UPVOTE_POST(makeReq("POST"), params);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.upvoted).toBe(true);
    expect(json.count).toBe(3);
    // 7 calls: owner_check + check + insert + update_count + fetch + update_status + update_rep
    expect(mockSql).toHaveBeenCalledTimes(7);
  });

  it("does not auto-verify when upvote_count < 3", async () => {
    mockSession.mockResolvedValueOnce(trustedUserSession());
    mockSql.mockResolvedValueOnce([]);                                     // owner check
    mockSql.mockResolvedValueOnce([]);                                     // no existing upvote
    mockSql.mockResolvedValueOnce([]);                                     // INSERT upvote
    mockSql.mockResolvedValueOnce([]);                                     // UPDATE count +1
    // Only 2 upvotes total
    mockSql.mockResolvedValueOnce([{ upvote_count: 2, status: "community", user_id: "repro-author", tier_claimed: 2 }]);

    const params = { params: Promise.resolve({ id: "42" }) };
    const res = await UPVOTE_POST(makeReq("POST"), params);

    expect(res.status).toBe(200);
    expect(mockSql).toHaveBeenCalledTimes(5);
  });

  it("toggles upvote off (removes existing upvote)", async () => {
    mockSession.mockResolvedValueOnce(trustedUserSession());
    mockSql.mockResolvedValueOnce([]);                                     // owner check
    mockSql.mockResolvedValueOnce([{}]);                                   // existing upvote found
    mockSql.mockResolvedValueOnce([]);                                     // DELETE upvote
    mockSql.mockResolvedValueOnce([]);                                     // UPDATE count -1
    mockSql.mockResolvedValueOnce([{ upvote_count: 2 }]);                  // fetch new count

    const params = { params: Promise.resolve({ id: "42" }) };
    const res = await UPVOTE_POST(makeReq("POST"), params);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.upvoted).toBe(false);
    expect(json.count).toBe(2);
  });

  it("returns 401 when unauthenticated", async () => {
    mockSession.mockResolvedValueOnce(null);

    const params = { params: Promise.resolve({ id: "42" }) };
    const res = await UPVOTE_POST(makeReq("POST"), params);
    expect(res.status).toBe(401);
  });
});

// ── Author Persona ───────────────────────────────────────────────────────────

describe("Author persona (rep=10, 3yr account)", () => {
  beforeEach(() => {
    mockSql.mockReset();
    mockSession.mockReset();
  });

  it("can submit reproductions (passes age gate)", async () => {
    mockSession.mockResolvedValueOnce(authorSession());
    mockSql.mockResolvedValueOnce([{ is_flagged_new_account: false }]);
    mockSql.mockResolvedValueOnce([{ id: 42 }]);
    mockSql.mockResolvedValueOnce([]);

    const res = await REPRO_POST(makeReq("POST", validReproBody));
    expect(res.status).toBe(201);
  });

  it("can promote agent reproductions (no rep gate)", async () => {
    mockSession.mockResolvedValueOnce(authorSession());
    mockSql.mockResolvedValueOnce([{ source: "api", status: "agent_pending", paper_id: "p1" }]);
    mockSql.mockResolvedValueOnce([]);  // UPDATE
    mockSql.mockResolvedValueOnce([]);  // logEvent

    const params = { params: Promise.resolve({ id: "42" }) };
    const res = await PROMOTE_POST(makeReq("POST"), params);
    expect(res.status).toBe(200);
  });

  it("promote returns 404 for nonexistent reproduction", async () => {
    mockSession.mockResolvedValueOnce(trustedUserSession());
    mockSql.mockResolvedValueOnce([]);  // repro not found (empty array → undefined from destructuring)

    const params = { params: Promise.resolve({ id: "9999" }) };
    const res = await PROMOTE_POST(makeReq("POST"), params);
    expect(res.status).toBe(404);
  });
});
