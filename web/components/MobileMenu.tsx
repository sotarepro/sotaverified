"use client";

import { useState } from "react";
import Link from "next/link";
import NavUser from "./NavUser";

export default function MobileMenu() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(!open)}
        className="p-1.5 text-gray-600 hover:text-gray-900"
        aria-label="Menu"
      >
        {open ? (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        )}
      </button>

      {open && (
        <div className="absolute top-12 left-0 right-0 bg-white border-b border-gray-200 shadow-lg z-20">
          <nav className="mx-auto max-w-6xl px-4 py-3 flex flex-col gap-3">
            <Link
              href="/agents"
              onClick={() => setOpen(false)}
              className="text-sm text-gray-700 hover:text-gray-900 py-1"
            >
              Agents
            </Link>
            <a
              href="/#browse"
              onClick={() => setOpen(false)}
              className="text-sm text-gray-700 hover:text-gray-900 py-1"
            >
              Browse
            </a>
            <Link
              href="/leaderboard"
              onClick={() => setOpen(false)}
              className="text-sm text-gray-700 hover:text-gray-900 py-1"
            >
              Leaderboard
            </Link>
            <Link
              href="/about"
              onClick={() => setOpen(false)}
              className="text-sm text-gray-700 hover:text-gray-900 py-1"
            >
              About
            </Link>
            <Link
              href="/blog"
              onClick={() => setOpen(false)}
              className="text-sm text-gray-700 hover:text-gray-900 py-1"
            >
              Blog
            </Link>
            <div className="border-t border-gray-100 pt-3">
              <NavUser />
            </div>
          </nav>
        </div>
      )}
    </>
  );
}
