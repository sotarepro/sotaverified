"use client";

import { useRouter } from "next/navigation";

export function SignupAction({ id, action }: { id: number; action: "approve" | "reject" }) {
  const router = useRouter();

  async function handle() {
    await fetch("/api/admin/signups", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, action }),
    });
    router.refresh();
  }

  return (
    <button
      onClick={handle}
      className={`text-xs rounded px-2 py-1 font-medium transition-colors ${
        action === "approve"
          ? "bg-green-50 text-green-700 hover:bg-green-100"
          : "bg-gray-50 text-gray-600 hover:bg-gray-100"
      }`}
    >
      {action === "approve" ? "Approve" : "Reject"}
    </button>
  );
}

export function ClearAllSignups() {
  const router = useRouter();

  async function handle() {
    if (!confirm("Reject all pending sign-up requests?")) return;
    await fetch("/api/admin/signups", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "clear_all" }),
    });
    router.refresh();
  }

  return (
    <button
      onClick={handle}
      className="text-xs text-gray-500 hover:text-gray-700 underline mt-2"
    >
      Clear all pending
    </button>
  );
}
