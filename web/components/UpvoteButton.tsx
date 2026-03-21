"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";

interface Props {
  paperId: string;
  initialCount: number;
  initialUpvoted: boolean;
}

export default function UpvoteButton({ paperId, initialCount, initialUpvoted }: Props) {
  const { data: session } = useSession();
  const [count, setCount] = useState(initialCount);
  const [upvoted, setUpvoted] = useState(initialUpvoted);
  const [loading, setLoading] = useState(false);

  if (!session) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-400 cursor-default">
        ▲ {count}
        <span className="text-xs">· sign in to upvote</span>
      </span>
    );
  }

  async function toggle() {
    if (loading) return;
    setLoading(true);
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
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={toggle}
      disabled={loading}
      className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
        upvoted
          ? "border-blue-400 bg-blue-50 text-blue-700 hover:bg-blue-100"
          : "border-gray-300 text-gray-600 hover:bg-gray-50"
      }`}
    >
      ▲ {count}
    </button>
  );
}
