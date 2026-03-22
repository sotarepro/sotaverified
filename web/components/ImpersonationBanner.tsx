"use client";

export default function ImpersonationBanner({ username }: { username: string }) {
  async function handleExit() {
    await fetch("/api/admin/test/impersonate", { method: "DELETE" });
    window.location.href = "/admin";
  }

  return (
    <div className="bg-amber-400 text-amber-900 px-4 py-2 text-sm flex items-center justify-between">
      <span>
        <strong>Dev mode:</strong> Impersonating <strong>@{username}</strong> — all actions are logged as this user
      </span>
      <button
        onClick={handleExit}
        className="ml-4 underline font-semibold hover:text-amber-700"
      >
        Exit impersonation →
      </button>
    </div>
  );
}
