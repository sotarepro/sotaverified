/**
 * Tests for flagged reproduction lifecycle:
 * flag → auto-hide → admin restore/remove → verification recompute.
 */

const mockSql = jest.fn();
jest.mock("@/lib/db", () => {
  const sql = (..._args: unknown[]) => mockSql();
  sql.unsafe = (..._args: unknown[]) => mockSql();
  return { __esModule: true, default: sql };
});

jest.mock("next-auth", () => ({
  getServerSession: jest.fn(),
}));

const mockCookieStore = { get: jest.fn(), set: jest.fn(), delete: jest.fn() };
jest.mock("next/headers", () => ({
  cookies: jest.fn().mockResolvedValue(mockCookieStore),
}));

import { getServerSession } from "next-auth";
import { NextRequest } from "next/server";

const mockGSS = getServerSession as jest.MockedFunction<typeof getServerSession>;
const ADMIN_ID = "admin-42";

function adminSession() {
  return { user: { github_id: ADMIN_ID, username: "admin" }, expires: "2099" };
}

beforeAll(() => {
  process.env.ADMIN_GITHUB_ID = ADMIN_ID;
});

beforeEach(() => {
  mockSql.mockReset();
  mockGSS.mockReset();
});

describe("Admin reproduction actions", () => {
  it("restore sets status=community, resets flag_count, clears flags", async () => {
    mockGSS.mockResolvedValueOnce(adminSession());
    mockSql.mockResolvedValueOnce([]);                    // UPDATE status+flag_count
    mockSql.mockResolvedValueOnce([]);                    // DELETE reproduction_flags
    mockSql.mockResolvedValueOnce([{ paper_id: "p1" }]); // SELECT paper_id
    // recomputeVerificationScore: has_repo, has_author, repros, claimed, UPDATE
    mockSql.mockResolvedValueOnce([{ has_repo: false }]);
    mockSql.mockResolvedValueOnce([{ has_author: false }]);
    mockSql.mockResolvedValueOnce([]);
    mockSql.mockResolvedValueOnce([{ best_metric_value: null }]);
    mockSql.mockResolvedValueOnce([]);

    const { PATCH } = await import("@/app/api/admin/reproductions/[id]/route");
    const req = new NextRequest("http://localhost/api/admin/reproductions/42", {
      method: "PATCH",
      body: JSON.stringify({ action: "restore" }),
      headers: { "content-type": "application/json" },
    });
    const res = await PATCH(req, { params: Promise.resolve({ id: "42" }) });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    mockSql.mockReset();
  });

  it("remove sets status=removed and recomputes verification", async () => {
    mockGSS.mockResolvedValueOnce(adminSession());
    mockSql.mockResolvedValueOnce([{ paper_id: "p1" }]); // SELECT paper_id
    mockSql.mockResolvedValueOnce([]);                    // UPDATE status=removed
    // recomputeVerificationScore: has_repo, has_author, repros, claimed, UPDATE
    mockSql.mockResolvedValueOnce([{ has_repo: false }]);
    mockSql.mockResolvedValueOnce([{ has_author: false }]);
    mockSql.mockResolvedValueOnce([]);
    mockSql.mockResolvedValueOnce([{ best_metric_value: null }]);
    mockSql.mockResolvedValueOnce([]);

    const { PATCH } = await import("@/app/api/admin/reproductions/[id]/route");
    const req = new NextRequest("http://localhost/api/admin/reproductions/42", {
      method: "PATCH",
      body: JSON.stringify({ action: "remove" }),
      headers: { "content-type": "application/json" },
    });
    const res = await PATCH(req, { params: Promise.resolve({ id: "42" }) });
    expect(res.status).toBe(200);
    mockSql.mockReset();
  });

  it("returns 403 for non-admin", async () => {
    mockGSS.mockResolvedValueOnce({ user: { github_id: "not-admin" }, expires: "2099" });

    const { PATCH } = await import("@/app/api/admin/reproductions/[id]/route");
    const req = new NextRequest("http://localhost/api/admin/reproductions/42", {
      method: "PATCH",
      body: JSON.stringify({ action: "restore" }),
      headers: { "content-type": "application/json" },
    });
    const res = await PATCH(req, { params: Promise.resolve({ id: "42" }) });
    expect(res.status).toBe(403);
  });
});

describe("Flag auto-hide threshold", () => {
  it("FLAGS_TO_HIDE is 2", async () => {
    const { THRESHOLDS } = await import("@/lib/thresholds");
    expect(THRESHOLDS.FLAGS_TO_HIDE).toBe(2);
  });
});
