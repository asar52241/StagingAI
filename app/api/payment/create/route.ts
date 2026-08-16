import { NextRequest, NextResponse } from "next/server";
import { buildPaymentUrl, generateInvId, IS_TEST, signPendingPaymentToken } from "@/lib/robokassa";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { LEGAL } from "@/config/legal";
import { amountCentsForPhotoCount, isValidPhotoCount } from "@/lib/paymentAmount";

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const rateLimit = await checkRateLimit(ip);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds) } },
    );
  }

  let photoCount: unknown;
  try {
    ({ photoCount } = await req.json() as { photoCount?: unknown });
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  if (!isValidPhotoCount(photoCount)) {
    return NextResponse.json(
      { error: `photoCount must be an integer from ${LEGAL.minPhotosPerOrder} to ${LEGAL.maxPhotosPerOrder}.` },
      { status: 400 },
    );
  }

  const count = photoCount;
  const outSumCents = amountCentsForPhotoCount(count);
  const outSum = outSumCents / 100;
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

  const response = NextResponse.json({ paymentUrl, invId, outSum, isTest: IS_TEST });
  // Allows the same browser to recover a production payment when it returns
  // without a signed SuccessURL. It is not readable or forgeable by page JS.
  response.cookies.set("sa_pending", signPendingPaymentToken(invId), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 30 * 60,
    path: "/api/payment/status",
  });
  return response;
}
