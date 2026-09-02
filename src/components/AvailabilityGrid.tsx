"use client";

import { useState } from "react";
import { formatDate, formatHour, formatOpensAt, timeUntil } from "@/lib/format";
import { buildBookingLink } from "@/lib/constants";

export interface Slot {
  date: string;
  hour: number;
  courtsAvailable: number;
  courtsTotal: number;
  isBookable: boolean;
  isOpen: boolean;
  opensAt: string;
  reason?: string;
}

interface Props {
  slots: Slot[];
  watchedSlots: Set<string>;
  onWatch: (date: string, hour: number) => void;
}

function slotKey(date: string, hour: number) {
  return `${date}:${hour}`;
}

function groupByDate(slots: Slot[]): Record<string, Slot[]> {
  return slots.reduce<Record<string, Slot[]>>((acc, s) => {
    (acc[s.date] ??= []).push(s);
    return acc;
  }, {});
}

export function AvailabilityGrid({ slots, watchedSlots, onWatch }: Props) {
  const grouped = groupByDate(slots);
  const dates = Object.keys(grouped).sort();

  if (slots.length === 0) {
    return (
      <div className="glass rounded-2xl p-8 text-center text-white/60">
        No upcoming slots found. Courts book up to 48 hours ahead.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {dates.map((date) => (
        <div key={date} className="glass rounded-2xl overflow-hidden">
          <div className="bg-terp-red/20 px-5 py-3 border-b border-white/10">
            <h3 className="font-display text-lg font-semibold text-terp-gold">{formatDate(date)}</h3>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2 p-4">
            {grouped[date]
              .sort((a, b) => a.hour - b.hour)
              .map((slot) => {
                const key = slotKey(slot.date, slot.hour);
                const watched = watchedSlots.has(key);
                const full = slot.courtsAvailable === 0;
                const openingSoon = !slot.isOpen;
                const bookable = slot.isBookable;

                return (
                  <SlotCard
                    key={key}
                    slot={slot}
                    watched={watched}
                    full={full}
                    openingSoon={openingSoon}
                    bookable={bookable}
                    onWatch={() => onWatch(slot.date, slot.hour)}
                  />
                );
              })}
          </div>
        </div>
      ))}
    </div>
  );
}

function SlotCard({
  slot,
  watched,
  full,
  openingSoon,
  bookable,
  onWatch,
}: {
  slot: Slot;
  watched: boolean;
  full: boolean;
  openingSoon: boolean;
  bookable: boolean;
  onWatch: () => void;
}) {
  const [hover, setHover] = useState(false);
  const bookingUrl = buildBookingLink(slot.date, slot.hour);

  let statusClass = "border-white/10 bg-white/5";
  if (bookable) statusClass = "border-green-500/40 bg-green-500/10";
  else if (full && slot.isOpen) statusClass = "border-red-500/30 bg-red-500/10";
  else if (openingSoon) statusClass = "border-terp-gold/30 bg-terp-gold/5";

  return (
    <div
      className={`relative rounded-xl border p-3 transition-all ${statusClass} ${bookable ? "hover:scale-[1.02]" : ""}`}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <div className="text-sm font-semibold">{formatHour(slot.hour)}</div>
      <div className="mt-1 text-xs text-white/70">
        {bookable ? (
          <span className="text-green-400">{slot.courtsAvailable}/{slot.courtsTotal} open</span>
        ) : full && slot.isOpen ? (
          <span className="text-red-400">Full</span>
        ) : openingSoon ? (
          <span className="text-terp-gold">Opens {timeUntil(slot.opensAt)}</span>
        ) : (
          <span>{slot.courtsAvailable}/{slot.courtsTotal}</span>
        )}
      </div>

      <div className="mt-2 flex gap-1">
        {bookable && (
          <a
            href={bookingUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 rounded-lg bg-terp-red px-2 py-1 text-center text-xs font-medium hover:bg-terp-red/80"
          >
            Book
          </a>
        )}
        <button
          onClick={onWatch}
          disabled={watched}
          className={`flex-1 rounded-lg px-2 py-1 text-xs font-medium transition ${
            watched
              ? "bg-terp-gold/20 text-terp-gold cursor-default"
              : "bg-white/10 hover:bg-terp-gold/20 hover:text-terp-gold"
          }`}
          title={openingSoon ? `Notify when booking opens at ${formatOpensAt(slot.opensAt)}` : "Notify on availability"}
        >
          {watched ? "Watching" : "Watch"}
        </button>
      </div>

      {hover && openingSoon && (
        <div className="absolute -top-1 left-1/2 z-10 -translate-x-1/2 -translate-y-full rounded-lg bg-black/90 px-2 py-1 text-xs whitespace-nowrap border border-white/10">
          Opens {formatOpensAt(slot.opensAt)}
        </div>
      )}
    </div>
  );
}
