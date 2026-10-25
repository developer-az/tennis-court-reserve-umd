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
          <section key={date} id={`day-${date}`} className="panel overflow-hidden scroll-mt-28">
            <header className="flex items-baseline justify-between gap-3 border-b border-line bg-[#f7f1e6] px-3 py-2.5 sm:px-4 sm:py-3">
              <h3 className="font-display text-base font-semibold tracking-tight sm:text-lg">
                {formatDate(date)}
                {date === today ? <span className="ml-2 text-sm font-semibold text-terp-red">Today</span> : null}
              </h3>
              <p className="shrink-0 text-xs text-ink/60">
                {openCount} open · {fullCount} full
              </p>
            </header>
            <div className="sm:grid sm:grid-cols-2 sm:gap-2 sm:p-3 lg:grid-cols-3 xl:grid-cols-4">
              {daySlots.map((slot) => {
                const key = slotKey(slot.date, slot.hour);
                const watched = watchedSlots.has(key);
                const full = slot.courtsAvailable === 0 && slot.isOpen;
                const openingSoon = !slot.isOpen;
                const bookable = slot.isBookable;
                const bookingUrl = buildBookingLink(slot.date, slot.hour);

                let boxClass = "border-l-ink/15 bg-white sm:border-line";
                if (bookable) boxClass = "border-l-[#1f7a4d] bg-white sm:border-line sm:bg-open";
                else if (full) boxClass = "border-l-[#9f1d2a] bg-white sm:border-line sm:bg-full";
                else if (openingSoon) boxClass = "border-l-[#c8962e] bg-white sm:border-line sm:bg-soon";

                return (
                  <article
                    key={key}
                    className={`flex items-center gap-2 border-l-4 px-3 py-2 max-sm:border-b max-sm:last:border-b-0 sm:min-h-30 sm:flex-col sm:items-stretch sm:rounded-lg sm:border sm:p-2.5 ${boxClass}`}
                  >
                    <h4 className="shrink-0 font-display text-base font-semibold whitespace-nowrap tabular-nums">
                      {formatHour(slot.hour)}
                    </h4>
                    <p className="min-w-0 flex-1 truncate text-sm font-semibold sm:mt-1 sm:flex-none">
                      {bookable ? (
                        <span className="text-[#0f6b3c]">
                          {slot.courtsAvailable}/{slot.courtsTotal}
                          <span className="hidden sm:inline"> open</span>
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

                    <div className="flex shrink-0 flex-nowrap gap-1.5 sm:mt-auto sm:w-full sm:pt-3">
                      {bookable ? (
                        <a
                          href={bookingUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn-primary h-11 px-3 text-sm sm:h-auto sm:flex-1 sm:px-2! sm:py-1.5! sm:text-xs"
                        >
                          Book
                        </a>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => onWatch(slot.date, slot.hour)}
                        disabled={watched}
                        className={`h-11 px-3 text-sm sm:h-auto sm:flex-1 sm:px-2! sm:py-1.5! sm:text-xs ${watched ? "btn border border-line bg-white/70 text-ink" : "btn-secondary"}`}
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
