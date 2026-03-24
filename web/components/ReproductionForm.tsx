"use client";

import { useState, useEffect } from "react";
import { useSession, signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { stripLatex } from "@/lib/strip-latex";

const TIER_DESCRIPTIONS: Record<number, string> = {
  1: "Code confirmed to run against the linked repository",
  2: "Reported metrics match the paper's claimed numbers",
  3: "Independent reproduction in a fresh environment",
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
  const looksLikeUrl = value.startsWith("http://") || value.startsWith("https://") || value.startsWith("www.");
  if (looksLikeUrl) {
    const url = value.startsWith("www.") ? `https://${value}` : value;
    try {
      const { hostname } = new URL(url);
      const ok = ALLOWED_URL_DOMAINS.some(
        (d) => hostname === d || hostname.endsWith("." + d)
      );
      if (!ok) {
        return "Run logs must be hosted on GitHub, Gist, Weights & Biases, Google Colab, or Hugging Face. Alternatively, paste your terminal output directly as text.";
      }
    } catch {
      return "Invalid URL";
    }
  }
  if (value.length > 10000) return "Maximum 10,000 characters";
  return null;
}

export interface BenchmarkOption {
  dataset_id: string;
  dataset_name: string;
  metric_name: string | null;
  model_names: string[]; // distinct model names for this paper+dataset
}

interface Props {
  paperId: string;
  benchmarks?: BenchmarkOption[];
  hasCodeRepo?: boolean;
}

export default function ReproductionForm({ paperId, benchmarks = [], hasCodeRepo = false }: Props) {
  const { data: session } = useSession();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  // Auto-open when navigating via #reproduce CTA link
  useEffect(() => {
    if (typeof window !== "undefined" && window.location.hash === "#reproduce") {
      setOpen(true);
    }
  }, []);
  const availableTiers = hasCodeRepo ? [1, 2, 3] : [3];
  const [tierClaimed, setTierClaimed] = useState(hasCodeRepo ? 2 : 3);
  const [hardwareSpec, setHardwareSpec] = useState("");
  const [runLog, setRunLog] = useState("");
  const [notes, setNotes] = useState("");
  const [selectedDatasetId, setSelectedDatasetId] = useState("");
  const [selectedModelName, setSelectedModelName] = useState("");
  const [actualMetricName, setActualMetricName] = useState("");
  const [actualMetricValue, setActualMetricValue] = useState("");

  const selectedBenchmark = benchmarks.find((b) => b.dataset_id === selectedDatasetId);
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
          dataset_id: selectedDatasetId || undefined,
          actual_metric_name: selectedBenchmark?.metric_name || actualMetricName || undefined,
          actual_metric_value: actualMetricValue !== "" ? Number(actualMetricValue) : undefined,
          model_name: selectedModelName || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Submission failed");
        return;
      }

      setSubmitted(true);
      setOpen(false);
      router.refresh();
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
          <span data-testid="repro-toggle">I reproduced this</span>
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
              {availableTiers.map((t) => (
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

          {/* Optional benchmark + metric */}
          {benchmarks.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Which dataset did you evaluate on?{" "}
                <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <select
                value={selectedDatasetId}
                onChange={(e) => {
                  const dsId = e.target.value;
                  setSelectedDatasetId(dsId);
                  setActualMetricValue("");
                  // Auto-select model if only one exists for this dataset
                  const bench = benchmarks.find((b) => b.dataset_id === dsId);
                  if (bench?.model_names.length === 1) {
                    setSelectedModelName(bench.model_names[0]);
                  } else {
                    setSelectedModelName("");
                  }
                }}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">— None —</option>
                {benchmarks.map((b) => (
                  <option key={b.dataset_id} value={b.dataset_id}>
                    {stripLatex(b.dataset_name)}{b.metric_name ? ` (${b.metric_name})` : ""}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Model selector — shown when dataset has multiple models */}
          {selectedBenchmark && selectedBenchmark.model_names.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Which model did you reproduce?{" "}
                <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              {selectedBenchmark.model_names.length === 1 ? (
                <p className="text-xs text-green-600">
                  Auto-selected: {selectedBenchmark.model_names[0]}
                </p>
              ) : (
                <select
                  value={selectedModelName}
                  onChange={(e) => setSelectedModelName(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">— Any model —</option>
                  {selectedBenchmark.model_names.map((m) => (
                    <option key={m} value={m}>{stripLatex(m)}</option>
                  ))}
                </select>
              )}
            </div>
          )}

          {selectedBenchmark ? (
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Your result — {selectedBenchmark.metric_name ?? "metric"} on {selectedBenchmark.dataset_name}
              </label>
              <input
                type="number"
                step="any"
                value={actualMetricValue}
                onChange={(e) => setActualMetricValue(e.target.value)}
                placeholder="e.g. 76.3"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          ) : (
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
          )}

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
              data-testid="repro-submit"
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
