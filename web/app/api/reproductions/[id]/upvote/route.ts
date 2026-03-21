import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import sql from "@/lib/db";
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

  const existing = await sql`
    SELECT 1 FROM reproduction_upvotes
    WHERE reproduction_id = ${reproId} AND user_id = ${userId}
  `;

  if (existing.length > 0) {
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
    await sql`
      INSERT INTO reproduction_upvotes (reproduction_id, user_id)
      VALUES (${reproId}, ${userId})
    `;
    await sql`
      UPDATE reproductions SET upvote_count = upvote_count + 1 WHERE id = ${reproId}
    `;

    const [r] = await sql<[{ upvote_count: number; status: string; user_id: string }]>`
      SELECT upvote_count, status, user_id FROM reproductions WHERE id = ${reproId}
    `;

    // Check if should be auto-verified: 3+ upvotes from users with reputation > 50
    if (r.upvote_count >= 3 && r.status === "community") {
      const [{ qualified_count }] = await sql<[{ qualified_count: number }]>`
        SELECT COUNT(*)::int AS qualified_count
        FROM reproduction_upvotes ru
        JOIN users u ON u.github_id = ru.user_id
        WHERE ru.reproduction_id = ${reproId} AND u.reputation_score > 50
      `;

      if (qualified_count >= 3) {
        await sql`
          UPDATE reproductions SET status = 'verified' WHERE id = ${reproId}
        `;
        // Award +10 rep to reproduction author
        await sql`
          UPDATE users SET reputation_score = reputation_score + 10
          WHERE github_id = ${r.user_id}
        `;
      }
    }

    return NextResponse.json({ upvoted: true, count: r.upvote_count });
  }
}
