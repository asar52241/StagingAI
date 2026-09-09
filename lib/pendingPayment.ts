export type PendingPayment = { invId: number; outSum: string };

export function readPendingPayment(): PendingPayment | null {
  try {
    const raw = localStorage.getItem("stagingai_pending");
    if (!raw) return null;
    const data = JSON.parse(raw) as PendingPayment;
    if (!data || !Number.isSafeInteger(data.invId) || data.invId <= 0 || typeof data.outSum !== "string") return null;
    return data;
  } catch { return null; }
}

export function clearPendingPayment() {
  try { localStorage.removeItem("stagingai_pending"); } catch { /* Storage may be disabled. */ }
}

export function rememberPaidOrder(payment: PendingPayment) {
  try { sessionStorage.setItem("stagingai_last_order", JSON.stringify(payment)); } catch { /* Storage can be disabled. */ }
}

export function readLastPaidOrder(): PendingPayment | null {
  try {
    const data = JSON.parse(sessionStorage.getItem("stagingai_last_order") ?? "null") as PendingPayment | null;
    return data && Number.isSafeInteger(data.invId) && data.invId > 0 && typeof data.outSum === "string" ? data : null;
  } catch { return null; }
}

export function forgetPaidOrder() {
  try { sessionStorage.removeItem("stagingai_last_order"); } catch { /* Storage can be disabled. */ }
}
