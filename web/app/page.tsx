import Link from "next/link";
import { getTaskList, getTaskCount, searchTasks } from "@/lib/queries";
import Pagination from "@/components/Pagination";

const PAGE_SIZE = 50;

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string }>;
}) {
  const { page: pageStr, q } = await searchParams;
  const page = Math.max(1, parseInt(pageStr ?? "1", 10) || 1);

  const [tasks, total] = await Promise.all([
    q ? searchTasks(q) : getTaskList(page, PAGE_SIZE),
    q ? Promise.resolve(0) : getTaskCount(),
  ]);

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight mb-1">
          ML Task Browser
        </h1>
        <p className="text-gray-500 text-sm">
          {total.toLocaleString()} tasks · sourced from Papers with Code
        </p>
      </div>

      {/* Search */}
      <form method="GET" className="mb-6">
        <div className="flex gap-2 max-w-md">
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Search tasks…"
            className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="submit"
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Search
          </button>
          {q && (
            <Link
              href="/"
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50"
            >
              Clear
            </Link>
          )}
        </div>
      </form>

      {/* Task table */}
      <div className="rounded-xl border border-gray-200 overflow-hidden mb-6">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200 text-left">
              <th className="px-4 py-3 font-medium text-gray-600">Task</th>
              <th className="px-4 py-3 font-medium text-gray-600 text-right w-32">
                Papers
              </th>
              <th className="px-4 py-3 font-medium text-gray-600 text-right w-32">
                Results
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {tasks.length === 0 && (
              <tr>
                <td
                  colSpan={3}
                  className="px-4 py-8 text-center text-gray-400"
                >
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

      {!q && (
        <Pagination
          page={page}
          total={total}
          pageSize={PAGE_SIZE}
          baseHref="/"
        />
      )}
    </div>
  );
}
