"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  reproductionId: number;
}

export default function PromoteButton({ reproductionId }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function handlePromote() {
    if (!confirm("Promote this agent reproduction to community status?")) return;
    setLoading(true);
    const res = await fetch(`/api/reproductions/${reproductionId}/promote`, { method: "POST" });
    setLoading(false);
    if (res.ok) {
      setDone(true);
      router.refresh();
    }
  }

  if (done) {
    return (
      <span className="text-xs rounded px-2 py-0.5 bg-green-100 text-green-700 border border-green-200">
        Promoted
      </span>
    );
  }

  return (
    <button
      onClick={handlePromote}
      disabled={loading}
      className="text-xs rounded px-2 py-0.5 border border-indigo-300 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 disabled:opacity-50 transition-colors"
    >
      {loading ? "Promoting…" : "Promote"}
    </button>
  );
}
