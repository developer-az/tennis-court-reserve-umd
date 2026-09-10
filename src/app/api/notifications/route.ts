import { NextRequest, NextResponse } from "next/server";
import { getRecentNotifications } from "@/lib/db";
import { LIMITS } from "@/lib/limits";
import { clientIp, rateLimit, rateLimitHeaders } from "@/lib/rate-limit";
import { isValidEmail, normalizeEmail } from "@/lib/validate";

export async function GET(req: NextRequest) {
  const ip = clientIp(req);
  const rl = await rateLimit(`notifications:${ip}`, LIMITS.RATE.NOTIFICATIONS);
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

  try {
    const notifications = await getRecentNotifications(30, normalizeEmail(email));
    return NextResponse.json({ notifications }, { headers: rateLimitHeaders(rl) });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load notifications";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
