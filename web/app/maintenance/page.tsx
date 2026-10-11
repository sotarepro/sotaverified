import MaintenanceNotice from "@/components/MaintenanceNotice";

export const metadata = { title: "Maintenance — SOTAVerified" };
export const dynamic = "force-static";

export default function MaintenancePage() {
  return (
    <MaintenanceNotice
      heading="Maintenance mode"
      lead="The page you were looking for isn't part of the current catalog snapshot."
    />
  );
}
