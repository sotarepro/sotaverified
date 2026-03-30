import sql from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const search = req.nextUrl.searchParams.get("search")?.trim();
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
