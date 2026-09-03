import { addNotification, getActiveWatches, markWatchTriggered, updateWatchAvailability } from "./db";
import {
  buildAvailableNotification,
  buildOpenNotification,
  deliverAlert,
} from "./notifications";
import { getOpensAt, isSlotOpenForBooking, parseSlotDateTime, searchSlot } from "./planyo";

export interface PollResult {
  checked: number;
  triggered: number;
  events: Array<{
    watchId: number;
    type: string;
    message: string;
    courtsAvailable: number;
  }>;
}

const recentlyNotified = new Map<string, number>();
const COOLDOWN_MS = 5 * 60 * 1000;

function cooldownKey(watchId: number, type: string) {
  return `${watchId}:${type}`;
}

function shouldNotify(watchId: number, type: string): boolean {
  const key = cooldownKey(watchId, type);
  const last = recentlyNotified.get(key);
  if (last && Date.now() - last < COOLDOWN_MS) return false;
  recentlyNotified.set(key, Date.now());
  return true;
}

export async function runPoll(now = new Date()): Promise<PollResult> {
  const watches = await getActiveWatches();
  const result: PollResult = { checked: watches.length, triggered: 0, events: [] };

  for (const watch of watches) {
    const slotStart = parseSlotDateTime(watch.date, watch.hour);
    if (slotStart <= now) {
      await markWatchTriggered(watch.id);
      continue;
    }

    const opensAt = getOpensAt(slotStart);
    const isOpen = isSlotOpenForBooking(slotStart, now);
    const { available, courtsAvailable, reason } = await searchSlot(watch.date, watch.hour);

    if (watch.notifyOnOpen && isOpen && now >= opensAt) {
      const msSinceOpen = now.getTime() - opensAt.getTime();
      if (msSinceOpen < 10 * 60 * 1000 && shouldNotify(watch.id, "slot_opened")) {
        const notif = buildOpenNotification(watch.date, watch.hour, courtsAvailable);
        await addNotification({
          watchId: watch.id,
          type: "slot_opened",
          message: notif.message,
          courtsAvailable,
        });

        await deliverAlert({
          email: watch.email,
          discordWebhook: watch.discordWebhook,
          title: notif.title,
          message: notif.message,
          bookingUrl: notif.bookingUrl,
          extraDiscord: available
            ? "\n\n**Book now before it's gone!**"
            : `\n\n⚠️ ${reason ?? "May be fully booked"}`,
        });

        result.triggered++;
        result.events.push({
          watchId: watch.id,
          type: "slot_opened",
          message: notif.message,
          courtsAvailable,
        });
      }
    }

    if (watch.notifyOnAvailable && available && courtsAvailable > 0 && isOpen) {
      const prev = watch.lastCourtsAvailable;
      const increased = prev === null ? false : courtsAvailable > prev;
      await updateWatchAvailability(watch.id, courtsAvailable);

      if (increased && shouldNotify(watch.id, "court_available")) {
        const notif = buildAvailableNotification(watch.date, watch.hour, courtsAvailable);
        await addNotification({
          watchId: watch.id,
          type: "court_available",
          message: notif.message,
          courtsAvailable,
        });

        await deliverAlert({
          email: watch.email,
          discordWebhook: watch.discordWebhook,
          title: notif.title,
          message: notif.message,
          bookingUrl: notif.bookingUrl,
          discordColor: 0x22c55e,
        });

        result.triggered++;
        result.events.push({
          watchId: watch.id,
          type: "court_available",
          message: notif.message,
          courtsAvailable,
        });
      }
    } else {
      await updateWatchAvailability(watch.id, courtsAvailable);
    }
  }

  return result;
}
