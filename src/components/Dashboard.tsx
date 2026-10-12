"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CourtBoard, slotKey, type Slot } from "./CourtBoard";
import { CourtDiagram } from "./CourtDiagram";
import { NotificationFeed } from "./NotificationFeed";
import { SlotPanel } from "./SlotPanel";
import { WatchForm, WatchList, type Watch } from "./WatchList";
import { buildBookingLink, PLANYO } from "@/lib/constants";
import { formatDateShort, formatHour, timeUntil } from "@/lib/format";
import { BANDS, type BandFilter, type StatusFilter } from "@/lib/schedule";

const POLL_INTERVAL_MS = 30_000;

type HealthStatus = "ok" | "degraded" | "down" | "unknown";

const STATUS: { id: StatusFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "book", label: "Book now" },
  { id: "soon", label: "Opens later" },
  { id: "space", label: "Has space" },
];

function storedEmail() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("watchEmail");
}

export default function Dashboard() {
  const [slots, setSlots] = useState<Slot[]>([]);
  const [watches, setWatches] = useState<Watch[]>([]);
  const [notifications, setNotifications] = useState<
    Array<{
      id: number;
      type: string;
      message: string;
      courtsAvailable: number | null;
      createdAt: string;
      date: string;
      hour: number;
    }>
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [banner, setBanner] = useState("");
  const [watchTarget, setWatchTarget] = useState<{ date: string; hour: number } | null>(null);
  const [lastPoll, setLastPoll] = useState<Date | null>(null);
  const [health, setHealth] = useState<{ status: HealthStatus; lastPollAt: string | null }>({
    status: "unknown",
    lastPollAt: null,
  });
  const [polling, setPolling] = useState(false);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [status, setStatus] = useState<StatusFilter>("all");
  const [band, setBand] = useState<BandFilter>("all");
  const knownNotifIds = useRef(new Set<number>());

  const watchedSlots = useMemo(
    () =>
      new Set(
        watches.filter((w) => w.status === "active" || w.status === "pending").map((w) => `${w.date}:${w.hour}`)
      ),
    [watches]
  );

  const selected = slots.find((s) => slotKey(s.date, s.hour) === selectedKey) ?? null;
  const bookable = slots.filter((s) => s.isBookable).sort((a, b) => a.date.localeCompare(b.date) || a.hour - b.hour);
  const nextBook = bookable[0] ?? null;
  const nextWindow = slots
    .filter((s) => !s.isOpen)
    .sort((a, b) => new Date(a.opensAt).getTime() - new Date(b.opensAt).getTime())[0];
  const best = bookable.reduce<Slot | null>(
    (top, s) => (!top || s.courtsAvailable > top.courtsAvailable ? s : top),
    null
  );

  const fetchAvailability = useCallback(async () => {
    const res = await fetch("/api/availability?days=4");
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    setSlots(data.slots);
  }, []);

  const fetchHealth = useCallback(async () => {
    try {
      const res = await fetch("/api/health");
      const data = await res.json();
      setHealth({
        status: (data.status as HealthStatus) ?? "unknown",
        lastPollAt: data.lastPollAt ?? null,
      });
      if (data.lastPollAt) setLastPoll(new Date(data.lastPollAt));
    } catch {
      setHealth({ status: "unknown", lastPollAt: null });
    }
  }, []);

  const fetchWatches = useCallback(async () => {
    const email = storedEmail();
    if (!email) {
      setWatches([]);
      return;
    }
    const res = await fetch(`/api/watches?email=${encodeURIComponent(email)}`);
    const data = await res.json();
    setWatches(res.ok ? (data.watches ?? []) : []);
  }, []);

  const showBrowserAlerts = useCallback((notifs: typeof notifications) => {
    if (localStorage.getItem("browserNotify") !== "true" || !("Notification" in window)) return;
    if (Notification.permission !== "granted") return;
    for (const n of notifs) {
      if (knownNotifIds.current.has(n.id)) continue;
      knownNotifIds.current.add(n.id);
      const bookingUrl = buildBookingLink(n.date, n.hour);
      const notif = new Notification(
        n.type === "slot_opened" ? "Court slot opened" : "Court available",
        { body: n.message, icon: "/tennis.svg", tag: `watch-${n.id}` }
      );
      notif.onclick = () => window.open(bookingUrl, "_blank");
    }
  }, []);

  const refreshNotifications = useCallback(async () => {
    const email = storedEmail();
    if (!email) {
      setNotifications([]);
      return;
    }
    const res = await fetch(`/api/notifications?email=${encodeURIComponent(email)}`);
    const data = await res.json();
    if (res.ok) {
      const notifs = data.notifications ?? [];
      setNotifications(notifs);
      showBrowserAlerts(notifs);
    }
  }, [showBrowserAlerts]);

  const runPoll = useCallback(async () => {
    setPolling(true);
    try {
      const res = await fetch("/api/poll", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setLastPoll(new Date());
        setNotifications(data.notifications ?? []);
        showBrowserAlerts(data.notifications ?? []);
        if (data.poll?.triggered > 0) await fetchAvailability();
        await fetchHealth();
      }
    } finally {
      setPolling(false);
    }
  }, [fetchAvailability, fetchHealth, showBrowserAlerts]);

  const refresh = useCallback(async () => {
    setError("");
    try {
      await Promise.all([fetchAvailability(), fetchWatches(), fetchHealth()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [fetchAvailability, fetchWatches, fetchHealth]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const verified = params.get("verified");
    if (!verified) return;

    if (verified === "ok") {
      const email = params.get("email");
      const activated = params.get("activated") ?? "0";
      if (email) localStorage.setItem("watchEmail", email.toLowerCase());
      setBanner(`Email confirmed. ${activated} watch${activated === "1" ? "" : "es"} activated.`);
      fetchWatches();
    } else if (verified === "invalid") {
      setBanner("That confirmation link is invalid or expired.");
    } else if (verified === "rate_limited") {
      setBanner("Too many confirmation attempts. Wait a minute and try again.");
    } else if (verified !== "missing") {
      setBanner("Could not confirm email. Create a watch again to resend.");
    }

    window.history.replaceState({}, "", "/");
  }, [fetchWatches]);

  useEffect(() => {
    const useClientPoll =
      process.env.NODE_ENV === "development" || process.env.NEXT_PUBLIC_CLIENT_POLL === "true";
    if (useClientPoll) {
      runPoll();
      const interval = setInterval(runPoll, POLL_INTERVAL_MS);
      return () => clearInterval(interval);
    }
    refreshNotifications();
    fetchHealth();
    const interval = setInterval(() => {
      refreshNotifications();
      fetchHealth();
    }, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [runPoll, refreshNotifications, fetchHealth]);

  useEffect(() => {
    const interval = setInterval(fetchAvailability, 60_000);
    return () => clearInterval(interval);
  }, [fetchAvailability]);

  async function handleCancelWatch(id: number) {
    const email = storedEmail();
    if (!email) return;
    await fetch(`/api/watches?id=${id}&email=${encodeURIComponent(email)}`, { method: "DELETE" });
    fetchWatches();
  }

  function focusSlot(slot: Slot) {
    setSelectedKey(slotKey(slot.date, slot.hour));
    setStatus("all");
    setBand("all");
    document.getElementById("board")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const healthDot =
    health.status === "ok"
      ? "bg-[#3D8F62]"
      : health.status === "degraded"
        ? "bg-[#FFD520]"
        : health.status === "down"
          ? "bg-[#C8102E]"
          : "bg-white/40";

  const healthLabel =
    health.status === "ok"
      ? "Live"
      : health.status === "degraded"
        ? "Delayed"
        : health.status === "down"
          ? "Down"
          : polling
            ? "Checking"
            : "…";

  const watchCount = watches.filter((w) => w.status === "active" || w.status === "pending").length;

  return (
    <div className="flex min-h-screen flex-col pb-24 lg:pb-0">
      <a href="#board" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:bg-white focus:px-3 focus:py-2">
        Skip to court board
      </a>
      <header className="sticky top-0 z-40 border-b border-[#FFD520]/40 bg-[#12100E] text-[#F6F1E6]">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-[0.22em] text-[#FFD520]">University of Maryland</p>
            <h1 className="font-display text-2xl font-semibold leading-none sm:text-3xl">Eppley Court Board</h1>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <div className="hidden items-center gap-2 text-xs text-white/60 sm:flex" title="Poller health">
              <span className={`h-2 w-2 rounded-full ${healthDot}`} />
              <span>{healthLabel}</span>
              {lastPoll ? (
                <span>{lastPoll.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</span>
              ) : null}
            </div>
            <a href={PLANYO.BOOKING_URL} target="_blank" rel="noopener noreferrer" className="btn-primary">
              Official booking
            </a>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 space-y-8 px-4 py-8">
        <section className="grid items-center gap-8 lg:grid-cols-[1.15fr_0.85fr]">
          <div>
            <p className="text-sm font-semibold tracking-wide text-[#8A1C24]">North Campus · west of Eppley RecWell</p>
            <h2 className="mt-2 font-display text-5xl font-semibold leading-[0.92] sm:text-6xl">
              Find a court.
              <br />
              Book the hour.
            </h2>
            <p className="mt-4 max-w-xl text-lg text-ink/75">
              Eight outdoor courts, one-hour reservations, released 48 hours before play. Confirm your email once, then
              get alerted when a watched time opens or a court frees up.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              {nextBook ? (
                <a
                  href={buildBookingLink(nextBook.date, nextBook.hour)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-primary !px-4 !py-2.5"
                >
                  Book next open · {formatHour(nextBook.hour)}
                </a>
              ) : (
                !loading && (
                  <p className="rounded-lg bg-[#F3E2B0] px-4 py-2.5 font-semibold">
                    {nextWindow ? `Next window opens in ${timeUntil(nextWindow.opensAt)}` : "No open hours in this window"}
                  </p>
                )
              )}
              {nextBook && (
                <button type="button" onClick={() => focusSlot(nextBook)} className="btn-secondary !px-4 !py-2.5">
                  Show on board
                </button>
              )}
              {best && best !== nextBook && (
                <button type="button" onClick={() => focusSlot(best)} className="btn-secondary !px-4 !py-2.5">
                  Most open · {best.courtsAvailable} courts at {formatHour(best.hour)}
                </button>
              )}
            </div>
          </div>
          <CourtDiagram />
        </section>

        <section className="grid grid-cols-2 overflow-hidden rounded-2xl border border-black/10 bg-black/10 md:grid-cols-4">
          {[
            [String(PLANYO.COURT_COUNT), "Courts"],
            [`${PLANYO.MAX_AHEAD_DAYS * 24}h`, "Booking window"],
            [String(bookable.length), "Hours you can book"],
            [String(watchCount), "Your watches"],
          ].map(([value, label]) => (
            <div key={label} className="bg-[#F7F3EA] px-4 py-4">
              <div className="font-display text-4xl leading-none">{value}</div>
              <div className="mt-1 text-sm text-ink/60">{label}</div>
            </div>
          ))}
        </section>

        {(error || banner) && (
          <div className="space-y-2">
            {error && (
              <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
                {error}
              </div>
            )}
            {banner && (
              <div className="flex items-start justify-between gap-3 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                <span>{banner}</span>
                <button type="button" onClick={() => setBanner("")} className="text-xs text-amber-700 hover:underline">
                  Dismiss
                </button>
              </div>
            )}
          </div>
        )}

        <section id="board" className="scroll-mt-20 space-y-4">
          <div className="flex items-end justify-between gap-3">
            <div>
              <h2 className="font-display text-3xl leading-none">Availability</h2>
              <p className="mt-1 text-sm text-ink/60">
                Each cell is free courts out of eight. A red dot means pickleball has priority that hour.
              </p>
            </div>
            <button type="button" onClick={refresh} className="text-sm font-semibold underline underline-offset-4">
              Refresh
            </button>
          </div>

          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="inline-flex flex-wrap rounded-lg border border-black/10 bg-white p-1" role="group" aria-label="Filter by booking status">
              {STATUS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  aria-pressed={status === item.id}
                  onClick={() => setStatus(item.id)}
                  className={`rounded-md px-3 py-1.5 text-sm font-semibold ${status === item.id ? "bg-[#12100E] text-white" : "hover:bg-black/5"}`}
                >
                  {item.label}
                </button>
              ))}
            </div>
            <div className="inline-flex flex-wrap rounded-lg border border-black/10 bg-white p-1" role="group" aria-label="Filter by time of day">
              {BANDS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  aria-pressed={band === item.id}
                  onClick={() => setBand(item.id)}
                  className={`rounded-md px-3 py-1.5 text-sm font-semibold ${band === item.id ? "bg-[#12100E] text-white" : "hover:bg-black/5"}`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink/70">
            <li className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm bg-[#1F6B45]" /> Book now</li>
            <li className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm border border-black/10 bg-[#F3E2B0]" /> Opens inside 48 hours</li>
            <li className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm bg-[#F3D6D4]" /> Full</li>
            <li className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-[#C8102E]" /> Pickleball priority</li>
          </ul>

          <div className="grid items-start gap-6 lg:grid-cols-[1fr_320px]">
            {loading ? (
              <div className="h-80 animate-pulse rounded-2xl border border-black/10 bg-white" aria-busy="true" />
            ) : (
              <CourtBoard
                slots={slots}
                watchedSlots={watchedSlots}
                selectedKey={selectedKey}
                status={status}
                band={band}
                onSelect={(slot) => setSelectedKey(slotKey(slot.date, slot.hour))}
              />
            )}
            <aside className="space-y-4 lg:sticky lg:top-20">
              <div className="hidden lg:block">
                <SlotPanel
                  slot={selected}
                  watched={selected ? watchedSlots.has(slotKey(selected.date, selected.hour)) : false}
                  onWatch={() => selected && setWatchTarget({ date: selected.date, hour: selected.hour })}
                />
              </div>
              <div>
                <h2 className="mb-2 font-display text-2xl">Watches</h2>
                <WatchList watches={watches} onCancel={handleCancelWatch} />
              </div>
              <div>
                <h2 className="mb-2 font-display text-2xl">Alerts</h2>
                <NotificationFeed notifications={notifications} />
              </div>
            </aside>
          </div>
        </section>

        <section className="grid gap-6 md:grid-cols-2">
          <div className="space-y-3 rounded-2xl border border-black/10 bg-white p-5">
            <h2 className="font-display text-3xl leading-none">How reservations work</h2>
            <ul className="space-y-2 text-sm text-ink/80">
              <li>Online booking opens exactly 48 hours before the start time.</li>
              <li>Slots are one hour, from 6:00 a.m. to midnight. Limit is one court and two consecutive hours a day.</li>
              <li>Lights are user-operated from dusk until 1:00 a.m. on courts 1–8.</li>
              <li>Pickleball is drop-in at priority times: Tue 4–10 p.m., Thu 4–8 p.m., Sun 6–10 p.m.</li>
            </ul>
            <p className="text-sm">
              <a className="font-semibold underline underline-offset-4" href="https://recwell.umd.edu/eppley-tennis-and-pickleball-courts">
                RecWell court rules
              </a>
            </p>
          </div>
          <div className="overflow-hidden rounded-2xl border border-black/10 bg-white">
            <iframe
              title="Map of Eppley Tennis Courts"
              className="h-56 w-full border-0"
              src="https://www.openstreetmap.org/export/embed.html?bbox=-76.9494%2C38.9935%2C-76.9454%2C38.9955&amp;layer=mapnik&amp;marker=38.9945084%2C-76.9474272"
            />
            <p className="px-4 py-3 text-xs text-ink/60">
              Eppley Tennis Courts, Valley Drive. Map data © OpenStreetMap contributors.
            </p>
          </div>
        </section>
      </main>

      <footer className="border-t border-black/10 px-4 py-4 text-center text-xs text-ink/50">
        Unofficial community tool · Not affiliated with UMD, RecWell, or Planyo ·{" "}
        <a href="/api/health" className="underline hover:text-ink">
          Status
        </a>
      </footer>

      {selected && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-black/10 bg-[#F7F3EA] px-3 py-3 shadow-[0_-8px_30px_rgba(0,0,0,0.12)] lg:hidden">
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="font-display text-2xl leading-none">{formatHour(selected.hour)}</p>
              <p className="truncate text-xs text-ink/70">
                {formatDateShort(selected.date)} · {selected.courtsAvailable} of {selected.courtsTotal} free
              </p>
            </div>
            {selected.isBookable && (
              <a
                href={buildBookingLink(selected.date, selected.hour)}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-primary"
              >
                Reserve
              </a>
            )}
            <button
              type="button"
              onClick={() => setWatchTarget({ date: selected.date, hour: selected.hour })}
              disabled={watchedSlots.has(slotKey(selected.date, selected.hour))}
              className="btn-secondary"
            >
              {watchedSlots.has(slotKey(selected.date, selected.hour)) ? "Watching" : "Watch"}
            </button>
            <button type="button" onClick={() => setSelectedKey(null)} className="px-2 text-xl leading-none" aria-label="Close selection">
              ×
            </button>
          </div>
        </div>
      )}

      {watchTarget && (
        <WatchForm
          date={watchTarget.date}
          hour={watchTarget.hour}
          onClose={() => setWatchTarget(null)}
          onCreated={(info) => {
            fetchWatches();
            if (info?.needsVerification) {
              setBanner("Check your inbox to confirm your email — watches stay pending until verified.");
            }
          }}
        />
      )}
    </div>
  );
}
