import { commitPoll, getActiveWatches, type PollWatchUpdate, type Watch } from "./db";
import { claimNotifyCooldown } from "./cooldown";
import { reportError } from "./errors";
import { LIMITS } from "./limits";
import {
  buildAvailableNotification,
  buildOpenNotification,
  deliverAlert,
} from "./notifications";
import { getOpensAt, isSlotOpenForBooking, parseSlotDateTime, searchSlot } from "./planyo";

const SLOT_FETCH_CONCURRENCY = 5;
/** Watches saved before `notifiedOpen` existed should not all email at once on deploy. */
const LEGACY_OPEN_SUPPRESS_MS = 15 * 60 * 1000;

export interface PollResult {
  checked: number;
  triggered: number;
  skipped: number;
  pruned: { watches: number; notifications: number };
  events: Array<{
    watchId: number;
    type: string;
    message: string;
    courtsAvailable: number;
  }>;
}

export interface CourtSnapshot {
  available: boolean;
  courtsAvailable: number;
  reason?: string;
}

export interface WatchPlan {
  markTriggered: boolean;
  notifyOpen: boolean;
  notifyAvailable: boolean;
  updateAvailability: boolean;
  nextCourtsAvailable: number | null;
  notifiedOpen?: boolean;
}

export function planWatch(
  watch: Pick<
    Watch,
    "date" | "hour" | "createdAt" | "notifyOnOpen" | "notifyOnAvailable" | "lastCourtsAvailable" | "notifiedOpen"
  >,
  slot: CourtSnapshot | null,
  now: Date
): WatchPlan {
  const slotStart = parseSlotDateTime(watch.date, watch.hour);
  const plan: WatchPlan = {
    markTriggered: false,
    notifyOpen: false,
    notifyAvailable: false,
    updateAvailability: false,
    nextCourtsAvailable: watch.lastCourtsAvailable,
  };

  if (slotStart <= now) {
    plan.markTriggered = true;
    return plan;
  }
  if (!slot) return plan;

  const opensAt = getOpensAt(slotStart);
  const isOpen = isSlotOpenForBooking(slotStart, now);

  if (isOpen && watch.notifyOnOpen && watch.notifiedOpen !== true) {
    const createdAt = Date.parse(watch.createdAt);
    const createdBeforeOpen = Number.isFinite(createdAt) && createdAt <= opensAt.getTime() + 60_000;
    const ageMs = now.getTime() - opensAt.getTime();
    const legacy = watch.notifiedOpen == null;
    if (legacy && ageMs > LEGACY_OPEN_SUPPRESS_MS) {
      plan.notifiedOpen = true;
    } else if (createdBeforeOpen) {
      plan.notifyOpen = true;
      plan.notifiedOpen = true;
    }
  }

  if (isOpen) {
    plan.updateAvailability = true;
    plan.nextCourtsAvailable = slot.courtsAvailable;
    const previous = watch.lastCourtsAvailable;
    if (
      watch.notifyOnAvailable &&
      slot.available &&
      slot.courtsAvailable > 0 &&
      previous !== null &&
      slot.courtsAvailable > previous
    ) {
      plan.notifyAvailable = true;
    }
  }

  return plan;
}

async function mapPool<T>(items: T[], limit: number, worker: (item: T) => Promise<void>): Promise<void> {
  if (items.length === 0) return;
  let cursor = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      await worker(items[index]);
    }
  });
  await Promise.all(runners);
}

async function sendWatchAlert(
  watch: Watch,
  type: "slot_opened" | "court_available",
  courtsAvailable: number,
  extraDiscord?: string
): Promise<{ sent: boolean; message: string }> {
  const notif =
    type === "slot_opened"
      ? buildOpenNotification(watch.date, watch.hour, courtsAvailable)
      : buildAvailableNotification(watch.date, watch.hour, courtsAvailable);

  const claimed = await claimNotifyCooldown(watch.id, type);
  if (!claimed) return { sent: false, message: notif.message };

  const sent = await deliverAlert({
    email: watch.email,
    discordWebhook: watch.discordWebhook,
    title: notif.title,
    message: notif.message,
    bookingUrl: notif.bookingUrl,
    discordColor: type === "court_available" ? 0x22c55e : undefined,
    extraDiscord,
  });

  return { sent, message: notif.message };
}

export async function runPoll(now = new Date()): Promise<PollResult> {
  const result: PollResult = {
    checked: 0,
    triggered: 0,
    skipped: 0,
    pruned: { watches: 0, notifications: 0 },
    events: [],
  };

  let saved = false;
  try {
    const watches = await getActiveWatches();
    const past: Watch[] = [];
    const future: Watch[] = [];
    for (const watch of watches) {
      if (parseSlotDateTime(watch.date, watch.hour) <= now) past.push(watch);
      else future.push(watch);
    }

    const keys: string[] = [];
    const seen = new Set<string>();
    for (const watch of future) {
      const key = `${watch.date}:${watch.hour}`;
      if (seen.has(key)) continue;
      if (keys.length >= LIMITS.MAX_POLL_SLOT_LOOKUPS) break;
      seen.add(key);
      keys.push(key);
    }

    const fetched = new Map<string, CourtSnapshot | "error">();
    await mapPool(keys, SLOT_FETCH_CONCURRENCY, async (key) => {
      const [date, hourText] = key.split(":");
      try {
        fetched.set(key, await searchSlot(date, Number(hourText)));
      } catch {
        fetched.set(key, "error");
      }
    });

    const updates: PollWatchUpdate[] = past.map((watch) => ({
      id: watch.id,
      status: "triggered",
      triggeredAt: now.toISOString(),
    }));
    const notifications: Array<{
      watchId: number;
      type: "slot_opened" | "court_available";
      message: string;
      courtsAvailable: number;
    }> = [];

    for (const watch of future) {
      const key = `${watch.date}:${watch.hour}`;
      const slot = fetched.get(key);
      if (!slot || slot === "error") {
        result.skipped++;
        continue;
      }

      result.checked++;
      const plan = planWatch(watch, slot, now);
      const update: PollWatchUpdate = { id: watch.id };
      let updateAvailability = plan.updateAvailability;
      let notifiedOpen = plan.notifiedOpen;

      if (plan.notifyOpen) {
        const delivery = await sendWatchAlert(
          watch,
          "slot_opened",
          slot.courtsAvailable,
          slot.available
            ? "\n\n**Book now before it's gone!**"
            : `\n\n⚠️ ${slot.reason ?? "May be fully booked"}`
        );
        if (delivery.sent) {
          notifications.push({
            watchId: watch.id,
            type: "slot_opened",
            message: delivery.message,
            courtsAvailable: slot.courtsAvailable,
          });
          result.triggered++;
          result.events.push({
            watchId: watch.id,
            type: "slot_opened",
            message: delivery.message,
            courtsAvailable: slot.courtsAvailable,
          });
        } else {
          notifiedOpen = watch.notifiedOpen;
        }
      }

      if (plan.notifyAvailable) {
        const delivery = await sendWatchAlert(watch, "court_available", slot.courtsAvailable);
        if (delivery.sent) {
          notifications.push({
            watchId: watch.id,
            type: "court_available",
            message: delivery.message,
            courtsAvailable: slot.courtsAvailable,
          });
          result.triggered++;
          result.events.push({
            watchId: watch.id,
            type: "court_available",
            message: delivery.message,
            courtsAvailable: slot.courtsAvailable,
          });
        } else {
          updateAvailability = false;
        }
      }

      if (plan.markTriggered) {
        update.status = "triggered";
        update.triggeredAt = now.toISOString();
      }
      if (updateAvailability) {
        update.touchAvailability = true;
        update.lastCourtsAvailable = plan.nextCourtsAvailable;
      }
      if (notifiedOpen !== undefined && notifiedOpen !== watch.notifiedOpen) {
        update.notifiedOpen = notifiedOpen;
      }
      if (update.status || update.touchAvailability || update.notifiedOpen !== undefined) {
        updates.push(update);
      }
    }

    const lookupErrors = keys.filter((key) => fetched.get(key) === "error").length;
    const pollOk = keys.length === 0 || lookupErrors < keys.length;
    const committed = await commitPoll({
      now,
      updates,
      notifications,
      poll: {
        ok: pollOk,
        checked: result.checked,
        triggered: result.triggered,
        error:
          lookupErrors > 0
            ? `${lookupErrors} of ${keys.length} Planyo lookups failed`
            : pollOk
              ? null
              : "Planyo lookups failed",
      },
    });
    result.pruned = committed.pruned;
    saved = true;
    if (!pollOk) throw new Error(committed.meta.lastPollError ?? "Poll failed");
    return result;
  } catch (err) {
    if (!saved) await recordFailure(result, err);
    await reportError(err, { where: "runPoll" });
    throw err;
  }
}

async function recordFailure(result: PollResult, err: unknown): Promise<void> {
  try {
    const { recordPollResult } = await import("./db");
    await recordPollResult({
      ok: false,
      checked: result.checked,
      triggered: result.triggered,
      error: err instanceof Error ? err.message : String(err),
    });
  } catch {
    // The original poll error is more useful than a second store failure.
  }
}
