import { createHash } from "crypto";
import sql from "@/lib/db";
import { logEvent } from "@/lib/activity";
import { recomputeVerificationScore } from "@/lib/verification";
import { NextRequest, NextResponse } from "next/server";

function getRepLimit(repScore: number): { count: number; windowSeconds: number } {
  if (repScore >= 200) return { count: 20, windowSeconds: 3600 };   // 20/hour
  if (repScore >= 30)  return { count: 5,  windowSeconds: 3600 };   // 5/hour
  return { count: 1, windowSeconds: 86400 };                        // 1/day
}

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

  // Get user's reputation for rate limiting
  const [userRow] = await sql<[{ reputation_score: number }]>`
    SELECT reputation_score FROM users WHERE github_id = ${userId}
  `;
  const repScore = userRow?.reputation_score ?? 0;
  const { count: limitCount, windowSeconds } = getRepLimit(repScore);

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
