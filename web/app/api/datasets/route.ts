import { getEffectiveSession } from "@/lib/effective-session";
import { withDbGuard } from "@/lib/api-guard";
import sql from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

async function GETHandler(req: NextRequest) {
  // Form helper: only signed-in users (JWT, no DB) get to query, so anonymous scrapers can't wake the DB.
  const session = await getEffectiveSession();
  if (!session?.user?.github_id) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  const search = req.nextUrl.searchParams.get("search")?.trim().slice(0, 100);
  if (!search || search.length < 2) {
    return NextResponse.json([]);
  }

  const rows = await sql<{ id: string; name: string }[]>`
    SELECT id, name FROM datasets
    WHERE name ILIKE ${"%" + search + "%"}
    ORDER BY
      CASE WHEN name ILIKE ${search + "%"} THEN 0 ELSE 1 END,
      name
    LIMIT 20
  `;

  return NextResponse.json(rows);
}

export const GET = withDbGuard(GETHandler);
