import Link from "next/link";
import { notFound } from "next/navigation";
import ReactMarkdown from "react-markdown";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  getTask,
  getLeaderboard,
  getTaskDatasets,
  getTabPapers,
  getTabPapersCount,
  getUserHypedSet,
} from "@/lib/queries";
import DatasetPills from "@/components/DatasetPills";
import PaperTabTable from "@/components/PaperTabTable";
import LeaderboardSection from "@/components/LeaderboardSection";

/** Strip attribution spans from imported task descriptions: <span class="description-source">...</span> */
function cleanDescription(raw: string): string {
  return raw.replace(/<span[^>]*class="description-source"[^>]*>[\s\S]*?<\/span>/g, "").trim();
}

function isLowerBetterMetric(metricName: string | null): boolean {
  if (!metricName) return false;
  const lower = metricName.toLowerCase();
  return ["error", "loss", "perplexity", "fid", "fpr", "mae", "mse", "rmse", "wer", "cer"].some(
    (k) => lower.includes(k)
  );
}

type Tab = "recent" | "hyped" | "unverified" | "verified";

export default async function TaskPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ dataset?: string; sort?: string; tab?: string; page?: string; pageSize?: string }>;
}) {
  const { id } = await params;
  const {
    dataset: datasetFilter,
    sort: sortParam,
    tab: tabParam,
    page: pageStr,
    pageSize: pageSizeStr,
  } = await searchParams;

  const sort = sortParam === "verification" ? "verification" : sortParam === "date" ? "date" : "metric";
  const tab: Tab = (["recent", "hyped", "unverified", "verified"].includes(tabParam ?? ""))
    ? (tabParam as Tab)
    : "recent";
  const page = Math.max(1, parseInt(pageStr ?? "1", 10) || 1);
  const pageSize = [10, 25, 50].includes(parseInt(pageSizeStr ?? "10", 10))
    ? parseInt(pageSizeStr!, 10)
    : 10;
  const offset = (page - 1) * pageSize;

  const session = await getServerSession(authOptions);
  const userId = session?.user?.github_id ?? null;

  const [task, datasets, rows, tabPapers, tabTotal] = await Promise.all([
    getTask(id),
    getTaskDatasets(id),
    getLeaderboard(id, datasetFilter, sort),
    getTabPapers(tab, pageSize, { taskId: id }, offset),
    getTabPapersCount(tab, { taskId: id }),
  ]);

  if (!task) notFound();

  const hypedSet = await getUserHypedSet(userId ?? "", tabPapers.map((p) => p.id));
  const papers = tabPapers.map((p) => ({ ...p, user_hyped: hypedSet.has(p.id) }));

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
        papers={papers}
        baseHref={`/tasks/${id}`}
        title="Papers"
        page={page}
        pageSize={pageSize}
        total={tabTotal}
      />

      {/* Dataset filter pills — collapses after 12 */}
      <DatasetPills
        taskId={id}
        datasets={datasets}
        activeDatasetId={datasetFilter}
      />

      {rows.length === 0 && (
        <p className="text-gray-500">No leaderboard results yet.</p>
      )}

      {/* Dataset leaderboards */}
      {rows.length > 0 && (
        <div>
          <h2 className="text-base font-semibold text-gray-900 mb-4">Benchmark Results</h2>
          {[...byDataset.entries()].map(([dsName, dsRows], idx) => {
            // Detect metric direction from first row with a metric name
            const firstMetricName = dsRows.find((r) => r.best_metric_name)?.best_metric_name ?? null;
            return (
              <LeaderboardSection
                key={dsName}
                datasetName={dsName}
                rows={dsRows}
                submissionCount={dsRows.length}
                defaultExpanded={idx === 0}
                isLowerBetter={isLowerBetterMetric(firstMetricName)}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
