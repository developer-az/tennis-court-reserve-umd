import { LIMITS } from "./limits";

export type WatchStatus = "pending" | "active" | "triggered" | "cancelled";

export interface Watch {
  id: number;
  date: string;
  hour: number;
  label: string | null;
  email: string | null;
  discordWebhook: string | null;
  notifyOnOpen: number;
  notifyOnAvailable: number;
  status: WatchStatus;
  triggeredAt: string | null;
  lastCourtsAvailable: number | null;
  createdAt: string;
}

export interface Notification {
  id: number;
  watchId: number;
  type: "slot_opened" | "court_available" | "fully_booked";
  message: string;
  courtsAvailable: number | null;
  createdAt: string;
}

export interface PollMeta {
  lastPollAt: string | null;
  lastPollOk: boolean;
  lastPollError: string | null;
  lastPollChecked: number;
  lastPollTriggered: number;
}

export interface Store {
  watches: Watch[];
  notifications: Notification[];
  nextWatchId: number;
  nextNotificationId: number;
  verifiedEmails: Record<string, string>;
  unsubscribedEmails: Record<string, string>;
  meta: PollMeta;
}

export function defaultStore(): Store {
  return {
    watches: [],
    notifications: [],
    nextWatchId: 1,
    nextNotificationId: 1,
    verifiedEmails: {},
    unsubscribedEmails: {},
    meta: {
      lastPollAt: null,
      lastPollOk: false,
      lastPollError: null,
      lastPollChecked: 0,
      lastPollTriggered: 0,
    },
  };
}

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

const REDIS_KEY = "umd-tennis:store";
const REDIS_LOCK_KEY = "umd-tennis:store-lock";
const LOCK_TTL_SEC = 8;

let memoryLock: Promise<void> = Promise.resolve();

function normalizeStore(raw: Store): Store {
  const base = defaultStore();
  return {
    ...base,
    ...raw,
    verifiedEmails: raw.verifiedEmails ?? {},
    unsubscribedEmails: raw.unsubscribedEmails ?? {},
    meta: { ...base.meta, ...(raw.meta ?? {}) },
    watches: (raw.watches ?? []).map(normalizeWatch),
    notifications: raw.notifications ?? [],
  };
}

async function readRedisStore(): Promise<Store> {
  const raw = await redisCommand<string | null>("GET", REDIS_KEY);
  if (!raw) {
    const store = defaultStore();
    await writeRedisStore(store);
    return store;
  }
  return normalizeStore(JSON.parse(raw) as Store);
}

async function writeRedisStore(store: Store): Promise<void> {
  await redisCommand("SET", REDIS_KEY, JSON.stringify(store));
}

async function readJsonStore(): Promise<Store> {
  const fs = await import("fs");
  const path = await import("path");
  const DATA_DIR = path.join(process.cwd(), "data");
  const STORE_PATH = path.join(DATA_DIR, "store.json");

  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(STORE_PATH)) {
    const store = defaultStore();
    fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2));
    return store;
  }
  return normalizeStore(JSON.parse(fs.readFileSync(STORE_PATH, "utf-8")) as Store);
}

async function writeJsonStore(store: Store): Promise<void> {
  const fs = await import("fs");
  const path = await import("path");
  const DATA_DIR = path.join(process.cwd(), "data");
  const STORE_PATH = path.join(DATA_DIR, "store.json");
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2));
}

async function readStore(): Promise<Store> {
  if (redisConfigured()) return readRedisStore();
  return readJsonStore();
}

async function writeStore(store: Store): Promise<void> {
  if (redisConfigured()) return writeRedisStore(store);
  return writeJsonStore(store);
}

async function acquireLock(): Promise<() => Promise<void>> {
  if (redisConfigured()) {
    const token = `${Date.now()}-${Math.random()}`;
    for (let i = 0; i < 12; i++) {
      const ok = await redisCommand<string | null>("SET", REDIS_LOCK_KEY, token, "EX", LOCK_TTL_SEC, "NX");
      if (ok === "OK") {
        return async () => {
          const current = await redisCommand<string | null>("GET", REDIS_LOCK_KEY);
          if (current === token) await redisCommand("DEL", REDIS_LOCK_KEY);
        };
      }
      await new Promise((r) => setTimeout(r, 40 + i * 20));
    }
    throw new Error("Could not acquire store lock — try again");
  }

  let release!: () => void;
  const prev = memoryLock;
  memoryLock = new Promise<void>((resolve) => {
    release = resolve;
  });
  await prev;
  return async () => release();
}

async function withStoreUpdate<T>(mutator: (store: Store) => T): Promise<T> {
  const release = await acquireLock();
  try {
    const store = await readStore();
    const result = mutator(store);
    await writeStore(store);
    return result;
  } finally {
    await release();
  }
}

function normalizeWatch(w: Watch): Watch {
  return {
    ...w,
    email: w.email ?? null,
    lastCourtsAvailable: w.lastCourtsAvailable ?? null,
    status: w.status ?? "active",
  };
}

export function emailVerificationRequired(): boolean {
  if (process.env.REQUIRE_EMAIL_VERIFY === "false") return false;
  if (process.env.REQUIRE_EMAIL_VERIFY === "true") return true;
  return Boolean(process.env.RESEND_API_KEY);
}

export async function isEmailVerified(email: string): Promise<boolean> {
  const store = await readStore();
  return Boolean(store.verifiedEmails[email.trim().toLowerCase()]);
}

export async function isEmailUnsubscribed(email: string): Promise<boolean> {
  const store = await readStore();
  return Boolean(store.unsubscribedEmails[email.trim().toLowerCase()]);
}

export async function createWatch(input: {
  date: string;
  hour: number;
  label?: string;
  email?: string;
  discordWebhook?: string;
  notifyOnOpen?: boolean;
  notifyOnAvailable?: boolean;
}): Promise<{ watch: Watch; needsVerification: boolean }> {
  return withStoreUpdate((store) => {
    const email = input.email?.trim().toLowerCase() || null;

    if (email && store.unsubscribedEmails[email] && !emailVerificationRequired()) {
      throw new Error("This email is unsubscribed. Enable email verification (Resend) to opt back in.");
    }

    const live = store.watches.filter((w) => w.status === "active" || w.status === "pending");
    const activeOnly = store.watches.filter((w) => w.status === "active");
    if (activeOnly.length >= LIMITS.MAX_ACTIVE_WATCHES) {
      throw new Error(`Service is at capacity (${LIMITS.MAX_ACTIVE_WATCHES} active watches). Try again later.`);
    }
    if (email) {
      const forEmail = live.filter((w) => w.email === email).length;
      if (forEmail >= LIMITS.MAX_WATCHES_PER_EMAIL) {
        throw new Error(`Limit of ${LIMITS.MAX_WATCHES_PER_EMAIL} active watches per email reached`);
      }
    }

    const duplicate = store.watches.find(
      (w) =>
        (w.status === "active" || w.status === "pending") &&
        w.date === input.date &&
        w.hour === input.hour &&
        (w.email ?? null) === email
    );
    if (duplicate) throw new Error("UNIQUE constraint failed: active watch for this slot already exists");

    const verified = email ? Boolean(store.verifiedEmails[email]) : true;
    const wasUnsubscribed = Boolean(email && store.unsubscribedEmails[email]);
    const needsVerification = Boolean(
      email && emailVerificationRequired() && (!verified || wasUnsubscribed)
    );
    const status: WatchStatus = needsVerification ? "pending" : "active";

    const watch: Watch = {
      id: store.nextWatchId++,
      date: input.date,
      hour: input.hour,
      label: input.label ?? null,
      email,
      discordWebhook: input.discordWebhook ?? null,
      notifyOnOpen: input.notifyOnOpen !== false ? 1 : 0,
      notifyOnAvailable: input.notifyOnAvailable !== false ? 1 : 0,
      status,
      triggeredAt: null,
      lastCourtsAvailable: null,
      createdAt: new Date().toISOString(),
    };
    store.watches.push(watch);
    return { watch, needsVerification };
  });
}

export async function verifyEmail(email: string): Promise<number> {
  const normalized = email.trim().toLowerCase();
  return withStoreUpdate((store) => {
    store.verifiedEmails[normalized] = new Date().toISOString();
    delete store.unsubscribedEmails[normalized];
    let activated = 0;
    for (const w of store.watches) {
      if (w.email === normalized && w.status === "pending") {
        w.status = "active";
        activated++;
      }
    }
    return activated;
  });
}

export async function unsubscribeEmail(email: string): Promise<number> {
  const normalized = email.trim().toLowerCase();
  return withStoreUpdate((store) => {
    store.unsubscribedEmails[normalized] = new Date().toISOString();
    delete store.verifiedEmails[normalized];
    let cancelled = 0;
    for (const w of store.watches) {
      if (w.email === normalized && (w.status === "active" || w.status === "pending")) {
        w.status = "cancelled";
        cancelled++;
      }
    }
    return cancelled;
  });
}

export async function getWatchById(id: number): Promise<Watch | null> {
  const store = await readStore();
  const watch = store.watches.find((w) => w.id === id);
  return watch ? normalizeWatch(watch) : null;
}

export async function getActiveWatches(): Promise<Watch[]> {
  const store = await readStore();
  return store.watches
    .filter((w) => w.status === "active")
    .map(normalizeWatch)
    .sort((a, b) => a.date.localeCompare(b.date) || a.hour - b.hour);
}

export async function getAllWatches(): Promise<Watch[]> {
  const store = await readStore();
  return store.watches
    .map(normalizeWatch)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getWatchesByEmail(email: string): Promise<Watch[]> {
  const normalized = email.trim().toLowerCase();
  const store = await readStore();
  return store.watches
    .filter((w) => w.email === normalized)
    .map(normalizeWatch)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function countActiveWatches(): Promise<number> {
  const store = await readStore();
  return store.watches.filter((w) => w.status === "active").length;
}

export async function cancelWatch(id: number, email?: string): Promise<boolean> {
  return withStoreUpdate((store) => {
    const watch = store.watches.find(
      (w) => w.id === id && (w.status === "active" || w.status === "pending")
    );
    if (!watch) return false;
    if (email) {
      const normalized = email.trim().toLowerCase();
      if (watch.email !== normalized) return false;
    }
    watch.status = "cancelled";
    return true;
  });
}

export async function markWatchTriggered(id: number): Promise<void> {
  await withStoreUpdate((store) => {
    const watch = store.watches.find((w) => w.id === id);
    if (watch) {
      watch.status = "triggered";
      watch.triggeredAt = new Date().toISOString();
    }
  });
}

export async function addNotification(input: {
  watchId: number;
  type: Notification["type"];
  message: string;
  courtsAvailable?: number;
}): Promise<Notification> {
  return withStoreUpdate((store) => {
    const notification: Notification = {
      id: store.nextNotificationId++,
      watchId: input.watchId,
      type: input.type,
      message: input.message,
      courtsAvailable: input.courtsAvailable ?? null,
      createdAt: new Date().toISOString(),
    };
    store.notifications.push(notification);
    return notification;
  });
}

export async function updateWatchAvailability(id: number, courtsAvailable: number): Promise<void> {
  await withStoreUpdate((store) => {
    const watch = store.watches.find((w) => w.id === id);
    if (watch) watch.lastCourtsAvailable = courtsAvailable;
  });
}

export async function getRecentNotifications(
  limit = 50,
  email?: string
): Promise<(Notification & { date: string; hour: number })[]> {
  const store = await readStore();
  const normalized = email?.trim().toLowerCase();
  return store.notifications
    .slice()
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((n) => {
      const watch = store.watches.find((w) => w.id === n.watchId);
      return { ...n, date: watch?.date ?? "", hour: watch?.hour ?? 0, email: watch?.email ?? null };
    })
    .filter((n) => (normalized ? n.email === normalized : true))
    .slice(0, limit)
    .map(({ email: _email, ...rest }) => rest);
}

export async function recordPollResult(input: {
  ok: boolean;
  checked: number;
  triggered: number;
  error?: string;
}): Promise<PollMeta> {
  return withStoreUpdate((store) => {
    store.meta = {
      lastPollAt: new Date().toISOString(),
      lastPollOk: input.ok,
      lastPollError: input.error ?? null,
      lastPollChecked: input.checked,
      lastPollTriggered: input.triggered,
    };
    return store.meta;
  });
}

export async function getPollMeta(): Promise<PollMeta> {
  const store = await readStore();
  return store.meta;
}

export async function pruneStore(now = new Date()): Promise<{ watches: number; notifications: number }> {
  return withStoreUpdate((store) => {
    const watchCutoff = now.getTime() - LIMITS.WATCH_RETENTION_DAYS * 24 * 60 * 60 * 1000;
    const notifCutoff = now.getTime() - LIMITS.NOTIFICATION_RETENTION_DAYS * 24 * 60 * 60 * 1000;

    const beforeW = store.watches.length;
    store.watches = store.watches.filter((w) => {
      if (w.status === "active" || w.status === "pending") return true;
      const end = new Date(`${w.date}T${String(w.hour).padStart(2, "0")}:00:00`).getTime();
      const ref = Number.isFinite(end) ? end : new Date(w.createdAt).getTime();
      return ref >= watchCutoff;
    });

    const beforeN = store.notifications.length;
    store.notifications = store.notifications.filter((n) => new Date(n.createdAt).getTime() >= notifCutoff);

    return {
      watches: beforeW - store.watches.length,
      notifications: beforeN - store.notifications.length,
    };
  });
}

export function storageBackend(): "redis" | "json" {
  return redisConfigured() ? "redis" : "json";
}
