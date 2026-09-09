import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { createHash } from "node:crypto";
import { NextRequest } from "next/server";
import OpenAI from "openai";
import { MemoryStore, getServerStore } from "../lib/serverStore";
import { createPostgresQuery, PostgresStore } from "../lib/postgresStore";
import { createOrder, finishProcessing, getOrder, markOrderPaid, reserveProcessing } from "../lib/orders";
import { assertPaymentConfiguration, parseAmountCents, parseInvoiceId, signOrderToken, verifyOrderToken, verifySuccessSignature } from "../lib/robokassa";
import { clientAddress, rateLimit, readCookie, readLimitedBody, requireSameOrigin, RequestError } from "../lib/requestSecurity";
import { parseImageDimensions, parsePngMetadata } from "../lib/imageValidation";
import { analyticsUrl } from "../lib/analyticsUrl";
import { POST as createPayment } from "../app/api/payment/create/route";
import { GET as paymentStatus } from "../app/api/payment/status/route";
import { POST as paymentResult } from "../app/api/payment/result/route";
import { POST as declutter } from "../app/api/declutter/route";

const globals = globalThis as typeof globalThis & { stagingStore?: MemoryStore };
beforeEach(() => { globals.stagingStore = new MemoryStore(); });
const md5 = (value: string) => createHash("md5").update(value).digest("hex");
const owner = "a".repeat(64);
const tokenPayload = () => ({ invId: 123, owner, expiresAt: Date.now() + 60_000 });
const cookie = (kind: "order" | "paid", order: { invId: number; owner: string; expiresAt: number }) =>
  `sa_${kind === "order" ? "order" : "paid"}=${signOrderToken(kind, order)}`;
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=", "base64");
const jsonRequest = (body: string) => new NextRequest("https://staging-ai.test/api/payment/create", { method: "POST", body, headers: { "Content-Type": "application/json" } });

async function paidOrder() {
  const order = await createOrder(3);
  await markOrderPaid(order.invId, order.amountCents);
  return order;
}
function upload(order: Awaited<ReturnType<typeof paidOrder>>, image = png, fields: Record<string, string> = {}) {
  const form = new FormData();
  form.set("mode", "auto");
  form.set("image", new File([Uint8Array.from(image)], 'private-name.png', { type: "image/png" }));
  for (const [key, value] of Object.entries(fields)) form.set(key, value);
  return new Request("https://staging-ai.test/api/declutter", { method: "POST", body: form, headers: { cookie: cookie("paid", order) } });
}

for (const value of ["150junk", "1e3", "NaN", "Infinity", "-150", "0", "150.001", "", "150,00"]) {
  test(`reject malformed amount ${JSON.stringify(value)}`, () => assert.equal(parseAmountCents(value), null));
}
test("parse exact Robokassa decimal amounts without rounding", () => {
  assert.equal(parseAmountCents("150.000000"), 15000);
  assert.equal(parseAmountCents("150.5"), 15050);
});
test("strict invoice syntax", () => {
  for (const id of ["12junk", "1e6", "-1", "0", "01", "9007199254740992"]) assert.equal(parseInvoiceId(id), null);
  assert.equal(parseInvoiceId("1788980000123456"), 1788980000123456);
});
test("verify the exact signed amount, including trailing zeros", () => {
  const signature = md5("150.000000:123:test-password-1");
  assert.equal(verifySuccessSignature("150.000000", "123", signature.toUpperCase()), true);
  assert.equal(verifySuccessSignature("150.00", "123", signature), false);
});
test("HMAC tokens reject tampering, wrong purpose and expired payloads", () => {
  const payload = tokenPayload();
  const token = signOrderToken("paid", payload);
  assert.deepEqual(verifyOrderToken("paid", token), payload);
  assert.equal(verifyOrderToken("order", token), null);
  assert.equal(verifyOrderToken("paid", `${token}f`), null);
  assert.equal(verifyOrderToken("paid", signOrderToken("paid", { ...payload, expiresAt: Date.now() - 1 })), null);
  assert.equal(verifyOrderToken("paid", "123:30:legacy-md5-signature"), null);
});
test("missing payment secrets fail closed", () => {
  const secret = process.env.ROBOKASSA_TEST_PASSWORD2;
  delete process.env.ROBOKASSA_TEST_PASSWORD2;
  try { assert.throws(assertPaymentConfiguration); } finally { process.env.ROBOKASSA_TEST_PASSWORD2 = secret; }
});
test("malformed percent encoding in cookies never crashes", () => {
  assert.equal(readCookie(new Request("https://staging-ai.test", { headers: { cookie: "sa_paid=%ZZ" } }), "sa_paid"), null);
});
test("cross-site requests rejected and forwarding headers do not authorize an origin", () => {
  assert.throws(() => requireSameOrigin(new Request("https://staging-ai.test", { headers: { origin: "https://evil.test", "x-forwarded-host": "evil.test" } })), RequestError);
  assert.doesNotThrow(() => requireSameOrigin(new Request("https://staging-ai.test", { headers: { origin: "https://staging-ai.test" } })));
});
test("ignore attacker-supplied forwarding IP headers by default", () => {
  assert.equal(clientAddress(new Request("https://staging-ai.test", { headers: { "x-forwarded-for": "1.2.3.4", "x-real-ip": "1.2.3.4" } })), "shared");
});
test("streaming body limit works without Content-Length", async () => {
  let cancelled = false;
  const body = new ReadableStream<Uint8Array<ArrayBuffer>>({ pull(controller) { controller.enqueue(new Uint8Array(600)); }, cancel() { cancelled = true; } });
  await assert.rejects(readLimitedBody({ body, headers: new Headers() }, 1024), (error: unknown) => error instanceof RequestError && error.status === 413);
  assert.equal(cancelled, true);
});
test("lying Content-Length cannot bypass body limit", async () => {
  const request = new Request("https://staging-ai.test", { method: "POST", body: "a".repeat(100), headers: { "Content-Length": "1" } });
  await assert.rejects(readLimitedBody(request, 50));
});
test("stalled request streams are cancelled on deadline", async () => {
  let cancelled = false;
  const body = new ReadableStream<Uint8Array<ArrayBuffer>>({ cancel() { cancelled = true; } });
  await assert.rejects(readLimitedBody({ body, headers: new Headers() }, 1024, 5), (error: unknown) => error instanceof RequestError && error.status === 408);
  assert.equal(cancelled, true);
});
test("rate limiting is atomic under simultaneous requests", async () => {
  const results = await Promise.all(Array.from({ length: 15 }, () => rateLimit("same-key", 3)));
  assert.equal(results.filter(Boolean).length, 3);
});
test("production cannot silently fall back to memory storage", () => {
  delete globals.stagingStore;
  const previous = process.env.NODE_ENV;
  Object.assign(process.env, { NODE_ENV: "production" });
  try { assert.throws(getServerStore, /Persistent order storage/); }
  finally { Object.assign(process.env, { NODE_ENV: previous }); }
});
test("PostgreSQL failures reject instead of creating a fresh memory quota", async (t) => {
  t.mock.method(globalThis, "fetch", async () => new Response("unavailable", { status: 503 }));
  await assert.rejects(new PostgresStore(createPostgresQuery("postgresql://test:test@ep-test.us-east-1.aws.neon.tech/test")).get("order"), /Order storage unavailable/);
});
test("parallel source photos cannot overdraw paid quota", async () => {
  const order = await paidOrder();
  const results = await Promise.all(Array.from({ length: 12 }, (_, i) => reserveProcessing(order.invId, order.owner, `photo-${i}`, `request-${i}`)));
  assert.equal(results.filter((result) => result === "ok").length, 3);
  assert.equal(results.filter((result) => result === "quota_exhausted").length, 9);
});
test("one in-flight request and one retry per source photo", async () => {
  const order = await paidOrder();
  assert.equal(await reserveProcessing(order.invId, owner, "photo", "wrong-owner"), "payment_required");
  assert.equal(await reserveProcessing(order.invId, order.owner, "photo", "first"), "ok");
  assert.equal(await reserveProcessing(order.invId, order.owner, "photo", "parallel"), "busy");
  await finishProcessing(order.invId, "photo", "first");
  assert.equal(await reserveProcessing(order.invId, order.owner, "photo", "retry"), "ok");
  await finishProcessing(order.invId, "photo", "first"); // stale completion must not unlock retry
  assert.equal(await reserveProcessing(order.invId, order.owner, "photo", "parallel"), "busy");
  await finishProcessing(order.invId, "photo", "retry");
  assert.equal(await reserveProcessing(order.invId, order.owner, "photo", "third"), "quota_exhausted");
});
test("replayed payment confirmation neither refills quota nor extends expiry", async () => {
  const order = await paidOrder();
  const original = await getOrder(order.invId);
  await reserveProcessing(order.invId, order.owner, "photo", "first");
  await finishProcessing(order.invId, "photo", "first");
  await markOrderPaid(order.invId, order.amountCents);
  const replayed = await getOrder(order.invId);
  assert.equal(replayed?.paidUntil, original?.paidUntil);
  assert.equal(replayed?.photos.photo.attempts, 1);
  assert.equal(await markOrderPaid(order.invId, 1), null);
});
test("unknown/deleted orders cannot be resurrected from payment tokens", async () => {
  assert.equal(await markOrderPaid(123, 15000), null);
  assert.equal(await reserveProcessing(123, owner, "photo", "request"), "payment_required");
});
for (const body of ['{', 'null', '{}', '{"photoCount":"3"}', '{"photoCount":-1}', '{"photoCount":3.5}', '{"photoCount":31}']) {
  test(`checkout rejects malformed input ${body}`, async () => assert.equal((await createPayment(jsonRequest(body))).status, 400));
}
test("checkout uses configured origin and signs its return URLs", async () => {
  const request = jsonRequest('{"photoCount":3}');
  request.headers.set("x-forwarded-host", "evil.test");
  request.headers.set("x-forwarded-proto", "http");
  const response = await createPayment(request);
  assert.equal(response.status, 200);
  const data = await response.json();
  const url = new URL(data.paymentUrl);
  assert.equal(url.searchParams.get("SuccessUrl2"), "https://staging-ai.test/studio?paid=true");
  const params = url.searchParams;
  const base = `test-merchant:150.00:${data.invId}:${params.get("Receipt")}:${params.get("SuccessUrl2")}:GET:${params.get("FailUrl2")}:GET:test-password-1`;
  assert.equal(params.get("SignatureValue"), md5(base));
  assert.match(response.headers.get("set-cookie") ?? "", /HttpOnly/);
});
test("invoice knowledge alone cannot authorize status checks", async () => {
  const order = await paidOrder();
  const response = await paymentStatus(new NextRequest(`https://staging-ai.test/api/payment/status?invId=${order.invId}&outSum=150&noSig=true`));
  assert.equal(response.status, 403);
});
test("test-mode noSig bypass is closed even for the invoice owner", async () => {
  const order = await createOrder(3);
  const response = await paymentStatus(new NextRequest(`https://staging-ai.test/api/payment/status?invId=${order.invId}&outSum=150&noSig=true`, { headers: { cookie: cookie("order", order) } }));
  assert.equal(response.status, 400);
  assert.equal((await response.json()).paid, false);
  assert.equal(response.headers.get("set-cookie"), null);
});
test("signed result is durable, idempotent and permits owner recovery without success URL", async () => {
  const order = await createOrder(3);
  const body = new URLSearchParams({ OutSum: "150.000000", InvId: String(order.invId), SignatureValue: md5(`150.000000:${order.invId}:test-password-2`) });
  for (let i = 0; i < 2; i++) {
    const response = await paymentResult(new NextRequest("https://staging-ai.test/api/payment/result", { method: "POST", body }));
    assert.equal(await response.text(), `OK${order.invId}`);
  }
  const status = await paymentStatus(new NextRequest(`https://staging-ai.test/api/payment/status?invId=${order.invId}`, { headers: { cookie: cookie("order", order) } }));
  assert.equal((await status.json()).paid, true);
  assert.match(status.headers.get("set-cookie") ?? "", /sa_paid=/);
});
test("signed callback with wrong amount never credits an order", async () => {
  const order = await createOrder(3);
  const body = new URLSearchParams({ OutSum: "50.00", InvId: String(order.invId), SignatureValue: md5(`50.00:${order.invId}:test-password-2`) });
  assert.equal((await paymentResult(new NextRequest("https://staging-ai.test/api/payment/result", { method: "POST", body }))).status, 400);
  assert.equal((await getOrder(order.invId))?.paidUntil, undefined);
});
test("image parser rejects truncated PNGs and spoofed content", () => {
  assert.deepEqual(parseImageDimensions(png, "image/png"), { width: 1, height: 1 });
  assert.equal(parsePngMetadata(png.subarray(0, 33)), null);
  assert.equal(parseImageDimensions(Buffer.from("not a photo"), "image/png"), null);
});
test("unauthorized malformed cookie does not reach paid provider", async () => {
  const response = await declutter(new Request("https://staging-ai.test/api/declutter", { method: "POST", headers: { cookie: "sa_paid=%ZZ" } }));
  assert.equal(response.status, 402);
});
test("invalid images do not consume quota", async () => {
  const order = await paidOrder();
  assert.equal((await declutter(upload(order, Buffer.from("fake")))).status, 400);
  assert.deepEqual((await getOrder(order.invId))?.photos, {});
});
test("oversized image dimensions are rejected before provider call", async () => {
  const order = await paidOrder();
  const huge = Buffer.from(png);
  huge.writeUInt32BE(100_000, 16);
  assert.equal((await declutter(upload(order, huge))).status, 400);
  assert.deepEqual((await getOrder(order.invId))?.photos, {});
});
test("paid API performs at most two provider calls for the same photo", async (t) => {
  const order = await paidOrder();
  let calls = 0;
  t.mock.method(OpenAI.Images.prototype, "edit", async (body: OpenAI.ImageEditParams) => {
    calls++;
    assert.equal((body.image as File[])[0].name, "source.png");
    return { created: 1, data: [{ b64_json: png.toString("base64") }] };
  });
  for (let i = 0; i < 2; i++) assert.equal((await declutter(upload(order))).status, 200);
  assert.equal((await declutter(upload(order))).status, 402);
  assert.equal(calls, 2);
});
test("provider errors are redacted and failures still have a bounded retry", async (t) => {
  const order = await paidOrder();
  t.mock.method(OpenAI.Images.prototype, "edit", async () => { throw new OpenAI.APIError(400, { message: "private-key-or-provider-details" }, "private-key-or-provider-details", {}); });
  const response = await declutter(upload(order));
  assert.equal(response.status, 502);
  assert.doesNotMatch(await response.text(), /private-key-or-provider-details/);
  assert.equal(Object.values((await getOrder(order.invId))!.photos)[0].attempts, 1);
});
test("analytics preserves campaign tags and removes payment credentials", () => {
  const url = analyticsUrl("https://staging-ai.test/studio?InvId=123&SignatureValue=secret&OutSum=150&paid=true&utm_source=yandex&yclid=abc#private");
  assert.equal(url, "https://staging-ai.test/studio?utm_source=yandex&yclid=abc");
});
