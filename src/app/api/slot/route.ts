import { NextRequest, NextResponse } from "next/server";
import { searchSlot } from "@/lib/planyo";
import { LIMITS } from "@/lib/limits";
import { clientIp, rateLimit, rateLimitHeaders } from "@/lib/rate-limit";
import { isValidDate, isValidHour } from "@/lib/validate";

export async function GET(req: NextRequest) {
  const ip = clientIp(req);
  const rl = await rateLimit(`slot:${ip}`, LIMITS.RATE.SLOT);
  if (!rl.ok) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: rateLimitHeaders(rl) });
  }

  const date = req.nextUrl.searchParams.get("date");
  const hour = req.nextUrl.searchParams.get("hour");
  if (!date || !hour) {
    return NextResponse.json({ error: "date and hour required" }, { status: 400 });
  }
  if (!isValidDate(date) || !isValidHour(Number(hour))) {
    return NextResponse.json({ error: "Invalid date or hour" }, { status: 400 });
  }

  try {
    const result = await searchSlot(date, Number(hour));
    return NextResponse.json(result, { headers: rateLimitHeaders(rl) });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Search failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
