"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "@/components/Link";
import type { TabType } from "@/lib/queries";
import { sliceTab, type TabData, type TabRow } from "@/lib/tab-data-shared";
import VerificationBadge from "@/components/VerificationBadge";
import InlineHypeButton from "@/components/InlineHypeButton";
import { stripLatex } from "@/lib/strip-latex";
import type { VerificationTier } from "@/lib/types";

type Props = {
  /** Static JSON for this scope, e.g. "/data/tabs/all" (generated at build time). */
  dataUrl: string;
  /** Path (+ fixed query) the table lives on, e.g. "/", "/tasks/foo", "/tasks?area=X". */
  baseHref: string;
  title?: string;
  /** Server-rendered default view (tab=recent, page=1, pageSize=10), embedded in the HTML. */
  initialRows: TabRow[];
  initialTotal: number;
};

type View = { tab: TabType; page: number; pageSize: number };

const TABS: TabType[] = ["recent", "hyped", "active", "unverified", "verified"];
const PAGE_SIZES = [10, 25, 50];
const DEFAULT_VIEW: View = { tab: "recent", page: 1, pageSize: 10 };

const TAB_LABELS: Record<string, string> = {
  recent: "Recently Added",
  hyped: "Most Hyped",
  active: "Most Active",
  unverified: "Needs Verification",
  verified: "Most Verified",
};

/** Bad/unknown params fall back to defaults; an out-of-range page is handled by sliceTab (→ page 1). */
function parseView(search: string): View {
  const q = new URLSearchParams(search);
  const tabParam = q.get("tab");
  const tab = (TABS as string[]).includes(tabParam ?? "") ? (tabParam as TabType) : "recent";
  const size = parseInt(q.get("pageSize") ?? "10", 10);
  const pageSize = PAGE_SIZES.includes(size) ? size : 10;
  const page = Math.max(1, parseInt(q.get("page") ?? "1", 10) || 1);
  return { tab, page, pageSize };
}

function buildUrl(baseHref: string, params: Record<string, string | number>): string {
  const url = baseHref.includes("?") ? baseHref.split("?")[0] : baseHref;
  const base = baseHref.includes("?")
    ? Object.fromEntries(new URLSearchParams(baseHref.split("?")[1]))
    : {};
  const merged = { ...base, ...params };
  const qs = new URLSearchParams(Object.entries(merged).map(([k, v]) => [k, String(v)]));
  return `${url}?${qs}#paper-table`;
}

function formatDate(published: string | null): string {
  if (!published) return "—";
  const d = new Date(published);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

// One fetch per scope per page session; the file is a static asset, never a function call.
const dataCache = new Map<string, Promise<TabData>>();
function loadData(url: string): Promise<TabData> {
  if (!dataCache.has(url)) {
    const p = fetch(url).then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json() as Promise<TabData>;
    });
    p.catch(() => dataCache.delete(url));
    dataCache.set(url, p);
  }
  return dataCache.get(url)!;
}

export default function PaperTabTable({ dataUrl, baseHref, title, initialRows, initialTotal }: Props) {
  const [view, setView] = useState<View>(DEFAULT_VIEW);
  const [data, setData] = useState<TabData | null>(null);
  const [failed, setFailed] = useState(false);

  // The server HTML is the default view. Read the real view from the URL after mount
  // (the page itself is static and never sees query params).
  useEffect(() => {
    const sync = () => setView(parseView(window.location.search));
    sync();
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, []);

  const isDefault = view.tab === "recent" && view.page === 1 && view.pageSize === 10;
  useEffect(() => {
    if (isDefault || data) return;
    let cancelled = false;
    loadData(dataUrl)
      .then((d) => !cancelled && setData(d))
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [isDefault, data, dataUrl]);

  const go = useCallback(
    (e: React.MouseEvent, next: View) => {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
      e.preventDefault();
      const href = buildUrl(baseHref, { tab: next.tab, pageSize: next.pageSize, page: next.page });
      window.history.pushState(null, "", href);
      setView(next);
      document.getElementById("paper-table")?.scrollIntoView();
    },
    [baseHref],
  );

  let papers: TabRow[] = initialRows;
  let total = initialTotal;
  let page = 1;
  let loading = false;
  if (!(isDefault && !data)) {
    if (data) {
      const s = sliceTab(data, view.tab, view.page, view.pageSize);
      papers = s.rows;
      total = s.total;
      page = s.page;
    } else if (isDefault) {
      papers = initialRows;
    } else {
      papers = [];
      loading = !failed;
    }
  }
  const { tab, pageSize } = view;

  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const hrefFor = (v: View) => buildUrl(baseHref, { tab: v.tab, pageSize: v.pageSize, page: v.page });
  const prev: View | null = page > 1 ? { ...view, page: page - 1 } : null;
  const next: View | null = page < totalPages ? { ...view, page: page + 1 } : null;

  return (
    <section id="paper-table" className="mb-8 scroll-mt-16 min-h-[400px]">
      {title && (
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
          {title}
        </h2>
      )}

      {/* Tab bar */}
      <div className="flex gap-1 mb-3 border-b border-gray-200 overflow-x-auto" data-testid="tab-bar">
        {TABS.map((t) => {
          const v: View = { tab: t, pageSize, page: 1 };
          return (
            <a
              key={t}
              data-testid={`tab-${t}`}
              href={hrefFor(v)}
              onClick={(e) => go(e, v)}
              className={`px-3 py-1.5 text-sm font-medium transition-colors border-b-2 -mb-px whitespace-nowrap ${
                tab === t
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              {TAB_LABELS[t]}
            </a>
          );
        })}
      </div>

      {loading && <p className="text-sm text-gray-400 py-4" data-testid="tab-loading">Loading…</p>}
      {failed && (
        <p className="text-sm text-gray-400 py-4">
          Couldn&apos;t load this list. Please reload the page.
        </p>
      )}

      {/* Table */}
      {loading || failed ? null : papers.length === 0 ? (
        <p className="text-sm text-gray-400 py-4">No papers found.</p>
      ) : (
        <>
          {/* Showing X–Y of Z */}
          <p className="text-xs text-gray-500 mb-2">
            Showing {start}–{end} of {total} papers
          </p>

          <div className="rounded-xl border border-gray-200 overflow-x-auto">
            <table className="w-full text-sm table-fixed">
              <colgroup>
                <col className="w-[55%] md:w-[45%]" />
                <col className="hidden md:table-column md:w-[100px]" />
                <col className="hidden md:table-column md:w-[160px]" />
                <col className="w-[25%] md:w-[130px]" />
                <col className="w-[20%] md:w-[70px]" />
                {tab === "verified" && <col className="hidden md:table-column md:w-[60px]" />}
              </colgroup>
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-left">
                  <th className="px-3 md:px-4 py-2.5 font-medium text-gray-600">Title</th>
                  <th className="px-4 py-2.5 font-medium text-gray-600 hidden md:table-cell">Date</th>
                  <th className="px-4 py-2.5 font-medium text-gray-600 hidden md:table-cell">Tasks</th>
                  <th className="px-2 md:px-4 py-2.5 font-medium text-gray-600">Status</th>
                  <th className="px-2 md:px-4 py-2.5 font-medium text-gray-600 text-right">Hype</th>
                  {tab === "verified" && (
                    <th className="px-2 md:px-4 py-2.5 font-medium text-gray-600 text-right hidden md:table-cell">Score</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {papers.map((p) => {
                  const taskSlice = (p.tasks ?? []).slice(0, 2);
                  return (
                    <tr key={p.id} data-testid={`paper-row-${p.id}`} className="hover:bg-gray-50 transition-colors">
                      <td className="px-3 md:px-4 py-2.5 overflow-hidden">
                        <Link
                          href={`/papers/${p.id}`}
                          className="font-medium text-blue-600 hover:text-blue-800 hover:underline block line-clamp-1 md:line-clamp-2"
                        >
                          {stripLatex(p.title)}
                        </Link>
                      </td>
                      <td className="px-4 py-2.5 text-gray-500 text-xs whitespace-nowrap hidden md:table-cell">
                        {formatDate(p.published)}
                      </td>
                      <td className="px-4 py-2.5 hidden md:table-cell overflow-hidden">
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
                      <td className="px-2 md:px-4 py-2.5 overflow-hidden">
                        <VerificationBadge tier={p.verification as VerificationTier} score={p.verification_score} reproCount={p.repro_count} compact />
                      </td>
                      <td className="px-2 md:px-4 py-2.5 text-right tabular-nums">
                        <InlineHypeButton key={p.id} paperId={p.id} initialCount={p.upvote_count} />
                      </td>
                      {tab === "verified" && (
                        <td className="px-2 md:px-4 py-2.5 text-right tabular-nums text-gray-400 text-xs hidden md:table-cell">
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
            {PAGE_SIZES.map((size) => (
              <a
                key={size}
                href={hrefFor({ tab, pageSize: size, page: 1 })}
                onClick={(e) => go(e, { tab, pageSize: size, page: 1 })}
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
              {prev ? (
                <a href={hrefFor(prev)} onClick={(e) => go(e, prev)} className="text-blue-600 hover:underline">
                  ← Prev
                </a>
              ) : (
                <span className="text-gray-300">← Prev</span>
              )}
              <span className="text-gray-500">
                Page {page} of {totalPages}
              </span>
              {next ? (
                <a href={hrefFor(next)} onClick={(e) => go(e, next)} className="text-blue-600 hover:underline">
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
