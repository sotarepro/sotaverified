import { NextRequest, NextResponse } from "next/server";
import { encode } from "next-auth/jwt";
import { isTestToolsEnabled } from "@/lib/test-tools";

/**
 * POST /api/test/session — Create a NextAuth session for E2E testing.
 * Only available when ENABLE_TEST_TOOLS=true or NODE_ENV=development.
 * Sets the NextAuth JWT cookie directly, bypassing GitHub OAuth.
 */
export async function POST(req: NextRequest) {
  if (!isTestToolsEnabled()) {
    return NextResponse.json({ error: "Test tools disabled" }, { status: 403 });
  }

  const { github_id, username } = await req.json();
  if (!github_id || !username) {
    return NextResponse.json({ error: "github_id and username required" }, { status: 400 });
  }

  const token = await encode({
    secret: process.env.NEXTAUTH_SECRET!,
    token: {
      github_id,
      username,
      name: username,
      sub: github_id,
    },
    maxAge: 60 * 60 * 24,
  });

  const res = NextResponse.json({ ok: true });
  res.cookies.set("next-auth.session-token", token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24,
  });
  return res;
}

/**
 * DELETE /api/test/session — Clear the test session.
 */
export async function DELETE() {
  if (!isTestToolsEnabled()) {
    return NextResponse.json({ error: "Test tools disabled" }, { status: 403 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set("next-auth.session-token", "", { maxAge: 0, path: "/" });
  res.cookies.set("sv_impersonate", "", { maxAge: 0, path: "/" });
  return res;
}
