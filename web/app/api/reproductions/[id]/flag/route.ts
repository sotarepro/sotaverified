import { getEffectiveSession } from "@/lib/effective-session";
import sql from "@/lib/db";
import { recomputeVerificationScore } from "@/lib/verification";
import { logEvent } from "@/lib/activity";
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

  const existing = await sql`
    SELECT 1 FROM reproduction_flags
    WHERE reproduction_id = ${reproId} AND user_id = ${userId}
  `;

  if (existing.length > 0) {
    // Unflag
    await sql`
      DELETE FROM reproduction_flags
      WHERE reproduction_id = ${reproId} AND user_id = ${userId}
    `;
    await sql`
      UPDATE reproductions SET flag_count = GREATEST(0, flag_count - 1) WHERE id = ${reproId}
    `;
    const [r] = await sql<[{ flag_count: number; paper_id: string }]>`
      SELECT flag_count, paper_id FROM reproductions WHERE id = ${reproId}
    `;
    await logEvent("reproduction_unflagged", {
      userId,
      paperId: r?.paper_id,
      metadata: { reproduction_id: reproId, flag_count: r?.flag_count },
    });
    return NextResponse.json({ flagged: false, count: r.flag_count });
  } else {
    await sql`
      INSERT INTO reproduction_flags (reproduction_id, user_id)
      VALUES (${reproId}, ${userId})
    `;
    await sql`
      UPDATE reproductions SET flag_count = flag_count + 1 WHERE id = ${reproId}
    `;

    const [r] = await sql<[{ flag_count: number; status: string; user_id: string; paper_id: string }]>`
      SELECT flag_count, status, user_id, paper_id FROM reproductions WHERE id = ${reproId}
    `;

    await logEvent("reproduction_flagged", {
      userId,
      paperId: r.paper_id,
      metadata: { reproduction_id: reproId, flag_count: r.flag_count },
    });

    // Auto-hide at FLAGS_TO_HIDE flags
    const shouldHide = r.flag_count >= THRESHOLDS.FLAGS_TO_HIDE;

    if (shouldHide && r.status !== 'hidden') {
      await sql`
        UPDATE reproductions SET status = 'hidden' WHERE id = ${reproId}
      `;
      await sql`
        UPDATE users SET reputation_score = reputation_score + ${THRESHOLDS.REP_SPAM_PENALTY}
        WHERE github_id = ${r.user_id}
      `;
      await recomputeVerificationScore(r.paper_id);
    }

    return NextResponse.json({ flagged: true, count: r.flag_count, hidden: shouldHide && r.status !== "hidden" });
  }
}
