"use client";

import { formatDateShort, formatHour } from "@/lib/format";
import { pickleballNote, slotMatches, type BandFilter, type StatusFilter } from "@/lib/schedule";

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
  selectedKey: string | null;
  status: StatusFilter;
  band: BandFilter;
  onSelect: (slot: Slot) => void;
}

export function slotKey(date: string, hour: number) {
  return `${date}:${hour}`;
}

function cellTone(slot: Slot, dimmed: boolean): string {
  if (dimmed) return "bg-black/[0.03] text-ink/25";
  if (slot.isBookable && slot.courtsAvailable >= 4) return "bg-[#1F6B45] text-white";
  if (slot.isBookable) return "bg-[#3D8F62] text-white";
  if (!slot.isOpen && slot.courtsAvailable > 0) return "bg-[#F3E2B0] text-ink";
  if (slot.courtsAvailable === 0) return "bg-[#F3D6D4] text-[#7A2430]";
  return "bg-white text-ink";
}

export function CourtBoard({ slots, watchedSlots, selectedKey, status, band, onSelect }: Props) {
  const dates = Array.from(new Set(slots.map((s) => s.date))).sort();
  const hours = Array.from(new Set(slots.map((s) => s.hour))).sort((a, b) => a - b);
  const byKey = new Map(slots.map((s) => [slotKey(s.date, s.hour), s]));

  if (slots.length === 0) {
    return (
      <div className="rounded-2xl border border-black/10 bg-white px-6 py-14 text-center text-ink/60">
        No upcoming times in this window. Courts open for booking 48 hours ahead.
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-black/10 bg-white overflow-hidden">
      <div className="max-h-[68vh] overflow-auto">
        <table className="w-full border-collapse text-sm min-w-[640px]">
          <caption className="sr-only">
            Eppley tennis court availability by day and hour. Select a cell for booking and alerts.
          </caption>
          <thead className="sticky top-0 z-10 bg-[#12100E] text-[#F6F1E6]">
            <tr>
              <th scope="col" className="sticky left-0 z-20 bg-[#12100E] px-3 py-3 text-left font-medium text-xs tracking-wide">
                Time
              </th>
              {dates.map((date) => (
                <th key={date} scope="col" className="px-2 py-3 font-display text-base font-semibold tracking-wide">
                  {formatDateShort(date)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {hours.map((hour) => (
              <tr key={hour} className="border-t border-black/5">
                <th
                  scope="row"
                  className="sticky left-0 z-[1] bg-[#F7F3EA] px-3 py-2 text-left font-medium text-ink/80 whitespace-nowrap"
                >
                  {formatHour(hour)}
                </th>
                {dates.map((date) => {
                  const slot = byKey.get(slotKey(date, hour));
                  if (!slot) {
                    return <td key={date} className="p-1.5 bg-black/[0.02]" />;
                  }
                  const key = slotKey(date, hour);
                  const visible = slotMatches(slot, status, band);
                  const selected = selectedKey === key;
                  const pickle = pickleballNote(date, hour);
                  const watched = watchedSlots.has(key);
                  return (
                    <td key={date} className="p-1.5">
                      <button
                        type="button"
                        onClick={() => onSelect(slot)}
                        aria-pressed={selected}
                        aria-label={`${formatDateShort(date)} ${formatHour(hour)}, ${slot.courtsAvailable} of ${slot.courtsTotal} courts free, ${slot.isBookable ? "bookable now" : slot.isOpen ? "full or closed" : "booking not open yet"}${pickle ? `, ${pickle}` : ""}`}
                        className={`relative w-full rounded-lg px-2 py-2 text-center transition ${cellTone(slot, !visible)} ${
                          selected ? "ring-2 ring-[#C8102E] ring-offset-2" : "hover:brightness-95"
                        } ${visible ? "" : "cursor-default"}`}
                      >
                        <span className="block font-display text-2xl leading-none font-semibold">
                          {slot.courtsAvailable}
                        </span>
                        <span className="block text-[10px] uppercase tracking-wide opacity-80 mt-1">
                          {slot.isBookable ? "open" : slot.isOpen ? "full" : "later"}
                        </span>
                        {pickle && visible && (
                          <span className="absolute top-1 right-1 h-1.5 w-1.5 rounded-full bg-[#C8102E]" title={pickle} />
                        )}
                        {watched && (
                          <span className="absolute bottom-1 left-1 text-[10px]" aria-hidden>
                            ●
                          </span>
                        )}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
