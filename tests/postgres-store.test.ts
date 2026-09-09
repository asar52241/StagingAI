import assert from "node:assert/strict";
import { after, before, beforeEach, test } from "node:test";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { createPostgresQuery, PostgresStore } from "../lib/postgresStore";
import { type AtomicStore, getServerStore } from "../lib/serverStore";
import { createOrder, finishProcessing, getOrder, markOrderPaid, reserveProcessing } from "../lib/orders";
import { rateLimit } from "../lib/requestSecurity";

// Execute the real migration and SQL against PostgreSQL, without external credentials.
let db: PGlite;
const newStore = () => new PostgresStore(async (text, params) => (await db.query<Record<string, unknown>>(text, params)).rows);
const globals = globalThis as typeof globalThis & { stagingStore?: AtomicStore };
const expiry = () => Date.now() + 60_000;
let store: PostgresStore;

before(async () => {
  // PGlite's CJS asset URL construction truncates paths containing '#'.
  // Load its packaged assets with filesystem paths so this checkout works too.
  const require = createRequire(resolve("package.json"));
  const assets = dirname(require.resolve("@electric-sql/pglite"));
  const [bundle, wasm, initdb] = await Promise.all([
    readFile(join(assets, "pglite.data")), readFile(join(assets, "pglite.wasm")), readFile(join(assets, "initdb.wasm")),
  ]);
  db = await PGlite.create({
    fsBundle: new Blob([Uint8Array.from(bundle)]),
    pgliteWasmModule: await WebAssembly.compile(Uint8Array.from(wasm)),
    initdbWasmModule: await WebAssembly.compile(Uint8Array.from(initdb)),
  });
  const migration = await readFile("db/001_order_store.sql", "utf8");
  await db.exec(migration);
  await db.exec(migration); // Re-running setup must preserve existing schema.
});
beforeEach(async () => {
  await db.exec("TRUNCATE public.stagingai_records");
  store = newStore();
  globals.stagingStore = store;
});
after(async () => { delete globals.stagingStore; if (db) await db.close(); });

test("PostgreSQL compare-and-set has a single winner for both insert and update", async () => {
  const inserts = await Promise.all(Array.from({ length: 8 }, () => store.compareAndSet("key", null, "first", expiry())));
  assert.equal(inserts.filter(Boolean).length, 1);
  const updates = await Promise.all(Array.from({ length: 8 }, (_, i) => store.compareAndSet("key", "first", `value-${i}`, expiry())));
  assert.equal(updates.filter(Boolean).length, 1);
  assert.equal(await newStore().get("key"), `value-${updates.indexOf(true)}`);
});

test("expired records are absent, cannot be revived by a stale update and can be replaced", async () => {
  await store.compareAndSet("expired", null, "old", Date.now() - 1000);
  assert.equal(await store.get("expired"), null);
  assert.equal(await store.compareAndSet("expired", "old", "revived", expiry()), false);
  assert.equal(await store.compareAndSet("expired", null, "new", expiry()), true);
  assert.equal(await store.get("expired"), "new");
  assert.equal(await store.compareAndSet("missing", "old", "revived", expiry()), false);
  assert.equal(await store.get("missing"), null);
});

test("keys and values with SQL syntax remain inert parameters", async () => {
  const key = "'; DROP TABLE public.stagingai_records; --";
  const value = JSON.stringify({ owner: "' OR 1=1 --", unicode: "оплата", newline: "a\nb" });
  assert.equal(await store.compareAndSet(key, null, value, expiry()), true);
  assert.equal(await store.get(key), value);
  assert.equal(await store.compareAndSet(key, "' OR 1=1 --", "wrong", expiry()), false);
  assert.equal(await store.compareAndSet(key, value, "updated", expiry()), true);
  assert.equal(await store.get("unrelated"), null);
});

test("cleanup is bounded and preserves unexpired records", async () => {
  await db.query("INSERT INTO public.stagingai_records SELECT 'expired-' || i, 'old', 1 FROM generate_series(1, 1005) AS i");
  await db.query("INSERT INTO public.stagingai_records VALUES ('active', 'keep', $1)", [expiry()]);
  await store.compareAndSet("trigger", null, "new", expiry());
  const result = await db.query<{ count: number }>("SELECT count(*)::int AS count FROM public.stagingai_records WHERE expires_at = 1");
  assert.equal(result.rows[0].count, 5);
  assert.equal(await store.get("active"), "keep");
  // Each warm instance performs cleanup at most once per minute.
  await store.compareAndSet("trigger", "new", "updated", expiry());
  const remaining = await db.query<{ count: number }>("SELECT count(*)::int AS count FROM public.stagingai_records WHERE expires_at = 1");
  assert.equal(remaining.rows[0].count, 5);
});

test("PostgreSQL paid orders preserve quota and reject replay across store instances", async () => {
  const order = await createOrder(3, store);
  assert.equal(await markOrderPaid(order.invId, 1, store), null);
  const paid = await markOrderPaid(order.invId, order.amountCents, store);
  assert.ok(paid?.paidUntil);
  assert.equal(await reserveProcessing(order.invId, "wrong-owner", "photo", "request", store), "payment_required");
  const reservations = await Promise.all(Array.from({ length: 12 }, (_, i) =>
    reserveProcessing(order.invId, order.owner, `photo-${i}`, `request-${i}`, newStore())));
  assert.equal(reservations.filter((result) => result === "ok").length, 3);
  const index = reservations.indexOf("ok");
  await finishProcessing(order.invId, `photo-${index}`, `request-${index}`, store);
  assert.equal(await reserveProcessing(order.invId, order.owner, `photo-${index}`, "retry", newStore()), "ok");
  await finishProcessing(order.invId, `photo-${index}`, "retry", store);
  const replay = await markOrderPaid(order.invId, order.amountCents, newStore());
  assert.equal(replay?.paidUntil, paid.paidUntil);
  assert.equal(await reserveProcessing(order.invId, order.owner, `photo-${index}`, "third", store), "quota_exhausted");
  assert.equal(Object.keys((await getOrder(order.invId, newStore()))!.photos).length, 3);
});

test("PostgreSQL rate limits count concurrent requests together", async () => {
  const accepted = await Promise.all(Array.from({ length: 12 }, () => rateLimit("same-client", 3)));
  assert.equal(accepted.filter(Boolean).length, 3);
});

test("DATABASE_URL selects PostgreSQL in production without connecting during initialization", () => {
  delete globals.stagingStore;
  const previous = process.env.NODE_ENV;
  Object.assign(process.env, { NODE_ENV: "production", DATABASE_URL: "postgresql://test:dummy@ep-test.us-east-1.aws.neon.tech/test" });
  try {
    assert.ok(getServerStore() instanceof PostgresStore);
    assert.equal(getServerStore(), getServerStore());
  } finally {
    Object.assign(process.env, { NODE_ENV: previous });
    delete process.env.DATABASE_URL;
    delete globals.stagingStore;
  }
});

test("malformed URLs and database failures never expose credentials", async () => {
  assert.throws(() => createPostgresQuery("malformed-secret-url"), { message: "Invalid PostgreSQL configuration" });
  const failing = new PostgresStore(async () => { throw new Error("connection failed: secret-password"); });
  await assert.rejects(failing.get("order"), { message: "Order storage unavailable" });
  await assert.rejects(failing.compareAndSet("order", null, "value", expiry()), { message: "Order storage unavailable" });
});
