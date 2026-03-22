import { getEffectiveSession } from "@/lib/effective-session";
import sql from "@/lib/db";
import { recomputeVerificationScore } from "@/lib/verification";
import { logEvent } from "@/lib/activity";
import { NextRequest, NextResponse } from "next/server";

function extractOwnerRepo(url: string): [string, string] | null {
  const match = url.match(/github\.com\/([^/]+)\/([^/]+?)(?:\.git)?\/?$/i);
  if (!match) return null;
  return [match[1], match[2]];
}

async function getGitHubContributors(
  owner: string,
  repo: string
): Promise<string[]> {
  const token = process.env.GITHUB_TOKEN;
  const headers: Record<string, string> = {
    Accept: "application/vnd.github.v3+json",
  };
  if (token) headers["Authorization"] = `token ${token}`;

  const url = `https://api.github.com/repos/${owner}/${repo}/contributors?per_page=100`;
  const resp = await fetch(url, { headers });
  if (!resp.ok) return [];
  const data = (await resp.json()) as Array<{ login: string }>;
  return data.map((c) => c.login.toLowerCase());
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getEffectiveSession();
  if (!session?.user?.github_id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: paperId } = await params;
  const userId = session.user.github_id;
  const username = session.user.username ?? "";

  // Check paper exists
  const papers = await sql`SELECT id FROM papers WHERE id = ${paperId}`;
  if (papers.length === 0) {
    return NextResponse.json({ error: "Paper not found" }, { status: 404 });
  }

  // Find official repo
  const repoRows = await sql<[{ repo_url: string }]>`
    SELECT repo_url FROM paper_code_links
    WHERE paper_id = ${paperId} AND is_official = true
    LIMIT 1
  `;

  const officialRepoUrl = repoRows[0]?.repo_url ?? null;

  if (!officialRepoUrl) {
    // No official repo — pending_admin
    await sql`
      INSERT INTO paper_authors (paper_id, user_id, verified, status)
      VALUES (${paperId}, ${userId}, false, 'pending_admin')
      ON CONFLICT (paper_id, user_id) DO UPDATE SET
        status = 'pending_admin',
        verified = false,
        verified_at = NULL,
        verification_method = NULL
    `;
    await logEvent("author_claimed", {
      userId,
      paperId,
      metadata: { status: "pending_admin" },
    });
    return NextResponse.json({
      status: "pending_admin",
      message: "No official repo found — submitted for admin review",
    });
  }

  const parsed = extractOwnerRepo(officialRepoUrl);
  if (!parsed) {
    await sql`
      INSERT INTO paper_authors (paper_id, user_id, verified, status)
      VALUES (${paperId}, ${userId}, false, 'pending_admin')
      ON CONFLICT (paper_id, user_id) DO UPDATE SET
        status = 'pending_admin',
        verified = false,
        verified_at = NULL,
        verification_method = NULL
    `;
    await logEvent("author_claimed", {
      userId,
      paperId,
      metadata: { status: "pending_admin" },
    });
    return NextResponse.json({
      status: "pending_admin",
      message: "Could not parse repo URL — submitted for admin review",
    });
  }

  const [owner, repo] = parsed;
  let contributors: string[] = [];
  try {
    contributors = await getGitHubContributors(owner, repo);
  } catch {
    // If we can't fetch contributors, fall back to pending_admin
  }

  const isContributor =
    username !== "" && contributors.includes(username.toLowerCase());

  if (isContributor) {
    await sql`
      INSERT INTO paper_authors (paper_id, user_id, verified, verified_at, verification_method, status)
      VALUES (${paperId}, ${userId}, true, NOW(), 'github_contributor', 'verified')
      ON CONFLICT (paper_id, user_id) DO UPDATE SET
        verified = true,
        verified_at = NOW(),
        verification_method = 'github_contributor',
        status = 'verified'
    `;
    // Award +10 rep for auto-verified author claim
    await sql`
      UPDATE users SET reputation_score = reputation_score + 10
      WHERE github_id = ${userId}
    `;
    await recomputeVerificationScore(paperId);
    await logEvent("author_claimed", {
      userId,
      paperId,
      metadata: { status: "verified" },
    });
    return NextResponse.json({
      status: "verified",
      message: "Verified as GitHub contributor",
    });
  } else {
    await sql`
      INSERT INTO paper_authors (paper_id, user_id, verified, status)
      VALUES (${paperId}, ${userId}, false, 'pending_admin')
      ON CONFLICT (paper_id, user_id) DO UPDATE SET
        status = 'pending_admin',
        verified = false,
        verified_at = NULL,
        verification_method = NULL
    `;
    await logEvent("author_claimed", {
      userId,
      paperId,
      metadata: { status: "pending_admin" },
    });
    return NextResponse.json({
      status: "pending_admin",
      message: "Not found in contributors — submitted for admin review",
    });
  }
}
