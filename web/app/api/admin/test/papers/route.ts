import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isTestToolsEnabled } from "@/lib/test-tools";
import sql from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

function isAdmin(id: string | undefined) {
  return !!id && id === process.env.ADMIN_GITHUB_ID;
}

export async function POST(req: NextRequest) {
  if (!isTestToolsEnabled()) {
    return NextResponse.json({ error: "Test tools not enabled" }, { status: 403 });
  }
  const session = await getServerSession(authOptions);
  if (!isAdmin(session?.user?.github_id)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { preset, repo_url } = body as { preset: string; repo_url?: string };

  if (preset === "basic") {
    await sql`
      INSERT INTO papers
        (id, arxiv_id, title, abstract, tasks, methods, is_test)
      VALUES
        ('test_basic', 'test_basic_001', '[TEST] Basic Test Paper',
         'A test paper with no code link or leaderboard results.',
         ARRAY[]::text[], ARRAY[]::text[], true)
      ON CONFLICT (id) DO UPDATE SET
        title   = EXCLUDED.title,
        is_test = true
    `;
    return NextResponse.json({ ok: true, paper_id: "test_basic" });
  }

  if (preset === "full") {
    const codeRepo = repo_url ?? "https://github.com/sotarepro/sotaverified";

    await sql`
      INSERT INTO papers
        (id, arxiv_id, title, abstract, tasks, methods, is_test)
      VALUES
        ('test_full', 'test_full_001', '[TEST] Full Test Paper',
         'A test paper with an official code link for author verification testing.',
         ARRAY[]::text[], ARRAY[]::text[], true)
      ON CONFLICT (id) DO UPDATE SET
        title   = EXCLUDED.title,
        is_test = true
    `;

    // Upsert the code link
    await sql`
      DELETE FROM paper_code_links
      WHERE paper_id = 'test_full' AND is_official = true
    `;
    await sql`
      INSERT INTO paper_code_links (paper_id, repo_url, is_official, framework)
      VALUES ('test_full', ${codeRepo}, true, null)
    `;

    return NextResponse.json({ ok: true, paper_id: "test_full" });
  }

  return NextResponse.json({ error: "Invalid preset" }, { status: 400 });
}

export async function GET() {
  if (!isTestToolsEnabled()) {
    return NextResponse.json({ error: "Test tools not enabled" }, { status: 403 });
  }
  const session = await getServerSession(authOptions);
  if (!isAdmin(session?.user?.github_id)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const papers = await sql<{
    id: string;
    title: string;
    verification_score: number;
  }[]>`
    SELECT id, title, verification_score
    FROM papers
    WHERE is_test = true
    ORDER BY created_at
  `;

  return NextResponse.json(papers);
}
