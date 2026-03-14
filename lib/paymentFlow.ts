export const PENDING_PAYMENT_KEY = "stagingai_pending";
export const PAYMENT_RETURN_EVENT_KEY = "stagingai_payment_return";
export const STUDIO_TAB_MARKER_KEY = "stagingai_studio_tab";

export type PendingPaymentStage = "awaiting_payment" | "processing";

export interface PendingPaymentData {
  invId: number;
  outSum: string;
  paymentUrl?: string;
  isTest?: boolean;
  stage: PendingPaymentStage;
}

export interface PaymentReturnEventPayload {
  search: string;
  ts: number;
}

export function parsePendingPayment(raw: string | null): PendingPaymentData | null {
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<PendingPaymentData>;
    const invId = Number(parsed.invId);
    const outSum = typeof parsed.outSum === "string" ? parsed.outSum : "";
    if (!Number.isInteger(invId) || invId <= 0 || !outSum) return null;

    return {
      invId,
      outSum,
      paymentUrl: typeof parsed.paymentUrl === "string" ? parsed.paymentUrl : undefined,
      isTest: parsed.isTest === true,
      stage: parsed.stage === "processing" ? "processing" : "awaiting_payment",
    };
  } catch {
    return null;
  }
}

export function parsePaymentReturnEvent(raw: string | null): PaymentReturnEventPayload | null {
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<PaymentReturnEventPayload>;
    if (typeof parsed.search !== "string" || typeof parsed.ts !== "number") return null;
    return { search: parsed.search, ts: parsed.ts };
  } catch {
    return null;
  }
}
