import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import sql from "@/lib/db";
import { recomputeVerificationScore } from "@/lib/verification";
import { THRESHOLDS } from "@/lib/thresholds";
import { logEvent } from "@/lib/activity";
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
          status = 'verified',
          admin_reviewed = true
      WHERE paper_id = ${paperId} AND user_id = ${userId}
    `;
    await logEvent("author_claim_approved", {
      userId,
      paperId,
      metadata: { admin: true },
    });
  } else if (action === "reject") {
    const [claim] = await sql<[{ verified: boolean }?]>`
      SELECT verified FROM paper_authors
      WHERE paper_id = ${paperId} AND user_id = ${userId}
    `;
    await sql`
      UPDATE paper_authors
      SET status = 'rejected', verified = false, admin_reviewed = true
      WHERE paper_id = ${paperId} AND user_id = ${userId}
    `;
    if (claim?.verified) {
      await sql`
        UPDATE users SET reputation_score = GREATEST(0, reputation_score - ${THRESHOLDS.REP_AUTHOR_VERIFIED})
        WHERE github_id = ${userId}
      `;
      await recomputeVerificationScore(paperId);
    }
    await logEvent("author_claim_rejected", {
      userId,
      paperId,
      metadata: { admin: true },
    });
  } else {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
