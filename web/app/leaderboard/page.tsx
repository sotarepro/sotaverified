import Link from "next/link";
import { getEffectiveSession } from "@/lib/effective-session";
import { getLeaderboardData } from "@/lib/public-data";
import { THRESHOLDS } from "@/lib/thresholds";

export const metadata = { title: "Leaderboard — SOTAVerified" };


export default async function LeaderboardPage() {
  const session = await getEffectiveSession();
  const currentUserId = session?.user?.github_id ?? null;

  const { users, needsVerification } = await getLeaderboardData();

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold tracking-tight mb-2">Leaderboard</h1>
      <p className="text-sm text-gray-500 mb-6">
        Top contributors ranked by reputation. Earn reputation by reproducing papers.
      </p>

      {/* User reputation leaderboard */}
      <section className="mb-12">
        {users.length === 0 ? (
          <div className="rounded-xl border border-gray-200 p-8 text-center text-gray-500 text-sm">
            No users with reputation yet. Be the first to reproduce a paper!
          </div>
        ) : (
          <div className="rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-left">
                  <th className="px-4 py-3 font-medium text-gray-600 w-12 text-right">#</th>
                  <th className="px-4 py-3 font-medium text-gray-600">User</th>
                  <th className="px-4 py-3 font-medium text-gray-600 text-right">Reputation</th>
                  <th className="px-4 py-3 font-medium text-gray-600 text-right">Reproduced Results</th>
                  <th className="px-4 py-3 font-medium text-gray-600 text-right">Authored</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {users.map((u, idx) => (
                  <tr
                    key={u.github_id}
                    className={
                      u.github_id === currentUserId
                        ? "bg-blue-50 hover:bg-blue-100"
                        : "hover:bg-gray-50"
                    }
                  >
                    <td className="px-4 py-3 text-right text-gray-400 tabular-nums font-medium">
                      {idx + 1}
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/profile/${u.username}`}
                        className="flex items-center gap-2 hover:underline"
                      >
                        {u.avatar_url && (
                          <img
                            src={u.avatar_url}
                            alt=""
                            className="w-6 h-6 rounded-full"
                          />
                        )}
                        <span className="font-medium text-gray-900">
                          {u.display_name || u.username}
                          {u.github_id === currentUserId && (
                            <span className="ml-1 text-blue-600 text-xs">(you)</span>
                          )}
                        </span>
                        {u.display_name && (
                          <span className="text-xs text-gray-400 ml-1">@{u.username}</span>
                        )}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums font-semibold text-gray-900">
                      {u.reputation_score}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-gray-600">
                      {u.repro_count}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-gray-600">
                      {u.authored_count}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Earn reputation CTA */}
      <section>
        <h2 className="text-lg font-semibold mb-1">Help verify these papers</h2>
        <p className="text-sm text-gray-500 mb-4">
          Submit reproductions to earn reputation and climb the leaderboard.
        </p>
        {needsVerification.length === 0 ? (
          <p className="text-sm text-gray-400">All hyped papers have been verified!</p>
        ) : (
          <div className="space-y-2">
            {needsVerification.map((p) => (
              <Link
                key={p.id}
                href={`/papers/${p.id}`}
                className="block rounded-lg border border-gray-200 px-4 py-3 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 line-clamp-1">
                      {p.title}
                    </p>
                    {p.published && (
                      <p className="text-xs text-gray-400 mt-0.5">{p.published.slice(0, 10)}</p>
                    )}
                  </div>
                  <div className="shrink-0 text-right">
                    <span className="text-xs text-gray-400">
                      {p.hype_score} hype
                    </span>
                    <p className="text-xs text-green-600 mt-0.5">
                      Up to +{THRESHOLDS.REP_TIER_3} rep for Tier 3 + {THRESHOLDS.REP_METRIC_MATCH_BONUS} metric bonus
                    </p>
                  </div>
                </div>
              </Link>
            ))}
            <Link
              href="/?tab=unverified"
              className="text-xs text-blue-600 hover:underline block mt-2"
            >
              View more papers needing verification →
            </Link>
          </div>
        )}
      </section>
    </div>
  );
}
