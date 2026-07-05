import type { MetadataRoute } from "next";
import {
  getSitemapPaperCount,
  getSitemapPaperChunk,
  getSitemapTaskIds,
  getAreaSummaries,
} from "@/lib/queries";
import { getAllPosts } from "@/lib/blog";

export const revalidate = 86400; // 24h — crawler re-fetches shouldn't hit the DB every time

const PAPER_CHUNK_SIZE = 50000;
const BASE_URL = (process.env.NEXTAUTH_URL ?? "http://localhost:3000").replace(/\/$/, "");

// id 0 = static/task/area/blog entries (small, well under the 50k limit).
// id 1..N = paper chunks of PAPER_CHUNK_SIZE each.
export async function generateSitemaps() {
  let paperCount = 0;
  try {
    paperCount = await getSitemapPaperCount();
  } catch (err) {
    // DB unavailable at build/revalidate time (e.g. transient Railway restart)
    // shouldn't fail the whole site build — degrade to static-pages-only
    // chunk for this cycle; next 24h revalidation will retry.
    console.error("sitemap: getSitemapPaperCount failed, falling back to chunk 0 only", err);
  }
  const paperChunks = Math.ceil(paperCount / PAPER_CHUNK_SIZE);
  return Array.from({ length: paperChunks + 1 }, (_, i) => ({ id: i }));
}

export default async function sitemap({
  id,
}: {
  id: Promise<string>;
}): Promise<MetadataRoute.Sitemap> {
  const chunkId = Number(await id);

  if (chunkId === 0) return getStaticEntries();

  const offset = (chunkId - 1) * PAPER_CHUNK_SIZE;
  try {
    const papers = await getSitemapPaperChunk(offset, PAPER_CHUNK_SIZE);
    return papers.map((p) => ({
      url: `${BASE_URL}/papers/${p.id}`,
      lastModified: p.updated_at,
    }));
  } catch (err) {
    // DB unavailable at build/revalidate time — degrade to an empty chunk
    // rather than failing the whole build; next 24h revalidation retries.
    console.error(`sitemap: getSitemapPaperChunk failed for chunk ${chunkId}`, err);
    return [];
  }
}

async function getStaticEntries(): Promise<MetadataRoute.Sitemap> {
  let areas: Awaited<ReturnType<typeof getAreaSummaries>> = [];
  let tasks: Awaited<ReturnType<typeof getSitemapTaskIds>> = [];
  const posts = getAllPosts();
  try {
    [areas, tasks] = await Promise.all([getAreaSummaries(), getSitemapTaskIds()]);
  } catch (err) {
    // DB unavailable at build/revalidate time — degrade to static-only pages
    // (nav/about/blog) rather than failing the whole build.
    console.error("sitemap: getStaticEntries DB queries failed, falling back to static-only pages", err);
  }

  const staticPages: MetadataRoute.Sitemap = [
    { url: BASE_URL, changeFrequency: "daily", priority: 1 },
    { url: `${BASE_URL}/about`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${BASE_URL}/agents`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${BASE_URL}/leaderboard`, changeFrequency: "daily", priority: 0.6 },
    { url: `${BASE_URL}/tasks`, changeFrequency: "weekly", priority: 0.6 },
    { url: `${BASE_URL}/blog`, changeFrequency: "weekly", priority: 0.5 },
  ];

  const areaPages: MetadataRoute.Sitemap = areas.map((a) => ({
    url: `${BASE_URL}/tasks?area=${encodeURIComponent(a.area)}`,
    changeFrequency: "weekly",
    priority: 0.5,
  }));

  const taskPages: MetadataRoute.Sitemap = tasks.map((t) => ({
    url: `${BASE_URL}/tasks/${t.id}`,
    changeFrequency: "weekly",
    priority: 0.4,
  }));

  const blogPages: MetadataRoute.Sitemap = posts.map((p) => ({
    url: `${BASE_URL}/blog/${p.slug}`,
    lastModified: p.date ? new Date(p.date) : undefined,
    changeFrequency: "monthly",
    priority: 0.3,
  }));

  return [...staticPages, ...areaPages, ...taskPages, ...blogPages];
}
