import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getAreaSummaries, getSiteStats, getTabPapers, getTabPapersCount, getUserHypedSet } from "@/lib/queries";

export const dynamic = "force-dynamic";
import type { AreaSummary } from "@/lib/types";
import PaperTabTable from "@/components/PaperTabTable";

// Accent colors per area — bg, border, text, badge
const AREA_COLORS: Record<string, { bg: string; border: string; badge: string; dot: string }> = {
  "Computer Vision":                 { bg: "bg-blue-50",   border: "border-blue-200",  badge: "bg-blue-100 text-blue-700",   dot: "bg-blue-500"   },
  "Language & Reasoning":            { bg: "bg-green-50",  border: "border-green-200", badge: "bg-green-100 text-green-700", dot: "bg-green-500"  },
  "Reinforcement Learning & Robotics":{ bg: "bg-orange-50",border: "border-orange-200",badge: "bg-orange-100 text-orange-700",dot: "bg-orange-500"},
  "Audio & Speech":                  { bg: "bg-purple-50", border: "border-purple-200",badge: "bg-purple-100 text-purple-700",dot: "bg-purple-500" },
  "Graphs & Structured Data":        { bg: "bg-indigo-50", border: "border-indigo-200",badge: "bg-indigo-100 text-indigo-700",dot: "bg-indigo-500" },
  "Medical & Scientific":            { bg: "bg-rose-50",   border: "border-rose-200",  badge: "bg-rose-100 text-rose-700",  dot: "bg-rose-500"   },
  "Time Series & Forecasting":       { bg: "bg-yellow-50", border: "border-yellow-200",badge: "bg-yellow-100 text-yellow-800",dot: "bg-yellow-500"},
  "Recommendation & Retrieval":      { bg: "bg-teal-50",   border: "border-teal-200",  badge: "bg-teal-100 text-teal-700",  dot: "bg-teal-500"   },
  "Foundations & Efficiency":        { bg: "bg-slate-50",  border: "border-slate-200", badge: "bg-slate-100 text-slate-700", dot: "bg-slate-500"  },
  "Generative Models":               { bg: "bg-pink-50",   border: "border-pink-200",  badge: "bg-pink-100 text-pink-700",  dot: "bg-pink-500"   },
  "Multimodal & Vision-Language":    { bg: "bg-violet-50", border: "border-violet-200",badge: "bg-violet-100 text-violet-700",dot: "bg-violet-500" },
  "Code & Math":                     { bg: "bg-amber-50",  border: "border-amber-200", badge: "bg-amber-100 text-amber-700", dot: "bg-amber-500"  },
  "General ML":                      { bg: "bg-gray-50",   border: "border-gray-200",  badge: "bg-gray-100 text-gray-700",  dot: "bg-gray-400"   },
};

const DEFAULT_COLOR = AREA_COLORS["General ML"];

function AreaCard({ area }: { area: AreaSummary }) {
  const colors = AREA_COLORS[area.area] ?? DEFAULT_COLOR;
  const href = `/tasks?area=${encodeURIComponent(area.area)}`;

  return (
    <Link
      href={href}
      className={`group block rounded-xl border ${colors.border} ${colors.bg} p-5 hover:shadow-md transition-shadow`}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className={`w-2.5 h-2.5 rounded-full ${colors.dot} shrink-0 mt-0.5`} />
          <h2 className="font-semibold text-gray-900 text-sm leading-tight">{area.area}</h2>
        </div>
      </div>

      <div className="flex gap-3 mb-4 text-xs">
        <span className={`rounded-full px-2 py-0.5 font-medium ${colors.badge}`}>
          {area.task_count.toLocaleString()} tasks
        </span>
        <span className="text-gray-500">
          {area.paper_count.toLocaleString()} papers
        </span>
      </div>

      <ul className="space-y-1">
        {area.top_tasks.map((name) => (
          <li key={name} className="text-xs text-gray-600 truncate">
            · {name}
          </li>
        ))}
      </ul>

      <div className="mt-4 text-xs font-medium text-gray-400 group-hover:text-gray-600 transition-colors">
        Browse all →
      </div>
    </Link>
  );
}

type Tab = "recent" | "hyped" | "unverified" | "verified";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; page?: string; pageSize?: string }>;
}) {
  const { tab: tabParam, page: pageStr, pageSize: pageSizeStr } = await searchParams;
  const tab: Tab = (["recent", "hyped", "unverified", "verified"].includes(tabParam ?? ""))
    ? (tabParam as Tab)
    : "recent";
  const page = Math.max(1, parseInt(pageStr ?? "1", 10) || 1);
  const parsedPageSize = parseInt(pageSizeStr ?? "10", 10);
  const pageSize = [10, 25, 50].includes(parsedPageSize) ? parsedPageSize : 10;
  const offset = (page - 1) * pageSize;

  const session = await getServerSession(authOptions);
  const userId = session?.user?.github_id ?? null;

  const [areas, stats, tabPapers, tabTotal] = await Promise.all([
    getAreaSummaries(),
    getSiteStats(),
    getTabPapers(tab, pageSize, undefined, offset),
    getTabPapersCount(tab),
  ]);

  const hypedSet = await getUserHypedSet(userId ?? "", tabPapers.map((p) => p.id));
  const papers = tabPapers.map((p) => ({ ...p, user_hyped: hypedSet.has(p.id) }));

  const totalTasks = areas.reduce((s, a) => s + a.task_count, 0);

  return (
    <div>
      {/* Hero */}
      <div className="py-6 mb-6 border-b border-gray-100">
        <h1 className="text-3xl font-bold tracking-tight text-gray-900 mb-2">
          The Open Verification Layer for ML Research
        </h1>
        <p className="text-gray-500 text-sm mb-4 max-w-xl">
          Community benchmark tracking and reproducibility verification.
          Built for researchers and autonomous research agents.
        </p>

        {/* Stat bar */}
        <div className="flex flex-wrap gap-4 mb-5 text-xs text-gray-500">
          <span>
            <span className="font-semibold text-gray-800">{stats.paper_count.toLocaleString()}</span>{" "}
            papers
          </span>
          <span>
            <span className="font-semibold text-gray-800">{stats.code_links_count.toLocaleString()}</span>{" "}
            code links
          </span>
          <span>
            <span className="font-semibold text-gray-800">{totalTasks.toLocaleString()}</span>{" "}
            tasks
          </span>
        </div>

      </div>

      {/* Paper tab table */}
      <PaperTabTable
        tab={tab}
        papers={papers}
        baseHref="/"
        title="Papers"
        page={page}
        pageSize={pageSize}
        total={tabTotal}
      />

      {/* Area cards grid */}
      <div id="browse" className="scroll-mt-16">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">
            Browse by Research Area
          </h2>
          <Link href="/tasks" className="text-xs text-blue-600 hover:underline">
            View All Tasks →
          </Link>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {areas.map((area) => (
            <AreaCard key={area.area} area={area} />
          ))}
        </div>
      </div>
    </div>
  );
}
