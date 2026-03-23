/**
 * Single source of truth for all configurable thresholds.
 * Override via environment variables without code changes.
 */
export const THRESHOLDS = {
  // Auth
  GITHUB_MIN_ACCOUNT_AGE_DAYS: Number(process.env.GITHUB_MIN_ACCOUNT_AGE_DAYS ?? 30),

  // Reproduction verification
  UPVOTES_TO_VERIFY: Number(process.env.UPVOTES_TO_VERIFY ?? 1),

  // Flagging
  FLAGS_TO_HIDE: Number(process.env.FLAGS_TO_HIDE ?? 2),

  // Agent promotion
  PROMOTES_TO_ACTIVATE: Number(process.env.PROMOTES_TO_ACTIVATE ?? 1),

  // Agent API rate limit
  AGENT_SUBMISSIONS_PER_DAY: Number(process.env.AGENT_SUBMISSIONS_PER_DAY ?? 2),

  // Reputation: base rewards on reproduction reaching 'verified'
  REP_TIER_1: Number(process.env.REP_TIER_1 ?? 2),
  REP_TIER_2: Number(process.env.REP_TIER_2 ?? 5),
  REP_TIER_3: Number(process.env.REP_TIER_3 ?? 10),
  REP_TIER_4: Number(process.env.REP_TIER_4 ?? 15),

  // Reputation: bonuses
  REP_METRIC_MATCH_BONUS: Number(process.env.REP_METRIC_MATCH_BONUS ?? 5),
  REP_PER_UPVOTE: Number(process.env.REP_PER_UPVOTE ?? 1),
  REP_AUTHOR_VERIFIED: Number(process.env.REP_AUTHOR_VERIFIED ?? 5),

  // Reputation: penalties
  REP_SPAM_PENALTY: Number(process.env.REP_SPAM_PENALTY ?? -20),
};

/** Compute rep gain for a given tier when reproduction is verified. */
export function tierRepGain(tier: number): number {
  switch (tier) {
    case 4: return THRESHOLDS.REP_TIER_4;
    case 3: return THRESHOLDS.REP_TIER_3;
    case 2: return THRESHOLDS.REP_TIER_2;
    default: return THRESHOLDS.REP_TIER_1;
  }
}
