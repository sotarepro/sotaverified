/**
 * The 11 research areas. Kept as a constant (not read from the DB) because next.config.ts
 * needs it to build the `/tasks?area=X` rewrites, and because area slugs are part of the
 * static-asset URLs (`/data/tabs/area/<slug>`). A build-time check (`assertKnownAreas`)
 * fails loudly if the database ever contains an area that is not listed here.
 */
export const AREAS = [
  "Computer Vision",
  "Language & Reasoning",
  "Reinforcement Learning & Robotics",
  "Audio & Speech",
  "Graphs & Structured Data",
  "Medical & Scientific",
  "Time Series & Forecasting",
  "Recommendation & Retrieval",
  "Foundations & Efficiency",
  "Generative Models",
  "Multimodal & Vision-Language",
] as const;

export function areaSlug(area: string): string {
  return area.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

export function areaFromSlug(slug: string): string | undefined {
  return AREAS.find((a) => areaSlug(a) === slug);
}

export function assertKnownAreas(dbAreas: string[]): void {
  const unknown = dbAreas.filter((a) => !(AREAS as readonly string[]).includes(a));
  if (unknown.length) {
    throw new Error(`Unknown research area(s) in DB, add to lib/areas.ts: ${unknown.join(", ")}`);
  }
}
