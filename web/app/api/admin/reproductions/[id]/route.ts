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
    await sql`
      UPDATE reproductions
      SET status = 'community', reviewed_at = NOW()
      WHERE id = ${reproId}
    `;
    const [r] = await sql<[{ paper_id: string }]>`
      SELECT paper_id FROM reproductions WHERE id = ${reproId}
    `;
    if (r) {
      await recomputeVerificationScore(r.paper_id);
    }
  } else {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
