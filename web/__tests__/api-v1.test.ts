/**
 * Unit tests for Stage 3b Agent API (GET /api/v1/papers/{arxiv_id}).
 * All DB calls are mocked — no real network or DB connections.
 */

// Mock the postgres db module before importing routes
const mockSql = jest.fn();
jest.mock("@/lib/db", () => {
  const sql = (..._args: unknown[]) => mockSql();
  return { __esModule: true, default: sql };
});

import { GET } from "@/app/api/v1/papers/[arxiv_id]/route";
import { NextRequest } from "next/server";

function makeReq(method = "GET"): NextRequest {
  return new NextRequest(new URL("http://localhost/api/v1/papers/1706.03762"), { method });
}

const fakePaper = {
  id: "paper-internal-id-42",
  arxiv_id: "1706.03762",
  title: "Attention Is All You Need",
  abstract: "The dominant sequence transduction models...",
  authors: ["Ashish Vaswani", "Noam Shazeer"],
  tasks: ["Machine Translation"],
  published: "2017-06-12",
  verification_score: 5,
  has_repo: true,
  has_author: false,
  repro_count: 0,
};

const fakeLbResults = [
  {
    task_name: "Machine Translation",
    dataset_name: "WMT 2014 English-German",
    model_name: "Transformer (big)",
    metric_name: "BLEU score",
    metric_value: 28.4,
    verification: "unverified",
  },
];

const fakeCodeLinks = [
  {
    url: "https://github.com/tensorflow/tensor2tensor",
    is_official: true,
    framework: "TensorFlow",
    stars: 17096,
  },
];

describe("GET /api/v1/papers/[arxiv_id]", () => {
  beforeEach(() => {
    mockSql.mockClear();
  });

  it("returns structured JSON with required top-level fields", async () => {
    // Call 1: paper lookup
    mockSql.mockResolvedValueOnce([fakePaper]);
    // Calls 2 & 3: Promise.all — lbResults and codeLinks
    mockSql.mockResolvedValueOnce(fakeLbResults);
    mockSql.mockResolvedValueOnce(fakeCodeLinks);

    const params = { params: Promise.resolve({ arxiv_id: "1706.03762" }) };
    const res = await GET(makeReq(), params);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toHaveProperty("arxiv_id", "1706.03762");
    expect(json).toHaveProperty("title", "Attention Is All You Need");
    expect(json).toHaveProperty("abstract");
    expect(json).toHaveProperty("authors");
    expect(json).toHaveProperty("published");
    expect(json).toHaveProperty("tasks");
    expect(json).toHaveProperty("leaderboard");
    expect(json).toHaveProperty("code_links");
    expect(json).toHaveProperty("verification");
    expect(json).toHaveProperty("verification_score");
    expect(json).toHaveProperty("reproductions");
  });

  it("does NOT expose internal paper id or paper_id in response", async () => {
    mockSql.mockResolvedValueOnce([fakePaper]);
    mockSql.mockResolvedValueOnce(fakeLbResults);
    mockSql.mockResolvedValueOnce(fakeCodeLinks);

    const params = { params: Promise.resolve({ arxiv_id: "1706.03762" }) };
    const res = await GET(makeReq(), params);
    const json = await res.json();

    expect(json).not.toHaveProperty("id");
    expect(json).not.toHaveProperty("paper_id");
  });

  it("leaderboard_results items have required fields", async () => {
    mockSql.mockResolvedValueOnce([fakePaper]);
    mockSql.mockResolvedValueOnce(fakeLbResults);
    mockSql.mockResolvedValueOnce(fakeCodeLinks);

    const params = { params: Promise.resolve({ arxiv_id: "1706.03762" }) };
    const res = await GET(makeReq(), params);
    const json = await res.json();

    expect(json.leaderboard).toHaveLength(1);
    const lb = json.leaderboard[0];
    expect(lb).toHaveProperty("task");
    expect(lb).toHaveProperty("dataset");
    expect(lb).toHaveProperty("model");
    expect(lb).toHaveProperty("metric");
    expect(lb).toHaveProperty("value");
    expect(lb.task).toBe("Machine Translation");
    expect(lb.value).toBe(28.4);
  });

  it("code_links items have required fields", async () => {
    mockSql.mockResolvedValueOnce([fakePaper]);
    mockSql.mockResolvedValueOnce(fakeLbResults);
    mockSql.mockResolvedValueOnce(fakeCodeLinks);

    const params = { params: Promise.resolve({ arxiv_id: "1706.03762" }) };
    const res = await GET(makeReq(), params);
    const json = await res.json();

    expect(json.code_links).toHaveLength(1);
    const link = json.code_links[0];
    expect(link).toHaveProperty("url");
    expect(link).toHaveProperty("is_official");
    expect(link).toHaveProperty("stars");
    expect(link.is_official).toBe(true);
    expect(link.stars).toBe(17096);
  });

  it("makes exactly 3 sql calls total (paper + lb + code_links)", async () => {
    mockSql.mockResolvedValueOnce([fakePaper]);
    mockSql.mockResolvedValueOnce(fakeLbResults);
    mockSql.mockResolvedValueOnce(fakeCodeLinks);

    const params = { params: Promise.resolve({ arxiv_id: "1706.03762" }) };
    await GET(makeReq(), params);

    expect(mockSql).toHaveBeenCalledTimes(3);
  });

  it("returns 404 when paper is not found", async () => {
    // Paper lookup returns empty array
    mockSql.mockResolvedValueOnce([]);

    const params = { params: Promise.resolve({ arxiv_id: "0000.00000" }) };
    const res = await GET(makeReq(), params);
    const json = await res.json();

    expect(res.status).toBe(404);
    expect(json).toHaveProperty("error");
    // No further sql calls after empty paper result
    expect(mockSql).toHaveBeenCalledTimes(1);
  });

  it("returns empty arrays for leaderboard_results and code_links when none exist", async () => {
    mockSql.mockResolvedValueOnce([fakePaper]);
    mockSql.mockResolvedValueOnce([]);
    mockSql.mockResolvedValueOnce([]);

    const params = { params: Promise.resolve({ arxiv_id: "1706.03762" }) };
    const res = await GET(makeReq(), params);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.leaderboard).toEqual([]);
    expect(json.code_links).toEqual([]);
  });
});
