import type { NextConfig } from "next";
import { AREAS, areaSlug } from "./lib/areas";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "avatars.githubusercontent.com" },
    ],
  },
  async redirects() {
    // The default *.vercel.app hostname is permanently sent to the canonical domain. Matches
    // only this exact host, so preview deployments (other *.vercel.app hosts) keep working.
    return [
      {
        source: "/:path*",
        has: [{ type: "host" as const, value: "sotaverified-zeta.vercel.app" }],
        destination: "https://sotaverified.org/:path*",
        permanent: true,
      },
    ];
  },
  async rewrites() {
    // `/tasks?area=<Area>` -> the static per-area page. Only the 11 known areas match, so
    // unbounded ?area=junk values never create new render variants.
    return {
      beforeFiles: AREAS.map((area) => ({
        source: "/tasks",
        has: [{ type: "query" as const, key: "area", value: area.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") }],
        destination: `/browse/area/${areaSlug(area)}`,
      })),
    };
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-DNS-Prefetch-Control", value: "on" },
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
