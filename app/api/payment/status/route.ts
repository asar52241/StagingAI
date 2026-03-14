/**
 * Проверяет статус платежа через XML API Робокассы (OpStateExt).
 * Возвращает { paid: boolean }.
 */
import { NextRequest, NextResponse } from "next/server";
import { buildStatusUrl } from "@/lib/robokassa";

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
    const match     = xml.match(/<State>[\s\S]*?<Code>(\d+)<\/Code>/);
    const stateCode = match ? parseInt(match[1], 10) : 0;

    return NextResponse.json({ paid: stateCode === 100, stateCode });
  } catch {
    return NextResponse.json({ paid: false, error: "network error" });
  }
}
