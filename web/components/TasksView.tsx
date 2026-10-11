import Link from "@/components/Link";
import { getTabPapers, getTabPapersCount } from "@/lib/queries";
import { areaSlug } from "@/lib/areas";
import { buildTaskList } from "@/lib/tab-data";
import PaperTabTable from "@/components/PaperTabTable";
import TaskTable from "@/components/TaskTable";

/** Static task browser for "all tasks" or one research area. Server-rendered default view only. */
export default async function TasksView({ area }: { area?: string }) {
  const list = await buildTaskList(area);
  const total = list.length;
  const [areaPapers, areaTotal] = area
    ? await Promise.all([getTabPapers("recent", 10, { area }, 0), getTabPapersCount("recent", { area })])
    : [null, 0];

  const baseHref = area ? `/tasks?area=${encodeURIComponent(area)}` : "/tasks";
  const dataUrl = area ? `/data/tasks/area/${areaSlug(area)}` : "/data/tasks/all";

  return (
    <div>
      <div className="mb-6">
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
          <Link href="/" className="hover:text-gray-700">Home</Link>
          <span>/</span>
          <span>{area ?? "All Tasks"}</span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">{area ?? "All Tasks"}</h1>
        <p className="text-sm text-gray-500 mt-1">
          {total.toLocaleString()} tasks
          {area && (
            <>
              {" "}·{" "}
              <Link href="/tasks" className="text-blue-600 hover:underline">
                View all areas
              </Link>
            </>
          )}
        </p>
      </div>

      {/* Paper tab table — shown only when an area is selected */}
      {area && areaPapers && (
        <PaperTabTable
          dataUrl={`/data/tabs/area/${areaSlug(area)}`}
          baseHref={baseHref}
          title="Papers in this area"
          initialRows={areaPapers}
          initialTotal={areaTotal}
        />
      )}

      <TaskTable dataUrl={dataUrl} baseHref={baseHref} showArea={!area} initialRows={list.slice(0, 50)} total={total} />
    </div>
  );
}
