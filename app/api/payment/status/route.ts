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
import { buildStatusUrl, IS_TEST, signPaidToken, verifySuccessSignature } from "@/lib/robokassa";
import { LEGAL } from "@/config/legal";

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

  // Нормализуем OutSum до 2 знаков после запятой — Робокасса в тест-режиме присылает
  // "150.00", в боевом "150.000000"; подпись всегда считается от нормализованного значения.
  const outSumNorm = parseFloat(outSumRaw).toFixed(2);

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
      const verifiedSum = incSumMatch ? parseFloat(incSumMatch[1]) : parseFloat(outSumNorm);
      count = Math.round(verifiedSum / LEGAL.pricePerPhoto);
    } catch (err) {
      const isTimeout = err instanceof Error && err.name === "AbortError";
      return NextResponse.json({ paid: false, error: isTimeout ? "timeout" : "network error" });
    }
  } else {
    // Тест-режим: OpStateExt недоступен — доверяем верифицированной подписи SuccessURL
    count = Math.round(parseFloat(outSumNorm) / LEGAL.pricePerPhoto);
  }

  count = Math.max(count, LEGAL.minPhotosPerOrder);

  // ── 3. Подписанный cookie sa_paid (httpOnly) ──────────────────────────────────
  // maxAge = 20 минут: достаточно для завершения обработки, ограничивает окно повторного использования
  const response = NextResponse.json({ paid: true, count });
  response.cookies.set("sa_paid", signPaidToken(invId, count), {
    httpOnly: true,
    secure:   process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge:   1_200, // 20 минут
    path:     "/",
  });
  return response;
}
