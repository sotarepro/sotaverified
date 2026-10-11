import Link from "next/link";
import { CATALOG_SNAPSHOT_DATE } from "@/lib/site";

export default function MaintenanceBanner() {
  return (
    <div
      data-testid="maintenance-banner"
      className="bg-amber-50 border-b border-amber-200 text-amber-900 text-xs text-center px-4 py-1.5"
    >
      SOTAVerified is in maintenance mode — catalog snapshot as of {CATALOG_SNAPSHOT_DATE}.{" "}
      <Link href="/maintenance" className="underline hover:text-amber-700">
        Details
      </Link>
    </div>
  );
}
