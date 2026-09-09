import { createHash } from "node:crypto";
import { isIP } from "node:net";
import { LEGAL } from "@/config/legal";
import { getServerStore, mutateRecord } from "@/lib/serverStore";

export class RequestError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export function siteOrigin(): string {
  const url = new URL(LEGAL.siteUrl);
  if (url.username || url.password || (url.protocol !== "https:" &&
      !(process.env.NODE_ENV !== "production" && url.protocol === "http:"))) {
    throw new Error("Invalid site URL configuration");
  }
  return url.origin;
}

export function requireSameOrigin(request: Request): void {
  const origin = request.headers.get("origin");
  const site = request.headers.get("sec-fetch-site");
  if (site === "cross-site" || (origin && origin !== siteOrigin() &&
      !(process.env.NODE_ENV !== "production" && origin === new URL(request.url).origin))) {
    throw new RequestError(403, "Cross-origin request rejected");
  }
}

export function readCookie(request: Request, name: string): string | null {
  const entry = request.headers.get("cookie")?.split(";").map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`));
  if (!entry) return null;
  try { return decodeURIComponent(entry.slice(name.length + 1)); } catch { return null; }
}

/** Enforce the limit while reading, even without (or with a forged) Content-Length. */
export async function readLimitedBody(request: Pick<Request, "headers" | "body">, maxBytes: number, timeoutMs = 30_000): Promise<Uint8Array> {
  const length = request.headers.get("content-length");
  if (length && (!/^\d+$/.test(length) || Number(length) > maxBytes)) {
    throw new RequestError(413, "Request body too large");
  }
  const reader = request.body?.getReader();
  if (!reader) return new Uint8Array();
  const chunks: Uint8Array[] = [];
  let size = 0;
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    void reader.cancel().catch(() => {});
  }, timeoutMs);
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (timedOut) throw new RequestError(408, "Request body timed out");
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {
        await reader.cancel();
        throw new RequestError(413, "Request body too large");
      }
      chunks.push(value);
    }
  } finally { clearTimeout(timer); reader.releaseLock(); }
  const body = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.byteLength; }
  return body;
}

/** Only trust a header that the hosting proxy overwrites, never arbitrary X-Forwarded-For. */
export function clientAddress(request: Request): string {
  const header = process.env.TRUSTED_IP_HEADER?.trim() || (process.env.VERCEL === "1" ? "x-vercel-forwarded-for" : "");
  const value = header ? request.headers.get(header)?.split(",")[0]?.trim() : undefined;
  return value && isIP(value) ? value : "shared";
}

export async function rateLimit(key: string, max: number, windowMs = 60_000): Promise<boolean> {
  const hash = createHash("sha256").update(key).digest("hex");
  return mutateRecord<{ count: number; expiresAt: number }, boolean>(getServerStore(), `stagingai:rate:${hash}`, (current) => {
    const now = Date.now();
    const value = current && current.expiresAt > now ? current : { count: 0, expiresAt: now + windowMs };
    if (value.count >= max) return { result: false };
    value.count++;
    return { value, expiresAt: value.expiresAt, result: true };
  });
}
