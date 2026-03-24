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
    const testUserIds = sql`SELECT github_id FROM users WHERE is_test = true`;
    const testReproIds = sql`SELECT id FROM reproductions WHERE user_id IN (${testUserIds})`;

    // FK-safe deletion order
    // 1. reproduction_flags referencing test user reproductions or by test users
    await sql`DELETE FROM reproduction_flags WHERE reproduction_id IN (${testReproIds})`;
    await sql`DELETE FROM reproduction_flags WHERE user_id IN (${testUserIds})`;

    // 2. reproduction_upvotes
    await sql`DELETE FROM reproduction_upvotes WHERE reproduction_id IN (${testReproIds})`;
    await sql`DELETE FROM reproduction_upvotes WHERE user_id IN (${testUserIds})`;

    // 3. reproductions by test users
    await sql`DELETE FROM reproductions WHERE user_id IN (${testUserIds})`;

    // 4. upvotes — decrement hype_score for each
    const upvoteRows = await sql<{ paper_id: string }[]>`
      SELECT paper_id FROM upvotes WHERE user_id IN (SELECT github_id FROM users WHERE is_test = true)
    `;
    for (const row of upvoteRows) {
      await sql`UPDATE papers SET hype_score = GREATEST(hype_score - 1, 0) WHERE id = ${row.paper_id}`;
    }
    await sql`DELETE FROM upvotes WHERE user_id IN (${testUserIds})`;

    // 5. paper_authors
    await sql`DELETE FROM paper_authors WHERE user_id IN (${testUserIds})`;

    // 6. activity_log
    await sql`DELETE FROM activity_log WHERE user_id IN (${testUserIds})`;

    // 7. api_keys
    await sql`DELETE FROM api_keys WHERE user_id IN (${testUserIds})`;

    // 8. Delete test users
    await sql`DELETE FROM users WHERE is_test = true`;

    // 9. Delete test paper dependencies then papers
    await sql`DELETE FROM leaderboard_results WHERE paper_id IN (SELECT id FROM papers WHERE is_test = true)`;
    await sql`DELETE FROM papers WHERE is_test = true`;

    // Clear impersonation cookie if active
    const cookieStore = await cookies();
    cookieStore.delete("sv_impersonate");

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: "Reset failed", detail: message }, { status: 500 });
  }
}
