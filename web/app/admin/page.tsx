import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import sql from "@/lib/db";
import AdminActions from "./AdminActions";

function isAdmin(githubId: string | undefined): boolean {
  return !!githubId && githubId === process.env.ADMIN_GITHUB_ID;
}

export default async function AdminPage() {
  const session = await getServerSession(authOptions);
  if (!isAdmin(session?.user?.github_id)) {
    notFound();
  }

  const flagged = await sql<{
    id: number;
    paper_id: string;
    paper_title: string | null;
    user_id: string;
    username: string | null;
    tier_claimed: number;
    hardware_spec: string;
    run_log_url: string;
    notes: string | null;
    upvote_count: number;
    flag_count: number;
    status: string;
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
      r.upvote_count,
      r.flag_count,
      r.status,
      r.created_at::text
    FROM reproductions r
    LEFT JOIN papers p ON p.id = r.paper_id
    LEFT JOIN users u ON u.github_id = r.user_id
    WHERE r.flag_count >= 3 OR r.status IN ('hidden', 'removed')
    ORDER BY r.flag_count DESC, r.created_at DESC
  `;

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-bold tracking-tight mb-6">Admin — Flagged Reproductions</h1>

      {flagged.length === 0 ? (
        <p className="text-gray-500">Nothing in the queue.</p>
      ) : (
        <div className="space-y-4">
          {flagged.map((r) => (
            <div key={r.id} className="rounded-xl border border-gray-200 p-4 text-sm">
              <div className="flex items-start justify-between gap-4 mb-2">
                <div>
                  <p className="font-medium text-gray-900">
                    {r.paper_title ?? r.paper_id}
                  </p>
                  <p className="text-xs text-gray-500">
                    by {r.username ?? r.user_id} · Tier {r.tier_claimed} ·{" "}
                    <span className="text-red-600">{r.flag_count} flags</span> ·{" "}
                    status: {r.status}
                  </p>
                </div>
                <AdminActions id={r.id} />
              </div>

              <p className="text-gray-600 mb-1">
                <span className="font-medium">Hardware:</span> {r.hardware_spec}
              </p>
              <p className="text-gray-600 mb-1">
                <span className="font-medium">Log:</span>{" "}
                <a href={r.run_log_url} target="_blank" rel="noopener noreferrer"
                   className="text-blue-600 hover:underline font-mono text-xs">
                  {r.run_log_url}
                </a>
              </p>
              {r.notes && <p className="text-gray-600 text-xs">{r.notes}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
