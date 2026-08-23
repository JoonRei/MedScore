"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

const PUSH_PREFERENCE_KEY = "medscores:student-phone-notifications";
const PUSH_SYNC_AT_KEY = "medscores:student-phone-notifications-synced-at";
const PUSH_SYNC_INTERVAL_MS = 5 * 60 * 1000;

function pushKeyBytes(value: string) {
  const padding = "=".repeat((4 - value.length % 4) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  return Uint8Array.from([...raw].map((char) => char.charCodeAt(0)));
}

function pushSubscriptionMatchesKey(subscription: PushSubscription, publicKey: string) {
  const currentKey = subscription.options.applicationServerKey;
  if (!currentKey) return true;
  const actual = new Uint8Array(currentKey as ArrayBuffer);
  const expected = pushKeyBytes(publicKey);
  if (actual.byteLength !== expected.byteLength) return false;
  for (let index = 0; index < actual.byteLength; index += 1) {
    if (actual[index] !== expected[index]) return false;
  }
  return true;
}

export function PwaRegister() {
  const pathname = usePathname();
  const router = useRouter();
  const previousPathname = useRef(pathname);
  const interruptionRecoveryAttempts = useRef(0);
  const [liveUpdateState, setLiveUpdateState] = useState<"idle" | "refreshing" | "updated">("idle");

  useEffect(() => {
    // Expose a small route hook for page-specific Student Portal polish without
    // coupling shared components to the Subjects implementation.
    const route = pathname === "/student"
      ? "home"
      : pathname === "/student/subjects"
        ? "subjects"
        : pathname.startsWith("/student/subjects/")
          ? "subject-detail"
          : pathname === "/student/results"
            ? "results"
            : pathname === "/student/notifications"
              ? "notifications"
              : pathname === "/student/settings"
                ? "settings"
                : "";

    if (route) document.body.dataset.studentRoute = route;
    else delete document.body.dataset.studentRoute;

    return () => {
      if (document.body.dataset.studentRoute === route) delete document.body.dataset.studentRoute;
    };
  }, [pathname]);

  useEffect(() => {
    // The admin can expose Students as a route or as an in-page view. Detect both
    // and only use a body data marker for CSS presentation; stored names and React
    // text remain untouched, so this cannot create a hydration mismatch.
    const routeLooksLikeStudents = /(^|\/)students(?:\/|$)/.test(pathname) && !pathname.startsWith("/student/");

    const updateStudentsMarker = () => {
      const headings = Array.from(document.querySelectorAll<HTMLElement>(
        "main h1, main h2, .page-header h1, .page-header h2, .content-header h1, .content-header h2"
      ));
      const headingLooksLikeStudents = headings.some((heading) =>
        /\bstudents\b/i.test((heading.textContent || "").trim())
      );
      const shouldEnable = routeLooksLikeStudents || (!pathname.startsWith("/student/") && headingLooksLikeStudents);

      if (shouldEnable) document.body.dataset.smartStudentNames = "true";
      else delete document.body.dataset.smartStudentNames;
    };

    updateStudentsMarker();
    const observer = new MutationObserver(updateStudentsMarker);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      if (document.body.dataset.smartStudentNames === "true") delete document.body.dataset.smartStudentNames;
    };
  }, [pathname]);

  useEffect(() => {
    if (pathname !== "/student/subjects") return;

    // Do not replace server-rendered subject-code text here. Mutating that text
    // before the Subjects client tree finishes hydrating causes React hydration
    // mismatches. Instead, add a presentation-only data attribute after hydration
    // and let CSS draw the single-letter avatar above the untouched server text.
    const firstLetterFromSubjectName = (name: string) => {
      const normalized = name.replace(/[^\p{L}\p{N}]+/gu, " ").trim();
      return normalized ? normalized[0].toUpperCase() : "S";
    };

    const applySubjectInitials = () => {
      document.querySelectorAll<HTMLElement>(".student-shell .subject-card").forEach((card) => {
        const avatar = card.querySelector<HTMLElement>(".subject-code");
        const title = card.querySelector<HTMLElement>("h3");
        if (!avatar || !title) return;

        const subjectName = (title.textContent || "").trim();
        if (!subjectName) return;
        avatar.dataset.subjectInitial = firstLetterFromSubjectName(subjectName);
      });
    };

    // A short post-paint delay keeps this enhancement outside React's hydration
    // pass on a hard refresh. It is also safe on client-side route transitions.
    let frameOne = 0;
    let frameTwo = 0;
    let settle = 0;
    const schedule = () => {
      frameOne = window.requestAnimationFrame(() => {
        frameTwo = window.requestAnimationFrame(() => {
          settle = window.setTimeout(applySubjectInitials, 80);
        });
      });
    };

    if (document.readyState === "complete") schedule();
    else window.addEventListener("load", schedule, { once: true });

    return () => {
      window.removeEventListener("load", schedule);
      window.cancelAnimationFrame(frameOne);
      window.cancelAnimationFrame(frameTwo);
      window.clearTimeout(settle);
    };
  }, [pathname]);

  useEffect(() => {
    if (previousPathname.current === pathname) return;
    previousPathname.current = pathname;
    if (!pathname.startsWith("/student")) return;
    if (!window.matchMedia("(max-width: 900px)").matches) return;

    // The mobile/tablet shell scrolls inside .main-content instead of the window.
    // Reset that pane after every route change so each Student page opens at the top.
    const resetStudentScroll = () => {
      const content = document.querySelector<HTMLElement>(".student-shell .main-content");
      if (content) content.scrollTo({ top: 0, left: 0, behavior: "auto" });
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    };

    resetStudentScroll();
    const frame = window.requestAnimationFrame(resetStudentScroll);
    const settle = window.setTimeout(resetStudentScroll, 80);
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(settle);
    };
  }, [pathname]);

  useEffect(() => {
    if (!pathname.startsWith("/student")) return;
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return;

    let cancelled = false;
    let syncing = false;

    const syncStudentPush = async (force = false) => {
      if (cancelled || syncing || Notification.permission !== "granted") return;

      syncing = true;
      try {
        const rememberedEnabled = window.localStorage.getItem(PUSH_PREFERENCE_KEY) === "enabled";
        const lastSync = Number(window.localStorage.getItem(PUSH_SYNC_AT_KEY) || 0);
        if (!force && lastSync && Date.now() - lastSync < PUSH_SYNC_INTERVAL_MS) return;
        const configResponse = await fetch("/api/student/push", {
          cache: "no-store",
          credentials: "same-origin",
        });
        if (!configResponse.ok) return;
        const config = await configResponse.json().catch(() => ({})) as {
          configured?: boolean;
          storageReady?: boolean;
          publicKey?: string;
        };
        if (!config.configured || !config.storageReady || !config.publicKey) return;

        const registration = await navigator.serviceWorker.ready;
        let subscription = await registration.pushManager.getSubscription();
        const hadSubscription = Boolean(subscription);
        if (!subscription && !rememberedEnabled) return;

        if (subscription && !pushSubscriptionMatchesKey(subscription, String(config.publicKey))) {
          await subscription.unsubscribe().catch(() => false);
          subscription = null;
        }

        if (!subscription && (rememberedEnabled || hadSubscription)) {
          subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: pushKeyBytes(String(config.publicKey)),
          });
        }
        if (!subscription) return;

        const saveResponse = await fetch("/api/student/push", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({ subscription: subscription.toJSON() }),
        });
        if (!saveResponse.ok) return;

        window.localStorage.setItem(PUSH_PREFERENCE_KEY, "enabled");
        window.localStorage.setItem(PUSH_SYNC_AT_KEY, String(Date.now()));
      } catch {
        // Push health repair is deliberately silent. A transient network or push-service
        // problem must never interrupt the Student Portal or score viewing experience.
      } finally {
        syncing = false;
      }
    };

    const handleOnline = () => void syncStudentPush(true);
    const handlePageShow = () => void syncStudentPush(false);
    const handleVisibility = () => {
      if (document.visibilityState === "visible") void syncStudentPush(false);
    };

    void syncStudentPush(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("pageshow", handlePageShow);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      cancelled = true;
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("pageshow", handlePageShow);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [pathname]);

  useEffect(() => {
    if (!pathname.startsWith("/student") || !("serviceWorker" in navigator)) return;

    let cancelled = false;
    let settleTimer = 0;
    let hideTimer = 0;
    let retryTimer = 0;
    const pendingRefreshKey = "medscores:pending-student-live-refresh";

    const clearTimers = () => {
      window.clearTimeout(settleTimer);
      window.clearTimeout(hideTimer);
      window.clearTimeout(retryTimer);
    };

    const showRefreshing = () => {
      document.body.dataset.studentLiveRefresh = "true";
      setLiveUpdateState("refreshing");
    };

    const finishRefresh = () => {
      if (cancelled) return;
      setLiveUpdateState("updated");
      settleTimer = window.setTimeout(() => {
        if (cancelled) return;
        setLiveUpdateState("idle");
        delete document.body.dataset.studentLiveRefresh;
      }, 1500);
    };

    const refreshStudentData = (retryOnce = true) => {
      clearTimers();
      showRefreshing();
      router.refresh();
      if (retryOnce) {
        retryTimer = window.setTimeout(() => {
          if (!cancelled) router.refresh();
        }, 650);
      }
      hideTimer = window.setTimeout(finishRefresh, 1050);
    };

    const handleScoreRelease = (event: MessageEvent) => {
      if (event.data?.type !== "MEDSCORES_SCORE_RELEASED") return;
      interruptionRecoveryAttempts.current = 0;
      if (document.visibilityState !== "visible") {
        window.sessionStorage.setItem(pendingRefreshKey, "1");
        return;
      }
      refreshStudentData(true);
    };

    const recoverTemporaryInterruption = () => {
      if (!navigator.onLine || interruptionRecoveryAttempts.current >= 2) return;
      const problem = document.querySelector<HTMLElement>(".app-problem, .app-problem-page");
      if (!problem) return;
      const text = (problem.textContent || "").replace(/\s+/g, " ").trim();
      if (!/temporary interruption/i.test(text)) return;

      interruptionRecoveryAttempts.current += 1;
      refreshStudentData(true);
    };

    const handleVisibility = () => {
      if (document.visibilityState !== "visible") return;
      if (window.sessionStorage.getItem(pendingRefreshKey) === "1") {
        window.sessionStorage.removeItem(pendingRefreshKey);
        interruptionRecoveryAttempts.current = 0;
        refreshStudentData(true);
      }
      recoverTemporaryInterruption();
    };

    const observer = new MutationObserver(recoverTemporaryInterruption);
    observer.observe(document.body, { childList: true, subtree: true });
    navigator.serviceWorker.addEventListener("message", handleScoreRelease);
    document.addEventListener("visibilitychange", handleVisibility);

    if (window.sessionStorage.getItem(pendingRefreshKey) === "1" && document.visibilityState === "visible") {
      window.sessionStorage.removeItem(pendingRefreshKey);
      refreshStudentData(true);
    } else {
      recoverTemporaryInterruption();
    }

    return () => {
      cancelled = true;
      clearTimers();
      observer.disconnect();
      navigator.serviceWorker.removeEventListener("message", handleScoreRelease);
      document.removeEventListener("visibilitychange", handleVisibility);
      delete document.body.dataset.studentLiveRefresh;
    };
  }, [pathname, router]);

  useEffect(() => {
    // Web Push cannot select a custom notification sound on the web. When MedScores
    // is visible, the service worker sends this page a message so we can play a
    // gentle in-app chime instead. Background/closed notifications keep the OS sound.
    type AudioContextConstructor = typeof AudioContext;
    const AudioContextClass = window.AudioContext
      || (window as typeof window & { webkitAudioContext?: AudioContextConstructor }).webkitAudioContext;
    let audioContext: AudioContext | null = null;

    const ensureAudioContext = () => {
      if (!AudioContextClass) return null;
      if (!audioContext) audioContext = new AudioContextClass();
      return audioContext;
    };

    const markSoundReady = async () => {
      if (!("serviceWorker" in navigator)) return;
      const readyMessage = { type: "MEDSCORES_SOUND_READY" };
      if (navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage(readyMessage);
        return;
      }
      const registration = await navigator.serviceWorker.ready.catch(() => null);
      registration?.active?.postMessage(readyMessage);
    };

    const primeNotificationSound = () => {
      const context = ensureAudioContext();
      if (!context) return;

      // iOS/Safari can report a resumed AudioContext but still block later audio
      // unless sound generation itself happened inside a user gesture. Play an
      // effectively silent unlock tone once, then tell the service worker it is
      // safe to silence the OS alert and use the MedScores chime instead.
      const unlock = () => {
        try {
          const oscillator = context.createOscillator();
          const gain = context.createGain();
          gain.gain.setValueAtTime(0.00001, context.currentTime);
          oscillator.connect(gain);
          gain.connect(context.destination);
          oscillator.start();
          oscillator.stop(context.currentTime + 0.018);
          void markSoundReady();
        } catch {
          // If Web Audio cannot be unlocked, the service worker keeps the normal
          // device notification sound rather than silencing the notification.
        }
      };

      if (context.state === "suspended") {
        void context.resume().then(unlock).catch(() => undefined);
      } else {
        unlock();
      }
    };

    const playNotificationChime = () => {
      if (document.visibilityState !== "visible") return;
      const context = ensureAudioContext();
      if (!context) return;

      const play = () => {
        const now = context.currentTime;
        const master = context.createGain();
        master.gain.setValueAtTime(0.0001, now);
        master.gain.exponentialRampToValueAtTime(0.052, now + 0.018);
        master.gain.exponentialRampToValueAtTime(0.0001, now + 0.52);
        master.connect(context.destination);

        const addTone = (frequency: number, start: number, duration: number, level: number) => {
          const oscillator = context.createOscillator();
          const gain = context.createGain();
          oscillator.type = "sine";
          oscillator.frequency.setValueAtTime(frequency, now + start);
          gain.gain.setValueAtTime(0.0001, now + start);
          gain.gain.exponentialRampToValueAtTime(level, now + start + 0.012);
          gain.gain.exponentialRampToValueAtTime(0.0001, now + start + duration);
          oscillator.connect(gain);
          gain.connect(master);
          oscillator.start(now + start);
          oscillator.stop(now + start + duration + 0.02);
        };

        addTone(659.25, 0, 0.26, 0.55);
        addTone(880, 0.13, 0.34, 0.42);
      };

      if (context.state === "suspended") {
        void context.resume().then(play).catch(() => undefined);
      } else {
        play();
      }
    };

    const handleWorkerMessage = (event: MessageEvent) => {
      if (event.data?.type === "MEDSCORES_NOTIFICATION_SOUND") {
        playNotificationChime();
        return;
      }
      if (event.data?.type === "MEDSCORES_SOUND_PROBE" && audioContext?.state === "running") {
        void markSoundReady();
      }
    };

    // Browsers require an interaction before programmatic audio. Prime the tiny
    // audio context on the student's first normal tap/keypress so later foreground
    // notifications can chime without another prompt.
    window.addEventListener("pointerdown", primeNotificationSound, { once: true, passive: true });
    window.addEventListener("touchend", primeNotificationSound, { once: true, passive: true });
    window.addEventListener("click", primeNotificationSound, { once: true, passive: true });
    window.addEventListener("keydown", primeNotificationSound, { once: true });
    if ("serviceWorker" in navigator) navigator.serviceWorker.addEventListener("message", handleWorkerMessage);

    // Score-release updates are already delivered through Web Push. Suppress only
    // the duplicate in-app DOM toast while leaving all normal action/error toasts intact.
    const isScoreReleaseToast = (node: Element) => {
      const text = (node.textContent || "").toLowerCase().replace(/\s+/g, " ").trim();
      const mentionsResult = /\b(score|result|assessment)\b/.test(text);
      const mentionsRelease = /\b(released|published|available)\b/.test(text)
        || /\bnew (score|result)\b/.test(text);
      return mentionsResult && mentionsRelease;
    };

    const removeDuplicateScoreToasts = (root: ParentNode) => {
      root.querySelectorAll?.(".app-toast").forEach((toast) => {
        if (isScoreReleaseToast(toast)) toast.remove();
      });
    };

    removeDuplicateScoreToasts(document);
    const toastObserver = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (!(node instanceof Element)) continue;
          if (node.matches(".app-toast") && isScoreReleaseToast(node)) node.remove();
          else removeDuplicateScoreToasts(node);
        }
      }
    });
    toastObserver.observe(document.body, { childList: true, subtree: true });

    if (!("serviceWorker" in navigator)) {
      return () => {
        window.removeEventListener("pointerdown", primeNotificationSound);
        window.removeEventListener("touchend", primeNotificationSound);
        window.removeEventListener("click", primeNotificationSound);
        window.removeEventListener("keydown", primeNotificationSound);
        if (audioContext) void audioContext.close().catch(() => undefined);
        toastObserver.disconnect();
      };
    }
    const register = async () => {
      try {
        const registration = await navigator.serviceWorker.register("/sw.js", {
          scope: "/",
          updateViaCache: "none",
        });
        await registration.update().catch(() => undefined);
      } catch {
        // Installation/push support should never prevent the main app from loading.
      }
    };
    if (document.readyState === "complete") void register();
    else window.addEventListener("load", register, { once: true });
    return () => {
      window.removeEventListener("load", register);
      window.removeEventListener("pointerdown", primeNotificationSound);
      window.removeEventListener("touchend", primeNotificationSound);
      window.removeEventListener("click", primeNotificationSound);
      window.removeEventListener("keydown", primeNotificationSound);
      if ("serviceWorker" in navigator) navigator.serviceWorker.removeEventListener("message", handleWorkerMessage);
      if (audioContext) void audioContext.close().catch(() => undefined);
      toastObserver.disconnect();
    };
  }, []);
  return liveUpdateState === "idle" ? null : (
    <div
      className={`student-live-update-v422${liveUpdateState === "updated" ? " is-updated" : ""}`}
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <span className="student-live-update-icon-v422" aria-hidden="true" />
      <span className="student-live-update-copy-v422">
        <strong>{liveUpdateState === "updated" ? "Scores updated" : "Updating latest scores…"}</strong>
        <small>{liveUpdateState === "updated" ? "You’re viewing the latest released data." : "A new release was detected. Refreshing this page automatically."}</small>
      </span>
    </div>
  );
}
