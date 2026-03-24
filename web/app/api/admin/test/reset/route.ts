import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isTestToolsEnabled } from "@/lib/test-tools";
import { cookies } from "next/headers";
import sql from "@/lib/db";
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
    // All subqueries inline — postgres.js can't nest sql`` as fragments
    const testUsers = "SELECT github_id FROM users WHERE is_test = true";
    const testPapers = "SELECT id FROM papers WHERE is_test = true";

    // FK-safe deletion order using raw SQL for subqueries
    // 1. reproduction_flags referencing test user reproductions or by test users
    await sql.unsafe(`DELETE FROM reproduction_flags WHERE reproduction_id IN (SELECT id FROM reproductions WHERE user_id IN (${testUsers}))`);
    await sql.unsafe(`DELETE FROM reproduction_flags WHERE user_id IN (${testUsers})`);

    // 2. reproduction_upvotes
    await sql.unsafe(`DELETE FROM reproduction_upvotes WHERE reproduction_id IN (SELECT id FROM reproductions WHERE user_id IN (${testUsers}))`);
    await sql.unsafe(`DELETE FROM reproduction_upvotes WHERE user_id IN (${testUsers})`);

    // 3. reproductions by test users
    await sql.unsafe(`DELETE FROM reproductions WHERE user_id IN (${testUsers})`);

    // 4. upvotes — decrement hype_score for each
    const upvoteRows = await sql<{ paper_id: string }[]>`
      SELECT paper_id FROM upvotes WHERE user_id IN (SELECT github_id FROM users WHERE is_test = true)
    `;
    for (const row of upvoteRows) {
      await sql`UPDATE papers SET hype_score = GREATEST(hype_score - 1, 0) WHERE id = ${row.paper_id}`;
    }
    await sql.unsafe(`DELETE FROM upvotes WHERE user_id IN (${testUsers})`);

    // 5. paper_authors
    await sql.unsafe(`DELETE FROM paper_authors WHERE user_id IN (${testUsers})`);

    // 6. activity_log
    await sql.unsafe(`DELETE FROM activity_log WHERE user_id IN (${testUsers})`);

    // 7. api_keys
    await sql.unsafe(`DELETE FROM api_keys WHERE user_id IN (${testUsers})`);

    // 8. leaderboard_results submitted by test users (FK to users)
    await sql.unsafe(`DELETE FROM leaderboard_results WHERE submitted_by IN (${testUsers})`);

    // 9. Delete test users
    await sql`DELETE FROM users WHERE is_test = true`;

    // 9. Test paper dependencies (FK not CASCADE)
    await sql.unsafe(`DELETE FROM leaderboard_results WHERE paper_id IN (${testPapers})`);
    await sql.unsafe(`DELETE FROM paper_code_links WHERE paper_id IN (${testPapers})`);
    await sql.unsafe(`DELETE FROM paper_tasks WHERE paper_id IN (${testPapers})`);
    await sql.unsafe(`DELETE FROM paper_methods WHERE paper_id IN (${testPapers})`);

    // 10. Delete test papers
    await sql`DELETE FROM papers WHERE is_test = true`;

    // Clear impersonation cookie
    const cookieStore = await cookies();
    cookieStore.delete("sv_impersonate");

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    console.error("[RESET ERROR]", message, stack);
    return NextResponse.json({ error: "Reset failed", detail: message }, { status: 500 });
  }
}
