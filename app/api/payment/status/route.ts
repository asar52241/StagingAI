/**
 * Проверяет статус платежа через XML API Робокассы (OpStateExt).
 * При успешной оплате ставит подписанный HttpOnly cookie sa_paid.
 */
import { NextRequest, NextResponse } from "next/server";
import { buildStatusUrl, signPaidToken } from "@/lib/robokassa";
import { LEGAL } from "@/config/legal";

export async function GET(req: NextRequest) {
  const invIdStr = req.nextUrl.searchParams.get("invId");
  const invId    = parseInt(invIdStr ?? "0", 10);

  if (!invId || invId <= 0) {
    return NextResponse.json({ paid: false, error: "invalid invId" }, { status: 400 });
  }

  try {
    const res = await fetch(buildStatusUrl(invId), { cache: "no-store" });
    if (!res.ok) {
      return NextResponse.json({ paid: false, error: "robokassa api error" });
    }

    const xml = await res.text();

    // Робокасса возвращает XML вида: <State><Code>100</Code>...</State>
    // Code 100 = оплачено успешно.
    const stateMatch = xml.match(/<State>[\s\S]*?<Code>(\d+)<\/Code>/);
    const stateCode  = stateMatch ? parseInt(stateMatch[1], 10) : 0;

    if (stateCode !== 100) {
      return NextResponse.json({ paid: false, stateCode });
    }

    // Извлекаем OutSum из ответа Робокассы — не доверяем клиенту
    const outSumMatch = xml.match(/<OutSum>([\d.]+)<\/OutSum>/);
    const outSum      = outSumMatch ? parseFloat(outSumMatch[1]) : 0;
    const count       = outSum > 0 ? Math.round(outSum / LEGAL.pricePerPhoto) : 0;

    const response = NextResponse.json({ paid: true, stateCode, count });
    response.cookies.set("sa_paid", signPaidToken(invId, count), {
      httpOnly: true,
      secure:   process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge:   7200, // 2 часа
      path:     "/",
    });
    return response;
  } catch {
    return NextResponse.json({ paid: false, error: "network error" });
  }
}
