import { notFound } from "next/navigation";
import TasksView from "@/components/TasksView";
import { AREAS, areaFromSlug, areaSlug } from "@/lib/areas";

// Internal route behind the `/tasks?area=X` rewrite (the browser URL stays /tasks?area=X).
export const dynamic = "force-static";
export const revalidate = false;
export const dynamicParams = false;

export function generateStaticParams() {
  return AREAS.map((a) => ({ slug: areaSlug(a) }));
}

export default async function AreaPage({ params }: { params: Promise<{ slug: string }> }) {
  const area = areaFromSlug((await params).slug);
  if (!area) notFound();
  return <TasksView area={area} />;
}
