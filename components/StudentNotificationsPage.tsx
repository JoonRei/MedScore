"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { NotificationIcon } from "@/components/icons";
import { ToastNotice } from "@/components/ui/ToastNotice";
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

function base64ToUint8Array(value: string) {
  const padding = "=".repeat((4 - value.length % 4) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  return Uint8Array.from([...raw].map((char) => char.charCodeAt(0)));
}

function isStandalone() {
  if (typeof window === "undefined") return false;
  return window.matchMedia?.("(display-mode: standalone)").matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
}

export function StudentNotificationsPage({ initialItems }: { initialItems: StudentNotification[] }) {
  const router = useRouter();
  const [items, setItems] = useState(initialItems);
  const [pushState, setPushState] = useState<"checking" | "enabled" | "disabled" | "unsupported" | "needs-install" | "unconfigured">("checking");
  const [pushBusy, setPushBusy] = useState(false);
  const [toast, setToast] = useState("");
  const unread = useMemo(() => items.filter((item) => item.isUnread).length, [items]);

  useEffect(() => { setItems(initialItems); }, [initialItems]);

  useEffect(() => {
    let active = true;
    void (async () => {
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
        if (active) setPushState("unsupported");
        return;
      }
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      if (isIOS && !isStandalone()) {
        if (active) setPushState("needs-install");
        return;
      }
      try {
        const configResponse = await fetch("/api/student/push", { cache: "no-store" });
        const config = await configResponse.json().catch(() => ({}));
        if (!configResponse.ok || !config.configured) {
          if (active) setPushState("unconfigured");
          return;
        }
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        if (active) setPushState(subscription && Notification.permission === "granted" ? "enabled" : "disabled");
      } catch {
        if (active) setPushState("disabled");
      }
    })();
    return () => { active = false; };
  }, []);

  async function enablePush() {
    if (pushBusy) return;
    setPushBusy(true);
    try {
      const response = await fetch("/api/student/push", { cache: "no-store" });
      const config = await response.json().catch(() => ({}));
      if (!response.ok || !config.publicKey) throw new Error("Device notifications are not configured yet.");

      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setPushState("disabled");
        setToast("Notifications were not enabled on this device.");
        return;
      }

      const registration = await navigator.serviceWorker.ready;
      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: base64ToUint8Array(String(config.publicKey)),
        });
      }

      const saved = await fetch("/api/student/push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscription: subscription.toJSON() }),
      });
      if (!saved.ok) throw new Error("Unable to save this device.");
      setPushState("enabled");
      setToast("Device notifications enabled.");
    } catch (error) {
      setToast(error instanceof Error ? error.message : "Unable to enable device notifications.");
    } finally {
      setPushBusy(false);
    }
  }

  async function disablePush() {
    if (pushBusy) return;
    setPushBusy(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await fetch("/api/student/push", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        }).catch(() => undefined);
        await subscription.unsubscribe().catch(() => false);
      }
      setPushState("disabled");
      setToast("Device notifications disabled.");
    } finally {
      setPushBusy(false);
    }
  }

  async function openNotification(item: StudentNotification) {
    if (item.isUnread) {
      setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, isUnread: false } : entry));
      window.dispatchEvent(new CustomEvent("medscores:result-viewed", { detail: { assessmentId: item.id } }));
      await fetch(`/api/student/results/${item.id}/view`, { method: "POST" }).catch(() => undefined);
    }
    router.push(`/student/results?assessment=${encodeURIComponent(item.id)}`);
    router.refresh();
  }

  const pushCopy = pushState === "enabled"
    ? "Score releases can appear on this device even when MedScores is closed."
    : pushState === "needs-install"
      ? "Install MedScores on your iPhone Home Screen first, then enable notifications here."
      : pushState === "unsupported"
        ? "This browser or device does not support web push notifications."
        : pushState === "unconfigured"
          ? "Device notifications need one-time server setup before students can enable them."
          : "Enable alerts for newly released assessment results on this device.";

  return <>
    <section className="student-notifications-page-grid">
      <div className="student-notification-history">
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
      </div>

      <aside className="student-device-notification-card">
        <div className="student-device-notification-icon"><NotificationIcon size={20} /></div>
        <div>
          <h2>Device notifications</h2>
          <p>{pushCopy}</p>
        </div>
        <div className="student-device-notification-status">
          <span>Status</span>
          <strong>{pushState === "enabled" ? "Enabled" : pushState === "checking" ? "Checking…" : "Off"}</strong>
        </div>
        {pushState === "enabled" ? (
          <button type="button" className="button button-secondary" disabled={pushBusy} onClick={() => void disablePush()}>{pushBusy ? "Updating…" : "Disable"}</button>
        ) : pushState === "disabled" ? (
          <button type="button" className="button button-primary" disabled={pushBusy} onClick={() => void enablePush()}>{pushBusy ? "Enabling…" : "Enable notifications"}</button>
        ) : null}
      </aside>
    </section>
    <ToastNotice message={toast} tone={toast.toLowerCase().includes("unable") || toast.toLowerCase().includes("not enabled") ? "error" : "success"} onDismiss={() => setToast("")} />
  </>;
}
