import Link from "@/components/Link";
import { notFound, redirect } from "next/navigation";
import ReactMarkdown from "react-markdown";
import {
  getTask,
  getTaskStatus,
  getLeaderboard,
  getTaskDatasets,
  getTabPapers,
  getTabPapersCount,
} from "@/lib/queries";
import PaperTabTable from "@/components/PaperTabTable";
import TaskLeaderboards from "@/components/TaskLeaderboards";

/** Strip all HTML tags and decode entities from imported task descriptions */
function cleanDescription(raw: string): string {
  return raw
    .replace(/<[^>]*>/g, "")           // strip all HTML tags
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .trim();
}

import sql from "@/lib/db";

// Static shell (no searchParams / session). Tab, page and page size are client-side over
// /data/tabs/task/<id>; the dataset filter is client-side over the embedded leaderboard rows.
export const dynamic = "force-static";
export const revalidate = false;
// Ids outside the generated set are checked against the cached task index (404 / maintenance
// redirect) without touching the database.
export const dynamicParams = true;

export async function generateStaticParams() {
  const rows = await sql<{ id: string }[]>`SELECT id FROM tasks WHERE is_visible ORDER BY id`;
  return rows.map((r) => ({ id: r.id }));
}

export default async function TaskPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  // Zero-paper tasks (catalog was trimmed) go to the maintenance page; unknown ids 404.
  const status = await getTaskStatus(id);
  if (status === "missing") notFound();
  if (status === "hidden") redirect("/maintenance");

  const [task, datasets, tabTotal, papers, rows] = await Promise.all([
    getTask(id),
    getTaskDatasets(id),
    getTabPapersCount("recent", { taskId: id }),
    getTabPapers("recent", 10, { taskId: id }, 0),
    getLeaderboard(id),
  ]);
  if (!task) notFound();

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
        dataUrl={`/data/tabs/task/${id}`}
        baseHref={`/tasks/${id}`}
        title="Papers"
        initialRows={papers}
        initialTotal={tabTotal}
      />

      <TaskLeaderboards taskId={id} datasets={datasets} rows={rows} />
    </div>
  );
}
