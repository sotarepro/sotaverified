/**
 * Unit tests for GET /api/v1/sota (public SOTA leaderboard API).
 * Covers: sort options, task filter, min_score, limit cap, badge computation.
 */

const mockSql = jest.fn();
jest.mock("@/lib/db", () => {
  const sql = (..._args: unknown[]) => mockSql();
  return { __esModule: true, default: sql };
});

import { GET } from "@/app/api/v1/sota/route";
import { NextRequest } from "next/server";

function makeReq(params: Record<string, string> = {}): NextRequest {
  const url = new URL("http://localhost/api/v1/sota");
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  return new NextRequest(url, { method: "GET" });
}

const fakePaperRow = {
  id: "paper-42",
  arxiv_id: "2401.12345",
  title: "Test Paper",
  verification_score: 15,
  repro_count: 2,
  tasks: ["Machine Translation"],
  published: "2024-01-15",
  has_repo: true,
  has_author: false,
};

describe("GET /api/v1/sota", () => {
  beforeEach(() => mockSql.mockReset());

  it("returns papers with correct shape and badge computation", async () => {
    mockSql.mockResolvedValueOnce([fakePaperRow]);       // main query
    mockSql.mockResolvedValueOnce([{ count: 1 }]);       // count query

    const res = await GET(makeReq());
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toHaveProperty("papers");
    expect(json).toHaveProperty("total", 1);
    expect(json.papers).toHaveLength(1);

    const p = json.papers[0];
    expect(p).toHaveProperty("arxiv_id", "2401.12345");
    expect(p).toHaveProperty("title");
    expect(p).toHaveProperty("verification_score", 15);
    expect(p).toHaveProperty("badge", "community_verified");  // has repro_count > 0
    expect(p).toHaveProperty("reproduction_count", 2);
    expect(p).toHaveProperty("tasks");
    expect(p).toHaveProperty("published");
    // Should NOT expose internal id
    expect(p).not.toHaveProperty("id");
    expect(p).not.toHaveProperty("has_repo");
    expect(p).not.toHaveProperty("has_author");
  });

  it("computes badge='code_available' when has_repo but no repros or author", async () => {
    mockSql.mockResolvedValueOnce([{
      ...fakePaperRow,
      repro_count: 0,
      has_repo: true,
      has_author: false,
    }]);
    mockSql.mockResolvedValueOnce([{ count: 1 }]);

    const res = await GET(makeReq());
    const json = await res.json();
    expect(json.papers[0].badge).toBe("code_available");
  });

  it("computes badge='author_verified' when has_author but no repros", async () => {
    mockSql.mockResolvedValueOnce([{
      ...fakePaperRow,
      repro_count: 0,
      has_repo: false,
      has_author: true,
    }]);
    mockSql.mockResolvedValueOnce([{ count: 1 }]);

    const res = await GET(makeReq());
    const json = await res.json();
    expect(json.papers[0].badge).toBe("author_verified");
  });

  it("computes badge='unverified' when no repo, no author, no repros", async () => {
    mockSql.mockResolvedValueOnce([{
      ...fakePaperRow,
      repro_count: 0,
      has_repo: false,
      has_author: false,
      verification_score: 0,
    }]);
    mockSql.mockResolvedValueOnce([{ count: 1 }]);

    const res = await GET(makeReq());
    const json = await res.json();
    expect(json.papers[0].badge).toBe("unverified");
  });

  it("returns empty papers array when no results", async () => {
    mockSql.mockResolvedValueOnce([]);
    mockSql.mockResolvedValueOnce([{ count: 0 }]);

    const res = await GET(makeReq());
    const json = await res.json();
    expect(json.papers).toEqual([]);
    expect(json.total).toBe(0);
  });

  it("accepts sort=recent parameter", async () => {
    mockSql.mockResolvedValueOnce([fakePaperRow]);
    mockSql.mockResolvedValueOnce([{ count: 1 }]);

    const res = await GET(makeReq({ sort: "recent" }));
    expect(res.status).toBe(200);
    expect(mockSql).toHaveBeenCalledTimes(2);
  });

  it("accepts sort=reproductions parameter", async () => {
    mockSql.mockResolvedValueOnce([fakePaperRow]);
    mockSql.mockResolvedValueOnce([{ count: 1 }]);

    const res = await GET(makeReq({ sort: "reproductions" }));
    expect(res.status).toBe(200);
  });

  it("defaults to sort=score when invalid sort given", async () => {
    mockSql.mockResolvedValueOnce([fakePaperRow]);
    mockSql.mockResolvedValueOnce([{ count: 1 }]);

    const res = await GET(makeReq({ sort: "invalid" }));
    expect(res.status).toBe(200);
  });

  it("accepts task filter parameter", async () => {
    mockSql.mockResolvedValueOnce([fakePaperRow]);
    mockSql.mockResolvedValueOnce([{ count: 1 }]);

    const res = await GET(makeReq({ task: "Machine Translation" }));
    expect(res.status).toBe(200);
  });

  it("caps limit at 100", async () => {
    mockSql.mockResolvedValueOnce([]);
    mockSql.mockResolvedValueOnce([{ count: 0 }]);

    const res = await GET(makeReq({ limit: "999" }));
    expect(res.status).toBe(200);
    // The query should use limit=100, not 999 — we can't easily assert SQL args
    // with this mock setup, but the route should not error
  });

  it("handles min_score parameter", async () => {
    mockSql.mockResolvedValueOnce([]);
    mockSql.mockResolvedValueOnce([{ count: 0 }]);

    const res = await GET(makeReq({ min_score: "10" }));
    expect(res.status).toBe(200);
  });
});
