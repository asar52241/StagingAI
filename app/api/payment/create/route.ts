import { NextRequest, NextResponse } from "next/server";
import { buildPaymentUrl, generateInvId, IS_TEST } from "@/lib/robokassa";
import { LEGAL } from "@/config/legal";

export async function POST(req: NextRequest) {
  const { photoCount } = (await req.json()) as { photoCount: number };
  const count    = Math.max(LEGAL.minPhotosPerOrder, Number(photoCount) || 0);
  const outSum   = count * LEGAL.pricePerPhoto;
  const invId    = generateInvId();
  const proto   = req.headers.get("x-forwarded-proto") ?? "https";
  const host    = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "";
  const siteUrl = host ? `${proto}://${host}` : LEGAL.siteUrl;

  const paymentUrl = buildPaymentUrl(
    outSum,
    invId,
    `Обработка ${count} фото — StagingAI`,
  );

  // Возвращаем пользователя на промежуточную страницу, а не сразу в /studio:
  // она закрывает платёжную вкладку и передаёт сигнал исходной вкладке Studio.
  // Если новая вкладка была заблокирована и оплата шла в текущей, страница сама
  // переведёт пользователя обратно в /studio.
  const url = new URL(paymentUrl);
  url.searchParams.set("SuccessURL", `${siteUrl}/payment-return?paid=true`);
  url.searchParams.set("FailURL",    `${siteUrl}/payment-return?paid=false`);

  return NextResponse.json({ paymentUrl: url.toString(), invId, outSum, isTest: IS_TEST });
}
