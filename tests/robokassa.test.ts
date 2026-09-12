import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { buildPaymentUrl, signOrderToken, verifyOrderToken, verifyResultSignature, verifySuccessSignature } from "../lib/robokassa";

const md5 = (value: string) => createHash("md5").update(value, "utf8").digest("hex");

test("merchant signature includes the received Receipt and URLs are encoded once", () => {
  const receipt = { items: [{ name: "Обработка фото & уборка", quantity: 1, sum: 50, tax: "none" }] };
  const url = new URL(buildPaymentUrl(50, 123, "Обработка 1 фото", receipt, "https://staging-ai.test"));
  assert.equal(url.searchParams.get("IsTest"), "1");
  assert.deepEqual(JSON.parse(url.searchParams.get("Receipt") ?? ""), receipt);
  assert.equal(url.searchParams.get("SignatureValue"), md5(`test-merchant:50.00:123:${url.searchParams.get("Receipt")}:${process.env.ROBOKASSA_TEST_PASSWORD1}`));
  assert.equal(url.searchParams.get("SuccessURL"), "https://staging-ai.test/studio?paid=true");
  assert.equal(url.searchParams.get("FailURL"), "https://staging-ai.test/studio?paid=false");
});

test("Robokassa signatures and owner tokens validate only exact data", () => {
  assert.equal(verifySuccessSignature("50.00", "123", md5(`50.00:123:${process.env.ROBOKASSA_TEST_PASSWORD1}`)), true);
  assert.equal(verifyResultSignature("50.00", "123", md5(`50.00:123:${process.env.ROBOKASSA_TEST_PASSWORD2}`)), true);
  const owner = { invId: 123, owner: "a".repeat(64), expiresAt: Date.now() + 60_000 };
  const token = signOrderToken("order", owner);
  assert.deepEqual(verifyOrderToken("order", token), owner);
  assert.equal(verifyOrderToken("order", `${token}x`), null);
  assert.equal(verifyOrderToken("paid", token), null);
});
