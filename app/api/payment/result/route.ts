import { NextRequest } from "next/server";
import { parseAmountCents, parseInvoiceId, verifyResultSignature } from "@/lib/robokassa";
import { markOrderPaid } from "@/lib/orders";
import { readLimitedBody, RequestError } from "@/lib/requestSecurity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function handleResult(params: URLSearchParams) {
  const outSum = params.get("OutSum") ?? "";
  const invIdRaw = params.get("InvId") ?? "";
  const invId = parseInvoiceId(invIdRaw);
  const cents = parseAmountCents(outSum);
  if (!invId || !cents || ["OutSum", "InvId", "SignatureValue"].some((key) => params.getAll(key).length !== 1)) {
    return new Response("bad request", { status: 400 });
  }
  if (!verifyResultSignature(outSum, invIdRaw, params.get("SignatureValue") ?? "")) return new Response("bad sign", { status: 400 });
  // Persist before acknowledging: Robokassa can safely retry on storage/network errors.
  if (!await markOrderPaid(invId, cents)) return new Response("unknown order or amount", { status: 400 });
  return new Response(`OK${invId}`, { headers: { "Cache-Control": "no-store" } });
}

export async function GET(req: NextRequest) {
  try { return await handleResult(req.nextUrl.searchParams); }
  catch { return new Response("temporarily unavailable", { status: 503 }); }
}

export async function POST(req: NextRequest) {
  try {
    const body = new TextDecoder().decode(await readLimitedBody(req, 16 * 1024));
    return await handleResult(new URLSearchParams(body));
  } catch (error) {
    return new Response("request failed", { status: error instanceof RequestError ? error.status : 503 });
  }
}
