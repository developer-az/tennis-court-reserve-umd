"use client";

import { buildBookingLink, PLANYO } from "@/lib/constants";
import { formatDate, formatHour, formatOpensAt, timeUntil } from "@/lib/format";
import { todayInTimeZone } from "@/lib/time";

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
  emptyLabel?: string;
}

function slotKey(date: string, hour: number) {
  return `${date}:${hour}`;
}

function groupByDate(slots: Slot[]): Record<string, Slot[]> {
  return slots.reduce<Record<string, Slot[]>>((acc, slot) => {
    (acc[slot.date] ??= []).push(slot);
    return acc;
  }, {});
}

export function AvailabilityGrid({ slots, watchedSlots, onWatch, emptyLabel }: Props) {
  const grouped = groupByDate(slots);
  const dates = Object.keys(grouped).sort();
  const today = todayInTimeZone(new Date(), PLANYO.TIMEZONE);

  if (slots.length === 0) {
    return (
      <div className="panel px-6 py-10 text-center text-sm text-ink/60">
        {emptyLabel ?? "No upcoming slots found. Courts book up to 48 hours ahead."}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {dates.map((date) => {
        const daySlots = grouped[date].slice().sort((a, b) => a.hour - b.hour);
        const openCount = daySlots.filter((slot) => slot.isBookable).length;
        const fullCount = daySlots.filter((slot) => slot.courtsAvailable === 0 && slot.isOpen).length;
        return (
          <section key={date} id={`day-${date}`} className="panel overflow-hidden scroll-mt-24">
            <header className="flex items-baseline justify-between gap-3 border-b border-line px-4 py-3">
              <h3 className="font-display text-lg font-semibold tracking-tight">
                {formatDate(date)}
                {date === today ? <span className="ml-2 text-sm font-semibold text-terp-red">Today</span> : null}
              </h3>
              <p className="text-xs text-ink/60">
                {openCount} open · {fullCount} full
              </p>
            </header>
            <div className="grid grid-cols-2 gap-2 p-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
              {daySlots.map((slot) => {
                const key = slotKey(slot.date, slot.hour);
                const watched = watchedSlots.has(key);
                const full = slot.courtsAvailable === 0 && slot.isOpen;
                const openingSoon = !slot.isOpen;
                const bookable = slot.isBookable;
                const bookingUrl = buildBookingLink(slot.date, slot.hour);

                let boxClass = "border-line bg-white";
                if (bookable) boxClass = "border-l-4 border-l-[#1f7a4d] border-line bg-open";
                else if (full) boxClass = "border-l-4 border-l-[#9f1d2a] border-line bg-full";
                else if (openingSoon) boxClass = "border-l-4 border-l-[#c8962e] border-line bg-soon";

                return (
                  <article key={key} className={`flex min-h-30 flex-col rounded-lg border p-2.5 ${boxClass}`}>
                    <div className="flex items-baseline justify-between gap-2">
                      <h4 className="font-display text-base font-semibold tabular-nums">{formatHour(slot.hour)}</h4>
                      {watched ? (
                        <span className="text-[10px] font-bold uppercase tracking-wide text-ink/70">Watching</span>
                      ) : null}
                    </div>
                    <p className="mt-1 text-sm font-semibold">
                      {bookable ? (
                        <span className="text-[#0f6b3c]">
                          {slot.courtsAvailable}/{slot.courtsTotal} open
                        </span>
                      ) : full ? (
                        <span className="text-[#9f1d2a]">Full</span>
                      ) : openingSoon ? (
                        <span className="font-medium text-[#8a5a12]" title={formatOpensAt(slot.opensAt)}>
                          Opens {timeUntil(slot.opensAt)}
                        </span>
                      ) : (
                        <span className="text-ink/60">
                          {slot.courtsAvailable}/{slot.courtsTotal}
                        </span>
                      )}
                    </p>

                    <div className="mt-auto flex gap-1.5 pt-3">
                      {bookable ? (
                        <a
                          href={bookingUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn-primary flex-1 px-2! py-1.5! text-xs"
                        >
                          Book
                        </a>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => onWatch(slot.date, slot.hour)}
                        disabled={watched}
                        className={`flex-1 px-2! py-1.5! text-xs ${watched ? "btn border border-line bg-white/70 text-ink" : "btn-secondary"}`}
                        title={
                          openingSoon
                            ? `Email me when booking opens at ${formatOpensAt(slot.opensAt)}`
                            : "Email me if a court frees up"
                        }
                      >
                        {watched ? "Watching" : "Watch"}
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
