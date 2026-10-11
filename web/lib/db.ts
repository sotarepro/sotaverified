import postgres from "postgres";

// Singleton pattern: in development, Next.js hot-reloads modules which creates
// new connection pools on every change. Store on globalThis to reuse across reloads.
const globalForDb = globalThis as unknown as { sql: ReturnType<typeof postgres> };

function createClient() {
  const opts = {
    // Serverless: each instance needs very few connections.
    max: 3,
    // Close idle connections quickly so a warm lambda never pins the database awake
    // (Neon free scales to zero after 5 min without activity).
    idle_timeout: 10,
    max_lifetime: 60 * 10,
    // Fail fast instead of hanging a request while the compute is unavailable.
    connect_timeout: 15,
    // Neon's pooled endpoint (-pooler) is PgBouncer in transaction mode, which does
    // not support named prepared statements.
    prepare: false,
  };

  // postgres.js doesn't support Unix socket via the host= query param.
  if (process.env.DATABASE_URL?.includes("host=/var/run/postgresql")) {
    return postgres({ host: "/var/run/postgresql", database: "pwc", username: "david", ...opts });
  }
  return postgres(process.env.DATABASE_URL ?? "postgresql://david@localhost/pwc", opts);
}

const sql = globalForDb.sql ?? createClient();
if (process.env.NODE_ENV !== "production") globalForDb.sql = sql;

export default sql;
