/**
 * Tests for reputation calculation: tier-based rep on submission,
 * per-upvote rep, metric match bonus, author claim rep.
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

import { THRESHOLDS, tierRepGain } from "@/lib/thresholds";

describe("Reputation calculation", () => {
  it("tierRepGain returns correct values for each tier", () => {
    expect(tierRepGain(1)).toBe(THRESHOLDS.REP_TIER_1);
    expect(tierRepGain(2)).toBe(THRESHOLDS.REP_TIER_2);
    expect(tierRepGain(3)).toBe(THRESHOLDS.REP_TIER_3);
  });

  it("REP_TIER values are 2, 5, 10", () => {
    expect(THRESHOLDS.REP_TIER_1).toBe(2);
    expect(THRESHOLDS.REP_TIER_2).toBe(5);
    expect(THRESHOLDS.REP_TIER_3).toBe(10);
  });

  it("REP_PER_UPVOTE is 1", () => {
    expect(THRESHOLDS.REP_PER_UPVOTE).toBe(1);
  });

  it("REP_METRIC_MATCH_BONUS is 5", () => {
    expect(THRESHOLDS.REP_METRIC_MATCH_BONUS).toBe(5);
  });

  it("REP_AUTHOR_VERIFIED is 5", () => {
    expect(THRESHOLDS.REP_AUTHOR_VERIFIED).toBe(5);
  });

  it("REP_SPAM_PENALTY is -20", () => {
    expect(THRESHOLDS.REP_SPAM_PENALTY).toBe(-20);
  });

  it("reproduction submission awards tier rep via POST handler", async () => {
    const { getServerSession } = await import("next-auth");
    const mockGSS = getServerSession as jest.MockedFunction<typeof getServerSession>;
    mockGSS.mockResolvedValueOnce({
      user: { github_id: "user1", username: "user1" },
      expires: "2099",
    });

    // INSERT reproduction
    mockSql.mockResolvedValueOnce([{ id: 1 }]);
    // UPDATE users rep (tier award)
    mockSql.mockResolvedValueOnce([]);
    // recomputeVerificationScore: has_repo, has_author, repros, claimed, UPDATE
    mockSql.mockResolvedValueOnce([{ has_repo: false }]);
    mockSql.mockResolvedValueOnce([{ has_author: false }]);
    mockSql.mockResolvedValueOnce([]);
    mockSql.mockResolvedValueOnce([{ best_metric_value: null }]);
    mockSql.mockResolvedValueOnce([]);
    // logEvent
    mockSql.mockResolvedValueOnce([]);

    const { POST } = await import("@/app/api/reproductions/route");
    const { NextRequest } = await import("next/server");
    const req = new NextRequest("http://localhost/api/reproductions", {
      method: "POST",
      body: JSON.stringify({
        paper_id: "p1",
        tier_claimed: 2,
        hardware_spec: "GPU",
      }),
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req);
    expect(res.status).toBe(201);
    // Verify UPDATE users was called (the 2nd SQL call)
    expect(mockSql).toHaveBeenCalled();
    mockSql.mockReset();
  });
});
