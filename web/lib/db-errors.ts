// Kept separate from db.ts so it can be imported (and tested) without opening a connection pool.
/** True for errors that mean "the database is unreachable / unavailable right now". */
export function isDbUnavailable(err: unknown): boolean {
  const e = err as { code?: string; errno?: string; message?: string } | null;
  if (!e) return false;
  const code = e.code ?? e.errno ?? "";
  return (
    [
      "ECONNREFUSED", "ECONNRESET", "ETIMEDOUT", "ENOTFOUND", "EAI_AGAIN", "EPIPE",
      "CONNECT_TIMEOUT", "CONNECTION_CLOSED", "CONNECTION_ENDED", "CONNECTION_DESTROYED",
      "57P01", "57P02", "57P03", // admin_shutdown / crash_shutdown / cannot_connect_now
      "53300", "53400", // too_many_connections / configuration_limit_exceeded
    ].includes(code) || /compute time quota|exceeded the data transfer|terminating connection|timeout/i.test(e.message ?? "")
  );
}
