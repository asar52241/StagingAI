/**
 * Server-side paid-order ledger. The paid cookie identifies an invoice; Redis
 * is the source of truth for its used and in-flight generation quota.
 */
import { Redis } from "@upstash/redis";

const redis = Redis.fromEnv();

const ORDER_TTL_SECONDS = 48 * 60 * 60;
const RESERVATION_TTL_MS = 15 * 60 * 1000;
const RESERVATION_TTL_SECONDS = Math.ceil(RESERVATION_TTL_MS / 1000);

function orderKey(invId: number): string {
  return `order:${invId}`;
}

function reservationKey(invId: number, reservationId: string): string {
  return `order:${invId}:reservation:${reservationId}`;
}

function reservationKeyPrefix(invId: number): string {
  return `order:${invId}:reservation:`;
}

function reservationsKey(invId: number): string {
  return `order:${invId}:reservations`;
}

const ENSURE_ORDER_SCRIPT = `
local key = KEYS[1]
if redis.call('EXISTS', key) == 0 then
  redis.call('HSET', key, 'quota', ARGV[1], 'used', 0, 'reserved', 0, 'createdAt', ARGV[2])
  redis.call('EXPIRE', key, ARGV[3])
elseif redis.call('HGET', key, 'reserved') == false then
  redis.call('HSET', key, 'reserved', 0)
end
return 1
`;

// Removes expired pending reservations before every mutation. A sorted set is
// used in addition to expiring keys so the aggregate `reserved` count cannot
// leak when a function crashes or a key TTL elapses.
const RESERVE_ORDER_SCRIPT = `
local orderKey = KEYS[1]
local reservationsKey = KEYS[2]
local reservationKey = KEYS[3]
local now = tonumber(ARGV[1])
local count = tonumber(ARGV[2])
local expiresAt = tonumber(ARGV[3])
local ttl = tonumber(ARGV[4])
local reservationId = ARGV[5]
local reservationKeyPrefix = ARGV[6]

local expired = redis.call('ZRANGEBYSCORE', reservationsKey, '-inf', now)
for _, id in ipairs(expired) do
  local expiredCount = tonumber(redis.call('GET', reservationKeyPrefix .. id)) or 0
  redis.call('DEL', reservationKeyPrefix .. id)
  if expiredCount > 0 then redis.call('HINCRBY', orderKey, 'reserved', -expiredCount) end
end
if #expired > 0 then redis.call('ZREMRANGEBYSCORE', reservationsKey, '-inf', now) end

if redis.call('EXISTS', orderKey) == 0 then return -1 end
local quota = tonumber(redis.call('HGET', orderKey, 'quota')) or 0
local used = tonumber(redis.call('HGET', orderKey, 'used')) or 0
local reserved = tonumber(redis.call('HGET', orderKey, 'reserved')) or 0
if used + reserved + count > quota then return -1 end

redis.call('SET', reservationKey, count, 'EX', ttl)
redis.call('ZADD', reservationsKey, expiresAt, reservationId)
redis.call('EXPIRE', reservationsKey, ${ORDER_TTL_SECONDS})
redis.call('HINCRBY', orderKey, 'reserved', count)
return quota - used - reserved - count
`;

const COMPLETE_RESERVATION_SCRIPT = `
local orderKey = KEYS[1]
local reservationsKey = KEYS[2]
local reservationKey = KEYS[3]
local reservationId = ARGV[1]
local count = tonumber(redis.call('GET', reservationKey))
if not count then return -1 end
if redis.call('ZREM', reservationsKey, reservationId) == 0 then return -1 end
redis.call('DEL', reservationKey)
redis.call('HINCRBY', orderKey, 'reserved', -count)
local used = redis.call('HINCRBY', orderKey, 'used', count)
local quota = tonumber(redis.call('HGET', orderKey, 'quota')) or 0
return quota - used
`;

const RELEASE_RESERVATION_SCRIPT = `
local orderKey = KEYS[1]
local reservationsKey = KEYS[2]
local reservationKey = KEYS[3]
local reservationId = ARGV[1]
local count = tonumber(redis.call('GET', reservationKey))
if not count then return 0 end
if redis.call('ZREM', reservationsKey, reservationId) == 0 then return 0 end
redis.call('DEL', reservationKey)
redis.call('HINCRBY', orderKey, 'reserved', -count)
return 1
`;

/** Idempotently creates an order without resetting an existing used quota. */
export async function ensureOrder(invId: number, quota: number): Promise<void> {
  await redis.eval(ENSURE_ORDER_SCRIPT, [orderKey(invId)], [quota, Date.now(), ORDER_TTL_SECONDS]);
}

/** Atomically reserves a photo before a provider call. */
export async function reserveOrder(
  invId: number,
  reservationId: string,
  count = 1,
): Promise<{ ok: boolean; remaining: number }> {
  const now = Date.now();
  const remaining = await redis.eval(
    RESERVE_ORDER_SCRIPT,
    [orderKey(invId), reservationsKey(invId), reservationKey(invId, reservationId)],
    [now, count, now + RESERVATION_TTL_MS, RESERVATION_TTL_SECONDS, reservationId, reservationKeyPrefix(invId)],
  ) as number;
  return { ok: remaining >= 0, remaining };
}

/** Commits a completed generation to paid quota. Returns false if it expired. */
export async function commitOrderReservation(invId: number, reservationId: string): Promise<boolean> {
  const remaining = await redis.eval(
    COMPLETE_RESERVATION_SCRIPT,
    [orderKey(invId), reservationsKey(invId), reservationKey(invId, reservationId)],
    [reservationId],
  ) as number;
  return remaining >= 0;
}

/** Releases an unfulfilled reservation. Safe to call more than once. */
export async function releaseOrderReservation(invId: number, reservationId: string): Promise<void> {
  await redis.eval(
    RELEASE_RESERVATION_SCRIPT,
    [orderKey(invId), reservationsKey(invId), reservationKey(invId, reservationId)],
    [reservationId],
  );
}

export async function getOrder(
  invId: number,
): Promise<{ quota: number; used: number; reserved: number; createdAt: number } | null> {
  const data = await redis.hgetall<{ quota: number; used: number; reserved?: number; createdAt: number }>(orderKey(invId));
  if (!data || data.quota === undefined) return null;
  return { ...data, reserved: data.reserved ?? 0 };
}
