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

const AUTO_REFRESH_BASE_MS = 30_000;
const AUTO_REFRESH_JITTER_MS = 15_000;

function eventKey(item: StudentNotification) {
  return `${item.id}:${item.releasedAt}`;
}

export function StudentNotificationsProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [items, setItems] = useState<StudentNotification[]>([]);
  const [toast, setToast] = useState("");
  const seenEventsRef = useRef<Set<string>>(new Set());
  const initializedRef = useRef(false);
  const inFlightRef = useRef<Promise<void> | null>(null);

  const loadUnread = useCallback((notifyOnNew: boolean) => {
    if (inFlightRef.current) return inFlightRef.current;

    const task = (async () => {
      try {
        const response = await fetch("/api/student/notifications", {
          cache: "no-store",
          credentials: "same-origin",
        });
        if (!response.ok) return;

        const body = await response.json().catch(() => ({}));
        const nextItems = Array.isArray(body.notifications)
          ? body.notifications as StudentNotification[]
          : [];

        const wasInitialized = initializedRef.current;
        const newestUnseen = wasInitialized
          ? nextItems.find((item) => !seenEventsRef.current.has(eventKey(item)))
          : undefined;

        for (const item of nextItems) {
          seenEventsRef.current.add(eventKey(item));
        }

        setItems(nextItems);
        initializedRef.current = true;

        if (notifyOnNew && newestUnseen) {
          setToast(`New result available — ${newestUnseen.subject}: ${newestUnseen.title}`);
          // Refresh only when something actually changed. This keeps the portal
          // current without continuously re-rendering server components.
          router.refresh();
        }
      } catch {
        // Temporary network/database pressure must never interrupt the portal.
      }
    })().finally(() => {
      inFlightRef.current = null;
    });

    inFlightRef.current = task;
    return task;
  }, [router]);

  const refreshUnread = useCallback(async () => {
    await loadUnread(false);
  }, [loadUnread]);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const clearTimer = () => {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
    };

    const schedule = () => {
      clearTimer();
      if (cancelled) return;

      const jitter = Math.floor(Math.random() * AUTO_REFRESH_JITTER_MS);
      timer = setTimeout(async () => {
        if (cancelled) return;
        if (document.visibilityState === "visible") {
          await loadUnread(true);
        }
        schedule();
      }, AUTO_REFRESH_BASE_MS + jitter);
    };

    const handleViewed = (event: Event) => {
      const id = (event as CustomEvent<{ assessmentId?: string }>).detail?.assessmentId;
      if (id) setItems((current) => current.filter((item) => item.id !== id));
    };

    const handleVisibility = () => {
      if (document.visibilityState !== "visible") return;
      void loadUnread(true);
      schedule();
    };

    const handleOnline = () => {
      if (document.visibilityState !== "visible") return;
      void loadUnread(true);
      schedule();
    };

    window.addEventListener("medscores:result-viewed", handleViewed);
    window.addEventListener("online", handleOnline);
    document.addEventListener("visibilitychange", handleVisibility);

    void loadUnread(false).finally(schedule);

    return () => {
      cancelled = true;
      clearTimer();
      window.removeEventListener("medscores:result-viewed", handleViewed);
      window.removeEventListener("online", handleOnline);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [loadUnread]);

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
