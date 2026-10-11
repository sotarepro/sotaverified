"use client";

// Runtime error boundary. When the free database compute is exhausted or asleep and a
// page isn't in the cache, show a friendly message instead of a stack trace.
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="max-w-2xl" data-testid="temporarily-unavailable">
      <h1 className="text-2xl font-bold tracking-tight mb-3">Temporarily unavailable</h1>
      <p className="text-gray-600 text-sm leading-relaxed mb-4">
        SOTAVerified is in maintenance mode and the database is currently unreachable (it may be
        waking up or over its free quota). Pages you&apos;ve already loaded keep working; please
        try again in a few minutes.
      </p>
      <button
        onClick={reset}
        className="rounded-lg border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50 transition-colors"
      >
        Try again
      </button>
    </div>
  );
}
