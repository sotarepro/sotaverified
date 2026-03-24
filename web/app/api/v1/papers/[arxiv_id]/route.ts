import { NextRequest, NextResponse } from "next/server";
import sql from "@/lib/db";
import type { BadgeType } from "@/lib/verification";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ arxiv_id: string }> }
) {
  const { arxiv_id } = await params;

  const papers = await sql<{
    id: string;
    arxiv_id: string;
    title: string;
    abstract: string | null;
    authors: string[];
    tasks: string[];
    published: string | null;
    verification_score: number;
    has_repo: boolean;
    has_author: boolean;
    repro_count: number;
  }[]>`
    SELECT p.id, p.arxiv_id, p.title, p.abstract, p.authors, p.tasks, p.published::text,
      p.verification_score,
      EXISTS(SELECT 1 FROM paper_code_links WHERE paper_id = p.id) AS has_repo,
      EXISTS(SELECT 1 FROM paper_authors WHERE paper_id = p.id AND status = 'verified') AS has_author,
      (SELECT COUNT(*)::int FROM reproductions WHERE paper_id = p.id AND status NOT IN ('hidden','removed')) AS repro_count
    FROM papers p
    WHERE p.arxiv_id = ${arxiv_id}
    LIMIT 1
  `;

  if (papers.length === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const paper = papers[0];

  const [lbResults, codeLinks] = await Promise.all([
    sql<{
      task_name: string;
      dataset_name: string;
      model_name: string;
      metric_name: string | null;
      metric_value: number | null;
      verification: string;
    }[]>`
      SELECT
        t.name  AS task_name,
        d.name  AS dataset_name,
        lr.model_name,
        lr.best_metric_name AS metric_name,
        lr.best_metric_value AS metric_value,
        lr.verification
      FROM leaderboard_results lr
      JOIN tasks t ON t.id = lr.task_id
      JOIN datasets d ON d.id = lr.dataset_id
      WHERE lr.paper_id = ${paper.id}
        AND lr.best_metric_value IS NOT NULL
      ORDER BY t.name, d.name
      LIMIT 50
    `,
    sql<{ url: string; is_official: boolean; framework: string | null; stars: number | null }[]>`
      SELECT repo_url AS url, is_official, framework, stars
      FROM paper_code_links
      WHERE paper_id = ${paper.id}
      ORDER BY is_official DESC, stars DESC NULLS LAST
    `,
  ]);

  let badge: BadgeType = "unverified";
  if (paper.repro_count > 0) badge = "community_verified";
  else if (paper.has_author) badge = "author_verified";
  else if (paper.has_repo) badge = "code_available";

  return NextResponse.json({
    arxiv_id: paper.arxiv_id,
    title: paper.title,
    abstract: paper.abstract,
    authors: paper.authors,
    published: paper.published,
    tasks: paper.tasks,
    verification: badge,
    verification_score: paper.verification_score,
    reproductions: paper.repro_count,
    leaderboard: lbResults.map((r) => ({
      task: r.task_name,
      dataset: r.dataset_name,
      model: r.model_name,
      metric: r.metric_name,
      value: r.metric_value,
      reproductions: 0,
    })),
    code_links: codeLinks.map((c) => ({
      url: c.url,
      is_official: c.is_official,
      stars: c.stars,
    })),
  });
}
