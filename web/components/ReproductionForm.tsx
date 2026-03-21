"use client";

import { useState } from "react";
import { useSession, signIn } from "next-auth/react";

const TIER_DESCRIPTIONS: Record<number, string> = {
  1: "Code matches repo — confirmed code runs",
  2: "Metrics match paper — replicated reported numbers",
  3: "Independent reproduction — fresh environment, no author guidance",
  4: "Multiple verified — confirmed by 2+ independent groups",
};

interface Props {
  paperId: string;
}

export default function ReproductionForm({ paperId }: Props) {
  const { data: session } = useSession();
  const [open, setOpen] = useState(false);
  const [tierClaimed, setTierClaimed] = useState(2);
  const [hardwareSpec, setHardwareSpec] = useState("");
  const [runLogUrl, setRunLogUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  if (!session) {
    return (
      <div className="mb-4">
        <button
          onClick={() => signIn("github")}
          className="text-sm text-blue-600 hover:underline"
        >
          Sign in to submit a reproduction
        </button>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
        Reproduction submitted! It will appear below.
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/reproductions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paper_id: paperId,
          tier_claimed: tierClaimed,
          hardware_spec: hardwareSpec,
          run_log_url: runLogUrl,
          notes,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Submission failed");
        return;
      }

      setSubmitted(true);
      setOpen(false);
    } catch {
      setError("Network error, please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mb-4">
      {!open ? (
        <button
          onClick={() => setOpen(true)}
          className="rounded-lg border border-blue-300 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700 hover:bg-blue-100 transition-colors"
        >
          I reproduced this
        </button>
      ) : (
        <form
          onSubmit={handleSubmit}
          className="rounded-xl border border-gray-200 p-4 space-y-4"
        >
          <h3 className="font-semibold text-sm text-gray-900">Submit Reproduction</h3>

          {error && (
            <p className="text-sm text-red-600 rounded bg-red-50 px-3 py-2">{error}</p>
          )}

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Tier claimed
            </label>
            <select
              value={tierClaimed}
              onChange={(e) => setTierClaimed(Number(e.target.value))}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {[1, 2, 3, 4].map((t) => (
                <option key={t} value={t}>
                  Tier {t} — {TIER_DESCRIPTIONS[t]}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Hardware spec
            </label>
            <input
              type="text"
              value={hardwareSpec}
              onChange={(e) => setHardwareSpec(e.target.value)}
              required
              placeholder="e.g. RTX 3090 24GB, Ubuntu 22.04"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Run log URL
            </label>
            <input
              type="url"
              value={runLogUrl}
              onChange={(e) => setRunLogUrl(e.target.value)}
              required
              placeholder="https://github.com/... or https://wandb.ai/..."
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Notes <span className="text-gray-400">(include metric name + value)</span>
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="e.g. Achieved 84.2% top-1 accuracy on ImageNet, matching paper's reported 84.1%..."
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={loading}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {loading ? "Submitting..." : "Submit"}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
