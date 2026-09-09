import { createPostgresQuery, PostgresStore } from "./postgresStore";

/** Shared atomic storage. Production uses persistent PostgreSQL (Neon). */
export interface AtomicStore {
  get(key: string): Promise<string | null>;
  compareAndSet(key: string, expected: string | null, value: string, expiresAt: number): Promise<boolean>;
}

/** Bounded development/test store; never used as a production fallback. */
export class MemoryStore implements AtomicStore {
  private entries = new Map<string, { value: string; expiresAt: number }>();

  async get(key: string) {
    const entry = this.entries.get(key);
    if (!entry || entry.expiresAt <= Date.now()) {
      this.entries.delete(key);
      return null;
    }
    return entry.value;
  }

  async compareAndSet(key: string, expected: string | null, value: string, expiresAt: number) {
    // No await between reading and writing: CAS is atomic within this process.
    for (const [id, entry] of this.entries) {
      if (entry.expiresAt <= Date.now()) this.entries.delete(id);
    }
    if ((this.entries.get(key)?.value ?? null) !== expected) return false;
    if (!this.entries.has(key) && this.entries.size >= 10_000) throw new Error("Development store full");
    this.entries.set(key, { value, expiresAt });
    return true;
  }
}

const globals = globalThis as typeof globalThis & { stagingStore?: AtomicStore };

export function getServerStore(): AtomicStore {
  if (globals.stagingStore) return globals.stagingStore;
  const url = process.env.DATABASE_URL?.trim() || process.env.POSTGRES_URL?.trim();
  if (url) {
    globals.stagingStore = new PostgresStore(createPostgresQuery(url));
  } else if (process.env.NODE_ENV === "production") {
    throw new Error("Persistent order storage is required in production: set DATABASE_URL");
  } else {
    globals.stagingStore = new MemoryStore();
  }
  return globals.stagingStore;
}

export async function mutateRecord<T, R>(
  store: AtomicStore,
  key: string,
  change: (current: T | null) => { value: T; expiresAt: number; result: R } | { result: R },
): Promise<R> {
  for (let attempt = 0; attempt < 20; attempt++) {
    const raw = await store.get(key);
    const update = change(raw === null ? null : JSON.parse(raw) as T);
    if (!("value" in update)) return update.result;
    if (await store.compareAndSet(key, raw, JSON.stringify(update.value), update.expiresAt)) {
      return update.result;
    }
  }
  throw new Error("Concurrent storage update; retry later");
}
