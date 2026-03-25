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

async function getGitHubContributorsAndOwner(
  owner: string,
  repo: string
): Promise<string[]> {
  const token = process.env.GITHUB_TOKEN;
  const headers: Record<string, string> = {
    Accept: "application/vnd.github.v3+json",
  };
  if (token) headers["Authorization"] = `token ${token}`;

  const logins = new Set<string>();

  // Fetch contributors
  const contribResp = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/contributors?per_page=100`,
    { headers }
  );
  if (contribResp.ok) {
    const data = (await contribResp.json()) as Array<{ login: string }>;
    for (const c of data) logins.add(c.login.toLowerCase());
  }

  // Also fetch repo to get owner (org owners/personal accounts aren't always in contributors)
  const repoResp = await fetch(
    `https://api.github.com/repos/${owner}/${repo}`,
    { headers }
  );
  if (repoResp.ok) {
    const data = (await repoResp.json()) as { owner?: { login: string } };
    if (data.owner?.login) logins.add(data.owner.login.toLowerCase());
  }

  return [...logins];
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

  // Find ALL repos for this paper (not just official), sorted by stars
  const repoRows = await sql<{ repo_url: string }[]>`
    SELECT repo_url FROM paper_code_links
    WHERE paper_id = ${paperId}
    ORDER BY is_official DESC, stars DESC NULLS LAST
  `;

  if (repoRows.length === 0) {
    return NextResponse.json({
      status: "no_repo",
      message: "This paper has no linked code repository. Author verification requires a GitHub repo. Contact support@sotaverified.org for manual verification.",
    });
  }

  // Check each repo until we find one where the user is a contributor/owner
  let isContributor = false;
  let lastCheckedRepo = "";
  let checkFailed = false;

  for (const row of repoRows) {
    const parsed = extractOwnerRepo(row.repo_url);
    if (!parsed) continue;

    const [owner, repo] = parsed;
    lastCheckedRepo = `${owner}/${repo}`;

    try {
      const contributors = await getGitHubContributorsAndOwner(owner, repo);
      if (username !== "" && contributors.includes(username.toLowerCase())) {
        isContributor = true;
        break;
      }
    } catch {
      checkFailed = true;
      // Continue to next repo — one failing doesn't mean all fail
    }
  }

  if (!isContributor && checkFailed && repoRows.length === 1) {
    return NextResponse.json({
      status: "check_failed",
      message: "Could not reach GitHub to verify contributor status. Please try again later.",
    });
  }

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
    // Award rep for auto-verified author claim
    const { THRESHOLDS: T } = await import("@/lib/thresholds");
    await sql`
      UPDATE users SET reputation_score = reputation_score + ${T.REP_AUTHOR_VERIFIED}
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
    // Not a contributor — create pending claim for admin review
    await sql`
      INSERT INTO paper_authors (paper_id, user_id, verified, verification_method, status)
      VALUES (${paperId}, ${userId}, false, 'github_contributor_failed', 'pending_admin')
      ON CONFLICT (paper_id, user_id) DO UPDATE SET
        status = 'pending_admin',
        verification_method = 'github_contributor_failed'
    `;
    await logEvent("author_claim_failed", {
      userId,
      paperId,
      metadata: { username, repos_checked: repoRows.length },
    });
    return NextResponse.json({
      status: "pending",
      message: `We checked ${repoRows.length} linked repository${repoRows.length !== 1 ? "ies" : "y"} for your GitHub account (@${username}). Your account was not found as a contributor on any of them. Your claim has been submitted for admin review. You can also contact support@sotaverified.org for manual verification.`,
    });
  }
}
