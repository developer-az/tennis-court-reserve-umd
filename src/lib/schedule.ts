export type TimeBand = "morning" | "afternoon" | "evening" | "night";
export type StatusFilter = "all" | "book" | "soon" | "space";
export type BandFilter = "all" | TimeBand;

export function bandForHour(hour: number): TimeBand {
  if (hour < 12) return "morning";
  if (hour < 17) return "afternoon";
  if (hour < 21) return "evening";
  return "night";
}

export const BANDS: { id: BandFilter; label: string; hint: string }[] = [
  { id: "all", label: "All day", hint: "6a–12a" },
  { id: "morning", label: "Morning", hint: "6a–12p" },
  { id: "afternoon", label: "Afternoon", hint: "12p–5p" },
  { id: "evening", label: "Evening", hint: "5p–9p" },
  { id: "night", label: "Night", hint: "9p–12a" },
];

/** Drop-in pickleball priority on Eppley courts. Tennis can still be reserved; this is a heads-up. */
export function pickleballNote(date: string, hour: number): string | null {
  const day = new Date(`${date}T12:00:00`).getDay();
  if (day === 2 && hour >= 16 && hour < 20) return "Pickleball priority on courts 1–4";
  if (day === 2 && hour >= 20 && hour < 22) return "Pickleball priority on all courts";
  if (day === 4 && hour >= 16 && hour < 20) return "Pickleball priority on courts 1–4";
  if (day === 0 && hour >= 18 && hour < 20) return "Pickleball priority on courts 1–4";
  if (day === 0 && hour >= 20 && hour < 22) return "Pickleball priority on all courts";
  return null;
}

export function slotMatches(
  slot: { hour: number; isBookable: boolean; isOpen: boolean; courtsAvailable: number },
  status: StatusFilter,
  band: BandFilter
): boolean {
  if (band !== "all" && bandForHour(slot.hour) !== band) return false;
  if (status === "book" && !slot.isBookable) return false;
  if (status === "soon" && slot.isOpen) return false;
  if (status === "space" && slot.courtsAvailable <= 0) return false;
  return true;
}
