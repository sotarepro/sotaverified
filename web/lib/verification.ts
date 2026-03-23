import sql from "./db";

// Recomputes and saves verification_score for a paper.
// Call this after any event that affects score:
// - reproduction created/hidden/removed/verified
// - author claim verified
export async function recomputeVerificationScore(paperId: string): Promise<number> {
  // +5 if official repo exists
  const [repoRow] = await sql<[{ has_repo: boolean }]>`
    SELECT EXISTS(
      SELECT 1 FROM paper_code_links
      WHERE paper_id = ${paperId} AND is_official = true
    ) AS has_repo
  `;
  const repoScore = repoRow.has_repo ? 5 : 0;

  // +10 if verified author exists
  const [authorRow] = await sql<[{ has_author: boolean }]>`
    SELECT EXISTS(
      SELECT 1 FROM paper_authors
      WHERE paper_id = ${paperId} AND status = 'verified'
    ) AS has_author
  `;
  const authorScore = authorRow.has_author ? 10 : 0;

  // Fetch active reproductions
  const repros = await sql<{
    actual_metric_value: number | null;
    hardware_spec: string;
  }[]>`
    SELECT actual_metric_value, hardware_spec
    FROM reproductions
    WHERE paper_id = ${paperId}
      AND status NOT IN ('hidden', 'removed')
  `;

  const reproCount = repros.length;
  const reproBase = reproCount * 10;

  // +5 bonus per reproduction where actual_metric_value is within 5% of claimed
  // We need claimed value — get it from leaderboard_results for this paper
  const [claimedRow] = await sql<[{ best_metric_value: number | null }]>`
    SELECT best_metric_value FROM leaderboard_results
    WHERE paper_id = ${paperId} AND best_metric_value IS NOT NULL
    ORDER BY best_metric_value DESC LIMIT 1
  `;
  const claimedValue = claimedRow?.best_metric_value ?? null;

  let bonusScore = 0;
  if (claimedValue !== null && claimedValue !== 0) {
    for (const r of repros) {
      if (r.actual_metric_value !== null) {
        const pct = Math.abs(r.actual_metric_value - claimedValue) / Math.abs(claimedValue);
        if (pct <= 0.05) bonusScore += 5;
      }
    }
  }

  // +3 per unique hardware config
  const uniqueHardware = new Set(repros.map((r) => r.hardware_spec.toLowerCase().trim())).size;
  const hardwareScore = uniqueHardware * 3;

  const total = repoScore + authorScore + reproBase + bonusScore + hardwareScore;

  await sql`
    UPDATE papers SET verification_score = ${total} WHERE id = ${paperId}
  `;

  return total;
}

// Returns the badge type for a paper based on underlying data
export type BadgeType = "unverified" | "code_available" | "author_verified" | "community_verified";

export async function getBadgeData(paperId: string): Promise<{
  badge: BadgeType;
  reproduction_count: number;
  verification_score: number;
}> {
  const [row] = await sql<
    [
      {
        has_repo: boolean;
        has_author: boolean;
        repro_count: number;
        verification_score: number;
      },
    ]
  >`
    SELECT
      EXISTS(SELECT 1 FROM paper_code_links WHERE paper_id = ${paperId} AND is_official = true) AS has_repo,
      EXISTS(SELECT 1 FROM paper_authors WHERE paper_id = ${paperId} AND status = 'verified') AS has_author,
      (SELECT COUNT(*)::int FROM reproductions WHERE paper_id = ${paperId} AND status NOT IN ('hidden','removed')) AS repro_count,
      verification_score
    FROM papers WHERE id = ${paperId}
  `;

  if (!row) {
    return { badge: "unverified" as BadgeType, reproduction_count: 0, verification_score: 0 };
  }

  let badge: BadgeType = "unverified";
  if (row.repro_count > 0) badge = "community_verified";
  else if (row.has_author) badge = "author_verified";
  else if (row.has_repo) badge = "code_available";

  return {
    badge,
    reproduction_count: row.repro_count,
    verification_score: row.verification_score,
  };
}
