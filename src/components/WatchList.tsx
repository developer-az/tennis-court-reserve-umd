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
      <div className="panel px-4 py-6 text-center text-sm text-neutral-500">
        No active watches. Click Watch on any slot to get email alerts.
      </div>
    );
  }

  return (
    <ul className="panel divide-y divide-neutral-200 overflow-hidden">
      {visible.map((w) => (
        <li key={w.id} className="flex items-start justify-between gap-3 px-3 py-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">
              {w.label || `${formatDateShort(w.date)} · ${formatHour(w.hour)}`}
            </p>
            <p className="mt-0.5 text-xs text-neutral-500">
              {w.status === "pending"
                ? "Pending email confirmation"
                : [
                    w.notifyOnOpen ? "On open" : null,
                    w.notifyOnAvailable ? "On available" : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
            </p>
          </div>
          <button type="button" onClick={() => onCancel(w.id)} className="btn-ghost !px-2 !py-1 text-xs">
            Cancel
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
      setError("Add an email address to receive alerts");
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="panel w-full max-w-md p-5 shadow-lg"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="watch-title"
      >
        <h2 id="watch-title" className="text-lg font-semibold">
          Watch this slot
        </h2>
        <p className="mt-1 text-sm text-neutral-600">
          {formatDateShort(date)} at {formatHour(hour)}
        </p>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label className="label" htmlFor="watch-email">
              Email for alerts
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

          <div className="space-y-2">
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={notifyOnOpen}
                onChange={(e) => setNotifyOnOpen(e.target.checked)}
                className="accent-terp-red"
              />
              Notify when booking window opens (48h before)
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={notifyOnAvailable}
                onChange={(e) => setNotifyOnAvailable(e.target.checked)}
                className="accent-terp-red"
              />
              Notify when a court becomes available
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={browserNotify}
                onChange={(e) => setBrowserNotify(e.target.checked)}
                className="accent-terp-red"
              />
              Also enable browser notifications
            </label>
          </div>

          <button
            type="button"
            className="text-xs text-neutral-500 underline hover:text-neutral-800"
            onClick={() => setShowAdvanced((v) => !v)}
          >
            {showAdvanced ? "Hide optional settings" : "Optional settings"}
          </button>

          {showAdvanced && (
            <div className="space-y-3 rounded-md border border-neutral-200 bg-neutral-50 p-3">
              <div>
                <label className="label" htmlFor="watch-label">
                  Label
                </label>
                <input
                  id="watch-label"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="e.g. Saturday morning doubles"
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
                  placeholder="https://discord.com/api/webhooks/..."
                  className="field"
                />
              </div>
            </div>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || (!notifyOnOpen && !notifyOnAvailable)}
              className="btn-primary flex-1"
            >
              {loading ? "Saving..." : "Start watching"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
