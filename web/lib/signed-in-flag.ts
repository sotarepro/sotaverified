/**
 * `sv_signed_in=1` — a NON-httpOnly marker cookie. The real session cookie is httpOnly, so
 * client code cannot tell whether a visitor is signed in without asking the server
 * (/api/auth/session = one function invocation per page view, bots included). Anonymous
 * visitors have no flag, so they never call any auth/per-user API.
 *
 * It is a hint only, never trusted: every API still authenticates the real session cookie.
 * Set by the NextAuth route (and /api/test/session) when the session cookie is issued,
 * cleared when the session cookie is cleared or the client finds the session is gone.
 */
export const SIGNED_IN_COOKIE = "sv_signed_in";
export const SIGNED_IN_MAX_AGE = 30 * 24 * 60 * 60; // matches NextAuth's default 30-day JWT

export function signedInCookieHeader(on: boolean, secure: boolean): string {
  return [
    `${SIGNED_IN_COOKIE}=${on ? "1" : ""}`,
    "Path=/",
    "SameSite=Lax",
    `Max-Age=${on ? SIGNED_IN_MAX_AGE : 0}`,
    secure ? "Secure" : "",
  ]
    .filter(Boolean)
    .join("; ");
}

/** Client-side check. */
export function hasSignedInFlag(): boolean {
  if (typeof document === "undefined") return false;
  return document.cookie.split("; ").some((c) => c === `${SIGNED_IN_COOKIE}=1`);
}

export function clearSignedInFlag(): void {
  if (typeof document === "undefined") return;
  document.cookie = `${SIGNED_IN_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`;
}
