"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

interface Props {
  paperId: string;
  initialClaim: { status: string } | null;
}

export default function AuthorClaimButton({ paperId, initialClaim }: Props) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [claim, setClaim] = useState<{ status: string } | null>(initialClaim);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [messageType, setMessageType] = useState<"info" | "error">("info");
  const [repoUrl, setRepoUrl] = useState("");
  const [showRepoForm, setShowRepoForm] = useState(false);
  const [addingRepo, setAddingRepo] = useState(false);

  const isLoggedIn = status === "authenticated" && !!session?.user?.github_id;

  async function handleClaim() {
    if (!isLoggedIn) return;
    setLoading(true);
    setMessage(null);

    try {
      const resp = await fetch(`/api/papers/${paperId}/claim-author`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = (await resp.json()) as { status: string; message: string; error?: string };

      if (!resp.ok) {
        setMessage(data.error ?? data.message ?? "Claim failed");
        setMessageType("error");
      } else if (data.status === "verified") {
        setClaim({ status: "verified" });
        router.refresh();
      } else {
        setMessage(data.message);
        setMessageType("error");
      }
    } catch {
      setMessage("Something went wrong. Please try again.");
      setMessageType("error");
    } finally {
      setLoading(false);
    }
  }

  async function handleAddRepo() {
    const trimmed = repoUrl.trim();
    if (!trimmed) return;
    setAddingRepo(true);
    setMessage(null);
    try {
      const resp = await fetch(`/api/papers/${paperId}/add-code-link`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repo_url: trimmed }),
      });
      const data = await resp.json();
      if (resp.ok) {
        setRepoUrl("");
        setShowRepoForm(false);
        router.refresh();
      } else {
        setMessage(data.error ?? "Failed to add repository");
        setMessageType("error");
      }
    } catch {
      setMessage("Something went wrong. Please try again.");
      setMessageType("error");
    } finally {
      setAddingRepo(false);
    }
  }

  // Already verified — show badge + optional "add repo" form
  if (claim?.status === "verified") {
    return (
      <div className="space-y-2">
        <span className="inline-flex items-center gap-1.5 rounded-lg border border-green-300 bg-green-50 px-3 py-1.5 text-sm text-green-800 font-medium">
          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414L8.414 14l-4.121-4.121a1 1 0 011.414-1.414L8.414 11.172l7.879-7.879a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
          Verified Author
        </span>

        {/* Add repo link — for verified authors */}
        {!showRepoForm ? (
          <button
            onClick={() => setShowRepoForm(true)}
            className="block text-xs text-blue-600 hover:underline"
          >
            + Add repository
          </button>
        ) : (
          <div className="flex gap-2 items-start">
            <input
              type="url"
              value={repoUrl}
              onChange={(e) => setRepoUrl(e.target.value)}
              placeholder="https://github.com/your-org/your-repo"
              className="flex-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={handleAddRepo}
              disabled={addingRepo || !repoUrl.trim()}
              className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors shrink-0"
            >
              {addingRepo ? "Adding..." : "Add"}
            </button>
            <button
              onClick={() => { setShowRepoForm(false); setRepoUrl(""); }}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50 transition-colors shrink-0"
            >
              Cancel
            </button>
          </div>
        )}

        {message && (
          <p className={`text-xs rounded-lg px-3 py-2 ${
            messageType === "error"
              ? "bg-amber-50 text-amber-800 border border-amber-200"
              : "text-gray-500"
          }`}>
            {message}
          </p>
        )}
      </div>
    );
  }

  if (claim?.status === "rejected") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-gray-50 px-3 py-1.5 text-sm text-gray-600">
        Authorship claim rejected
      </span>
    );
  }

  if (!isLoggedIn) {
    return (
      <button
        disabled
        className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm text-gray-400 cursor-not-allowed"
        title="Sign in to claim authorship"
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
        Sign in to claim authorship
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <button
        onClick={handleClaim}
        disabled={loading}
        className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed w-fit"
      >
        {loading ? (
          <>
            <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Verifying...
          </>
        ) : (
          <>
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            <span data-testid="author-claim-btn">I authored this paper</span>
          </>
        )}
      </button>
      {message && (
        <p className={`text-xs leading-relaxed rounded-lg px-3 py-2 ${
          messageType === "error"
            ? "bg-amber-50 text-amber-800 border border-amber-200"
            : "text-gray-500"
        }`}>
          {message}
        </p>
      )}
    </div>
  );
}
