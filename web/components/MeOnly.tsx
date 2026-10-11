"use client";

import { useSession } from "next-auth/react";

/**
 * Per-user bits of otherwise static pages. Anonymous visitors never trigger a session
 * request (SessionProvider only fetches when the sv_signed_in flag is present), so these
 * render nothing / the plain variant for them.
 */
export function useIsMe(githubId: string): boolean {
  const { data } = useSession();
  return data?.user?.github_id === githubId;
}

/** Renders children only for the signed-in user whose github_id matches. */
export function OwnerOnly({ githubId, children }: { githubId: string; children: React.ReactNode }) {
  return useIsMe(githubId) ? <>{children}</> : null;
}

/** A table row that highlights for the signed-in user. */
export function MeRow({ githubId, children }: { githubId: string; children: React.ReactNode }) {
  const me = useIsMe(githubId);
  return <tr className={me ? "bg-blue-50 hover:bg-blue-100" : "hover:bg-gray-50"}>{children}</tr>;
}

export function YouTag({ githubId }: { githubId: string }) {
  return useIsMe(githubId) ? <span className="ml-1 text-blue-600 text-xs">(you)</span> : null;
}
