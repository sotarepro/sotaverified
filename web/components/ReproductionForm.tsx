"use client";

import { useState } from "react";
import { useSession, signIn } from "next-auth/react";

const TIER_DESCRIPTIONS: Record<number, string> = {
  1: "Code confirmed to run against the linked repository",
  2: "Reported metrics match the paper's claimed numbers",
  3: "Independent reproduction in a fresh environment",
  4: "Confirmed by multiple independent groups",
};

const ALLOWED_URL_DOMAINS = [
  "github.com",
  "gist.github.com",
  "wandb.ai",
  "colab.research.google.com",
  "huggingface.co",
];

function validateRunLog(value: string): string | null {
  if (!value.trim()) return null; // optional
  if (value.startsWith("http://") || value.startsWith("https://")) {
    try {
      const { hostname } = new URL(value);
      const ok = ALLOWED_URL_DOMAINS.some(
        (d) => hostname === d || hostname.endsWith("." + d)
      );
      if (!ok) {
        return `URL must be from: ${ALLOWED_URL_DOMAINS.join(", ")}`;
      }
    } catch {
      return "Invalid URL";
    }
  }
  if (value.length > 10000) return "Maximum 10,000 characters";
  return null;
}

interface Props {
  paperId: string;
  isAgeGated?: boolean;
}

export default function ReproductionForm({ paperId, isAgeGated = false }: Props) {
  const { data: session } = useSession();
  const [open, setOpen] = useState(false);
  const [showAgeGate, setShowAgeGate] = useState(false);
  const [tierClaimed, setTierClaimed] = useState(2);
  const [hardwareSpec, setHardwareSpec] = useState("");
  const [runLog, setRunLog] = useState("");
  const [notes, setNotes] = useState("");
  const [actualMetricName, setActualMetricName] = useState("");
  const [actualMetricValue, setActualMetricValue] = useState("");
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
    setError(null);

    const logErr = validateRunLog(runLog);
    if (logErr) { setError(logErr); return; }

    setLoading(true);
    try {
      const res = await fetch("/api/reproductions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paper_id: paperId,
          tier_claimed: tierClaimed,
          hardware_spec: hardwareSpec,
          run_log_url: runLog,
          notes,
          actual_metric_name: actualMetricName || undefined,
          actual_metric_value: actualMetricValue !== "" ? Number(actualMetricValue) : undefined,
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
      {showAgeGate ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <p className="font-medium mb-1">Account too new to submit reproductions</p>
          <p className="text-amber-700 text-xs">
            To prevent spam, new GitHub accounts must be at least{" "}
            {process.env.NEXT_PUBLIC_MIN_ACCOUNT_AGE_DAYS ?? "60"} days old before submitting
            reproductions. You can still browse papers, hype results, and explore leaderboards
            while your account matures.
          </p>
        </div>
      ) : !open ? (
        <button
          onClick={() => {
            if (isAgeGated) {
              setShowAgeGate(true);
            } else {
              setOpen(true);
            }
          }}
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

          {/* Tier */}
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
            <p className="text-xs text-gray-400 mt-1">{TIER_DESCRIPTIONS[tierClaimed]}</p>
          </div>

          {/* Hardware */}
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

          {/* Run log — URL or pasted output */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Run log{" "}
              <span className="text-gray-400 font-normal">
                (optional — paste terminal output, or link to GitHub gist / wandb / colab)
              </span>
            </label>
            <textarea
              value={runLog}
              onChange={(e) => setRunLog(e.target.value)}
              rows={4}
              placeholder={"Paste run output here, or enter a URL:\nhttps://gist.github.com/...\nhttps://wandb.ai/..."}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
            />
            <p className="text-xs text-gray-400 mt-0.5">
              If a URL: must be github.com, gist.github.com, wandb.ai, colab, or huggingface.co
            </p>
          </div>

          {/* Optional metric */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Reproduced metric{" "}
              <span className="text-gray-400 font-normal">(optional — enables automated score calculation)</span>
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={actualMetricName}
                onChange={(e) => setActualMetricName(e.target.value)}
                placeholder="e.g. Top-1 Accuracy"
                className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="number"
                step="any"
                value={actualMetricValue}
                onChange={(e) => setActualMetricValue(e.target.value)}
                placeholder="e.g. 76.3"
                className="w-32 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Notes{" "}
              <span className="text-gray-400 font-normal">(include metric name + value if not using fields above)</span>
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
