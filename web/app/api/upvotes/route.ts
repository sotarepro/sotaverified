import { withDbGuard } from "@/lib/api-guard";
import { getEffectiveSession } from "@/lib/effective-session";
import sql from "@/lib/db";
import { logEvent } from "@/lib/activity";
import { getPaperIndex } from "@/lib/queries";
import { revalidateAfterWrite } from "@/lib/cache";
import { NextRequest, NextResponse } from "next/server";

async function GETHandler(req: NextRequest) {
  const paperId = req.nextUrl.searchParams.get("paper_id");
  if (!paperId) {
    return NextResponse.json({ error: "paper_id required" }, { status: 400 });
  }

  const session = await getEffectiveSession();
  const userId = session?.user?.github_id ?? null;

  // Count comes from the cached catalog index (no DB); unknown ids 404 cheaply.
  const paper = (await getPaperIndex()).find((p) => p.id === paperId);
  if (!paper) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const count = paper.upvote_count;

  let upvoted = false;
  if (userId) {
    const rows = await sql`
      SELECT 1 FROM upvotes WHERE paper_id = ${paperId} AND user_id = ${userId}
    `;
    upvoted = rows.length > 0;
  }

  return NextResponse.json(
    { count, upvoted },
    { headers: { "Cache-Control": userId ? "private, no-store" : "public, s-maxage=60, stale-while-revalidate=300" } },
  );
}

async function POSTHandler(req: NextRequest) {
  const session = await getEffectiveSession();
  if (!session?.user?.github_id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { paper_id } = await req.json();
  if (!paper_id) {
    return NextResponse.json({ error: "paper_id required" }, { status: 400 });
  }

  const userId = session.user.github_id;

  const known = await sql`SELECT 1 FROM papers WHERE id = ${paper_id}`;
  if (known.length === 0) {
    return NextResponse.json({ error: "Paper not found" }, { status: 404 });
  }

  // Check if already upvoted
  const existing = await sql`
    SELECT 1 FROM upvotes WHERE paper_id = ${paper_id} AND user_id = ${userId}
  `;

  if (existing.length > 0) {
    // Remove upvote
    await sql`DELETE FROM upvotes WHERE paper_id = ${paper_id} AND user_id = ${userId}`;
    await sql`UPDATE papers SET hype_score = GREATEST(hype_score - 1, 0) WHERE id = ${paper_id}`;
  } else {
    // Add upvote
    await sql`INSERT INTO upvotes (paper_id, user_id) VALUES (${paper_id}, ${userId})`;
    await sql`UPDATE papers SET hype_score = hype_score + 1 WHERE id = ${paper_id}`;
  }

  const [{ count }] = await sql<[{ count: number }]>`
    SELECT COALESCE(hype_score, 0)::int AS count FROM papers WHERE id = ${paper_id}
  `;

  await logEvent(existing.length > 0 ? "paper_unhyped" : "paper_hyped", {
    userId,
    paperId: paper_id,
  });

  revalidateAfterWrite({ paperId: paper_id, users: false });

  return NextResponse.json({ upvoted: existing.length === 0, count });
}

export const GET = withDbGuard(GETHandler);
export const POST = withDbGuard(POSTHandler);
