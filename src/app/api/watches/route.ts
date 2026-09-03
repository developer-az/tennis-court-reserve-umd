import { NextRequest, NextResponse } from "next/server";
import { cancelWatch, createWatch, getAllWatches } from "@/lib/db";
import { PLANYO } from "@/lib/planyo";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function GET() {
  const watches = await getAllWatches();
  return NextResponse.json({ watches });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { date, hour, label, email, discordWebhook, notifyOnOpen, notifyOnAvailable } = body;

    if (!date || hour === undefined) {
      return NextResponse.json({ error: "date and hour are required" }, { status: 400 });
    }

    if (!email && !discordWebhook) {
      return NextResponse.json(
        { error: "Provide an email address and/or Discord webhook for notifications" },
        { status: 400 }
      );
    }

    if (email && !EMAIL_RE.test(String(email))) {
      return NextResponse.json({ error: "Invalid email address" }, { status: 400 });
    }

    const h = Number(hour);
    if (h < PLANYO.FIRST_HOUR || h >= PLANYO.LAST_HOUR) {
      return NextResponse.json(
        { error: `Hour must be between ${PLANYO.FIRST_HOUR} and ${PLANYO.LAST_HOUR - 1}` },
        { status: 400 }
      );
    }

    const watch = await createWatch({
      date,
      hour: h,
      label,
      email: email || undefined,
      discordWebhook: discordWebhook || undefined,
      notifyOnOpen,
      notifyOnAvailable,
    });

    return NextResponse.json({ watch }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create watch";
    if (message.includes("UNIQUE")) {
      return NextResponse.json({ error: "You already have an active watch for this slot" }, { status: 409 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const ok = await cancelWatch(Number(id));
  if (!ok) return NextResponse.json({ error: "Watch not found" }, { status: 404 });
  return NextResponse.json({ success: true });
}
