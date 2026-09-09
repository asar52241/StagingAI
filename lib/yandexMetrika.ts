"use client";

const YANDEX_METRIKA_ID = 107727165;

type YmFunction = (...args: unknown[]) => void;

type GoalParams = Record<string, string | number | boolean | null | undefined>;

type EcommercePurchaseProduct = {
  id: string;
  name: string;
  price: number;
  quantity: number;
  category?: string;
  brand?: string;
  variant?: string;
};

type EcommercePurchasePayload = {
  orderId: string;
  revenue: number;
  currency?: string;
  products: EcommercePurchaseProduct[];
};

declare global {
  interface Window {
    ym?: YmFunction;
    dataLayer?: Array<Record<string, unknown>>;
  }
}

export function trackMetrikaGoal(target: string, params?: GoalParams) {
  if (typeof window === "undefined" || typeof window.ym !== "function") {
    return;
  }

  try { window.ym(YANDEX_METRIKA_ID, "reachGoal", target, params ?? {}); }
  catch { /* Analytics must never interrupt checkout or processing. */ }
}

export function pushMetrikaPurchase({
  orderId,
  revenue,
  currency = "RUB",
  products,
}: EcommercePurchasePayload) {
  if (typeof window === "undefined") {
    return;
  }

  const storageKey = `stagingai_purchase:${orderId}`;
  try { if (sessionStorage.getItem(storageKey)) return; } catch { /* Storage can be disabled. */ }

  window.dataLayer = window.dataLayer ?? [];
  window.dataLayer.push({
    ecommerce: {
      currencyCode: currency,
      purchase: {
        actionField: {
          id: orderId,
          revenue,
        },
        products,
      },
    },
  });
  try { sessionStorage.setItem(storageKey, "1"); } catch { /* Storage can be disabled. */ }
}
