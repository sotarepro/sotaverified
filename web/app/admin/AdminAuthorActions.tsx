"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

interface Props {
  paperId: string;
  userId: string;
}

export default function AdminAuthorActions({ paperId, userId }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function doAction(action: "approve" | "reject" | "remove") {
    setLoading(true);
    await fetch(`/api/admin/paper-authors/${paperId}/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    setLoading(false);
    router.refresh();
  }

  return (
    <div className="flex gap-2 shrink-0">
      <button
        onClick={() => doAction("remove")}
        disabled={loading}
        className="rounded px-3 py-1 text-xs font-medium bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 disabled:opacity-50 transition-colors"
      >
        Remove
      </button>
    </div>
  );
}
