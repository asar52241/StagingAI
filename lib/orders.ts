/**
 * Серверный учёт квоты заказа. Единственный источник истины о том,
 * сколько фото оплачено и сколько уже обработано — cookie sa_paid
 * подтверждает только личность заказа (invId), количество живёт здесь.
 */
import { Redis } from "@upstash/redis";

const redis = Redis.fromEnv();

const ORDER_TTL_SECONDS = 48 * 60 * 60; // 48ч — заказ, не использованный сутки, можно не хранить дольше

function orderKey(invId: number): string {
  return `order:${invId}`;
}

const ENSURE_ORDER_SCRIPT = `
local key = KEYS[1]
if redis.call('EXISTS', key) == 0 then
  redis.call('HSET', key, 'quota', ARGV[1], 'used', 0, 'createdAt', ARGV[2])
  redis.call('EXPIRE', key, ARGV[3])
end
return 1
`;

const CONSUME_ORDER_SCRIPT = `
local key = KEYS[1]
local count = tonumber(ARGV[1])
if redis.call('EXISTS', key) == 0 then
  return -1
end
local quota = tonumber(redis.call('HGET', key, 'quota'))
local used = tonumber(redis.call('HGET', key, 'used'))
if used + count > quota then
  return -1
end
local newUsed = redis.call('HINCRBY', key, 'used', count)
return quota - newUsed
`;

/** Идемпотентно создаёт запись заказа. Повторные вызовы с тем же invId не сбрасывают used. */
export async function ensureOrder(invId: number, quota: number): Promise<void> {
  await redis.eval(ENSURE_ORDER_SCRIPT, [orderKey(invId)], [quota, Date.now(), ORDER_TTL_SECONDS]);
}

/** Атомарно резервирует `count` фото из квоты заказа. remaining=-1, если заказа нет или квота исчерпана. */
export async function consumeOrder(
  invId: number,
  count = 1,
): Promise<{ ok: boolean; remaining: number }> {
  const remaining = (await redis.eval(CONSUME_ORDER_SCRIPT, [orderKey(invId)], [count])) as number;
  return { ok: remaining >= 0, remaining };
}

export async function getOrder(
  invId: number,
): Promise<{ quota: number; used: number; createdAt: number } | null> {
  const data = await redis.hgetall<{ quota: number; used: number; createdAt: number }>(orderKey(invId));
  if (!data || data.quota === undefined) return null;
  return data;
}
