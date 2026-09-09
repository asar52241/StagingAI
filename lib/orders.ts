import { randomBytes } from "node:crypto";
import { LEGAL } from "@/config/legal";
import { getOrderPrice } from "@/lib/pricing";
import { generateInvId, IS_TEST } from "@/lib/robokassa";
import { type AtomicStore, getServerStore, mutateRecord } from "@/lib/serverStore";

export const ORDER_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000;
export const PAID_LIFETIME_MS = 24 * 60 * 60 * 1000;

export interface Order {
  invId: number;
  owner: string;
  count: number;
  amountCents: number;
  isTest: boolean;
  expiresAt: number;
  paidUntil?: number;
  photos: Record<string, { attempts: number; activeUntil: number; requestId: string }>;
}

const orderKey = (invId: number) => `stagingai:order:${invId}`;

export async function createOrder(count: number, store: AtomicStore = getServerStore()): Promise<Order> {
  if (!Number.isInteger(count) || count < LEGAL.minPhotosPerOrder || count > LEGAL.maxPhotosPerOrder) {
    throw new Error("Invalid photo count");
  }
  for (let attempt = 0; attempt < 5; attempt++) {
    const order: Order = {
      invId: generateInvId(), owner: randomBytes(32).toString("hex"), count,
      amountCents: getOrderPrice(count) * 100, isTest: IS_TEST,
      expiresAt: Date.now() + ORDER_LIFETIME_MS, photos: {},
    };
    if (await store.compareAndSet(orderKey(order.invId), null, JSON.stringify(order), order.expiresAt)) return order;
  }
  throw new Error("Could not allocate invoice");
}

export async function getOrder(invId: number, store: AtomicStore = getServerStore()): Promise<Order | null> {
  const raw = await store.get(orderKey(invId));
  if (!raw) return null;
  const order = JSON.parse(raw) as Order;
  return order.expiresAt > Date.now() ? order : null;
}

/** Idempotent: callbacks/status checks never refill the quota or extend payment access. */
export async function markOrderPaid(invId: number, amountCents: number, store: AtomicStore = getServerStore()) {
  return mutateRecord<Order, Order | null>(store, orderKey(invId), (order) => {
    if (!order || order.expiresAt <= Date.now() || order.amountCents !== amountCents || order.isTest !== IS_TEST) {
      return { result: null };
    }
    if (order.paidUntil) return { result: order };
    order.paidUntil = Math.min(Date.now() + PAID_LIFETIME_MS, order.expiresAt);
    return { value: order, expiresAt: order.expiresAt, result: order };
  });
}

export type Reservation = "ok" | "payment_required" | "quota_exhausted" | "busy";

/** Each source photo gets one generation and one retry, including failed upstream attempts. */
export async function reserveProcessing(
  invId: number, owner: string, fingerprint: string, requestId: string,
  store: AtomicStore = getServerStore(),
): Promise<Reservation> {
  return mutateRecord<Order, Reservation>(store, orderKey(invId), (order) => {
    const now = Date.now();
    if (!order || order.owner !== owner || !order.paidUntil || order.paidUntil <= now || order.isTest !== IS_TEST) {
      return { result: "payment_required" };
    }
    const previous = order.photos[fingerprint];
    if (previous?.activeUntil > now) return { result: "busy" };
    if (previous ? previous.attempts >= 2 : Object.keys(order.photos).length >= order.count) {
      return { result: "quota_exhausted" };
    }
    order.photos[fingerprint] = { attempts: (previous?.attempts ?? 0) + 1, activeUntil: now + 300_000, requestId };
    return { value: order, expiresAt: order.expiresAt, result: "ok" };
  });
}

export async function finishProcessing(invId: number, fingerprint: string, requestId: string, store = getServerStore()) {
  await mutateRecord<Order, void>(store, orderKey(invId), (order) => {
    if (!order || order.photos[fingerprint]?.requestId !== requestId) return { result: undefined };
    order.photos[fingerprint].activeUntil = 0;
    return { value: order, expiresAt: order.expiresAt, result: undefined };
  });
}
