"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";

/**
 * Per-user "which papers have I hyped" for list pages. List pages are static (anonymous HTML,
 * no per-user data), so a signed-in user fetches their hyped ids ONCE per page session.
 * Anonymous visitors never call the API (useSession is `unauthenticated` without a request
 * because SessionProvider only fetches when the sv_signed_in flag cookie is present).
 */
let shared: Set<string> | null = null;
let inflight: Promise<Set<string>> | null = null;

function load(): Promise<Set<string>> {
  if (shared) return Promise.resolve(shared);
  if (!inflight) {
    inflight = fetch("/api/me/hyped", { cache: "no-store", credentials: "same-origin" })
      .then((r) => (r.ok ? r.json() : { ids: [] }))
      .catch(() => ({ ids: [] }))
      .then((d: { ids?: string[] }) => {
        shared = new Set(d.ids ?? []);
        return shared;
      })
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}

/** Keep the shared set in sync after a toggle so other buttons / later renders agree. */
export function recordHype(paperId: string, hyped: boolean): void {
  if (!shared) return;
  if (hyped) shared.add(paperId);
  else shared.delete(paperId);
}

export function useHypedIds(): Set<string> | null {
  const { status } = useSession();
  const [ids, setIds] = useState<Set<string> | null>(shared);
  useEffect(() => {
    if (status !== "authenticated") return;
    let cancelled = false;
    load().then((s) => {
      if (!cancelled) setIds(s);
    });
    return () => {
      cancelled = true;
    };
  }, [status]);
  return status === "authenticated" ? ids : null;
}
