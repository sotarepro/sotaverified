import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import sql from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

function normalizeArxivId(input: string): string | null {
  const trimmed = input.trim();
  // Handle full URLs like https://arxiv.org/abs/2401.12345
  const urlMatch = trimmed.match(/arxiv\.org\/(?:abs|pdf)\/([0-9]{4}\.[0-9]{4,5}(?:v\d+)?)/i);
  if (urlMatch) return urlMatch[1].replace(/v\d+$/, "");
  // Handle bare IDs like 2401.12345 or 2401.12345v2
  const bareMatch = trimmed.match(/^([0-9]{4}\.[0-9]{4,5})(?:v\d+)?$/);
  if (bareMatch) return bareMatch[1];
  return null;
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.github_id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { arxiv_id_input } = await req.json();
  const arxivId = normalizeArxivId(arxiv_id_input ?? "");

  if (!arxivId) {
    return NextResponse.json({ error: "Invalid arXiv ID" }, { status: 400 });
  }

  // Check if already exists
  const existing = await sql<[{ id: string }?]>`
    SELECT id FROM papers WHERE arxiv_id = ${arxivId} LIMIT 1
  `;

  if (existing.length > 0) {
    return NextResponse.json({ exists: true, paper_id: existing[0]!.id });
  }

  // Fetch from arXiv API
  const apiUrl = `https://export.arxiv.org/api/query?id_list=${arxivId}`;
  let xmlText: string;
  try {
    const apiRes = await fetch(apiUrl, {
      headers: { "User-Agent": "sotaverified/1.0 (https://github.com/sotaverified)" },
    });
    xmlText = await apiRes.text();
  } catch {
    return NextResponse.json({ error: "Failed to reach arXiv API" }, { status: 502 });
  }

  // Simple XML parsing without external deps
  function extractTag(xml: string, tag: string): string | null {
    const match = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i"));
    return match ? match[1].trim() : null;
  }

  function extractAllTags(xml: string, tag: string): string[] {
    const results: string[] = [];
    const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "gi");
    let m;
    while ((m = re.exec(xml)) !== null) {
      results.push(m[1].trim());
    }
    return results;
  }

  // Check entry exists
  if (!xmlText.includes("<entry>")) {
    return NextResponse.json({ error: "Paper not found on arXiv" }, { status: 404 });
  }

  const title = extractTag(xmlText, "title")?.replace(/\s+/g, " ") ?? null;
  const abstract = extractTag(xmlText, "summary")?.replace(/\s+/g, " ") ?? null;
  const publishedRaw = extractTag(xmlText, "published");
  const published = publishedRaw ? publishedRaw.slice(0, 10) : null;

  // Authors: <name> inside <author> tags
  const authorBlocks = extractAllTags(xmlText, "author");
  const authors = authorBlocks
    .map((block) => extractTag(block, "name"))
    .filter(Boolean) as string[];

  if (!title) {
    return NextResponse.json({ error: "Could not parse arXiv response" }, { status: 500 });
  }

  // Build a stable paper ID from arxiv_id
  const paperId = arxivId.replace(".", "");

  const [row] = await sql<[{ id: string }]>`
    INSERT INTO papers (id, arxiv_id, title, abstract, authors, published, url_abs, url_pdf, tasks, methods, verification)
    VALUES (
      ${paperId},
      ${arxivId},
      ${title},
      ${abstract},
      ${authors},
      ${published},
      ${"https://arxiv.org/abs/" + arxivId},
      ${"https://arxiv.org/pdf/" + arxivId},
      '{}',
      '{}',
      'unverified'
    )
    ON CONFLICT (arxiv_id) DO NOTHING
    RETURNING id
  `;

  // If conflict (race condition), return existing
  if (!row) {
    const [ex] = await sql<[{ id: string }]>`
      SELECT id FROM papers WHERE arxiv_id = ${arxivId} LIMIT 1
    `;
    return NextResponse.json({ exists: true, paper_id: ex?.id ?? paperId });
  }

  return NextResponse.json({ created: true, paper_id: row.id }, { status: 201 });
}
