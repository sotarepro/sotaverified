import Link from "next/link";
import { notFound } from "next/navigation";
import ReactMarkdown from "react-markdown";
import {
  getTask,
  getLeaderboard,
  getTaskDatasets,
  getTabPapers,
} from "@/lib/queries";
import VerificationBadge from "@/components/VerificationBadge";
import DatasetPills from "@/components/DatasetPills";
import PaperTabTable from "@/components/PaperTabTable";
import type { VerificationTier } from "@/lib/types";

/** Strip PWC attribution spans: <span class="description-source">...</span> */
function cleanDescription(raw: string): string {
  return raw.replace(/<span[^>]*class="description-source"[^>]*>[\s\S]*?<\/span>/g, "").trim();
}

export default async function TaskPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ dataset?: string; sort?: string; tab?: string }>;
}) {
  const { id } = await params;
  const { dataset: datasetFilter, sort: sortParam, tab: tabParam } = await searchParams;
  const sort = sortParam === "upvotes" ? "upvotes" : "metric";
  const tab = (tabParam === "hyped" || tabParam === "unverified") ? tabParam : "recent";

  const [task, datasets, rows, tabPapers] = await Promise.all([
    getTask(id),
    getTaskDatasets(id),
    getLeaderboard(id, datasetFilter, sort),
    getTabPapers(tab, 10, { taskId: id }),
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
        <div className="prose prose-sm prose-gray max-w-2xl mb-6 text-gray-600">
          <ReactMarkdown>{cleanDescription(task.description)}</ReactMarkdown>
        </div>
      )}

      {/* Paper tab table */}
      <PaperTabTable
        tab={tab}
        papers={tabPapers}
        baseHref={`/tasks/${id}`}
        title="Papers"
      />

      {/* Sort + Dataset filter */}
      <div className="flex items-center gap-3 mb-4">
        <span className="text-xs text-gray-500 font-medium">Sort:</span>
        <a
          href={`/tasks/${id}${datasetFilter ? `?dataset=${datasetFilter}&` : "?"}sort=metric`}
          className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${sort === "metric" ? "border-blue-400 bg-blue-50 text-blue-700" : "border-gray-300 text-gray-600 hover:bg-gray-50"}`}
        >
          Metric value
        </a>
        <a
          href={`/tasks/${id}${datasetFilter ? `?dataset=${datasetFilter}&` : "?"}sort=upvotes`}
          className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${sort === "upvotes" ? "border-blue-400 bg-blue-50 text-blue-700" : "border-gray-300 text-gray-600 hover:bg-gray-50"}`}
        >
          Hype
        </a>
      </div>

      {/* Dataset filter pills — collapses after 12 */}
      <DatasetPills
        taskId={id}
        datasets={datasets}
        activeDatasetId={datasetFilter}
      />

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
