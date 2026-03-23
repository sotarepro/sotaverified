import Link from "next/link";
import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import sql from "@/lib/db";

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const session = await getServerSession(authOptions);

  const [user] = await sql<{
    github_id: string;
    username: string;
    avatar_url: string | null;
    reputation_score: number;
    created_at: string;
  }[]>`
    SELECT github_id, username, avatar_url, reputation_score, created_at::text
    FROM users WHERE username = ${username} AND is_test = false
  `;

  if (!user) notFound();

  const isOwn = session?.user?.github_id === user.github_id;

  // Reproductions
  const reproductions = await sql<{
    id: number;
    paper_id: string;
    paper_title: string | null;
    tier_claimed: number;
    status: string;
    created_at: string;
  }[]>`
    SELECT r.id, r.paper_id, p.title AS paper_title,
           r.tier_claimed, r.status, r.created_at::text
    FROM reproductions r
    LEFT JOIN papers p ON p.id = r.paper_id
    WHERE r.user_id = ${user.github_id}
      AND r.status NOT IN ('hidden', 'removed')
    ORDER BY r.created_at DESC
    LIMIT 50
  `;

  // Authored papers
  const authoredPapers = await sql<{
    paper_id: string;
    paper_title: string | null;
  }[]>`
    SELECT pa.paper_id, p.title AS paper_title
    FROM paper_authors pa
    LEFT JOIN papers p ON p.id = pa.paper_id
    WHERE pa.user_id = ${user.github_id} AND pa.status = 'verified'
    ORDER BY p.published DESC NULLS LAST
    LIMIT 50
  `;

  // Leaderboard rank
  const [rankRow] = await sql<[{ rank: number }]>`
    SELECT COUNT(*)::int + 1 AS rank FROM users
    WHERE reputation_score > ${user.reputation_score} AND is_test = false
  `;

  const TIER_LABELS: Record<number, string> = { 1: "Code runs", 2: "Metrics match", 3: "Independent", 4: "Multi-verified" };

  return (
    <div className="max-w-2xl">
      {/* Profile header */}
      <div className="flex items-center gap-4 mb-6">
        {user.avatar_url && (
          <img src={user.avatar_url} alt="" className="w-16 h-16 rounded-full" />
        )}
        <div>
          <h1 className="text-2xl font-bold">{user.username}</h1>
          <div className="flex items-center gap-4 text-sm text-gray-500 mt-1">
            <span className="font-semibold text-gray-900">{user.reputation_score} rep</span>
            {user.reputation_score > 0 && (
              <span>#{rankRow.rank} on leaderboard</span>
            )}
            <span>Joined {new Date(user.created_at).toLocaleDateString()}</span>
          </div>
        </div>
      </div>

      {/* Reproductions */}
      <section className="mb-8">
        <h2 className="text-base font-semibold mb-3">
          Reproductions ({reproductions.length})
        </h2>
        {reproductions.length === 0 ? (
          <p className="text-sm text-gray-400">No reproductions yet.</p>
        ) : (
          <div className="space-y-2">
            {reproductions.map((r) => (
              <Link
                key={r.id}
                href={`/papers/${r.paper_id}`}
                className="block rounded-lg border border-gray-200 px-4 py-3 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium text-gray-900 line-clamp-1">
                    {r.paper_title ?? r.paper_id}
                  </p>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs text-gray-500">
                      Tier {r.tier_claimed} — {TIER_LABELS[r.tier_claimed]}
                    </span>
                    {r.status === "verified" && (
                      <span className="text-xs rounded-full bg-green-100 text-green-700 px-2 py-0.5">
                        Verified
                      </span>
                    )}
                  </div>
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  {new Date(r.created_at).toLocaleDateString()}
                </p>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Authored papers */}
      <section className="mb-8">
        <h2 className="text-base font-semibold mb-3">
          Authored Papers ({authoredPapers.length})
        </h2>
        {authoredPapers.length === 0 ? (
          <p className="text-sm text-gray-400">No verified author claims.</p>
        ) : (
          <div className="space-y-2">
            {authoredPapers.map((p) => (
              <Link
                key={p.paper_id}
                href={`/papers/${p.paper_id}`}
                className="block rounded-lg border border-gray-200 px-4 py-3 hover:bg-gray-50 transition-colors text-sm font-medium text-gray-900 line-clamp-1"
              >
                {p.paper_title ?? p.paper_id}
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* API key management (own profile only) */}
      {isOwn && (
        <section className="mb-8">
          <h2 className="text-base font-semibold mb-3">API Keys</h2>
          <p className="text-sm text-gray-500">
            API key management coming soon. Contact{" "}
            <a href="mailto:support@sotaverified.org" className="text-blue-600 hover:underline">
              support@sotaverified.org
            </a>{" "}
            to request an API key for agent submissions.
          </p>
        </section>
      )}
    </div>
  );
}
