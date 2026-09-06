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
  ready?: boolean;
  issue?: string | null;
  publicKey?: string;
};

const PUSH_PREFERENCE_KEY = "medscores:student-phone-notifications";

function base64ToUint8Array(value: string) {
  const padding = "=".repeat((4 - value.length % 4) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  return Uint8Array.from([...raw].map((char) => char.charCodeAt(0)));
}

function subscriptionUsesKey(subscription: PushSubscription, publicKey: string) {
  const currentKey = subscription.options.applicationServerKey;
  // Some browsers do not expose the key back to the page. In that case keep the
  // existing subscription rather than forcing a needless unsubscribe/resubscribe.
  if (!currentKey) return true;
  const actual = new Uint8Array(currentKey as ArrayBuffer);
  const expected = base64ToUint8Array(publicKey);
  if (actual.byteLength !== expected.byteLength) return false;
  for (let index = 0; index < actual.byteLength; index += 1) {
    if (actual[index] !== expected[index]) return false;
  }
  return true;
}

async function ensureCurrentSubscription(registration: ServiceWorkerRegistration, publicKey: string, mayCreate: boolean) {
  let subscription = await registration.pushManager.getSubscription();
  if (subscription && !subscriptionUsesKey(subscription, publicKey)) {
    await subscription.unsubscribe().catch(() => false);
    subscription = null;
  }
  if (!subscription && mayCreate) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: base64ToUint8Array(publicKey),
    });
  }
  return subscription;
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
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 4500);
  try {
    const response = await fetch("/api/student/push", {
      cache: "no-store",
      credentials: "same-origin",
      signal: controller.signal,
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error("Unable to check phone notifications.");
    return body as PushConfig;
  } finally {
    window.clearTimeout(timeout);
  }
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
  const [toast, setToast] = useState("");
  const currentEndpoint = useRef("");

  useEffect(() => {
    let active = true;
    let checkingFallback = 0;

    const rememberedEnabled = window.localStorage.getItem(PUSH_PREFERENCE_KEY) === "enabled";
    const permission = "Notification" in window ? Notification.permission : "default";

    // Do not make an already-enabled student watch "Checking…" every time Settings
    // opens. Show the remembered healthy state immediately, then verify/repair the
    // subscription quietly in the background.
    if (permission === "granted" && rememberedEnabled) setState("enabled");

    checkingFallback = window.setTimeout(() => {
      if (!active) return;
      setState((current) => current === "checking"
        ? (Notification.permission === "denied" ? "blocked" : "disabled")
        : current);
    }, 2200);

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
        const serverReady = config.ready ?? Boolean(config.configured && config.storageReady && config.publicKey);
        if (!serverReady || !config.publicKey) {
          setState("disabled");
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

        const registration = await ensureWorker();
        const existingSubscription = await registration.pushManager.getSubscription();
        const remembered = window.localStorage.getItem(PUSH_PREFERENCE_KEY) === "enabled";
        if (!existingSubscription && !remembered) {
          setState("disabled");
          return;
        }

        const subscription = await ensureCurrentSubscription(
          registration,
          String(config.publicKey),
          Boolean(existingSubscription || remembered),
        );
        if (!subscription) {
          if (!remembered && active) setState("disabled");
          return;
        }

        await saveSubscription(subscription);
        window.localStorage.setItem(PUSH_PREFERENCE_KEY, "enabled");
        currentEndpoint.current = subscription.endpoint;
        if (active) setState("enabled");
      } catch {
        // Keep a remembered, permission-granted device visually On during a
        // transient network/service-worker check. PwaRegister separately repairs
        // stale subscriptions in the background.
        if (active && !(Notification.permission === "granted" && rememberedEnabled)) {
          setState(Notification.permission === "denied" ? "blocked" : "disabled");
        }
      }
    })();

    return () => {
      active = false;
      window.clearTimeout(checkingFallback);
    };
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
      const serverReady = config.ready ?? Boolean(config.configured && config.storageReady && config.publicKey);
      if (!serverReady || !config.publicKey) {
        setState("disabled");
        setToast("Phone notifications are not available on this MedScores deployment yet.");
        return;
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
      const subscription = await ensureCurrentSubscription(registration, String(config.publicKey), true);
      if (!subscription) throw new Error("Unable to create a phone notification subscription.");
      await saveSubscription(subscription);
      window.localStorage.setItem(PUSH_PREFERENCE_KEY, "enabled");
      currentEndpoint.current = subscription.endpoint;
      setState("enabled");
      setToast("Phone notifications enabled.");
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
      window.localStorage.removeItem(PUSH_PREFERENCE_KEY);
      setState("disabled");
      setToast("Phone notifications disabled on this device.");
    } catch {
      setToast("Unable to disable phone notifications right now.");
    } finally {
      setBusy(false);
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


  return (
    <>
      <div className="student-device-settings-v422">
        <div className="student-setting-card-head-v419 student-device-settings-head-v422">
          <div className="student-device-settings-title-v422">
            <NotificationIcon size={22} />
            <div>
              <span className="student-setting-eyebrow-v419">Notifications</span>
              <h2>Phone notifications</h2>
              <p>{description}</p>
            </div>
          </div>
          <div className="student-device-settings-actions-v422">
            <button
              type="button"
              className={`student-setting-toggle-v422${state === "enabled" ? " is-on" : ""}`}
              role="switch"
              aria-checked={state === "enabled"}
              aria-label={state === "enabled" ? "Disable phone notifications" : "Enable phone notifications"}
              title={state === "enabled" ? "Disable phone notifications" : "Enable phone notifications"}
              disabled={busy || state === "checking" || state === "blocked" || state === "unsupported" || state === "needs-install"}
              onClick={() => void (state === "enabled" ? disable() : enable())}
            >
              <span className="student-setting-toggle-knob-v422" aria-hidden="true" />
            </button>
          </div>
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
