"use client";

import { useState } from "react";

// ── Create User ───────────────────────────────────────────────────────────────

type Preset = "test_user" | "author";
const PRESETS: { value: Preset; label: string; desc: string }[] = [
  { value: "test_user", label: "Test User", desc: "rep 0, age 90 days" },
  { value: "author", label: "Test Author", desc: "rep 10, age 3 years" },
];

export function CreateUserButtons() {
  const [loading, setLoading] = useState<Preset | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function create(preset: Preset) {
    setLoading(preset);
    setError(null);
    const res = await fetch("/api/admin/test/users", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ preset }),
    });
    setLoading(null);
    if (!res.ok) {
      setError("Failed to create user");
      return;
    }
    window.location.reload();
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-2">
        {PRESETS.map((p) => (
          <button
            key={p.value}
            onClick={() => create(p.value)}
            disabled={loading === p.value}
            className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            {loading === p.value ? "Creating…" : `+ ${p.label}`}
            <span className="ml-1.5 text-gray-400">{p.desc}</span>
          </button>
        ))}
      </div>
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  );
}

// ── Impersonate Button ────────────────────────────────────────────────────────

export function ImpersonateButton({ githubId }: { githubId: string }) {
  const [loading, setLoading] = useState(false);

  async function impersonate() {
    setLoading(true);
    const res = await fetch("/api/admin/test/impersonate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ github_id: githubId }),
    });
    if (res.ok) {
      window.location.href = "/";
    } else {
      setLoading(false);
      alert("Failed to impersonate user");
    }
  }

  return (
    <button
      onClick={impersonate}
      disabled={loading}
      className="rounded px-2 py-1 text-xs border border-indigo-300 text-indigo-700 bg-indigo-50 hover:bg-indigo-100 disabled:opacity-50 transition-colors"
    >
      {loading ? "…" : "Impersonate →"}
    </button>
  );
}

// ── Create Paper ──────────────────────────────────────────────────────────────

export function CreatePaperButtons() {
  const [loading, setLoading] = useState<string | null>(null);
  const [repoUrl, setRepoUrl] = useState("https://github.com/sotarepro/sotaverified");
  const [error, setError] = useState<string | null>(null);

  async function create(preset: string) {
    setLoading(preset);
    setError(null);
    const res = await fetch("/api/admin/test/papers", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        preset,
        repo_url: preset === "full" ? repoUrl : undefined,
      }),
    });
    setLoading(null);
    if (!res.ok) {
      setError("Failed to create paper");
      return;
    }
    window.location.reload();
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <button
          onClick={() => create("basic")}
          disabled={loading === "basic"}
          className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium hover:bg-gray-50 disabled:opacity-50 transition-colors"
        >
          {loading === "basic" ? "Creating…" : "+ Basic Test Paper"}
          <span className="ml-1.5 text-gray-400">no code link</span>
        </button>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={() => create("full")}
          disabled={loading === "full"}
          className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium hover:bg-gray-50 disabled:opacity-50 transition-colors whitespace-nowrap"
        >
          {loading === "full" ? "Creating…" : "+ Full Test Paper"}
          <span className="ml-1.5 text-gray-400">with code link</span>
        </button>
        <input
          type="text"
          value={repoUrl}
          onChange={(e) => setRepoUrl(e.target.value)}
          placeholder="https://github.com/owner/repo"
          className="flex-1 min-w-[260px] rounded border border-gray-200 px-2 py-1 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-blue-400"
        />
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

// ── Reset Button with Confirmation ───────────────────────────────────────────

export function ResetButton() {
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);

  async function doReset() {
    setLoading(true);
    const res = await fetch("/api/admin/test/reset", { method: "POST" });
    setLoading(false);
    setConfirming(false);
    if (res.ok) {
      window.location.reload();
    } else {
      alert("Reset failed");
    }
  }

  if (confirming) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs text-red-700 font-medium">
          Delete ALL test users, papers, reproductions, and activity logs?
        </span>
        <button
          onClick={doReset}
          disabled={loading}
          className="rounded px-3 py-1 text-xs bg-red-600 text-white font-medium hover:bg-red-700 disabled:opacity-50 transition-colors"
        >
          {loading ? "Resetting…" : "Yes, reset"}
        </button>
        <button
          onClick={() => setConfirming(false)}
          className="rounded px-3 py-1 text-xs border border-gray-300 hover:bg-gray-50 transition-colors"
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      className="rounded px-3 py-1 text-xs border border-red-300 text-red-700 hover:bg-red-50 transition-colors"
    >
      Reset Test Data
    </button>
  );
}
