import type { NextAuthOptions, Profile } from "next-auth";
import GithubProvider from "next-auth/providers/github";
import sql from "./db";

// GitHub's profile object includes created_at which isn't in the base Profile type
interface GithubProfile extends Profile {
  id: number;
  login: string;
  avatar_url: string;
  created_at: string; // ISO 8601 — account creation date
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

const MIN_AGE_DAYS = parseInt(
  process.env.GITHUB_MIN_ACCOUNT_AGE_DAYS ?? "30",
  10
);

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

      const accountCreatedAt = new Date(p.created_at);
      const ageInDays =
        (Date.now() - accountCreatedAt.getTime()) / (1000 * 60 * 60 * 24);
      const isTooNew = ageInDays < MIN_AGE_DAYS;

      // Admin is always exempt from age check
      const isAdmin = githubId === process.env.ADMIN_GITHUB_ID;

      if (isTooNew && !isAdmin) {
        // Check allowlist (admin-approved sign-ups bypass age check)
        const allowed = await sql`
          SELECT 1 FROM sign_up_requests
          WHERE github_id = ${githubId} AND status = 'approved'
        `;
        if (allowed.length === 0) {
          // Create pending sign-up request (upsert to avoid duplicates)
          try {
            await sql`
              INSERT INTO sign_up_requests (github_id, github_username, avatar_url, account_age_days)
              VALUES (${githubId}, ${p.login}, ${p.avatar_url}, ${Math.floor(ageInDays)})
              ON CONFLICT DO NOTHING
            `;
          } catch { /* swallow */ }
          // Hard-block: return error page URL
          return "/auth/too-new";
        }
      }

      // Upsert user — always update username/avatar in case they changed
      await sql`
        INSERT INTO users
          (github_id, username, email, avatar_url, account_created_at, is_flagged_new_account)
        VALUES
          (${githubId}, ${p.login}, ${p.email ?? null},
           ${p.avatar_url}, ${accountCreatedAt.toISOString()}, ${isTooNew})
        ON CONFLICT (github_id) DO UPDATE SET
          username               = EXCLUDED.username,
          email                  = EXCLUDED.email,
          avatar_url             = EXCLUDED.avatar_url
      `;

      try {
        await sql`
          INSERT INTO activity_log (event_type, user_id, metadata)
          VALUES ('user_signin', ${githubId}, ${JSON.stringify({ account_age_days: Math.floor(ageInDays) })})
        `;
      } catch { /* swallow */ }

      return true;
    },

    async jwt({ token, account, profile }) {
      // Populated only on the initial sign-in request; persisted in the JWT after that
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
