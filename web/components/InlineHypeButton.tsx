"use client";

import { useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

interface Props {
  paperId: string;
  initialCount: number;
  initialHyped?: boolean;
}

export default function InlineHypeButton({ paperId, initialCount, initialHyped = false }: Props) {
  const { status } = useSession();
  const router = useRouter();
  const isAuthed = status === "authenticated";

  const [count, setCount] = useState(initialCount);
  const [hyped, setHyped] = useState(initialHyped);
  const inFlight = useRef(false); // ref-based guard: synchronous, no render cycle delay

  async function handleClick() {
    if (!isAuthed || inFlight.current) return;
    inFlight.current = true;
    // Optimistic update
    const wasHyped = hyped;
    setHyped(!wasHyped);
    setCount((c) => c + (wasHyped ? -1 : 1));
    try {
      const res = await fetch("/api/upvotes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paper_id: paperId }),
      });
      if (res.ok) {
        const data = await res.json() as { upvoted: boolean; count: number };
        // Reconcile with server truth for count; keep optimistic state for hyped
        // Server returns organic count only; we need to preserve hype_score offset
        const serverDelta = data.upvoted ? 1 : -1;
        const expectedDelta = wasHyped ? -1 : 1;
        if (serverDelta !== expectedDelta) {
          // Server disagreed (e.g. race) — revert optimistic update
          setHyped(wasHyped);
          setCount((c) => c - (wasHyped ? -1 : 1));
        }
        // Refresh server components so table counts stay fresh after navigation
        router.refresh();
      } else {
        // Request failed — revert
        setHyped(wasHyped);
        setCount((c) => c - (wasHyped ? -1 : 1));
      }
    } catch {
      setHyped(wasHyped);
      setCount((c) => c - (wasHyped ? -1 : 1));
    } finally {
      inFlight.current = false;
    }
  }

  const heartPath = "M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z";

  if (!isAuthed) {
    return (
      <span
        title="Sign in to hype"
        className="inline-flex items-center gap-1 text-gray-400 cursor-default select-none"
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d={heartPath} />
        </svg>
        {count}
      </span>
    );
  }

  return (
    <button
      onClick={handleClick}
      title={hyped ? "Remove hype" : "Hype this paper"}
      className={`inline-flex items-center gap-1 transition-colors ${
        hyped ? "text-pink-600 hover:text-pink-400" : "text-gray-400 hover:text-pink-500"
      }`}
    >
      <svg
        className="w-3.5 h-3.5"
        fill={hyped ? "currentColor" : "none"}
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path strokeLinecap="round" strokeLinejoin="round" d={heartPath} />
      </svg>
      {count}
    </button>
  );
}
