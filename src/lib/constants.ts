export const PLANYO = {
  SITE_ID: "36698",
  RESOURCE_ID: "118770",
  COURT_COUNT: 8,
  FIRST_HOUR: 6,
  LAST_HOUR: 24,
  MAX_AHEAD_DAYS: 2,
  SLOT_HOURS: 1,
  TIMEZONE: "America/New_York",
  BOOKING_URL: "https://www.planyo.com/booking.php?calendar=36698&mode=reserve&prefill=true&resource_id=118770",
  ULAP_URL: "https://www.planyo.com/Plugins/PlanyoFiles/non-planyo-ulap.php",
  FETCH_DATA_URL: "https://www.planyo.com/fetch-data.php",
} as const;

export function buildBookingLink(date: string, hour: number): string {
  const params = new URLSearchParams({
    calendar: PLANYO.SITE_ID,
    mode: "reserve",
    prefill: "true",
    resource_id: PLANYO.RESOURCE_ID,
    one_date: date,
    start_date: date,
    start_time: String(hour),
  });
  return `https://www.planyo.com/booking.php?${params}`;
}
