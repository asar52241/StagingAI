/** Shared atomic storage. Production must use a persistent Redis database. */
export interface AtomicStore {
  get(key: string): Promise<string | null>;
  compareAndSet(key: string, expected: string | null, value: string, expiresAt: number): Promise<boolean>;
}

const CAS_SCRIPT = `
local current = redis.call('GET', KEYS[1])
if (ARGV[1] == 'absent' and current) or
   (ARGV[1] == 'present' and current ~= ARGV[2]) then return 0 end
redis.call('SET', KEYS[1], ARGV[3], 'PXAT', ARGV[4])
return 1
`;

export class RedisStore implements AtomicStore {
  constructor(private url: string, private token: string) {
    if (new URL(url).protocol !== "https:" || !token) throw new Error("Invalid Redis configuration");
  }

  private async command(args: (string | number)[]): Promise<unknown> {
    const response = await fetch(this.url, {
      method: "POST",
      headers: { Authorization: `Bearer ${this.token}`, "Content-Type": "application/json" },
      body: JSON.stringify(args),
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok) throw new Error("Order storage unavailable");
    const data = await response.json() as { result?: unknown; error?: string };
    if (data.error) throw new Error("Order storage command failed");
    return data.result;
  }

  async get(key: string): Promise<string | null> {
    const result = await this.command(["GET", key]);
    if (result !== null && typeof result !== "string") throw new Error("Invalid storage response");
    return result;
  }

  async compareAndSet(key: string, expected: string | null, value: string, expiresAt: number) {
    return await this.command([
      "EVAL", CAS_SCRIPT, 1, key, expected === null ? "absent" : "present",
      expected ?? "", value, expiresAt,
    ]) === 1;
  }
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
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (url || token) {
    globals.stagingStore = new RedisStore(url ?? "", token ?? "");
  } else if (process.env.NODE_ENV === "production") {
    throw new Error("Persistent order storage is required in production");
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
