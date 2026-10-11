import TasksView from "@/components/TasksView";

// Static shell (no searchParams): the HTML is the "All Tasks" first page. Paging is client-side
// over /data/tasks/all. `/tasks?area=X` never reaches this page: next.config rewrites it to
// the static /browse/area/<slug> page (correct first paint for each research area).
export const dynamic = "force-static";
export const revalidate = false;

export default function TasksPage() {
  return <TasksView />;
}
