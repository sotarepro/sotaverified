import Link from "next/link";
import { searchPapers, searchPapersCount, searchTasks } from "@/lib/queries";
import VerificationBadge from "@/components/VerificationBadge";
import { stripLatex } from "@/lib/strip-latex";
import type { VerificationTier } from "@/lib/types";

const AREA_COLORS: Record<string, string> = {
  "Computer Vision":                  "bg-blue-100 text-blue-700",
  "Language & Reasoning":             "bg-green-100 text-green-700",
  "Reinforcement Learning & Robotics":"bg-orange-100 text-orange-700",
  "Audio & Speech":                   "bg-purple-100 text-purple-700",
  "Graphs & Structured Data":         "bg-indigo-100 text-indigo-700",
  "Medical & Scientific":             "bg-rose-100 text-rose-700",
  "Time Series & Forecasting":        "bg-yellow-100 text-yellow-800",
  "Recommendation & Retrieval":       "bg-teal-100 text-teal-700",
  "Foundations & Efficiency":         "bg-slate-100 text-slate-700",
  "Generative Models":                "bg-pink-100 text-pink-700",
  "Multimodal & Vision-Language":     "bg-violet-100 text-violet-700",
};

const PAPERS_PER_PAGE = 20;
const MAX_TASKS = 5;

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const { q, page: pageStr } = await searchParams;

  if (!q) {
    return (
      <div className="max-w-2xl">
        <h1 className="text-2xl font-bold tracking-tight mb-2">Search</h1>
        <p className="text-gray-500 text-sm">Enter a query in the search bar above to find papers and tasks.</p>
      </div>
    );
  }

  const page = Math.max(1, parseInt(pageStr ?? "1", 10) || 1);
  const offset = (page - 1) * PAPERS_PER_PAGE;

  const [papers, tasks, totalPapers] = await Promise.all([
    searchPapers(q, PAPERS_PER_PAGE, offset),
    searchTasks(q),
    searchPapersCount(q),
  ]);

  const totalPages = Math.max(1, Math.ceil(totalPapers / PAPERS_PER_PAGE));
  const displayedTasks = tasks.slice(0, MAX_TASKS);

  function pageHref(p: number) {
    return `/search?q=${encodeURIComponent(q!)}&page=${p}`;
  }

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-bold tracking-tight mb-1">Search results</h1>
      <p className="text-sm text-gray-500 mb-6">
        for &ldquo;{q}&rdquo; — {totalPapers.toLocaleString()} paper{totalPapers !== 1 ? "s" : ""}, {tasks.length} task{tasks.length !== 1 ? "s" : ""}
      </p>

      {/* Tasks first */}
      {displayedTasks.length > 0 ? (
        <section className="mb-8">
          <h2 className="text-base font-semibold mb-3">Tasks</h2>
          <div className="rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-left">
                  <th className="px-3 md:px-4 py-3 font-medium text-gray-600">Task</th>
                  <th className="px-4 py-3 font-medium text-gray-600 hidden md:table-cell">Area</th>
                  <th className="px-4 py-3 font-medium text-gray-600 text-right w-20 md:w-28">Papers</th>
                  <th className="px-4 py-3 font-medium text-gray-600 text-right w-20 md:w-28 hidden sm:table-cell">Results</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {displayedTasks.map((t) => (
                  <tr key={t.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-3 md:px-4 py-3">
                      <Link
                        href={`/tasks/${t.id}`}
                        className="font-medium text-blue-600 hover:text-blue-800 hover:underline"
                      >
                        {t.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      {t.area && (
                        <span className={`text-xs rounded-full px-2 py-0.5 ${AREA_COLORS[t.area] ?? "bg-gray-100 text-gray-700"}`}>
                          {t.area}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-600 tabular-nums">
                      {t.paper_count.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-600 tabular-nums hidden sm:table-cell">
                      {t.result_count.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {tasks.length > MAX_TASKS && (
            <p className="text-xs text-gray-400 mt-2">
              Showing {MAX_TASKS} of {tasks.length} matching tasks.{" "}
              <Link href={`/tasks?q=${encodeURIComponent(q)}`} className="text-blue-600 hover:underline">
                Browse all tasks →
              </Link>
            </p>
          )}
        </section>
      ) : (
        <section className="mb-8">
          <h2 className="text-base font-semibold mb-2">Tasks</h2>
          <p className="text-sm text-gray-400">No tasks found.</p>
        </section>
      )}

      {/* Papers */}
      {papers.length > 0 ? (
        <section className="mb-8">
          <h2 className="text-base font-semibold mb-3">Papers</h2>
          <div className="rounded-xl border border-gray-200 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-left">
                  <th className="px-3 md:px-4 py-2.5 font-medium text-gray-600">Title</th>
                  <th className="px-4 py-2.5 font-medium text-gray-600 w-28 hidden md:table-cell">Date</th>
                  <th className="px-2 md:px-4 py-2.5 font-medium text-gray-600">Status</th>
                  <th className="px-2 md:px-4 py-2.5 font-medium text-gray-600 text-right w-14 md:w-20">Hype</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {papers.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-3 md:px-4 py-2.5 max-w-0 md:max-w-none">
                      <Link
                        href={`/papers/${p.id}`}
                        className="font-medium text-blue-600 hover:text-blue-800 hover:underline block truncate md:whitespace-normal md:overflow-visible md:text-clip"
                      >
                        {stripLatex(p.title)}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5 text-gray-500 text-xs whitespace-nowrap hidden md:table-cell">
                      {p.published ? p.published.slice(0, 10) : "—"}
                    </td>
                    <td className="px-2 md:px-4 py-2.5">
                      <VerificationBadge tier={p.verification as VerificationTier} score={p.verification_score} compact />
                    </td>
                    <td className="px-2 md:px-4 py-2.5 text-right tabular-nums text-gray-600">
                      {p.upvote_count}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-xs text-gray-500">
                Page {page} of {totalPages} ({totalPapers.toLocaleString()} papers)
              </p>
              <div className="flex gap-2">
                {page > 1 && (
                  <Link
                    href={pageHref(page - 1)}
                    className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm hover:bg-gray-50 transition-colors"
                  >
                    ← Previous
                  </Link>
                )}
                {page < totalPages && (
                  <Link
                    href={pageHref(page + 1)}
                    className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm hover:bg-gray-50 transition-colors"
                  >
                    Next →
                  </Link>
                )}
              </div>
            </div>
          )}
        </section>
      ) : (
        <section className="mb-8">
          <h2 className="text-base font-semibold mb-2">Papers</h2>
          <p className="text-sm text-gray-400">No papers found.</p>
        </section>
      )}
    </div>
  );
}
