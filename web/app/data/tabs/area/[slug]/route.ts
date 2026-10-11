import { notFound } from "next/navigation";
import { areaFromSlug, areaSlug, assertKnownAreas } from "@/lib/areas";
import { getAreaSummaries } from "@/lib/queries";
import { buildTabData } from "@/lib/tab-data";
import { STATIC_JSON_HEADERS } from "@/lib/static-json";

export const dynamic = "force-static";
export const revalidate = false;
// Anything not generated at build 404s without running code or touching the DB.
export const dynamicParams = false;

export async function generateStaticParams() {
  const areas = (await getAreaSummaries()).map((a) => a.area);
  assertKnownAreas(areas);
  return areas.map((a) => ({ slug: areaSlug(a) }));
}

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const area = areaFromSlug((await params).slug);
  if (!area) notFound();
  return Response.json(await buildTabData({ area }), { headers: STATIC_JSON_HEADERS });
}
