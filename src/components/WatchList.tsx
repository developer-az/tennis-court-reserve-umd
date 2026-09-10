"use client";

import { useState } from "react";
import { formatDateShort, formatHour } from "@/lib/format";

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
  const visible = watches.filter((w) => w.status === "active" || w.status === "pending");

  if (visible.length === 0) {
    return (
      <div className="surface rounded-xl px-5 py-8 text-center">
        <p className="text-sm text-mute">No watches yet. Pick a slot and tap Watch.</p>
      </div>
    );
  }

  return (
    <ul className="surface divide-y divide-line rounded-xl overflow-hidden">
      {visible.map((w) => (
        <li key={w.id} className="flex items-start justify-between gap-3 px-4 py-3.5">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-ink">
              {w.label || `${formatDateShort(w.date)} · ${formatHour(w.hour)}`}
            </p>
            <p className="mt-1 text-xs text-mute">
              {w.status === "pending"
                ? "Waiting for email confirmation"
                : [
                    w.notifyOnOpen ? "On open" : null,
                    w.notifyOnAvailable ? "On free court" : null,
                  ]
                    .filter(Boolean)
                    .join(" · ") || "Active"}
            </p>
          </div>
          <button type="button" onClick={() => onCancel(w.id)} className="btn-ghost shrink-0 !px-2 !py-1 text-xs">
            Remove
          </button>
        </li>
      ))}
    </ul>
  );
}

interface WatchFormProps {
  date: string;
  hour: number;
  onClose: () => void;
  onCreated: (info?: { needsVerification?: boolean }) => void;
}

export function WatchForm({ date, hour, onClose, onCreated }: WatchFormProps) {
  const [email, setEmail] = useState(() => {
    if (typeof window === "undefined") return "";
    return localStorage.getItem("watchEmail") ?? "";
  });
  const [notifyOnOpen, setNotifyOnOpen] = useState(true);
  const [notifyOnAvailable, setNotifyOnAvailable] = useState(true);
  const [browserNotify, setBrowserNotify] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [label, setLabel] = useState("");
  const [discordWebhook, setDiscordWebhook] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    if (!email.trim() && !discordWebhook.trim()) {
      setError("Add an email so we can alert you");
      setLoading(false);
      return;
    }

    if (browserNotify && "Notification" in window) {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        setError("Browser notifications were denied");
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
          notifyOnOpen,
          notifyOnAvailable,
        }),
      });
      const data = await res.json();
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
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/65 p-0 backdrop-blur-[2px] sm:items-center sm:p-4 animate-fade"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="surface w-full max-w-md rounded-t-2xl p-5 shadow-lift sm:rounded-2xl sm:p-6 animate-rise"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="watch-title"
      >
        <div className="mb-5">
          <p className="text-xs uppercase tracking-[0.14em] text-mute">New watch</p>
          <h2 id="watch-title" className="font-display mt-1 text-2xl text-ink">
            {formatDateShort(date)} · {formatHour(hour)}
          </h2>
          <p className="mt-2 text-sm text-mute">We&apos;ll email you when this hour opens or frees up.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label" htmlFor="watch-email">
              Email
            </label>
            <input
              id="watch-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@terpmail.umd.edu"
              required={!discordWebhook}
              className="field"
              autoComplete="email"
            />
          </div>

          <fieldset className="space-y-2.5">
            <legend className="label">Notify me</legend>
            <label className="flex cursor-pointer items-center gap-3 text-sm text-ink">
              <input
                type="checkbox"
                checked={notifyOnOpen}
                onChange={(e) => setNotifyOnOpen(e.target.checked)}
                className="h-4 w-4 accent-terp-red"
              />
              When the 48-hour booking window opens
            </label>
            <label className="flex cursor-pointer items-center gap-3 text-sm text-ink">
              <input
                type="checkbox"
                checked={notifyOnAvailable}
                onChange={(e) => setNotifyOnAvailable(e.target.checked)}
                className="h-4 w-4 accent-terp-red"
              />
              When a court frees up (cancellation)
            </label>
            <label className="flex cursor-pointer items-center gap-3 text-sm text-ink">
              <input
                type="checkbox"
                checked={browserNotify}
                onChange={(e) => setBrowserNotify(e.target.checked)}
                className="h-4 w-4 accent-terp-red"
              />
              Browser alerts while this tab is open
            </label>
          </fieldset>

          <button
            type="button"
            className="text-xs text-mute underline-offset-2 hover:text-ink hover:underline"
            onClick={() => setShowAdvanced((v) => !v)}
          >
            {showAdvanced ? "Hide optional settings" : "Optional settings"}
          </button>

          {showAdvanced && (
            <div className="space-y-3 rounded-lg border border-line bg-court-soft/50 p-3">
              <div>
                <label className="label" htmlFor="watch-label">
                  Label
                </label>
                <input
                  id="watch-label"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="Saturday doubles"
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
                  onChange={(e) => setDiscordWebhook(e.target.value)}
                  placeholder="https://discord.com/api/webhooks/…"
                  className="field"
                />
              </div>
            </div>
          )}

          {error && <p className="text-sm text-full">{error}</p>}

          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || (!notifyOnOpen && !notifyOnAvailable)}
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
