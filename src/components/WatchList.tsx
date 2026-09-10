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
      <div className="glass rounded-2xl p-6 text-center text-white/50 text-sm">
        No active watches. Click &quot;Watch&quot; on any slot to get email alerts when it opens.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {visible.map((w) => (
        <div
          key={w.id}
          className="glass rounded-xl px-4 py-3 flex items-center justify-between gap-3"
        >
          <div>
            <div className="font-medium text-sm">
              {w.label || `${formatDateShort(w.date)} · ${formatHour(w.hour)}`}
            </div>
            <div className="text-xs text-white/50 mt-0.5 flex flex-wrap gap-2">
              {w.status === "pending" ? (
                <span className="text-terp-gold">Pending email confirmation</span>
              ) : null}
              {w.email ? <span>📧 {w.email}</span> : null}
              {w.notifyOnOpen ? <span>🔔 On open</span> : null}
              {w.notifyOnAvailable ? <span>✅ On available</span> : null}
              {w.discordWebhook ? <span>Discord</span> : null}
            </div>
          </div>
          <button
            onClick={() => onCancel(w.id)}
            className="text-xs text-white/40 hover:text-red-400 transition px-2 py-1"
          >
            Cancel
          </button>
        </div>
      ))}
    </div>
  );
}

interface WatchFormProps {
  date: string;
  hour: number;
  onClose: () => void;
  onCreated: (info?: { needsVerification?: boolean }) => void;
}

export function WatchForm({ date, hour, onClose, onCreated }: WatchFormProps) {
  const [label, setLabel] = useState("");
  const [email, setEmail] = useState(() => {
    if (typeof window === "undefined") return "";
    return localStorage.getItem("watchEmail") ?? "";
  });
  const [discordWebhook, setDiscordWebhook] = useState("");
  const [notifyOnOpen, setNotifyOnOpen] = useState(true);
  const [notifyOnAvailable, setNotifyOnAvailable] = useState(true);
  const [browserNotify, setBrowserNotify] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    if (!email.trim() && !discordWebhook.trim()) {
      setError("Add an email address (or Discord webhook) to receive alerts");
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div
        className="glass rounded-2xl w-full max-w-md p-6 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="font-display text-xl text-terp-gold">Watch this slot</h2>
        <p className="text-sm text-white/70">
          {formatDateShort(date)} at {formatHour(hour)}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs text-white/50 block mb-1">Email for alerts *</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@terpmail.umd.edu"
              required={!discordWebhook}
              className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm focus:outline-none focus:border-terp-gold/50"
            />
          </div>

          <div>
            <label className="text-xs text-white/50 block mb-1">Label (optional)</label>
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. Saturday morning doubles"
              className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm focus:outline-none focus:border-terp-gold/50"
            />
          </div>

          <div>
            <label className="text-xs text-white/50 block mb-1">Discord webhook (optional)</label>
            <input
              value={discordWebhook}
              onChange={(e) => setDiscordWebhook(e.target.value)}
              placeholder="https://discord.com/api/webhooks/..."
              className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm focus:outline-none focus:border-terp-gold/50"
            />
          </div>

          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={notifyOnOpen}
                onChange={(e) => setNotifyOnOpen(e.target.checked)}
                className="accent-terp-red"
              />
              Notify when booking window opens (48h before)
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={notifyOnAvailable}
                onChange={(e) => setNotifyOnAvailable(e.target.checked)}
                className="accent-terp-red"
              />
              Notify when a court becomes available (cancellation)
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={browserNotify}
                onChange={(e) => setBrowserNotify(e.target.checked)}
                className="accent-terp-red"
              />
              Also enable browser notifications (while tab is open)
            </label>
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border border-white/10 py-2 text-sm hover:bg-white/5"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || (!notifyOnOpen && !notifyOnAvailable)}
              className="flex-1 rounded-lg bg-terp-red py-2 text-sm font-medium hover:bg-terp-red/80 disabled:opacity-50"
            >
              {loading ? "Saving..." : "Start watching"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
