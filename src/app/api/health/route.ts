import { NextResponse } from "next/server";
import { countActiveWatches, getPollMeta, storageBackend } from "@/lib/db";
import { LIMITS } from "@/lib/limits";
import { isEmailConfigured } from "@/lib/notifications";
import { describeStoreError } from "@/lib/store-error";

export const dynamic = "force-dynamic";

const noStore = { "Cache-Control": "no-store" };

export async function GET() {
  try {
    const meta = await getPollMeta();
    const activeWatches = await countActiveWatches();
    const lastPollMs = meta.lastPollAt ? Date.parse(meta.lastPollAt) : NaN;
    const ageMs = Number.isFinite(lastPollMs) ? Date.now() - lastPollMs : null;

    let status: "ok" | "degraded" | "down" | "unknown" = "unknown";
    if (ageMs === null) status = "unknown";
    else if (!meta.lastPollOk || ageMs > LIMITS.POLL_DOWN_MS) status = "down";
    else if (ageMs > LIMITS.POLL_STALE_MS) status = "degraded";
    else status = "ok";

    const body = {
      status,
      ok: status === "ok" || status === "degraded",
      lastPollAt: meta.lastPollAt,
      lastPollOk: meta.lastPollOk,
      lastPollError: meta.lastPollError,
      lastPollChecked: meta.lastPollChecked,
      lastPollTriggered: meta.lastPollTriggered,
      ageMs,
      activeWatches,
      storage: storageBackend(),
      emailConfigured: isEmailConfigured(),
      thresholds: {
        staleMs: LIMITS.POLL_STALE_MS,
        downMs: LIMITS.POLL_DOWN_MS,
      },
    };

    return NextResponse.json(body, {
      status: status === "down" ? 503 : 200,
      headers: noStore,
    });
  } catch (err) {
    return NextResponse.json(
      {
        status: "down",
        ok: false,
        error: describeStoreError(err),
        storage: storageBackend(),
        emailConfigured: isEmailConfigured(),
      },
      { status: 503, headers: noStore }
    );
  }
}
