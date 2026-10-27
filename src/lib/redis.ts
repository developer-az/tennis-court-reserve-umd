export function redisCredentials(
  env: NodeJS.ProcessEnv = process.env
): { url: string; token: string } | null {
  const url = env.UPSTASH_REDIS_REST_URL || env.KV_REST_API_URL;
  const token = env.UPSTASH_REDIS_REST_TOKEN || env.KV_REST_API_TOKEN;
  if (!url || !token) return null;
  return { url, token };
}

export function redisConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  return redisCredentials(env) !== null;
}

export async function redisCommand<T>(...args: (string | number)[]): Promise<T> {
  const creds = redisCredentials();
  if (!creds) throw new Error("Redis is not configured");
  const { url, token } = creds;

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

  const data = (await res.json()) as { result: T; error?: string };
  if (data.error) throw new Error(data.error);
  return data.result;
}
