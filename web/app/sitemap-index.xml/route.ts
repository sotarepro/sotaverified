import { getSitemapPaperCount } from "@/lib/queries";

// Built once at build time (static): crawler fetches never reach the DB, and an unreachable
// DB fails the build instead of shipping a degraded index.
export const dynamic = "force-static";
export const revalidate = false;

const PAPER_CHUNK_SIZE = 50000;
const BASE_URL = (process.env.NEXTAUTH_URL ?? "http://localhost:3000").replace(/\/$/, "");

// generateSitemaps() in app/sitemap.ts only serves individual chunks at
// /sitemap/[id].xml — Next.js does not auto-generate an index file. This
// route is the actual entry point crawlers/robots.txt should reference.
export async function GET() {
  const paperCount = await getSitemapPaperCount();
  const paperChunks = Math.ceil(paperCount / PAPER_CHUNK_SIZE);
  const chunkIds = Array.from({ length: paperChunks + 1 }, (_, i) => i);

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${chunkIds.map((id) => `<sitemap><loc>${BASE_URL}/sitemap/${id}.xml</loc></sitemap>`).join("\n")}
</sitemapindex>`;

  return new Response(body, {
    headers: { "Content-Type": "application/xml" },
  });
}
