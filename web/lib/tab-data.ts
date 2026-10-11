import { getTabPapers, getTaskList, type TabType } from "./queries";
import type { TabData, TabRow } from "./tab-data-shared";

export { sliceTab } from "./tab-data-shared";
export type { TabData, TabRow };

/**
 * Build-time static data for the client-side paper tables and task lists.
 * Served by force-static route handlers under /data/ — anonymous visitors switch
 * tabs / pages / page sizes by reading these JSON files, never a dynamic route.
 */
export const TABS: TabType[] = ["recent", "hyped", "active", "unverified", "verified"];

export type TabScope = { taskId?: string; area?: string };

const ALL = 100000;

export async function buildTabData(scope?: TabScope): Promise<TabData> {
  const papers: Record<string, TabRow> = {};
  const tabs = {} as Record<TabType, string[]>;
  const lists = await Promise.all(TABS.map((t) => getTabPapers(t, ALL, scope, 0)));
  TABS.forEach((t, i) => {
    tabs[t] = lists[i].map((p) => p.id);
    for (const p of lists[i]) {
      if (!papers[p.id]) {
        // Only what the table renders (keeps the JSON small).
        papers[p.id] = {
          id: p.id,
          title: p.title,
          published: p.published,
          tasks: (p.tasks ?? []).slice(0, 2),
          verification: p.verification,
          verification_score: p.verification_score,
          repro_count: p.repro_count,
          upvote_count: p.upvote_count,
        };
      }
    }
  });
  return { papers, tabs };
}

function plainText(text: string | null | undefined, maxLen = 60): string {
  if (!text) return "";
  const stripped = text
    .replace(/<[^>]+>/g, " ")
    .replace(/\*\*?|__?|~~|`{1,3}/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return stripped.length > maxLen ? stripped.slice(0, maxLen) + "…" : stripped;
}

export interface TaskListRow {
  id: string;
  name: string;
  description: string;
  area: string | null;
  paper_count: number;
  result_count: number;
}

export async function buildTaskList(area?: string): Promise<TaskListRow[]> {
  const rows = await getTaskList(1, ALL, area);
  return rows.map((t) => ({
    id: t.id,
    name: t.name,
    description: plainText(t.description),
    area: t.area,
    paper_count: t.paper_count,
    result_count: t.result_count,
  }));
}
