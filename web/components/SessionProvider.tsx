"use client";

import { useEffect, useState } from "react";
import { SessionProvider as NextAuthSessionProvider, useSession } from "next-auth/react";
import { clearSignedInFlag, hasSignedInFlag } from "@/lib/signed-in-flag";

/**
 * Flag said "signed in" but the server says otherwise (session expired / cleared elsewhere): drop the
 * hint so later page loads stop asking. Only mounted inside the fetching provider, so it never
 * sees the initial anonymous placeholder state.
 */
function StaleFlagGuard() {
  const { status } = useSession();
  useEffect(() => {
    if (status === "unauthenticated") clearSignedInFlag();
  }, [status]);
  return null;
}

/**
 * Anonymous visitors never hit /api/auth/session: NextAuth's provider only fetches when it
 * has no initial session, so we hand it `session={null}` unless the sv_signed_in flag
 * cookie is present (see lib/signed-in-flag.ts). The static HTML always renders the
 * anonymous UI; signed-in visitors switch to a fetching provider right after hydration.
 */
export default function SessionProvider({ children }: { children: React.ReactNode }) {
  const [signedIn, setSignedIn] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSignedIn(hasSignedInFlag());
  }, []);

  // No refetch on tab focus: every refetch is a function invocation.
  return (
    <NextAuthSessionProvider
      key={signedIn ? "in" : "out"}
      session={signedIn ? undefined : null}
      refetchOnWindowFocus={false}
    >
      {signedIn && <StaleFlagGuard />}
      {children}
    </NextAuthSessionProvider>
  );
}
