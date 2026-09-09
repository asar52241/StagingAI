import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { neon } from "@neondatabase/serverless";

// Use the same env-file precedence as Next.js; existing process variables win.
const require = createRequire(import.meta.url);
const { loadEnvConfig } = require("@next/env");
loadEnvConfig(process.cwd(), process.env.NODE_ENV !== "production");

async function main() {
  const connectionString = process.env.DATABASE_URL?.trim() || process.env.POSTGRES_URL?.trim();
  if (!connectionString) throw new Error("missing_configuration");
  const sql = neon(connectionString);
  const source = await readFile(new URL("../db/001_order_store.sql", import.meta.url), "utf8");
  // This fixed migration has no semicolons inside SQL literals or function bodies.
  const statements = source.split(";").map((part) => part.trim()).filter(Boolean);
  await sql.transaction([
    sql.query("SET LOCAL lock_timeout = '5s'"),
    sql.query("SET LOCAL statement_timeout = '15s'"),
    // Serialize simultaneous setup commands, including CREATE TABLE IF NOT EXISTS.
    sql.query("SELECT pg_advisory_xact_lock(1937006963, 1)"),
    ...statements.map((statement) => sql.query(statement)),
  ], { fetchOptions: { cache: "no-store", redirect: "error", signal: AbortSignal.timeout(30_000) } });
  console.log("PostgreSQL order storage is ready (public.stagingai_records).");
}

main().catch(() => {
  console.error("Database setup failed. Check DATABASE_URL, database access and CREATE permission. Connection details were not logged.");
  process.exitCode = 1;
});
