import { getEffectiveSession } from "@/lib/effective-session";
import sql from "@/lib/db";
import { recomputeVerificationScore } from "@/lib/verification";
import { logEvent } from "@/lib/activity";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const paperId = req.nextUrl.searchParams.get("paper_id");
  if (!paperId) {
    return NextResponse.json({ error: "paper_id required" }, { status: 400 });
  }

  const rows = await sql<{
    id: number;
    user_id: string;
    username: string | null;
    tier_claimed: number;
    hardware_spec: string;
    run_log_url: string | null;
    notes: string | null;
    upvote_count: number;
    flag_count: number;
    status: string;
    created_at: string;
    actual_metric_name: string | null;
    actual_metric_value: number | null;
    model_name: string | null;
    dataset_name: string | null;
  }[]>`
    SELECT
      r.id,
      r.user_id,
      u.username,
      r.tier_claimed,
      r.hardware_spec,
      r.run_log_url,
      r.notes,
      r.upvote_count,
      r.flag_count,
      r.status,
      r.created_at::text,
      r.actual_metric_name,
      r.actual_metric_value,
      r.model_name,
      d.name AS dataset_name
    FROM reproductions r
    LEFT JOIN users u ON u.github_id = r.user_id
    LEFT JOIN datasets d ON d.id = r.dataset_id
    WHERE r.paper_id = ${paperId}
      AND r.status != 'hidden'
    ORDER BY r.created_at DESC
  `;

  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const session = await getEffectiveSession();
  if (!session?.user?.github_id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { paper_id, tier_claimed, hardware_spec, run_log_url, notes, actual_metric_name, actual_metric_value, dataset_id, model_name } = body;

  if (!paper_id || !tier_claimed || !hardware_spec) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  // Input validation
  if (typeof tier_claimed !== "number" || !Number.isInteger(tier_claimed) || tier_claimed < 1 || tier_claimed > 4) {
    return NextResponse.json({ error: "tier_claimed must be an integer 1-4" }, { status: 400 });
  }
  if (typeof hardware_spec !== "string" || hardware_spec.length > 500) {
    return NextResponse.json({ error: "hardware_spec max 500 characters" }, { status: 400 });
  }
  if (notes != null && (typeof notes !== "string" || notes.length > 2000)) {
    return NextResponse.json({ error: "notes max 2000 characters" }, { status: 400 });
  }
  if (actual_metric_name != null && (typeof actual_metric_name !== "string" || actual_metric_name.length > 200)) {
    return NextResponse.json({ error: "actual_metric_name max 200 characters" }, { status: 400 });
  }

  // Validate run_log_url: URL or plain text (pasted terminal output) — optional
  const ALLOWED_DOMAINS = [
    "github.com",
    "gist.github.com",
    "wandb.ai",
    "colab.research.google.com",
    "huggingface.co",
  ];
  if (run_log_url && (typeof run_log_url !== "string" || run_log_url.length > 10000)) {
    return NextResponse.json({ error: "Run log exceeds maximum length" }, { status: 400 });
  }
  if (run_log_url && (run_log_url.startsWith("http://") || run_log_url.startsWith("https://"))) {
    try {
      const { hostname } = new URL(run_log_url);
      const ok = ALLOWED_DOMAINS.some((d) => hostname === d || hostname.endsWith("." + d));
      if (!ok) {
        return NextResponse.json(
          { error: `URL must be from: ${ALLOWED_DOMAINS.join(", ")}` },
          { status: 400 }
        );
      }
    } catch {
      return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
    }
  }

  // Users who pass sign-in legitimacy check have full access — no secondary gate

  const metricName = actual_metric_name?.trim() || null;
  const metricValue = actual_metric_value != null ? Number(actual_metric_value) : null;
  if (metricValue !== null && !isFinite(metricValue)) {
    return NextResponse.json({ error: "actual_metric_value must be a finite number" }, { status: 400 });
  }

  const [row] = await sql<[{ id: number }]>`
    INSERT INTO reproductions (paper_id, user_id, tier_claimed, hardware_spec, run_log_url, notes, actual_metric_name, actual_metric_value, dataset_id, model_name)
    VALUES (${paper_id}, ${session.user.github_id}, ${tier_claimed}, ${hardware_spec}, ${run_log_url ?? null}, ${notes ?? null}, ${metricName}, ${metricValue}, ${dataset_id ?? null}, ${model_name ?? null})
    RETURNING id
  `;

  await recomputeVerificationScore(paper_id);

  await logEvent("reproduction_submitted", {
    userId: session.user.github_id,
    paperId: paper_id,
    metadata: { tier_claimed, hardware_spec: hardware_spec.substring(0, 100) },
  });

  return NextResponse.json({ id: row.id }, { status: 201 });
}
