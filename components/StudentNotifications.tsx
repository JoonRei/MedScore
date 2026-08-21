"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ToastNotice } from "@/components/ui/ToastNotice";

export type StudentNotification = {
  id: string;
  title: string;
  type: string;
  subject: string;
  releasedAt: string;
  resultStatus: string;
  isUnread?: boolean;
};

type NotificationContextValue = {
  items: StudentNotification[];
  refreshUnread: () => Promise<void>;
};

const NotificationContext = createContext<NotificationContextValue | null>(null);

export function StudentNotificationsProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [items, setItems] = useState<StudentNotification[]>([]);
  const [toast, setToast] = useState("");
  const seenEventsRef = useRef<Set<string>>(new Set());

  const refreshUnread = useCallback(async () => {
    try {
      const response = await fetch("/api/student/notifications", { cache: "no-store", credentials: "same-origin" });
      if (!response.ok) return;
      const body = await response.json().catch(() => ({}));
      const nextItems = Array.isArray(body.notifications) ? body.notifications as StudentNotification[] : [];
      for (const item of nextItems) seenEventsRef.current.add(`${item.id}:${item.releasedAt}`);
      setItems(nextItems);
    } catch {
      // A temporary fetch failure should not interrupt the Student portal.
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    let source: EventSource | null = null;

    const handleRelease = (event: MessageEvent<string>) => {
      try {
        const item = JSON.parse(event.data) as StudentNotification;
        if (!item?.id) return;
        const eventKey = `${item.id}:${item.releasedAt}`;
        if (seenEventsRef.current.has(eventKey)) return;
        seenEventsRef.current.add(eventKey);
        setItems((current) => [{ ...item, isUnread: true }, ...current.filter((entry) => entry.id !== item.id)].slice(0, 20));
        setToast(`New result available — ${item.subject}: ${item.title}`);
        router.refresh();
      } catch {
        // Ignore malformed live events and keep the stream connected.
      }
    };

    const handleViewed = (event: Event) => {
      const id = (event as CustomEvent<{ assessmentId?: string }>).detail?.assessmentId;
      if (id) setItems((current) => current.filter((item) => item.id !== id));
    };
    const handleVisibility = () => {
      if (document.visibilityState === "visible") void refreshUnread();
    };

    window.addEventListener("medscores:result-viewed", handleViewed);
    document.addEventListener("visibilitychange", handleVisibility);

    void (async () => {
      await refreshUnread();
      if (cancelled) return;
      const since = new Date(Date.now() - 15000).toISOString();
      source = new EventSource(`/api/student/notifications/stream?since=${encodeURIComponent(since)}`);
      source.addEventListener("score_release", handleRelease as EventListener);
    })();

    return () => {
      cancelled = true;
      if (source) {
        source.removeEventListener("score_release", handleRelease as EventListener);
        source.close();
      }
      window.removeEventListener("medscores:result-viewed", handleViewed);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [refreshUnread, router]);

  const value = useMemo(() => ({ items, refreshUnread }), [items, refreshUnread]);

  return (
    <NotificationContext.Provider value={value}>
      {children}
      <ToastNotice message={toast} tone="info" onDismiss={() => setToast("")} />
    </NotificationContext.Provider>
  );
}

export function useStudentNotifications() {
  return useContext(NotificationContext);
}

export function StudentNotificationBadge({ className = "" }: { className?: string }) {
  const context = useContext(NotificationContext);
  const count = context?.items.length || 0;
  if (!count) return null;
  return <span className={`student-notification-badge ${className}`.trim()}>{count > 99 ? "99+" : count}</span>;
}
