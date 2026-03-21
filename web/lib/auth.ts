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
  process.env.GITHUB_MIN_ACCOUNT_AGE_DAYS ?? "180",
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

      const accountCreatedAt = new Date(p.created_at);
      const ageInDays =
        (Date.now() - accountCreatedAt.getTime()) / (1000 * 60 * 60 * 24);
      const isFlaggedNewAccount = ageInDays < MIN_AGE_DAYS;

      // Upsert — always update username/avatar in case they changed
      await sql`
        INSERT INTO users
          (github_id, username, email, avatar_url, account_created_at, is_flagged_new_account)
        VALUES
          (${String(p.id)}, ${p.login}, ${p.email ?? null},
           ${p.avatar_url}, ${accountCreatedAt.toISOString()}, ${isFlaggedNewAccount})
        ON CONFLICT (github_id) DO UPDATE SET
          username               = EXCLUDED.username,
          email                  = EXCLUDED.email,
          avatar_url             = EXCLUDED.avatar_url
      `;

      return true; // Soft gate only — never hard-block
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
