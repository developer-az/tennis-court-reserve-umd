import { NextRequest, NextResponse } from "next/server";
import { getDaySlots, getSlotsInRange } from "@/lib/planyo";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const date = searchParams.get("date");
  const days = parseInt(searchParams.get("days") ?? "3", 10);

  try {
    if (date) {
      const slots = await getDaySlots(date);
      return NextResponse.json({ slots });
    }

    const today = new Date();
    const startDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    const slots = await getSlotsInRange(startDate, Math.min(days, 7));
    return NextResponse.json({ slots });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch availability";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
