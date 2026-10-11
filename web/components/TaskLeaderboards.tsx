"use client";

import { useEffect, useState } from "react";
import DatasetPills from "@/components/DatasetPills";
import LeaderboardSection from "@/components/LeaderboardSection";
import type { LeaderboardRow } from "@/lib/types";

function isLowerBetterMetric(metricName: string | null): boolean {
  if (!metricName) return false;
  const lower = metricName.toLowerCase();
  return ["error", "loss", "perplexity", "fid", "fpr", "mae", "mse", "rmse", "wer", "cer"].some(
    (k) => lower.includes(k)
  );
}

interface Props {
  taskId: string;
  datasets: { id: string; name: string }[];
  /** Every dataset's rows (server-rendered, metric order). The dataset filter is applied here. */
  rows: LeaderboardRow[];
}

/** `?dataset=` is applied client-side from the already-embedded rows: no server render per value. */
export default function TaskLeaderboards({ taskId, datasets, rows }: Props) {
  const [dataset, setDataset] = useState<string | undefined>(undefined);

  useEffect(() => {
    const sync = () => {
      const d = new URLSearchParams(window.location.search).get("dataset");
      setDataset(d && datasets.some((x) => x.id === d) ? d : undefined);
    };
    sync();
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, [datasets]);

  const shown = dataset ? rows.filter((r) => r.dataset_id === dataset) : rows;
  const byDataset = new Map<string, LeaderboardRow[]>();
  for (const row of shown) {
    if (!byDataset.has(row.dataset_name)) byDataset.set(row.dataset_name, []);
    byDataset.get(row.dataset_name)!.push(row);
  }

  return (
    <>
      <DatasetPills
        taskId={taskId}
        datasets={datasets}
        activeDatasetId={dataset}
        onSelect={(id) => {
          window.history.pushState(null, "", id ? `/tasks/${taskId}?dataset=${encodeURIComponent(id)}` : `/tasks/${taskId}`);
          setDataset(id);
        }}
      />

      {rows.length === 0 && <p className="text-gray-500">No leaderboard results yet.</p>}

      {shown.length > 0 && (
        <div>
          <h2 className="text-base font-semibold text-gray-900 mb-4">Benchmark Results</h2>
          {[...byDataset.entries()].map(([dsName, dsRows], idx) => {
            const firstMetricName = dsRows.find((r) => r.best_metric_name)?.best_metric_name ?? null;
            return (
              <LeaderboardSection
                key={dsName}
                datasetName={dsName}
                rows={dsRows}
                submissionCount={dsRows.length}
                defaultExpanded={idx === 0 || byDataset.size <= 3 || !!dataset}
                isLowerBetter={isLowerBetterMetric(firstMetricName)}
              />
            );
          })}
        </div>
      )}
    </>
  );
}
