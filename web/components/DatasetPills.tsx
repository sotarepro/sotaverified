"use client";

import { useState } from "react";
import Link from "next/link";

const VISIBLE_DEFAULT = 12;

interface Dataset {
  id: string;
  name: string;
}

interface Props {
  taskId: string;
  datasets: Dataset[];
  activeDatasetId: string | undefined;
}

export default function DatasetPills({ taskId, datasets, activeDatasetId }: Props) {
  const [expanded, setExpanded] = useState(false);

  if (datasets.length <= 1) return null;

  const visible = expanded ? datasets : datasets.slice(0, VISIBLE_DEFAULT);
  const hidden = datasets.length - VISIBLE_DEFAULT;

  return (
    <div className="flex flex-wrap gap-2 mb-6">
      <Link
        href={`/tasks/${taskId}`}
        className={`rounded-full px-3 py-1 text-xs font-medium border transition-colors ${
          !activeDatasetId
            ? "bg-blue-600 text-white border-blue-600"
            : "border-gray-300 text-gray-600 hover:bg-gray-50"
        }`}
      >
        All datasets
      </Link>

      {visible.map((d) => (
        <Link
          key={d.id}
          href={`/tasks/${taskId}?dataset=${d.id}`}
          className={`rounded-full px-3 py-1 text-xs font-medium border transition-colors ${
            activeDatasetId === d.id
              ? "bg-blue-600 text-white border-blue-600"
              : "border-gray-300 text-gray-600 hover:bg-gray-50"
          }`}
        >
          {d.name}
        </Link>
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
