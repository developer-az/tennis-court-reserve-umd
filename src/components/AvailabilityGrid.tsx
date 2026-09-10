"use client";

import { useEffect, useMemo, useState } from "react";
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

function AvailabilityMeter({ available, total }: { available: number; total: number }) {
  const pct = total > 0 ? Math.round((available / total) * 100) : 0;
  return (
    <div className="flex items-center gap-2.5 min-w-0">
      <div className="h-1.5 w-20 sm:w-28 rounded-full bg-white/10 overflow-hidden shrink-0">
        <div
          className="h-full rounded-full bg-open transition-[width] duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-sm tabular-nums text-open whitespace-nowrap">
        {available}/{total} open
      </span>
    </div>
  );
}

export function AvailabilityGrid({ slots, watchedSlots, onWatch }: Props) {
  const grouped = useMemo(() => groupByDate(slots), [slots]);
  const dates = useMemo(() => Object.keys(grouped).sort(), [grouped]);
  const [activeDate, setActiveDate] = useState(dates[0] ?? "");

  useEffect(() => {
    if (!dates.length) {
      setActiveDate("");
      return;
    }
    if (!dates.includes(activeDate)) setActiveDate(dates[0]);
  }, [dates, activeDate]);

  if (slots.length === 0) {
    return (
      <div className="surface rounded-xl px-6 py-14 text-center">
        <p className="font-display text-xl text-ink">No slots in the next few days</p>
        <p className="mt-2 text-sm text-mute">Courts open for booking 48 hours ahead.</p>
      </div>
    );
  }

  const daySlots = (grouped[activeDate] ?? []).slice().sort((a, b) => a.hour - b.hour);
  const openCount = daySlots.filter((s) => s.isBookable).length;

  return (
    <div className="surface rounded-xl overflow-hidden animate-rise">
      <div className="flex flex-col gap-3 border-b border-line px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div className="flex gap-1 overflow-x-auto pb-1 sm:pb-0" role="tablist" aria-label="Select day">
          {dates.map((date) => {
            const selected = date === activeDate;
            const dayOpen = (grouped[date] ?? []).filter((s) => s.isBookable).length;
            return (
              <button
                key={date}
                role="tab"
                aria-selected={selected}
                onClick={() => setActiveDate(date)}
                className={`shrink-0 rounded-md px-3 py-2 text-left transition ${
                  selected
                    ? "bg-terp-gold text-court-bg shadow-glow"
                    : "text-mute hover:bg-white/[0.04] hover:text-ink"
                }`}
              >
                <div className="text-sm font-semibold leading-none">{formatDate(date).split(",")[0]}</div>
                <div className={`mt-1 text-[11px] ${selected ? "text-court-bg/70" : "text-mute"}`}>
                  {dayOpen > 0 ? `${dayOpen} bookable` : "none open"}
                </div>
              </button>
            );
          })}
        </div>
        <p className="text-xs text-mute sm:text-right">
          {formatDate(activeDate)}
          {openCount > 0 ? ` · ${openCount} open now` : " · fully booked or not yet open"}
        </p>
      </div>

      <ul className="divide-y divide-line" role="list">
        {daySlots.map((slot) => {
          const key = slotKey(slot.date, slot.hour);
          const watched = watchedSlots.has(key);
          const full = slot.courtsAvailable === 0 && slot.isOpen;
          const openingSoon = !slot.isOpen;
          const bookable = slot.isBookable;
          const bookingUrl = buildBookingLink(slot.date, slot.hour);

          return (
            <li
              key={key}
              className={`group flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-5 ${
                bookable ? "bg-open/[0.04]" : ""
              }`}
            >
              <div className="flex min-w-0 items-start gap-3 sm:items-center">
                <div
                  className={`mt-1 h-8 w-1 shrink-0 rounded-full sm:mt-0 ${
                    bookable ? "bg-open" : full ? "bg-full/80" : openingSoon ? "bg-soon/80" : "bg-white/15"
                  }`}
                />
                <div className="min-w-0">
                  <div className="font-display text-lg leading-none tracking-tight">{formatHour(slot.hour)}</div>
                  <div className="mt-2">
                    {bookable ? (
                      <AvailabilityMeter available={slot.courtsAvailable} total={slot.courtsTotal} />
                    ) : full ? (
                      <span className="text-sm text-full">Fully booked</span>
                    ) : openingSoon ? (
                      <span className="text-sm text-soon" title={formatOpensAt(slot.opensAt)}>
                        Opens in {timeUntil(slot.opensAt)}
                      </span>
                    ) : (
                      <span className="text-sm text-mute">
                        {slot.courtsAvailable}/{slot.courtsTotal} courts
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 pl-4 sm:pl-0">
                {bookable && (
                  <a href={bookingUrl} target="_blank" rel="noopener noreferrer" className="btn-primary">
                    Book
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => onWatch(slot.date, slot.hour)}
                  disabled={watched}
                  className={watched ? "btn bg-terp-gold/15 text-terp-gold border border-terp-gold/25" : "btn-secondary"}
                  title={
                    openingSoon
                      ? `Notify when booking opens at ${formatOpensAt(slot.opensAt)}`
                      : "Get notified about this slot"
                  }
                >
                  {watched ? "Watching" : "Watch"}
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
