import { NextRequest, NextResponse } from "next/server";
import { cancelWatch, createWatch, getWatchesByEmail } from "@/lib/db";
import { reportError } from "@/lib/errors";
import { LIMITS } from "@/lib/limits";
import { sendVerificationEmail } from "@/lib/notifications";
import { PLANYO } from "@/lib/planyo";
import { clientIp, rateLimit, rateLimitHeaders } from "@/lib/rate-limit";
import {
  isValidDiscordWebhook,
  isValidEmail,
  isValidHour,
  isWatchDateAllowed,
  normalizeEmail,
  sanitizeLabel,
} from "@/lib/validate";

export async function GET(req: NextRequest) {
  const ip = clientIp(req);
  const rl = await rateLimit(`watches:get:${ip}`, LIMITS.RATE.WATCHES_READ);
  if (!rl.ok) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: rateLimitHeaders(rl) });
  }

  const email = req.nextUrl.searchParams.get("email");
  if (!email || !isValidEmail(email)) {
    return NextResponse.json(
      { error: "email query parameter is required" },
      { status: 400, headers: rateLimitHeaders(rl) }
    );
  }

  const watches = await getWatchesByEmail(normalizeEmail(email));
  return NextResponse.json({ watches }, { headers: rateLimitHeaders(rl) });
}

export async function POST(req: NextRequest) {
  const ip = clientIp(req);
  const rl = await rateLimit(`watches:post:${ip}`, LIMITS.RATE.WATCHES_WRITE);
  if (!rl.ok) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: rateLimitHeaders(rl) });
  }

  try {
    const body = await req.json();
    const { date, hour, label, email, discordWebhook, notifyOnOpen, notifyOnAvailable } = body;

    if (!date || hour === undefined) {
      return NextResponse.json({ error: "date and hour are required" }, { status: 400 });
    }

    if (!isWatchDateAllowed(String(date))) {
      return NextResponse.json(
        { error: `date must be a valid day within the next ${LIMITS.MAX_WATCH_AHEAD_DAYS} days` },
        { status: 400 }
      );
    }

    if (!email && !discordWebhook) {
      return NextResponse.json(
        { error: "Provide an email address and/or Discord webhook for notifications" },
        { status: 400 }
      );
    }

    if (email && !isValidEmail(String(email))) {
      return NextResponse.json({ error: "Invalid email address" }, { status: 400 });
    }

    if (discordWebhook && !isValidDiscordWebhook(String(discordWebhook))) {
      return NextResponse.json(
        { error: "Discord webhook must be a discord.com/api/webhooks/... URL" },
        { status: 400 }
      );
    }

    const h = Number(hour);
    if (!isValidHour(h)) {
      return NextResponse.json(
        { error: `Hour must be between ${PLANYO.FIRST_HOUR} and ${PLANYO.LAST_HOUR - 1}` },
        { status: 400 }
      );
    }

    const normalizedEmail = email ? normalizeEmail(String(email)) : undefined;
    const { watch, needsVerification } = await createWatch({
      date: String(date),
      hour: h,
      label: sanitizeLabel(label),
      email: normalizedEmail,
      discordWebhook: discordWebhook ? String(discordWebhook).trim() : undefined,
      notifyOnOpen,
      notifyOnAvailable,
    });

    if (needsVerification && normalizedEmail) {
      const sent = await sendVerificationEmail(normalizedEmail);
      if (!sent) {
        return NextResponse.json(
          {
            watch,
            needsVerification: true,
            warning: "Watch saved as pending, but verification email failed to send. Try again later.",
          },
          { status: 201, headers: rateLimitHeaders(rl) }
        );
      }
    }

    return NextResponse.json(
      { watch, needsVerification },
      { status: 201, headers: rateLimitHeaders(rl) }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create watch";
    if (message.includes("UNIQUE")) {
      return NextResponse.json({ error: "You already have an active watch for this slot" }, { status: 409 });
    }
    if (message.includes("Limit of") || message.includes("at capacity") || message.includes("unsubscribed")) {
      return NextResponse.json({ error: message }, { status: 429 });
    }
    await reportError(err, { where: "api/watches POST" });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const ip = clientIp(req);
  const rl = await rateLimit(`watches:delete:${ip}`, LIMITS.RATE.WATCHES_WRITE);
  if (!rl.ok) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: rateLimitHeaders(rl) });
  }

  const id = req.nextUrl.searchParams.get("id");
  const email = req.nextUrl.searchParams.get("email");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  if (!email || !isValidEmail(email)) {
    return NextResponse.json({ error: "email required to cancel a watch" }, { status: 400 });
  }

  const ok = await cancelWatch(Number(id), normalizeEmail(email));
  if (!ok) return NextResponse.json({ error: "Watch not found" }, { status: 404 });
  return NextResponse.json({ success: true }, { headers: rateLimitHeaders(rl) });
}
