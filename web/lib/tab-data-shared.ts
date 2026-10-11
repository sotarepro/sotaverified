import type { TabPaperRow, TabType } from "./queries";

/** Client-safe types + slicing for the static tab data (no DB imports here). */
export type TabRow = Omit<TabPaperRow, "user_hyped" | "arxiv_id">;
export interface TabData {
  papers: Record<string, TabRow>;
  tabs: Record<TabType, string[]>;
}

/** Rows for one view; an out-of-range page falls back to page 1. */
export function sliceTab(
  data: TabData,
  tab: TabType,
  page: number,
  pageSize: number,
): { rows: TabRow[]; total: number; page: number } {
  const ids = data.tabs[tab] ?? [];
  const pages = Math.max(1, Math.ceil(ids.length / pageSize));
  const p = page >= 1 && page <= pages ? page : 1;
  const rows = ids.slice((p - 1) * pageSize, p * pageSize).map((id) => data.papers[id]);
  return { rows, total: ids.length, page: p };
}
