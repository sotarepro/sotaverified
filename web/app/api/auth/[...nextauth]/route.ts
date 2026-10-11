import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth";
import { signedInCookieHeader } from "@/lib/signed-in-flag";

const nextAuth = NextAuth(authOptions);

const SESSION_COOKIE = /^(__Secure-)?next-auth\.session-token(\.\d+)?=([^;]*)/;

/**
 * Wrap NextAuth so that whenever it issues (or clears) the session cookie we mirror that in
 * the readable `sv_signed_in` flag. See lib/signed-in-flag.ts.
 */
async function handler(req: Request, ctx: unknown): Promise<Response> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const res: Response = await (nextAuth as any)(req, ctx);
  let issued = false;
  let cleared = false;
  for (const c of res.headers.getSetCookie()) {
    const m = SESSION_COOKIE.exec(c);
    if (!m) continue;
    if (m[3] === "" || /max-age=0/i.test(c) || /expires=thu, 01 jan 1970/i.test(c)) cleared = true;
    else issued = true;
  }
  if (issued || cleared) {
    const secure = new URL(req.url).protocol === "https:" || req.headers.get("x-forwarded-proto") === "https";
    res.headers.append("Set-Cookie", signedInCookieHeader(issued && !cleared, secure));
  }
  return res;
}

export { handler as GET, handler as POST };
