"use client";

import { useState } from "react";
import { buildBookingLink } from "@/lib/constants";
import { formatDate, formatHour, formatOpensAt, timeUntil } from "@/lib/format";
import { pickleballNote } from "@/lib/schedule";
import type { Slot } from "./CourtBoard";

interface Props {
  slot: Slot | null;
  watched: boolean;
  onWatch: () => void;
}

export function SlotPanel({ slot, watched, onWatch }: Props) {
  const [copied, setCopied] = useState(false);

  if (!slot) {
    return (
      <div className="rounded-2xl border border-dashed border-black/15 bg-white/70 p-5 text-sm text-ink/60">
        Select a time on the board. The number in each cell is how many of the eight courts are free.
      </div>
    );
  }

  const pickle = pickleballNote(slot.date, slot.hour);
  const bookingUrl = buildBookingLink(slot.date, slot.hour);
  const freePct = Math.round((slot.courtsAvailable / slot.courtsTotal) * 100);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(bookingUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="rounded-2xl border border-black/10 bg-white p-5 space-y-4">
      <div>
        <p className="text-xs uppercase tracking-[0.16em] text-ink/50">Selected time</p>
        <h3 className="font-display text-3xl leading-none mt-1">
          {formatHour(slot.hour)}
        </h3>
        <p className="text-ink/70 mt-1">{formatDate(slot.date)}</p>
      </div>

      <div>
        <div className="flex justify-between text-sm mb-1">
          <span>{slot.courtsAvailable} of {slot.courtsTotal} free</span>
          <span className="text-ink/50">{freePct}%</span>
        </div>
        <div className="h-2 rounded-full bg-black/10 overflow-hidden" aria-hidden>
          <div className="h-full bg-[#1F6B45]" style={{ width: `${freePct}%` }} />
        </div>
      </div>

      <p className="text-sm">
        {slot.isBookable
          ? "Booking is open. One-hour slots, one court per person."
          : slot.isOpen
            ? "This hour is full inside the booking window."
            : `Booking opens ${formatOpensAt(slot.opensAt)} · ${timeUntil(slot.opensAt)}`}
      </p>

      {pickle && (
        <p className="text-sm rounded-lg bg-[#F3E2B0] px-3 py-2">
          {pickle}. Pickleball is drop-in only; a tennis reservation does not hold those courts for pickleball.
        </p>
      )}

      <div className="flex flex-col gap-2">
        {slot.isBookable && (
          <a
            href={bookingUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg bg-[#C8102E] text-white text-center font-semibold py-2.5 hover:bg-[#A30D25]"
          >
            Reserve on Planyo
          </a>
        )}
        <button
          type="button"
          onClick={onWatch}
          disabled={watched}
          className="rounded-lg border border-black/15 py-2.5 font-semibold hover:bg-black/[0.03] disabled:opacity-60"
        >
          {watched ? "Watching this time" : slot.isOpen ? "Alert me if a court frees up" : "Alert me when booking opens"}
        </button>
        <button type="button" onClick={copyLink} className="text-sm text-ink/60 hover:text-ink py-1">
          {copied ? "Link copied" : "Copy booking link"}
        </button>
      </div>
    </div>
  );
}
