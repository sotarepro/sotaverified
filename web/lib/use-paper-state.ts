"use client";

import { useEffect, useState } from "react";

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

export function usePaperState(paperId: string): { state: PaperUserState | null; loading: boolean } {
  const [state, setState] = useState<PaperUserState | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
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
  }, [paperId]);

  return { state, loading };
}
