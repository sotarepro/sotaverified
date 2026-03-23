import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import sql from "@/lib/db";
import Link from "next/link";
import AdminActions from "./AdminActions";
import AdminAuthorActions from "./AdminAuthorActions";
import { SignupAction, ClearAllSignups } from "./SignupActions";
import TestTools from "./TestTools";
import { isTestToolsEnabled } from "@/lib/test-tools";

function isAdmin(githubId: string | undefined): boolean {
  return !!githubId && githubId === process.env.ADMIN_GITHUB_ID;
}

const EVENT_LABELS: Record<string, { label: string; color: string }> = {
  user_signin: { label: "Sign In", color: "bg-gray-100 text-gray-700" },
  paper_hyped: { label: "Hyped", color: "bg-yellow-50 text-yellow-700" },
  paper_unhyped: { label: "Unhyped", color: "bg-gray-100 text-gray-500" },
  reproduction_submitted: { label: "Reproduction", color: "bg-blue-50 text-blue-700" },
  author_claimed: { label: "Author Claim", color: "bg-purple-50 text-purple-700" },
  reproduction_flagged: { label: "Flagged", color: "bg-red-50 text-red-700" },
  reproduction_unflagged: { label: "Unflagged", color: "bg-orange-50 text-orange-600" },
  agent_reproduction_submitted: { label: "Agent Submission", color: "bg-indigo-50 text-indigo-700" },
  agent_reproduction_promoted: { label: "Agent Promoted", color: "bg-green-50 text-green-700" },
  rate_limit_hit: { label: "Rate Limited", color: "bg-red-100 text-red-800" },
  author_claim_failed: { label: "Author Claim Failed", color: "bg-red-50 text-red-600" },
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const secs = Math.floor(diff / 1000);
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

const PAGE_SIZE = 25;

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!isAdmin(session?.user?.github_id)) {
    notFound();
  }

  const sp = await searchParams;
  const page = Math.max(1, parseInt(sp.page ?? "1", 10));
  const offset = (page - 1) * PAGE_SIZE;

  // Activity feed
  const activityFeed = await sql<{
    id: string;
    event_type: string;
    user_id: string | null;
    paper_id: string | null;
    metadata: Record<string, unknown> | null;
    created_at: string;
    username: string | null;
    avatar_url: string | null;
    paper_title: string | null;
    is_test_user: boolean;
  }[]>`
    SELECT
      al.id::text,
      al.event_type,
      al.user_id,
      al.paper_id,
      al.metadata,
      al.created_at::text,
      u.username,
      u.avatar_url,
      p.title AS paper_title,
      COALESCE(u.is_test, false) AS is_test_user
    FROM activity_log al
    LEFT JOIN users u ON u.github_id = al.user_id
    LEFT JOIN papers p ON p.id = al.paper_id
    ORDER BY al.created_at DESC
    LIMIT ${PAGE_SIZE} OFFSET ${offset}
  `;

  const [{ total }] = await sql<[{ total: number }]>`
    SELECT COUNT(*)::int AS total FROM activity_log
  `;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  // Pending author claims
  const pendingAuthors = await sql<{
    paper_id: string;
    paper_title: string | null;
    user_id: string;
    username: string | null;
    avatar_url: string | null;
    created_at: string;
  }[]>`
    SELECT
      pa.paper_id,
      p.title AS paper_title,
      pa.user_id,
      u.username,
      u.avatar_url,
      pa.created_at::text
    FROM paper_authors pa
    LEFT JOIN papers p ON p.id = pa.paper_id
    LEFT JOIN users u ON u.github_id = pa.user_id
    WHERE pa.status = 'pending_admin'
    ORDER BY pa.created_at ASC
  `;

  // Agent submissions pending review
  const agentPending = await sql<{
    id: number;
    paper_id: string;
    paper_title: string | null;
    user_id: string;
    username: string | null;
    tier_claimed: number;
    hardware_spec: string;
    run_log_url: string;
    notes: string | null;
    created_at: string;
  }[]>`
    SELECT
      r.id,
      r.paper_id,
      p.title AS paper_title,
      r.user_id,
      u.username,
      r.tier_claimed,
      r.hardware_spec,
      r.run_log_url,
      r.notes,
      r.created_at::text
    FROM reproductions r
    LEFT JOIN papers p ON p.id = r.paper_id
    LEFT JOIN users u ON u.github_id = r.user_id
    WHERE r.source = 'api' AND r.status = 'agent_pending'
    ORDER BY r.created_at DESC
  `;

  // Pending sign-up requests
  const pendingSignups = await sql<{
    id: number;
    github_id: string;
    github_username: string;
    avatar_url: string | null;
    legitimacy_score: number | null;
    score_breakdown: Record<string, unknown> | null;
    created_at: string;
  }[]>`
    SELECT id, github_id, github_username, avatar_url,
           legitimacy_score, score_breakdown, created_at::text
    FROM sign_up_requests
    WHERE status = 'pending'
    ORDER BY created_at DESC
    LIMIT 50
  `;

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-bold tracking-tight mb-6">Admin</h1>

      {/* Test Tools (dev/staging only) */}
      {isTestToolsEnabled() && <TestTools />}

      {/* Section 0: Pending Sign-ups */}
      {pendingSignups.length > 0 && (
        <section className="mb-10">
          <h2 className="text-lg font-semibold mb-4">
            Pending Sign-ups{" "}
            <span className="ml-2 rounded-full bg-amber-100 text-amber-700 text-xs px-2 py-0.5">
              {pendingSignups.length}
            </span>
          </h2>
          <div className="space-y-2">
            {pendingSignups.map((s) => {
              const bd = s.score_breakdown as Record<string, { value?: number; points?: number }> | null;
              return (
                <div key={s.id} className="rounded-lg border border-gray-200 p-3 text-sm">
                  <div className="flex items-center gap-3">
                    {s.avatar_url && (
                      <img src={s.avatar_url} alt="" className="w-6 h-6 rounded-full" />
                    )}
                    <span className="font-medium">@{s.github_username}</span>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      (s.legitimacy_score ?? 0) < 10 ? "bg-red-100 text-red-700" :
                      (s.legitimacy_score ?? 0) < 25 ? "bg-amber-100 text-amber-700" :
                      "bg-green-100 text-green-700"
                    }`}>
                      Score: {s.legitimacy_score ?? "?"}
                    </span>
                    <span className="text-gray-400 text-xs">{timeAgo(s.created_at)}</span>
                    <span className="ml-auto flex gap-2">
                      <SignupAction id={s.id} action="approve" />
                      <SignupAction id={s.id} action="reject" />
                    </span>
                  </div>
                  {bd && (
                    <div className="mt-2 flex flex-wrap gap-2 text-xs text-gray-500">
                      <span>repos: {bd.repos?.value ?? 0} → {bd.repos?.points ?? 0}pts</span>
                      <span>followers: {bd.followers?.value ?? 0} → {bd.followers?.points ?? 0}pts</span>
                      <span>events: {bd.recentEvents?.value ?? 0} → {bd.recentEvents?.points ?? 0}pts</span>
                      <span>profile: {bd.profile?.points ?? 0}pts</span>
                      <span>gists: {bd.gists?.value ?? 0} → {bd.gists?.points ?? 0}pts</span>
                    </div>
                  )}
                </div>
              );
            })}
            <ClearAllSignups />
          </div>
        </section>
      )}

      {/* Section 1: Pending Author Claims */}
      <section className="mb-10">
        <h2 className="text-lg font-semibold mb-4">
          Pending Author Claims{" "}
          {pendingAuthors.length > 0 && (
            <span className="ml-2 rounded-full bg-purple-100 text-purple-700 text-xs px-2 py-0.5">
              {pendingAuthors.length}
            </span>
          )}
        </h2>
        {pendingAuthors.length === 0 ? (
          <p className="text-gray-500 text-sm">No pending claims.</p>
        ) : (
          <div className="space-y-3">
            {pendingAuthors.map((a) => (
              <div
                key={`${a.paper_id}-${a.user_id}`}
                className="rounded-xl border border-gray-200 p-4 text-sm flex items-start justify-between gap-4"
              >
                <div>
                  <p className="font-medium text-gray-900">
                    <Link href={`/papers/${a.paper_id}`} className="hover:underline text-blue-700">
                      {a.paper_title ?? a.paper_id}
                    </Link>
                  </p>
                  <p className="text-xs text-gray-500">
                    claimed by @{a.username ?? a.user_id} · {a.created_at.slice(0, 10)}
                  </p>
                </div>
                <AdminAuthorActions paperId={a.paper_id} userId={a.user_id} />
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Section 2: Agent Submissions Pending Review */}
      <section className="mb-10">
        <h2 className="text-lg font-semibold mb-4">
          Agent Submissions Pending Review{" "}
          {agentPending.length > 0 && (
            <span className="ml-2 rounded-full bg-indigo-100 text-indigo-700 text-xs px-2 py-0.5">
              {agentPending.length}
            </span>
          )}
        </h2>
        {agentPending.length === 0 ? (
          <p className="text-gray-500 text-sm">No agent submissions pending.</p>
        ) : (
          <div className="space-y-3">
            {agentPending.map((r) => (
              <div key={r.id} className="rounded-xl border border-indigo-200 bg-indigo-50 p-4 text-sm">
                <div className="flex items-start justify-between gap-4 mb-2">
                  <div>
                    <p className="font-medium text-gray-900">
                      <Link href={`/papers/${r.paper_id}`} className="hover:underline text-blue-700">
                        {r.paper_title ?? r.paper_id}
                      </Link>
                    </p>
                    <p className="text-xs text-gray-500">
                      by @{r.username ?? r.user_id} · Tier {r.tier_claimed} · {r.created_at.slice(0, 10)}
                    </p>
                  </div>
                  <AdminActions id={r.id} />
                </div>
                <p className="text-xs text-gray-600 mb-1">
                  <span className="font-medium">Hardware:</span> {r.hardware_spec}
                </p>
                <p className="text-xs text-gray-600 mb-1">
                  <span className="font-medium">Log:</span>{" "}
                  <a href={r.run_log_url} target="_blank" rel="noopener noreferrer"
                     className="text-blue-600 hover:underline font-mono">
                    {r.run_log_url}
                  </a>
                </p>
                {r.notes && <p className="text-xs text-gray-600">{r.notes}</p>}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Section 3: Activity Feed */}
      <section>
        <h2 className="text-lg font-semibold mb-4">
          Activity Feed
          <span className="ml-2 text-sm font-normal text-gray-500">
            {total.toLocaleString()} events total
          </span>
        </h2>

        {activityFeed.length === 0 ? (
          <p className="text-gray-500 text-sm">No activity yet.</p>
        ) : (
          <div className="space-y-2">
            {activityFeed.map((ev) => {
              const badge = EVENT_LABELS[ev.event_type] ?? { label: ev.event_type, color: "bg-gray-100 text-gray-600" };
              return (
                <div key={ev.id} className="rounded-lg border border-gray-200 p-3 text-sm flex items-start gap-3">
                  {ev.avatar_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={ev.avatar_url} alt="" className="w-6 h-6 rounded-full shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${badge.color}`}>
                        {badge.label}
                      </span>
                      {ev.username && (
                        <span className="text-gray-600 text-xs flex items-center gap-1">
                          {ev.is_test_user && (
                            <span className="rounded bg-amber-200 px-1 py-0.5 text-xs font-mono text-amber-800 leading-none">
                              TEST
                            </span>
                          )}
                          @{ev.username}
                        </span>
                      )}
                      {ev.paper_id && (
                        <Link
                          href={`/papers/${ev.paper_id}`}
                          className="text-xs text-blue-600 hover:underline truncate max-w-xs"
                        >
                          {ev.paper_title ?? ev.paper_id}
                        </Link>
                      )}
                      <span className="text-xs text-gray-400 ml-auto shrink-0">
                        {timeAgo(ev.created_at)}
                      </span>
                    </div>
                    {ev.metadata && Object.keys(ev.metadata).length > 0 && (
                      <p className="text-xs text-gray-400 mt-0.5 font-mono">
                        {JSON.stringify(ev.metadata)}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center gap-3 mt-6 text-sm">
            {page > 1 && (
              <Link href={`/admin?page=${page - 1}`} className="rounded px-3 py-1.5 border border-gray-200 hover:bg-gray-50">
                ← Previous
              </Link>
            )}
            <span className="text-gray-500">
              Page {page} of {totalPages}
            </span>
            {page < totalPages && (
              <Link href={`/admin?page=${page + 1}`} className="rounded px-3 py-1.5 border border-gray-200 hover:bg-gray-50">
                Next →
              </Link>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
