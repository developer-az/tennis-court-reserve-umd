import fs from "fs";
import path from "path";

export interface Watch {
  id: number;
  date: string;
  hour: number;
  label: string | null;
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

interface Store {
  watches: Watch[];
  notifications: Notification[];
  nextWatchId: number;
  nextNotificationId: number;
}

const DATA_DIR = path.join(process.cwd(), "data");
const STORE_PATH = path.join(DATA_DIR, "store.json");

function defaultStore(): Store {
  return { watches: [], notifications: [], nextWatchId: 1, nextNotificationId: 1 };
}

function readStore(): Store {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(STORE_PATH)) {
    const store = defaultStore();
    fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2));
    return store;
  }
  return JSON.parse(fs.readFileSync(STORE_PATH, "utf-8")) as Store;
}

function writeStore(store: Store): void {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2));
}

export function createWatch(input: {
  date: string;
  hour: number;
  label?: string;
  discordWebhook?: string;
  notifyOnOpen?: boolean;
  notifyOnAvailable?: boolean;
}): Watch {
  const store = readStore();
  const duplicate = store.watches.find(
    (w) => w.status === "active" && w.date === input.date && w.hour === input.hour
  );
  if (duplicate) throw new Error("UNIQUE constraint failed: active watch for this slot already exists");

  const watch: Watch = {
    id: store.nextWatchId++,
    date: input.date,
    hour: input.hour,
    label: input.label ?? null,
    discordWebhook: input.discordWebhook ?? null,
    notifyOnOpen: input.notifyOnOpen !== false ? 1 : 0,
    notifyOnAvailable: input.notifyOnAvailable !== false ? 1 : 0,
    status: "active",
    triggeredAt: null,
    lastCourtsAvailable: null,
    createdAt: new Date().toISOString(),
  };
  store.watches.push(watch);
  writeStore(store);
  return watch;
}

export function getWatchById(id: number): Watch | null {
  return readStore().watches.find((w) => w.id === id) ?? null;
}

export function getActiveWatches(): Watch[] {
  return readStore()
    .watches.filter((w) => w.status === "active")
    .sort((a, b) => a.date.localeCompare(b.date) || a.hour - b.hour);
}

export function getAllWatches(): Watch[] {
  return readStore()
    .watches.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function cancelWatch(id: number): boolean {
  const store = readStore();
  const watch = store.watches.find((w) => w.id === id && w.status === "active");
  if (!watch) return false;
  watch.status = "cancelled";
  writeStore(store);
  return true;
}

export function markWatchTriggered(id: number): void {
  const store = readStore();
  const watch = store.watches.find((w) => w.id === id);
  if (watch) {
    watch.status = "triggered";
    watch.triggeredAt = new Date().toISOString();
    writeStore(store);
  }
}

export function addNotification(input: {
  watchId: number;
  type: Notification["type"];
  message: string;
  courtsAvailable?: number;
}): Notification {
  const store = readStore();
  const notification: Notification = {
    id: store.nextNotificationId++,
    watchId: input.watchId,
    type: input.type,
    message: input.message,
    courtsAvailable: input.courtsAvailable ?? null,
    createdAt: new Date().toISOString(),
  };
  store.notifications.push(notification);
  writeStore(store);
  return notification;
}

export function updateWatchAvailability(id: number, courtsAvailable: number): void {
  const store = readStore();
  const watch = store.watches.find((w) => w.id === id);
  if (watch) {
    watch.lastCourtsAvailable = courtsAvailable;
    writeStore(store);
  }
}

export function getRecentNotifications(limit = 50): (Notification & { date: string; hour: number })[] {
  const store = readStore();
  return store.notifications
    .slice()
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, limit)
    .map((n) => {
      const watch = store.watches.find((w) => w.id === n.watchId);
      return { ...n, date: watch?.date ?? "", hour: watch?.hour ?? 0 };
    });
}
