"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

export function PwaRegister() {
  const pathname = usePathname();
  const previousPathname = useRef(pathname);

  useEffect(() => {
    // Expose a small route hook for page-specific Student Portal polish without
    // coupling shared components to the Subjects implementation.
    const route = pathname === "/student/subjects"
      ? "subjects"
      : pathname.startsWith("/student/subjects/")
        ? "subject-detail"
        : pathname === "/student/results"
          ? "results"
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
    if (pathname !== "/student/results" && !pathname.startsWith("/student/subjects/")) return;

    // Add one useful navigation action to genuinely empty assessment/result states.
    // This runs after hydration and never rewrites server-rendered copy.
    const enhanceEmptyStates = () => {
      const isResults = pathname === "/student/results";
      const emptySelector = [
        ".student-shell .student-results-empty",
        ".student-shell .empty-state",
        ".student-shell .table-empty",
        ".student-shell .subject-empty-state",
        ".student-shell .subject-empty-card"
      ].join(", ");
      const candidates = Array.from(document.querySelectorAll<HTMLElement>(emptySelector));

      candidates.forEach((empty) => {
        if (empty.querySelector(".student-empty-action-v422")) return;
        const copy = (empty.textContent || "").toLowerCase();
        if (!/(assessment|result|score|nothing|no data|not available)/.test(copy)) return;

        const link = document.createElement("a");
        link.className = "student-empty-action-v422";
        link.href = "/student/subjects";
        link.textContent = isResults ? "Browse subjects" : "Back to subjects";
        empty.appendChild(link);
      });
    };

    let frame = 0;
    frame = window.requestAnimationFrame(enhanceEmptyStates);
    const root = document.querySelector(".student-shell .main-content");
    const observer = root ? new MutationObserver(enhanceEmptyStates) : null;
    if (root && observer) observer.observe(root, { childList: true, subtree: true });

    return () => {
      window.cancelAnimationFrame(frame);
      observer?.disconnect();
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

    const primeNotificationSound = () => {
      const context = ensureAudioContext();
      if (context?.state === "suspended") void context.resume().catch(() => undefined);
    };

    const playNotificationChime = () => {
      if (document.visibilityState !== "visible") return;
      const context = ensureAudioContext();
      if (!context) return;

      const play = () => {
        const now = context.currentTime;
        const master = context.createGain();
        master.gain.setValueAtTime(0.0001, now);
        master.gain.exponentialRampToValueAtTime(0.035, now + 0.018);
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
      if (event.data?.type === "MEDSCORES_NOTIFICATION_SOUND") playNotificationChime();
    };

    // Browsers require an interaction before programmatic audio. Prime the tiny
    // audio context on the student's first normal tap/keypress so later foreground
    // notifications can chime without another prompt.
    window.addEventListener("pointerdown", primeNotificationSound, { once: true, passive: true });
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
      window.removeEventListener("keydown", primeNotificationSound);
      if ("serviceWorker" in navigator) navigator.serviceWorker.removeEventListener("message", handleWorkerMessage);
      if (audioContext) void audioContext.close().catch(() => undefined);
      toastObserver.disconnect();
    };
  }, []);
  return null;
}
