import { getEffectiveSession } from "@/lib/effective-session";
import sql from "@/lib/db";
import { THRESHOLDS } from "@/lib/thresholds";
import { NextRequest, NextResponse } from "next/server";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getEffectiveSession();
  if (!session?.user?.github_id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const reproId = parseInt(id, 10);
  const userId = session.user.github_id;

  // Block self-hype
  const ownerCheck = await sql`
    SELECT 1 FROM reproductions WHERE id = ${reproId} AND user_id = ${userId}
  `;
  if (ownerCheck.length > 0) {
    return NextResponse.json({ error: "You cannot hype your own reproduction" }, { status: 403 });
  }

  const existing = await sql`
    SELECT 1 FROM reproduction_upvotes
    WHERE reproduction_id = ${reproId} AND user_id = ${userId}
  `;

  if (existing.length > 0) {
    // Un-upvote
    await sql`
      DELETE FROM reproduction_upvotes
      WHERE reproduction_id = ${reproId} AND user_id = ${userId}
    `;
    await sql`
      UPDATE reproductions SET upvote_count = upvote_count - 1 WHERE id = ${reproId}
    `;
    const [r] = await sql<[{ upvote_count: number }]>`
      SELECT upvote_count FROM reproductions WHERE id = ${reproId}
    `;
    return NextResponse.json({ upvoted: false, count: r.upvote_count });
  } else {
    // Upvote
    await sql`
      INSERT INTO reproduction_upvotes (reproduction_id, user_id)
      VALUES (${reproId}, ${userId})
    `;
    await sql`
      UPDATE reproductions SET upvote_count = upvote_count + 1 WHERE id = ${reproId}
    `;

    const [r] = await sql<[{ upvote_count: number; user_id: string }]>`
      SELECT upvote_count, user_id FROM reproductions WHERE id = ${reproId}
    `;

    // Award +REP_PER_UPVOTE to submitter for every upvote (no status change)
    await sql`
      UPDATE users SET reputation_score = reputation_score + ${THRESHOLDS.REP_PER_UPVOTE}
      WHERE github_id = ${r.user_id}
    `;

    return NextResponse.json({ upvoted: true, count: r.upvote_count });
  }
}
