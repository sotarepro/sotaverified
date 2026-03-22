/**
 * Server component — rendered inside admin page when test tools are enabled.
 * Queries current test users and papers, then renders them with client buttons.
 */
import Link from "next/link";
import sql from "@/lib/db";
import {
  CreateUserButtons,
  CreatePaperButtons,
  ImpersonateButton,
  ResetButton,
} from "./TestToolsClient";

async function getTestUsers() {
  return sql<{
    github_id: string;
    username: string;
    reputation_score: number;
    is_flagged_new_account: boolean;
  }[]>`
    SELECT github_id, username, reputation_score, is_flagged_new_account
    FROM users WHERE is_test = true ORDER BY created_at
  `;
}

async function getTestPapers() {
  return sql<{ id: string; title: string; verification_score: number }[]>`
    SELECT id, title, verification_score
    FROM papers WHERE is_test = true ORDER BY created_at
  `;
}

export default async function TestTools() {
  const [users, papers] = await Promise.all([getTestUsers(), getTestPapers()]);

  return (
    <section className="mb-10 rounded-xl border-2 border-dashed border-amber-300 bg-amber-50 p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-semibold text-amber-900 flex items-center gap-2">
          <span className="rounded bg-amber-200 px-1.5 py-0.5 text-xs font-mono text-amber-800">
            DEV
          </span>
          Test Tools
        </h2>
        <ResetButton />
      </div>

      {/* Test Users */}
      <div className="mb-5">
        <h3 className="text-sm font-medium text-amber-800 mb-2">Test Users</h3>
        <CreateUserButtons />

        {users.length > 0 && (
          <div className="mt-3 rounded-lg border border-amber-200 bg-white overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-amber-100 bg-amber-50">
                  <th className="px-3 py-2 text-left font-medium text-gray-600">Username</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-600">Rep</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-600">Age-gated?</th>
                  <th className="px-3 py-2 text-right font-medium text-gray-600">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-amber-50">
                {users.map((u) => (
                  <tr key={u.github_id} className="hover:bg-amber-50/50 transition-colors">
                    <td className="px-3 py-2 font-mono text-gray-800">@{u.username}</td>
                    <td className="px-3 py-2 text-gray-600">{u.reputation_score}</td>
                    <td className="px-3 py-2">
                      {u.is_flagged_new_account ? (
                        <span className="text-red-600">yes</span>
                      ) : (
                        <span className="text-green-600">no</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <ImpersonateButton githubId={u.github_id} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {users.length === 0 && (
          <p className="text-xs text-amber-700 mt-2 italic">No test users yet.</p>
        )}
      </div>

      {/* Test Papers */}
      <div>
        <h3 className="text-sm font-medium text-amber-800 mb-2">Test Papers</h3>
        <CreatePaperButtons />

        {papers.length > 0 && (
          <div className="mt-3 rounded-lg border border-amber-200 bg-white overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-amber-100 bg-amber-50">
                  <th className="px-3 py-2 text-left font-medium text-gray-600">Title</th>
                  <th className="px-3 py-2 text-right font-medium text-gray-600">Score</th>
                  <th className="px-3 py-2 text-right font-medium text-gray-600">Link</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-amber-50">
                {papers.map((p) => (
                  <tr key={p.id} className="hover:bg-amber-50/50 transition-colors">
                    <td className="px-3 py-2 text-gray-800">{p.title}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-gray-500">
                      {p.verification_score}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Link
                        href={`/papers/${p.id}`}
                        className="text-blue-600 hover:underline"
                      >
                        View →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {papers.length === 0 && (
          <p className="text-xs text-amber-700 mt-2 italic">No test papers yet.</p>
        )}
      </div>

      {/* Recommended sequence */}
      <details className="mt-4">
        <summary className="text-xs text-amber-700 cursor-pointer hover:text-amber-900 select-none">
          Recommended test sequence
        </summary>
        <ol className="mt-2 text-xs text-amber-800 space-y-1 list-decimal list-inside">
          <li>Create Full Test Paper with a repo you contribute to</li>
          <li>Create all three test users</li>
          <li>Impersonate New User → hype paper (should work), try submit repro (check age gate)</li>
          <li>Impersonate Trusted User → submit repro, promote agent repro, flag (2x weight)</li>
          <li>Impersonate Author → click "I authored this" on Full Test Paper → should auto-verify</li>
          <li>Return to admin → check activity feed, paper detail, leaderboard scores</li>
          <li>Click Reset Test Data to clean up</li>
        </ol>
      </details>
    </section>
  );
}
