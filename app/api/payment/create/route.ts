import { NextRequest, NextResponse } from "next/server";
import { buildPaymentUrl, generateInvId, IS_TEST } from "@/lib/robokassa";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { LEGAL } from "@/config/legal";

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const rateLimit = await checkRateLimit(ip);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds) } },
    );
  }

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

  // SuccessURL/FailURL передаются в buildPaymentUrl напрямую (не дописываются через
  // new URL()+searchParams.set() постфактум) — тот путь портил кодировку Receipt.
  // Робокасса автоматически прибавит OutSum и InvId к этим URL при редиректе.
  // Также убедитесь, что в личном кабинете Робокассы включена опция
  // «Разрешить переопределение SuccessURL и FailURL».
  const paymentUrl = buildPaymentUrl(
    outSum,
    invId,
    `Обработка ${count} фото — StagingAI`,
    receipt,
    { successUrl: `${siteUrl}/studio?paid=true`, failUrl: `${siteUrl}/studio?paid=false` },
  );

  return NextResponse.json({ paymentUrl, invId, outSum, isTest: IS_TEST });
}
