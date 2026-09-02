"use client";

import { formatDateShort, formatHour } from "@/lib/format";

interface Notification {
  id: number;
  type: string;
  message: string;
  courtsAvailable: number | null;
  createdAt: string;
  date: string;
  hour: number;
}

interface Props {
  notifications: Notification[];
}

export function NotificationFeed({ notifications }: Props) {
  if (notifications.length === 0) {
    return (
      <div className="glass rounded-2xl p-6 text-center text-white/50 text-sm">
        No notifications yet. Alerts will appear here when watched slots open.
      </div>
    );
  }

  return (
    <div className="space-y-2 max-h-64 overflow-y-auto">
      {notifications.map((n) => (
        <div key={n.id} className="glass rounded-xl px-4 py-3 text-sm">
          <div className="flex items-start gap-2">
            <span className="text-lg leading-none">
              {n.type === "slot_opened" ? "🔔" : n.type === "court_available" ? "✅" : "ℹ️"}
            </span>
            <div className="flex-1 min-w-0">
              <div className="font-medium text-white/90">{n.message}</div>
              <div className="text-xs text-white/40 mt-1">
                {formatDateShort(n.date)} · {formatHour(n.hour)} ·{" "}
                {new Date(n.createdAt + "Z").toLocaleTimeString()}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
