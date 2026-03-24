import { NextResponse } from "next/server";
import { isTestToolsEnabled } from "@/lib/test-tools";
import sql from "@/lib/db";

/**
 * POST /api/test/seed-test-data — Seed leaderboard results and author claims
 * for test papers. Idempotent — safe to call multiple times.
 * Only available when ENABLE_TEST_TOOLS=true or NODE_ENV=development.
 */
export async function POST() {
  if (!isTestToolsEnabled()) {
    return NextResponse.json({ error: "Test tools disabled" }, { status: 403 });
  }

  // Seed leaderboard result for test_full (CIFAR-10)
  await sql`
    INSERT INTO leaderboard_results (paper_id, task_id, dataset_id, model_name, best_metric_name, best_metric_value, verification)
    SELECT 'test_full', t.id, 'cifar-10', 'Test Model', 'top1', 93, 'unverified'
    FROM tasks t WHERE t.name = 'Image Classification' LIMIT 1
    ON CONFLICT DO NOTHING
  `;

  // Ensure CIFAR-10 dataset exists
  await sql`
    INSERT INTO datasets (id, name) VALUES ('cifar-10', 'CIFAR-10')
    ON CONFLICT DO NOTHING
  `;

  // Seed verified author claim for admin on test_full
  await sql`
    INSERT INTO paper_authors (paper_id, user_id, verified, verified_at, verification_method, status)
    VALUES ('test_full', '252498040', true, NOW(), 'github_contributor', 'verified')
    ON CONFLICT (paper_id, user_id) DO UPDATE SET
      verified = true, status = 'verified', verification_method = 'github_contributor'
  `;

  return NextResponse.json({ ok: true });
}
