"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { NotificationIcon } from "@/components/icons";
import { ToastNotice } from "@/components/ui/ToastNotice";

type PushState =
  | "checking"
  | "enabled"
  | "disabled"
  | "blocked"
  | "unsupported"
  | "needs-install"
  | "unconfigured";

type PushConfig = {
  configured?: boolean;
  storageReady?: boolean;
  publicKey?: string;
  savedDevices?: number;
};

function base64ToUint8Array(value: string) {
  const padding = "=".repeat((4 - value.length % 4) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  return Uint8Array.from([...raw].map((char) => char.charCodeAt(0)));
}

function isStandalone() {
  return window.matchMedia?.("(display-mode: standalone)").matches
    || Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
}

function isIOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}

async function ensureWorker() {
  const registration = await navigator.serviceWorker.register("/sw.js", {
    scope: "/",
    updateViaCache: "none",
  });
  void registration.update().catch(() => undefined);
  return navigator.serviceWorker.ready;
}

async function readConfig(): Promise<PushConfig> {
  const response = await fetch("/api/student/push", { cache: "no-store", credentials: "same-origin" });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error("Unable to check phone notifications.");
  return body as PushConfig;
}

async function saveSubscription(subscription: PushSubscription) {
  const response = await fetch("/api/student/push", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({ subscription: subscription.toJSON() }),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(String(body?.error || "Unable to save this phone for notifications."));
  }
}

export function StudentDeviceNotifications() {
  const [state, setState] = useState<PushState>("checking");
  const [busy, setBusy] = useState(false);
  const [testing, setTesting] = useState(false);
  const [toast, setToast] = useState("");
  const [savedDevices, setSavedDevices] = useState(0);
  const currentEndpoint = useRef("");

  useEffect(() => {
    let active = true;

    void (async () => {
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
        if (active) setState("unsupported");
        return;
      }
      if (isIOS() && !isStandalone()) {
        if (active) setState("needs-install");
        return;
      }

      try {
        const config = await readConfig();
        if (!active) return;
        setSavedDevices(Number(config.savedDevices || 0));
        if (!config.configured || !config.storageReady || !config.publicKey) {
          setState("unconfigured");
          return;
        }
        if (Notification.permission === "denied") {
          setState("blocked");
          return;
        }
        if (Notification.permission !== "granted") {
          setState("disabled");
          return;
        }

        // Permission is already granted. Rebuild/sync the subscription silently if
        // the browser or an app update dropped the local PushSubscription.
        const registration = await ensureWorker();
        let subscription = await registration.pushManager.getSubscription();
        if (!subscription) {
          subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: base64ToUint8Array(String(config.publicKey)),
          });
        }
        await saveSubscription(subscription);
        currentEndpoint.current = subscription.endpoint;
        if (active) {
          setSavedDevices((count) => Math.max(1, count));
          setState("enabled");
        }
      } catch {
        if (active) setState(Notification.permission === "granted" ? "disabled" : "disabled");
      }
    })();

    return () => { active = false; };
  }, []);

  async function enable() {
    if (busy) return;
    setBusy(true);
    try {
      if (isIOS() && !isStandalone()) {
        setState("needs-install");
        setToast("Install MedScores on your Home Screen first, then enable phone notifications.");
        return;
      }
      const config = await readConfig();
      setSavedDevices(Number(config.savedDevices || 0));
      if (!config.configured || !config.storageReady || !config.publicKey) {
        setState("unconfigured");
        throw new Error("Phone notifications need the one-time notification setup first.");
      }

      const permission = Notification.permission === "granted"
        ? "granted"
        : await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "blocked" : "disabled");
        setToast(permission === "denied"
          ? "Phone notifications are blocked in this device's notification settings."
          : "Phone notifications were not enabled.");
        return;
      }

      const registration = await ensureWorker();
      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: base64ToUint8Array(String(config.publicKey)),
        });
      }
      await saveSubscription(subscription);
      currentEndpoint.current = subscription.endpoint;
      setSavedDevices((count) => Math.max(1, count));
      setState("enabled");

      // Immediately verify real system-level delivery. This is intentionally a
      // Web Push test, not an in-app toast masquerading as a device notification.
      const testResponse = await fetch("/api/student/push/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ endpoint: subscription.endpoint }),
      });
      if (testResponse.ok) setToast("Phone notifications enabled. A test notification was sent.");
      else setToast("Phone notifications are enabled, but the test alert could not be delivered yet.");
    } catch (error) {
      setToast(error instanceof Error ? error.message : "Unable to enable phone notifications.");
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    if (busy) return;
    setBusy(true);
    try {
      const registration = await ensureWorker();
      const subscription = await registration.pushManager.getSubscription();
      const endpoint = subscription?.endpoint || currentEndpoint.current;
      if (endpoint) {
        await fetch("/api/student/push", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({ endpoint }),
        }).catch(() => undefined);
      }
      if (subscription) await subscription.unsubscribe().catch(() => false);
      currentEndpoint.current = "";
      setSavedDevices((count) => Math.max(0, count - 1));
      setState("disabled");
      setToast("Phone notifications disabled on this device.");
    } catch {
      setToast("Unable to disable phone notifications right now.");
    } finally {
      setBusy(false);
    }
  }

  async function sendTest() {
    if (testing) return;
    setTesting(true);
    try {
      const registration = await ensureWorker();
      const subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        setState("disabled");
        setToast("This device needs to reconnect to phone notifications.");
        return;
      }
      await saveSubscription(subscription);
      currentEndpoint.current = subscription.endpoint;
      const response = await fetch("/api/student/push/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ endpoint: subscription.endpoint }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(String(body?.error || "Test notification could not be delivered."));
      setToast("Test notification sent to this device.");
    } catch (error) {
      setToast(error instanceof Error ? error.message : "Test notification could not be delivered.");
    } finally {
      setTesting(false);
    }
  }

  const description = useMemo(() => {
    if (state === "enabled") return "Newly released scores can appear in your phone or computer notifications even when MedScores is not open.";
    if (state === "needs-install") return "On iPhone, install MedScores on the Home Screen first. Then return here to enable phone notifications.";
    if (state === "blocked") return "Notifications are blocked for MedScores on this device. Allow them in your device or browser notification settings, then return here.";
    if (state === "unsupported") return "This browser or device does not support phone notifications for web apps.";
    if (state === "unconfigured") return "Phone notifications are not ready on the server yet. The one-time notification setup must be completed first.";
    if (state === "checking") return "Checking this device's notification status…";
    return "Receive a device notification whenever a new assessment score is released.";
  }, [state]);

  const status = state === "enabled" ? "On"
    : state === "checking" ? "Checking…"
      : state === "blocked" ? "Blocked"
        : state === "needs-install" ? "Install app first"
          : state === "unsupported" ? "Unavailable"
            : state === "unconfigured" ? "Needs setup"
              : "Off";

  return (
    <>
      <div className="student-device-settings-v422">
        <div className="student-setting-card-head-v419 student-device-settings-head-v422">
          <div className="student-device-settings-title-v422">
            <span className="student-device-settings-mark-v422" aria-hidden="true"><NotificationIcon size={22} /></span>
            <div>
              <span className="student-setting-eyebrow-v419">Notifications</span>
              <h2>Phone notifications</h2>
              <p>{description}</p>
            </div>
          </div>
          <span className={`student-setting-status-v419${state === "enabled" ? " is-active" : ""}`}>{status}</span>
        </div>

        {state === "enabled" && savedDevices > 0 && (
          <div className="student-device-settings-note-v422">
            <span>This device is connected.</span>
            <small>{savedDevices > 1 ? `${savedDevices} saved devices` : "Ready for score releases"}</small>
          </div>
        )}

        <div className="student-device-settings-actions-v422">
          {state === "enabled" ? (
            <>
              <button type="button" className="button button-primary button-sm" disabled={testing || busy} onClick={() => void sendTest()}>{testing ? "Sending…" : "Send test notification"}</button>
              <button type="button" className="button button-secondary button-sm" disabled={busy || testing} onClick={() => void disable()}>{busy ? "Updating…" : "Disable"}</button>
            </>
          ) : state === "disabled" ? (
            <button type="button" className="button button-primary button-sm" disabled={busy} onClick={() => void enable()}>{busy ? "Enabling…" : "Enable notifications"}</button>
          ) : null}
        </div>
      </div>
      <ToastNotice
        message={toast}
        tone={toast.toLowerCase().includes("unable") || toast.toLowerCase().includes("blocked") || toast.toLowerCase().includes("could not") ? "error" : "success"}
        onDismiss={() => setToast("")}
      />
    </>
  );
}
