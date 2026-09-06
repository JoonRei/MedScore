"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { NotificationIcon } from "@/components/icons";
import type { StudentNotification } from "@/components/StudentNotifications";

function formatReleaseTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Recently";
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function calendarKey(date: Date) {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function notificationGroupLabel(value: string, now: Date) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Earlier";

  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);

  if (calendarKey(date) === calendarKey(today)) return "Today";
  if (calendarKey(date) === calendarKey(yesterday)) return "Yesterday";

  return new Intl.DateTimeFormat(undefined, {
    month: "long",
    day: "numeric",
    year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  }).format(date);
}

export function StudentNotificationsPage({ initialItems }: { initialItems: StudentNotification[] }) {
  const router = useRouter();
  const [items, setItems] = useState(initialItems);
  const unread = useMemo(() => items.filter((item) => item.isUnread).length, [items]);

  const groupedItems = useMemo(() => {
    const now = new Date();
    const ordered = [...items].sort((a, b) => {
      const aTime = new Date(a.releasedAt).getTime();
      const bTime = new Date(b.releasedAt).getTime();
      const safeA = Number.isFinite(aTime) ? aTime : 0;
      const safeB = Number.isFinite(bTime) ? bTime : 0;
      return safeB - safeA;
    });

    const groups = new Map<string, { label: string; items: StudentNotification[] }>();

    for (const item of ordered) {
      const date = new Date(item.releasedAt);
      const key = Number.isNaN(date.getTime()) ? "earlier" : calendarKey(date);
      const existing = groups.get(key);

      if (existing) {
        existing.items.push(item);
      } else {
        groups.set(key, {
          label: notificationGroupLabel(item.releasedAt, now),
          items: [item],
        });
      }
    }

    return Array.from(groups.entries()).map(([key, group]) => ({ key, ...group }));
  }, [items]);

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
    <section className="student-notification-history student-notification-history-v422 student-notification-history-v466">
      <div className="student-notification-page-head student-notification-page-head-v466">
        <div>
          <h2>Recent notifications</h2>
          <p>{unread ? `${unread} unread notification${unread === 1 ? "" : "s"}` : "You're all caught up."}</p>
        </div>
        {unread > 0 && <span className="student-notification-unread-count-v466">{unread} unread</span>}
      </div>

      {groupedItems.length ? (
        <div className="student-notification-groups-v466">
          {groupedItems.map((group) => (
            <section className="student-notification-date-group-v466" key={group.key} aria-labelledby={`notification-group-${group.key}`}>
              <h3 className="student-notification-date-label-v466" id={`notification-group-${group.key}`}>{group.label}</h3>
              <div className="student-notification-page-list student-notification-group-list-v466">
                {group.items.map((item) => (
                  <button
                    type="button"
                    className={`student-notification-page-item student-notification-page-item-v466${item.isUnread ? " is-unread" : ""}`}
                    key={`${item.id}-${item.releasedAt}`}
                    onClick={() => void openNotification(item)}
                  >
                    <span className="student-notification-page-icon student-notification-page-icon-v466" aria-hidden="true">
                      <NotificationIcon size={18} />
                    </span>
                    <span className="student-notification-page-copy student-notification-page-copy-v466">
                      <span className="student-notification-page-title">
                        <strong>{item.title}</strong>
                        {item.isUnread && <i aria-label="Unread" />}
                      </span>
                      <span className="student-notification-page-meta-v466">{item.subject} · {item.type}</span>
                      <time className="student-notification-page-time-v466" dateTime={item.releasedAt}>{formatReleaseTime(item.releasedAt)}</time>
                    </span>
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <div className="student-notification-page-empty student-notification-page-empty-v466">
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
