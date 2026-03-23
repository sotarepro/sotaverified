import sql from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const type = req.nextUrl.searchParams.get("type");
  const q = req.nextUrl.searchParams.get("q");

  if (!type || !q || q.length < 2) {
    return NextResponse.json([]);
  }

  if (type === "tasks") {
    const rows = await sql<{ id: string; name: string }[]>`
      SELECT id, name FROM tasks
      WHERE name ILIKE ${"%" + q + "%"}
      ORDER BY result_count DESC, paper_count DESC
      LIMIT 15
    `;
    return NextResponse.json(rows);
  }

  if (type === "datasets") {
    const rows = await sql<{ id: string; name: string }[]>`
      SELECT id, name FROM datasets
      WHERE name ILIKE ${"%" + q + "%"}
      ORDER BY name
      LIMIT 15
    `;
    return NextResponse.json(rows);
  }

  return NextResponse.json([]);
}
