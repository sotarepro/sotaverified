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
    run_log_url: string;
    notes: string | null;
    upvote_count: number;
    flag_count: number;
    status: string;
    created_at: string;
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
      r.created_at::text
    FROM reproductions r
    LEFT JOIN users u ON u.github_id = r.user_id
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
  const { paper_id, tier_claimed, hardware_spec, run_log_url, notes, actual_metric_name, actual_metric_value } = body;

  if (!paper_id || !tier_claimed || !hardware_spec || !run_log_url) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  // Validate run_log_url: URL or plain text (pasted terminal output)
  const ALLOWED_DOMAINS = [
    "github.com",
    "gist.github.com",
    "wandb.ai",
    "colab.research.google.com",
    "huggingface.co",
  ];
  if (typeof run_log_url !== "string" || run_log_url.length > 10000) {
    return NextResponse.json({ error: "Run log exceeds maximum length" }, { status: 400 });
  }
  if (run_log_url.startsWith("http://") || run_log_url.startsWith("https://")) {
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

  // Check account age gate for reproductions
  const [user] = await sql<[{ is_flagged_new_account: boolean }]>`
    SELECT is_flagged_new_account FROM users WHERE github_id = ${session.user.github_id}
  `;

  if (user?.is_flagged_new_account) {
    return NextResponse.json(
      { error: "Account too new to submit reproductions" },
      { status: 403 }
    );
  }

  const metricName = actual_metric_name?.trim() || null;
  const metricValue = actual_metric_value != null ? Number(actual_metric_value) : null;

  const [row] = await sql<[{ id: number }]>`
    INSERT INTO reproductions (paper_id, user_id, tier_claimed, hardware_spec, run_log_url, notes, actual_metric_name, actual_metric_value)
    VALUES (${paper_id}, ${session.user.github_id}, ${tier_claimed}, ${hardware_spec}, ${run_log_url}, ${notes ?? null}, ${metricName}, ${metricValue})
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
