import { NextRequest, NextResponse } from "next/server";
import { getRecentNotifications, storageBackend } from "@/lib/db";
import { reportError } from "@/lib/errors";
import { isEmailConfigured } from "@/lib/notifications";
import { runPoll } from "@/lib/poller";

function isProduction(): boolean {
  return process.env.VERCEL === "1" || process.env.NODE_ENV === "production";
}

function authorize(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return !isProduction();
  }
  const auth = req.headers.get("authorization");
  if (auth === `Bearer ${secret}`) return true;
  if (req.nextUrl.searchParams.get("secret") === secret) return true;
  return false;
}

async function handlePoll(req: NextRequest) {
  if (!authorize(req)) {
    return NextResponse.json(
      {
        error: "Unauthorized",
        hint: isProduction() && !process.env.CRON_SECRET
          ? "Set CRON_SECRET in Vercel env vars"
          : undefined,
      },
      { status: 401 }
    );
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
    await reportError(err, { where: "api/poll" });
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
