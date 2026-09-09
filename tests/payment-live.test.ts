import assert from "node:assert/strict";
import { test } from "node:test";
import { NextRequest } from "next/server";

// Loaded in its own Node test process; test credentials are still supplied by setup.mjs.
test("live verification trusts only the paid order's exact merchant amount", async (t) => {
  process.env.ROBOKASSA_TEST = "false";
  const { createOrder, getOrder } = await import("../lib/orders");
  const { signOrderToken } = await import("../lib/robokassa");
  const { GET } = await import("../app/api/payment/status/route");
  const { getOrderPrice } = await import("../lib/pricing");
  const xml = (info: string, code = 100) => `<OperationStateResponse><Result><Code>0</Code></Result><State><Code>${code}</Code></State><Info>${info}</Info></OperationStateResponse>`;
  const cases = [
    { name: "missing amount must not fall back to caller amount", body: xml("<IncSum>1500.00</IncSum>"), paid: false },
    { name: "underpayment must not be rounded up", body: xml("<OutSum>149.99</OutSum>"), paid: false },
    { name: "pending is not paid", body: xml("<OutSum>150.00</OutSum>", 50), paid: false },
    { name: "duplicate sums are rejected", body: xml("<OutSum>1</OutSum><OutSum>150</OutSum>"), paid: false },
    { name: "merchant amount determines confirmation, not buyer currency", body: xml("<IncSum>10000</IncSum><OutSum>150.000000</OutSum>"), paid: true },
  ];
  for (const sample of cases) {
    await t.test(sample.name, async (sub) => {
      const order = await createOrder(3);
      sub.mock.method(globalThis, "fetch", async () => new Response(sample.body));
      const response = await GET(new NextRequest(`https://staging-ai.test/api/payment/status?invId=${order.invId}&outSum=999999`, {
        headers: { cookie: `sa_order=${signOrderToken("order", order)}` },
      }));
      assert.equal((await response.json()).paid, sample.paid);
      assert.equal(Boolean((await getOrder(order.invId))?.paidUntil), sample.paid);
    });
  }
  await t.test("discounted checkout uses the advertised package total", async (sub) => {
    const order = await createOrder(10);
    assert.equal(order.amountCents, 45000);
    assert.equal(getOrderPrice(30), 1350);
    sub.mock.method(globalThis, "fetch", async () => new Response(xml("<OutSum>450.00</OutSum>")));
    const response = await GET(new NextRequest(`https://staging-ai.test/api/payment/status?invId=${order.invId}`, { headers: { cookie: `sa_order=${signOrderToken("order", order)}` } }));
    assert.deepEqual(await response.json(), { paid: true, count: 10 });
  });
});
