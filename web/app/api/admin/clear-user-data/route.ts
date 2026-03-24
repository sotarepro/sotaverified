import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import sql from "@/lib/db";
import { recomputeVerificationScore } from "@/lib/verification";
import { NextRequest, NextResponse } from "next/server";

function isAdmin(githubId: string | undefined): boolean {
  return !!githubId && githubId === process.env.ADMIN_GITHUB_ID;
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!isAdmin(session?.user?.github_id)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { username } = await req.json();
  if (!username || typeof username !== "string") {
    return NextResponse.json({ error: "username required" }, { status: 400 });
  }

  // Look up user
  const [user] = await sql<[{ github_id: string }]>`
    SELECT github_id FROM users WHERE username = ${username}
  `;
  if (!user) {
    return NextResponse.json({ error: `User @${username} not found` }, { status: 404 });
  }

  const userId = user.github_id;
  const counts: Record<string, number> = {};

  // 1. reproduction_flags
  const [{ count: flagCount }] = await sql<[{ count: number }]>`
    SELECT COUNT(*)::int AS count FROM reproduction_flags WHERE user_id = ${userId}
  `;
  await sql`DELETE FROM reproduction_flags WHERE user_id = ${userId}`;
  counts.flags = flagCount;

  // 2. reproduction_upvotes
  const [{ count: upvoteCount }] = await sql<[{ count: number }]>`
    SELECT COUNT(*)::int AS count FROM reproduction_upvotes WHERE user_id = ${userId}
  `;
  await sql`DELETE FROM reproduction_upvotes WHERE user_id = ${userId}`;
  counts.reproduction_upvotes = upvoteCount;

  // 3. reproductions — collect affected paper_ids first
  const affectedPapers = await sql<{ paper_id: string }[]>`
    SELECT DISTINCT paper_id FROM reproductions WHERE user_id = ${userId}
  `;
  const [{ count: reproCount }] = await sql<[{ count: number }]>`
    SELECT COUNT(*)::int AS count FROM reproductions WHERE user_id = ${userId}
  `;
  await sql`DELETE FROM reproductions WHERE user_id = ${userId}`;
  counts.reproductions = reproCount;

  // 4. upvotes — decrement hype_score for each
  const upvoteRows = await sql<{ paper_id: string }[]>`
    SELECT paper_id FROM upvotes WHERE user_id = ${userId}
  `;
  for (const row of upvoteRows) {
    await sql`UPDATE papers SET hype_score = GREATEST(hype_score - 1, 0) WHERE id = ${row.paper_id}`;
  }
  await sql`DELETE FROM upvotes WHERE user_id = ${userId}`;
  counts.hype_votes = upvoteRows.length;

  // 5. paper_authors — collect affected papers
  const authorPapers = await sql<{ paper_id: string }[]>`
    SELECT paper_id FROM paper_authors WHERE user_id = ${userId}
  `;
  await sql`DELETE FROM paper_authors WHERE user_id = ${userId}`;
  counts.author_claims = authorPapers.length;

  // 6. activity_log
  const [{ count: logCount }] = await sql<[{ count: number }]>`
    SELECT COUNT(*)::int AS count FROM activity_log WHERE user_id = ${userId}
  `;
  await sql`DELETE FROM activity_log WHERE user_id = ${userId}`;
  counts.activity_log = logCount;

  // 7. api_keys
  await sql`DELETE FROM api_keys WHERE user_id = ${userId}`;

  // 8. Reset reputation
  await sql`UPDATE users SET reputation_score = 0 WHERE github_id = ${userId}`;

  // 9. Recompute verification scores for affected papers
  const allAffectedPaperIds = new Set([
    ...affectedPapers.map((r) => r.paper_id),
    ...authorPapers.map((r) => r.paper_id),
  ]);
  for (const paperId of allAffectedPaperIds) {
    await recomputeVerificationScore(paperId);
  }

  return NextResponse.json({
    ok: true,
    username,
    counts,
    papers_recomputed: allAffectedPaperIds.size,
  });
}
