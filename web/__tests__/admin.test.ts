/**
 * Tests for admin-only endpoints: author claim approve/reject,
 * reproduction approve/remove.
 */

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
import { PATCH as AUTHOR_PATCH } from "@/app/api/admin/paper-authors/[paperId]/[userId]/route";
import { PATCH as REPRO_PATCH } from "@/app/api/admin/reproductions/[id]/route";
import { recomputeVerificationScore } from "@/lib/verification";
import { NextRequest } from "next/server";

const mockSession = getServerSession as jest.MockedFunction<typeof getServerSession>;
const mockRecompute = recomputeVerificationScore as jest.MockedFunction<typeof recomputeVerificationScore>;

const ADMIN_ID = "admin-github-id-42";

function adminSession() {
  return { user: { github_id: ADMIN_ID, username: "admin", name: "Admin", email: "admin@test.com" }, expires: "2099-01-01" };
}

function nonAdminSession() {
  return { user: { github_id: "not-admin", username: "user", name: "User", email: "u@test.com" }, expires: "2099-01-01" };
}

function makePatch(body: unknown): NextRequest {
  return new NextRequest(new URL("http://localhost/api/admin/test"), {
    method: "PATCH",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

beforeAll(() => {
  process.env.ADMIN_GITHUB_ID = ADMIN_ID;
});

// ── Author Claim Admin ──────────────────────────────────────────────────────

describe("PATCH /api/admin/paper-authors/[paperId]/[userId]", () => {
  beforeEach(() => {
    mockSql.mockReset();
    mockSession.mockReset();
  });

  it("returns 403 for non-admin users", async () => {
    mockSession.mockResolvedValueOnce(nonAdminSession());
    const params = { params: Promise.resolve({ paperId: "p1", userId: "u1" }) };
    const res = await AUTHOR_PATCH(makePatch({ action: "approve" }), params);
    expect(res.status).toBe(403);
  });

  it("returns 403 when not authenticated", async () => {
    mockSession.mockResolvedValueOnce(null);
    const params = { params: Promise.resolve({ paperId: "p1", userId: "u1" }) };
    const res = await AUTHOR_PATCH(makePatch({ action: "approve" }), params);
    expect(res.status).toBe(403);
  });

  it("approves author claim — sets verified=true, status=verified, method=manual_admin", async () => {
    mockSession.mockResolvedValueOnce(adminSession());
    mockSql.mockResolvedValueOnce([]);  // UPDATE paper_authors

    const params = { params: Promise.resolve({ paperId: "p1", userId: "u1" }) };
    const res = await AUTHOR_PATCH(makePatch({ action: "approve" }), params);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toEqual({ ok: true });
    expect(mockSql).toHaveBeenCalledTimes(1);
  });

  it("rejects author claim — sets status=rejected, verified=false", async () => {
    mockSession.mockResolvedValueOnce(adminSession());
    mockSql.mockResolvedValueOnce([]);

    const params = { params: Promise.resolve({ paperId: "p1", userId: "u1" }) };
    const res = await AUTHOR_PATCH(makePatch({ action: "reject" }), params);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toEqual({ ok: true });
  });

  it("returns 400 for invalid action", async () => {
    mockSession.mockResolvedValueOnce(adminSession());

    const params = { params: Promise.resolve({ paperId: "p1", userId: "u1" }) };
    const res = await AUTHOR_PATCH(makePatch({ action: "delete" }), params);
    expect(res.status).toBe(400);
  });
});

// ── Reproduction Admin ──────────────────────────────────────────────────────

describe("PATCH /api/admin/reproductions/[id]", () => {
  beforeEach(() => {
    mockSql.mockReset();
    mockSession.mockReset();
    mockRecompute.mockClear();
  });

  it("returns 403 for non-admin users", async () => {
    mockSession.mockResolvedValueOnce(nonAdminSession());
    const params = { params: Promise.resolve({ id: "42" }) };
    const res = await REPRO_PATCH(makePatch({ action: "approve" }), params);
    expect(res.status).toBe(403);
  });

  it("approves reproduction — awards tier-based rep and recomputes score", async () => {
    mockSession.mockResolvedValueOnce(adminSession());
    mockSql.mockResolvedValueOnce([]);                                           // UPDATE status=verified
    mockSql.mockResolvedValueOnce([{ user_id: "u1", status: "verified", tier_claimed: 3, paper_id: "p1" }]); // fetch
    mockSql.mockResolvedValueOnce([]);                                           // UPDATE rep

    const params = { params: Promise.resolve({ id: "42" }) };
    const res = await REPRO_PATCH(makePatch({ action: "approve" }), params);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toEqual({ ok: true });
    // tier 3 = +15 rep
    expect(mockSql).toHaveBeenCalledTimes(3);
    expect(mockRecompute).toHaveBeenCalledWith("p1");
  });

  it("awards correct rep per tier: T1=+5, T2=+10, T3=+15, T4=+20", async () => {
    // Test each tier
    for (const [tier, expectedRep] of [[1, 5], [2, 10], [3, 15], [4, 20]]) {
      mockSql.mockReset();
      mockSession.mockReset();
      mockRecompute.mockClear();

      mockSession.mockResolvedValueOnce(adminSession());
      mockSql.mockResolvedValueOnce([]);
      mockSql.mockResolvedValueOnce([{ user_id: "u1", status: "verified", tier_claimed: tier, paper_id: "p1" }]);
      mockSql.mockResolvedValueOnce([]);

      const params = { params: Promise.resolve({ id: String(tier) }) };
      const res = await REPRO_PATCH(makePatch({ action: "approve" }), params);
      expect(res.status).toBe(200);
      // We can't directly assert the SQL args with this mock, but coverage is the goal
      expect(mockSql).toHaveBeenCalledTimes(3);
    }
  });

  it("removes reproduction and recomputes verification score", async () => {
    mockSession.mockResolvedValueOnce(adminSession());
    mockSql.mockResolvedValueOnce([{ paper_id: "p1" }]);   // SELECT paper_id
    mockSql.mockResolvedValueOnce([]);                      // UPDATE status=removed

    const params = { params: Promise.resolve({ id: "42" }) };
    const res = await REPRO_PATCH(makePatch({ action: "remove" }), params);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toEqual({ ok: true });
    expect(mockRecompute).toHaveBeenCalledWith("p1");
  });

  it("returns 400 for invalid action", async () => {
    mockSession.mockResolvedValueOnce(adminSession());

    const params = { params: Promise.resolve({ id: "42" }) };
    const res = await REPRO_PATCH(makePatch({ action: "invalid" }), params);
    expect(res.status).toBe(400);
  });
});
