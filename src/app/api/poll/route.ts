import { NextRequest, NextResponse } from "next/server";
import { getRecentNotifications, storageBackend } from "@/lib/db";
import { isEmailConfigured } from "@/lib/notifications";
import { runPoll } from "@/lib/poller";

function authorize(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  const auth = req.headers.get("authorization");
  if (auth === `Bearer ${secret}`) return true;
  if (req.nextUrl.searchParams.get("secret") === secret) return true;
  return false;
}

async function handlePoll(req: NextRequest) {
  if (!authorize(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const pollResult = await runPoll();
    const notifications = await getRecentNotifications(30);
    return NextResponse.json({
      poll: pollResult,
      notifications,
      storage: storageBackend(),
      emailConfigured: isEmailConfigured(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Poll failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  return handlePoll(req);
}

export async function POST(req: NextRequest) {
  return handlePoll(req);
}
