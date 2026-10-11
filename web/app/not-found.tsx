import MaintenanceNotice from "@/components/MaintenanceNotice";

export const metadata = { title: "Not in the current catalog — SOTAVerified" };

// Rendered for every notFound(): dropped papers, unknown tasks/profiles, bad URLs.
export default function NotFound() {
  return (
    <MaintenanceNotice
      heading="Not in the current catalog"
      lead="We couldn't find that page. If it's a paper, it may have been archived when the catalog was trimmed."
    />
  );
}
