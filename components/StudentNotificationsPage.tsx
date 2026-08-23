"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { NotificationIcon } from "@/components/icons";
import type { StudentNotification } from "@/components/StudentNotifications";

function formatReleaseTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Recently";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: date.getFullYear() !== new Date().getFullYear() ? "numeric" : undefined,
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export function StudentNotificationsPage({ initialItems }: { initialItems: StudentNotification[] }) {
  const router = useRouter();
  const [items, setItems] = useState(initialItems);
  const unread = useMemo(() => items.filter((item) => item.isUnread).length, [items]);

  useEffect(() => { setItems(initialItems); }, [initialItems]);

  async function openNotification(item: StudentNotification) {
    if (item.isUnread) {
      setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, isUnread: false } : entry));
      window.dispatchEvent(new CustomEvent("medscores:result-viewed", { detail: { assessmentId: item.id } }));
      await fetch(`/api/student/results/${item.id}/view`, { method: "POST" }).catch(() => undefined);
    }
    router.push(`/student/results?assessment=${encodeURIComponent(item.id)}`);
    router.refresh();
  }

  return (
    <section className="student-notification-history student-notification-history-v422">
      <div className="student-notification-page-head">
        <div>
          <h2>Recent notifications</h2>
          <p>{unread ? `${unread} unread notification${unread === 1 ? "" : "s"}` : "You're all caught up."}</p>
        </div>
      </div>

      {items.length ? (
        <div className="student-notification-page-list">
          {items.map((item) => (
            <button type="button" className={`student-notification-page-item${item.isUnread ? " is-unread" : ""}`} key={`${item.id}-${item.releasedAt}`} onClick={() => void openNotification(item)}>
              <span className="student-notification-page-icon" aria-hidden="true"><NotificationIcon size={18} /></span>
              <span className="student-notification-page-copy">
                <span className="student-notification-page-title"><strong>{item.title}</strong>{item.isUnread && <i aria-label="Unread" />}</span>
                <span>{item.subject} · {item.type}</span>
                <time dateTime={item.releasedAt}>{formatReleaseTime(item.releasedAt)}</time>
              </span>
            </button>
          ))}
        </div>
      ) : (
        <div className="student-notification-page-empty">
          <svg className="student-notification-empty-vector-v422" viewBox="0 0 48 48" fill="none" aria-hidden="true">
            <path d="M14 31.5h20l-2.1-3V20.8c0-4.9-3.2-8.6-7.9-9.4-4.7.8-7.9 4.5-7.9 9.4v7.7l-2.1 3Z" />
            <path d="M20.5 35.5c.8 2.1 2 3 3.5 3s2.7-.9 3.5-3" />
            <path className="is-accent" d="M36.5 12v4M34.5 14h4" />
            <circle className="is-soft" cx="12.5" cy="17" r="2" />
          </svg>
          <strong>No notifications yet</strong>
          <span>Newly released results will appear here automatically.</span>
        </div>
      )}
    </section>
  );
}
