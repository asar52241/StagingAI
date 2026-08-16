import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import {
  buildPaymentUrl,
  signPendingPaymentToken,
  verifyPendingPaymentToken,
  verifyResultSignature,
  verifySuccessSignature,
} from "../lib/robokassa";

function md5(value: string) {
  return createHash("md5").update(value, "utf8").digest("hex");
}

test("test-mode payment URL carries an intact receipt and test flag", () => {
  const url = new URL(buildPaymentUrl(50, 123, "Обработка 1 фото", {
    items: [{ name: "Обработка фото", quantity: 1, sum: 50, tax: "none" }],
  }));
  assert.equal(url.searchParams.get("IsTest"), "1");
  assert.deepEqual(JSON.parse(url.searchParams.get("Receipt") ?? ""), {
    items: [{ name: "Обработка фото", quantity: 1, sum: 50, tax: "none" }],
  });
});

test("Robokassa signatures and pending-payment token validate only exact data", () => {
  const pass1 = process.env.ROBOKASSA_TEST_PASSWORD1 ?? process.env.ROBOKASSA_PASSWORD1 ?? "";
  const pass2 = process.env.ROBOKASSA_TEST_PASSWORD2 ?? process.env.ROBOKASSA_PASSWORD2 ?? "";
  assert.equal(verifySuccessSignature("50.00", "123", md5(`50.00:123:${pass1}`)), true);
  assert.equal(verifyResultSignature("50.00", "123", md5(`50.00:123:${pass2}`)), true);
  const pending = signPendingPaymentToken(123);
  assert.deepEqual(verifyPendingPaymentToken(pending), { invId: 123 });
  assert.equal(verifyPendingPaymentToken(`${pending}x`), null);
});
