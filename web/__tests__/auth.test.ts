/**
 * Unit tests for Stage 3a auth callbacks.
 * All DB and GitHub provider calls are mocked — no real credentials needed.
 */

// Mock the postgres db module before importing auth
const mockSql = jest.fn().mockResolvedValue([]);
jest.mock("@/lib/db", () => {
  // postgres tagged-template returns a promise; mimic that
  const sql = (..._args: unknown[]) => mockSql();
  return { __esModule: true, default: sql };
});

// Must import after mocks are set up
import { authOptions } from "@/lib/auth";
import type { Account } from "next-auth";
import type { JWT } from "next-auth/jwt";

// ── helpers ───────────────────────────────────────────────────────────────────

function makeGithubProfile(overrides: Partial<{
  id: number;
  login: string;
  email: string;
  avatar_url: string;
  created_at: string;
}> = {}) {
  const yearsAgo = new Date();
  yearsAgo.setFullYear(yearsAgo.getFullYear() - 3);

  return {
    id: 12345,
    login: "testuser",
    email: "test@example.com",
    avatar_url: "https://avatars.githubusercontent.com/u/12345",
    created_at: yearsAgo.toISOString(),
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
  });

  it("upserts user on first GitHub login", async () => {
    const profile = makeGithubProfile();
    const result = await signIn({
      user: { id: "12345" },
      account: makeAccount(),
      profile,
      credentials: undefined,
    });

    expect(result).toBe(true);
    // 2 calls: upsert + activity_log insert
    expect(mockSql).toHaveBeenCalledTimes(2);
  });

  it("returns true even for non-github providers without calling DB", async () => {
    const result = await signIn({
      user: { id: "42" },
      account: { provider: "email", type: "email", providerAccountId: "42" },
      profile: undefined,
      credentials: undefined,
    });

    expect(result).toBe(true);
    expect(mockSql).not.toHaveBeenCalled();
  });

  it("allows approved users through even if account is young", async () => {
    const yesterday = new Date(Date.now() - 1000 * 60 * 60 * 24);
    const profile = makeGithubProfile({ created_at: yesterday.toISOString() });

    // allowlist check → found (approved)
    mockSql.mockResolvedValueOnce([{ id: 1 }]);
    // upsert user
    mockSql.mockResolvedValueOnce([]);
    // activity_log
    mockSql.mockResolvedValueOnce([]);

    const result = await signIn({
      user: { id: "12345" },
      account: makeAccount(),
      profile,
      credentials: undefined,
    });

    expect(result).toBe(true);
  });

  it("hard-rejects new accounts and creates sign-up request", async () => {
    const yesterday = new Date(Date.now() - 1000 * 60 * 60 * 24);
    const profile = makeGithubProfile({ created_at: yesterday.toISOString() });
    // allowlist check → empty (not approved)
    mockSql.mockResolvedValueOnce([]);
    // INSERT sign_up_requests
    mockSql.mockResolvedValueOnce([]);

    const result = await signIn({
      user: { id: "12345" },
      account: makeAccount(),
      profile,
      credentials: undefined,
    });

    expect(result).toBe("/auth/too-new");
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

  it("preserves existing token fields on subsequent requests (no account)", async () => {
    const existingToken: JWT = { github_id: "12345", username: "testuser", sub: "12345" };
    const token = await jwt({
      token: existingToken,
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

// ── session callback ──────────────────────────────────────────────────────────

describe("session callback", () => {
  const session = authOptions.callbacks!.session!;

  it("exposes github_id and username from token to session", async () => {
    const token: JWT = {
      github_id: "12345",
      username: "testuser",
      sub: "12345",
    };
    const result = await session({
      session: {
        user: { name: "Test User", email: "t@example.com", image: null },
        expires: "2099-01-01",
      },
      token,
      user: { id: "12345", name: "Test User", email: "t@example.com" },
      newSession: undefined,
      trigger: "getSession",
    });

    expect(result.user.github_id).toBe("12345");
    expect(result.user.username).toBe("testuser");
  });
});

// ── account age gate logic ────────────────────────────────────────────────────

describe("account age gate", () => {
  it("correctly identifies accounts older than 180 days as not new", () => {
    const MIN_AGE_DAYS = 180;
    const createdAt = new Date(Date.now() - MIN_AGE_DAYS * 2 * 24 * 60 * 60 * 1000);
    const ageInDays = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24);
    expect(ageInDays < MIN_AGE_DAYS).toBe(false);
  });

  it("correctly identifies accounts younger than 180 days as new", () => {
    const MIN_AGE_DAYS = 180;
    const createdAt = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000); // 10 days ago
    const ageInDays = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24);
    expect(ageInDays < MIN_AGE_DAYS).toBe(true);
  });
});
