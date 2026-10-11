"use client";

interface Props {
  page: number;
  total: number;
  pageSize: number;
  /** Builds the href for a page (also used by crawlers / middle-click). */
  hrefFor: (page: number) => string;
  /** Client-side navigation: pushState + state change, no server request. */
  onPage: (page: number) => void;
}

export default function Pagination({ page, total, pageSize, hrefFor, onPage }: Props) {
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

  const link = (p: number, label: React.ReactNode, cls: string) => (
    <a
      key={typeof label === "number" ? label : `n${p}`}
      href={hrefFor(p)}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
        e.preventDefault();
        onPage(p);
      }}
      className={cls}
    >
      {label}
    </a>
  );

  return (
    <nav className="flex items-center gap-1 text-sm">
      {page > 1 && link(page - 1, "←", "px-3 py-1.5 rounded border border-gray-200 hover:bg-gray-50")}
      {pages.map((p, i) =>
        p === "…" ? (
          <span key={`ellipsis-${i}`} className="px-2 py-1.5 text-gray-400">
            …
          </span>
        ) : (
          link(
            p,
            p,
            `px-3 py-1.5 rounded border ${
              p === page ? "bg-blue-600 text-white border-blue-600" : "border-gray-200 hover:bg-gray-50"
            }`,
          )
        )
      )}
      {page < totalPages && link(page + 1, "→", "px-3 py-1.5 rounded border border-gray-200 hover:bg-gray-50")}
    </nav>
  );
}
