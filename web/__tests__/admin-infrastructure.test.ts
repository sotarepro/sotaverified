/**
 * Tests for admin infrastructure: test tools (users, papers, impersonate, reset),
 * sign-up queue, effective session, and test-tools guard.
 */

const mockSql = jest.fn();
jest.mock("@/lib/db", () => {
  const sql = (..._args: unknown[]) => mockSql();
  return { __esModule: true, default: sql };
});

jest.mock("next-auth", () => ({
  getServerSession: jest.fn(),
}));

const mockCookieStore = {
  get: jest.fn(),
  set: jest.fn(),
  delete: jest.fn(),
};
jest.mock("next/headers", () => ({
  cookies: jest.fn().mockResolvedValue(mockCookieStore),
}));

jest.mock("@/lib/test-tools", () => ({
  isTestToolsEnabled: jest.fn().mockReturnValue(true),
}));

import { getServerSession } from "next-auth";
import { isTestToolsEnabled } from "@/lib/test-tools";
import { POST as USERS_POST, GET as USERS_GET } from "@/app/api/admin/test/users/route";
import { POST as PAPERS_POST, GET as PAPERS_GET } from "@/app/api/admin/test/papers/route";
import { POST as IMP_POST, DELETE as IMP_DELETE } from "@/app/api/admin/test/impersonate/route";
import { POST as RESET_POST } from "@/app/api/admin/test/reset/route";
import { GET as SIGNUPS_GET, PATCH as SIGNUPS_PATCH } from "@/app/api/admin/signups/route";
import { getEffectiveSession } from "@/lib/effective-session";
import { NextRequest } from "next/server";

const mockGSS = getServerSession as jest.MockedFunction<typeof getServerSession>;
const mockTestTools = isTestToolsEnabled as jest.MockedFunction<typeof isTestToolsEnabled>;
const ADMIN_ID = "admin-42";

function adminSession() {
  return { user: { github_id: ADMIN_ID, username: "admin" }, expires: "2099-01-01" };
}
function nonAdminSession() {
  return { user: { github_id: "not-admin", username: "user" }, expires: "2099-01-01" };
}

function makeReq(method: string, body?: unknown): NextRequest {
  return new NextRequest(new URL("http://localhost/api/test"), {
    method,
    body: body ? JSON.stringify(body) : undefined,
    headers: body ? { "content-type": "application/json" } : {},
  });
}

beforeAll(() => {
  process.env.ADMIN_GITHUB_ID = ADMIN_ID;
});

beforeEach(() => {
  mockSql.mockReset();
  mockGSS.mockReset();
  mockCookieStore.get.mockReset();
  mockCookieStore.set.mockReset();
  mockCookieStore.delete.mockReset();
  mockTestTools.mockReturnValue(true);
});

// ── Test Users ─────────────────────────────────────────────────────────────

describe("POST /api/admin/test/users", () => {
  it("returns 403 when test tools disabled", async () => {
    mockTestTools.mockReturnValue(false);
    const res = await USERS_POST(makeReq("POST", { preset: "new_user" }));
    expect(res.status).toBe(403);
  });

  it("returns 403 for non-admin", async () => {
    mockGSS.mockResolvedValueOnce(nonAdminSession());
    const res = await USERS_POST(makeReq("POST", { preset: "new_user" }));
    expect(res.status).toBe(403);
  });

  it("creates test_user preset", async () => {
    mockGSS.mockResolvedValueOnce(adminSession());
    mockSql.mockResolvedValueOnce([]);
    const res = await USERS_POST(makeReq("POST", { preset: "test_user" }));
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.github_id).toBe("test_user");
  });

  it("creates author preset", async () => {
    mockGSS.mockResolvedValueOnce(adminSession());
    mockSql.mockResolvedValueOnce([]);
    const res = await USERS_POST(makeReq("POST", { preset: "author" }));
    expect(res.status).toBe(200);
  });

  it("returns 400 for invalid preset", async () => {
    mockGSS.mockResolvedValueOnce(adminSession());
    const res = await USERS_POST(makeReq("POST", { preset: "nonexistent" }));
    expect(res.status).toBe(400);
  });

  it("GET lists test users", async () => {
    mockGSS.mockResolvedValueOnce(adminSession());
    mockSql.mockResolvedValueOnce([
      { github_id: "test_new_user", username: "test_new_user", reputation_score: 0, is_flagged_new_account: true },
    ]);
    const res = await USERS_GET();
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json).toHaveLength(1);
  });
});

// ── Test Papers ────────────────────────────────────────────────────────────

describe("POST /api/admin/test/papers", () => {
  it("creates basic test paper", async () => {
    mockGSS.mockResolvedValueOnce(adminSession());
    mockSql.mockResolvedValueOnce([]);
    const res = await PAPERS_POST(makeReq("POST", { preset: "basic" }));
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.paper_id).toBe("test_basic");
  });

  it("creates full test paper with code link (3 SQL calls)", async () => {
    mockGSS.mockResolvedValueOnce(adminSession());
    mockSql.mockResolvedValueOnce([]); // INSERT paper
    mockSql.mockResolvedValueOnce([]); // DELETE old links
    mockSql.mockResolvedValueOnce([]); // INSERT link
    const res = await PAPERS_POST(makeReq("POST", { preset: "full" }));
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.paper_id).toBe("test_full");
    expect(mockSql).toHaveBeenCalledTimes(3);
  });

  it("returns 400 for invalid preset", async () => {
    mockGSS.mockResolvedValueOnce(adminSession());
    const res = await PAPERS_POST(makeReq("POST", { preset: "invalid" }));
    expect(res.status).toBe(400);
  });

  it("GET lists test papers", async () => {
    mockGSS.mockResolvedValueOnce(adminSession());
    mockSql.mockResolvedValueOnce([{ id: "test_basic", title: "[TEST] Basic", verification_score: 0 }]);
    const res = await PAPERS_GET();
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json).toHaveLength(1);
  });

  it("returns 403 for non-admin", async () => {
    mockGSS.mockResolvedValueOnce(nonAdminSession());
    const res = await PAPERS_POST(makeReq("POST", { preset: "basic" }));
    expect(res.status).toBe(403);
  });
});

// ── Impersonation ──────────────────────────────────────────────────────────

describe("POST /api/admin/test/impersonate", () => {
  it("sets impersonation cookie for valid test user", async () => {
    mockGSS.mockResolvedValueOnce(adminSession());
    mockSql.mockResolvedValueOnce([{ github_id: "test_new_user", username: "test_new_user", is_test: true }]);
    const res = await IMP_POST(makeReq("POST", { github_id: "test_new_user" }));
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.username).toBe("test_new_user");
    expect(mockCookieStore.set).toHaveBeenCalledWith(
      "sv_impersonate",
      expect.stringContaining("test_new_user"),
      expect.objectContaining({ httpOnly: true, path: "/", maxAge: 86400 })
    );
  });

  it("returns 404 for non-test user", async () => {
    mockGSS.mockResolvedValueOnce(adminSession());
    mockSql.mockResolvedValueOnce([]);
    const res = await IMP_POST(makeReq("POST", { github_id: "real_user" }));
    expect(res.status).toBe(404);
  });

  it("returns 403 for non-admin", async () => {
    mockGSS.mockResolvedValueOnce(nonAdminSession());
    const res = await IMP_POST(makeReq("POST", { github_id: "test_new_user" }));
    expect(res.status).toBe(403);
  });
});

describe("DELETE /api/admin/test/impersonate", () => {
  it("clears impersonation cookie with maxAge=0", async () => {
    const res = await IMP_DELETE();
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(mockCookieStore.set).toHaveBeenCalledWith(
      "sv_impersonate", "",
      expect.objectContaining({ maxAge: 0, path: "/" })
    );
  });
});

// ── Reset ──────────────────────────────────────────────────────────────────

describe("POST /api/admin/test/reset", () => {
  it("deletes test data in FK-safe order and clears cookie", async () => {
    mockGSS.mockResolvedValueOnce(adminSession());
    mockSql.mockResolvedValueOnce([]); // DELETE activity_log
    mockSql.mockResolvedValueOnce([]); // DELETE users
    mockSql.mockResolvedValueOnce([]); // DELETE papers
    const res = await RESET_POST();
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(mockSql).toHaveBeenCalledTimes(3);
    expect(mockCookieStore.delete).toHaveBeenCalledWith("sv_impersonate");
  });

  it("returns 403 for non-admin", async () => {
    mockGSS.mockResolvedValueOnce(nonAdminSession());
    const res = await RESET_POST();
    expect(res.status).toBe(403);
  });
});

// ── Sign-up Queue ──────────────────────────────────────────────────────────

describe("GET /api/admin/signups", () => {
  it("returns pending sign-up requests for admin", async () => {
    mockGSS.mockResolvedValueOnce(adminSession());
    mockSql.mockResolvedValueOnce([
      { id: 1, github_id: "young", github_username: "young", account_age_days: 5, status: "pending", created_at: "2026-03-23" },
    ]);
    const res = await SIGNUPS_GET();
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json).toHaveLength(1);
    expect(json[0].github_username).toBe("young");
  });

  it("returns 403 for non-admin", async () => {
    mockGSS.mockResolvedValueOnce(nonAdminSession());
    const res = await SIGNUPS_GET();
    expect(res.status).toBe(403);
  });
});

describe("PATCH /api/admin/signups", () => {
  it("approves a pending sign-up", async () => {
    mockGSS.mockResolvedValueOnce(adminSession());
    mockSql.mockResolvedValueOnce([]);
    const res = await SIGNUPS_PATCH(makeReq("PATCH", { id: 1, action: "approve" }));
    expect(res.status).toBe(200);
    expect((await res.json()).ok).toBe(true);
  });

  it("rejects a pending sign-up", async () => {
    mockGSS.mockResolvedValueOnce(adminSession());
    mockSql.mockResolvedValueOnce([]);
    const res = await SIGNUPS_PATCH(makeReq("PATCH", { id: 1, action: "reject" }));
    expect(res.status).toBe(200);
  });

  it("clears all pending sign-ups", async () => {
    mockGSS.mockResolvedValueOnce(adminSession());
    mockSql.mockResolvedValueOnce([]);
    const res = await SIGNUPS_PATCH(makeReq("PATCH", { action: "clear_all" }));
    expect(res.status).toBe(200);
  });

  it("returns 400 for invalid action", async () => {
    mockGSS.mockResolvedValueOnce(adminSession());
    const res = await SIGNUPS_PATCH(makeReq("PATCH", { id: 1, action: "invalid" }));
    expect(res.status).toBe(400);
  });

  it("returns 403 for non-admin", async () => {
    mockGSS.mockResolvedValueOnce(nonAdminSession());
    const res = await SIGNUPS_PATCH(makeReq("PATCH", { id: 1, action: "approve" }));
    expect(res.status).toBe(403);
  });
});

// ── Effective Session ──────────────────────────────────────────────────────

describe("getEffectiveSession", () => {
  it("returns real session when no impersonation cookie", async () => {
    mockGSS.mockResolvedValueOnce(adminSession());
    mockCookieStore.get.mockReturnValueOnce(undefined);
    const session = await getEffectiveSession();
    expect(session?.user?.github_id).toBe(ADMIN_ID);
  });

  it("substitutes impersonated user when cookie present", async () => {
    mockGSS.mockResolvedValueOnce(adminSession());
    mockCookieStore.get.mockReturnValueOnce({
      value: JSON.stringify({ github_id: "test_new_user", username: "test_new_user" }),
    });
    const session = await getEffectiveSession();
    expect(session?.user?.github_id).toBe("test_new_user");
    expect(session?.user?.username).toBe("test_new_user");
  });

  it("falls back to real session on malformed cookie JSON", async () => {
    mockGSS.mockResolvedValueOnce(adminSession());
    mockCookieStore.get.mockReturnValueOnce({ value: "not{valid}json" });
    const session = await getEffectiveSession();
    expect(session?.user?.github_id).toBe(ADMIN_ID);
  });

  it("falls back to real session when cookie has empty github_id", async () => {
    mockGSS.mockResolvedValueOnce(adminSession());
    mockCookieStore.get.mockReturnValueOnce({
      value: JSON.stringify({ github_id: "", username: "test" }),
    });
    const session = await getEffectiveSession();
    expect(session?.user?.github_id).toBe(ADMIN_ID);
  });

  it("returns real session when test tools disabled", async () => {
    mockTestTools.mockReturnValue(false);
    mockGSS.mockResolvedValueOnce(adminSession());
    mockCookieStore.get.mockReturnValueOnce({
      value: JSON.stringify({ github_id: "test_new_user", username: "test" }),
    });
    const session = await getEffectiveSession();
    // Should ignore cookie when test tools disabled
    expect(session?.user?.github_id).toBe(ADMIN_ID);
  });
});
