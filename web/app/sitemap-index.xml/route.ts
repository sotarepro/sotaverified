import { getSitemapPaperCount } from "@/lib/queries";

export const revalidate = 86400; // 24h — matches app/sitemap.ts chunk revalidation

const PAPER_CHUNK_SIZE = 50000;
const BASE_URL = (process.env.NEXTAUTH_URL ?? "http://localhost:3000").replace(/\/$/, "");

// generateSitemaps() in app/sitemap.ts only serves individual chunks at
// /sitemap/[id].xml — Next.js does not auto-generate an index file. This
// route is the actual entry point crawlers/robots.txt should reference.
export async function GET() {
  let paperCount = 0;
  try {
    paperCount = await getSitemapPaperCount();
  } catch (err) {
    // DB unavailable at build/revalidate time (e.g. transient Railway restart)
    // shouldn't fail the whole site build — degrade to static-pages-only
    // chunk for this cycle; next 24h revalidation will retry.
    console.error("sitemap-index: getSitemapPaperCount failed, falling back to chunk 0 only", err);
  }
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
