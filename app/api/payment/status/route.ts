/**
 * Проверяет статус платежа.
 *
 * Стратегия верификации:
 * 1. Всегда проверяем подпись из SuccessURL: MD5(OutSum:InvId:Password#1)
 *    — работает и в тестовом, и в боевом режиме.
 * 2. В боевом режиме дополнительно опрашиваем OpStateExt (XML API Робокассы).
 *    OpStateExt не работает для тестовых платежей.
 *
 * При успехе устанавливает httpOnly cookie sa_paid для /api/declutter.
 */
import { NextRequest, NextResponse } from "next/server";
import {
  buildStatusUrl,
  IS_TEST,
  signPaidToken,
  verifyPendingPaymentToken,
  verifySuccessSignature,
} from "@/lib/robokassa";
import { ensureOrder } from "@/lib/orders";
import { photoCountFromAmount } from "@/lib/paymentAmount";

const MAX_INV_ID = 2_000_000_000;

export async function GET(req: NextRequest) {
  const sp       = req.nextUrl.searchParams;
  const invIdStr = sp.get("invId")  ?? "";
  // OutSum берём точно в том виде, в каком его прислала Робокасса,
  // но нормализуем до 2 знаков перед проверкой подписи — формат одинаков в тест и боевом.
  const outSumRaw = sp.get("outSum") ?? "";
  const sig       = sp.get("sig")    ?? "";
  const noSig     = sp.get("noSig")  === "true";

  const invId = parseInt(invIdStr, 10);
  if (!invId || invId <= 0 || invId > MAX_INV_ID || !outSumRaw) {
    return NextResponse.json({ paid: false, error: "missing or invalid params" }, { status: 400 });
  }
  if (!noSig && !sig) {
    return NextResponse.json({ paid: false, error: "missing or invalid params" }, { status: 400 });
  }

  if (noSig) {
    // Test mode has no OpStateExt confirmation, so an unsigned recovery path
    // would mint paid cookies for arbitrary invoice IDs. Require a signed
    // SuccessURL there. Production recovery additionally requires this cookie.
    if (IS_TEST) {
      return NextResponse.json({ paid: false, error: "unsigned recovery is unavailable in test mode" }, { status: 400 });
    }
    const pendingRaw = req.cookies.get("sa_pending")?.value;
    let pendingToken: string | null = null;
    try {
      pendingToken = pendingRaw ? decodeURIComponent(pendingRaw) : null;
    } catch {
      pendingToken = null;
    }
    const pending = pendingToken ? verifyPendingPaymentToken(pendingToken) : null;
    if (!pending || pending.invId !== invId) {
      return NextResponse.json({ paid: false, error: "invalid payment recovery session" }, { status: 403 });
    }
  }

  // Нормализуем OutSum до 2 знаков после запятой — Робокасса в тест-режиме присылает
  // "150.00", в боевом "150.000000"; подпись всегда считается от нормализованного значения.
  const requestedCount = photoCountFromAmount(outSumRaw);
  if (!requestedCount) {
    return NextResponse.json({ paid: false, error: "invalid payment amount" }, { status: 400 });
  }
  const outSumNorm = (Number(outSumRaw)).toFixed(2);

  // ── 1. Верификация подписи SuccessURL ─────────────────────────────────────────
  // Пропускаем только если явно noSig=true (fallback-путь через localStorage)
  if (!noSig && !verifySuccessSignature(outSumNorm, invIdStr, sig)) {
    return NextResponse.json({ paid: false, error: "invalid signature" }, { status: 400 });
  }

  // ── 2. В боевом режиме дополнительно проверяем через OpStateExt ───────────────
  let count = 0;
  if (!IS_TEST) {
    try {
      const controller = new AbortController();
      const timeoutId  = setTimeout(() => controller.abort(), 8_000);
      let res: Response;
      try {
        res = await fetch(buildStatusUrl(invId), { cache: "no-store", signal: controller.signal });
      } finally {
        clearTimeout(timeoutId);
      }

      if (!res.ok) {
        return NextResponse.json({ paid: false, error: "robokassa api error" });
      }
      const xml = await res.text();
      console.log("[payment/status] OpStateExt response:", xml);

      // State Code 100 = оплачено успешно
      const stateMatch = xml.match(/<State>[\s\S]*?<Code>(\d+)<\/Code>/);
      const stateCode  = stateMatch ? parseInt(stateMatch[1], 10) : 0;
      if (stateCode !== 100) {
        console.log("[payment/status] stateCode not 100:", stateCode);
        return NextResponse.json({ paid: false, stateCode });
      }

      // Сумма из ответа Робокассы (тег IncSum — фактически зачисленная сумма)
      const incSumMatch = xml.match(/<IncSum>([\d.]+)<\/IncSum>/);
      const verifiedCount = photoCountFromAmount(incSumMatch?.[1] ?? outSumNorm);
      if (!verifiedCount) {
        return NextResponse.json({ paid: false, error: "invalid verified payment amount" });
      }
      count = verifiedCount;
    } catch (err) {
      const isTimeout = err instanceof Error && err.name === "AbortError";
      return NextResponse.json({ paid: false, error: isTimeout ? "timeout" : "network error" });
    }
  } else {
    // Тест-режим: OpStateExt недоступен — доверяем верифицированной подписи SuccessURL
    count = requestedCount;
  }

  // Страховка на гонку: ResultURL от Робокассы (webhook) может прийти позже,
  // чем клиент вернётся сюда. ensureOrder идемпотентен — повторные вызовы
  // этого эндпоинта не пересоздают и не обнуляют квоту.
  try {
    await ensureOrder(invId, count);
  } catch (err) {
    console.error(JSON.stringify({ scope: "payment/status", error: String(err), invId }));
    return NextResponse.json({ paid: false, error: "internal error" }, { status: 500 });
  }

  // ── 3. Подписанный cookie sa_paid (httpOnly) ──────────────────────────────────
  // Токен несёт только invId — реальная квота живёт в Redis (lib/orders.ts).
  // maxAge = 20 минут: достаточно для завершения обработки, ограничивает окно повторного использования
  const response = NextResponse.json({ paid: true, count });
  response.cookies.set("sa_paid", signPaidToken(invId), {
    httpOnly: true,
    secure:   process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge:   1_200, // 20 минут
    path:     "/",
  });
  response.cookies.set("sa_pending", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 0,
    path: "/api/payment/status",
  });
  return response;
}
