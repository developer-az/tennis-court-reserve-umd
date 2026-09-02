import { NextResponse } from "next/server";
import { getRecentNotifications } from "@/lib/db";
import { runPoll } from "@/lib/poller";

export async function GET() {
  try {
    const pollResult = await runPoll();
    const notifications = getRecentNotifications(30);
    return NextResponse.json({ poll: pollResult, notifications });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Poll failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST() {
  return GET();
}
