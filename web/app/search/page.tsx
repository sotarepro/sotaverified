import Link from "next/link";
import { searchPapers, searchTasks } from "@/lib/queries";
import VerificationBadge from "@/components/VerificationBadge";
import type { VerificationTier } from "@/lib/types";

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

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;

  if (!q) {
    return (
      <div className="max-w-2xl">
        <h1 className="text-2xl font-bold tracking-tight mb-2">Search</h1>
        <p className="text-gray-500 text-sm">Enter a query in the search bar above to find papers and tasks.</p>
      </div>
    );
  }

  const [papers, tasks] = await Promise.all([
    searchPapers(q),
    searchTasks(q),
  ]);

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-bold tracking-tight mb-1">Search results</h1>
      <p className="text-sm text-gray-500 mb-6">
        for &ldquo;{q}&rdquo; — {papers.length} paper{papers.length !== 1 ? "s" : ""}, {tasks.length} task{tasks.length !== 1 ? "s" : ""}
      </p>

      {/* Paper results */}
      {papers.length > 0 && (
        <section className="mb-8">
          <h2 className="text-base font-semibold mb-3">Papers</h2>
          <div className="rounded-xl border border-gray-200 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-left">
                  <th className="px-4 py-2.5 font-medium text-gray-600">Title</th>
                  <th className="px-4 py-2.5 font-medium text-gray-600 w-28">Date</th>
                  <th className="px-4 py-2.5 font-medium text-gray-600">Status</th>
                  <th className="px-4 py-2.5 font-medium text-gray-600 text-right w-20">Upvotes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {papers.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-2.5">
                      <Link
                        href={`/papers/${p.id}`}
                        className="font-medium text-blue-600 hover:text-blue-800 hover:underline line-clamp-2"
                      >
                        {p.title}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5 text-gray-500 text-xs whitespace-nowrap">
                      {p.published ? p.published.slice(0, 10) : "—"}
                    </td>
                    <td className="px-4 py-2.5">
                      <VerificationBadge tier={p.verification as VerificationTier} />
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-gray-600">
                      {p.upvote_count}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {papers.length === 0 && (
        <section className="mb-8">
          <h2 className="text-base font-semibold mb-2">Papers</h2>
          <p className="text-sm text-gray-400">No papers found.</p>
        </section>
      )}

      {/* Task results */}
      {tasks.length > 0 && (
        <section className="mb-8">
          <h2 className="text-base font-semibold mb-3">Tasks</h2>
          <div className="rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-left">
                  <th className="px-4 py-3 font-medium text-gray-600">Task</th>
                  <th className="px-4 py-3 font-medium text-gray-600">Area</th>
                  <th className="px-4 py-3 font-medium text-gray-600 text-right w-28">Papers</th>
                  <th className="px-4 py-3 font-medium text-gray-600 text-right w-28">Results</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {tasks.map((t) => (
                  <tr key={t.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <Link
                        href={`/tasks/${t.id}`}
                        className="font-medium text-blue-600 hover:text-blue-800 hover:underline"
                      >
                        {t.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      {t.area && (
                        <span className={`text-xs rounded-full px-2 py-0.5 ${AREA_COLORS[t.area] ?? "bg-gray-100 text-gray-700"}`}>
                          {t.area}
                        </span>
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
        </section>
      )}

      {tasks.length === 0 && (
        <section className="mb-8">
          <h2 className="text-base font-semibold mb-2">Tasks</h2>
          <p className="text-sm text-gray-400">No tasks found.</p>
        </section>
      )}
    </div>
  );
}
