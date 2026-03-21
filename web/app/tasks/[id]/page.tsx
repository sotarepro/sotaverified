import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getTask,
  getLeaderboard,
  getTaskDatasets,
} from "@/lib/queries";
import VerificationBadge from "@/components/VerificationBadge";
import type { VerificationTier } from "@/lib/types";

export default async function TaskPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ dataset?: string }>;
}) {
  const { id } = await params;
  const { dataset: datasetFilter } = await searchParams;

  const [task, datasets, rows] = await Promise.all([
    getTask(id),
    getTaskDatasets(id),
    getLeaderboard(id, datasetFilter),
  ]);

  if (!task) notFound();

  // Group leaderboard by dataset
  const byDataset = new Map<string, typeof rows>();
  for (const row of rows) {
    const key = row.dataset_name;
    if (!byDataset.has(key)) byDataset.set(key, []);
    byDataset.get(key)!.push(row);
  }

  return (
    <div>
      {/* Breadcrumb */}
      <nav className="text-sm text-gray-500 mb-4">
        <Link href="/" className="hover:text-gray-700">
          Tasks
        </Link>
        <span className="mx-2">›</span>
        <span className="text-gray-900 font-medium">{task.name}</span>
      </nav>

      <h1 className="text-2xl font-bold tracking-tight mb-2">{task.name}</h1>
      {task.description && (
        <p className="text-gray-600 mb-6 max-w-2xl">{task.description}</p>
      )}

      {/* Dataset filter pills */}
      {datasets.length > 1 && (
        <div className="flex flex-wrap gap-2 mb-6">
          <Link
            href={`/tasks/${id}`}
            className={`rounded-full px-3 py-1 text-xs font-medium border transition-colors ${
              !datasetFilter
                ? "bg-blue-600 text-white border-blue-600"
                : "border-gray-300 text-gray-600 hover:bg-gray-50"
            }`}
          >
            All datasets
          </Link>
          {datasets.map((d) => (
            <Link
              key={d.id}
              href={`/tasks/${id}?dataset=${d.id}`}
              className={`rounded-full px-3 py-1 text-xs font-medium border transition-colors ${
                datasetFilter === d.id
                  ? "bg-blue-600 text-white border-blue-600"
                  : "border-gray-300 text-gray-600 hover:bg-gray-50"
              }`}
            >
              {d.name}
            </Link>
          ))}
        </div>
      )}

      {rows.length === 0 && (
        <p className="text-gray-500">No leaderboard results yet.</p>
      )}

      {/* Leaderboard — one table per dataset */}
      {[...byDataset.entries()].map(([dsName, dsRows]) => (
        <div key={dsName} className="mb-10">
          <h2 className="text-lg font-semibold mb-3">{dsName}</h2>
          <div className="rounded-xl border border-gray-200 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-left">
                  <th className="px-4 py-3 font-medium text-gray-600 w-8 text-right">
                    #
                  </th>
                  <th className="px-4 py-3 font-medium text-gray-600">
                    Method / Model
                  </th>
                  <th className="px-4 py-3 font-medium text-gray-600">
                    Metric
                  </th>
                  <th className="px-4 py-3 font-medium text-gray-600 text-right">
                    Value
                  </th>
                  <th className="px-4 py-3 font-medium text-gray-600">
                    Paper
                  </th>
                  <th className="px-4 py-3 font-medium text-gray-600">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {dsRows.map((row, idx) => (
                  <tr
                    key={row.id}
                    className="hover:bg-gray-50 transition-colors"
                  >
                    <td className="px-4 py-2.5 text-right text-gray-400 tabular-nums">
                      {idx + 1}
                    </td>
                    <td className="px-4 py-2.5 font-medium">{row.model_name}</td>
                    <td className="px-4 py-2.5 text-gray-500 text-xs">
                      {row.best_metric_name ?? "—"}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums font-mono">
                      {row.best_metric_value != null
                        ? Number(row.best_metric_value).toLocaleString(
                            undefined,
                            { maximumFractionDigits: 2 }
                          )
                        : "—"}
                    </td>
                    <td className="px-4 py-2.5 max-w-xs">
                      {row.paper_id ? (
                        <Link
                          href={`/papers/${row.paper_id}`}
                          className="text-blue-600 hover:underline line-clamp-1"
                        >
                          {row.paper_title ?? row.paper_id}
                        </Link>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      <VerificationBadge
                        tier={row.verification as VerificationTier}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}
