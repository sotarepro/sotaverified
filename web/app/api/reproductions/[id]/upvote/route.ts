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

    const [r] = await sql<[{ upvote_count: number; status: string; user_id: string; tier_claimed: number }]>`
      SELECT upvote_count, status, user_id, tier_claimed FROM reproductions WHERE id = ${reproId}
    `;

    // Check if should be auto-verified: 3+ upvotes from trusted users (rep >= 30)
    if (r.upvote_count >= 3 && r.status === "community") {
      const [{ qualified_count }] = await sql<[{ qualified_count: number }]>`
        SELECT COUNT(*)::int AS qualified_count
        FROM reproduction_upvotes ru
        JOIN users u ON u.github_id = ru.user_id
        WHERE ru.reproduction_id = ${reproId} AND u.reputation_score >= 30
      `;

      if (qualified_count >= 3) {
        await sql`
          UPDATE reproductions SET status = 'verified' WHERE id = ${reproId}
        `;
        // Award tier-based rep to reproduction author
        const tier = r.tier_claimed;
        const repGain = tier === 4 ? 20 : tier === 3 ? 15 : tier === 2 ? 10 : 5;
        await sql`
          UPDATE users SET reputation_score = reputation_score + ${repGain}
          WHERE github_id = ${r.user_id}
        `;
      }
    }

    return NextResponse.json({ upvoted: true, count: r.upvote_count });
  }
}
