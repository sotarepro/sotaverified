"use client";

import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { invalidatePaperState, usePaperState } from "@/lib/use-paper-state";

interface Props {
  paperId: string;
  initialCount: number;
}

const heartPath = "M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z";

export default function UpvoteButton({ paperId, initialCount }: Props) {
  const { data: session } = useSession();
  const router = useRouter();
  const { state } = usePaperState(paperId);
  const [count, setCount] = useState(initialCount);
  const [upvoted, setUpvoted] = useState(false);
  const inFlight = useRef(false);

  useEffect(() => {
    if (state) setUpvoted(state.upvoted);
  }, [state]);

  if (!session) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-400 cursor-default">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d={heartPath} />
        </svg>
        {count}
        <span className="text-xs">· sign in to hype</span>
      </span>
    );
  }

  async function toggle() {
    if (inFlight.current) return;
    inFlight.current = true;
    const wasUpvoted = upvoted;
    setUpvoted(!wasUpvoted);
    setCount((c) => c + (wasUpvoted ? -1 : 1));
    try {
      const res = await fetch("/api/upvotes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paper_id: paperId }),
      });
      if (res.ok) {
        const data = await res.json();
        setUpvoted(data.upvoted);
        setCount(data.count);
        invalidatePaperState(paperId);
        router.refresh();
      } else {
        setUpvoted(wasUpvoted);
        setCount((c) => c - (wasUpvoted ? -1 : 1));
      }
    } catch {
      setUpvoted(wasUpvoted);
      setCount((c) => c - (wasUpvoted ? -1 : 1));
    } finally {
      inFlight.current = false;
    }
  }

  return (
    <button
      onClick={toggle}
      data-testid="detail-hype-btn"
      data-hyped={upvoted}
      title={upvoted ? "Remove hype" : "Hype this paper"}
      className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
        upvoted
          ? "border-pink-300 bg-pink-50 text-pink-700 hover:bg-pink-100"
          : "border-gray-300 text-gray-600 hover:bg-gray-50"
      }`}
    >
      <svg
        className="w-4 h-4"
        fill={upvoted ? "currentColor" : "none"}
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path strokeLinecap="round" strokeLinejoin="round" d={heartPath} />
      </svg>
      <span data-testid="detail-hype-count">{count}</span>
    </button>
  );
}
