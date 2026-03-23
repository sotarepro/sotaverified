/**
 * Multi-signal GitHub account legitimacy check.
 * Replaces single-signal account age gate with composite scoring.
 */

export interface GitHubSignals {
  publicRepos: number;
  publicGists: number;
  followers: number;
  following: number;
  hasBio: boolean;
  hasAvatar: boolean;
  hasBlog: boolean;
  hasTwitter: boolean;
  recentEvents: number;
}

export interface ScoreBreakdown {
  repos: { value: number; points: number };
  gists: { value: number; points: number };
  followers: { value: number; points: number };
  profile: { bio: boolean; avatar: boolean; blog: boolean; twitter: boolean; points: number };
  recentEvents: { value: number; points: number };
  total: number;
}

const DEFAULT_GRAVATAR = "https://avatars.githubusercontent.com/u/";

/**
 * Compute legitimacy score from GitHub signals.
 * Max possible: 90 points.
 */
export function computeLegitimacyScore(signals: GitHubSignals): ScoreBreakdown {
  const repos = Math.min(25, signals.publicRepos);
  const gists = Math.min(5, signals.publicGists);
  const followers = Math.min(15, signals.followers * 3);

  let profilePoints = 0;
  if (signals.hasBio) profilePoints += 5;
  if (signals.hasAvatar) profilePoints += 3;
  if (signals.hasBlog) profilePoints += 4;
  if (signals.hasTwitter) profilePoints += 3;

  const events = Math.min(30, signals.recentEvents * 2);

  const total = repos + gists + followers + profilePoints + events;

  return {
    repos: { value: signals.publicRepos, points: repos },
    gists: { value: signals.publicGists, points: gists },
    followers: { value: signals.followers, points: followers },
    profile: {
      bio: signals.hasBio,
      avatar: signals.hasAvatar,
      blog: signals.hasBlog,
      twitter: signals.hasTwitter,
      points: profilePoints,
    },
    recentEvents: { value: signals.recentEvents, points: events },
    total,
  };
}

/**
 * Extract signals from the GitHub OAuth profile object.
 * These fields come free with the OAuth callback — no extra API call.
 */
export function extractProfileSignals(profile: Record<string, unknown>): Omit<GitHubSignals, "recentEvents"> {
  const avatarUrl = String(profile.avatar_url ?? "");
  // GitHub default avatars contain the user ID and are identicons
  const hasCustomAvatar = !!avatarUrl && !avatarUrl.includes("identicon");

  return {
    publicRepos: Number(profile.public_repos ?? 0),
    publicGists: Number(profile.public_gists ?? 0),
    followers: Number(profile.followers ?? 0),
    following: Number(profile.following ?? 0),
    hasBio: !!profile.bio,
    hasAvatar: hasCustomAvatar,
    hasBlog: !!profile.blog,
    hasTwitter: !!profile.twitter_username,
  };
}

/**
 * Fetch recent events count from GitHub API.
 * Uses GITHUB_TOKEN for 5000/hr rate limit (vs 60/hr unauthenticated).
 * Returns 0 on any error (network, rate limit, etc).
 */
export async function fetchRecentEventCount(login: string): Promise<number> {
  try {
    const token = process.env.GITHUB_TOKEN;
    const headers: Record<string, string> = {
      Accept: "application/vnd.github.v3+json",
      "User-Agent": "SOTAVerified",
    };
    if (token) headers["Authorization"] = `token ${token}`;

    const res = await fetch(`https://api.github.com/users/${encodeURIComponent(login)}/events?per_page=100`, {
      headers,
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) return 0;

    const events = await res.json() as { created_at: string }[];
    const cutoff = Date.now() - 90 * 24 * 60 * 60 * 1000;
    return events.filter((e) => new Date(e.created_at).getTime() > cutoff).length;
  } catch {
    return 0;
  }
}
