import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import sql from "@/lib/db";
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
  const session = await getServerSession(authOptions);
  if (!session?.user?.github_id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { paper_id, tier_claimed, hardware_spec, run_log_url, notes } = body;

  if (!paper_id || !tier_claimed || !hardware_spec || !run_log_url) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
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

  const [row] = await sql<[{ id: number }]>`
    INSERT INTO reproductions (paper_id, user_id, tier_claimed, hardware_spec, run_log_url, notes)
    VALUES (${paper_id}, ${session.user.github_id}, ${tier_claimed}, ${hardware_spec}, ${run_log_url}, ${notes ?? null})
    RETURNING id
  `;

  return NextResponse.json({ id: row.id }, { status: 201 });
}
