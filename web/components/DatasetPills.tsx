"use client";

import { useState } from "react";
import { stripLatex } from "@/lib/strip-latex";

const VISIBLE_DEFAULT = 12;

interface Dataset {
  id: string;
  name: string;
}

interface Props {
  taskId: string;
  datasets: Dataset[];
  activeDatasetId: string | undefined;
  /** Client-side filter change (pushState, no server request). */
  onSelect: (datasetId: string | undefined) => void;
}

export default function DatasetPills({ taskId, datasets, activeDatasetId, onSelect }: Props) {
  const [expanded, setExpanded] = useState(false);

  if (datasets.length <= 1) return null;

  function pick(e: React.MouseEvent, id: string | undefined) {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    e.preventDefault();
    onSelect(id);
  }

  const visible = expanded ? datasets : datasets.slice(0, VISIBLE_DEFAULT);
  const hidden = datasets.length - VISIBLE_DEFAULT;

  return (
    <div className="flex flex-wrap gap-2 mb-6">
      <a
        href={`/tasks/${taskId}`}
        onClick={(e) => pick(e, undefined)}
        className={`rounded-full px-3 py-1 text-xs font-medium border transition-colors ${
          !activeDatasetId
            ? "bg-blue-600 text-white border-blue-600"
            : "border-gray-300 text-gray-600 hover:bg-gray-50"
        }`}
      >
        All datasets
      </a>

      {visible.map((d) => (
        <a
          key={d.id}
          href={`/tasks/${taskId}?dataset=${encodeURIComponent(d.id)}`}
          onClick={(e) => pick(e, d.id)}
          className={`rounded-full px-3 py-1 text-xs font-medium border transition-colors ${
            activeDatasetId === d.id
              ? "bg-blue-600 text-white border-blue-600"
              : "border-gray-300 text-gray-600 hover:bg-gray-50"
          }`}
        >
          {stripLatex(d.name)}
        </a>
      ))}

      {!expanded && hidden > 0 && (
        <button
          onClick={() => setExpanded(true)}
          className="rounded-full px-3 py-1 text-xs font-medium border border-dashed border-gray-300 text-gray-500 hover:bg-gray-50 transition-colors"
        >
          Show all {datasets.length} datasets ↓
        </button>
      )}

      {expanded && hidden > 0 && (
        <button
          onClick={() => setExpanded(false)}
          className="rounded-full px-3 py-1 text-xs font-medium border border-dashed border-gray-300 text-gray-500 hover:bg-gray-50 transition-colors"
        >
          Show less ↑
        </button>
      )}
    </div>
  );
}
