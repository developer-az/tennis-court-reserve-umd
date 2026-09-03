import { NextResponse } from "next/server";
import { getRecentNotifications } from "@/lib/db";

export async function GET() {
  try {
    const notifications = await getRecentNotifications(30);
    return NextResponse.json({ notifications });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load notifications";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
