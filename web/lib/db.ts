import postgres from "postgres";

// Singleton pattern: in development, Next.js hot-reloads modules which creates
// new connection pools on every change. Store on globalThis to reuse across reloads.
const globalForDb = globalThis as unknown as { sql: ReturnType<typeof postgres> };

function createClient() {
  const opts = { max: 10, idle_timeout: 20, max_lifetime: 60 * 30 };

  // postgres.js doesn't support Unix socket via the host= query param.
  if (process.env.DATABASE_URL?.includes("host=/var/run/postgresql")) {
    return postgres({ host: "/var/run/postgresql", database: "pwc", username: "david", ...opts });
  }
  return postgres(process.env.DATABASE_URL ?? "postgresql://david@localhost/pwc", opts);
}

const sql = globalForDb.sql ?? createClient();
if (process.env.NODE_ENV !== "production") globalForDb.sql = sql;

export default sql;
