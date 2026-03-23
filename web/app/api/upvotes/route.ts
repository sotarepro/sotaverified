import { getEffectiveSession } from "@/lib/effective-session";
import sql from "@/lib/db";
import { logEvent } from "@/lib/activity";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const paperId = req.nextUrl.searchParams.get("paper_id");
  if (!paperId) {
    return NextResponse.json({ error: "paper_id required" }, { status: 400 });
  }

  const session = await getEffectiveSession();
  const userId = session?.user?.github_id ?? null;

  const [{ count }] = await sql<[{ count: number }]>`
    SELECT COALESCE(hype_score, 0)::int AS count FROM papers WHERE id = ${paperId}
  `;

  let upvoted = false;
  if (userId) {
    const rows = await sql`
      SELECT 1 FROM upvotes WHERE paper_id = ${paperId} AND user_id = ${userId}
    `;
    upvoted = rows.length > 0;
  }

  return NextResponse.json({ count, upvoted });
}

export async function POST(req: NextRequest) {
  const session = await getEffectiveSession();
  if (!session?.user?.github_id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { paper_id } = await req.json();
  if (!paper_id) {
    return NextResponse.json({ error: "paper_id required" }, { status: 400 });
  }

  const userId = session.user.github_id;

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

  return NextResponse.json({ upvoted: existing.length === 0, count });
}
