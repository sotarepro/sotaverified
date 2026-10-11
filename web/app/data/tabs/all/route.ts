import { buildTabData } from "@/lib/tab-data";
import { STATIC_JSON_HEADERS } from "@/lib/static-json";

export const dynamic = "force-static";
export const revalidate = false;

export async function GET() {
  return Response.json(await buildTabData(), { headers: STATIC_JSON_HEADERS });
}
