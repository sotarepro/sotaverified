"use client";

import { useEffect, useState } from "react";
import Link from "@/components/Link";
import Pagination from "@/components/Pagination";
import type { TaskListRow } from "@/lib/tab-data";

const PAGE_SIZE = 50;

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

interface Props {
  /** Static JSON with the full list for this scope (e.g. /data/tasks/all). */
  dataUrl: string;
  baseHref: string;
  showArea: boolean;
  /** Server-rendered page 1. */
  initialRows: TaskListRow[];
  total: number;
}

const cache = new Map<string, Promise<TaskListRow[]>>();
function load(url: string): Promise<TaskListRow[]> {
  if (!cache.has(url)) {
    const p = fetch(url).then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json() as Promise<TaskListRow[]>;
    });
    p.catch(() => cache.delete(url));
    cache.set(url, p);
  }
  return cache.get(url)!;
}

function pageFromSearch(search: string): number {
  return Math.max(1, parseInt(new URLSearchParams(search).get("page") ?? "1", 10) || 1);
}

function hrefFor(baseHref: string, page: number): string {
  const sep = baseHref.includes("?") ? "&" : "?";
  return `${baseHref}${sep}page=${page}`;
}

export default function TaskTable({ dataUrl, baseHref, showArea, initialRows, total }: Props) {
  const [requested, setRequested] = useState(1);
  const [all, setAll] = useState<TaskListRow[] | null>(null);

  useEffect(() => {
    const sync = () => setRequested(pageFromSearch(window.location.search));
    sync();
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, []);

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  // Out-of-range page → page 1, decided client-side.
  const page = requested >= 1 && requested <= pages ? requested : 1;

  useEffect(() => {
    if (page === 1 || all) return;
    let cancelled = false;
    load(dataUrl).then((d) => !cancelled && setAll(d)).catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [page, all, dataUrl]);

  const tasks = page === 1 ? initialRows : all ? all.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE) : [];

  return (
    <>
      <div className="rounded-xl border border-gray-200 overflow-hidden mb-6">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200 text-left">
              <th className="px-4 py-3 font-medium text-gray-600">Task</th>
              {showArea && <th className="px-4 py-3 font-medium text-gray-600">Area</th>}
              <th className="px-4 py-3 font-medium text-gray-600 text-right w-28">Papers</th>
              <th className="px-4 py-3 font-medium text-gray-600 text-right w-28">Results</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {tasks.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-gray-400">
                  {page === 1 ? "No tasks found" : "Loading…"}
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
                  {t.description && <p className="text-gray-500 text-xs mt-0.5">{t.description}</p>}
                </td>
                {showArea && (
                  <td className="px-4 py-3">
                    {t.area && (
                      <Link
                        href={`/tasks?area=${encodeURIComponent(t.area)}`}
                        className={`text-xs rounded-full px-2 py-0.5 whitespace-nowrap hover:opacity-80 inline-block ${AREA_COLORS[t.area] ?? "bg-gray-100 text-gray-700"}`}
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

      <Pagination
        page={page}
        total={total}
        pageSize={PAGE_SIZE}
        hrefFor={(p) => hrefFor(baseHref, p)}
        onPage={(p) => {
          window.history.pushState(null, "", hrefFor(baseHref, p));
          setRequested(p);
          window.scrollTo({ top: 0 });
        }}
      />
    </>
  );
}
