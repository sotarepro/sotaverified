import { getEffectiveSession } from "@/lib/effective-session";
import sql from "@/lib/db";
import { THRESHOLDS, tierRepGain } from "@/lib/thresholds";
import { NextRequest, NextResponse } from "next/server";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getEffectiveSession();
  if (!session?.user?.github_id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const reproId = parseInt(id, 10);
  const userId = session.user.github_id;

  // Block self-hype
  const ownerCheck = await sql`
    SELECT 1 FROM reproductions WHERE id = ${reproId} AND user_id = ${userId}
  `;
  if (ownerCheck.length > 0) {
    return NextResponse.json({ error: "You cannot hype your own reproduction" }, { status: 403 });
  }

  const existing = await sql`
    SELECT 1 FROM reproduction_upvotes
    WHERE reproduction_id = ${reproId} AND user_id = ${userId}
  `;

  if (existing.length > 0) {
    // Un-upvote
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
    // Upvote
    await sql`
      INSERT INTO reproduction_upvotes (reproduction_id, user_id)
      VALUES (${reproId}, ${userId})
    `;
    await sql`
      UPDATE reproductions SET upvote_count = upvote_count + 1 WHERE id = ${reproId}
    `;

    const [r] = await sql<[{ upvote_count: number; status: string; user_id: string; tier_claimed: number; dataset_id: string | null; actual_metric_value: number | null; paper_id: string }]>`
      SELECT upvote_count, status, user_id, tier_claimed, dataset_id, actual_metric_value, paper_id
      FROM reproductions WHERE id = ${reproId}
    `;

    // Award +REP_PER_UPVOTE to submitter for every upvote
    await sql`
      UPDATE users SET reputation_score = reputation_score + ${THRESHOLDS.REP_PER_UPVOTE}
      WHERE github_id = ${r.user_id}
    `;

    // Auto-verify at UPVOTES_TO_VERIFY threshold
    if (r.upvote_count >= THRESHOLDS.UPVOTES_TO_VERIFY && r.status === "community") {
      await sql`
        UPDATE reproductions SET status = 'verified' WHERE id = ${reproId}
      `;
      // Award tier-based rep to reproduction author
      let repGain = tierRepGain(r.tier_claimed);

      // Bonus if metric within 5% of claimed value
      if (r.actual_metric_value != null && r.dataset_id) {
        const [claimed] = await sql<[{ best_metric_value: number | null }]>`
          SELECT best_metric_value FROM leaderboard_results
          WHERE paper_id = ${r.paper_id} AND dataset_id = ${r.dataset_id}
            AND best_metric_value IS NOT NULL
          ORDER BY best_metric_value DESC LIMIT 1
        `;
        if (claimed?.best_metric_value != null && claimed.best_metric_value !== 0) {
          const pct = Math.abs(r.actual_metric_value - claimed.best_metric_value) / Math.abs(claimed.best_metric_value);
          if (pct <= 0.05) {
            repGain += THRESHOLDS.REP_METRIC_MATCH_BONUS;
          }
        }
      }

      await sql`
        UPDATE users SET reputation_score = reputation_score + ${repGain}
        WHERE github_id = ${r.user_id}
      `;
    }

    return NextResponse.json({ upvoted: true, count: r.upvote_count });
  }
}
