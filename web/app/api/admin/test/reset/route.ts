import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isTestToolsEnabled } from "@/lib/test-tools";
import { cookies } from "next/headers";
import sql from "@/lib/db";
import { recomputeVerificationScore } from "@/lib/verification";
import { NextResponse } from "next/server";

function isAdmin(id: string | undefined) {
  return !!id && id === process.env.ADMIN_GITHUB_ID;
}

export async function POST() {
  if (!isTestToolsEnabled()) {
    return NextResponse.json({ error: "Test tools not enabled" }, { status: 403 });
  }
  const session = await getServerSession(authOptions);
  if (!isAdmin(session?.user?.github_id)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const testUsers = "SELECT github_id FROM users WHERE is_test = true";
    const testPapers = "SELECT id FROM papers WHERE is_test = true";

    // Collect paper IDs affected by test user reproductions/claims (for score recompute)
    const affectedPapers = await sql<{ paper_id: string }[]>`
      SELECT DISTINCT paper_id FROM reproductions WHERE user_id IN (SELECT github_id FROM users WHERE is_test = true)
      UNION
      SELECT DISTINCT paper_id FROM paper_authors WHERE user_id IN (SELECT github_id FROM users WHERE is_test = true)
    `;

    // FK-safe deletion order
    // 1. reproduction_flags
    await sql.unsafe(`DELETE FROM reproduction_flags WHERE reproduction_id IN (SELECT id FROM reproductions WHERE user_id IN (${testUsers}))`);
    await sql.unsafe(`DELETE FROM reproduction_flags WHERE user_id IN (${testUsers})`);

    // 2. reproduction_upvotes
    await sql.unsafe(`DELETE FROM reproduction_upvotes WHERE reproduction_id IN (SELECT id FROM reproductions WHERE user_id IN (${testUsers}))`);
    await sql.unsafe(`DELETE FROM reproduction_upvotes WHERE user_id IN (${testUsers})`);

    // 3. reproductions
    await sql.unsafe(`DELETE FROM reproductions WHERE user_id IN (${testUsers})`);

    // 4. upvotes — bulk decrement hype_score, then delete
    await sql.unsafe(`
      UPDATE papers p SET hype_score = GREATEST(hype_score - sub.cnt, 0)
      FROM (
        SELECT paper_id, COUNT(*) AS cnt FROM upvotes
        WHERE user_id IN (${testUsers})
        GROUP BY paper_id
      ) sub WHERE p.id = sub.paper_id
    `);
    await sql.unsafe(`DELETE FROM upvotes WHERE user_id IN (${testUsers})`);

    // 5. paper_authors
    await sql.unsafe(`DELETE FROM paper_authors WHERE user_id IN (${testUsers})`);

    // 6. activity_log
    await sql.unsafe(`DELETE FROM activity_log WHERE user_id IN (${testUsers})`);

    // 7. api_keys
    await sql.unsafe(`DELETE FROM api_keys WHERE user_id IN (${testUsers})`);

    // 8. leaderboard_results submitted by test users
    await sql.unsafe(`DELETE FROM leaderboard_results WHERE submitted_by IN (${testUsers})`);

    // 9. Delete test users
    await sql`DELETE FROM users WHERE is_test = true`;

    // 10. Test paper dependencies
    await sql.unsafe(`DELETE FROM leaderboard_results WHERE paper_id IN (${testPapers})`);
    await sql.unsafe(`DELETE FROM paper_code_links WHERE paper_id IN (${testPapers})`);
    await sql.unsafe(`DELETE FROM paper_tasks WHERE paper_id IN (${testPapers})`);
    await sql.unsafe(`DELETE FROM paper_methods WHERE paper_id IN (${testPapers})`);

    // 11. Delete test papers
    await sql`DELETE FROM papers WHERE is_test = true`;

    // 12. Recompute verification scores for affected papers
    for (const { paper_id } of affectedPapers) {
      try {
        await recomputeVerificationScore(paper_id);
      } catch {
        // Paper might have been a test paper (already deleted) — skip
      }
    }

    // Clear impersonation cookie
    const cookieStore = await cookies();
    cookieStore.delete("sv_impersonate");

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[RESET ERROR]", message);
    return NextResponse.json({ error: "Reset failed", detail: message }, { status: 500 });
  }
}
