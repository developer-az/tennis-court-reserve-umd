"use client";

import { buildBookingLink } from "@/lib/constants";
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
  if (type === "slot_opened") return "Window opened";
  if (type === "court_available") return "Court freed";
  return "Update";
}

function relativeTime(iso: string): string {
  const then = new Date(iso.endsWith("Z") ? iso : `${iso}Z`).getTime();
  if (!Number.isFinite(then)) return "";
  const mins = Math.round((Date.now() - then) / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export function NotificationFeed({ notifications }: Props) {
  if (notifications.length === 0) {
    return (
      <div className="panel px-4 py-6 text-center text-sm text-ink/60">
        No alerts yet. They show up here when a watched slot opens.
      </div>
    );
  }

  return (
    <ul className="panel max-h-80 divide-y divide-line overflow-y-auto">
      {notifications.map((notification) => (
        <li key={notification.id} className="px-3 py-3">
          <div className="flex items-center justify-between gap-2 text-xs text-ink/60">
            <span className="font-semibold text-ink">{typeLabel(notification.type)}</span>
            <span>{relativeTime(notification.createdAt)}</span>
          </div>
          <p className="mt-1 text-sm text-ink/90">
            {formatDateShort(notification.date)} {formatHour(notification.hour)}
          </p>
          <p className="mt-1 text-sm text-ink/70">{notification.message}</p>
          {notification.date ? (
            <a
              href={buildBookingLink(notification.date, notification.hour)}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-block text-xs font-semibold underline decoration-line underline-offset-2 hover:decoration-ink"
            >
              Open in Planyo
            </a>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
