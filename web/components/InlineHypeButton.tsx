"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";

interface Props {
  paperId: string;
  initialCount: number;
}

export default function InlineHypeButton({ paperId, initialCount }: Props) {
  const { status } = useSession();
  const isAuthed = status === "authenticated";

  const [count, setCount] = useState(initialCount);
  const [hyped, setHyped] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    if (!isAuthed || loading) return;
    setLoading(true);
    try {
      const res = await fetch("/api/upvotes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paper_id: paperId }),
      });
      if (res.ok) {
        const data = await res.json() as { upvoted: boolean; count: number };
        // API returns organic count; our initialCount includes hype_score
        // so we track delta from initial rather than replacing with API value
        const delta = data.upvoted ? 1 : -1;
        if (data.upvoted !== hyped) {
          setCount((c) => c + delta);
          setHyped(data.upvoted);
        }
      }
    } finally {
      setLoading(false);
    }
  }

  if (!isAuthed) {
    return (
      <span
        title="Sign in to hype"
        className="inline-flex items-center gap-1 text-gray-400 cursor-default select-none"
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
        </svg>
        {count}
      </span>
    );
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      title={hyped ? "Remove hype" : "Hype this paper"}
      className={`inline-flex items-center gap-1 transition-colors disabled:opacity-50 ${
        hyped
          ? "text-pink-600 hover:text-pink-400"
          : "text-gray-400 hover:text-pink-500"
      }`}
    >
      <svg
        className="w-3.5 h-3.5"
        fill={hyped ? "currentColor" : "none"}
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
      </svg>
      {count}
    </button>
  );
}
