import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isTestToolsEnabled } from "@/lib/test-tools";
import sql from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

function isAdmin(id: string | undefined) {
  return !!id && id === process.env.ADMIN_GITHUB_ID;
}

const PRESETS = {
  new_user: {
    github_id: "test_new_user",
    username: "test_new_user",
    reputation_score: 0,
    age_days: 30,
    is_flagged_new_account: true,
  },
  trusted_user: {
    github_id: "test_trusted_user",
    username: "test_trusted_user",
    reputation_score: 30,
    age_days: 730,
    is_flagged_new_account: false,
  },
  author: {
    github_id: "test_author",
    username: "test_author",
    reputation_score: 10,
    age_days: 1095,
    is_flagged_new_account: false,
  },
} as const;

export async function POST(req: NextRequest) {
  if (!isTestToolsEnabled()) {
    return NextResponse.json({ error: "Test tools not enabled" }, { status: 403 });
  }
  const session = await getServerSession(authOptions);
  if (!isAdmin(session?.user?.github_id)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const preset = PRESETS[body.preset as keyof typeof PRESETS];
  if (!preset) {
    return NextResponse.json({ error: "Invalid preset" }, { status: 400 });
  }

  const accountCreatedAt = new Date(Date.now() - preset.age_days * 86400_000).toISOString();

  await sql`
    INSERT INTO users
      (github_id, username, email, avatar_url, account_created_at,
       is_flagged_new_account, reputation_score, is_test)
    VALUES
      (${preset.github_id}, ${preset.username}, null, null,
       ${accountCreatedAt}, ${preset.is_flagged_new_account},
       ${preset.reputation_score}, true)
    ON CONFLICT (github_id) DO UPDATE SET
      username               = EXCLUDED.username,
      reputation_score       = EXCLUDED.reputation_score,
      account_created_at     = EXCLUDED.account_created_at,
      is_flagged_new_account = EXCLUDED.is_flagged_new_account,
      is_test                = true
  `;

  return NextResponse.json({ ok: true, github_id: preset.github_id });
}

export async function GET() {
  if (!isTestToolsEnabled()) {
    return NextResponse.json({ error: "Test tools not enabled" }, { status: 403 });
  }
  const session = await getServerSession(authOptions);
  if (!isAdmin(session?.user?.github_id)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const users = await sql<{
    github_id: string;
    username: string;
    reputation_score: number;
    is_flagged_new_account: boolean;
  }[]>`
    SELECT github_id, username, reputation_score, is_flagged_new_account
    FROM users
    WHERE is_test = true
    ORDER BY created_at
  `;

  return NextResponse.json(users);
}
