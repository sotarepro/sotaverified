"use client";

import { SessionProvider as NextAuthSessionProvider } from "next-auth/react";

export default function SessionProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  // No refetch on tab focus: every refetch is a function invocation (Hobby quota).
  return (
    <NextAuthSessionProvider refetchOnWindowFocus={false}>{children}</NextAuthSessionProvider>
  );
}
