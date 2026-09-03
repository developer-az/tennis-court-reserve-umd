export interface Watch {
  id: number;
  date: string;
  hour: number;
  label: string | null;
  email: string | null;
  discordWebhook: string | null;
  notifyOnOpen: number;
  notifyOnAvailable: number;
  status: "active" | "triggered" | "cancelled";
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

export interface Store {
  watches: Watch[];
  notifications: Notification[];
  nextWatchId: number;
  nextNotificationId: number;
}

export function defaultStore(): Store {
  return { watches: [], notifications: [], nextWatchId: 1, nextNotificationId: 1 };
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

async function readRedisStore(): Promise<Store> {
  const raw = await redisCommand<string | null>("GET", REDIS_KEY);
  if (!raw) {
    const store = defaultStore();
    await writeRedisStore(store);
    return store;
  }
  return JSON.parse(raw) as Store;
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
  return JSON.parse(fs.readFileSync(STORE_PATH, "utf-8")) as Store;
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

function normalizeWatch(w: Watch): Watch {
  return {
    ...w,
    email: w.email ?? null,
    lastCourtsAvailable: w.lastCourtsAvailable ?? null,
  };
}

export async function createWatch(input: {
  date: string;
  hour: number;
  label?: string;
  email?: string;
  discordWebhook?: string;
  notifyOnOpen?: boolean;
  notifyOnAvailable?: boolean;
}): Promise<Watch> {
  const store = await readStore();
  const email = input.email?.trim().toLowerCase() || null;
  const duplicate = store.watches.find(
    (w) =>
      w.status === "active" &&
      w.date === input.date &&
      w.hour === input.hour &&
      (w.email ?? null) === email
  );
  if (duplicate) throw new Error("UNIQUE constraint failed: active watch for this slot already exists");

  const watch: Watch = {
    id: store.nextWatchId++,
    date: input.date,
    hour: input.hour,
    label: input.label ?? null,
    email,
    discordWebhook: input.discordWebhook ?? null,
    notifyOnOpen: input.notifyOnOpen !== false ? 1 : 0,
    notifyOnAvailable: input.notifyOnAvailable !== false ? 1 : 0,
    status: "active",
    triggeredAt: null,
    lastCourtsAvailable: null,
    createdAt: new Date().toISOString(),
  };
  store.watches.push(watch);
  await writeStore(store);
  return watch;
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

export async function cancelWatch(id: number): Promise<boolean> {
  const store = await readStore();
  const watch = store.watches.find((w) => w.id === id && w.status === "active");
  if (!watch) return false;
  watch.status = "cancelled";
  await writeStore(store);
  return true;
}

export async function markWatchTriggered(id: number): Promise<void> {
  const store = await readStore();
  const watch = store.watches.find((w) => w.id === id);
  if (watch) {
    watch.status = "triggered";
    watch.triggeredAt = new Date().toISOString();
    await writeStore(store);
  }
}

export async function addNotification(input: {
  watchId: number;
  type: Notification["type"];
  message: string;
  courtsAvailable?: number;
}): Promise<Notification> {
  const store = await readStore();
  const notification: Notification = {
    id: store.nextNotificationId++,
    watchId: input.watchId,
    type: input.type,
    message: input.message,
    courtsAvailable: input.courtsAvailable ?? null,
    createdAt: new Date().toISOString(),
  };
  store.notifications.push(notification);
  await writeStore(store);
  return notification;
}

export async function updateWatchAvailability(id: number, courtsAvailable: number): Promise<void> {
  const store = await readStore();
  const watch = store.watches.find((w) => w.id === id);
  if (watch) {
    watch.lastCourtsAvailable = courtsAvailable;
    await writeStore(store);
  }
}

export async function getRecentNotifications(
  limit = 50
): Promise<(Notification & { date: string; hour: number })[]> {
  const store = await readStore();
  return store.notifications
    .slice()
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, limit)
    .map((n) => {
      const watch = store.watches.find((w) => w.id === n.watchId);
      return { ...n, date: watch?.date ?? "", hour: watch?.hour ?? 0 };
    });
}

export function storageBackend(): "redis" | "json" {
  return redisConfigured() ? "redis" : "json";
}
