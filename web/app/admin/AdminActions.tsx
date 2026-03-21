"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

interface Props {
  id: number;
}

export default function AdminActions({ id }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function doAction(action: "approve" | "remove") {
    setLoading(true);
    await fetch(`/api/admin/reproductions/${id}`, {
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
        onClick={() => doAction("approve")}
        disabled={loading}
        className="rounded px-3 py-1 text-xs font-medium bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 disabled:opacity-50 transition-colors"
      >
        Approve
      </button>
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
