import { NextRequest, NextResponse } from "next/server";
import { assertPaymentConfiguration, buildPaymentUrl, IS_TEST, signOrderToken } from "@/lib/robokassa";
import { createOrder } from "@/lib/orders";
import { clientAddress, rateLimit, readLimitedBody, RequestError, requireSameOrigin, siteOrigin } from "@/lib/requestSecurity";
import { LEGAL } from "@/config/legal";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  let stage = "origin";
  try {
    requireSameOrigin(req);
    stage = "payment_configuration";
    assertPaymentConfiguration();
    stage = "site_configuration";
    const origin = siteOrigin();
    stage = "rate_limit_storage";
    if (!await rateLimit(`create:${clientAddress(req)}`, 10)) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: { "Retry-After": "60" } });
    }
    stage = "request_validation";
    let body: unknown;
    try { body = JSON.parse(new TextDecoder().decode(await readLimitedBody(req, 1024))); }
    catch (error) { if (error instanceof RequestError) throw error; throw new RequestError(400, "Invalid JSON"); }
    const count = body && typeof body === "object" && "photoCount" in body ? body.photoCount : undefined;
    if (typeof count !== "number" || !Number.isInteger(count) || count < LEGAL.minPhotosPerOrder || count > LEGAL.maxPhotosPerOrder) {
      throw new RequestError(400, `photoCount must be an integer between ${LEGAL.minPhotosPerOrder} and ${LEGAL.maxPhotosPerOrder}`);
    }
    stage = "order_storage";
    const order = await createOrder(count);
    const outSum = order.amountCents / 100;
    const receipt = { items: [{
      name: "Обработка фото — StagingAI", quantity: count, sum: outSum,
      payment_method: "full_payment", payment_object: "service", tax: "none",
    }] };
    stage = "payment_url";
    const paymentUrl = buildPaymentUrl(outSum, order.invId, `Обработка ${count} фото — StagingAI`, receipt, origin);
    const response = NextResponse.json({ paymentUrl, invId: order.invId, outSum, isTest: IS_TEST }, {
      headers: { "Cache-Control": "no-store" },
    });
    stage = "order_cookie";
    response.cookies.set("sa_order", signOrderToken("order", {
      invId: order.invId, owner: order.owner, expiresAt: order.expiresAt,
    }), { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", expires: new Date(order.expiresAt) });
    return response;
  } catch (error) {
    const status = error instanceof RequestError ? error.status : 503;
    // Report the failing operation without secrets, SQL, payment URLs or tokens.
    if (status === 503) console.error("Payment creation failed", { stage });
    return NextResponse.json({ error: error instanceof RequestError ? error.message : "Payment service unavailable" }, { status });
  }
}
