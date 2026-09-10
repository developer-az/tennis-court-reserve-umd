import { LIMITS } from "./limits";

type Bucket = { count: number; resetAt: number };

const memory = new Map<string, Bucket>();

function redisConfigured(): boolean {
  return Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
}

async function redisCommand<T>(...args: (string | number)[]): Promise<T> {
  const url = process.env.UPSTASH_REDIS_REST_URL!;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN!;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(args),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Redis error: ${res.status}`);
  const data = (await res.json()) as { result: T };
  return data.result;
}

async function redisIncr(key: string, windowMs: number): Promise<{ count: number; resetAt: number }> {
  const redisKey = `umd-tennis:rl:${key}`;
  const ttlSec = Math.max(1, Math.ceil(windowMs / 1000));
  const count = await redisCommand<number>("INCR", redisKey);
  if (count === 1) {
    await redisCommand("EXPIRE", redisKey, ttlSec);
  }
  const pttl = await redisCommand<number>("PTTL", redisKey);
  const resetAt = Date.now() + (pttl > 0 ? pttl : windowMs);
  return { count, resetAt };
}

function memoryIncr(key: string, windowMs: number): { count: number; resetAt: number } {
  const now = Date.now();
  const existing = memory.get(key);
  if (!existing || existing.resetAt <= now) {
    const bucket = { count: 1, resetAt: now + windowMs };
    memory.set(key, bucket);
    return bucket;
  }
  existing.count += 1;
  return existing;
}

export type RateLimitResult = {
  ok: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
};

/** Fixed-window rate limit. Uses Redis when configured (multi-instance safe). */
export async function rateLimit(
  key: string,
  limit: number,
  windowMs = LIMITS.RATE.WINDOW_MS
): Promise<RateLimitResult> {
  try {
    const { count, resetAt } = redisConfigured()
      ? await redisIncr(key, windowMs)
      : memoryIncr(key, windowMs);
    return {
      ok: count <= limit,
      limit,
      remaining: Math.max(0, limit - count),
      resetAt,
    };
  } catch {
    const { count, resetAt } = memoryIncr(key, windowMs);
    return {
      ok: count <= limit,
      limit,
      remaining: Math.max(0, limit - count),
      resetAt,
    };
  }
}

export function clientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || "unknown";
  return req.headers.get("x-real-ip") ?? "unknown";
}

export function rateLimitHeaders(result: RateLimitResult): Record<string, string> {
  return {
    "X-RateLimit-Limit": String(result.limit),
    "X-RateLimit-Remaining": String(result.remaining),
    "X-RateLimit-Reset": String(Math.ceil(result.resetAt / 1000)),
  };
}
