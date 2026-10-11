"use client";

import { useEffect, useState } from "react";

/**
 * Dev/test-tools only. The layout is static (no cookie reads), so the banner asks the server
 * who is being impersonated. `enabled` is false in production: no request is ever made.
 */
export default function ImpersonationBanner({ enabled }: { enabled: boolean }) {
  const [username, setUsername] = useState<string | null>(null);
  useEffect(() => {
    if (!enabled) return;
    fetch("/api/admin/test/impersonate", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { username: null }))
      .then((d: { username: string | null }) => setUsername(d.username))
      .catch(() => {});
  }, [enabled]);
  if (!username) return null;
  return <Banner username={username} />;
}

function Banner({ username }: { username: string }) {
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
