import Link from "@/components/Link";
import { notFound } from "next/navigation";
import { OwnerOnly } from "@/components/MeOnly";
import { getProfileData, getUsernameIndex } from "@/lib/public-data";

// Static per-user pages, pre-rendered at build and refreshed by on-demand revalidation
// (sign-ins / writes). No session read: the owner-only section is shown client-side.
export const dynamic = "force-static";
export const revalidate = false;
export const dynamicParams = true;

export async function generateStaticParams() {
  return (await getUsernameIndex()).map((username) => ({ username }));
}

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;

  // Only real usernames reach the keyed query (cached index) — junk URLs never wake the DB.
  if (!(await getUsernameIndex()).includes(username)) notFound();
  const data = await getProfileData(username);
  if (!data) notFound();
  const { user, reproductions, authoredPapers, rank } = data;

  const TIER_LABELS: Record<number, string> = { 1: "Code runs", 2: "Metrics match", 3: "Independent" };
  const displayName = user.display_name || user.username;
  const meta = [user.company, user.location].filter(Boolean).join(" · ");

  return (
    <div className="max-w-2xl">
      {/* Profile header */}
      <div className="flex items-start gap-5 mb-6">
        {user.avatar_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={user.avatar_url} alt="" className="w-20 h-20 rounded-full shrink-0" />
        )}
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight">{displayName}</h1>
          <a
            href={`https://github.com/${user.username}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            @{user.username}
          </a>
          {user.bio && (
            <p className="text-sm text-gray-600 mt-1 line-clamp-2">{user.bio}</p>
          )}
          {meta && (
            <p className="text-xs text-gray-400 mt-1">{meta}</p>
          )}
          <div className="flex items-center gap-4 text-sm text-gray-500 mt-2">
            <span className="font-semibold text-gray-900">{user.reputation_score} reputation</span>
            {user.reputation_score > 0 && (
              <span>#{rank} on leaderboard</span>
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
                  <span className="text-xs text-gray-500 shrink-0">
                    Tier {r.tier_claimed} — {TIER_LABELS[r.tier_claimed]}
                  </span>
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

      <OwnerOnly githubId={user.github_id}>
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
      </OwnerOnly>
    </div>
  );
}
