"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";

export interface PaperUserState {
  logged_in: boolean;
  upvoted: boolean;
  claim: { status: string } | null;
}

const cache = new Map<string, Promise<PaperUserState>>();

function fetchState(paperId: string): Promise<PaperUserState> {
  if (!cache.has(paperId)) {
    const p = fetch(`/api/me/paper-state?paper_id=${encodeURIComponent(paperId)}`, {
      cache: "no-store",
      credentials: "same-origin",
    })
      .then((r) => (r.ok ? r.json() : { logged_in: false, upvoted: false, claim: null }))
      .catch(() => ({ logged_in: false, upvoted: false, claim: null }));
    cache.set(paperId, p);
  }
  return cache.get(paperId)!;
}

export function invalidatePaperState(paperId: string): void {
  cache.delete(paperId);
}

const ANON_STATE: PaperUserState = { logged_in: false, upvoted: false, claim: null };

export function usePaperState(paperId: string): { state: PaperUserState | null; loading: boolean } {
  // Anonymous visitors (the vast majority, incl. bots that run JS) skip the request entirely:
  // no function invocation, no DB. Only a signed-in session fetches its per-paper state.
  const { status } = useSession();
  const [state, setState] = useState<PaperUserState | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === "loading") return;
    let cancelled = false;
    if (status === "unauthenticated") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setState(ANON_STATE);
      setLoading(false);
      return;
    }
    setLoading(true);
    fetchState(paperId).then((s) => {
      if (!cancelled) {
        setState(s);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [paperId, status]);

  return { state, loading };
}
