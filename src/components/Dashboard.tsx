"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AvailabilityGrid, type Slot } from "./AvailabilityGrid";
import { NotificationFeed } from "./NotificationFeed";
import { WatchForm, WatchList, type Watch } from "./WatchList";
import { buildBookingLink, PLANYO } from "@/lib/constants";

const POLL_INTERVAL_MS = 30_000;

type HealthStatus = "ok" | "degraded" | "down" | "unknown";

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
  const knownNotifIds = useRef(new Set<number>());

  const watchedSlots = new Set(
    watches
      .filter((w) => w.status === "active" || w.status === "pending")
      .map((w) => `${w.date}:${w.hour}`)
  );

  const fetchAvailability = useCallback(async () => {
    const res = await fetch("/api/availability?days=3");
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

  const healthDot =
    health.status === "ok"
      ? "bg-green-500"
      : health.status === "degraded"
        ? "bg-terp-gold"
        : health.status === "down"
          ? "bg-red-500"
          : "bg-neutral-400";

  const healthLabel =
    health.status === "ok"
      ? "Live"
      : health.status === "degraded"
        ? "Delayed"
        : health.status === "down"
          ? "Down"
          : "…";

  const watchCount = watches.filter((w) => w.status === "active" || w.status === "pending").length;

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 border-b border-neutral-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="min-w-0">
            <h1 className="truncate text-xl font-bold sm:text-2xl">
              <span className="text-terp-red">UMD</span> Tennis Alerts
            </h1>
            <p className="text-xs text-neutral-500">Eppley Recreation Center · 8 courts · 48h advance booking</p>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <div className="hidden items-center gap-2 text-xs text-neutral-500 sm:flex" title="Poller health">
              <span className={`h-2 w-2 rounded-full ${healthDot}`} />
              <span>{polling ? "Checking…" : healthLabel}</span>
              {lastPoll && !polling ? (
                <span className="text-neutral-400">
                  {lastPoll.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                </span>
              ) : null}
            </div>
            <a href={PLANYO.BOOKING_URL} target="_blank" rel="noopener noreferrer" className="btn-primary">
              Book on Planyo
            </a>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
        <p className="mb-5 max-w-2xl text-sm text-neutral-600">
          Click <strong className="font-medium text-neutral-800">Watch</strong> on a slot, confirm your email, and get
          alerted when booking opens or a court frees up.
        </p>

        {(error || banner) && (
          <div className="mb-5 space-y-2">
            {error && (
              <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
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

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.7fr)_minmax(260px,0.9fr)]">
          <section className="min-w-0">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold">Court availability</h2>
              <button type="button" onClick={refresh} className="btn-ghost !px-2 !py-1 text-xs">
                Refresh
              </button>
            </div>
            {loading ? (
              <div className="panel px-6 py-12 text-center text-sm text-neutral-500">Loading courts…</div>
            ) : (
              <AvailabilityGrid
                slots={slots}
                watchedSlots={watchedSlots}
                onWatch={(date, hour) => setWatchTarget({ date, hour })}
              />
            )}
          </section>

          <aside className="space-y-6">
            <section>
              <div className="mb-2 flex items-baseline justify-between">
                <h2 className="text-lg font-semibold">Your watches</h2>
                <span className="text-xs text-neutral-500">{watchCount}</span>
              </div>
              <WatchList watches={watches} onCancel={handleCancelWatch} />
            </section>
            <section>
              <h2 className="mb-2 text-lg font-semibold">Recent alerts</h2>
              <NotificationFeed notifications={notifications} />
            </section>
          </aside>
        </div>

        <section className="panel mt-8 px-4 py-4 text-sm text-neutral-600">
          <h3 className="font-semibold text-neutral-800">How it works</h3>
          <p className="mt-1">
            UMD opens Eppley tennis courts for booking exactly 48 hours before play time. Watch a slot to get an email
            when it opens or when someone cancels.
          </p>
        </section>
      </main>

      <footer className="border-t border-neutral-200 bg-white px-4 py-4 text-center text-xs text-neutral-500">
        Unofficial community tool · Not affiliated with UMD, RecWell, or Planyo ·{" "}
        <a href="/api/health" className="underline hover:text-neutral-800">
          Status
        </a>
      </footer>

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
