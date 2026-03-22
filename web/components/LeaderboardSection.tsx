"use client";

import { useState } from "react";
import Link from "next/link";
import VerificationBadge from "./VerificationBadge";
import type { VerificationTier } from "@/lib/types";
import type { LeaderboardRow } from "@/lib/types";

type Props = {
  datasetName: string;
  rows: LeaderboardRow[];
  submissionCount: number;
  defaultExpanded: boolean;
  isLowerBetter: boolean;
};

const DEFAULT_VISIBLE = 10;

export default function LeaderboardSection({
  datasetName,
  rows,
  submissionCount,
  defaultExpanded,
  isLowerBetter,
}: Props) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [showAll, setShowAll] = useState(false);

  const visibleRows = showAll ? rows : rows.slice(0, DEFAULT_VISIBLE);

  return (
    <div className="mb-8">
      {/* Clickable header */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-2 text-left px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl hover:bg-gray-100 transition-colors"
        aria-expanded={expanded}
      >
        <span
          className={`text-gray-500 transition-transform duration-200 ${expanded ? "rotate-0" : "-rotate-90"}`}
          aria-hidden
        >
          ▼
        </span>
        <span className="text-base font-semibold text-gray-900 flex-1">{datasetName}</span>
        <span className="text-xs text-gray-500">{submissionCount} submissions</span>
        <span className="text-xs text-gray-400 ml-2">
          {isLowerBetter ? "↓ lower is better" : "↑ higher is better"}
        </span>
      </button>

      {/* Leaderboard table */}
      {expanded && (
        <div className="border border-t-0 border-gray-200 rounded-b-xl overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-white border-b border-gray-100 text-left">
                <th className="px-4 py-2.5 font-medium text-gray-600 w-8 text-right">#</th>
                <th className="px-4 py-2.5 font-medium text-gray-600">Paper</th>
                <th className="px-4 py-2.5 font-medium text-gray-600">Metric</th>
                <th className="px-4 py-2.5 font-medium text-gray-600 text-right">Value</th>
                <th className="px-4 py-2.5 font-medium text-gray-600">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {visibleRows.map((row, idx) => (
                <tr key={row.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-2.5 text-right text-gray-400 tabular-nums">{idx + 1}</td>
                  <td className="px-4 py-2.5 max-w-xs">
                    {row.paper_id ? (
                      <Link
                        href={`/papers/${row.paper_id}`}
                        className="text-blue-600 hover:underline line-clamp-1"
                      >
                        {row.paper_title ?? row.paper_id}
                      </Link>
                    ) : (
                      <span className="text-gray-500">{row.model_name}</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-gray-500 text-xs">
                    {row.best_metric_name ?? "—"}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums font-mono">
                    {row.best_metric_value != null
                      ? Number(row.best_metric_value).toLocaleString(undefined, {
                          maximumFractionDigits: 2,
                        })
                      : "—"}
                  </td>
                  <td className="px-4 py-2.5">
                    <VerificationBadge tier={row.verification as VerificationTier} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Show all / show top 10 toggle */}
          {rows.length > DEFAULT_VISIBLE && (
            <div className="px-4 py-3 border-t border-gray-100">
              <button
                onClick={() => setShowAll((v) => !v)}
                className="text-xs text-blue-600 hover:underline"
              >
                {showAll ? `Show top ${DEFAULT_VISIBLE} results` : `Show all ${rows.length} results`}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
