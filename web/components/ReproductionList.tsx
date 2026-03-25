"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";

interface Reproduction {
  id: number;
  user_id: string;
  username: string | null;
  display_name: string | null;
  tier_claimed: number;
  hardware_spec: string;
  run_log_url: string | null;
  notes: string | null;
  upvote_count: number;
  flag_count: number;
  status: string;
  created_at: string;
  actual_metric_name: string | null;
  actual_metric_value: number | null;
  model_name: string | null;
  dataset_name: string | null;
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
  const [userFlags, setUserFlags] = useState<Record<number, boolean>>({});

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
    const alreadyFlagged = userFlags[id];
    if (!alreadyFlagged && !confirm("Flag this reproduction as spam or incorrect?")) return;

    const res = await fetch(`/api/reproductions/${id}/flag`, { method: "POST" });
    if (res.ok) {
      const data = await res.json();
      setUserFlags((prev) => ({ ...prev, [id]: data.flagged }));
      if (data.hidden) {
        // Auto-hidden by threshold — remove from list
        setItems((prev) => prev.filter((r) => r.id !== id));
      } else {
        // Update flag count in place
        setItems((prev) =>
          prev.map((r) => (r.id === id ? { ...r, flag_count: data.count } : r))
        );
      }
    }
  }

  function isUrl(s: string | null | undefined): boolean {
    if (!s || typeof s !== "string") return false;
    return s.startsWith("http://") || s.startsWith("https://");
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
              <span className="text-xs text-gray-400">
                by{" "}
                <a
                  href={`https://github.com/${r.username ?? r.user_id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-600 hover:underline"
                >
                  {r.display_name || r.username || r.user_id}
                </a>
              </span>
              <span className="text-xs text-gray-400">
                {new Date(r.created_at).toLocaleDateString()}
              </span>
            </div>

            <div className="flex gap-2 shrink-0">
              {session?.user?.github_id !== r.user_id ? (
                <button
                  onClick={() => handleUpvote(r.id)}
                  className={`inline-flex items-center gap-1 text-xs rounded px-2 py-0.5 border transition-colors ${
                    userVotes[r.id]
                      ? "border-pink-300 bg-pink-50 text-pink-600"
                      : "border-gray-200 text-gray-400 hover:bg-gray-50 hover:text-pink-500"
                  }`}
                >
                  <svg className="w-3 h-3" fill={userVotes[r.id] ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                  </svg>
                  {r.upvote_count}
                </button>
              ) : (
                <span className="inline-flex items-center gap-1 text-xs text-gray-300 px-2 py-0.5" title="You can't hype your own reproduction">
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                  </svg>
                  {r.upvote_count}
                </span>
              )}
              {session && (
                <button
                  onClick={() => handleFlag(r.id)}
                  disabled={userFlags[r.id]}
                  className={`text-xs rounded px-2 py-0.5 border transition-colors ${
                    userFlags[r.id]
                      ? "border-red-200 bg-red-50 text-red-500 cursor-default"
                      : "border-gray-200 text-gray-400 hover:bg-gray-50 hover:text-red-500"
                  }`}
                >
                  {userFlags[r.id] ? "Flagged" : "Flag"}
                  {r.flag_count > 0 && (
                    <span className="ml-1 text-gray-400">({r.flag_count})</span>
                  )}
                </button>
              )}
            </div>
          </div>

          {/* Metric result — model, metric, value, dataset */}
          {(r.actual_metric_name || r.actual_metric_value != null) && (
            <div className="text-gray-500 text-xs mb-1">
              Result:{" "}
              <span className="text-gray-700 font-medium">
                {[
                  r.model_name,
                  r.actual_metric_name && r.actual_metric_value != null
                    ? `${r.actual_metric_name}: ${r.actual_metric_value}`
                    : r.actual_metric_name ?? (r.actual_metric_value != null ? String(r.actual_metric_value) : null),
                  r.dataset_name ? `on ${r.dataset_name}` : null,
                ].filter(Boolean).join(" — ")}
              </span>
            </div>
          )}

          {r.hardware_spec && (
            <div className="text-gray-500 text-xs mb-1">
              Hardware: <span className="text-gray-700">{r.hardware_spec}</span>
            </div>
          )}

          {r.run_log_url && (
            <div className="text-gray-500 text-xs mb-2">
              Log:{" "}
              {isUrl(r.run_log_url) ? (
                <a
                  href={r.run_log_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline font-mono truncate"
                >
                  {r.run_log_url.replace(/^https?:\/\/(www\.)?/, "")}
                </a>
              ) : (
                <span className="text-gray-700 font-mono text-xs whitespace-pre-wrap break-all">
                  {r.run_log_url.slice(0, 300)}{r.run_log_url.length > 300 ? "…" : ""}
                </span>
              )}
            </div>
          )}

          {r.notes && (
            <p className="text-gray-600 text-xs leading-relaxed">{r.notes}</p>
          )}
        </div>
      ))}
    </div>
  );
}
