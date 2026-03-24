import sql from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const type = req.nextUrl.searchParams.get("type");
  const q = req.nextUrl.searchParams.get("q");

  if (!type) {
    return NextResponse.json([]);
  }

  // When q is empty or too short, return popular defaults
  const isSearch = q && q.length >= 2;

  if (type === "tasks") {
    const rows = isSearch
      ? await sql<{ id: string; name: string }[]>`
          SELECT id, name FROM tasks
          WHERE name ILIKE ${"%" + q + "%"}
          ORDER BY result_count DESC, paper_count DESC
          LIMIT 15
        `
      : await sql<{ id: string; name: string }[]>`
          SELECT id, name FROM tasks
          ORDER BY result_count DESC, paper_count DESC
          LIMIT 10
        `;
    return NextResponse.json(rows);
  }

  if (type === "datasets") {
    const rows = isSearch
      ? await sql<{ id: string; name: string }[]>`
          SELECT id, name FROM datasets
          WHERE name ILIKE ${"%" + q + "%"}
          ORDER BY name
          LIMIT 15
        `
      : await sql<{ id: string; name: string }[]>`
          SELECT d.id, d.name FROM datasets d
          JOIN (
            SELECT dataset_id, COUNT(*) AS cnt FROM leaderboard_results
            GROUP BY dataset_id
          ) lr ON lr.dataset_id = d.id
          ORDER BY lr.cnt DESC
          LIMIT 10
        `;
    return NextResponse.json(rows);
  }

  return NextResponse.json([]);
}
