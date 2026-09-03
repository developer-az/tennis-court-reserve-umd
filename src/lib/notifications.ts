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

export function isEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

export async function sendEmail(input: {
  to: string;
  subject: string;
  text: string;
  bookingUrl?: string;
}): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("RESEND_API_KEY not set — skipping email");
    return false;
  }

  const from = process.env.EMAIL_FROM ?? "UMD Tennis Alerts <onboarding@resend.dev>";
  const html = `
    <div style="font-family:Georgia,serif;max-width:520px;margin:0 auto;padding:24px;background:#151515;color:#fff;border-radius:12px;">
      <h1 style="color:#FFD520;font-size:22px;margin:0 0 12px;">${escapeHtml(input.subject)}</h1>
      <p style="color:#ddd;font-size:16px;line-height:1.5;margin:0 0 20px;">${escapeHtml(input.text)}</p>
      ${
        input.bookingUrl
          ? `<a href="${escapeHtml(input.bookingUrl)}" style="display:inline-block;background:#E03A3E;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:600;">Book court on Planyo</a>`
          : ""
      }
      <p style="color:#888;font-size:12px;margin-top:24px;">UMD Tennis Court Alerts · Eppley Recreation Center</p>
    </div>
  `;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [input.to],
        subject: input.subject,
        text: input.text + (input.bookingUrl ? `\n\nBook: ${input.bookingUrl}` : ""),
        html,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      console.error("Resend error:", res.status, body);
      return false;
    }
    return true;
  } catch (err) {
    console.error("Resend send failed:", err);
    return false;
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
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
    title: "Court slot is now open for booking!",
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
    title: "Court became available!",
    message: `${label} — ${courtsAvailable} court${courtsAvailable !== 1 ? "s" : ""} now open. Someone may have cancelled.`,
    bookingUrl,
  };
}

export async function deliverAlert(input: {
  email?: string | null;
  discordWebhook?: string | null;
  title: string;
  message: string;
  bookingUrl: string;
  discordColor?: number;
  extraDiscord?: string;
}): Promise<void> {
  const tasks: Promise<unknown>[] = [];

  if (input.email) {
    tasks.push(
      sendEmail({
        to: input.email,
        subject: input.title,
        text: input.message,
        bookingUrl: input.bookingUrl,
      })
    );
  }

  if (input.discordWebhook) {
    tasks.push(
      sendDiscordWebhook(input.discordWebhook, {
        title: input.title,
        description: input.message + (input.extraDiscord ?? ""),
        url: input.bookingUrl,
        color: input.discordColor,
      })
    );
  }

  await Promise.all(tasks);
}
