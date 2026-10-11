import { notFound } from "next/navigation";
import { AREAS, areaFromSlug, areaSlug } from "@/lib/areas";
import { buildTaskList } from "@/lib/tab-data";
import { STATIC_JSON_HEADERS } from "@/lib/static-json";

export const dynamic = "force-static";
export const revalidate = false;
export const dynamicParams = false;

export function generateStaticParams() {
  return AREAS.map((a) => ({ slug: areaSlug(a) }));
}

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const area = areaFromSlug((await params).slug);
  if (!area) notFound();
  return Response.json(await buildTaskList(area), { headers: STATIC_JSON_HEADERS });
}
