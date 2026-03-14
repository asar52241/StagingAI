import { createHash } from "crypto";

const LOGIN = process.env.ROBOKASSA_LOGIN!;
const PASS1  = process.env.ROBOKASSA_PASSWORD1!;
const PASS2  = process.env.ROBOKASSA_PASSWORD2!;
export const IS_TEST = process.env.ROBOKASSA_TEST === "true";

function md5(str: string): string {
  return createHash("md5").update(str, "utf8").digest("hex");
}

/** Генерирует уникальный InvId (1–2 000 000 000). */
export function generateInvId(): number {
  return Math.floor(Math.random() * 2_000_000_000) + 1;
}

/** Формирует URL для редиректа пользователя на страницу оплаты Робокассы. */
export function buildPaymentUrl(outSum: number, invId: number, description: string): string {
  const outSumStr = outSum.toFixed(2);
  const sig = md5(`${LOGIN}:${outSumStr}:${invId}:${PASS1}`);
  const params = new URLSearchParams({
    MerchantLogin: LOGIN,
    OutSum:         outSumStr,
    InvId:          String(invId),
    Description:    description,
    SignatureValue: sig,
    IsTest:         IS_TEST ? "1" : "0",
    Culture:        "ru",
    Encoding:       "utf-8",
  });
  return `https://auth.robokassa.ru/Merchant/Index.aspx?${params}`;
}

/**
 * Проверяет подпись уведомления Робокассы (ResultURL).
 * Подпись: MD5(OutSum:InvId:Password2) — без логина.
 */
export function verifyResultSignature(
  outSum: string,
  invId: string,
  signatureValue: string,
): boolean {
  const expected = md5(`${outSum}:${invId}:${PASS2}`);
  return expected.toLowerCase() === signatureValue.toLowerCase();
}

/** URL для проверки статуса платежа через Робокассу XML API. */
export function buildStatusUrl(invId: number): string {
  const sig = md5(`${LOGIN}:${invId}:${PASS2}`);
  const params = new URLSearchParams({
    MerchantLogin: LOGIN,
    InvId:         String(invId),
    Signature:     sig,
  });
  return `https://auth.robokassa.ru/Merchant/WebService/Service.asmx/OpStateExt?${params}`;
}
