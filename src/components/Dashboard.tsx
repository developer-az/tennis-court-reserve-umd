"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AvailabilityGrid, type Slot } from "./AvailabilityGrid";
import { NotificationFeed } from "./NotificationFeed";
import { WatchForm, WatchList, type Watch } from "./WatchList";
import { PLANYO, buildBookingLink } from "@/lib/constants";
import { formatDate, formatDateShort, formatHour, formatOpensAt, timeUntil } from "@/lib/format";

const POLL_INTERVAL_MS = 30_000;

type HealthStatus = "ok" | "degraded" | "down" | "unknown";
type SlotFilter = "all" | "open" | "full" | "soon";
type BannerTone = "ok" | "warn" | "error";

interface AlertItem {
  id: number;
  type: string;
  message: string;
  courtsAvailable: number | null;
  createdAt: string;
  date: string;
  hour: number;
}

function storedEmail(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("watchEmail");
}

async function readJson(res: Response): Promise<Record<string, unknown>> {
  try {
    return (await res.json()) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export default function Dashboard() {
  const [slots, setSlots] = useState<Slot[]>([]);
  const [watches, setWatches] = useState<Watch[]>([]);
  const [notifications, setNotifications] = useState<AlertItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [banner, setBanner] = useState("");
  const [bannerTone, setBannerTone] = useState<BannerTone>("ok");
  const [watchTarget, setWatchTarget] = useState<{ date: string; hour: number } | null>(null);
  const [lastPoll, setLastPoll] = useState<Date | null>(null);
  const [health, setHealth] = useState<{ status: HealthStatus; lastPollAt: string | null; detail: string }>({
    status: "unknown",
    lastPollAt: null,
    detail: "",
  });
  const [days, setDays] = useState(3);
  const [filter, setFilter] = useState<SlotFilter>("all");
  const knownNotifIds = useRef(new Set<number>());
  const seededFor = useRef<string | null>(null);

  const watchedSlots = useMemo(
    () =>
      new Set(
        watches
          .filter((watch) => watch.status === "active" || watch.status === "pending")
          .map((watch) => `${watch.date}:${watch.hour}`)
      ),
    [watches]
  );

  const fetchAvailability = useCallback(async () => {
    const res = await fetch(`/api/availability?days=${days}`);
    const data = await readJson(res);
    if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "Failed to load courts");
    setSlots(Array.isArray(data.slots) ? (data.slots as Slot[]) : []);
  }, [days]);

  const fetchHealth = useCallback(async () => {
    try {
      const res = await fetch("/api/health");
      const data = await readJson(res);
      const status = (data.status as HealthStatus) ?? "unknown";
      const detail =
        typeof data.error === "string"
          ? data.error
          : typeof data.lastPollError === "string"
            ? data.lastPollError
            : "";
      setHealth({
        status,
        lastPollAt: typeof data.lastPollAt === "string" ? data.lastPollAt : null,
        detail,
      });
      if (typeof data.lastPollAt === "string") setLastPoll(new Date(data.lastPollAt));
    } catch {
      setHealth({ status: "unknown", lastPollAt: null, detail: "" });
    }
  }, []);

  const fetchWatches = useCallback(async () => {
    const email = storedEmail();
    if (!email) {
      setWatches([]);
      return;
    }
    const res = await fetch(`/api/watches?email=${encodeURIComponent(email)}`);
    const data = await readJson(res);
    setWatches(res.ok && Array.isArray(data.watches) ? (data.watches as Watch[]) : []);
  }, []);

  const showBrowserAlerts = useCallback((notifs: AlertItem[], email: string) => {
    if (seededFor.current !== email) {
      seededFor.current = email;
      knownNotifIds.current = new Set(notifs.map((item) => item.id));
      return;
    }
    if (localStorage.getItem("browserNotify") !== "true" || !("Notification" in window)) return;
    if (Notification.permission !== "granted") return;
    for (const item of notifs) {
      if (knownNotifIds.current.has(item.id)) continue;
      knownNotifIds.current.add(item.id);
      const bookingUrl = buildBookingLink(item.date, item.hour);
      const popup = new Notification(item.type === "slot_opened" ? "Court slot opened" : "Court available", {
        body: item.message,
        icon: "/brand-mark.svg",
        tag: `watch-${item.id}`,
      });
      popup.onclick = () => window.open(bookingUrl, "_blank", "noopener");
    }
  }, []);

  const refreshNotifications = useCallback(async () => {
    const email = storedEmail();
    if (!email) {
      setNotifications([]);
      seededFor.current = null;
      return;
    }
    const res = await fetch(`/api/notifications?email=${encodeURIComponent(email)}`);
    const data = await readJson(res);
    if (!res.ok) return;
    const notifs = Array.isArray(data.notifications) ? (data.notifications as AlertItem[]) : [];
    setNotifications(notifs);
    showBrowserAlerts(notifs, email);
  }, [showBrowserAlerts]);

  const runPoll = useCallback(async () => {
    try {
      const res = await fetch("/api/poll", { method: "POST" });
      if (!res.ok) return;
      await Promise.all([refreshNotifications(), fetchHealth(), fetchAvailability()]);
    } catch {
      // Local polling is best-effort. The grid still refreshes on its own timer.
    }
  }, [fetchAvailability, fetchHealth, refreshNotifications]);

  const refresh = useCallback(async () => {
    setError("");
    setRefreshing(true);
    try {
      await Promise.all([fetchAvailability(), fetchWatches(), fetchHealth()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setRefreshing(false);
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
      setBannerTone("ok");
      setBanner(`Email confirmed. ${activated} watch${activated === "1" ? "" : "es"} activated.`);
      fetchWatches();
      refreshNotifications();
    } else if (verified === "invalid") {
      setBannerTone("error");
      setBanner("That confirmation link is invalid or expired.");
    } else if (verified === "rate_limited") {
      setBannerTone("warn");
      setBanner("Too many confirmation attempts. Wait a minute and try again.");
    } else if (verified !== "missing") {
      setBannerTone("error");
      setBanner("Could not confirm email. Create a watch again to resend.");
    }

    window.history.replaceState({}, "", "/");
  }, [fetchWatches, refreshNotifications]);

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
    const interval = setInterval(() => {
      fetchAvailability().catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Failed to load courts");
      });
    }, 60_000);
    return () => clearInterval(interval);
  }, [fetchAvailability]);

  async function handleCancelWatch(id: number) {
    const email = storedEmail();
    if (!email) return;
    const res = await fetch(`/api/watches?id=${id}&email=${encodeURIComponent(email)}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await readJson(res);
      setError(typeof data.error === "string" ? data.error : "Could not cancel that watch");
      return;
    }
    await fetchWatches();
  }

  const filteredSlots = useMemo(() => {
    return slots.filter((slot) => {
      if (filter === "open") return slot.isBookable;
      if (filter === "full") return slot.isOpen && slot.courtsAvailable === 0;
      if (filter === "soon") return !slot.isOpen;
      return true;
    });
  }, [slots, filter]);

  const nextOpening = useMemo(() => {
    return slots
      .filter((slot) => !slot.isOpen)
      .sort((a, b) => a.opensAt.localeCompare(b.opensAt))[0];
  }, [slots]);

  const counts = useMemo(
    () => ({
      open: slots.filter((slot) => slot.isBookable).length,
      full: slots.filter((slot) => slot.isOpen && slot.courtsAvailable === 0).length,
      soon: slots.filter((slot) => !slot.isOpen).length,
    }),
    [slots]
  );

  const healthDot =
    health.status === "ok"
      ? "bg-[#1f7a4d]"
      : health.status === "degraded"
        ? "bg-[#c8962e]"
        : health.status === "down"
          ? "bg-[#9f1d2a]"
          : "bg-ink/30";

  const healthLabel =
    health.status === "ok"
      ? "Checks live"
      : health.status === "degraded"
        ? "Checks delayed"
        : health.status === "down"
          ? "Checks down"
          : "No checks yet";

  const watchCount = watches.filter((watch) => watch.status === "active" || watch.status === "pending").length;
  const targetSlot = watchTarget
    ? slots.find((slot) => slot.date === watchTarget.date && slot.hour === watchTarget.hour)
    : undefined;

  const bannerClass =
    bannerTone === "ok"
      ? "border-[#b7dfc8] bg-open text-[#0f6b3c]"
      : bannerTone === "error"
        ? "border-[#f3c1c1] bg-full text-[#9f1d2a]"
        : "border-[#f0ddb0] bg-soon text-[#8a5a12]";

  return (
    <div className="flex min-h-screen flex-col">
      <a
        href="#courts"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-card focus:px-3 focus:py-2"
      >
        Skip to courts
      </a>
      <header className="sticky top-0 z-40 border-b border-line bg-card/95 backdrop-blur-sm">
        <div className="h-1 bg-terp-red" />
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-2.5 px-3 sm:gap-3 sm:px-6">
          <img src="/brand-mark.svg" alt="" width={36} height={36} className="h-9 w-9 shrink-0" />
          <div className="min-w-0 flex-1">
            <h1 className="truncate font-display text-lg leading-none font-semibold tracking-tight sm:text-2xl">
              Court alerts
            </h1>
            <p className="mt-1 truncate text-[11px] font-semibold tracking-wide text-terp-red">Eppley tennis</p>
          </div>
          <span
            className="flex h-9 shrink-0 items-center gap-2 rounded-full border border-line px-2.5 text-xs text-ink/70"
            title={health.detail ? `${healthLabel}. ${health.detail}` : healthLabel}
            role="status"
          >
            <span className={`h-2 w-2 rounded-full ${healthDot}`} aria-hidden="true" />
            <span className="hidden sm:inline">{healthLabel}</span>
          </span>
          <a
            href={PLANYO.BOOKING_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-primary h-9 shrink-0 px-3! py-0!"
          >
            Book
          </a>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-3 py-4 sm:px-6 sm:py-8">
        <p className="max-w-2xl text-sm leading-relaxed text-ink/75">
          Eight Eppley courts. Each hour opens 48 hours ahead. Watch a slot and get an email when booking opens, or when
          a court frees up.
        </p>

        {nextOpening ? (
          <div className="mt-3 flex flex-col gap-3 rounded-2xl border border-[#f0ddb0] border-l-4 border-l-[#c8962e] bg-soon px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-[#6d4710]">
              <span className="font-semibold">Next window. </span>
              {formatDate(nextOpening.date)} at {formatHour(nextOpening.hour)} opens {formatOpensAt(nextOpening.opensAt)}{" "}
              ({timeUntil(nextOpening.opensAt)}).
            </p>
            <button
              type="button"
              className="btn-secondary h-11 w-full bg-white! text-sm sm:h-auto sm:w-auto sm:py-1.5! sm:text-xs"
              onClick={() => setWatchTarget({ date: nextOpening.date, hour: nextOpening.hour })}
              disabled={watchedSlots.has(`${nextOpening.date}:${nextOpening.hour}`)}
            >
              {watchedSlots.has(`${nextOpening.date}:${nextOpening.hour}`) ? "Watching" : "Watch it"}
            </button>
          </div>
        ) : null}

        {(error || banner) && (
          <div className="mt-4 space-y-2" aria-live="polite">
            {error ? (
              <div className="rounded-lg border border-[#f3c1c1] bg-full px-4 py-3 text-sm text-[#9f1d2a]">{error}</div>
            ) : null}
            {banner ? (
              <div className={`flex items-start justify-between gap-3 rounded-lg border px-4 py-3 text-sm ${bannerClass}`}>
                <span>{banner}</span>
                <button type="button" onClick={() => setBanner("")} className="text-xs font-semibold underline">
                  Dismiss
                </button>
              </div>
            ) : null}
          </div>
        )}

        <div className="mt-4 grid gap-6 lg:mt-6 lg:grid-cols-[minmax(0,1.7fr)_minmax(260px,0.9fr)]">
          <section id="courts" className="min-w-0">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-display text-lg font-semibold">Court availability</h2>
              <button type="button" onClick={refresh} className="btn-ghost px-2! py-1! text-xs" disabled={refreshing}>
                {refreshing ? "Refreshing…" : "Refresh"}
              </button>
            </div>

            <div className="sticky top-[60px] z-30 -mx-3 mb-3 border-b border-line bg-paper/95 px-3 py-2 backdrop-blur-sm sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:px-0 sm:py-0 sm:backdrop-blur-none">
              <div className="flex items-center gap-2 overflow-x-auto">
                <div className="flex shrink-0 rounded-lg border border-line bg-card p-0.5" role="group" aria-label="Days to show">
                  {[3, 7].map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setDays(option)}
                      aria-pressed={days === option}
                      className={`h-9 rounded-md px-3 text-xs font-semibold sm:h-auto sm:px-2.5 sm:py-1 ${
                        days === option ? "bg-ink text-card" : "text-ink/70 hover:text-ink"
                      }`}
                    >
                      {option} days
                    </button>
                  ))}
                </div>
                <div className="flex shrink-0 gap-1" role="group" aria-label="Filter slots">
                  {(
                    [
                      ["all", "All"],
                      ["open", `Open ${counts.open}`],
                      ["full", `Full ${counts.full}`],
                      ["soon", `Opening ${counts.soon}`],
                    ] as const
                  ).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setFilter(value)}
                      aria-pressed={filter === value}
                      className={`h-9 rounded-full px-3 text-xs font-semibold sm:h-auto sm:px-2.5 sm:py-1 ${
                        filter === value ? "bg-ink text-card" : "bg-card text-ink/70 ring-1 ring-line hover:text-ink"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              {days > 3 && filteredSlots.length > 0 ? (
                <nav className="mt-2 flex gap-2 overflow-x-auto" aria-label="Jump to a day">
                  {Array.from(new Set(filteredSlots.map((slot) => slot.date)))
                    .sort()
                    .map((date) => (
                      <a
                        key={date}
                        href={`#day-${date}`}
                        className="shrink-0 rounded-full bg-card px-2.5 py-1 text-xs font-semibold text-ink/80 ring-1 ring-line hover:text-ink"
                      >
                        {formatDateShort(date)}
                      </a>
                    ))}
                </nav>
              ) : null}
            </div>

            <ul className="mb-3 hidden flex-wrap gap-3 text-xs text-ink/70 sm:flex">
              <li className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-xs bg-[#1f7a4d]" /> Open now
              </li>
              <li className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-xs bg-[#9f1d2a]" /> Full
              </li>
              <li className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-xs bg-[#c8962e]" /> Opens later
              </li>
            </ul>

            {loading ? (
              <div className="panel overflow-hidden" aria-hidden>
                <div className="h-12 border-b border-line bg-[#f7f1e6]" />
                <div className="sm:grid sm:grid-cols-3 sm:gap-2 sm:p-3 lg:grid-cols-4">
                  {Array.from({ length: 6 }).map((_, index) => (
                    <div key={index} className="h-14 animate-pulse border-b border-line bg-[#efe7da] sm:h-28 sm:rounded-lg sm:border" />
                  ))}
                </div>
              </div>
            ) : (
              <AvailabilityGrid
                slots={filteredSlots}
                watchedSlots={watchedSlots}
                onWatch={(date, hour) => setWatchTarget({ date, hour })}
                emptyLabel={
                  slots.length === 0
                    ? "No upcoming slots found. Courts book up to 48 hours ahead."
                    : "Nothing matches this filter."
                }
              />
            )}
          </section>

          <aside className="space-y-6">
            <section>
              <div className="mb-2 flex items-baseline justify-between">
                <h2 className="font-display text-lg font-semibold">Your watches</h2>
                <span className="text-xs tabular-nums text-ink/50">{watchCount}</span>
              </div>
              <WatchList watches={watches} onCancel={handleCancelWatch} />
            </section>
            <section>
              <h2 className="mb-2 font-display text-lg font-semibold">Recent alerts</h2>
              <NotificationFeed notifications={notifications} />
            </section>
          </aside>
        </div>

        <section className="panel mt-8 px-4 py-4 text-sm text-ink/75">
          <h3 className="font-semibold text-ink">How a watch works</h3>
          <p className="mt-1 leading-relaxed">
            A Friday 4:00 PM court opens for booking on Wednesday at 4:00 PM Eastern. Set the watch before then. After
            the window is open, the same watch emails you if a booked court cancels.
          </p>
        </section>
      </main>

      <footer className="border-t border-line px-4 py-4 text-center text-xs text-ink/50">
        Unofficial community tool · Not affiliated with UMD, RecWell, or Planyo
      </footer>

      {watchTarget ? (
        <WatchForm
          key={`${watchTarget.date}-${watchTarget.hour}`}
          date={watchTarget.date}
          hour={watchTarget.hour}
          isOpen={targetSlot?.isOpen ?? false}
          opensAt={targetSlot?.opensAt}
          onClose={() => setWatchTarget(null)}
          onCreated={(info) => {
            fetchWatches();
            if (info?.needsVerification) {
              setBannerTone("warn");
              setBanner("Check your inbox to confirm your email. Watches stay pending until then.");
            }
          }}
        />
      ) : null}
    </div>
  );
}
