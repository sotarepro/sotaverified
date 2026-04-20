"use client";

import { useState } from "react";
import { usePaperState } from "@/lib/use-paper-state";
import ReproductionForm, { type BenchmarkOption } from "./ReproductionForm";
import AuthorBenchmarkForm from "./AuthorBenchmarkForm";
import ReproductionList from "./ReproductionList";

interface Props {
  paperId: string;
  benchmarks: BenchmarkOption[];
  hasCodeRepo: boolean;
  paperTasks: string[];
}

/**
 * Renders the Reproductions + Author Benchmarks sections with gating:
 *   - Verified authors see AuthorBenchmarkForm but NOT ReproductionForm
 *   - Everyone else sees ReproductionForm
 * ReproductionList is always shown.
 */
export default function PaperReproSection({ paperId, benchmarks, hasCodeRepo, paperTasks }: Props) {
  const { state } = usePaperState(paperId);
  const isVerifiedAuthor = state?.claim?.status === "verified";
  const [reproVersion, setReproVersion] = useState(0);

  return (
    <>
      {isVerifiedAuthor && (
        <section id="author-benchmarks" className="mb-8 scroll-mt-16">
          <AuthorBenchmarkForm paperId={paperId} paperTasks={paperTasks} />
        </section>
      )}

      <section id="reproduce" className="mb-8">
        <h2 className="text-base font-semibold mb-3">Reproductions</h2>
        {!isVerifiedAuthor && (
          <ReproductionForm
            paperId={paperId}
            benchmarks={benchmarks}
            hasCodeRepo={hasCodeRepo}
            paperTasks={paperTasks}
            onSubmitted={() => setReproVersion((v) => v + 1)}
          />
        )}
        <ReproductionList paperId={paperId} key={reproVersion} />
      </section>
    </>
  );
}
