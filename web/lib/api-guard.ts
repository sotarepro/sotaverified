import { NextResponse } from "next/server";
import { isDbUnavailable } from "./db-errors";
import { revalidateAfterWrite } from "./cache";

/** Public GET API responses: edge-cacheable so repeat hits never reach a function or the DB. */
export const PUBLIC_API_CACHE = "public, s-maxage=300, stale-while-revalidate=3600";

export const UNAVAILABLE_MESSAGE =
  "SOTAVerified is temporarily unavailable (maintenance mode). Please try again in a few minutes.";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Handler<A extends any[]> = (...args: A) => Promise<Response> | Response;

/**
 * Wrap a route handler so a database outage becomes a friendly 503 instead of a crash.

 * The 503 carries `Retry-After` and is never CDN-cached.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function withDbGuard<A extends any[]>(handler: Handler<A>) {
  return async (...args: A): Promise<Response> => {
    try {
      const res = await handler(...args);
      // Safety net: any successful mutating request drops the cached catalog reads.
      // (Routes that know their paper id also revalidate that paper's page themselves.)
      const method = (args[0] as { method?: string } | undefined)?.method;
      if (method && !["GET", "HEAD", "OPTIONS"].includes(method) && res.status < 400) {
        revalidateAfterWrite();
      }
      return res;
    } catch (err) {
      if (isDbUnavailable(err)) {
        console.error("[db-unavailable]", (err as Error)?.message);
        return NextResponse.json(
          { error: UNAVAILABLE_MESSAGE, code: "temporarily_unavailable" },
          { status: 503, headers: { "Retry-After": "120", "Cache-Control": "no-store" } },
        );
      }
      throw err;
    }
  };
}
