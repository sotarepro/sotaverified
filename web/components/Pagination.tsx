"use client";

import Link from "next/link";

interface Props {
  page: number;
  total: number;
  pageSize: number;
  /** Base URL, e.g. "/" or "/tasks/foo?dataset=bar" — page param is appended */
  baseHref: string;
}

function buildHref(base: string, page: number): string {
  const sep = base.includes("?") ? "&" : "?";
  return `${base}${sep}page=${page}`;
}

export default function Pagination({ page, total, pageSize, baseHref }: Props) {
  const totalPages = Math.ceil(total / pageSize);
  if (totalPages <= 1) return null;

  const pages: (number | "…")[] = [];
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || Math.abs(i - page) <= 2) {
      pages.push(i);
    } else if (pages[pages.length - 1] !== "…") {
      pages.push("…");
    }
  }

  return (
    <nav className="flex items-center gap-1 text-sm">
      {page > 1 && (
        <Link
          href={buildHref(baseHref, page - 1)}
          className="px-3 py-1.5 rounded border border-gray-200 hover:bg-gray-50"
        >
          ←
        </Link>
      )}
      {pages.map((p, i) =>
        p === "…" ? (
          <span key={`ellipsis-${i}`} className="px-2 py-1.5 text-gray-400">
            …
          </span>
        ) : (
          <Link
            key={p}
            href={buildHref(baseHref, p as number)}
            className={`px-3 py-1.5 rounded border ${
              p === page
                ? "bg-blue-600 text-white border-blue-600"
                : "border-gray-200 hover:bg-gray-50"
            }`}
          >
            {p}
          </Link>
        )
      )}
      {page < totalPages && (
        <Link
          href={buildHref(baseHref, page + 1)}
          className="px-3 py-1.5 rounded border border-gray-200 hover:bg-gray-50"
        >
          →
        </Link>
      )}
    </nav>
  );
}
