import assert from "node:assert/strict";
import test from "node:test";
import {
  commitOrderReservation,
  ensureOrder,
  getOrder,
  releaseOrderReservation,
  reserveOrder,
} from "../lib/orders";

test("Redis reservations prevent overspend and release exactly once", {
  skip: !process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN,
}, async () => {
  const invId = 1_900_000_000 + Math.floor(Math.random() * 99_999_999);
  await ensureOrder(invId, 2);

  const first = await reserveOrder(invId, `${invId}-first`);
  const second = await reserveOrder(invId, `${invId}-second`);
  const third = await reserveOrder(invId, `${invId}-third`);
  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  assert.equal(third.ok, false);

  await releaseOrderReservation(invId, `${invId}-first`);
  const replacement = await reserveOrder(invId, `${invId}-replacement`);
  assert.equal(replacement.ok, true);

  assert.equal(await commitOrderReservation(invId, `${invId}-second`), true);
  await releaseOrderReservation(invId, `${invId}-replacement`);
  await releaseOrderReservation(invId, `${invId}-replacement`);

  const afterOne = await getOrder(invId);
  assert.deepEqual(
    { quota: afterOne?.quota, used: afterOne?.used, reserved: afterOne?.reserved },
    { quota: 2, used: 1, reserved: 0 },
  );

  const finalReservation = await reserveOrder(invId, `${invId}-final`);
  assert.equal(finalReservation.ok, true);
  assert.equal(await commitOrderReservation(invId, `${invId}-final`), true);
  assert.equal((await reserveOrder(invId, `${invId}-exhausted`)).ok, false);
});
