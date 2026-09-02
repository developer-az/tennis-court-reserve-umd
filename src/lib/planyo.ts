import { PLANYO } from "./constants";

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
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:00:00`;
}

export function parseSlotDateTime(date: string, hour: number): Date {
  return new Date(`${date}T${pad(hour)}:00:00`);
}

export function getOpensAt(slotStart: Date): Date {
  const opens = new Date(slotStart);
  opens.setDate(opens.getDate() - PLANYO.MAX_AHEAD_DAYS);
  return opens;
}

export function isSlotOpenForBooking(slotStart: Date, now = new Date()): boolean {
  const opens = getOpensAt(slotStart);
  const maxBookable = new Date(now);
  maxBookable.setDate(maxBookable.getDate() + PLANYO.MAX_AHEAD_DAYS);
  maxBookable.setHours(23, 59, 59, 999);
  return now >= opens && slotStart > now;
}

export async function fetchMonthData(year: number, month: number): Promise<MonthData> {
  const url = `${PLANYO.FETCH_DATA_URL}?id=${PLANYO.SITE_ID}&month=${month}&year=${year}`;
  const res = await fetch(url, {
    headers: { "User-Agent": "UMD-Tennis-Reserve/1.0" },
    next: { revalidate: 30 },
  });
  if (!res.ok) throw new Error(`Planyo fetch-data failed: ${res.status}`);
  const data = (await res.json()) as PlanyoFetchResponse;

  const resUsage: Record<string, Record<string, number>> = {};
  const rawUsage = data.res_usage ?? {};
  for (const [day, dayData] of Object.entries(rawUsage)) {
    if (day === "md" || day === "pd") continue;
    resUsage[day] = {};
    for (const [key, val] of Object.entries(dayData)) {
      if (typeof val === "number") {
        resUsage[day][key] = val;
      }
    }
  }

  return {
    year,
    month,
    resUsage,
    vacations: data.vacations ?? {},
  };
}

export async function searchSlot(date: string, hour: number): Promise<{
  available: boolean;
  courtsAvailable: number;
  reason?: string;
}> {
  const start = parseSlotDateTime(date, hour);
  const end = new Date(start);
  end.setHours(end.getHours() + PLANYO.SLOT_HOURS);

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
  });

  const data = (await res.json()) as PlanyoSearchResponse;

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

export async function getDaySlots(date: string, now = new Date()): Promise<SlotAvailability[]> {
  const [y, m, d] = date.split("-").map(Number);
  const monthData = await fetchMonthData(y, m);
  const dayKey = String(d);
  const dayUsage = monthData.resUsage[dayKey] ?? {};
  const dayVacations = monthData.vacations[dayKey];

  const slots: SlotAvailability[] = [];

  for (let hour = PLANYO.FIRST_HOUR; hour < PLANYO.LAST_HOUR; hour++) {
    const slotStart = parseSlotDateTime(date, hour);
    if (slotStart <= now) continue;

    const booked = dayUsage[String(hour)] ?? dayUsage[PLANYO.RESOURCE_ID] ?? 0;
    const vacationBlocked = getVacationBlocked(dayVacations, hour);
    const blocked = Math.max(booked, vacationBlocked);
    const courtsAvailable = Math.max(0, PLANYO.COURT_COUNT - blocked);
    const opensAt = getOpensAt(slotStart);
    const isOpen = isSlotOpenForBooking(slotStart, now);

    const end = new Date(slotStart);
    end.setHours(end.getHours() + 1);

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

export async function getSlotsInRange(startDate: string, days: number): Promise<SlotAvailability[]> {
  const all: SlotAvailability[] = [];
  const start = new Date(`${startDate}T12:00:00`);
  for (let i = 0; i < days; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    const dateStr = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    const daySlots = await getDaySlots(dateStr);
    all.push(...daySlots);
  }
  return all;
}
