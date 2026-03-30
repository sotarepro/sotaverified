import { getEffectiveSession } from "@/lib/effective-session";
import sql from "@/lib/db";
import { recomputeVerificationScore } from "@/lib/verification";
import { NextRequest, NextResponse } from "next/server";

function extractOwnerRepo(url: string): [string, string] | null {
  const match = url.match(/github\.com\/([^/]+)\/([^/]+?)(?:\.git)?\/?$/i);
  if (!match) return null;
  return [match[1], match[2]];
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getEffectiveSession();
  if (!session?.user?.github_id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: paperId } = await params;
  const userId = session.user.github_id;

  // Must be a verified author of this paper
  const authorCheck = await sql`
    SELECT 1 FROM paper_authors
    WHERE paper_id = ${paperId} AND user_id = ${userId} AND status = 'verified'
  `;
  if (authorCheck.length === 0) {
    return NextResponse.json({ error: "Only verified authors can add code links" }, { status: 403 });
  }

  const body = await req.json();
  const rawUrl = body.repo_url;
  if (!rawUrl || typeof rawUrl !== "string") {
    return NextResponse.json({ error: "repo_url is required" }, { status: 400 });
  }

  const trimmed = rawUrl.trim();
  try {
    const parsed = new URL(trimmed);
    if (parsed.hostname !== "github.com" && !parsed.hostname.endsWith(".github.com")) {
      return NextResponse.json({ error: "Repository URL must be on github.com" }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: "Invalid URL format" }, { status: 400 });
  }

  const ownerRepo = extractOwnerRepo(trimmed);
  if (!ownerRepo) {
    return NextResponse.json({ error: "Invalid GitHub repository URL" }, { status: 400 });
  }
  const repoUrl = `https://github.com/${ownerRepo[0]}/${ownerRepo[1]}`;

  // Check not already linked
  const existing = await sql`
    SELECT 1 FROM paper_code_links WHERE paper_id = ${paperId} AND repo_url = ${repoUrl}
  `;
  if (existing.length > 0) {
    return NextResponse.json({ error: "This repository is already linked to this paper" }, { status: 409 });
  }

  await sql`
    INSERT INTO paper_code_links (paper_id, repo_url, is_official, stars, mentioned_in_paper)
    VALUES (${paperId}, ${repoUrl}, true, 0, false)
  `;

  await recomputeVerificationScore(paperId);

  return NextResponse.json({ ok: true, repo_url: repoUrl }, { status: 201 });
}
