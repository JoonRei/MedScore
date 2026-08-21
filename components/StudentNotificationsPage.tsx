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
          <NotificationIcon size={24} />
          <strong>No notifications yet</strong>
          <span>Newly released results will appear here automatically.</span>
        </div>
      )}
    </section>
  );
}
