import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import sql from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const paperId = req.nextUrl.searchParams.get("paper_id");
  if (!paperId) {
    return NextResponse.json({ error: "paper_id required" }, { status: 400 });
  }

  const session = await getServerSession(authOptions);
  const userId = session?.user?.github_id ?? null;

  const [{ count }] = await sql<[{ count: number }]>`
    SELECT COUNT(*)::int AS count FROM upvotes WHERE paper_id = ${paperId}
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
  const session = await getServerSession(authOptions);
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
  } else {
    // Add upvote
    await sql`INSERT INTO upvotes (paper_id, user_id) VALUES (${paper_id}, ${userId})`;
  }

  const [{ count }] = await sql<[{ count: number }]>`
    SELECT COUNT(*)::int AS count FROM upvotes WHERE paper_id = ${paper_id}
  `;

  return NextResponse.json({ upvoted: existing.length === 0, count });
}
