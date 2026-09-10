import { NextRequest, NextResponse } from "next/server";
import { getDaySlots, getSlotsInRange } from "@/lib/planyo";
import { LIMITS } from "@/lib/limits";
import { clientIp, rateLimit, rateLimitHeaders } from "@/lib/rate-limit";
import { isValidDate } from "@/lib/validate";

export async function GET(req: NextRequest) {
  const ip = clientIp(req);
  const rl = await rateLimit(`availability:${ip}`, LIMITS.RATE.AVAILABILITY);
  if (!rl.ok) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: rateLimitHeaders(rl) });
  }

  const { searchParams } = req.nextUrl;
  const date = searchParams.get("date");
  const days = parseInt(searchParams.get("days") ?? "3", 10);

  try {
    if (date) {
      if (!isValidDate(date)) {
        return NextResponse.json({ error: "Invalid date" }, { status: 400 });
      }
      const slots = await getDaySlots(date);
      return NextResponse.json(
        { slots },
        { headers: { ...rateLimitHeaders(rl), "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60" } }
      );
    }

    const today = new Date();
    const startDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    const slots = await getSlotsInRange(startDate, Math.min(Math.max(days, 1), 7));
    return NextResponse.json(
      { slots },
      { headers: { ...rateLimitHeaders(rl), "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60" } }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch availability";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
