"use client";

import { useState } from "react";
import { useSession, signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function SubmitPaperForm() {
  const { data: session } = useSession();
  const router = useRouter();
  const [arxivId, setArxivId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!session) {
    return (
      <div className="rounded-xl border border-gray-200 p-6 text-center">
        <p className="text-gray-500 mb-4">Sign in with GitHub to submit a paper.</p>
        <button
          onClick={() => signIn("github")}
          className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 transition-colors"
        >
          Sign in with GitHub
        </button>
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/submit-paper", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ arxiv_id_input: arxivId }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Submission failed");
        return;
      }

      if (data.exists || data.created) {
        router.push(`/papers/${data.paper_id}`);
      }
    } catch {
      setError("Network error, please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-lg">
      {error && (
        <p className="text-sm text-red-600 rounded bg-red-50 px-3 py-2">{error}</p>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          arXiv ID or URL
        </label>
        <input
          type="text"
          value={arxivId}
          onChange={(e) => setArxivId(e.target.value)}
          required
          placeholder="e.g. 2401.12345 or https://arxiv.org/abs/2401.12345"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <p className="text-xs text-gray-400 mt-1">
          Accepts bare IDs, arXiv URLs, or /abs/ and /pdf/ links.
        </p>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
      >
        {loading ? "Looking up..." : "Submit Paper"}
      </button>
    </form>
  );
}
