import { PLANYO } from "./constants";
import { DATE_RE, DISCORD_WEBHOOK_RE, EMAIL_RE, LIMITS } from "./limits";

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isValidEmail(email: string): boolean {
  return EMAIL_RE.test(normalizeEmail(email));
}

export function isValidDate(date: string): boolean {
  if (!DATE_RE.test(date)) return false;
  const [y, m, d] = date.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

export function isWatchDateAllowed(date: string, now = new Date()): boolean {
  if (!isValidDate(date)) return false;
  const [y, m, d] = date.split("-").map(Number);
  const slotDay = new Date(y, m - 1, d);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const max = new Date(today);
  max.setDate(max.getDate() + LIMITS.MAX_WATCH_AHEAD_DAYS);
  return slotDay >= today && slotDay <= max;
}

export function isValidHour(hour: number): boolean {
  return Number.isInteger(hour) && hour >= PLANYO.FIRST_HOUR && hour < PLANYO.LAST_HOUR;
}

export function isValidDiscordWebhook(url: string): boolean {
  return DISCORD_WEBHOOK_RE.test(url.trim());
}

export function sanitizeLabel(label: unknown): string | undefined {
  if (typeof label !== "string") return undefined;
  const trimmed = label.trim().slice(0, LIMITS.MAX_LABEL_LENGTH);
  return trimmed || undefined;
}
