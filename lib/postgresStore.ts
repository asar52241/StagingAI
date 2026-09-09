import { neon } from "@neondatabase/serverless";
import type { AtomicStore } from "./serverStore";

export type PostgresQuery = (text: string, params: (string | number)[]) => Promise<Record<string, unknown>[]>;

/** Neon carries parameterized queries over HTTPS; never expose this URL to the browser. */
export function createPostgresQuery(connectionString: string): PostgresQuery {
  try {
    const url = new URL(connectionString);
    if (!["postgres:", "postgresql:"].includes(url.protocol) || !url.hostname ||
        !url.username || !url.password || url.pathname.length < 2) throw new Error();
    const sql = neon(connectionString);
    return async (text, params) => sql.query(text, params, {
      // A fresh signal for every request, including requests after a warm idle period.
      fetchOptions: { cache: "no-store", redirect: "error", signal: AbortSignal.timeout(10_000) },
    });
  } catch {
    // URL parser/driver errors can contain credentials.
    throw new Error("Invalid PostgreSQL configuration");
  }
}

// Use the database clock so all Vercel instances agree about expiry.
const NOW_MS = "(EXTRACT(EPOCH FROM clock_timestamp()) * 1000)::bigint";

export class PostgresStore implements AtomicStore {
  private nextCleanupAt = 0;

  constructor(private query: PostgresQuery) {}

  private async run(text: string, params: (string | number)[] = []) {
    try {
      return await this.query(text, params);
    } catch {
      // Do not log SQL, connection details, or stored owner/payment tokens.
      throw new Error("Order storage unavailable");
    }
  }

  async get(key: string): Promise<string | null> {
    const rows = await this.run(`
      SELECT value FROM public.stagingai_records
      WHERE key = $1 AND expires_at > ${NOW_MS}
    `, [key]);
    if (rows.length === 0) return null;
    if (rows.length !== 1 || typeof rows[0].value !== "string") throw new Error("Invalid storage response");
    return rows[0].value;
  }

  /** Bounded housekeeping, awaited during writes: Vercel may stop background work. */
  private async cleanupExpired() {
    if (Date.now() < this.nextCleanupAt) return;
    this.nextCleanupAt = Date.now() + 60_000;
    try {
      // Separate statement: release cleanup locks before taking the CAS row lock.
      await this.run(`
        WITH expired AS (
          SELECT key FROM public.stagingai_records
          WHERE expires_at <= ${NOW_MS}
          ORDER BY expires_at LIMIT 1000 FOR UPDATE SKIP LOCKED
        )
        DELETE FROM public.stagingai_records AS records USING expired
        WHERE records.key = expired.key
      `);
    } catch (error) {
      this.nextCleanupAt = 0;
      throw error;
    }
  }

  async compareAndSet(key: string, expected: string | null, value: string, expiresAt: number): Promise<boolean> {
    if (!Number.isSafeInteger(expiresAt) || expiresAt <= 0) throw new Error("Invalid storage expiry");
    await this.cleanupExpired();
    const rows = expected === null
      ? await this.run(`
          INSERT INTO public.stagingai_records AS current (key, value, expires_at)
          VALUES ($1, $2, $3)
          ON CONFLICT (key) DO UPDATE
          SET value = EXCLUDED.value, expires_at = EXCLUDED.expires_at
          WHERE current.expires_at <= ${NOW_MS}
          RETURNING key
        `, [key, value, expiresAt])
      : await this.run(`
          UPDATE public.stagingai_records SET value = $2, expires_at = $3
          WHERE key = $1 AND value = $4 AND expires_at > ${NOW_MS}
          RETURNING key
        `, [key, value, expiresAt, expected]);
    // Updating an absent/expired record must never recreate a paid order.
    return rows.length === 1;
  }
}
