/** Production guardrails for multi-user / mass usage. */
export const LIMITS = {
  /** Active watches allowed per email address */
  MAX_WATCHES_PER_EMAIL: 12,
  /** Global cap on active watches (protects Planyo poll budget) */
  MAX_ACTIVE_WATCHES: 400,
  /** How far ahead a watch date may be (days) */
  MAX_WATCH_AHEAD_DAYS: 14,
  /** Label length */
  MAX_LABEL_LENGTH: 80,
  /** Poll: max distinct slot lookups per run */
  MAX_POLL_SLOT_LOOKUPS: 120,
  /** Rate limits (requests per window) */
  RATE: {
    WINDOW_MS: 60_000,
    AVAILABILITY: 60,
    SLOT: 20,
    WATCHES_WRITE: 10,
    WATCHES_READ: 60,
    NOTIFICATIONS: 60,
  },
} as const;

export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const DISCORD_WEBHOOK_RE =
  /^https:\/\/(discord\.com|discordapp\.com)\/api\/webhooks\/\d+\/[\w-]+$/i;
