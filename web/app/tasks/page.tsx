import Link from "next/link";
import { getTaskList, getTaskCount } from "@/lib/queries";
import Pagination from "@/components/Pagination";

const PAGE_SIZE = 50;

const AREA_COLORS: Record<string, string> = {
  "Computer Vision":        "bg-blue-100 text-blue-700",
  "NLP":                    "bg-green-100 text-green-700",
  "Reinforcement Learning": "bg-orange-100 text-orange-700",
  "Audio & Speech":         "bg-purple-100 text-purple-700",
  "Graphs & Networks":      "bg-indigo-100 text-indigo-700",
  "Medical":                "bg-rose-100 text-rose-700",
  "Time Series":            "bg-yellow-100 text-yellow-800",
  "Recommendation":         "bg-teal-100 text-teal-700",
  "General ML":             "bg-gray-100 text-gray-700",
};

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; area?: string }>;
}) {
  const { page: pageStr, area } = await searchParams;
  const page = Math.max(1, parseInt(pageStr ?? "1", 10) || 1);

  const [tasks, total] = await Promise.all([
    getTaskList(page, PAGE_SIZE, area),
    getTaskCount(area),
  ]);

  const baseHref = area ? `/tasks?area=${encodeURIComponent(area)}` : "/tasks";

  return (
    <div>
      <div className="mb-6">
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
          <Link href="/" className="hover:text-gray-700">Home</Link>
          <span>/</span>
          <span>{area ?? "All Tasks"}</span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">
          {area ?? "All Tasks"}
        </h1>
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

      <div className="rounded-xl border border-gray-200 overflow-hidden mb-6">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200 text-left">
              <th className="px-4 py-3 font-medium text-gray-600">Task</th>
              {!area && (
                <th className="px-4 py-3 font-medium text-gray-600">Area</th>
              )}
              <th className="px-4 py-3 font-medium text-gray-600 text-right w-28">Papers</th>
              <th className="px-4 py-3 font-medium text-gray-600 text-right w-28">Results</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {tasks.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-gray-400">
                  No tasks found
                </td>
              </tr>
            )}
            {tasks.map((t) => (
              <tr key={t.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3">
                  <Link
                    href={`/tasks/${t.id}`}
                    className="font-medium text-blue-600 hover:text-blue-800 hover:underline"
                  >
                    {t.name}
                  </Link>
                  {t.description && (
                    <p className="text-gray-500 text-xs mt-0.5 line-clamp-1">
                      {t.description}
                    </p>
                  )}
                </td>
                {!area && (
                  <td className="px-4 py-3">
                    {t.area && (
                      <Link
                        href={`/tasks?area=${encodeURIComponent(t.area)}`}
                        className={`text-xs rounded-full px-2 py-0.5 hover:opacity-80 ${AREA_COLORS[t.area] ?? "bg-gray-100 text-gray-700"}`}
                      >
                        {t.area}
                      </Link>
                    )}
                  </td>
                )}
                <td className="px-4 py-3 text-right text-gray-600 tabular-nums">
                  {t.paper_count.toLocaleString()}
                </td>
                <td className="px-4 py-3 text-right text-gray-600 tabular-nums">
                  {t.result_count.toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Pagination page={page} total={total} pageSize={PAGE_SIZE} baseHref={baseHref} />
    </div>
  );
}
