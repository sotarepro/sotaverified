import Link from "next/link";
import type { TabPaperRow } from "@/lib/queries";
import VerificationBadge from "@/components/VerificationBadge";
import type { VerificationTier } from "@/lib/types";

type Props = {
  tab: "recent" | "hyped" | "unverified";
  papers: TabPaperRow[];
  baseHref: string;
  title?: string;
};

const TAB_LABELS: Record<string, string> = {
  recent: "Recently Added",
  hyped: "Most Hyped",
  unverified: "Needs Verification",
};

function buildTabHref(baseHref: string, tab: string): string {
  const sep = baseHref.includes("?") ? "&" : "?";
  return `${baseHref}${sep}tab=${tab}`;
}

function formatDate(published: string | null): string {
  if (!published) return "—";
  const d = new Date(published);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

export default function PaperTabTable({ tab, papers, baseHref, title }: Props) {
  const tabs: Array<"recent" | "hyped" | "unverified"> = ["recent", "hyped", "unverified"];

  return (
    <section className="mb-8">
      {title && (
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
          {title}
        </h2>
      )}

      {/* Tab bar */}
      <div className="flex gap-1 mb-3 border-b border-gray-200">
        {tabs.map((t) => (
          <a
            key={t}
            href={buildTabHref(baseHref, t)}
            className={`px-3 py-1.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
              tab === t
                ? "border-blue-500 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {TAB_LABELS[t]}
          </a>
        ))}
      </div>

      {/* Table */}
      {papers.length === 0 ? (
        <p className="text-sm text-gray-400 py-4">No papers found.</p>
      ) : (
        <div className="rounded-xl border border-gray-200 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-left">
                <th className="px-4 py-2.5 font-medium text-gray-600">Title</th>
                <th className="px-4 py-2.5 font-medium text-gray-600 w-28">Date</th>
                <th className="px-4 py-2.5 font-medium text-gray-600">Tasks</th>
                <th className="px-4 py-2.5 font-medium text-gray-600">Status</th>
                <th className="px-4 py-2.5 font-medium text-gray-600 text-right w-20">Upvotes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {papers.map((p) => {
                const taskSlice = (p.tasks ?? []).slice(0, 2);
                return (
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
                      {formatDate(p.published)}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex flex-wrap gap-1">
                        {taskSlice.map((task) => (
                          <span
                            key={task}
                            className="rounded-full bg-gray-100 text-gray-600 px-2 py-0.5 text-xs truncate max-w-[120px]"
                            title={task}
                          >
                            {task}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      <VerificationBadge tier={p.verification as VerificationTier} />
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-gray-600">
                      {p.upvote_count}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* View all link */}
      <div className="mt-2 text-right">
        <Link href="/tasks" className="text-xs text-gray-500 hover:text-blue-600 hover:underline">
          Browse all tasks →
        </Link>
      </div>
    </section>
  );
}
