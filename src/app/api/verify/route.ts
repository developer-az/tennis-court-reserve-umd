import { NextRequest, NextResponse } from "next/server";
import { verifyEmail } from "@/lib/db";
import { reportError } from "@/lib/errors";
import { LIMITS } from "@/lib/limits";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { verifyEmailToken } from "@/lib/tokens";

export async function GET(req: NextRequest) {
  const origin = req.nextUrl.origin;
  const ip = clientIp(req);
  const rl = await rateLimit(`verify:${ip}`, LIMITS.RATE.VERIFY);
  if (!rl.ok) {
    return NextResponse.redirect(new URL("/?verified=rate_limited", origin));
  }

  const token = req.nextUrl.searchParams.get("token");
  if (!token) {
    return NextResponse.redirect(new URL("/?verified=missing", origin));
  }

  try {
    const payload = verifyEmailToken(token, "verify");
    if (!payload) {
      return NextResponse.redirect(new URL("/?verified=invalid", origin));
    }

    const activated = await verifyEmail(payload.email);
    const url = new URL("/", origin);
    url.searchParams.set("verified", "ok");
    url.searchParams.set("email", payload.email);
    url.searchParams.set("activated", String(activated));
    return NextResponse.redirect(url);
  } catch (err) {
    await reportError(err, { where: "api/verify" });
    return NextResponse.redirect(new URL("/?verified=error", origin));
  }
}
