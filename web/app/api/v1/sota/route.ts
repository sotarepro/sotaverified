import sql from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import type { BadgeType } from "@/lib/verification";

// GET /api/v1/sota?min_score=0&sort=score&limit=20&task=...
// Returns papers sorted by verification_score
export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;

  const minScore = parseInt(params.get("min_score") ?? "0", 10) || 0;
  const sort = params.get("sort") ?? "score";
  const limitRaw = parseInt(params.get("limit") ?? "20", 10);
  const limit = Math.min(isNaN(limitRaw) ? 20 : limitRaw, 100);
  const task = params.get("task") ?? null;

  // Build ORDER BY clause
  let orderBy: string;
  if (sort === "recent") {
    orderBy = "p.published DESC NULLS LAST";
  } else if (sort === "reproductions") {
    orderBy = "repro_count DESC, p.verification_score DESC";
  } else {
    orderBy = "p.verification_score DESC";
  }

  // We can't use dynamic SQL fragments in tagged templates, so we'll use separate queries per sort
  type PaperRow = {
    id: string;
    arxiv_id: string | null;
    title: string;
    verification_score: number;
    repro_count: number;
    tasks: string[];
    published: string | null;
    has_repo: boolean;
    has_author: boolean;
  };

  let rows: PaperRow[];

  if (task) {
    if (sort === "recent") {
      rows = await sql<PaperRow[]>`
        SELECT
          p.id,
          p.arxiv_id,
          p.title,
          p.verification_score,
          (SELECT COUNT(*)::int FROM reproductions r WHERE r.paper_id = p.id AND r.status NOT IN ('hidden','removed')) AS repro_count,
          p.tasks,
          p.published::text AS published,
          EXISTS(SELECT 1 FROM paper_code_links cl WHERE cl.paper_id = p.id AND cl.is_official = true) AS has_repo,
          EXISTS(SELECT 1 FROM paper_authors pa WHERE pa.paper_id = p.id AND pa.status = 'verified') AS has_author
        FROM papers p
        WHERE p.verification_score >= ${minScore}
          AND ${task} = ANY(p.tasks)
        ORDER BY p.published DESC NULLS LAST
        LIMIT ${limit}
      `;
    } else if (sort === "reproductions") {
      rows = await sql<PaperRow[]>`
        SELECT
          p.id,
          p.arxiv_id,
          p.title,
          p.verification_score,
          (SELECT COUNT(*)::int FROM reproductions r WHERE r.paper_id = p.id AND r.status NOT IN ('hidden','removed')) AS repro_count,
          p.tasks,
          p.published::text AS published,
          EXISTS(SELECT 1 FROM paper_code_links cl WHERE cl.paper_id = p.id AND cl.is_official = true) AS has_repo,
          EXISTS(SELECT 1 FROM paper_authors pa WHERE pa.paper_id = p.id AND pa.status = 'verified') AS has_author
        FROM papers p
        WHERE p.verification_score >= ${minScore}
          AND ${task} = ANY(p.tasks)
        ORDER BY repro_count DESC, p.verification_score DESC
        LIMIT ${limit}
      `;
    } else {
      rows = await sql<PaperRow[]>`
        SELECT
          p.id,
          p.arxiv_id,
          p.title,
          p.verification_score,
          (SELECT COUNT(*)::int FROM reproductions r WHERE r.paper_id = p.id AND r.status NOT IN ('hidden','removed')) AS repro_count,
          p.tasks,
          p.published::text AS published,
          EXISTS(SELECT 1 FROM paper_code_links cl WHERE cl.paper_id = p.id AND cl.is_official = true) AS has_repo,
          EXISTS(SELECT 1 FROM paper_authors pa WHERE pa.paper_id = p.id AND pa.status = 'verified') AS has_author
        FROM papers p
        WHERE p.verification_score >= ${minScore}
          AND ${task} = ANY(p.tasks)
        ORDER BY p.verification_score DESC
        LIMIT ${limit}
      `;
    }
  } else {
    if (sort === "recent") {
      rows = await sql<PaperRow[]>`
        SELECT
          p.id,
          p.arxiv_id,
          p.title,
          p.verification_score,
          (SELECT COUNT(*)::int FROM reproductions r WHERE r.paper_id = p.id AND r.status NOT IN ('hidden','removed')) AS repro_count,
          p.tasks,
          p.published::text AS published,
          EXISTS(SELECT 1 FROM paper_code_links cl WHERE cl.paper_id = p.id AND cl.is_official = true) AS has_repo,
          EXISTS(SELECT 1 FROM paper_authors pa WHERE pa.paper_id = p.id AND pa.status = 'verified') AS has_author
        FROM papers p
        WHERE p.verification_score >= ${minScore}
        ORDER BY p.published DESC NULLS LAST
        LIMIT ${limit}
      `;
    } else if (sort === "reproductions") {
      rows = await sql<PaperRow[]>`
        SELECT
          p.id,
          p.arxiv_id,
          p.title,
          p.verification_score,
          (SELECT COUNT(*)::int FROM reproductions r WHERE r.paper_id = p.id AND r.status NOT IN ('hidden','removed')) AS repro_count,
          p.tasks,
          p.published::text AS published,
          EXISTS(SELECT 1 FROM paper_code_links cl WHERE cl.paper_id = p.id AND cl.is_official = true) AS has_repo,
          EXISTS(SELECT 1 FROM paper_authors pa WHERE pa.paper_id = p.id AND pa.status = 'verified') AS has_author
        FROM papers p
        WHERE p.verification_score >= ${minScore}
        ORDER BY repro_count DESC, p.verification_score DESC
        LIMIT ${limit}
      `;
    } else {
      rows = await sql<PaperRow[]>`
        SELECT
          p.id,
          p.arxiv_id,
          p.title,
          p.verification_score,
          (SELECT COUNT(*)::int FROM reproductions r WHERE r.paper_id = p.id AND r.status NOT IN ('hidden','removed')) AS repro_count,
          p.tasks,
          p.published::text AS published,
          EXISTS(SELECT 1 FROM paper_code_links cl WHERE cl.paper_id = p.id AND cl.is_official = true) AS has_repo,
          EXISTS(SELECT 1 FROM paper_authors pa WHERE pa.paper_id = p.id AND pa.status = 'verified') AS has_author
        FROM papers p
        WHERE p.verification_score >= ${minScore}
        ORDER BY p.verification_score DESC
        LIMIT ${limit}
      `;
    }
  }

  const papers = rows.map((row) => {
    let badge: BadgeType = "unverified";
    if (row.repro_count > 0) badge = "community_verified";
    else if (row.has_author) badge = "author_verified";
    else if (row.has_repo) badge = "code_available";

    return {
      arxiv_id: row.arxiv_id,
      title: row.title,
      verification_score: row.verification_score,
      badge,
      reproduction_count: row.repro_count,
      tasks: row.tasks ?? [],
      published: row.published,
    };
  });

  // Get total count for response
  let totalRow: [{ count: number }];
  if (task) {
    totalRow = await sql<[{ count: number }]>`
      SELECT COUNT(*)::int AS count FROM papers
      WHERE verification_score >= ${minScore} AND ${task} = ANY(tasks)
    `;
  } else {
    totalRow = await sql<[{ count: number }]>`
      SELECT COUNT(*)::int AS count FROM papers WHERE verification_score >= ${minScore}
    `;
  }

  return NextResponse.json({
    papers,
    total: totalRow[0]?.count ?? 0,
  });
}
