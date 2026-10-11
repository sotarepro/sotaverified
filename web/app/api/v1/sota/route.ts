import { NextRequest, NextResponse } from "next/server";
import type { BadgeType } from "@/lib/verification";
import { getSotaCorpus } from "@/lib/public-data";
import { withDbGuard, PUBLIC_API_CACHE } from "@/lib/api-guard";

// GET /api/v1/sota?min_score=0&sort=score&limit=20&task=...
// Returns papers sorted by verification_score.
// Served from one cached read of the catalog and filtered in memory, so no parameter
// combination ever queries the database; responses are also CDN-cacheable.
export const GET = withDbGuard(async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;

  const minScore = parseInt(params.get("min_score") ?? "0", 10) || 0;
  const sort = params.get("sort") ?? "score";
  const limitRaw = parseInt(params.get("limit") ?? "20", 10);
  const limit = Math.max(1, Math.min(isNaN(limitRaw) ? 20 : limitRaw, 100));
  const task = params.get("task") ?? null;

  const corpus = await getSotaCorpus();
  const matching = corpus.filter(
    (p) => p.verification_score >= minScore && (!task || (p.tasks ?? []).includes(task)),
  );

  const byScore = (a: (typeof corpus)[number], b: (typeof corpus)[number]) =>
    b.verification_score - a.verification_score;
  if (sort === "recent") {
    matching.sort((a, b) => (b.published ?? "").localeCompare(a.published ?? ""));
  } else if (sort === "reproductions") {
    matching.sort((a, b) => b.repro_count - a.repro_count || byScore(a, b));
  } else {
    matching.sort(byScore);
  }

  const papers = matching.slice(0, limit).map((row) => {
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

  return NextResponse.json(
    { papers, total: matching.length },
    { headers: { "Cache-Control": PUBLIC_API_CACHE } },
  );
});
