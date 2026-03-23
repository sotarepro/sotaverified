import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isTestToolsEnabled } from "@/lib/test-tools";
import sql from "@/lib/db";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

function isAdmin(id: string | undefined) {
  return !!id && id === process.env.ADMIN_GITHUB_ID;
}

// POST — start impersonating a test user
export async function POST(req: NextRequest) {
  if (!isTestToolsEnabled()) {
    return NextResponse.json({ error: "Test tools not enabled" }, { status: 403 });
  }
  const session = await getServerSession(authOptions);
  if (!isAdmin(session?.user?.github_id)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { github_id } = await req.json() as { github_id: string };

  const [user] = await sql<[{ github_id: string; username: string; is_test: boolean }]>`
    SELECT github_id, username, is_test
    FROM users
    WHERE github_id = ${github_id} AND is_test = true
  `;

  if (!user) {
    return NextResponse.json({ error: "Test user not found" }, { status: 404 });
  }

  const cookieStore = await cookies();
  cookieStore.set("sv_impersonate", JSON.stringify({
    github_id: user.github_id,
    username: user.username,
  }), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24,
  });

  return NextResponse.json({ ok: true, username: user.username });
}

// DELETE — exit impersonation
export async function DELETE() {
  if (!isTestToolsEnabled()) {
    return NextResponse.json({ error: "Test tools not enabled" }, { status: 403 });
  }

  const cookieStore = await cookies();
  cookieStore.set("sv_impersonate", "", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });

  return NextResponse.json({ ok: true });
}
