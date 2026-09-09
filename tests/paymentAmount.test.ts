import assert from "node:assert/strict";
import test from "node:test";
import { parseAmountCents } from "../lib/robokassa";
import { getOrderPrice } from "../lib/pricing";

test("payment amounts use exact kopecks without inferring photo counts", () => {
  assert.equal(parseAmountCents("50.00"), 5_000);
  assert.equal(parseAmountCents("50.000000"), 5_000);
  assert.equal(parseAmountCents("50.001"), null);
  assert.equal(parseAmountCents("50junk"), null);
  // A discounted amount does not uniquely identify the photo count.
  assert.equal(getOrderPrice(9), getOrderPrice(10));
});

test("one-photo checkout and package prices reject coerced or invalid counts", () => {
  assert.equal(getOrderPrice(1), 50);
  assert.equal(getOrderPrice(30), 1350);
  for (const count of [0, -1, 1.5, 31, "1"]) {
    assert.throws(() => getOrderPrice(count as number), /Invalid photo count/);
  }
});
