"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { stripLatex } from "@/lib/strip-latex";

interface Props {
  paperId: string;
  paperTasks: string[]; // task names from paper.tasks
}

export default function AuthorBenchmarkForm({ paperId, paperTasks }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [taskSearch, setTaskSearch] = useState("");
  const [taskId, setTaskId] = useState("");
  const [taskResults, setTaskResults] = useState<{ id: string; name: string }[]>([]);
  const [datasetSearch, setDatasetSearch] = useState("");
  const [datasetId, setDatasetId] = useState("");
  const [datasetResults, setDatasetResults] = useState<{ id: string; name: string }[]>([]);
  const [metricName, setMetricName] = useState("");
  const [metricValue, setMetricValue] = useState("");
  const [modelName, setModelName] = useState("");
  const [higherIsBetter, setHigherIsBetter] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  async function searchTasks(q: string) {
    setTaskSearch(q);
    // Paper-scoped tasks first, then filtered search if typing
    const url = q.length >= 2
      ? `/api/search-entities?type=tasks&q=${encodeURIComponent(q)}`
      : `/api/papers/${paperId}/form-options?type=tasks`;
    const res = await fetch(url);
    if (res.ok) setTaskResults(await res.json());
  }

  async function searchDatasets(q: string) {
    setDatasetSearch(q);
    // Paper+task scoped datasets first, then filtered search if typing
    const url = q.length >= 2
      ? `/api/search-entities?type=datasets&q=${encodeURIComponent(q)}`
      : `/api/papers/${paperId}/form-options?type=datasets${taskId ? `&task_id=${taskId}` : ""}`;
    const res = await fetch(url);
    if (res.ok) setDatasetResults(await res.json());
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!taskId || !datasetId || !metricName || metricValue === "") {
      setError("Task, dataset, metric name, and value are all required.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/papers/${paperId}/benchmarks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          task_id: taskId,
          dataset_id: datasetId,
          metric_name: metricName,
          metric_value: Number(metricValue),
          model_name: modelName || undefined,
          higher_is_better: higherIsBetter,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Submission failed");
        return;
      }

      setSubmitted(true);
      setTaskSearch(""); setTaskId(""); setTaskResults([]);
      setDatasetSearch(""); setDatasetId(""); setDatasetResults([]);
      setMetricName(""); setMetricValue(""); setModelName("");
      setHigherIsBetter(true); setError(null);
      router.refresh();
    } catch {
      setError("Network error, please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (submitted) {
    return (
      <div className="mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
        Benchmark result submitted! It will appear in the leaderboard.
      </div>
    );
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-lg border border-green-300 bg-green-50 px-4 py-2 text-sm font-medium text-green-700 hover:bg-green-100 transition-colors"
      >
        Submit benchmark results
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border border-gray-200 p-4 space-y-4 mb-4">
      <h3 className="font-semibold text-sm text-gray-900">Submit Benchmark Results</h3>
      <p className="text-xs text-gray-500">As a verified author, you can add benchmark entries for this paper.</p>

      {error && (
        <p className="text-sm text-red-600 rounded bg-red-50 px-3 py-2">{error}</p>
      )}

      {/* Task */}
      <div className="relative">
        <label className="block text-xs font-medium text-gray-700 mb-1">Task</label>
        <input
          type="text"
          value={taskSearch}
          onChange={(e) => searchTasks(e.target.value)}
          onFocus={() => { if (!taskId && !taskSearch) searchTasks(""); }}
          placeholder="Search tasks..."
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        {taskId && (
          <p className="text-xs text-green-600 mt-0.5">Selected: {taskSearch}</p>
        )}
        {taskResults.length > 0 && !taskId && (
          <ul className="absolute z-10 w-full bg-white border border-gray-200 rounded-lg mt-1 max-h-40 overflow-y-auto shadow-lg">
            {taskResults.map((t) => (
              <li key={t.id}>
                <button
                  type="button"
                  onClick={() => { setTaskId(t.id); setTaskSearch(t.name); setTaskResults([]); }}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50"
                >
                  {t.name}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Dataset */}
      <div className="relative">
        <label className="block text-xs font-medium text-gray-700 mb-1">Dataset</label>
        <input
          type="text"
          value={datasetSearch}
          onChange={(e) => searchDatasets(e.target.value)}
          onFocus={() => { if (!datasetId && !datasetSearch) searchDatasets(""); }}
          placeholder="Search datasets..."
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        {datasetId && (
          <p className="text-xs text-green-600 mt-0.5">Selected: {datasetSearch}</p>
        )}
        {datasetResults.length > 0 && !datasetId && (
          <ul className="absolute z-10 w-full bg-white border border-gray-200 rounded-lg mt-1 max-h-40 overflow-y-auto shadow-lg">
            {datasetResults.map((d) => (
              <li key={d.id}>
                <button
                  type="button"
                  onClick={() => { setDatasetId(d.id); setDatasetSearch(d.name); setDatasetResults([]); }}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50"
                >
                  {stripLatex(d.name)}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Metric name + value */}
      <div className="flex gap-2">
        <div className="flex-1">
          <label className="block text-xs font-medium text-gray-700 mb-1">Metric name</label>
          <input
            type="text"
            value={metricName}
            onChange={(e) => setMetricName(e.target.value)}
            placeholder="e.g. Top-1 Accuracy"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="w-32">
          <label className="block text-xs font-medium text-gray-700 mb-1">Value</label>
          <input
            type="number"
            step="any"
            value={metricValue}
            onChange={(e) => setMetricValue(e.target.value)}
            placeholder="e.g. 93.8"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Model name */}
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">
          Model name <span className="text-gray-400 font-normal">(optional)</span>
        </label>
        <input
          type="text"
          value={modelName}
          onChange={(e) => setModelName(e.target.value)}
          placeholder="e.g. ViT-L/16"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Higher is better toggle */}
      <label className="flex items-center gap-2 text-sm text-gray-700">
        <input
          type="checkbox"
          checked={higherIsBetter}
          onChange={(e) => setHigherIsBetter(e.target.checked)}
          className="rounded border-gray-300"
        />
        Higher is better
        <span className="text-gray-400 text-xs">(uncheck for error rate, loss, etc.)</span>
      </label>

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50 transition-colors"
        >
          {loading ? "Submitting..." : "Submit"}
        </button>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setTaskSearch(""); setTaskId(""); setTaskResults([]);
            setDatasetSearch(""); setDatasetId(""); setDatasetResults([]);
            setMetricName(""); setMetricValue(""); setModelName("");
            setHigherIsBetter(true); setError(null);
          }}
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50 transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
