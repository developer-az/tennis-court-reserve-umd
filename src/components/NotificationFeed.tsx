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

function typeLabel(type: string) {
  if (type === "slot_opened") return "Opened";
  if (type === "court_available") return "Available";
  return "Update";
}

export function NotificationFeed({ notifications }: Props) {
  if (notifications.length === 0) {
    return (
      <div className="panel px-4 py-6 text-center text-sm text-neutral-500">
        No notifications yet. Alerts appear here when watched slots open.
      </div>
    );
  }

  return (
    <ul className="panel max-h-72 divide-y divide-neutral-200 overflow-y-auto">
      {notifications.map((n) => (
        <li key={n.id} className="px-3 py-3">
          <div className="flex items-center gap-2 text-xs text-neutral-500">
            <span className="font-medium text-neutral-700">{typeLabel(n.type)}</span>
            <span>·</span>
            <span>
              {formatDateShort(n.date)} {formatHour(n.hour)}
            </span>
          </div>
          <p className="mt-1 text-sm text-neutral-800">{n.message}</p>
          <p className="mt-1 text-xs text-neutral-400">
            {new Date(n.createdAt.endsWith("Z") ? n.createdAt : `${n.createdAt}Z`).toLocaleString()}
          </p>
        </li>
      ))}
    </ul>
  );
}
