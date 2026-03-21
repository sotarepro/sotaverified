import postgres from "postgres";

// postgres.js doesn't support Unix socket via the host= query param.
// Pass the socket directory explicitly when running locally.
const sql = process.env.DATABASE_URL?.includes("host=/var/run/postgresql")
  ? postgres({
      host: "/var/run/postgresql",
      database: "pwc",
      username: "david",
      max: 10,
    })
  : postgres(process.env.DATABASE_URL ?? "postgresql://david@localhost/pwc", {
      max: 10,
    });

export default sql;
