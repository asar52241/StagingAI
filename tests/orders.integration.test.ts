import assert from "node:assert/strict";
import test from "node:test";
import { MemoryStore } from "../lib/serverStore";
import { createOrder, finishProcessing, markOrderPaid, reserveProcessing } from "../lib/orders";

test("an expired processing lease permits one retry without restoring spent attempts", async (t) => {
  let now = Date.now();
  t.mock.method(Date, "now", () => now);
  const store = new MemoryStore();
  const order = await createOrder(1, store);
  await markOrderPaid(order.invId, order.amountCents, store);
  assert.equal(await reserveProcessing(order.invId, order.owner, "photo", "first", store), "ok");
  assert.equal(await reserveProcessing(order.invId, order.owner, "photo", "parallel", store), "busy");
  now += 300_001;
  assert.equal(await reserveProcessing(order.invId, order.owner, "photo", "retry", store), "ok");
  await finishProcessing(order.invId, "photo", "first", store);
  assert.equal(await reserveProcessing(order.invId, order.owner, "photo", "stale", store), "busy");
  await finishProcessing(order.invId, "photo", "retry", store);
  assert.equal(await reserveProcessing(order.invId, order.owner, "photo", "third", store), "quota_exhausted");
});
