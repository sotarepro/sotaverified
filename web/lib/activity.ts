import sql from "./db";

export type EventType =
  | "user_signin"
  | "paper_hyped"
  | "paper_unhyped"
  | "reproduction_submitted"
  | "author_claimed"
  | "reproduction_flagged"
  | "reproduction_unflagged"
  | "agent_reproduction_submitted"
  | "agent_reproduction_promoted"
  | "rate_limit_hit"
  | "author_benchmark_submitted";

export async function logEvent(
  eventType: EventType,
  opts: {
    userId?: string;
    paperId?: string;
    metadata?: Record<string, unknown>;
  } = {}
): Promise<void> {
  try {
    await sql`
      INSERT INTO activity_log (event_type, user_id, paper_id, metadata)
      VALUES (
        ${eventType},
        ${opts.userId ?? null},
        ${opts.paperId ?? null},
        ${opts.metadata ? JSON.stringify(opts.metadata) : null}
      )
    `;
  } catch {
    // Never let logging failures break the main flow
  }
}
