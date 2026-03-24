"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ClearUserData() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleClear() {
    if (!username.trim()) return;
    if (!confirm(
      `This will delete all reproductions, hype votes, author claims, ` +
      `flags, and activity log entries for @${username}. Are you sure?`
    )) return;

    setLoading(true);
    setError(null);
    setResult(null);

    const res = await fetch("/api/admin/clear-user-data", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: username.trim() }),
    });

    setLoading(false);

    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Failed");
      return;
    }

    const data = await res.json();
    const c = data.counts;
    setResult(
      `Cleared: ${c.reproductions} reproductions, ${c.hype_votes} hype votes, ` +
      `${c.author_claims} author claims, ${c.activity_log} activity log entries. ` +
      `${data.papers_recomputed} paper scores recomputed.`
    );
    setUsername("");
    router.refresh();
  }

  return (
    <div className="mb-6">
      <h3 className="text-sm font-medium text-gray-700 mb-2">Clear User Data</h3>
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="GitHub username"
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-48"
        />
        <button
          onClick={handleClear}
          disabled={loading || !username.trim()}
          className="rounded-lg border border-red-300 bg-red-50 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-100 disabled:opacity-50 transition-colors"
        >
          {loading ? "Clearing..." : "Clear All User Data"}
        </button>
      </div>
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
      {result && <p className="text-xs text-green-600 mt-1">{result}</p>}
    </div>
  );
}
