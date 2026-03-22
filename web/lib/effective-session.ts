/**
 * getEffectiveSession wraps getServerSession and substitutes the impersonated
 * test user's identity when the sv_impersonate cookie is present (dev/test only).
 * All user-facing API routes should use this instead of getServerSession.
 */
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { cookies } from "next/headers";
import { isTestToolsEnabled } from "@/lib/test-tools";

export async function getEffectiveSession() {
  const session = await getServerSession(authOptions);
  if (!isTestToolsEnabled()) return session;

  const cookieStore = await cookies();
  const cookie = cookieStore.get("sv_impersonate");
  if (!cookie) return session;

  try {
    const impUser = JSON.parse(cookie.value) as {
      github_id: string;
      username: string;
    };
    if (!impUser.github_id) return session;
    return {
      ...session,
      user: {
        ...session?.user,
        github_id: impUser.github_id,
        username: impUser.username,
        name: impUser.username,
        email: null,
        image: null,
      },
    };
  } catch {
    return session;
  }
}
