import Link from "next/link";
import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import sql from "@/lib/db";
import {
  getPaper,
  getPaperCodeLinks,
  getPaperLeaderboardEntries,
  getPaperUpvoteInfo,
  getPaperBenchmarks,
  type PaperLbEntry,
} from "@/lib/queries";
import { getBadgeData } from "@/lib/verification";
import VerificationBadge from "@/components/VerificationBadge";
import UpvoteButton from "@/components/UpvoteButton";
import CopyJsonButton from "@/components/CopyJsonButton";
import ReproductionForm from "@/components/ReproductionForm";
import AuthorBenchmarkForm from "@/components/AuthorBenchmarkForm";
import ReproductionList from "@/components/ReproductionList";
import AuthorClaimButton from "@/components/AuthorClaimButton";
import VerifiedAuthors from "@/components/VerifiedAuthors";
import PromoteButton from "@/components/PromoteButton";
import type { VerificationTier } from "@/lib/types";

export default async function PaperPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const session = await getServerSession(authOptions);
  const userId = session?.user?.github_id ?? null;

  // Check paper exists first to avoid crashes on invalid IDs like /papers/admin
  const paper = await getPaper(id);
  if (!paper) notFound();

  const [codeLinks, lbEntries, upvoteInfo, badgeData, benchmarks] = await Promise.all([
    getPaperCodeLinks(id),
    getPaperLeaderboardEntries(id),
    getPaperUpvoteInfo(id, userId),
    getBadgeData(id),
    getPaperBenchmarks(id),
  ]);

  // Fetch user's existing author claim + age-gate status
  let userClaim: { status: string } | null = null;
  let isAgeGated = false;
  if (userId) {
    const [claimRows, userRows] = await Promise.all([
      sql<{ status: string }[]>`
        SELECT status FROM paper_authors
        WHERE paper_id = ${id} AND user_id = ${userId}
      `,
      sql<{ is_flagged_new_account: boolean }[]>`
        SELECT is_flagged_new_account FROM users WHERE github_id = ${userId}
      `,
    ]);
    userClaim = claimRows[0] ?? null;
    isAgeGated = userRows[0]?.is_flagged_new_account ?? false;
  }

  // Fetch agent reproductions (pending review)
  const agentRepros = await sql<{
    id: number;
    tier_claimed: number;
    hardware_spec: string;
    run_log_url: string;
    notes: string | null;
    actual_metric_value: number | null;
    actual_metric_name: string | null;
    created_at: string;
    username: string | null;
    avatar_url: string | null;
  }[]>`
    SELECT r.id, r.tier_claimed, r.hardware_spec, r.run_log_url, r.notes,
           r.actual_metric_value, r.actual_metric_name, r.created_at::text,
           u.username, u.avatar_url
    FROM reproductions r
    LEFT JOIN users u ON u.github_id = r.user_id
    WHERE r.paper_id = ${id}
      AND r.source = 'api'
      AND r.status = 'agent_pending'
    ORDER BY r.created_at DESC
  `;

  // Check if current user is trusted (rep >= 30)
  let isTrustedUser = false;
  if (userId) {
    const [uRow] = await sql<[{ reputation_score: number }]>`
      SELECT reputation_score FROM users WHERE github_id = ${userId}
    `;
    isTrustedUser = (uRow?.reputation_score ?? 0) >= 30;
  }

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

      {/* Title + meta row */}
      <h1 className="text-2xl font-bold tracking-tight mb-3">{paper.title}</h1>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mb-4">
        {paper.published && (
          <span className="text-sm text-gray-500">{paper.published.slice(0, 10)}</span>
        )}
        {paper.proceeding && (
          <span className="text-sm font-medium text-gray-700">{paper.proceeding}</span>
        )}
        <VerificationBadge badge={badgeData.badge} count={badgeData.reproduction_count} score={badgeData.verification_score} />
        <UpvoteButton
          paperId={id}
          initialCount={upvoteInfo.count}
          initialUpvoted={upvoteInfo.upvoted}
        />
      </div>

      {/* Authors */}
      {paper.authors && paper.authors.length > 0 && (
        <p className="text-sm text-gray-600 mb-3">
          {paper.authors.join(", ")}
        </p>
      )}

      {/* Verified authors display */}
      <VerifiedAuthors paperId={id} />

      {/* Author claim button */}
      <div className="mb-5">
        <AuthorClaimButton paperId={id} initialClaim={userClaim} />
      </div>

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

      {/* Verification CTA banner */}
      {badgeData.badge === "unverified" && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 mb-6 flex items-center justify-between gap-4">
          <p className="text-sm text-amber-800">
            <span className="font-semibold">Unverified</span> — Be the first to reproduce this paper.
          </p>
          <a
            href="#reproduce"
            className="shrink-0 rounded-lg bg-amber-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-700 transition-colors"
          >
            Reproduce
          </a>
        </div>
      )}
      {(badgeData.badge === "code_available" || badgeData.badge === "author_verified") && badgeData.reproduction_count === 0 && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 mb-6 flex items-center justify-between gap-4">
          <p className="text-sm text-blue-800">
            {badgeData.badge === "author_verified"
              ? <><span className="font-semibold">Author Verified</span> — Help verify by reproducing this paper.</>
              : <><span className="font-semibold">Code Available</span> — Be the first to reproduce this paper.</>}
          </p>
          <a
            href="#reproduce"
            className="shrink-0 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
          >
            Reproduce
          </a>
        </div>
      )}
      {badgeData.badge === "community_verified" && badgeData.verification_score < 30 && (
        <div className="rounded-lg border border-teal-200 bg-teal-50 px-4 py-3 mb-6">
          <p className="text-sm text-teal-800">
            <span className="font-semibold">Community Verified ({badgeData.reproduction_count})</span> — Help verify: review reproductions and upvote if they look legit.
          </p>
        </div>
      )}
      {badgeData.badge === "community_verified" && badgeData.verification_score >= 30 && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 mb-6">
          <p className="text-sm text-green-800">
            <span className="font-semibold">Community Verified ({badgeData.reproduction_count})</span> — This paper has been reproduced by community members.
          </p>
        </div>
      )}

      {/* Code links — first content section */}
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
                  {cl.stars != null && (
                    <span className="rounded px-1.5 py-0.5 text-xs bg-gray-50 text-gray-500 border border-gray-200">
                      ★ {cl.stars.toLocaleString()}
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Abstract */}
      {paper.abstract && (
        <section className="mb-8">
          <h2 className="text-base font-semibold mb-2">Abstract</h2>
          <p className="text-gray-700 leading-relaxed text-sm">{paper.abstract}</p>
        </section>
      )}

      {/* Tasks */}
      {paper.tasks && paper.tasks.length > 0 && (
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
      {paper.methods && paper.methods.length > 0 && (
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

      {/* API / Agent section */}
      {paper.arxiv_id && (
        <CopyJsonButton arxivId={paper.arxiv_id} />
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
      {/* Author benchmark submission — only for verified authors */}
      {userClaim?.status === "verified" && (
        <section className="mb-8">
          <AuthorBenchmarkForm paperId={id} paperTasks={paper.tasks ?? []} />
        </section>
      )}

      {/* Reproductions */}
      <section id="reproduce" className="mb-8">
        <h2 className="text-base font-semibold mb-3">Reproductions</h2>
        <ReproductionForm paperId={id} isAgeGated={isAgeGated} benchmarks={benchmarks} />
        <ReproductionList paperId={id} />
      </section>

      {/* Agent Verifications */}
      {agentRepros.length > 0 && (
        <section className="mb-8">
          <h2 className="text-base font-semibold mb-3 text-gray-300">Agent Verifications</h2>
          <div className="rounded-xl border border-gray-700 bg-gray-950 p-4 space-y-3">
            {agentRepros.map((r) => {
              const tierColors: Record<number, string> = {
                1: "bg-gray-800 text-gray-300",
                2: "bg-blue-950 text-blue-300",
                3: "bg-green-950 text-green-300",
                4: "bg-purple-950 text-purple-300",
              };
              const tierLabels: Record<number, string> = {
                1: "Code runs",
                2: "Metrics match",
                3: "Independent",
                4: "Multi-verified",
              };
              return (
                <div key={r.id} className="border border-gray-800 rounded-lg p-3 text-sm">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${tierColors[r.tier_claimed] ?? "bg-gray-800 text-gray-300"}`}>
                        Tier {r.tier_claimed} — {tierLabels[r.tier_claimed]}
                      </span>
                      <span className="text-xs text-gray-500">
                        {new Date(r.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    {isTrustedUser && (
                      <PromoteButton reproductionId={r.id} />
                    )}
                  </div>
                  <div className="text-gray-400 text-xs mb-1">
                    Hardware: <span className="text-gray-300">{r.hardware_spec}</span>
                  </div>
                  {r.actual_metric_name && r.actual_metric_value != null && (
                    <div className="text-gray-400 text-xs mb-1">
                      Result: <span className="text-gray-300 font-mono">{r.actual_metric_value} {r.actual_metric_name}</span>
                    </div>
                  )}
                  <div className="text-gray-400 text-xs mb-1">
                    Log:{" "}
                    <a
                      href={r.run_log_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-400 hover:underline font-mono"
                    >
                      {r.run_log_url.replace(/^https?:\/\/(www\.)?/, "")}
                    </a>
                  </div>
                  {r.notes && (
                    <p className="text-gray-500 text-xs leading-relaxed">{r.notes}</p>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
