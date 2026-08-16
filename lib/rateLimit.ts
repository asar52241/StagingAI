/**
 * Rate-limit для /api/payment/create — защита от спама неоплаченными
 * инвойсами. Ключ — хэш IP (не сырой IP), TTL несколько минут:
 * не накопительная база, а транзитное состояние для антифрода.
 */
import { createHash } from "crypto";
import { Redis } from "@upstash/redis";

const redis = Redis.fromEnv();

const WINDOW_SECONDS = 600; // 10 минут
const MAX_REQUESTS = 5;

function hashIp(ip: string): string {
  return createHash("sha256").update(ip).digest("hex");
}

export function getClientIp(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const first = forwardedFor.split(",")[0]?.trim();
    if (first) {
      return first;
    }
  }

  const realIp = request.headers.get("x-real-ip");
  if (realIp) {
    return realIp.trim();
  }

  return "unknown";
}

export async function checkRateLimit(ip: string): Promise<{ allowed: boolean; retryAfterSeconds: number }> {
  const key = `ratelimit:payment-create:${hashIp(ip)}`;
  const count = await redis.incr(key);
  if (count === 1) {
    await redis.expire(key, WINDOW_SECONDS);
  }
  if (count > MAX_REQUESTS) {
    const ttl = await redis.ttl(key);
    return { allowed: false, retryAfterSeconds: Math.max(1, ttl) };
  }
  return { allowed: true, retryAfterSeconds: 0 };
}
