import { NextRequest, NextResponse } from "next/server";
import { getPaperIndex } from "@/lib/queries";
import { getApiPaper } from "@/lib/public-data";
import { withDbGuard } from "@/lib/api-guard";
import { PUBLIC_API_CACHE as CACHE_HEADERS_VALUE } from "@/lib/api-guard";
import type { BadgeType } from "@/lib/verification";

const CACHE_HEADERS = { "Cache-Control": CACHE_HEADERS_VALUE };

export const GET = withDbGuard(async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ arxiv_id: string }> }
) {
  const { arxiv_id } = await params;

  // Only ids in the (cached) catalog index may reach a keyed query, so scrapers
  // enumerating arbitrary ids get a cheap 404 and never wake the database.
  const index = await getPaperIndex();
  if (!index.some((p) => p.arxiv_id === arxiv_id)) {
    return NextResponse.json({ error: "Not found" }, { status: 404, headers: CACHE_HEADERS });
  }

  const data = await getApiPaper(arxiv_id);
  if (!data) {
    return NextResponse.json({ error: "Not found" }, { status: 404, headers: CACHE_HEADERS });
  }
  const { paper, lbResults, codeLinks } = data;

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
  }, { headers: CACHE_HEADERS });
});
