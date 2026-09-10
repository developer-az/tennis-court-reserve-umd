"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AvailabilityGrid, type Slot } from "./AvailabilityGrid";
import { NotificationFeed } from "./NotificationFeed";
import { WatchForm, WatchList, type Watch } from "./WatchList";
import { buildBookingLink, PLANYO } from "@/lib/constants";

const POLL_INTERVAL_MS = 30_000;

type HealthStatus = "ok" | "degraded" | "down" | "unknown";

export default function Dashboard() {
  const [slots, setSlots] = useState<Slot[]>([]);
  const [watches, setWatches] = useState<Watch[]>([]);
  const [notifications, setNotifications] = useState<Array<{
    id: number;
    type: string;
    message: string;
    courtsAvailable: number | null;
    createdAt: string;
    date: string;
    hour: number;
  }>>([]);
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
    const email = typeof window !== "undefined" ? localStorage.getItem("watchEmail") : null;
    if (!email) {
      setWatches([]);
      return;
    }
    const res = await fetch(`/api/watches?email=${encodeURIComponent(email)}`);
    const data = await res.json();
    if (!res.ok) {
      setWatches([]);
      return;
    }
    setWatches(data.watches ?? []);
  }, []);

  const showBrowserAlerts = useCallback((notifs: typeof notifications) => {
    if (localStorage.getItem("browserNotify") !== "true" || !("Notification" in window)) return;
    if (Notification.permission !== "granted") return;
    for (const n of notifs) {
      if (knownNotifIds.current.has(n.id)) continue;
      knownNotifIds.current.add(n.id);
      const bookingUrl = buildBookingLink(n.date, n.hour);
      const notif = new Notification(
        n.type === "slot_opened" ? "Court slot opened!" : "Court available!",
        {
          body: n.message,
          icon: "/tennis.svg",
          tag: `watch-${n.id}`,
        }
      );
      notif.onclick = () => window.open(bookingUrl, "_blank");
    }
  }, []);

  const refreshNotifications = useCallback(async () => {
    const email = typeof window !== "undefined" ? localStorage.getItem("watchEmail") : null;
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
        const notifs = data.notifications ?? [];
        setNotifications(notifs);
        showBrowserAlerts(notifs);
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
      setBanner(`Email confirmed. Activated ${activated} watch${activated === "1" ? "" : "es"}.`);
      fetchWatches();
    } else if (verified === "invalid") {
      setBanner("That confirmation link is invalid or expired. Create a watch again to get a new email.");
    } else if (verified === "rate_limited") {
      setBanner("Too many confirmation attempts. Wait a minute and try again.");
    } else if (verified !== "missing") {
      setBanner("Could not confirm email. Try creating a watch again.");
    }

    window.history.replaceState({}, "", "/");
  }, [fetchWatches]);

  useEffect(() => {
    const useClientPoll = process.env.NODE_ENV === "development" || process.env.NEXT_PUBLIC_CLIENT_POLL === "true";
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
    const email = localStorage.getItem("watchEmail");
    if (!email) return;
    await fetch(`/api/watches?id=${id}&email=${encodeURIComponent(email)}`, { method: "DELETE" });
    fetchWatches();
  }

  const healthColor =
    health.status === "ok"
      ? "bg-green-400"
      : health.status === "degraded"
        ? "bg-terp-gold"
        : health.status === "down"
          ? "bg-red-400"
          : "bg-white/30";

  const healthLabel =
    health.status === "ok"
      ? "Polling healthy"
      : health.status === "degraded"
        ? "Polling delayed"
        : health.status === "down"
          ? "Polling down"
          : "Polling unknown";

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-white/10 bg-black/40 backdrop-blur sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold">
              <span className="text-terp-red">UMD</span>{" "}
              <span className="text-terp-gold">Tennis Alerts</span>
            </h1>
            <p className="text-xs text-white/50 mt-0.5">Eppley Recreation Center · 8 courts · 48h advance booking</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 text-xs text-white/40" title={healthLabel}>
              <span className={`inline-block h-2 w-2 rounded-full ${healthColor}`} />
              <span>{healthLabel}</span>
            </div>
            {polling && (
              <span className="text-xs text-terp-gold animate-pulse">Checking...</span>
            )}
            {lastPoll && (
              <span className="text-xs text-white/30 hidden md:block">
                Last check {lastPoll.toLocaleTimeString()}
              </span>
            )}
            <a
              href={PLANYO.BOOKING_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg bg-terp-red px-4 py-2 text-sm font-medium hover:bg-terp-red/80 transition"
            >
              Book on Planyo →
            </a>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8 space-y-8 flex-1 w-full">
        {error && (
          <div className="rounded-xl bg-red-500/20 border border-red-500/30 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}
        {banner && (
          <div className="rounded-xl bg-terp-gold/15 border border-terp-gold/30 px-4 py-3 text-sm text-terp-gold flex items-start justify-between gap-3">
            <span>{banner}</span>
            <button onClick={() => setBanner("")} className="text-terp-gold/70 hover:text-terp-gold text-xs">
              Dismiss
            </button>
          </div>
        )}

        <section className="grid md:grid-cols-3 gap-6">
          <div className="glass rounded-2xl p-5">
            <div className="text-3xl font-bold text-terp-gold">{PLANYO.COURT_COUNT}</div>
            <div className="text-sm text-white/60">Tennis courts</div>
          </div>
          <div className="glass rounded-2xl p-5">
            <div className="text-3xl font-bold text-terp-gold">{PLANYO.MAX_AHEAD_DAYS * 24}h</div>
            <div className="text-sm text-white/60">Advance booking window</div>
          </div>
          <div className="glass rounded-2xl p-5">
            <div className="text-3xl font-bold text-terp-gold">
              {watches.filter((w) => w.status === "active" || w.status === "pending").length}
            </div>
            <div className="text-sm text-white/60">Your watches</div>
          </div>
        </section>

        <div className="grid lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-xl text-terp-gold">Court Availability</h2>
              <button
                onClick={refresh}
                className="text-xs text-white/50 hover:text-white transition"
              >
                Refresh
              </button>
            </div>
            {loading ? (
              <div className="glass rounded-2xl p-12 text-center text-white/50">Loading courts...</div>
            ) : (
              <AvailabilityGrid
                slots={slots}
                watchedSlots={watchedSlots}
                onWatch={(date, hour) => setWatchTarget({ date, hour })}
              />
            )}
          </div>

          <div className="space-y-6">
            <div>
              <h2 className="font-display text-xl text-terp-gold mb-3">Your Watches</h2>
              <WatchList watches={watches} onCancel={handleCancelWatch} />
            </div>
            <div>
              <h2 className="font-display text-xl text-terp-gold mb-3">Recent Alerts</h2>
              <NotificationFeed notifications={notifications} />
            </div>
          </div>
        </div>

        <section className="glass rounded-2xl p-6 text-sm text-white/60 space-y-2">
          <h3 className="font-display text-terp-gold text-base">How it works</h3>
          <p>
            UMD uses Planyo for Eppley tennis courts. Slots open exactly <strong className="text-white">48 hours before</strong> play time.
            Click <strong className="text-white">Watch</strong>, enter your email, confirm it, and get alerted when booking opens or when someone cancels.
          </p>
          <p>
            Production checks run via cron. Every alert email includes an unsubscribe link.
          </p>
        </section>
      </main>

      <footer className="border-t border-white/10 py-6 text-center text-xs text-white/40 px-4">
        Unofficial community tool · Not affiliated with UMD, RecWell, or Planyo · Uses public booking endpoints ·{" "}
        <a href="/api/health" className="underline hover:text-white/60">
          System status
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
