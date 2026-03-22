import type { Metadata } from "next";
import { Geist } from "next/font/google";
import Link from "next/link";
import SessionProvider from "@/components/SessionProvider";
import NavUser from "@/components/NavUser";
import "./globals.css";

const geist = Geist({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "SOTAVerified",
  description: "Verified state-of-the-art ML research infrastructure. Open benchmark tracking, reproducibility verification, and SOTA leaderboards for researchers and autonomous agents.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${geist.className} bg-white text-gray-900 antialiased`}>
        <SessionProvider>
          <header className="border-b border-gray-200 bg-white sticky top-0 z-10">
            <div className="mx-auto max-w-6xl px-4 h-12 flex items-center gap-6">
              <Link
                href="/"
                className="font-semibold text-blue-600 hover:text-blue-700 whitespace-nowrap"
              >
                SOTAVerified
              </Link>
              <span className="text-gray-300">|</span>
              <Link
                href="/tasks"
                className="text-sm text-gray-600 hover:text-gray-900"
              >
                Browse
              </Link>
              <Link
                href="/about"
                className="text-sm text-gray-600 hover:text-gray-900"
              >
                About
              </Link>
              <form method="GET" action="/search" className="flex-1 max-w-xs mx-4">
                <input
                  type="search"
                  name="q"
                  placeholder="Search papers &amp; tasks…"
                  className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </form>
              <div className="ml-auto">
                <NavUser />
              </div>
            </div>
          </header>
          <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
        </SessionProvider>
      </body>
    </html>
  );
}
