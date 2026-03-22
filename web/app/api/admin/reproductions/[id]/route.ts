import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import sql from "@/lib/db";
import { recomputeVerificationScore } from "@/lib/verification";
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
    // Award rep to author
    const [r] = await sql<[{ user_id: string; status: string; paper_id: string }]>`
      SELECT user_id, status, paper_id FROM reproductions WHERE id = ${reproId}
    `;
    if (r) {
      await sql`
        UPDATE users SET reputation_score = reputation_score + 10
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
  } else {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
