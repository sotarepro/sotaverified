/**
 * Unit tests for paper detail data layer functions in @/lib/queries.
 * All DB calls are mocked — no real network or DB connections.
 */

// Mock the postgres db module before importing queries
const mockSql = jest.fn();
jest.mock("@/lib/db", () => {
  const sql = (..._args: unknown[]) => mockSql();
  return { __esModule: true, default: sql };
});

import { getPaper, getPaperCodeLinks, getPaperLeaderboardEntries } from "@/lib/queries";

const fakePaperDetail = {
  id: "paper-42",
  arxiv_id: "1706.03762",
  title: "Attention Is All You Need",
  abstract: "The dominant sequence transduction models...",
  url_abs: "https://arxiv.org/abs/1706.03762",
  url_pdf: "https://arxiv.org/pdf/1706.03762",
  published: "2017-06-12",
  authors: ["Ashish Vaswani", "Noam Shazeer"],
  proceeding: null,
  tasks: ["Machine Translation"],
  verification: "unverified",
};

const fakeCodeLinks = [
  {
    repo_url: "https://github.com/tensorflow/tensor2tensor",
    framework: "TensorFlow",
    is_official: true,
    mentioned_in_paper: true,
    stars: 15000,
    forks: 4000,
  },
];

const fakeLbEntries = [
  {
    task_name: "Machine Translation",
    task_id: "task-1",
    dataset_name: "WMT 2014 English-German",
    model_name: "Transformer (big)",
    best_metric_name: "BLEU score",
    best_metric_value: 28.4,
    verification: "unverified",
  },
];

describe("getPaper(id)", () => {
  beforeEach(() => mockSql.mockClear());

  it("returns PaperDetail object when paper exists", async () => {
    mockSql.mockResolvedValueOnce([fakePaperDetail]);

    const result = await getPaper("paper-42");

    expect(result).not.toBeNull();
    expect(result).toMatchObject({
      id: "paper-42",
      arxiv_id: "1706.03762",
      title: "Attention Is All You Need",
    });
    expect(mockSql).toHaveBeenCalledTimes(1);
  });

  it("returns null when paper is not found", async () => {
    mockSql.mockResolvedValueOnce([]);

    const result = await getPaper("nonexistent-id");

    expect(result).toBeNull();
    expect(mockSql).toHaveBeenCalledTimes(1);
  });

  it("returns a PaperDetail with all expected fields present", async () => {
    mockSql.mockResolvedValueOnce([fakePaperDetail]);

    const result = await getPaper("paper-42");

    expect(result).toHaveProperty("id");
    expect(result).toHaveProperty("arxiv_id");
    expect(result).toHaveProperty("title");
    expect(result).toHaveProperty("abstract");
    expect(result).toHaveProperty("url_abs");
    expect(result).toHaveProperty("url_pdf");
    expect(result).toHaveProperty("published");
    expect(result).toHaveProperty("authors");
    expect(result).toHaveProperty("tasks");
    expect(result).toHaveProperty("verification");
  });
});

describe("getPaperCodeLinks(id)", () => {
  beforeEach(() => mockSql.mockClear());

  it("returns code links array when links exist", async () => {
    mockSql.mockResolvedValueOnce(fakeCodeLinks);

    const result = await getPaperCodeLinks("paper-42");

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      repo_url: "https://github.com/tensorflow/tensor2tensor",
      framework: "TensorFlow",
      is_official: true,
    });
    expect(mockSql).toHaveBeenCalledTimes(1);
  });

  it("returns empty array (not an error) when no code links exist", async () => {
    mockSql.mockResolvedValueOnce([]);

    const result = await getPaperCodeLinks("paper-42");

    expect(result).toEqual([]);
    expect(Array.isArray(result)).toBe(true);
    expect(mockSql).toHaveBeenCalledTimes(1);
  });

  it("returns multiple links when they exist", async () => {
    const multipleLinks = [
      ...fakeCodeLinks,
      {
        repo_url: "https://github.com/jadore801120/attention-is-all-you-need-pytorch",
        framework: "PyTorch",
        is_official: false,
        mentioned_in_paper: false,
        stars: 8000,
        forks: 2000,
      },
    ];
    mockSql.mockResolvedValueOnce(multipleLinks);

    const result = await getPaperCodeLinks("paper-42");

    expect(result).toHaveLength(2);
  });
});

describe("getPaperLeaderboardEntries(id)", () => {
  beforeEach(() => mockSql.mockClear());

  it("returns leaderboard entries array when entries exist", async () => {
    mockSql.mockResolvedValueOnce(fakeLbEntries);

    const result = await getPaperLeaderboardEntries("paper-42");

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      task_name: "Machine Translation",
      dataset_name: "WMT 2014 English-German",
      model_name: "Transformer (big)",
      best_metric_name: "BLEU score",
      best_metric_value: 28.4,
    });
    expect(mockSql).toHaveBeenCalledTimes(1);
  });

  it("returns empty array (not an error) when no entries exist", async () => {
    mockSql.mockResolvedValueOnce([]);

    const result = await getPaperLeaderboardEntries("paper-42");

    expect(result).toEqual([]);
    expect(Array.isArray(result)).toBe(true);
    expect(mockSql).toHaveBeenCalledTimes(1);
  });

  it("returns entries with all PaperLbEntry fields", async () => {
    mockSql.mockResolvedValueOnce(fakeLbEntries);

    const result = await getPaperLeaderboardEntries("paper-42");
    const entry = result[0];

    expect(entry).toHaveProperty("task_name");
    expect(entry).toHaveProperty("task_id");
    expect(entry).toHaveProperty("dataset_name");
    expect(entry).toHaveProperty("model_name");
    expect(entry).toHaveProperty("best_metric_name");
    expect(entry).toHaveProperty("best_metric_value");
    expect(entry).toHaveProperty("verification");
  });
});
