/** Wall-clock helpers. Eppley books in America/New_York; Vercel servers run in UTC. */

export function timeZoneOffsetMs(utcMs: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(utcMs));

  const pick = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((part) => part.type === type)?.value ?? "0";

  let hour = Number(pick("hour"));
  if (hour === 24) hour = 0;

  const asUtc = Date.UTC(
    Number(pick("year")),
    Number(pick("month")) - 1,
    Number(pick("day")),
    hour,
    Number(pick("minute")),
    Number(pick("second"))
  );
  return asUtc - utcMs;
}

/** Interpret a calendar date and clock time in `timeZone` as an absolute instant. */
export function zonedWallTime(date: string, hour: number, minute: number, timeZone: string): Date {
  const [year, month, day] = date.split("-").map(Number);
  const utcGuess = Date.UTC(year, month - 1, day, hour, minute, 0);
  const offset = timeZoneOffsetMs(utcGuess, timeZone);
  let instant = utcGuess - offset;
  const offsetAtInstant = timeZoneOffsetMs(instant, timeZone);
  if (offsetAtInstant !== offset) instant = utcGuess - offsetAtInstant;
  return new Date(instant);
}

export function zonedParts(
  date: Date,
  timeZone: string
): { year: number; month: number; day: number; hour: number; minute: number; second: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);

  const pick = (type: Intl.DateTimeFormatPartTypes): number =>
    Number(parts.find((part) => part.type === type)?.value ?? "0");

  let hour = pick("hour");
  if (hour === 24) hour = 0;

  return {
    year: pick("year"),
    month: pick("month"),
    day: pick("day"),
    hour,
    minute: pick("minute"),
    second: pick("second"),
  };
}

export function formatYmd(year: number, month: number, day: number): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${year}-${pad(month)}-${pad(day)}`;
}

export function todayInTimeZone(now: Date, timeZone: string): string {
  const parts = zonedParts(now, timeZone);
  return formatYmd(parts.year, parts.month, parts.day);
}

export function addCalendarDays(date: string, days: number): string {
  const [year, month, day] = date.split("-").map(Number);
  const utc = new Date(Date.UTC(year, month - 1, day + days));
  return formatYmd(utc.getUTCFullYear(), utc.getUTCMonth() + 1, utc.getUTCDate());
}
