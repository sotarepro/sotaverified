import type { NextAuthOptions, Profile } from "next-auth";
import GithubProvider from "next-auth/providers/github";
import sql from "./db";
import { THRESHOLDS } from "./thresholds";
import {
  extractProfileSignals,
  fetchRecentEventCount,
  computeLegitimacyScore,
} from "./account-check";

// GitHub OAuth profile includes fields beyond the base Profile type
interface GithubProfile extends Profile {
  id: number;
  login: string;
  avatar_url: string;
  created_at: string;
  public_repos: number;
  public_gists: number;
  followers: number;
  following: number;
  bio: string | null;
  blog: string | null;
  twitter_username: string | null;
}

declare module "next-auth" {
  interface Session {
    user: {
      github_id?: string;
      username?: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    github_id?: string;
    username?: string;
  }
}

export const authOptions: NextAuthOptions = {
  providers: [
    GithubProvider({
      clientId: process.env.GITHUB_ID!,
      clientSecret: process.env.GITHUB_SECRET!,
    }),
  ],
  session: { strategy: "jwt" },
  callbacks: {
    async signIn({ account, profile }) {
      if (account?.provider !== "github" || !profile) return true;
      const p = profile as GithubProfile;
      const githubId = String(p.id);

      // Admin always passes
      const isAdmin = githubId === process.env.ADMIN_GITHUB_ID;

      // Check if user already exists — skip legitimacy check for returning users
      const existingUser = await sql`
        SELECT 1 FROM users WHERE github_id = ${githubId}
      `;
      const isReturning = existingUser.length > 0;

      if (!isReturning && !isAdmin) {
        // Check allowlist (admin-approved sign-ups bypass)
        const allowed = await sql`
          SELECT 1 FROM sign_up_requests
          WHERE github_id = ${githubId} AND status = 'approved'
        `;

        if (allowed.length === 0) {
          // Compute legitimacy score from GitHub signals
          const profileSignals = extractProfileSignals(p as unknown as Record<string, unknown>);
          const recentEvents = await fetchRecentEventCount(p.login);
          const signals = { ...profileSignals, recentEvents };
          const breakdown = computeLegitimacyScore(signals);

          if (breakdown.total < THRESHOLDS.LEGITIMACY_SCORE_THRESHOLD) {
            // Block — create pending sign-up request with score breakdown
            try {
              await sql`
                INSERT INTO sign_up_requests
                  (github_id, github_username, avatar_url, account_age_days,
                   legitimacy_score, score_breakdown)
                VALUES
                  (${githubId}, ${p.login}, ${p.avatar_url}, 0,
                   ${breakdown.total}, ${JSON.stringify(breakdown)})
                ON CONFLICT DO NOTHING
              `;
            } catch { /* swallow */ }
            return "/auth/too-new";
          }
        }
      }

      // Upsert user — always update username/avatar/email
      const accountCreatedAt = new Date(p.created_at);
      await sql`
        INSERT INTO users
          (github_id, username, email, avatar_url, account_created_at, is_flagged_new_account)
        VALUES
          (${githubId}, ${p.login}, ${p.email ?? null},
           ${p.avatar_url}, ${accountCreatedAt.toISOString()}, false)
        ON CONFLICT (github_id) DO UPDATE SET
          username   = EXCLUDED.username,
          email      = EXCLUDED.email,
          avatar_url = EXCLUDED.avatar_url
      `;

      try {
        await sql`
          INSERT INTO activity_log (event_type, user_id, metadata)
          VALUES ('user_signin', ${githubId}, ${JSON.stringify({ returning: isReturning })})
        `;
      } catch { /* swallow */ }

      return true;
    },

    async jwt({ token, account, profile }) {
      if (account?.provider === "github" && profile) {
        const p = profile as GithubProfile;
        token.github_id = String(p.id);
        token.username = p.login;
      }
      return token;
    },

    async session({ session, token }) {
      session.user.github_id = token.github_id;
      session.user.username = token.username;
      return session;
    },
  },
};
