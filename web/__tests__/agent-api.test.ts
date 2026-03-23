/**
 * Unit tests for Agent Write API (POST /api/v1/reproductions).
 * Covers: auth, rate limiting by reputation tier, input validation,
 * arxiv_id lookup, and successful submission.
 */

const mockSql = jest.fn();
jest.mock("@/lib/db", () => {
  const sql = (..._args: unknown[]) => mockSql();
  return { __esModule: true, default: sql };
});

jest.mock("@/lib/verification", () => ({
  recomputeVerificationScore: jest.fn().mockResolvedValue(0),
}));

import { POST } from "@/app/api/v1/reproductions/route";
import { NextRequest } from "next/server";

function makeReq(body: unknown, apiKey = "test-api-key-123"): NextRequest {
  return new NextRequest(new URL("http://localhost/api/v1/reproductions"), {
    method: "POST",
    body: JSON.stringify(body),
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
    },
  });
}

const validBody = {
  arxiv_id: "2401.12345",
  tier_claimed: 2,
  hardware_spec: "RTX 3090, 24GB",
  run_log_url: "https://github.com/gist/abc123",
  notes: "Reproduced BLEU 28.4",
};

// Helper: mock the standard success path (key lookup, user rep, rate limit check, paper lookup, insert, logEvent)
function mockSuccessPath(opts: { rep?: number; recentCount?: number } = {}) {
  const { rep = 0, recentCount = 0 } = opts;
  mockSql.mockResolvedValueOnce([{ user_id: "agent-user-1" }]);           // key_hash lookup
  mockSql.mockResolvedValueOnce([{ reputation_score: rep }]);             // user rep
  mockSql.mockResolvedValueOnce([{ recent_count: recentCount }]);         // rate limit check
  mockSql.mockResolvedValueOnce([{ id: "paper-internal-42" }]);           // paper lookup
  mockSql.mockResolvedValueOnce([{ id: 99 }]);                           // INSERT
  // recomputeVerificationScore is mocked
  mockSql.mockResolvedValueOnce([]);                                      // logEvent
}

describe("POST /api/v1/reproductions", () => {
  beforeEach(() => mockSql.mockReset());

  // ── Auth ────────────────────────────────────────────────────────────────

  it("returns 401 when no Authorization header", async () => {
    const req = new NextRequest(new URL("http://localhost/api/v1/reproductions"), {
      method: "POST",
      body: JSON.stringify(validBody),
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toMatch(/authorization/i);
  });

  it("returns 401 when API key is invalid", async () => {
    mockSql.mockResolvedValueOnce([]);  // key lookup returns empty
    const res = await POST(makeReq(validBody, "bad-key"));
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toMatch(/invalid api key/i);
  });

  // ── Rate Limiting ──────────────────────────────────────────────────────

  it("rate-limits low-rep user (rep < 30) to 1/day", async () => {
    mockSql.mockResolvedValueOnce([{ user_id: "agent-user-1" }]);    // key lookup
    mockSql.mockResolvedValueOnce([{ reputation_score: 5 }]);        // rep < 30
    mockSql.mockResolvedValueOnce([{ recent_count: 1 }]);            // already hit 1/day
    mockSql.mockResolvedValueOnce([]);                                // logEvent for rate_limit_hit

    const res = await POST(makeReq(validBody));
    expect(res.status).toBe(429);
    const json = await res.json();
    expect(json.limit).toBe(1);
    expect(json.window_seconds).toBe(86400);
  });

  it("rate-limits mid-rep user (rep 30-199) to 5/hour", async () => {
    mockSql.mockResolvedValueOnce([{ user_id: "agent-user-1" }]);
    mockSql.mockResolvedValueOnce([{ reputation_score: 50 }]);
    mockSql.mockResolvedValueOnce([{ recent_count: 5 }]);
    mockSql.mockResolvedValueOnce([]);

    const res = await POST(makeReq(validBody));
    expect(res.status).toBe(429);
    const json = await res.json();
    expect(json.limit).toBe(5);
    expect(json.window_seconds).toBe(3600);
  });

  it("rate-limits high-rep user (rep 200+) to 20/hour", async () => {
    mockSql.mockResolvedValueOnce([{ user_id: "agent-user-1" }]);
    mockSql.mockResolvedValueOnce([{ reputation_score: 250 }]);
    mockSql.mockResolvedValueOnce([{ recent_count: 20 }]);
    mockSql.mockResolvedValueOnce([]);

    const res = await POST(makeReq(validBody));
    expect(res.status).toBe(429);
    const json = await res.json();
    expect(json.limit).toBe(20);
    expect(json.window_seconds).toBe(3600);
  });

  it("allows submission when under rate limit", async () => {
    mockSuccessPath({ rep: 5, recentCount: 0 });
    const res = await POST(makeReq(validBody));
    expect(res.status).toBe(201);
  });

  // ── Input Validation ───────────────────────────────────────────────────

  it("returns 400 when required fields are missing", async () => {
    // Need to pass auth + rate limit checks first
    mockSql.mockResolvedValueOnce([{ user_id: "agent-user-1" }]);
    mockSql.mockResolvedValueOnce([{ reputation_score: 0 }]);
    mockSql.mockResolvedValueOnce([{ recent_count: 0 }]);

    const res = await POST(makeReq({ arxiv_id: "2401.12345" }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/missing required/i);
  });

  it("returns 400 when tier_claimed is out of range", async () => {
    mockSql.mockResolvedValueOnce([{ user_id: "agent-user-1" }]);
    mockSql.mockResolvedValueOnce([{ reputation_score: 0 }]);
    mockSql.mockResolvedValueOnce([{ recent_count: 0 }]);

    const res = await POST(makeReq({ ...validBody, tier_claimed: 5 }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/tier_claimed/i);
  });

  it("returns 400 when hardware_spec exceeds 500 chars", async () => {
    mockSql.mockResolvedValueOnce([{ user_id: "agent-user-1" }]);
    mockSql.mockResolvedValueOnce([{ reputation_score: 0 }]);
    mockSql.mockResolvedValueOnce([{ recent_count: 0 }]);

    const res = await POST(makeReq({ ...validBody, hardware_spec: "x".repeat(501) }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/hardware_spec/i);
  });

  it("returns 400 when notes exceed 2000 chars", async () => {
    mockSql.mockResolvedValueOnce([{ user_id: "agent-user-1" }]);
    mockSql.mockResolvedValueOnce([{ reputation_score: 0 }]);
    mockSql.mockResolvedValueOnce([{ recent_count: 0 }]);

    const res = await POST(makeReq({ ...validBody, notes: "x".repeat(2001) }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/notes/i);
  });

  it("returns 400 when actual_metric_value is Infinity", async () => {
    mockSql.mockResolvedValueOnce([{ user_id: "agent-user-1" }]);
    mockSql.mockResolvedValueOnce([{ reputation_score: 0 }]);
    mockSql.mockResolvedValueOnce([{ recent_count: 0 }]);
    mockSql.mockResolvedValueOnce([{ id: "paper-42" }]); // paper found

    const res = await POST(makeReq({ ...validBody, actual_metric_name: "BLEU", actual_metric_value: "Infinity" }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/finite/i);
  });

  // ── Paper Lookup ──────────────────────────────────────────────────────

  it("returns 404 when arxiv_id not found", async () => {
    mockSql.mockResolvedValueOnce([{ user_id: "agent-user-1" }]);
    mockSql.mockResolvedValueOnce([{ reputation_score: 0 }]);
    mockSql.mockResolvedValueOnce([{ recent_count: 0 }]);
    mockSql.mockResolvedValueOnce([]);  // paper not found

    const res = await POST(makeReq(validBody));
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error).toMatch(/paper not found/i);
  });

  // ── Success ────────────────────────────────────────────────────────────

  it("returns 201 with {id, status: 'agent_pending'} on valid submission", async () => {
    mockSuccessPath();
    const res = await POST(makeReq(validBody));
    const json = await res.json();

    expect(res.status).toBe(201);
    expect(json).toHaveProperty("id", 99);
    expect(json).toHaveProperty("status", "agent_pending");
  });

  it("accepts optional metric fields", async () => {
    mockSuccessPath();
    const res = await POST(makeReq({
      ...validBody,
      actual_metric_name: "BLEU",
      actual_metric_value: 28.4,
    }));
    expect(res.status).toBe(201);
  });
});
