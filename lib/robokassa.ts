import { createHash } from "crypto";

const LOGIN = process.env.ROBOKASSA_LOGIN!;
const PASS1  = process.env.ROBOKASSA_PASSWORD1!;
const PASS2  = process.env.ROBOKASSA_PASSWORD2!;
export const IS_TEST = process.env.ROBOKASSA_TEST === "true";

const TEST_PASS1 = process.env.ROBOKASSA_TEST_PASSWORD1 ?? PASS1;
const TEST_PASS2 = process.env.ROBOKASSA_TEST_PASSWORD2 ?? PASS2;

const p1 = () => IS_TEST ? TEST_PASS1 : PASS1;
const p2 = () => IS_TEST ? TEST_PASS2 : PASS2;

function md5(str: string): string {
  return createHash("md5").update(str, "utf8").digest("hex");
}

/** Генерирует уникальный InvId (1–2 000 000 000) через CSPRNG. */
export function generateInvId(): number {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return (buf[0] % 2_000_000_000) + 1;
}

/** Формирует URL для редиректа пользователя на страницу оплаты Робокассы. */
export function buildPaymentUrl(outSum: number, invId: number, description: string, receipt?: object): string {
  const outSumStr = outSum.toFixed(2);
  const receiptEncoded = receipt ? encodeURIComponent(JSON.stringify(receipt)) : undefined;
  const sigBase = receiptEncoded
    ? `${LOGIN}:${outSumStr}:${invId}:${receiptEncoded}:${p1()}`
    : `${LOGIN}:${outSumStr}:${invId}:${p1()}`;
  const sig = md5(sigBase);
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
  if (receiptEncoded) {
    params.set("Receipt", receiptEncoded);
  }
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
  const expected = md5(`${outSum}:${invId}:${p2()}`);
  return expected.toLowerCase() === signatureValue.toLowerCase();
}

/**
 * URL для проверки статуса платежа через Робокассу XML API (OpStateExt).
 * Параметр InvoiceID (не InvId!) — по документации Робокассы.
 * Внимание: работает ТОЛЬКО в боевом режиме, не для тестовых платежей.
 */
export function buildStatusUrl(invId: number): string {
  const sig = md5(`${LOGIN}:${invId}:${p2()}`);
  const params = new URLSearchParams({
    MerchantLogin: LOGIN,
    InvoiceID:     String(invId),   // Bug fix: документация требует InvoiceID
    Signature:     sig,
  });
  return `https://auth.robokassa.ru/Merchant/WebService/Service.asmx/OpStateExt?${params}`;
}

/**
 * Верифицирует подпись из SuccessURL редиректа Робокассы.
 * Формула: MD5(OutSum:InvId:Password#1)
 * Работает в обоих режимах — тестовом и боевом.
 */
export function verifySuccessSignature(
  outSum: string,
  invId: string,
  signatureValue: string,
): boolean {
  const expected = md5(`${outSum}:${invId}:${p1()}`);
  return expected.toLowerCase() === signatureValue.toLowerCase();
}

/** Подписывает токен оплаченного заказа для cookie sa_paid. */
export function signPaidToken(invId: number, count: number): string {
  const sig = md5(`${invId}:${count}:${p2()}`);
  return `${invId}:${count}:${sig}`;
}

/** Верифицирует cookie sa_paid. Возвращает {invId, count} или null. */
export function verifyPaidToken(token: string): { invId: number; count: number } | null {
  const parts = token.split(":");
  if (parts.length !== 3) return null;
  const [invIdStr, countStr, sig] = parts;
  const invId = parseInt(invIdStr, 10);
  const count = parseInt(countStr, 10);
  if (!invId || !count) return null;
  const expected = md5(`${invId}:${count}:${p2()}`);
  if (expected.toLowerCase() !== sig.toLowerCase()) return null;
  return { invId, count };
}
