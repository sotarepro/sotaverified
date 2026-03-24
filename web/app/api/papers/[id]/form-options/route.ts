import sql from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/papers/{id}/form-options?type=tasks
 * GET /api/papers/{id}/form-options?type=datasets&task_id=X
 *
 * Returns options scoped to this paper for the benchmark submission form.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: paperId } = await params;
  const type = req.nextUrl.searchParams.get("type");
  const taskId = req.nextUrl.searchParams.get("task_id");

  if (type === "tasks") {
    // Tasks from this paper's paper_tasks junction
    const rows = await sql<{ id: string; name: string }[]>`
      SELECT t.id, t.name FROM tasks t
      JOIN paper_tasks pt ON pt.task_id = t.id
      WHERE pt.paper_id = ${paperId}
      ORDER BY t.result_count DESC
    `;
    // If paper has no tasks, fall back to top tasks globally
    if (rows.length === 0) {
      const fallback = await sql<{ id: string; name: string }[]>`
        SELECT id, name FROM tasks ORDER BY result_count DESC LIMIT 10
      `;
      return NextResponse.json(fallback);
    }
    return NextResponse.json(rows);
  }

  if (type === "datasets") {
    if (taskId) {
      // Datasets with existing leaderboard_results for this paper + task
      const rows = await sql<{ id: string; name: string }[]>`
        SELECT DISTINCT d.id, d.name FROM datasets d
        JOIN leaderboard_results lr ON lr.dataset_id = d.id
        WHERE lr.paper_id = ${paperId} AND lr.task_id = ${taskId}
        ORDER BY d.name
      `;
      // If none exist for this paper+task, show datasets for this task globally
      if (rows.length === 0) {
        const fallback = await sql<{ id: string; name: string }[]>`
          SELECT DISTINCT d.id, d.name FROM datasets d
          JOIN leaderboard_results lr ON lr.dataset_id = d.id
          WHERE lr.task_id = ${taskId}
          ORDER BY d.name
          LIMIT 20
        `;
        return NextResponse.json(fallback);
      }
      return NextResponse.json(rows);
    }
    // No task specified — return paper's datasets
    const rows = await sql<{ id: string; name: string }[]>`
      SELECT DISTINCT d.id, d.name FROM datasets d
      JOIN leaderboard_results lr ON lr.dataset_id = d.id
      WHERE lr.paper_id = ${paperId}
      ORDER BY d.name
    `;
    return NextResponse.json(rows);
  }

  return NextResponse.json([]);
}
