import { withDbGuard } from "@/lib/api-guard";
import { getEffectiveSession } from "@/lib/effective-session";
import sql from "@/lib/db";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Paper ids the signed-in user has hyped. Only ever called by signed-in clients. */
async function GETHandler() {
  const session = await getEffectiveSession();
  const userId = session?.user?.github_id ?? null;
  if (!userId) return NextResponse.json({ ids: [] }, { headers: { "Cache-Control": "private, no-store" } });
  const rows = await sql<{ paper_id: string }[]>`
    SELECT paper_id FROM upvotes WHERE user_id = ${userId} LIMIT 5000
  `;
  return NextResponse.json(
    { ids: rows.map((r) => r.paper_id) },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}

export const GET = withDbGuard(GETHandler);
