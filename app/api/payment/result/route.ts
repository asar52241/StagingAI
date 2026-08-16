/**
 * ResultURL для Робокассы — вызывается сервером Робокассы после успешной оплаты.
 * Должен вернуть строку "OK{InvId}" (без переноса строки).
 *
 * Настройте в личном кабинете Робокассы:
 *   ResultURL: https://your-domain.com/api/payment/result
 */
import { NextRequest } from "next/server";
import { verifyResultSignature } from "@/lib/robokassa";
import { ensureOrder } from "@/lib/orders";
import { photoCountFromAmount } from "@/lib/paymentAmount";

async function handleResult(params: URLSearchParams) {
  const outSum = params.get("OutSum") ?? "";
  const invId  = params.get("InvId")  ?? "";
  const sig    = params.get("SignatureValue") ?? "";

  if (!outSum || !invId || !sig) {
    return new Response("bad request", { status: 400 });
  }

  if (!verifyResultSignature(outSum, invId, sig)) {
    return new Response("bad sign", { status: 400 });
  }

  // Официальный источник истины: фиксируем квоту заказа. Идемпотентно —
  // повторные уведомления Робокассы (retry) не пересоздают/не обнуляют used.
  try {
    const quota = photoCountFromAmount(outSum);
    if (!quota) {
      return new Response("bad amount", { status: 400 });
    }
    await ensureOrder(parseInt(invId, 10), quota);
  } catch (err) {
    console.error(JSON.stringify({ scope: "payment/result", error: String(err), invId }));
  }

  return new Response(`OK${invId}`, { status: 200 });
}

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  return handleResult(params);
}

export async function POST(req: NextRequest) {
  const body   = await req.text();
  const params = new URLSearchParams(body);

  return handleResult(params);
}
