import { LIMITS } from "./limits";

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

const memoryCooldowns = new Map<string, number>();

/** Returns true if this notification is allowed (sets cooldown when allowed). */
export async function claimNotifyCooldown(watchId: number, type: string): Promise<boolean> {
  const key = `umd-tennis:cooldown:${watchId}:${type}`;
  const ttlSec = Math.ceil(LIMITS.NOTIFY_COOLDOWN_MS / 1000);

  if (redisConfigured()) {
    try {
      // SET key 1 NX EX — only first caller wins across instances
      const result = await redisCommand<string | null>("SET", key, "1", "EX", ttlSec, "NX");
      return result === "OK";
    } catch {
      // fall through to memory
    }
  }

  const now = Date.now();
  const last = memoryCooldowns.get(key);
  if (last && now - last < LIMITS.NOTIFY_COOLDOWN_MS) return false;
  memoryCooldowns.set(key, now);
  return true;
}
