/**
 * Unit tests for auth callbacks.
 * All DB and GitHub API calls are mocked.
 */

const mockSql = jest.fn().mockResolvedValue([]);
jest.mock("@/lib/db", () => {
  const sql = (..._args: unknown[]) => mockSql();
  return { __esModule: true, default: sql };
});

// Mock the GitHub events fetch
jest.mock("@/lib/account-check", () => {
  const actual = jest.requireActual("@/lib/account-check");
  return {
    ...actual,
    fetchRecentEventCount: jest.fn().mockResolvedValue(0),
  };
});

import { authOptions } from "@/lib/auth";
import { fetchRecentEventCount } from "@/lib/account-check";
import type { Account } from "next-auth";
import type { JWT } from "next-auth/jwt";

const mockFetchEvents = fetchRecentEventCount as jest.MockedFunction<typeof fetchRecentEventCount>;

// ── helpers ───────────────────────────────────────────────────────────────────

function makeGithubProfile(overrides: Record<string, unknown> = {}) {
  const yearsAgo = new Date();
  yearsAgo.setFullYear(yearsAgo.getFullYear() - 3);

  return {
    id: 12345,
    login: "testuser",
    email: "test@example.com",
    avatar_url: "https://avatars.githubusercontent.com/u/12345",
    created_at: yearsAgo.toISOString(),
    // Fields used by legitimacy scoring
    public_repos: 10,
    public_gists: 2,
    followers: 5,
    following: 10,
    bio: "ML researcher",
    blog: "https://example.com",
    twitter_username: "testuser",
    ...overrides,
  };
}

function makeAccount(): Account {
  return {
    provider: "github",
    type: "oauth",
    providerAccountId: "12345",
    access_token: "gho_mock",
  };
}

// ── signIn callback ───────────────────────────────────────────────────────────

describe("signIn callback", () => {
  const signIn = authOptions.callbacks!.signIn!;

  beforeEach(() => {
    mockSql.mockClear();
    mockSql.mockResolvedValue([]);
    mockFetchEvents.mockClear();
    mockFetchEvents.mockResolvedValue(5); // default: some recent activity
  });

  it("allows returning user (exists in DB) without legitimacy check", async () => {
    // First call: user exists check → found
    mockSql.mockResolvedValueOnce([{ github_id: "12345" }]);
    // Second call: upsert user
    mockSql.mockResolvedValueOnce([]);
    // Third call: activity_log
    mockSql.mockResolvedValueOnce([]);

    const result = await signIn({
      user: { id: "12345" },
      account: makeAccount(),
      profile: makeGithubProfile(),
      credentials: undefined,
    });

    expect(result).toBe(true);
    // fetchRecentEventCount should NOT be called for returning users
    expect(mockFetchEvents).not.toHaveBeenCalled();
  });

  it("allows new user with high legitimacy score", async () => {
    // User doesn't exist
    mockSql.mockResolvedValueOnce([]);
    // Allowlist check → not found
    mockSql.mockResolvedValueOnce([]);
    // Upsert user
    mockSql.mockResolvedValueOnce([]);
    // Activity log
    mockSql.mockResolvedValueOnce([]);

    mockFetchEvents.mockResolvedValueOnce(15); // 15 events → 30 pts alone

    const result = await signIn({
      user: { id: "12345" },
      account: makeAccount(),
      profile: makeGithubProfile(), // 10 repos + 5 followers + bio + blog + twitter + events = well above 25
      credentials: undefined,
    });

    expect(result).toBe(true);
  });

  it("blocks new user with zero-signal profile", async () => {
    // User doesn't exist
    mockSql.mockResolvedValueOnce([]);
    // Allowlist → not found
    mockSql.mockResolvedValueOnce([]);
    // INSERT sign_up_request
    mockSql.mockResolvedValueOnce([]);

    mockFetchEvents.mockResolvedValueOnce(0);

    const result = await signIn({
      user: { id: "12345" },
      account: makeAccount(),
      profile: makeGithubProfile({
        public_repos: 0, public_gists: 0, followers: 0, following: 0,
        bio: null, blog: null, twitter_username: null,
      }),
      credentials: undefined,
    });

    expect(result).toBe("/auth/too-new");
  });

  it("allows approved user through even with low score", async () => {
    // User doesn't exist
    mockSql.mockResolvedValueOnce([]);
    // Allowlist → found (approved)
    mockSql.mockResolvedValueOnce([{ id: 1 }]);
    // Upsert
    mockSql.mockResolvedValueOnce([]);
    // Activity log
    mockSql.mockResolvedValueOnce([]);

    const result = await signIn({
      user: { id: "12345" },
      account: makeAccount(),
      profile: makeGithubProfile({
        public_repos: 0, followers: 0, bio: null, blog: null, twitter_username: null,
      }),
      credentials: undefined,
    });

    expect(result).toBe(true);
    // Events fetch NOT called because allowlist short-circuited
    expect(mockFetchEvents).not.toHaveBeenCalled();
  });

  it("returns true for non-github providers without calling DB", async () => {
    const result = await signIn({
      user: { id: "42" },
      account: { provider: "email", type: "email", providerAccountId: "42" },
      profile: undefined,
      credentials: undefined,
    });
    expect(result).toBe(true);
    expect(mockSql).not.toHaveBeenCalled();
  });
});

// ── jwt callback ──────────────────────────────────────────────────────────────

describe("jwt callback", () => {
  const jwt = authOptions.callbacks!.jwt!;

  it("stores github_id and username in token on initial sign-in", async () => {
    const profile = makeGithubProfile();
    const token = await jwt({
      token: {} as JWT,
      account: makeAccount(),
      profile,
      user: { id: "12345" },
      trigger: "signIn",
      isNewSession: true,
      session: undefined,
    });

    expect(token.github_id).toBe("12345");
    expect(token.username).toBe("testuser");
  });

  it("preserves existing token fields on subsequent requests", async () => {
    const token = await jwt({
      token: { github_id: "12345", username: "testuser" } as JWT,
      account: null,
      profile: undefined,
      user: { id: "12345" },
      trigger: "update",
      isNewSession: false,
      session: undefined,
    });

    expect(token.github_id).toBe("12345");
    expect(token.username).toBe("testuser");
  });
});

// ── session callback ─────────────────────────────────────────────────────────

describe("session callback", () => {
  const session = authOptions.callbacks!.session!;

  it("exposes github_id and username from token to session", async () => {
    const result = await session({
      session: {
        user: { name: "Test", email: "test@test.com" },
        expires: "2099-01-01",
      },
      token: { github_id: "12345", username: "testuser" } as JWT,
      trigger: "update",
      newSession: undefined,
    });

    expect(result.user.github_id).toBe("12345");
    expect(result.user.username).toBe("testuser");
  });
});

// ── computeLegitimacyScore ───────────────────────────────────────────────────

describe("computeLegitimacyScore", () => {
  it("scores zero for empty profile", async () => {
    const { computeLegitimacyScore } = await import("@/lib/account-check");
    const result = computeLegitimacyScore({
      publicRepos: 0, publicGists: 0, followers: 0, following: 0,
      hasBio: false, hasAvatar: false, hasBlog: false, hasTwitter: false,
      recentEvents: 0,
    });
    expect(result.total).toBe(0);
  });

  it("caps repos at 25 points", async () => {
    const { computeLegitimacyScore } = await import("@/lib/account-check");
    const result = computeLegitimacyScore({
      publicRepos: 100, publicGists: 0, followers: 0, following: 0,
      hasBio: false, hasAvatar: false, hasBlog: false, hasTwitter: false,
      recentEvents: 0,
    });
    expect(result.repos.points).toBe(25);
    expect(result.total).toBe(25);
  });

  it("scores profile completeness correctly", async () => {
    const { computeLegitimacyScore } = await import("@/lib/account-check");
    const result = computeLegitimacyScore({
      publicRepos: 0, publicGists: 0, followers: 0, following: 0,
      hasBio: true, hasAvatar: true, hasBlog: true, hasTwitter: true,
      recentEvents: 0,
    });
    expect(result.profile.points).toBe(15); // 5 + 3 + 4 + 3
    expect(result.total).toBe(15);
  });

  it("computes full score for active developer", async () => {
    const { computeLegitimacyScore } = await import("@/lib/account-check");
    const result = computeLegitimacyScore({
      publicRepos: 10, publicGists: 3, followers: 5, following: 20,
      hasBio: true, hasAvatar: true, hasBlog: true, hasTwitter: true,
      recentEvents: 20,
    });
    // repos=10, gists=3, followers=15, profile=15, events=30 → 73
    expect(result.total).toBe(73);
  });
});
