import { NextRequest, NextResponse } from "next/server";
import { searchSlot } from "@/lib/planyo";

export async function GET(req: NextRequest) {
  const date = req.nextUrl.searchParams.get("date");
  const hour = req.nextUrl.searchParams.get("hour");
  if (!date || !hour) {
    return NextResponse.json({ error: "date and hour required" }, { status: 400 });
  }
  try {
    const result = await searchSlot(date, Number(hour));
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Search failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
