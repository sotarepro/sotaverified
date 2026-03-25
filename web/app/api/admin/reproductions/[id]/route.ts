import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import sql from "@/lib/db";
import { recomputeVerificationScore } from "@/lib/verification";
import { tierRepGain } from "@/lib/thresholds";
import { NextRequest, NextResponse } from "next/server";

function isAdmin(githubId: string | undefined): boolean {
  return !!githubId && githubId === process.env.ADMIN_GITHUB_ID;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!isAdmin(session?.user?.github_id)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const reproId = parseInt(id, 10);
  const { action } = await req.json();

  if (action === "approve") {
    await sql`
      UPDATE reproductions
      SET status = 'verified', reviewed_at = NOW()
      WHERE id = ${reproId}
    `;
    // Award tier-based rep to author
    const [r] = await sql<[{ user_id: string; status: string; tier_claimed: number; paper_id: string }]>`
      SELECT user_id, status, tier_claimed, paper_id FROM reproductions WHERE id = ${reproId}
    `;
    if (r) {
      const repGain = tierRepGain(r.tier_claimed);
      await sql`
        UPDATE users SET reputation_score = reputation_score + ${repGain}
        WHERE github_id = ${r.user_id}
      `;
      await recomputeVerificationScore(r.paper_id);
    }
  } else if (action === "remove") {
    const [r] = await sql<[{ paper_id: string }]>`
      SELECT paper_id FROM reproductions WHERE id = ${reproId}
    `;
    await sql`
      UPDATE reproductions
      SET status = 'removed', reviewed_at = NOW()
      WHERE id = ${reproId}
    `;
    if (r) {
      await recomputeVerificationScore(r.paper_id);
    }
  } else if (action === "restore") {
    // Get reproduction details before restoring
    const [repro] = await sql<[{ user_id: string; tier_claimed: number; paper_id: string; upvote_count: number }]>`
      SELECT user_id, tier_claimed, paper_id, upvote_count FROM reproductions WHERE id = ${reproId}
    `;
    await sql`
      UPDATE reproductions
      SET status = 'community', flag_count = 0, reviewed_at = NOW()
      WHERE id = ${reproId}
    `;
    await sql`DELETE FROM reproduction_flags WHERE reproduction_id = ${reproId}`;
    if (repro) {
      // Restore tier-based rep + upvote rep that was lost during flagging
      const repGain = tierRepGain(repro.tier_claimed) + repro.upvote_count;
      if (repGain > 0) {
        await sql`
          UPDATE users SET reputation_score = reputation_score + ${repGain}
          WHERE github_id = ${repro.user_id}
        `;
      }
      await recomputeVerificationScore(repro.paper_id);
    }
  } else {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
