"use client";

import { useState } from "react";
import Link from "next/link";
import { stripLatex } from "@/lib/strip-latex";
import VerificationBadge from "./VerificationBadge";
import type { VerificationTier } from "@/lib/types";

interface BenchmarkEntry {
  task_name: string;
  task_id: string;
  dataset_name: string;
  dataset_id: string;
  model_name: string | null;
  best_metric_name: string | null;
  best_metric_value: number | null;
  verification: string;
  source: string | null;
  verified_median: number | null;
  repro_count: number;
}

interface Props {
  entries: BenchmarkEntry[];
}

export default function PaperBenchmarks({ entries }: Props) {
  // Group by task
  const byTask = new Map<string, { taskId: string; rows: BenchmarkEntry[] }>();
  for (const e of entries) {
    if (!byTask.has(e.task_name)) {
      byTask.set(e.task_name, { taskId: e.task_id, rows: [] });
    }
    byTask.get(e.task_name)!.rows.push(e);
  }

  const taskNames = [...byTask.keys()];
  const collapseAll = taskNames.length > 5;

  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(() => {
    if (collapseAll) return new Set();
    return new Set(taskNames.slice(0, 1)); // first task expanded
  });

  function toggleTask(name: string) {
    setExpandedTasks((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  function expandAll() {
    setExpandedTasks(new Set(taskNames));
  }

  return (
    <div>
      {collapseAll && (
        <button
          onClick={expandAll}
          className="text-xs text-blue-600 hover:underline mb-3 block"
        >
          Expand all {taskNames.length} tasks
        </button>
      )}

      {taskNames.map((taskName) => {
        const { taskId, rows } = byTask.get(taskName)!;
        const isExpanded = expandedTasks.has(taskName);

        // Group rows within task by dataset
        const byDataset = new Map<string, BenchmarkEntry[]>();
        for (const r of rows) {
          if (!byDataset.has(r.dataset_name)) byDataset.set(r.dataset_name, []);
          byDataset.get(r.dataset_name)!.push(r);
        }

        return (
          <div key={taskName} className="mb-4">
            <button
              onClick={() => toggleTask(taskName)}
              className="w-full flex items-center gap-2 text-left px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <span className={`text-gray-400 text-xs transition-transform ${isExpanded ? "rotate-0" : "-rotate-90"}`}>
                ▼
              </span>
              <Link
                href={`/tasks/${taskId}`}
                onClick={(e) => e.stopPropagation()}
                className="text-sm font-semibold text-blue-600 hover:underline"
              >
                {taskName}
              </Link>
              <span className="text-xs text-gray-400 ml-auto">{rows.length} result{rows.length !== 1 ? "s" : ""}</span>
            </button>

            {isExpanded && (
              <div className="border border-t-0 border-gray-200 rounded-b-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-white border-b border-gray-100 text-left">
                      <th className="px-4 py-2 font-medium text-gray-600">Dataset</th>
                      <th className="px-4 py-2 font-medium text-gray-600">Model</th>
                      <th className="px-4 py-2 font-medium text-gray-600">Metric</th>
                      <th className="px-4 py-2 font-medium text-gray-600 text-right">Claimed</th>
                      <th className="px-4 py-2 font-medium text-gray-600 text-right">Verified</th>
                      <th className="px-4 py-2 font-medium text-gray-600">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {rows.map((e, i) => {
                      const hasRepro = e.repro_count > 0;
                      return (
                        <tr key={i} className="hover:bg-gray-50">
                          <td className="px-4 py-2 text-gray-600 text-xs">{stripLatex(e.dataset_name)}</td>
                          <td className="px-4 py-2 font-medium text-xs">{e.model_name ? stripLatex(e.model_name) : "—"}</td>
                          <td className="px-4 py-2 text-gray-500 text-xs">{e.best_metric_name ?? "—"}</td>
                          <td className="px-4 py-2 text-right tabular-nums font-mono text-xs">
                            {e.best_metric_value != null
                              ? Number(e.best_metric_value).toLocaleString(undefined, { maximumFractionDigits: 2 })
                              : "—"}
                          </td>
                          <td className="px-4 py-2 text-right tabular-nums font-mono text-xs">
                            {hasRepro && e.verified_median != null ? (
                              <span className="text-green-700">
                                {Number(e.verified_median).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                                <span className="text-gray-400 font-sans ml-1">({e.repro_count})</span>
                              </span>
                            ) : (
                              <span className="text-gray-300">—</span>
                            )}
                          </td>
                          <td className="px-4 py-2">
                            {hasRepro ? (
                              <span className="rounded-full px-2 py-0.5 text-xs font-medium bg-green-50 text-green-700 border border-green-200">
                                Verified
                              </span>
                            ) : e.source === "community" ? (
                              <span className="rounded-full px-2 py-0.5 text-xs font-medium bg-teal-50 text-teal-700 border border-teal-200">
                                Community Reported
                              </span>
                            ) : e.source === "author" ? (
                              <span className="rounded-full px-2 py-0.5 text-xs font-medium bg-purple-50 text-purple-700 border border-purple-200">
                                Author Reported
                              </span>
                            ) : (
                              <VerificationBadge tier={e.verification as VerificationTier} />
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
