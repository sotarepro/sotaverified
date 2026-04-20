"use client";

import { usePaperState } from "@/lib/use-paper-state";

interface Props {
  paperId: string;
}

/**
 * Renders the CTA banner for papers with badge=author_verified and reproduction_count=0.
 * Shows different copy depending on whether the current user is the verified author.
 */
export default function AuthorVerifiedCTA({ paperId }: Props) {
  const { state } = usePaperState(paperId);
  const isVerifiedAuthor = state?.claim?.status === "verified";

  if (isVerifiedAuthor) {
    return (
      <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 mb-6 flex items-center justify-between gap-4">
        <p className="text-sm text-green-800">
          <span className="font-semibold">Author Verified</span> — Submit benchmark results to add your metrics to the leaderboard.
        </p>
        <a
          href="#author-benchmarks"
          className="shrink-0 rounded-lg bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700 transition-colors"
        >
          Submit Benchmark
        </a>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 mb-6 flex items-center justify-between gap-4">
      <p className="text-sm text-blue-800">
        <span className="font-semibold">Author Verified</span> — Help verify by reproducing this paper.
      </p>
      <a
        href="#reproduce"
        className="shrink-0 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
      >
        Reproduce
      </a>
    </div>
  );
}
