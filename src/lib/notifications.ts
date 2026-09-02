import { buildBookingLink, PLANYO } from "./constants";

export async function sendDiscordWebhook(
  webhookUrl: string,
  payload: { title: string; description: string; color?: number; url?: string }
): Promise<boolean> {
  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        embeds: [
          {
            title: payload.title,
            description: payload.description,
            color: payload.color ?? 0xe03a3e,
            url: payload.url,
            footer: { text: "UMD Tennis Court Alerts" },
            timestamp: new Date().toISOString(),
          },
        ],
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export function formatHour(hour: number): string {
  const h = hour % 12 || 12;
  const ampm = hour < 12 ? "AM" : "PM";
  return `${h}:00 ${ampm}`;
}

export function formatSlotLabel(date: string, hour: number): string {
  const d = new Date(`${date}T12:00:00`);
  const dayName = d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  return `${dayName} at ${formatHour(hour)}`;
}

export function buildOpenNotification(date: string, hour: number, courtsAvailable: number): {
  title: string;
  message: string;
  bookingUrl: string;
} {
  const label = formatSlotLabel(date, hour);
  const bookingUrl = buildBookingLink(date, hour);
  return {
    title: "🎾 Court slot is now open for booking!",
    message: `${label} — ${courtsAvailable} of ${PLANYO.COURT_COUNT} courts available. Book within 48 hours before play time.`,
    bookingUrl,
  };
}

export function buildAvailableNotification(date: string, hour: number, courtsAvailable: number): {
  title: string;
  message: string;
  bookingUrl: string;
} {
  const label = formatSlotLabel(date, hour);
  const bookingUrl = buildBookingLink(date, hour);
  return {
    title: "✅ Court became available!",
    message: `${label} — ${courtsAvailable} court${courtsAvailable !== 1 ? "s" : ""} now open. Someone may have cancelled.`,
    bookingUrl,
  };
}
