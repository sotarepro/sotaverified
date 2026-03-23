/**
 * Tests for verification score computation and badge logic.
 * Unlike other tests, these do NOT mock recomputeVerificationScore —
 * they test the real computation with mocked DB results.
 */

const mockSql = jest.fn();
jest.mock("@/lib/db", () => {
  const sql = (..._args: unknown[]) => mockSql();
  return { __esModule: true, default: sql };
});

import { recomputeVerificationScore, getBadgeData } from "@/lib/verification";

describe("recomputeVerificationScore", () => {
  beforeEach(() => mockSql.mockReset());

  it("returns 0 for paper with no repo, no author, no repros", async () => {
    mockSql.mockResolvedValueOnce([{ has_repo: false }]);    // repo check
    mockSql.mockResolvedValueOnce([{ has_author: false }]);  // author check
    mockSql.mockResolvedValueOnce([]);                        // no repros
    mockSql.mockResolvedValueOnce([]);                        // no claimed value
    mockSql.mockResolvedValueOnce([]);                        // UPDATE

    const score = await recomputeVerificationScore("p1");
    expect(score).toBe(0);
  });

  it("returns 5 for paper with official repo only", async () => {
    mockSql.mockResolvedValueOnce([{ has_repo: true }]);
    mockSql.mockResolvedValueOnce([{ has_author: false }]);
    mockSql.mockResolvedValueOnce([]);
    mockSql.mockResolvedValueOnce([]);
    mockSql.mockResolvedValueOnce([]);

    const score = await recomputeVerificationScore("p1");
    expect(score).toBe(5);
  });

  it("returns 15 for paper with official repo + verified author", async () => {
    mockSql.mockResolvedValueOnce([{ has_repo: true }]);     // +5
    mockSql.mockResolvedValueOnce([{ has_author: true }]);   // +10
    mockSql.mockResolvedValueOnce([]);
    mockSql.mockResolvedValueOnce([]);
    mockSql.mockResolvedValueOnce([]);

    const score = await recomputeVerificationScore("p1");
    expect(score).toBe(15);
  });

  it("adds +10 per active reproduction", async () => {
    mockSql.mockResolvedValueOnce([{ has_repo: false }]);
    mockSql.mockResolvedValueOnce([{ has_author: false }]);
    mockSql.mockResolvedValueOnce([                            // 2 repros
      { actual_metric_value: null, hardware_spec: "RTX 3090" },
      { actual_metric_value: null, hardware_spec: "A100" },
    ]);
    mockSql.mockResolvedValueOnce([]);                         // no claimed
    mockSql.mockResolvedValueOnce([]);

    const score = await recomputeVerificationScore("p1");
    // 2 repros * 10 = 20 base + 2 unique hardware * 3 = 6 → 26
    expect(score).toBe(26);
  });

  it("adds +5 bonus for reproduction within 5% of claimed metric", async () => {
    mockSql.mockResolvedValueOnce([{ has_repo: true }]);       // +5
    mockSql.mockResolvedValueOnce([{ has_author: false }]);
    mockSql.mockResolvedValueOnce([
      { actual_metric_value: 95.2, hardware_spec: "RTX 3090" },  // within 5% of 95.0
      { actual_metric_value: 80.0, hardware_spec: "A100" },      // NOT within 5% of 95.0
    ]);
    mockSql.mockResolvedValueOnce([{ best_metric_value: 95.0 }]);
    mockSql.mockResolvedValueOnce([]);

    const score = await recomputeVerificationScore("p1");
    // repo=5 + 2*10=20 + 1 bonus=5 + 2 hardware=6 → 36
    expect(score).toBe(36);
  });

  it("adds +3 per unique hardware config (case-insensitive, trimmed)", async () => {
    mockSql.mockResolvedValueOnce([{ has_repo: false }]);
    mockSql.mockResolvedValueOnce([{ has_author: false }]);
    mockSql.mockResolvedValueOnce([
      { actual_metric_value: null, hardware_spec: "RTX 3090" },
      { actual_metric_value: null, hardware_spec: "rtx 3090" },   // same, different case
      { actual_metric_value: null, hardware_spec: " A100 " },     // trimmed = "a100"
    ]);
    mockSql.mockResolvedValueOnce([]);
    mockSql.mockResolvedValueOnce([]);

    const score = await recomputeVerificationScore("p1");
    // 3 repros * 10 = 30 + 2 unique hardware ("rtx 3090", "a100") * 3 = 6 → 36
    expect(score).toBe(36);
  });

  it("handles claimedValue=0 without division by zero", async () => {
    mockSql.mockResolvedValueOnce([{ has_repo: false }]);
    mockSql.mockResolvedValueOnce([{ has_author: false }]);
    mockSql.mockResolvedValueOnce([
      { actual_metric_value: 0, hardware_spec: "RTX 3090" },
    ]);
    mockSql.mockResolvedValueOnce([{ best_metric_value: 0 }]);  // edge case!
    mockSql.mockResolvedValueOnce([]);

    const score = await recomputeVerificationScore("p1");
    // repo=0 + author=0 + 1*10=10 + bonus=0 (skipped due to claimedValue=0) + 1*3=3 → 13
    expect(score).toBe(13);
  });

  it("computes full score: repo + author + repros + bonus + hardware", async () => {
    mockSql.mockResolvedValueOnce([{ has_repo: true }]);       // +5
    mockSql.mockResolvedValueOnce([{ has_author: true }]);     // +10
    mockSql.mockResolvedValueOnce([
      { actual_metric_value: 94.8, hardware_spec: "RTX 3090" },  // within 5%
      { actual_metric_value: 95.1, hardware_spec: "A100 80GB" }, // within 5%
      { actual_metric_value: 80.0, hardware_spec: "T4" },        // NOT within 5%
    ]);
    mockSql.mockResolvedValueOnce([{ best_metric_value: 95.0 }]);
    mockSql.mockResolvedValueOnce([]);

    const score = await recomputeVerificationScore("p1");
    // repo=5 + author=10 + 3*10=30 + 2 bonus=10 + 3 hardware=9 → 64
    expect(score).toBe(64);
  });
});

describe("getBadgeData", () => {
  beforeEach(() => mockSql.mockReset());

  it("returns 'unverified' when no repo, author, or repros", async () => {
    mockSql.mockResolvedValueOnce([{
      has_repo: false,
      has_author: false,
      repro_count: 0,
      verification_score: 0,
    }]);

    const result = await getBadgeData("p1");
    expect(result.badge).toBe("unverified");
    expect(result.reproduction_count).toBe(0);
    expect(result.verification_score).toBe(0);
  });

  it("returns 'code_available' when has_repo but nothing else", async () => {
    mockSql.mockResolvedValueOnce([{
      has_repo: true,
      has_author: false,
      repro_count: 0,
      verification_score: 5,
    }]);

    const result = await getBadgeData("p1");
    expect(result.badge).toBe("code_available");
  });

  it("returns 'author_verified' when has_author (takes priority over code_available)", async () => {
    mockSql.mockResolvedValueOnce([{
      has_repo: true,
      has_author: true,
      repro_count: 0,
      verification_score: 15,
    }]);

    const result = await getBadgeData("p1");
    expect(result.badge).toBe("author_verified");
  });

  it("returns 'community_verified' when has repros (highest priority)", async () => {
    mockSql.mockResolvedValueOnce([{
      has_repo: true,
      has_author: true,
      repro_count: 2,
      verification_score: 45,
    }]);

    const result = await getBadgeData("p1");
    expect(result.badge).toBe("community_verified");
    expect(result.reproduction_count).toBe(2);
    expect(result.verification_score).toBe(45);
  });
});
