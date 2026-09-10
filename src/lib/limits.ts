/** Production guardrails for multi-user / mass usage. */
export const LIMITS = {
  /** Active + pending watches allowed per email address */
  MAX_WATCHES_PER_EMAIL: 12,
  /** Global cap on active watches (protects Planyo poll budget) */
  MAX_ACTIVE_WATCHES: 400,
  /** How far ahead a watch date may be (days) */
  MAX_WATCH_AHEAD_DAYS: 14,
  /** Label length */
  MAX_LABEL_LENGTH: 80,
  /** Poll: max distinct slot lookups per run */
  MAX_POLL_SLOT_LOOKUPS: 120,
  /** Notification cooldown (cross-instance via Redis when available) */
  NOTIFY_COOLDOWN_MS: 5 * 60 * 1000,
  /** Poll considered stale after this (minute cron expected) */
  POLL_STALE_MS: 10 * 60 * 1000,
  POLL_DOWN_MS: 30 * 60 * 1000,
  /** Retention */
  NOTIFICATION_RETENTION_DAYS: 30,
  WATCH_RETENTION_DAYS: 14,
  /** Signed email token lifetime */
  EMAIL_TOKEN_TTL_SEC: 60 * 60 * 48,
  /** Rate limits (requests per window) */
  RATE: {
    WINDOW_MS: 60_000,
    AVAILABILITY: 60,
    SLOT: 20,
    WATCHES_WRITE: 10,
    WATCHES_READ: 60,
    NOTIFICATIONS: 60,
    VERIFY: 20,
  },
} as const;

export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const DISCORD_WEBHOOK_RE =
  /^https:\/\/(discord\.com|discordapp\.com)\/api\/webhooks\/\d+\/[\w-]+$/i;
