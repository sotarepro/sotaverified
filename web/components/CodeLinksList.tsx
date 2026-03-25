"use client";

import { useState } from "react";

interface CodeLink {
  repo_url: string;
  framework: string | null;
  is_official: boolean;
  mentioned_in_paper: boolean;
  stars: number | null;
  forks: number | null;
}

const DEFAULT_SHOW = 10;

export default function CodeLinksList({ links }: { links: CodeLink[] }) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? links : links.slice(0, DEFAULT_SHOW);
  const hasMore = links.length > DEFAULT_SHOW;

  return (
    <>
      <ul className="space-y-2">
        {visible.map((cl) => (
          <li key={cl.repo_url} className="flex items-start md:items-center gap-2 md:gap-3 text-sm flex-wrap md:flex-nowrap">
            <a
              href={cl.repo_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline font-mono truncate max-w-[calc(100vw-6rem)] md:max-w-sm min-w-0"
            >
              {cl.repo_url.replace(/^https?:\/\/(www\.)?/, "")}
            </a>
            <div className="flex gap-1 shrink-0 flex-wrap">
              {cl.is_official && (
                <span className="rounded px-1.5 py-0.5 text-xs bg-blue-50 text-blue-700 border border-blue-200">
                  Official
                </span>
              )}
              {cl.mentioned_in_paper && (
                <span className="rounded px-1.5 py-0.5 text-xs bg-gray-50 text-gray-600 border border-gray-200">
                  In paper
                </span>
              )}
              {cl.framework && (
                <span className="rounded px-1.5 py-0.5 text-xs bg-purple-50 text-purple-700 border border-purple-200">
                  {cl.framework}
                </span>
              )}
              {cl.stars != null && (
                <span className="rounded px-1.5 py-0.5 text-xs bg-gray-50 text-gray-500 border border-gray-200">
                  ★ {cl.stars.toLocaleString()}
                </span>
              )}
            </div>
          </li>
        ))}
      </ul>
      {hasMore && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-2 text-xs text-blue-600 hover:underline"
        >
          {expanded ? "Show fewer" : `Show all ${links.length} repos`}
        </button>
      )}
    </>
  );
}
