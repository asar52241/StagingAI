import assert from "node:assert/strict";
import test from "node:test";
import {
  amountCentsForPhotoCount,
  isValidPhotoCount,
  parseAmountCents,
  photoCountFromAmount,
} from "../lib/paymentAmount";

test("accepts only exact supported payment amounts", () => {
  assert.equal(parseAmountCents("50.00"), 5_000);
  assert.equal(parseAmountCents("50.000000"), 5_000);
  assert.equal(photoCountFromAmount("50"), 1);
  assert.equal(photoCountFromAmount("150.00"), 3);
  assert.equal(photoCountFromAmount("1.5"), null);
  assert.equal(photoCountFromAmount("50.001"), null);
  assert.equal(photoCountFromAmount("51.00"), null);
});

test("rejects fractional, out-of-range and coerced photo counts", () => {
  assert.equal(isValidPhotoCount(1), true);
  assert.equal(isValidPhotoCount(30), true);
  assert.equal(isValidPhotoCount(1.5), false);
  assert.equal(isValidPhotoCount(0), false);
  assert.equal(isValidPhotoCount(31), false);
  assert.equal(isValidPhotoCount("1"), false);
  assert.equal(amountCentsForPhotoCount(30), 150_000);
});
