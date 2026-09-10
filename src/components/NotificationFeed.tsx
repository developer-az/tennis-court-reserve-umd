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
  if (type === "court_available") return "Freed up";
  return "Update";
}

export function NotificationFeed({ notifications }: Props) {
  if (notifications.length === 0) {
    return (
      <div className="surface rounded-xl px-5 py-8 text-center">
        <p className="text-sm text-mute">Alerts for your watches show up here.</p>
      </div>
    );
  }

  return (
    <ul className="surface max-h-72 divide-y divide-line overflow-y-auto rounded-xl">
      {notifications.map((n) => (
        <li key={n.id} className="px-4 py-3">
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.08em] text-mute">
            <span className={n.type === "court_available" ? "text-open" : "text-terp-gold"}>
              {typeLabel(n.type)}
            </span>
            <span aria-hidden>·</span>
            <span>
              {formatDateShort(n.date)} {formatHour(n.hour)}
            </span>
          </div>
          <p className="mt-1.5 text-sm leading-snug text-ink/90">{n.message}</p>
          <p className="mt-1 text-[11px] text-mute">
            {new Date(n.createdAt.endsWith("Z") ? n.createdAt : `${n.createdAt}Z`).toLocaleString()}
          </p>
        </li>
      ))}
    </ul>
  );
}
