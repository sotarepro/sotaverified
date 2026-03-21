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
    SELECT 1 FROM reproduction_flags
    WHERE reproduction_id = ${reproId} AND user_id = ${userId}
  `;

  if (existing.length > 0) {
    // Unflag
    await sql`
      DELETE FROM reproduction_flags
      WHERE reproduction_id = ${reproId} AND user_id = ${userId}
    `;
    await sql`
      UPDATE reproductions SET flag_count = GREATEST(0, flag_count - 1) WHERE id = ${reproId}
    `;
    const [r] = await sql<[{ flag_count: number }]>`
      SELECT flag_count FROM reproductions WHERE id = ${reproId}
    `;
    return NextResponse.json({ flagged: false, count: r.flag_count });
  } else {
    await sql`
      INSERT INTO reproduction_flags (reproduction_id, user_id)
      VALUES (${reproId}, ${userId})
    `;
    await sql`
      UPDATE reproductions SET flag_count = flag_count + 1 WHERE id = ${reproId}
    `;

    const [r] = await sql<[{ flag_count: number; status: string; user_id: string }]>`
      SELECT flag_count, status, user_id FROM reproductions WHERE id = ${reproId}
    `;

    // Auto-hide at 3 flags
    if (r.flag_count >= 3 && r.status !== 'hidden') {
      await sql`
        UPDATE reproductions SET status = 'hidden' WHERE id = ${reproId}
      `;
      // Penalize author: -20 rep
      await sql`
        UPDATE users SET reputation_score = reputation_score - 20
        WHERE github_id = ${r.user_id}
      `;
    }

    return NextResponse.json({ flagged: true, count: r.flag_count });
  }
}
