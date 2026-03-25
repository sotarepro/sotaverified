import Link from "next/link";
import type { TabPaperRow, TabType } from "@/lib/queries";
import VerificationBadge from "@/components/VerificationBadge";
import InlineHypeButton from "@/components/InlineHypeButton";
import { stripLatex } from "@/lib/strip-latex";
import type { VerificationTier } from "@/lib/types";

type Props = {
  tab: TabType;
  papers: TabPaperRow[];
  baseHref: string;
  title?: string;
  // Pagination
  page: number;
  pageSize: number;
  total: number;
};

const TAB_LABELS: Record<string, string> = {
  recent: "Recently Added",
  hyped: "Most Hyped",
  active: "Most Active",
  unverified: "Needs Verification",
  verified: "Most Verified",
};

function buildUrl(baseHref: string, params: Record<string, string | number>): string {
  const url = baseHref.includes("?") ? baseHref.split("?")[0] : baseHref;
  const base = baseHref.includes("?")
    ? Object.fromEntries(new URLSearchParams(baseHref.split("?")[1]))
    : {};
  const merged = { ...base, ...params };
  const qs = new URLSearchParams(Object.entries(merged).map(([k, v]) => [k, String(v)]));
  return `${url}?${qs}#paper-table`;
}

function buildTabHref(baseHref: string, tab: string, pageSize: number): string {
  return buildUrl(baseHref, { tab, pageSize, page: 1 });
}

function formatDate(published: string | null): string {
  if (!published) return "—";
  const d = new Date(published);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

export default function PaperTabTable({ tab, papers, baseHref, title, page, pageSize, total }: Props) {
  const tabs: TabType[] = ["recent", "hyped", "active", "unverified", "verified"];

  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);
  const totalPages = Math.ceil(total / pageSize);

  const prevHref = page > 1 ? buildUrl(baseHref, { tab, pageSize, page: page - 1 }) : null;
  const nextHref = page < totalPages ? buildUrl(baseHref, { tab, pageSize, page: page + 1 }) : null;

  return (
    <section id="paper-table" className="mb-8 scroll-mt-16 min-h-[400px]">
      {title && (
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
          {title}
        </h2>
      )}

      {/* Tab bar */}
      <div className="flex gap-1 mb-3 border-b border-gray-200" data-testid="tab-bar">
        {tabs.map((t) => (
          <a
            key={t}
            data-testid={`tab-${t}`}
            href={buildTabHref(baseHref, t, pageSize)}
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
        <>
          {/* Showing X–Y of Z */}
          <p className="text-xs text-gray-500 mb-2">
            Showing {start}–{end} of {total} papers
          </p>

          <div className="rounded-xl border border-gray-200 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-left">
                  <th className="px-4 py-2.5 font-medium text-gray-600">Title</th>
                  <th className="px-4 py-2.5 font-medium text-gray-600 w-28">Date</th>
                  <th className="px-4 py-2.5 font-medium text-gray-600">Tasks</th>
                  <th className="px-4 py-2.5 font-medium text-gray-600">Status</th>
                  <th className="px-4 py-2.5 font-medium text-gray-600 text-right w-20">Hype</th>
                  {tab === "verified" && (
                    <th className="px-4 py-2.5 font-medium text-gray-600 text-right w-16">Score</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {papers.map((p) => {
                  const taskSlice = (p.tasks ?? []).slice(0, 2);
                  return (
                    <tr key={p.id} data-testid={`paper-row-${p.id}`} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-2.5">
                        <Link
                          href={`/papers/${p.id}`}
                          className="font-medium text-blue-600 hover:text-blue-800 hover:underline line-clamp-2"
                        >
                          {stripLatex(p.title)}
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
                        <VerificationBadge tier={p.verification as VerificationTier} score={p.verification_score} />
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums">
                        <InlineHypeButton paperId={p.id} initialCount={p.upvote_count} initialHyped={p.user_hyped} />
                      </td>
                      {tab === "verified" && (
                        <td className="px-4 py-2.5 text-right tabular-nums text-gray-400 text-xs">
                          {p.verification_score}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Page size toggle */}
          <div className="flex items-center gap-2 mt-3 text-xs text-gray-500">
            <span>Show:</span>
            {([10, 25, 50] as const).map((size) => (
              <a
                key={size}
                href={buildUrl(baseHref, { tab, pageSize: size, page: 1 })}
                className={`px-2 py-0.5 rounded border transition-colors ${
                  pageSize === size
                    ? "border-blue-400 bg-blue-50 text-blue-700 font-medium"
                    : "border-gray-300 text-gray-600 hover:bg-gray-50"
                }`}
              >
                {size}
              </a>
            ))}
          </div>

          {/* Prev / Next */}
          {totalPages > 1 && (
            <div className="flex items-center gap-3 mt-3 text-xs">
              {prevHref ? (
                <a href={prevHref} className="text-blue-600 hover:underline">
                  ← Prev
                </a>
              ) : (
                <span className="text-gray-300">← Prev</span>
              )}
              <span className="text-gray-500">
                Page {page} of {totalPages}
              </span>
              {nextHref ? (
                <a href={nextHref} className="text-blue-600 hover:underline">
                  Next →
                </a>
              ) : (
                <span className="text-gray-300">Next →</span>
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
}
