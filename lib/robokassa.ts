import { createHash, createHmac, randomInt, timingSafeEqual } from "node:crypto";

export const IS_TEST = process.env.ROBOKASSA_TEST === "true";

function required(name: string): string {
  const value = process.env[name];
  if (!value?.trim()) throw new Error(`Missing server configuration: ${name}`);
  return value;
}
const password = (number: 1 | 2) => required(`ROBOKASSA_${IS_TEST ? "TEST_" : ""}PASSWORD${number}`);
const tokenSecret = () => {
  const secret = required("PAYMENT_TOKEN_SECRET");
  if (secret.length < 32) throw new Error("PAYMENT_TOKEN_SECRET must contain at least 32 characters");
  return secret;
};

export function assertPaymentConfiguration() {
  required("ROBOKASSA_LOGIN");
  password(1);
  password(2);
  tokenSecret();
}

function md5(value: string): string {
  // Robokassa protocol requires the algorithm selected in the merchant settings.
  return createHash("md5").update(value, "utf8").digest("hex");
}

function equalHex(expected: string, actual: string): boolean {
  return /^[a-f0-9]+$/i.test(actual) && actual.length === expected.length &&
    timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(actual, "hex"));
}

export function parseInvoiceId(value: string): number | null {
  if (!/^[1-9]\d{0,15}$/.test(value)) return null;
  const id = Number(value);
  return Number.isSafeInteger(id) ? id : null;
}

/** Accept exact decimal amounts, including Robokassa's trailing fractional zeroes. */
export function parseAmountCents(value: string): number | null {
  if (!/^\d{1,10}(?:\.\d{1,6})?$/.test(value)) return null;
  const [whole, fraction = ""] = value.split(".");
  if (/[1-9]/.test(fraction.slice(2))) return null;
  const cents = Number(whole) * 100 + Number(fraction.slice(0, 2).padEnd(2, "0"));
  return Number.isSafeInteger(cents) && cents > 0 ? cents : null;
}

/** Time component prevents old expired invoice IDs from being reused. Storage detects collisions. */
export function generateInvId(): number {
  return Date.now() * 1000 + randomInt(1000);
}

export function buildPaymentUrl(outSum: number, invId: number, description: string, receipt: object, origin: string): string {
  const login = required("ROBOKASSA_LOGIN");
  const amount = outSum.toFixed(2);
  const receiptJson = JSON.stringify(receipt);
  const receiptEncoded = encodeURIComponent(receiptJson);
  const success = `${origin}/studio?paid=true`;
  const failure = `${origin}/studio?paid=false`;
  // Sign the Receipt value Robokassa receives after decoding the query once.
  // Signing the percent-encoded text but sending it encoded only once causes error 29.
  const signature = md5(`${login}:${amount}:${invId}:${receiptJson}:${password(1)}`);
  const params = new URLSearchParams({
    MerchantLogin: login, OutSum: amount, InvId: String(invId), Description: description,
    SignatureValue: signature, IsTest: IS_TEST ? "1" : "0", Culture: "ru", Encoding: "utf-8",
  });
  // Encode these values once, preserving %20 in the receipt. Return URLs use
  // the configured site origin; never use request forwarding headers here.
  return `https://auth.robokassa.ru/Merchant/Index.aspx?${params}&Receipt=${receiptEncoded}&SuccessURL=${encodeURIComponent(success)}&FailURL=${encodeURIComponent(failure)}`;
}

export function verifyResultSignature(outSum: string, invId: string, signature: string): boolean {
  return equalHex(md5(`${outSum}:${invId}:${password(2)}`), signature);
}

export function verifySuccessSignature(outSum: string, invId: string, signature: string): boolean {
  // Never round/normalize signed data before verification.
  return equalHex(md5(`${outSum}:${invId}:${password(1)}`), signature);
}

export function buildStatusUrl(invId: number): string {
  const login = required("ROBOKASSA_LOGIN");
  const params = new URLSearchParams({
    MerchantLogin: login, InvoiceID: String(invId), Signature: md5(`${login}:${invId}:${password(2)}`),
  });
  return `https://auth.robokassa.ru/Merchant/WebService/Service.asmx/OpStateExt?${params}`;
}

export type OrderToken = { invId: number; owner: string; expiresAt: number };
type TokenKind = "order" | "paid";

export function signOrderToken(kind: TokenKind, payload: OrderToken): string {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = createHmac("sha256", tokenSecret()).update(`stagingai:v1:${kind}:${body}`).digest("hex");
  return `${body}.${signature}`;
}

export function verifyOrderToken(kind: TokenKind, token: string): OrderToken | null {
  if (token.length > 1024) return null;
  const [body, signature, extra] = token.split(".");
  if (!body || !signature || extra !== undefined || !/^[A-Za-z0-9_-]+$/.test(body)) return null;
  const expected = createHmac("sha256", tokenSecret()).update(`stagingai:v1:${kind}:${body}`).digest("hex");
  if (!equalHex(expected, signature)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as OrderToken;
    if (!payload || !Number.isSafeInteger(payload.invId) || payload.invId <= 0 ||
        typeof payload.owner !== "string" || !/^[a-f0-9]{64}$/.test(payload.owner) ||
        !Number.isSafeInteger(payload.expiresAt) || payload.expiresAt <= Date.now()) return null;
    return payload;
  } catch { return null; }
}
