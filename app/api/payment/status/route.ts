import { NextRequest, NextResponse } from "next/server";
import { buildStatusUrl, IS_TEST, parseAmountCents, parseInvoiceId, signOrderToken, verifyOrderToken, verifySuccessSignature } from "@/lib/robokassa";
import { getOrder, markOrderPaid } from "@/lib/orders";
import { rateLimit, readCookie, readLimitedBody, RequestError, requireSameOrigin } from "@/lib/requestSecurity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const reply = (data: object, status = 200) => NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });

export async function GET(req: NextRequest) {
  try {
    requireSameOrigin(req);
    const params = req.nextUrl.searchParams;
    const invId = parseInvoiceId(params.get("invId") ?? "");
    if (!invId) return reply({ paid: false, error: "Invalid invoice" }, 400);
    const pending = readCookie(req, "sa_order");
    const paid = readCookie(req, "sa_paid");
    const tokens = [pending ? verifyOrderToken("order", pending) : null, paid ? verifyOrderToken("paid", paid) : null];
    const token = tokens.find((candidate) => candidate?.invId === invId);
    if (!token) return reply({ paid: false, error: "Order access required" }, 403);
    let order = await getOrder(invId);
    if (!order || order.owner !== token.owner || order.isTest !== IS_TEST) return reply({ paid: false }, 403);
    if (!await rateLimit(`status:${invId}`, 30)) return reply({ paid: false, error: "Too many requests" }, 429);

    if (!order.paidUntil) {
      if (IS_TEST) {
        const amount = params.get("outSum") ?? "";
        const signature = params.get("sig") ?? "";
        // noSig can never authorize a test payment. A verified ResultURL also works.
        if (parseAmountCents(amount) !== order.amountCents || !verifySuccessSignature(amount, String(invId), signature)) {
          return reply({ paid: false, error: "Invalid payment signature" }, 400);
        }
      } else {
        const response = await fetch(buildStatusUrl(invId), { cache: "no-store", redirect: "error", signal: AbortSignal.timeout(8_000) });
        if (!response.ok) return reply({ paid: false, error: "Payment provider unavailable" }, 502);
        const xml = new TextDecoder().decode(await readLimitedBody(response, 64 * 1024));
        if (verifiedStatusAmount(xml) !== order.amountCents) return reply({ paid: false });
      }
      order = await markOrderPaid(invId, order.amountCents);
    }
    if (!order?.paidUntil || order.paidUntil <= Date.now()) return reply({ paid: false, error: "Order access expired" }, 410);
    const response = reply({ paid: true, count: order.count });
    response.cookies.set("sa_paid", signOrderToken("paid", {
      invId, owner: order.owner, expiresAt: order.paidUntil,
    }), { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", expires: new Date(order.paidUntil), path: "/" });
    return response;
  } catch (error) {
    return reply({ paid: false, error: error instanceof RequestError ? error.message : "Payment verification unavailable" }, error instanceof RequestError ? error.status : 503);
  }
}

/** Fixed-schema XML from Robokassa; reject missing/ambiguous fields. */
function verifiedStatusAmount(xml: string): number | null {
  if (/<!DOCTYPE|<!ENTITY/i.test(xml)) return null;
  const single = (text: string, tag: string) => {
    const matches = [...text.matchAll(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, "g"))];
    return matches.length === 1 ? matches[0][1].trim() : null;
  };
  if (single(single(xml, "Result") ?? "", "Code") !== "0" || single(single(xml, "State") ?? "", "Code") !== "100") return null;
  const info = single(xml, "Info") ?? "";
  // IncSum is in the buyer's payment currency; never use it to determine credits.
  return parseAmountCents(single(info, "OutSum") ?? "");
}
