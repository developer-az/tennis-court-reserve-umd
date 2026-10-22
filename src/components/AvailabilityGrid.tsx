"use client";

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
      <div className="panel px-6 py-10 text-center text-sm text-neutral-500">
        No upcoming slots found. Courts book up to 48 hours ahead.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {dates.map((date) => (
        <section key={date} className="panel overflow-hidden">
          <header className="border-b border-neutral-200 bg-terp-red px-4 py-2.5">
            <h3 className="text-base font-semibold text-white">{formatDate(date)}</h3>
          </header>
          <div className="grid grid-cols-2 gap-2 p-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {grouped[date]
              .slice()
              .sort((a, b) => a.hour - b.hour)
              .map((slot) => {
                const key = slotKey(slot.date, slot.hour);
                const watched = watchedSlots.has(key);
                const full = slot.courtsAvailable === 0 && slot.isOpen;
                const openingSoon = !slot.isOpen;
                const bookable = slot.isBookable;
                const bookingUrl = buildBookingLink(slot.date, slot.hour);

                let boxClass = "border-neutral-200 bg-neutral-50";
                if (bookable) boxClass = "border-green-300 bg-green-50";
                else if (full) boxClass = "border-red-200 bg-red-50";
                else if (openingSoon) boxClass = "border-amber-200 bg-amber-50";

                return (
                  <div key={key} className={`rounded-md border p-2.5 ${boxClass}`}>
                    <div className="text-sm font-semibold text-neutral-900">{formatHour(slot.hour)}</div>
                    <div className="mt-0.5 text-xs">
                      {bookable ? (
                        <span className="font-medium text-green-700">
                          {slot.courtsAvailable}/{slot.courtsTotal} open
                        </span>
                      ) : full ? (
                        <span className="font-medium text-red-700">Full</span>
                      ) : openingSoon ? (
                        <span className="text-amber-800" title={formatOpensAt(slot.opensAt)}>
                          Opens {timeUntil(slot.opensAt)}
                        </span>
                      ) : (
                        <span className="text-neutral-500">
                          {slot.courtsAvailable}/{slot.courtsTotal}
                        </span>
                      )}
                    </div>

                    <div className="mt-2 flex gap-1">
                      {bookable && (
                        <a
                          href={bookingUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn-primary flex-1 !px-1.5 !py-1 text-xs"
                        >
                          Book
                        </a>
                      )}
                      <button
                        type="button"
                        onClick={() => onWatch(slot.date, slot.hour)}
                        disabled={watched}
                        className={`flex-1 !px-1.5 !py-1 text-xs ${
                          watched
                            ? "btn border border-terp-gold bg-terp-gold/20 text-neutral-800"
                            : "btn-secondary"
                        }`}
                        title={
                          openingSoon
                            ? `Notify when booking opens at ${formatOpensAt(slot.opensAt)}`
                            : "Notify on availability"
                        }
                      >
                        {watched ? "Watching" : "Watch"}
                      </button>
                    </div>
                  </div>
                );
              })}
          </div>
        </section>
      ))}
    </div>
  );
}
