import { timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { storageBackend } from "@/lib/db";
import { reportError } from "@/lib/errors";
import { isEmailConfigured } from "@/lib/notifications";
import { runPoll } from "@/lib/poller";

export const dynamic = "force-dynamic";

function isProduction(): boolean {
  return process.env.VERCEL === "1" || process.env.NODE_ENV === "production";
}

function bearerMatches(header: string | null, secret: string): boolean {
  if (!header?.startsWith("Bearer ")) return false;
  const token = header.slice("Bearer ".length);
  const left = Buffer.from(token);
  const right = Buffer.from(secret);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

function authorize(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return !isProduction();
  return bearerMatches(req.headers.get("authorization"), secret);
}

async function handlePoll(req: NextRequest) {
  if (!authorize(req)) {
    return NextResponse.json(
      {
        error: "Unauthorized",
        hint:
          isProduction() && !process.env.CRON_SECRET ? "Set CRON_SECRET in Vercel env vars" : undefined,
      },
      { status: 401, headers: { "Cache-Control": "no-store" } }
    );
  }

  try {
    const pollResult = await runPoll();
    return NextResponse.json(
      {
        poll: pollResult,
        storage: storageBackend(),
        emailConfigured: isEmailConfigured(),
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    await reportError(err, { where: "api/poll" });
    const message = err instanceof Error ? err.message : "Poll failed";
    return NextResponse.json({ error: message }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}

export async function GET(req: NextRequest) {
  return handlePoll(req);
}

export async function POST(req: NextRequest) {
  return handlePoll(req);
}
