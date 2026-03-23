import { createHash } from "crypto";
import sql from "@/lib/db";
import { logEvent } from "@/lib/activity";
import { recomputeVerificationScore } from "@/lib/verification";
import { NextRequest, NextResponse } from "next/server";

// Flat rate limit: 2 submissions per day per API key
const RATE_LIMIT = { count: 2, windowSeconds: 86400 };

export async function POST(req: NextRequest) {
  // Auth: check Authorization: Bearer <key> header
  const authHeader = req.headers.get("authorization") ?? "";
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    return NextResponse.json({ error: "Missing or invalid Authorization header" }, { status: 401 });
  }

  const apiKey = match[1].trim();
  const keyHash = createHash("sha256").update(apiKey).digest("hex");

  const keyRows = await sql<{ user_id: string }[]>`
    SELECT user_id FROM api_keys WHERE key_hash = ${keyHash}
  `;
  if (keyRows.length === 0) {
    return NextResponse.json({ error: "Invalid API key" }, { status: 401 });
  }
  const userId = keyRows[0].user_id;

  const { count: limitCount, windowSeconds } = RATE_LIMIT;

  // Check rate limit using activity_log
  const windowStart = new Date(Date.now() - windowSeconds * 1000).toISOString();
  const [{ recent_count }] = await sql<[{ recent_count: number }]>`
    SELECT COUNT(*)::int AS recent_count
    FROM activity_log
    WHERE event_type = 'agent_reproduction_submitted'
      AND user_id = ${userId}
      AND created_at > ${windowStart}
  `;

  if (recent_count >= limitCount) {
    await logEvent("rate_limit_hit", { userId, metadata: { limit: limitCount, window_seconds: windowSeconds } });
    return NextResponse.json(
      { error: "Rate limit exceeded", limit: limitCount, window_seconds: windowSeconds },
      { status: 429 }
    );
  }

  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { arxiv_id, tier_claimed, hardware_spec, run_log_url, notes, actual_metric_name, actual_metric_value } = body;

  if (!arxiv_id || !tier_claimed || !hardware_spec || !run_log_url) {
    return NextResponse.json({ error: "Missing required fields: arxiv_id, tier_claimed, hardware_spec, run_log_url" }, { status: 400 });
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

  // Look up paper by arxiv_id
  const paperRows = await sql<{ id: string }[]>`
    SELECT id FROM papers WHERE arxiv_id = ${arxiv_id} LIMIT 1
  `;
  if (paperRows.length === 0) {
    return NextResponse.json({ error: "Paper not found for arxiv_id: " + arxiv_id }, { status: 404 });
  }
  const paperId = paperRows[0].id;

  const metricName = actual_metric_name?.trim() || null;
  const metricValue = actual_metric_value != null ? Number(actual_metric_value) : null;
  if (metricValue !== null && !isFinite(metricValue)) {
    return NextResponse.json({ error: "actual_metric_value must be a finite number" }, { status: 400 });
  }

  const [row] = await sql<[{ id: number }]>`
    INSERT INTO reproductions
      (paper_id, user_id, tier_claimed, hardware_spec, run_log_url, notes,
       actual_metric_name, actual_metric_value, source, status)
    VALUES
      (${paperId}, ${userId}, ${tier_claimed}, ${hardware_spec}, ${run_log_url},
       ${notes ?? null}, ${metricName}, ${metricValue}, 'api', 'agent_pending')
    RETURNING id
  `;

  await recomputeVerificationScore(paperId);

  await logEvent("agent_reproduction_submitted", {
    userId,
    paperId,
    metadata: { tier_claimed, hardware_spec: String(hardware_spec).substring(0, 100) },
  });

  return NextResponse.json({ id: row.id, status: "agent_pending" }, { status: 201 });
}
