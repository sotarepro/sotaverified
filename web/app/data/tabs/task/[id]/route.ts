import { getTaskIndex } from "@/lib/queries";
import { buildTabData } from "@/lib/tab-data";
import { STATIC_JSON_HEADERS } from "@/lib/static-json";

export const dynamic = "force-static";
export const revalidate = false;
export const dynamicParams = false;

export async function generateStaticParams() {
  return (await getTaskIndex()).visible.map((id) => ({ id }));
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return Response.json(await buildTabData({ taskId: id }), { headers: STATIC_JSON_HEADERS });
}
