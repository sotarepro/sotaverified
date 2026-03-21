"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";

interface Reproduction {
  id: number;
  user_id: string;
  username: string | null;
  tier_claimed: number;
  hardware_spec: string;
  run_log_url: string;
  notes: string | null;
  upvote_count: number;
  flag_count: number;
  status: string;
  created_at: string;
}

const TIER_LABELS: Record<number, string> = {
  1: "Code runs",
  2: "Metrics match",
  3: "Independent",
  4: "Multi-verified",
};

const TIER_COLORS: Record<number, string> = {
  1: "bg-gray-100 text-gray-700",
  2: "bg-blue-50 text-blue-700",
  3: "bg-green-50 text-green-700",
  4: "bg-purple-50 text-purple-700",
};

interface Props {
  paperId: string;
}

export default function ReproductionList({ paperId }: Props) {
  const { data: session } = useSession();
  const [items, setItems] = useState<Reproduction[]>([]);
  const [loading, setLoading] = useState(true);
  const [userVotes, setUserVotes] = useState<Record<number, boolean>>({});

  useEffect(() => {
    fetch(`/api/reproductions?paper_id=${paperId}`)
      .then((r) => r.json())
      .then((data) => {
        setItems(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [paperId]);

  async function handleUpvote(id: number) {
    if (!session) return;
    const res = await fetch(`/api/reproductions/${id}/upvote`, { method: "POST" });
    if (res.ok) {
      const data = await res.json();
      setUserVotes((prev) => ({ ...prev, [id]: data.upvoted }));
      setItems((prev) =>
        prev.map((r) => (r.id === id ? { ...r, upvote_count: data.count } : r))
      );
    }
  }

  async function handleFlag(id: number) {
    if (!session) return;
    if (!confirm("Flag this reproduction as spam or incorrect?")) return;
    const res = await fetch(`/api/reproductions/${id}/flag`, { method: "POST" });
    if (res.ok) {
      const data = await res.json();
      if (data.flagged) {
        setItems((prev) => prev.filter((r) => r.id !== id));
      }
    }
  }

  if (loading) return null;
  if (items.length === 0) {
    return (
      <p className="text-sm text-gray-400">
        No reproductions yet. Be the first to verify this paper.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {items.map((r) => (
        <div
          key={r.id}
          className="rounded-xl border border-gray-200 p-4 text-sm"
        >
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${TIER_COLORS[r.tier_claimed]}`}
              >
                Tier {r.tier_claimed} — {TIER_LABELS[r.tier_claimed]}
              </span>
              {r.status === "verified" && (
                <span className="rounded-full px-2.5 py-0.5 text-xs font-medium bg-green-100 text-green-800 border border-green-200">
                  Verified
                </span>
              )}
              <span className="text-xs text-gray-400">
                by{" "}
                <a
                  href={`https://github.com/${r.username ?? r.user_id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-600 hover:underline"
                >
                  {r.username ?? r.user_id}
                </a>
              </span>
              <span className="text-xs text-gray-400">
                {new Date(r.created_at).toLocaleDateString()}
              </span>
            </div>

            <div className="flex gap-2 shrink-0">
              <button
                onClick={() => handleUpvote(r.id)}
                className={`text-xs rounded px-2 py-0.5 border transition-colors ${
                  userVotes[r.id]
                    ? "border-blue-400 bg-blue-50 text-blue-700"
                    : "border-gray-200 text-gray-500 hover:bg-gray-50"
                }`}
              >
                ▲ {r.upvote_count}
              </button>
              {session && (
                <button
                  onClick={() => handleFlag(r.id)}
                  className="text-xs rounded px-2 py-0.5 border border-gray-200 text-gray-400 hover:bg-gray-50 hover:text-red-500 transition-colors"
                >
                  Flag
                </button>
              )}
            </div>
          </div>

          <div className="text-gray-500 text-xs mb-1">
            Hardware: <span className="text-gray-700">{r.hardware_spec}</span>
          </div>

          <div className="text-gray-500 text-xs mb-2">
            Log:{" "}
            <a
              href={r.run_log_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline font-mono truncate"
            >
              {r.run_log_url.replace(/^https?:\/\/(www\.)?/, "")}
            </a>
          </div>

          {r.notes && (
            <p className="text-gray-600 text-xs leading-relaxed">{r.notes}</p>
          )}
        </div>
      ))}
    </div>
  );
}
