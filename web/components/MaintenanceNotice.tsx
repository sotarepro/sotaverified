import Link from "next/link";
import { GITHUB_URL, SUBSTACK_URL, CATALOG_SNAPSHOT_DATE } from "@/lib/site";

/** Shared body for /maintenance and the styled 404 (dropped catalog entries). */
export default function MaintenanceNotice({ heading, lead }: { heading: string; lead: string }) {
  return (
    <div className="max-w-2xl" data-testid="maintenance-notice">
      <h1 className="text-2xl font-bold tracking-tight mb-3">{heading}</h1>
      <p className="text-gray-600 text-sm leading-relaxed mb-4">{lead}</p>
      <p className="text-gray-600 text-sm leading-relaxed mb-4">
        SOTAVerified is in <span className="font-medium text-gray-800">maintenance mode</span>. The full
        catalog (about half a million papers) is archived; this site serves a curated snapshot of the
        most-hyped papers and everything with community activity, as of {CATALOG_SNAPSHOT_DATE}.
        It is still open: you can sign in with GitHub, hype papers, submit reproductions and claim
        authorship on any listed paper.
      </p>
      <div className="flex flex-wrap gap-3 mt-6 text-sm">
        <Link href="/" className="rounded-lg bg-gray-900 text-white px-4 py-2 hover:bg-gray-700 transition-colors">
          Browse listed papers
        </Link>
        <a
          href={GITHUB_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-lg border border-gray-300 px-4 py-2 hover:bg-gray-50 transition-colors"
        >
          GitHub
        </a>
        {SUBSTACK_URL && (
          <a
            href={SUBSTACK_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg border border-gray-300 px-4 py-2 hover:bg-gray-50 transition-colors"
          >
            Substack
          </a>
        )}
      </div>
    </div>
  );
}
