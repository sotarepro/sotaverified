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

  // Delete activity log entries for test users before cascading user deletes
  await sql`
    DELETE FROM activity_log
    WHERE user_id IN (SELECT github_id FROM users WHERE is_test = true)
  `;

  // Delete test users (cascades: upvotes, reproductions, author claims, etc.)
  await sql`DELETE FROM users WHERE is_test = true`;

  // Delete test papers (cascades: paper_code_links, paper_tasks, etc.)
  await sql`DELETE FROM papers WHERE is_test = true`;

  // Clear impersonation cookie if active
  const cookieStore = await cookies();
  cookieStore.delete("sv_impersonate");

  return NextResponse.json({ ok: true });
}
