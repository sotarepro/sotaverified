import { getEffectiveSession } from "@/lib/effective-session";
import sql from "@/lib/db";
import { recomputeVerificationScore } from "@/lib/verification";
import { logEvent } from "@/lib/activity";
import { NextRequest, NextResponse } from "next/server";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getEffectiveSession();
  if (!session?.user?.github_id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: paperId } = await params;
  const userId = session.user.github_id;

  // Verify user is a verified author of this paper
  const authorCheck = await sql`
    SELECT 1 FROM paper_authors
    WHERE paper_id = ${paperId} AND user_id = ${userId} AND status = 'verified'
  `;
  if (authorCheck.length === 0) {
    return NextResponse.json({ error: "Only verified authors can submit benchmark results" }, { status: 403 });
  }

  const body = await req.json();
  const { task_id, dataset_id, metric_name, metric_value, model_name, higher_is_better, notes } = body;

  if (!task_id || !dataset_id || !metric_name || metric_value == null) {
    return NextResponse.json({ error: "Missing required fields: task_id, dataset_id, metric_name, metric_value" }, { status: 400 });
  }

  // Validate types
  const numericValue = Number(metric_value);
  if (!isFinite(numericValue)) {
    return NextResponse.json({ error: "metric_value must be a finite number" }, { status: 400 });
  }
  if (typeof metric_name !== "string" || metric_name.length > 200) {
    return NextResponse.json({ error: "metric_name max 200 characters" }, { status: 400 });
  }

  // Verify task and dataset exist
  const taskCheck = await sql`SELECT 1 FROM tasks WHERE id = ${task_id}`;
  const datasetCheck = await sql`SELECT 1 FROM datasets WHERE id = ${dataset_id}`;
  if (taskCheck.length === 0) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }
  if (datasetCheck.length === 0) {
    return NextResponse.json({ error: "Dataset not found" }, { status: 404 });
  }

  const [row] = await sql<[{ id: number }]>`
    INSERT INTO leaderboard_results
      (task_id, dataset_id, paper_id, model_name, best_metric_name, best_metric_value,
       higher_is_better, source, submitted_by, verification)
    VALUES
      (${task_id}, ${dataset_id}, ${paperId}, ${model_name || null},
       ${metric_name}, ${numericValue}, ${higher_is_better ?? true},
       'author', ${userId}, 'community')
    RETURNING id
  `;

  await recomputeVerificationScore(paperId);

  await logEvent("author_benchmark_submitted", {
    userId,
    paperId,
    metadata: { dataset_id, metric_name, metric_value: numericValue },
  });

  return NextResponse.json({ id: row.id }, { status: 201 });
}
