import {
  addNotification,
  getActiveWatches,
  markWatchTriggered,
  pruneStore,
  recordPollResult,
  updateWatchAvailability,
} from "./db";
import { claimNotifyCooldown } from "./cooldown";
import { reportError } from "./errors";
import { LIMITS } from "./limits";
import {
  buildAvailableNotification,
  buildOpenNotification,
  deliverAlert,
} from "./notifications";
import { getOpensAt, isSlotOpenForBooking, parseSlotDateTime, searchSlot } from "./planyo";

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

export async function runPoll(now = new Date()): Promise<PollResult> {
  const result: PollResult = {
    checked: 0,
    triggered: 0,
    skipped: 0,
    pruned: { watches: 0, notifications: 0 },
    events: [],
  };

  try {
    result.pruned = await pruneStore(now);
    const watches = await getActiveWatches();
    const slotCache = new Map<string, Awaited<ReturnType<typeof searchSlot>>>();
    let lookups = 0;

    for (const watch of watches) {
      const slotStart = parseSlotDateTime(watch.date, watch.hour);
      if (slotStart <= now) {
        await markWatchTriggered(watch.id);
        continue;
      }

      const slotKey = `${watch.date}:${watch.hour}`;
      let search = slotCache.get(slotKey);
      if (!search) {
        if (lookups >= LIMITS.MAX_POLL_SLOT_LOOKUPS) {
          result.skipped++;
          continue;
        }
        search = await searchSlot(watch.date, watch.hour);
        slotCache.set(slotKey, search);
        lookups++;
      }

      result.checked++;
      const opensAt = getOpensAt(slotStart);
      const isOpen = isSlotOpenForBooking(slotStart, now);
      const { available, courtsAvailable, reason } = search;

      if (watch.notifyOnOpen && isOpen && now >= opensAt) {
        const msSinceOpen = now.getTime() - opensAt.getTime();
        if (msSinceOpen < 10 * 60 * 1000 && (await claimNotifyCooldown(watch.id, "slot_opened"))) {
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

        if (increased && (await claimNotifyCooldown(watch.id, "court_available"))) {
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

    await recordPollResult({
      ok: true,
      checked: result.checked,
      triggered: result.triggered,
    });
    return result;
  } catch (err) {
    await recordPollResult({
      ok: false,
      checked: result.checked,
      triggered: result.triggered,
      error: err instanceof Error ? err.message : String(err),
    });
    await reportError(err, { where: "runPoll" });
    throw err;
  }
}
