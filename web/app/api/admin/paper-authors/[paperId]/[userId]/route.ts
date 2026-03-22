import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import sql from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

function isAdmin(githubId: string | undefined): boolean {
  return !!githubId && githubId === process.env.ADMIN_GITHUB_ID;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ paperId: string; userId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!isAdmin(session?.user?.github_id)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { paperId, userId } = await params;
  const { action } = await req.json();

  if (action === "approve") {
    await sql`
      UPDATE paper_authors
      SET verified = true,
          verified_at = NOW(),
          verification_method = 'manual_admin',
          status = 'verified'
      WHERE paper_id = ${paperId} AND user_id = ${userId}
    `;
  } else if (action === "reject") {
    await sql`
      UPDATE paper_authors
      SET status = 'rejected',
          verified = false
      WHERE paper_id = ${paperId} AND user_id = ${userId}
    `;
  } else {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
