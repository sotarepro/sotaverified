import type { Metadata } from "next";
import { Geist } from "next/font/google";
import Link from "next/link";
import { cookies } from "next/headers";
import SessionProvider from "@/components/SessionProvider";
import NavUser from "@/components/NavUser";
import MobileMenu from "@/components/MobileMenu";
import ImpersonationBanner from "@/components/ImpersonationBanner";
import { isTestToolsEnabled } from "@/lib/test-tools";
import "./globals.css";

const geist = Geist({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "SOTAVerified",
  description: "Verified state-of-the-art ML research infrastructure. Open benchmark tracking, reproducibility verification, and SOTA leaderboards for researchers and autonomous agents.",
  icons: {
    icon: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let impersonatingUser: string | null = null;
  if (isTestToolsEnabled()) {
    const cookieStore = await cookies();
    const cookie = cookieStore.get("sv_impersonate");
    if (cookie) {
      try {
        const data = JSON.parse(cookie.value) as { username?: string };
        impersonatingUser = data.username ?? null;
      } catch {
        // ignore malformed cookie
      }
    }
  }

  return (
    <html lang="en" className="scroll-smooth" data-scroll-behavior="smooth">
      <body className={`${geist.className} bg-white text-gray-900 antialiased`}>
        <SessionProvider>
          {impersonatingUser && <ImpersonationBanner username={impersonatingUser} />}
          <header className="border-b border-gray-200 bg-white sticky top-0 z-10">
            <div className="mx-auto max-w-6xl px-4 h-12 flex items-center gap-4 md:gap-6">
              <Link
                href="/"
                className="flex items-center gap-2 hover:opacity-80 transition-opacity whitespace-nowrap shrink-0"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/logo.svg" alt="" width={24} height={24} className="rounded-md" />
                <span className="font-semibold text-gray-900">SOTAVerified</span>
              </Link>
              {/* Desktop nav */}
              <span className="text-gray-300 hidden md:inline">|</span>
              <Link
                href="/agents"
                className="text-sm text-gray-600 hover:text-gray-900 hidden md:inline"
              >
                Agents
              </Link>
              <a
                href="/#browse"
                className="text-sm text-gray-600 hover:text-gray-900 hidden md:inline"
              >
                Browse
              </a>
              <Link
                href="/leaderboard"
                className="text-sm text-gray-600 hover:text-gray-900 hidden md:inline"
              >
                Leaderboard
              </Link>
              <Link
                href="/about"
                className="text-sm text-gray-600 hover:text-gray-900 hidden md:inline"
              >
                About
              </Link>
              <form method="GET" action="/search" className="flex-1 max-w-xs mx-2 md:mx-4 min-w-0">
                <input
                  type="search"
                  name="q"
                  data-testid="search-input"
                  placeholder="Search…"
                  className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </form>
              <div className="ml-auto shrink-0 hidden md:block">
                <NavUser />
              </div>
              {/* Mobile hamburger menu */}
              <div className="ml-auto md:hidden shrink-0">
                <MobileMenu />
              </div>
            </div>
          </header>
          <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
        </SessionProvider>
      </body>
    </html>
  );
}
