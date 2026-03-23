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

  const isLoggedIn = status === "authenticated" && !!session?.user?.github_id;

  async function handleClaim() {
    if (!isLoggedIn) return;
    setLoading(true);
    setMessage(null);
    try {
      const resp = await fetch(`/api/papers/${paperId}/claim-author`, {
        method: "POST",
      });
      const data = (await resp.json()) as { status: string; message: string };

      if (data.status === "verified") {
        setClaim({ status: "verified" });
        router.refresh();
      } else if (data.status === "pending") {
        setClaim({ status: "pending_admin" });
        setMessage(data.message);
        setMessageType("info");
      } else if (data.status === "not_contributor" || data.status === "no_repo" || data.status === "check_failed") {
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

  // Already verified — show badge
  if (claim?.status === "verified") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-lg border border-green-300 bg-green-50 px-3 py-1.5 text-sm text-green-800 font-medium">
        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414L8.414 14l-4.121-4.121a1 1 0 011.414-1.414L8.414 11.172l7.879-7.879a1 1 0 011.414 0z" clipRule="evenodd" />
        </svg>
        Verified Author via GitHub
      </span>
    );
  }

  if (claim?.status === "pending_admin") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-sm text-amber-800 font-medium">
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        Author claim pending review
      </span>
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
    <div className="flex flex-col gap-2">
      <button
        onClick={handleClaim}
        disabled={loading}
        className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? (
          <>
            <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Checking GitHub contributors...
          </>
        ) : (
          <>
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            I authored this paper
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
