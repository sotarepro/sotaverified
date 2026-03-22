import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import sql from "@/lib/db";
import { logEvent } from "@/lib/activity";
import { recomputeVerificationScore } from "@/lib/verification";
import { NextRequest, NextResponse } from "next/server";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.github_id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const reproId = parseInt(id, 10);
  const userId = session.user.github_id;

  // Check user's reputation
  const [userRow] = await sql<[{ reputation_score: number }]>`
    SELECT reputation_score FROM users WHERE github_id = ${userId}
  `;
  if ((userRow?.reputation_score ?? 0) < 30) {
    return NextResponse.json({ error: "Insufficient reputation to promote agent reproductions" }, { status: 403 });
  }

  // Fetch the reproduction
  const [repro] = await sql<[{ source: string; status: string; paper_id: string }]>`
    SELECT source, status, paper_id FROM reproductions WHERE id = ${reproId}
  `;
  if (!repro) {
    return NextResponse.json({ error: "Reproduction not found" }, { status: 404 });
  }
  if (repro.source !== 'api') {
    return NextResponse.json({ error: "Only agent reproductions can be promoted" }, { status: 400 });
  }
  if (repro.status !== 'agent_pending') {
    return NextResponse.json({ error: "Reproduction is not in agent_pending state" }, { status: 400 });
  }

  // Promote to community status
  await sql`
    UPDATE reproductions SET status = 'community' WHERE id = ${reproId}
  `;

  await recomputeVerificationScore(repro.paper_id);

  await logEvent("agent_reproduction_promoted", {
    userId,
    paperId: repro.paper_id,
    metadata: { reproduction_id: reproId },
  });

  return NextResponse.json({ ok: true, status: "community" });
}
