import { getEffectiveSession } from "@/lib/effective-session";
import sql from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const paperId = req.nextUrl.searchParams.get("paper_id");
  if (!paperId) {
    return NextResponse.json({ error: "paper_id required" }, { status: 400 });
  }

  const session = await getEffectiveSession();
  const userId = session?.user?.github_id ?? null;

  if (!userId) {
    return NextResponse.json({
      logged_in: false,
      upvoted: false,
      claim: null,
    });
  }

  const [upvotedRow, claimRow] = await Promise.all([
    sql<{ e: boolean }[]>`
      SELECT EXISTS(SELECT 1 FROM upvotes WHERE paper_id = ${paperId} AND user_id = ${userId}) AS e
    `,
    sql<{ status: string }[]>`
      SELECT status FROM paper_authors WHERE paper_id = ${paperId} AND user_id = ${userId}
    `,
  ]);

  return NextResponse.json({
    logged_in: true,
    upvoted: upvotedRow[0]?.e ?? false,
    claim: claimRow[0] ?? null,
  });
}
