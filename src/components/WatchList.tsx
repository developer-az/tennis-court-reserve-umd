"use client";

import { useEffect, useRef, useState } from "react";
import { formatDateShort, formatHour, formatOpensAt } from "@/lib/format";

export interface Watch {
  id: number;
  date: string;
  hour: number;
  label: string | null;
  email: string | null;
  discordWebhook: string | null;
  notifyOnOpen: number;
  notifyOnAvailable: number;
  status: string;
  createdAt: string;
}

interface Props {
  watches: Watch[];
  onCancel: (id: number) => void;
}

export function WatchList({ watches, onCancel }: Props) {
  const visible = watches
    .filter((watch) => watch.status === "active" || watch.status === "pending")
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date) || a.hour - b.hour);

  if (visible.length === 0) {
    return (
      <div className="panel px-4 py-6 text-center text-sm text-ink/60">
        No watches yet. Pick a slot and you’ll get an email when it opens or a court frees up.
      </div>
    );
  }

  return (
    <ul className="panel divide-y divide-line overflow-hidden">
      {visible.map((watch) => {
        const modes = [
          watch.notifyOnOpen ? "On open" : null,
          watch.notifyOnAvailable ? "On available" : null,
        ].filter(Boolean);
        return (
          <li key={watch.id} className="flex items-start justify-between gap-3 px-3 py-3">
            <div className="min-w-0">
              <p className="truncate font-display text-sm font-semibold">
                {formatDateShort(watch.date)} · {formatHour(watch.hour)}
              </p>
              {watch.label ? <p className="truncate text-xs text-ink/70">{watch.label}</p> : null}
              <p className="mt-1 text-xs text-ink/60">
                {watch.status === "pending" ? (
                  <span className="font-semibold text-[#8a5a12]">Pending email confirmation</span>
                ) : (
                  modes.join(" · ") || "Watching"
                )}
              </p>
            </div>
            <button
              type="button"
              onClick={() => onCancel(watch.id)}
              className="btn-ghost !px-2 !py-1 text-xs"
              aria-label={`Cancel watch for ${formatDateShort(watch.date)} ${formatHour(watch.hour)}`}
            >
              Cancel
            </button>
          </li>
        );
      })}
    </ul>
  );
}

interface WatchFormProps {
  date: string;
  hour: number;
  isOpen: boolean;
  opensAt?: string;
  onClose: () => void;
  onCreated: (info?: { needsVerification?: boolean }) => void;
}

export function WatchForm({ date, hour, isOpen, opensAt, onClose, onCreated }: WatchFormProps) {
  const [email, setEmail] = useState(() => {
    if (typeof window === "undefined") return "";
    return localStorage.getItem("watchEmail") ?? "";
  });
  const [notifyOnOpen, setNotifyOnOpen] = useState(!isOpen);
  const [notifyOnAvailable, setNotifyOnAvailable] = useState(true);
  const [browserNotify, setBrowserNotify] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [label, setLabel] = useState("");
  const [discordWebhook, setDiscordWebhook] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const emailRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    emailRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");

    if (!email.trim() && !discordWebhook.trim()) {
      setError("Add an email address to receive alerts");
      setLoading(false);
      return;
    }

    if (browserNotify && "Notification" in window) {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setError("Browser notifications were blocked. You can still use email.");
        setLoading(false);
        return;
      }
    }

    try {
      const res = await fetch("/api/watches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date,
          hour,
          label: label || undefined,
          email: email.trim() || undefined,
          discordWebhook: discordWebhook || undefined,
          notifyOnOpen: isOpen ? false : notifyOnOpen,
          notifyOnAvailable,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Failed to create watch");

      if (email.trim()) localStorage.setItem("watchEmail", email.trim().toLowerCase());
      if (browserNotify) localStorage.setItem("browserNotify", "true");

      onCreated({ needsVerification: Boolean(data.needsVerification) });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-4 sm:items-center"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="panel w-full max-w-md p-5 shadow-xl"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="watch-title"
      >
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-terp-red">New watch</p>
        <h2 id="watch-title" className="mt-1 font-display text-2xl font-semibold tracking-tight">
          {formatDateShort(date)} · {formatHour(hour)}
        </h2>
        <p className="mt-1 text-sm text-ink/70">
          {isOpen
            ? "Booking is already open. You’ll be emailed if a court frees up."
            : opensAt
              ? `Booking opens ${formatOpensAt(opensAt)}.`
              : "You’ll be emailed when the 48-hour booking window opens."}
        </p>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label className="label" htmlFor="watch-email">
              Email for alerts
            </label>
            <input
              ref={emailRef}
              id="watch-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@terpmail.umd.edu"
              required={!discordWebhook}
              className="field"
              autoComplete="email"
            />
          </div>

          <fieldset className="space-y-2">
            <legend className="sr-only">Alert types</legend>
            <label className={`flex items-start gap-2 text-sm ${isOpen ? "text-ink/50" : "cursor-pointer"}`}>
              <input
                type="checkbox"
                checked={isOpen ? false : notifyOnOpen}
                disabled={isOpen}
                onChange={(event) => setNotifyOnOpen(event.target.checked)}
                className="mt-0.5 accent-ink"
              />
              <span>Email me when the booking window opens</span>
            </label>
            <label className="flex cursor-pointer items-start gap-2 text-sm">
              <input
                type="checkbox"
                checked={notifyOnAvailable}
                onChange={(event) => setNotifyOnAvailable(event.target.checked)}
                className="mt-0.5 accent-ink"
              />
              <span>Email me when a court frees up</span>
            </label>
            <label className="flex cursor-pointer items-start gap-2 text-sm">
              <input
                type="checkbox"
                checked={browserNotify}
                onChange={(event) => setBrowserNotify(event.target.checked)}
                className="mt-0.5 accent-ink"
              />
              <span>Also notify this browser while the tab is open</span>
            </label>
          </fieldset>

          <button
            type="button"
            className="text-xs font-semibold text-ink/60 underline decoration-line underline-offset-2 hover:text-ink"
            onClick={() => setShowAdvanced((value) => !value)}
            aria-expanded={showAdvanced}
          >
            {showAdvanced ? "Hide optional settings" : "Label or Discord webhook"}
          </button>

          {showAdvanced ? (
            <div className="space-y-3 rounded-lg border border-line bg-paper p-3">
              <div>
                <label className="label" htmlFor="watch-label">
                  Label
                </label>
                <input
                  id="watch-label"
                  value={label}
                  onChange={(event) => setLabel(event.target.value)}
                  placeholder="Saturday morning doubles"
                  className="field"
                />
              </div>
              <div>
                <label className="label" htmlFor="watch-discord">
                  Discord webhook
                </label>
                <input
                  id="watch-discord"
                  value={discordWebhook}
                  onChange={(event) => setDiscordWebhook(event.target.value)}
                  placeholder="https://discord.com/api/webhooks/..."
                  className="field"
                />
              </div>
            </div>
          ) : null}

          {error ? (
            <p className="text-sm text-[#9f1d2a]" role="alert">
              {error}
            </p>
          ) : null}

          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || (!isOpen && !notifyOnOpen && !notifyOnAvailable) || (isOpen && !notifyOnAvailable)}
              className="btn-primary flex-1"
            >
              {loading ? "Saving…" : "Start watching"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
