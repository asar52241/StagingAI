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

  const receipt = {
    items: [{
      name: `Обработка фото — StagingAI`,
      quantity: count,
      sum: outSum,
      payment_method: "full_payment",
      payment_object: "service",
      tax: "none",
    }],
  };

  const paymentUrl = buildPaymentUrl(
    outSum,
    invId,
    `Обработка ${count} фото — StagingAI`,
    receipt,
  );

  // Добавляем SuccessURL и FailURL как GET-параметры.
  // Робокасса автоматически прибавит OutSum и InvId к этим URL при редиректе.
  // Также убедитесь, что в личном кабинете Робокассы включена опция
  // «Разрешить переопределение SuccessURL и FailURL».
  const url = new URL(paymentUrl);
  url.searchParams.set("SuccessURL", `${siteUrl}/studio?paid=true`);
  url.searchParams.set("FailURL",    `${siteUrl}/studio?paid=false`);

  return NextResponse.json({ paymentUrl: url.toString(), invId, outSum, isTest: IS_TEST });
}
