import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getPaper,
  getPaperCodeLinks,
  getPaperLeaderboardEntries,
  type PaperLbEntry,
} from "@/lib/queries";
import VerificationBadge from "@/components/VerificationBadge";
import type { VerificationTier } from "@/lib/types";

export default async function PaperPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [paper, codeLinks, lbEntries] = await Promise.all([
    getPaper(id),
    getPaperCodeLinks(id),
    getPaperLeaderboardEntries(id),
  ]);

  if (!paper) notFound();

  return (
    <div className="max-w-3xl">
      {/* Breadcrumb */}
      <nav className="text-sm text-gray-500 mb-4">
        <Link href="/" className="hover:text-gray-700">
          Tasks
        </Link>
        <span className="mx-2">›</span>
        <span className="text-gray-700 line-clamp-1">{paper.title}</span>
      </nav>

      {/* Title + meta */}
      <h1 className="text-2xl font-bold tracking-tight mb-3">{paper.title}</h1>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-500 mb-4">
        {paper.published && (
          <span>{paper.published.slice(0, 10)}</span>
        )}
        {paper.proceeding && (
          <span className="font-medium text-gray-700">{paper.proceeding}</span>
        )}
        <VerificationBadge tier={paper.verification as VerificationTier} />
      </div>

      {paper.authors.length > 0 && (
        <p className="text-sm text-gray-600 mb-5">
          {paper.authors.join(", ")}
        </p>
      )}

      {/* Links row */}
      <div className="flex flex-wrap gap-2 mb-6">
        {paper.url_abs && (
          <a
            href={paper.url_abs}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50 transition-colors"
          >
            arXiv
            <svg className="w-3 h-3 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>
        )}
        {paper.url_pdf && (
          <a
            href={paper.url_pdf}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50 transition-colors"
          >
            PDF
            <svg className="w-3 h-3 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>
        )}
      </div>

      {/* Abstract */}
      {paper.abstract && (
        <section className="mb-8">
          <h2 className="text-base font-semibold mb-2">Abstract</h2>
          <p className="text-gray-700 leading-relaxed text-sm">{paper.abstract}</p>
        </section>
      )}

      {/* Code links */}
      {codeLinks.length > 0 && (
        <section className="mb-8">
          <h2 className="text-base font-semibold mb-3">Code</h2>
          <ul className="space-y-2">
            {codeLinks.map((cl) => (
              <li
                key={cl.repo_url}
                className="flex items-center gap-3 text-sm"
              >
                <a
                  href={cl.repo_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline font-mono truncate max-w-sm"
                >
                  {cl.repo_url.replace(/^https?:\/\/(www\.)?/, "")}
                </a>
                <div className="flex gap-1 shrink-0">
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
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Tasks */}
      {paper.tasks.length > 0 && (
        <section className="mb-8">
          <h2 className="text-base font-semibold mb-3">Tasks</h2>
          <div className="flex flex-wrap gap-2">
            {paper.tasks.map((t) => (
              <Link
                key={t}
                href={`/tasks/${t.toLowerCase().replace(/\s+/g, "-").replace(/[^\w-]/g, "")}`}
                className="rounded-full border border-gray-300 px-3 py-1 text-xs text-gray-700 hover:bg-gray-50 transition-colors"
              >
                {t}
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Methods */}
      {paper.methods.length > 0 && (
        <section className="mb-8">
          <h2 className="text-base font-semibold mb-3">Methods</h2>
          <div className="flex flex-wrap gap-2">
            {paper.methods.map((m) => (
              <span
                key={m}
                className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs text-gray-600"
              >
                {m}
              </span>
            ))}
          </div>
        </section>
      )}

      {/* Leaderboard appearances */}
      {lbEntries.length > 0 && (
        <section className="mb-8">
          <h2 className="text-base font-semibold mb-3">Benchmark Results</h2>
          <div className="rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-left">
                  <th className="px-4 py-3 font-medium text-gray-600">Task</th>
                  <th className="px-4 py-3 font-medium text-gray-600">Dataset</th>
                  <th className="px-4 py-3 font-medium text-gray-600">Model</th>
                  <th className="px-4 py-3 font-medium text-gray-600 text-right">
                    Value
                  </th>
                  <th className="px-4 py-3 font-medium text-gray-600">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {lbEntries.map((e: PaperLbEntry, i: number) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="px-4 py-2.5">
                      <Link
                        href={`/tasks/${e.task_id}`}
                        className="text-blue-600 hover:underline"
                      >
                        {e.task_name}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5 text-gray-600">
                      {e.dataset_name}
                    </td>
                    <td className="px-4 py-2.5 font-medium">{e.model_name}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums font-mono">
                      {e.best_metric_value != null
                        ? `${Number(e.best_metric_value).toLocaleString(undefined, { maximumFractionDigits: 2 })} ${e.best_metric_name ?? ""}`
                        : "—"}
                    </td>
                    <td className="px-4 py-2.5">
                      <VerificationBadge
                        tier={e.verification as VerificationTier}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
