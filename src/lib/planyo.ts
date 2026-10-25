import { PLANYO } from "./constants";
import { addCalendarDays, zonedParts, zonedWallTime } from "./time";

export { PLANYO, buildBookingLink } from "./constants";

export interface SlotAvailability {
  date: string;
  hour: number;
  startTime: string;
  endTime: string;
  courtsAvailable: number;
  courtsTotal: number;
  isBookable: boolean;
  opensAt: string;
  isOpen: boolean;
  reason?: string;
}

export interface MonthData {
  year: number;
  month: number;
  resUsage: Record<string, Record<string, number>>;
  vacations: Record<string, Record<string, Record<string, { v: number | string; c?: string }>>>;
}

export interface ResourceSearchResult {
  quantity_available: number;
  quantity: string;
  rental_max_ahead_days: string;
  first_hour: string;
  last_hour: string;
}

interface PlanyoFetchResponse {
  res_usage?: Record<string, Record<string, number | Record<string, number>>>;
  vacations?: Record<string, Record<string, Record<string, { v: number | string; c?: string }>>>;
  year?: string;
  month?: string;
}

interface PlanyoSearchResponse {
  response_code: number;
  response_message: string;
  data?: {
    results?: ResourceSearchResult[];
    reason_not_listed?: Record<string, string> | string[];
  };
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

export function formatDateTime(d: Date): string {
  const parts = zonedParts(d, PLANYO.TIMEZONE);
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)} ${pad(parts.hour)}:${pad(parts.minute)}:${pad(parts.second)}`;
}

/** Slot start as an absolute instant. `hour` is America/New_York wall time, not server local. */
export function parseSlotDateTime(date: string, hour: number): Date {
  return zonedWallTime(date, hour, 0, PLANYO.TIMEZONE);
}

/** Same Eastern clock time, two calendar days earlier (Friday 4 PM opens Wednesday 4 PM). */
export function getOpensAt(slotStart: Date): Date {
  const wall = zonedParts(slotStart, PLANYO.TIMEZONE);
  const openDate = addCalendarDays(
    `${wall.year}-${pad(wall.month)}-${pad(wall.day)}`,
    -PLANYO.MAX_AHEAD_DAYS
  );
  return zonedWallTime(openDate, wall.hour, 0, PLANYO.TIMEZONE);
}

export function isSlotOpenForBooking(slotStart: Date, now = new Date()): boolean {
  return now >= getOpensAt(slotStart) && slotStart > now;
}

export async function fetchMonthData(year: number, month: number): Promise<MonthData> {
  const url = `${PLANYO.FETCH_DATA_URL}?id=${PLANYO.SITE_ID}&month=${month}&year=${year}`;
  const res = await fetch(url, {
    headers: { "User-Agent": "UMD-Tennis-Reserve/1.0" },
    next: { revalidate: 30 },
    signal: AbortSignal.timeout(8_000),
  });
  if (!res.ok) throw new Error(`Planyo fetch-data failed: ${res.status}`);
  const data = (await res.json()) as PlanyoFetchResponse;

  return {
    year,
    month,
    resUsage: parseResUsage(data.res_usage ?? {}),
    vacations: data.vacations ?? {},
  };
}

/** Normalize Planyo res_usage (supports nested resourceId maps and flat counts). */
export function parseResUsage(
  rawUsage: Record<string, Record<string, number | Record<string, number>>>
): Record<string, Record<string, number>> {
  const resUsage: Record<string, Record<string, number>> = {};
  for (const [day, dayData] of Object.entries(rawUsage)) {
    if (day === "md" || day === "pd") continue;
    resUsage[day] = {};
    for (const [key, val] of Object.entries(dayData)) {
      if (key === "md" || key === "pd") continue;
      if (typeof val === "number") {
        resUsage[day][key] = val;
      } else if (val && typeof val === "object") {
        const nested = val as Record<string, number>;
        const count = nested[PLANYO.RESOURCE_ID] ?? Object.values(nested)[0];
        if (typeof count === "number") {
          resUsage[day][key] = count;
        }
      }
    }
  }
  return resUsage;
}

export async function searchSlot(date: string, hour: number): Promise<{
  available: boolean;
  courtsAvailable: number;
  reason?: string;
}> {
  const start = parseSlotDateTime(date, hour);
  const end = new Date(start.getTime() + PLANYO.SLOT_HOURS * 60 * 60 * 1000);

  const body = new URLSearchParams({
    ulap_url: "https://www.planyo.com/rest/planyo-reservations.php",
    mode: "resource_search",
    output: "json",
    site_id: PLANYO.SITE_ID,
    resource_id: PLANYO.RESOURCE_ID,
    start_time: formatDateTime(start),
    end_time: formatDateTime(end),
    quantity: "1",
    plugin_mode: "10",
    dynm: "1",
    language: "EN",
  });

  const res = await fetch(PLANYO.ULAP_URL, {
    method: "POST",
    headers: {
      "User-Agent": "UMD-Tennis-Reserve/1.0",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
    cache: "no-store",
    signal: AbortSignal.timeout(8_000),
  });

  if (!res.ok) throw new Error(`Planyo search failed: ${res.status}`);
  let data: PlanyoSearchResponse;
  try {
    data = (await res.json()) as PlanyoSearchResponse;
  } catch {
    throw new Error("Planyo search returned invalid JSON");
  }

  if (data.response_code !== 0 || !data.data?.results?.length) {
    const reason = data.data?.reason_not_listed;
    let reasonText = data.response_message;
    if (reason && typeof reason === "object" && !Array.isArray(reason)) {
      reasonText = Object.values(reason)[0] ?? reasonText;
    }
    return { available: false, courtsAvailable: 0, reason: reasonText };
  }

  const result = data.data.results[0];
  return {
    available: result.quantity_available > 0,
    courtsAvailable: result.quantity_available,
  };
}

function getVacationBlocked(dayVacations: Record<string, Record<string, { v: number | string; c?: string }>> | undefined, hour: number): number {
  if (!dayVacations) return 0;
  const resourceVac = dayVacations[PLANYO.RESOURCE_ID] ?? dayVacations[`${PLANYO.RESOURCE_ID}/unass`];
  if (!resourceVac) return 0;
  const hourData = resourceVac[String(hour)] ?? resourceVac["ad"];
  if (!hourData) return 0;
  return typeof hourData.v === "string" ? parseInt(hourData.v, 10) : hourData.v;
}

export async function getDaySlots(
  date: string,
  now = new Date(),
  monthCache?: Map<string, MonthData>
): Promise<SlotAvailability[]> {
  const [y, m, d] = date.split("-").map(Number);
  const cacheKey = `${y}-${m}`;
  let monthData = monthCache?.get(cacheKey);
  if (!monthData) {
    monthData = await fetchMonthData(y, m);
    monthCache?.set(cacheKey, monthData);
  }
  const dayKey = String(d);
  const dayUsage = monthData.resUsage[dayKey] ?? {};
  const dayVacations = monthData.vacations[dayKey];

  const slots: SlotAvailability[] = [];

  for (let hour = PLANYO.FIRST_HOUR; hour < PLANYO.LAST_HOUR; hour++) {
    const slotStart = parseSlotDateTime(date, hour);
    if (slotStart <= now) continue;

    const booked = dayUsage[String(hour)] ?? 0;
    const vacationBlocked = getVacationBlocked(dayVacations, hour);
    // Bookings and vacation blocks are separate; both reduce available courts.
    const blocked = booked + vacationBlocked;
    const courtsAvailable = Math.max(0, PLANYO.COURT_COUNT - blocked);
    const opensAt = getOpensAt(slotStart);
    const isOpen = isSlotOpenForBooking(slotStart, now);

    const end = new Date(slotStart.getTime() + PLANYO.SLOT_HOURS * 60 * 60 * 1000);

    slots.push({
      date,
      hour,
      startTime: formatDateTime(slotStart),
      endTime: formatDateTime(end),
      courtsAvailable,
      courtsTotal: PLANYO.COURT_COUNT,
      isBookable: isOpen && courtsAvailable > 0,
      opensAt: opensAt.toISOString(),
      isOpen,
      reason: !isOpen ? `Opens ${opensAt.toLocaleString("en-US", { timeZone: PLANYO.TIMEZONE })}` : courtsAvailable === 0 ? "Fully booked" : undefined,
    });
  }

  return slots;
}

export async function getSlotsInRange(startDate: string, days: number, now = new Date()): Promise<SlotAvailability[]> {
  const all: SlotAvailability[] = [];
  const monthCache = new Map<string, MonthData>();
  const count = Number.isFinite(days) ? Math.max(0, Math.floor(days)) : 0;
  for (let i = 0; i < count; i++) {
    const daySlots = await getDaySlots(addCalendarDays(startDate, i), now, monthCache);
    all.push(...daySlots);
  }
  return all;
}
