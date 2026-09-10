import { createHmac, timingSafeEqual } from "crypto";
import { LIMITS } from "./limits";

export type EmailTokenAction = "verify" | "unsubscribe";

export interface EmailTokenPayload {
  email: string;
  action: EmailTokenAction;
  exp: number;
}

function tokenSecret(): string {
  const secret = process.env.TOKEN_SECRET || process.env.CRON_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("TOKEN_SECRET or CRON_SECRET is required to sign email links");
    }
    return "dev-insecure-token-secret";
  }
  return secret;
}

function b64url(input: Buffer | string): string {
  const buf = typeof input === "string" ? Buffer.from(input, "utf8") : input;
  return buf.toString("base64url");
}

function sign(payloadB64: string): string {
  return createHmac("sha256", tokenSecret()).update(payloadB64).digest("base64url");
}

export function createEmailToken(
  email: string,
  action: EmailTokenAction,
  ttlSec = LIMITS.EMAIL_TOKEN_TTL_SEC
): string {
  const payload: EmailTokenPayload = {
    email: email.trim().toLowerCase(),
    action,
    exp: Math.floor(Date.now() / 1000) + ttlSec,
  };
  const payloadB64 = b64url(JSON.stringify(payload));
  return `${payloadB64}.${sign(payloadB64)}`;
}

export function verifyEmailToken(
  token: string,
  expectedAction?: EmailTokenAction
): EmailTokenPayload | null {
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [payloadB64, sig] = parts;
  if (!payloadB64 || !sig) return null;

  const expected = sign(payloadB64);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  try {
    const payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8")) as EmailTokenPayload;
    if (!payload.email || !payload.action || !payload.exp) return null;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    if (expectedAction && payload.action !== expectedAction) return null;
    return payload;
  } catch {
    return null;
  }
}
