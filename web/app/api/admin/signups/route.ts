import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import sql from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

function isAdmin(githubId: string | undefined): boolean {
  return !!githubId && githubId === process.env.ADMIN_GITHUB_ID;
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!isAdmin(session?.user?.github_id)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const rows = await sql`
    SELECT id, github_id, github_username, avatar_url, account_age_days, status, created_at
    FROM sign_up_requests
    WHERE status = 'pending'
    ORDER BY created_at DESC
    LIMIT 100
  `;
  return NextResponse.json(rows);
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!isAdmin(session?.user?.github_id)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id, action } = await req.json();

  if (action === "approve") {
    await sql`
      UPDATE sign_up_requests SET status = 'approved', reviewed_at = NOW()
      WHERE id = ${id}
    `;
    return NextResponse.json({ ok: true });
  }

  if (action === "reject") {
    await sql`
      UPDATE sign_up_requests SET status = 'rejected', reviewed_at = NOW()
      WHERE id = ${id}
    `;
    return NextResponse.json({ ok: true });
  }

  if (action === "clear_all") {
    await sql`
      UPDATE sign_up_requests SET status = 'rejected', reviewed_at = NOW()
      WHERE status = 'pending'
    `;
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
