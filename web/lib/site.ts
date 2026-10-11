// Maintenance-mode site constants. The Substack link is shown only when
// NEXT_PUBLIC_SUBSTACK_URL is set (Vercel env var) — nothing is hardcoded.
export const GITHUB_URL = "https://github.com/sotarepro/sotaverified";
export const SUBSTACK_URL = process.env.NEXT_PUBLIC_SUBSTACK_URL || null;
// Date the trimmed catalog was snapshotted from the production database.
export const CATALOG_SNAPSHOT_DATE = process.env.NEXT_PUBLIC_CATALOG_SNAPSHOT_DATE || "2026-10-10";
