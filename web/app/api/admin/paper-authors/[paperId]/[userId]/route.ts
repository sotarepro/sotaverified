import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import sql from "@/lib/db";
import { recomputeVerificationScore } from "@/lib/verification";
import { THRESHOLDS } from "@/lib/thresholds";
import { NextRequest, NextResponse } from "next/server";

function isAdmin(githubId: string | undefined): boolean {
  return !!githubId && githubId === process.env.ADMIN_GITHUB_ID;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ paperId: string; userId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!isAdmin(session?.user?.github_id)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { paperId, userId } = await params;
  const { action } = await req.json();

  if (action === "approve") {
    await sql`
      UPDATE paper_authors
      SET verified = true,
          verified_at = NOW(),
          verification_method = 'manual_admin',
          status = 'verified'
      WHERE paper_id = ${paperId} AND user_id = ${userId}
    `;
    await sql`
      UPDATE users SET reputation_score = reputation_score + ${THRESHOLDS.REP_AUTHOR_VERIFIED}
      WHERE github_id = ${userId}
    `;
    await recomputeVerificationScore(paperId);
  } else if (action === "reject" || action === "remove") {
    // Check if this was a verified claim (auto-approved or admin-approved)
    const [claim] = await sql<[{ verified: boolean }?]>`
      SELECT verified FROM paper_authors
      WHERE paper_id = ${paperId} AND user_id = ${userId}
    `;
    await sql`
      UPDATE paper_authors
      SET status = 'rejected', verified = false
      WHERE paper_id = ${paperId} AND user_id = ${userId}
    `;
    // If removing a verified claim, deduct rep and recompute
    if (claim?.verified) {
      await sql`
        UPDATE users SET reputation_score = GREATEST(0, reputation_score - ${THRESHOLDS.REP_AUTHOR_VERIFIED})
        WHERE github_id = ${userId}
      `;
      await recomputeVerificationScore(paperId);
    }
  } else if (action === "clear_all") {
    await sql`
      UPDATE paper_authors
      SET status = 'rejected', verified = false
      WHERE status = 'pending_admin'
    `;
  } else {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
