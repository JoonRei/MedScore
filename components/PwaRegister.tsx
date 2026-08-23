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
  const studentSyncSignature = useRef("");
  const studentSyncAssessmentIds = useRef<string[]>([]);
  const studentSyncScoreAssessmentIds = useRef<string[]>([]);
  const studentSyncSubjectIds = useRef<string[]>([]);
  const studentSyncSubjectsReady = useRef(false);
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

    const media = window.matchMedia("(max-width: 900px)");
    let resizeObserver: ResizeObserver | null = null;
    let frame = 0;

    const updateBottomNavClearance = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        if (!media.matches) {
          document.documentElement.style.removeProperty("--student-mobile-nav-clearance");
          return;
        }

        const nav = document.querySelector<HTMLElement>(".student-shell .sidebar");
        if (!nav) return;
        const rect = nav.getBoundingClientRect();
        const visualHeight = window.visualViewport?.height || window.innerHeight;
        const renderedOverlap = Math.max(rect.height, visualHeight - Math.max(0, rect.top));
        const clearance = Math.ceil(renderedOverlap + 14);
        document.documentElement.style.setProperty("--student-mobile-nav-clearance", `${clearance}px`);
      });
    };

    const attachObserver = () => {
      resizeObserver?.disconnect();
      const nav = document.querySelector<HTMLElement>(".student-shell .sidebar");
      if (nav && "ResizeObserver" in window) {
        resizeObserver = new ResizeObserver(updateBottomNavClearance);
        resizeObserver.observe(nav);
      }
      updateBottomNavClearance();
    };

    attachObserver();
    const settle = window.setTimeout(attachObserver, 120);
    media.addEventListener?.("change", updateBottomNavClearance);
    window.addEventListener("resize", updateBottomNavClearance, { passive: true });
    window.addEventListener("orientationchange", updateBottomNavClearance, { passive: true });
    window.visualViewport?.addEventListener("resize", updateBottomNavClearance, { passive: true });
    window.visualViewport?.addEventListener("scroll", updateBottomNavClearance, { passive: true });

    return () => {
      window.clearTimeout(settle);
      window.cancelAnimationFrame(frame);
      resizeObserver?.disconnect();
      media.removeEventListener?.("change", updateBottomNavClearance);
      window.removeEventListener("resize", updateBottomNavClearance);
      window.removeEventListener("orientationchange", updateBottomNavClearance);
      window.visualViewport?.removeEventListener("resize", updateBottomNavClearance);
      window.visualViewport?.removeEventListener("scroll", updateBottomNavClearance);
      document.documentElement.style.removeProperty("--student-mobile-nav-clearance");
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
    if (!pathname.startsWith("/student")) return;

    let cancelled = false;
    let activeRefresh = false;
    let recoveryScheduled = false;
    let refreshTimer = 0;
    let settleTimer = 0;
    let retryTimer = 0;
    let hideTimer = 0;
    let hardStopTimer = 0;
    let pollTimer = 0;
    let syncBusy = false;
    const pendingRefreshKey = "medscores:pending-student-live-refresh";

    const clearRefreshTimers = () => {
      window.clearTimeout(refreshTimer);
      window.clearTimeout(settleTimer);
      window.clearTimeout(retryTimer);
      window.clearTimeout(hideTimer);
      window.clearTimeout(hardStopTimer);
    };

    type StudentSyncSnapshot = {
      signature: string;
      assessmentIds: string[];
      scoreAssessmentIds: string[];
    };

    const emptySyncSnapshot = (): StudentSyncSnapshot => ({
      signature: "",
      assessmentIds: [],
      scoreAssessmentIds: [],
    });

    const readSyncSignature = async (): Promise<StudentSyncSnapshot> => {
      try {
        const response = await fetch("/api/student/sync", {
          cache: "no-store",
          credentials: "same-origin",
        });
        if (!response.ok) return emptySyncSnapshot();
        const body = await response.json().catch(() => ({})) as {
          signature?: string;
          assessmentIds?: string[];
          scoreAssessmentIds?: string[];
        };
        return {
          signature: String(body.signature || ""),
          assessmentIds: Array.isArray(body.assessmentIds) ? body.assessmentIds.map(String) : [],
          scoreAssessmentIds: Array.isArray(body.scoreAssessmentIds) ? body.scoreAssessmentIds.map(String) : [],
        };
      } catch {
        return emptySyncSnapshot();
      }
    };

    const snapshotHasDeletion = (next: StudentSyncSnapshot) => {
      const nextAssessments = new Set(next.assessmentIds);
      const nextScores = new Set(next.scoreAssessmentIds);
      return studentSyncAssessmentIds.current.some((id) => !nextAssessments.has(id))
        || studentSyncScoreAssessmentIds.current.some((id) => !nextScores.has(id));
    };

    // Read the real server-rendered Subjects list instead of coupling live sync to
    // a particular assignment-table schema. This makes per-student subject
    // unassignment detectable even when existing scores for that subject remain.
    const readAssignedSubjectIds = async (): Promise<string[] | null> => {
      try {
        const response = await fetch(`/student/subjects?_medscores_sync=${Date.now()}`, {
          cache: "no-store",
          credentials: "same-origin",
          headers: { Accept: "text/html" },
        });
        if (!response.ok || response.redirected) return null;

        const html = await response.text();
        const page = new DOMParser().parseFromString(html, "text/html");
        const links = Array.from(page.querySelectorAll<HTMLAnchorElement>(
          'a.subject-card[href*="/student/subjects/"], .subject-list a[href*="/student/subjects/"]'
        ));
        const looksLikeSubjectsPage = Boolean(page.querySelector(".subject-list"))
          || links.length > 0
          || /select a subject|your subjects|subjects/i.test((page.body.textContent || "").slice(0, 4000));
        if (!looksLikeSubjectsPage) return null;

        const ids = links
          .map((link) => {
            try {
              const url = new URL(link.getAttribute("href") || "", window.location.origin);
              const match = url.pathname.match(/^\/student\/subjects\/([^/]+)\/?$/);
              return match ? decodeURIComponent(match[1]) : "";
            } catch {
              return "";
            }
          })
          .filter(Boolean);
        return Array.from(new Set(ids)).sort();
      } catch {
        return null;
      }
    };

    const rememberAssignedSubjects = (ids: string[]) => {
      studentSyncSubjectIds.current = ids;
      studentSyncSubjectsReady.current = true;
    };

    const compareAssignedSubjects = (nextIds: string[] | null) => {
      if (!nextIds) return { changed: false, removedCurrent: false };
      if (!studentSyncSubjectsReady.current) {
        rememberAssignedSubjects(nextIds);
        return { changed: false, removedCurrent: false };
      }

      const previous = studentSyncSubjectIds.current;
      const previousSet = new Set(previous);
      const nextSet = new Set(nextIds);
      const changed = previous.length !== nextIds.length
        || previous.some((id) => !nextSet.has(id))
        || nextIds.some((id) => !previousSet.has(id));
      const currentSubjectMatch = pathname.match(/^\/student\/subjects\/([^/?#]+)/);
      const currentSubjectId = currentSubjectMatch ? decodeURIComponent(currentSubjectMatch[1]) : "";
      const removedCurrent = Boolean(currentSubjectId && previousSet.has(currentSubjectId) && !nextSet.has(currentSubjectId));

      if (changed) rememberAssignedSubjects(nextIds);
      return { changed, removedCurrent };
    };

    const rememberSyncSnapshot = (snapshot: StudentSyncSnapshot) => {
      studentSyncSignature.current = snapshot.signature;
      studentSyncAssessmentIds.current = snapshot.assessmentIds;
      studentSyncScoreAssessmentIds.current = snapshot.scoreAssessmentIds;
    };

    const endRefresh = (showUpdated = true) => {
      if (cancelled) return;
      activeRefresh = false;
      interruptionRecoveryAttempts.current = 0;
      recoveryScheduled = false;
      if (!showUpdated) {
        setLiveUpdateState("idle");
        delete document.body.dataset.studentLiveRefresh;
        return;
      }
      setLiveUpdateState("updated");
      window.dispatchEvent(new CustomEvent("medscores:portal-updated"));
      hideTimer = window.setTimeout(() => {
        if (cancelled) return;
        setLiveUpdateState("idle");
        delete document.body.dataset.studentLiveRefresh;
      }, 520);
    };

    const temporaryProblem = () => {
      const problems = Array.from(document.querySelectorAll<HTMLElement>(
        ".app-problem, .app-problem-page, [class*='app-problem']"
      ));
      return problems.find((problem) => {
        const text = (problem.textContent || "").replace(/\s+/g, " ").trim();
        return /temporary interruption/i.test(text);
      }) || null;
    };

    const recoverReleaseInterruption = () => {
      if (!activeRefresh || cancelled || !navigator.onLine || recoveryScheduled) return;
      const problem = temporaryProblem();
      if (!problem) return;

      if (interruptionRecoveryAttempts.current >= 4) {
        // If repeated retries cannot recover, reveal the genuine error state rather
        // than hiding it forever. Normal release-time races should recover earlier.
        endRefresh(false);
        return;
      }

      interruptionRecoveryAttempts.current += 1;
      recoveryScheduled = true;
      const retryButton = Array.from(problem.querySelectorAll<HTMLButtonElement>("button"))
        .find((button) => /try again|retry/i.test((button.textContent || "").trim()));

      window.clearTimeout(retryTimer);
      retryTimer = window.setTimeout(() => {
        recoveryScheduled = false;
        if (cancelled || !activeRefresh) return;
        if (retryButton) retryButton.click();
        else router.refresh();
        settleTimer = window.setTimeout(() => {
          if (cancelled || !activeRefresh) return;
          if (temporaryProblem()) recoverReleaseInterruption();
          else endRefresh(true);
        }, 1350);
      }, 320);
    };

    const startPortalRefresh = (nextSnapshot?: StudentSyncSnapshot, forceReload = false, reloadPath = "") => {
      if (cancelled || activeRefresh) return;
      clearRefreshTimers();
      activeRefresh = true;
      recoveryScheduled = false;
      interruptionRecoveryAttempts.current = 0;
      if (nextSnapshot?.signature) rememberSyncSnapshot(nextSnapshot);
      document.body.dataset.studentLiveRefresh = "true";
      setLiveUpdateState("refreshing");

      // Deletions need a clean document reload because client-owned widgets such as
      // the Leaderboard can otherwise keep a now-deleted assessment in local state.
      // Releases/edits still use the lighter RSC refresh.
      refreshTimer = window.setTimeout(() => {
        if (cancelled || !activeRefresh) return;
        if (forceReload) {
          if (reloadPath) window.location.replace(reloadPath);
          else window.location.reload();
          return;
        }
        router.refresh();

        // Keep the protective overlay alive long enough to catch a late error
        // boundary. The old implementation ended too early and exposed the generic
        // interruption screen even though retrying immediately succeeded.
        settleTimer = window.setTimeout(() => {
          if (cancelled || !activeRefresh) return;
          if (temporaryProblem()) recoverReleaseInterruption();
          else endRefresh(true);
        }, 2200);
      }, 260);

      hardStopTimer = window.setTimeout(() => {
        if (cancelled || !activeRefresh) return;
        if (temporaryProblem()) recoverReleaseInterruption();
        else endRefresh(true);
      }, 10000);
    };

    const waitForStableSignature = async (firstSnapshot: StudentSyncSnapshot) => {
      let candidate = firstSnapshot;
      for (let attempt = 0; attempt < 5; attempt += 1) {
        await new Promise((resolve) => window.setTimeout(resolve, 420));
        if (cancelled || activeRefresh) return candidate;
        const next = await readSyncSignature();
        if (!next.signature) return candidate;
        if (next.signature === candidate.signature) return next;
        candidate = next;
      }
      return candidate;
    };

    const checkForServerChanges = async (source: "poll" | "push" | "focus" = "poll") => {
      if (cancelled || syncBusy || activeRefresh || document.visibilityState !== "visible" || !navigator.onLine) return;
      syncBusy = true;
      try {
        // Subject access can change independently of assessments/scores. Compare
        // against the actual Subjects page so a per-student unassignment is
        // detected regardless of how the database models that assignment.
        const assignedSubjectIds = await readAssignedSubjectIds();
        const subjectChange = compareAssignedSubjects(assignedSubjectIds);
        if (subjectChange.changed) {
          const snapshot = await readSyncSignature();
          if (snapshot.signature) rememberSyncSnapshot(snapshot);
          startPortalRefresh(
            snapshot.signature ? snapshot : undefined,
            true,
            subjectChange.removedCurrent ? "/student/subjects" : "",
          );
          return;
        }

        const attempts = source === "push" ? 8 : 1;
        for (let attempt = 0; attempt < attempts; attempt += 1) {
          if (cancelled || activeRefresh) return;
          const snapshot = await readSyncSignature();
          if (!snapshot.signature) return;

          if (!studentSyncSignature.current) {
            rememberSyncSnapshot(snapshot);
            if (source === "push") {
              const stableSnapshot = await waitForStableSignature(snapshot);
              if (!cancelled && !activeRefresh) startPortalRefresh(stableSnapshot);
            }
            return;
          } else if (snapshot.signature !== studentSyncSignature.current) {
            const deletionDetected = snapshotHasDeletion(snapshot);
            const stableSnapshot = await waitForStableSignature(snapshot);
            const stableDeletion = deletionDetected || snapshotHasDeletion(stableSnapshot);
            if (!cancelled && !activeRefresh) startPortalRefresh(stableSnapshot, stableDeletion);
            return;
          }

          if (source === "push" && attempt < attempts - 1) {
            await new Promise((resolve) => window.setTimeout(resolve, 320));
          }
        }
      } finally {
        syncBusy = false;
      }
    };

    const handleStudentChange = (event: MessageEvent) => {
      if (event.data?.type !== "MEDSCORES_SCORE_RELEASED" && event.data?.type !== "MEDSCORES_STUDENT_DATA_CHANGED") return;
      if (document.visibilityState !== "visible") {
        window.sessionStorage.setItem(pendingRefreshKey, "1");
        return;
      }
      void checkForServerChanges("push");
    };

    const handleVisibility = () => {
      if (document.visibilityState !== "visible") return;
      if (window.sessionStorage.getItem(pendingRefreshKey) === "1") {
        window.sessionStorage.removeItem(pendingRefreshKey);
        void checkForServerChanges("push");
      } else {
        void checkForServerChanges("focus");
      }
    };

    const observer = new MutationObserver(() => {
      if (activeRefresh && temporaryProblem()) recoverReleaseInterruption();
    });
    observer.observe(document.body, { childList: true, subtree: true });

    if ("serviceWorker" in navigator) navigator.serviceWorker.addEventListener("message", handleStudentChange);
    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("online", handleVisibility);
    window.addEventListener("pageshow", handleVisibility);

    // Establish a baseline, then use lightweight checks while the Student Portal
    // is visible. This catches released/deleted assessments and scores plus
    // per-student subject assignment changes without manual refreshes.
    void checkForServerChanges("focus");
    pollTimer = window.setInterval(() => void checkForServerChanges("poll"), 8000);

    if (window.sessionStorage.getItem(pendingRefreshKey) === "1" && document.visibilityState === "visible") {
      window.sessionStorage.removeItem(pendingRefreshKey);
      void checkForServerChanges("push");
    }

    return () => {
      cancelled = true;
      clearRefreshTimers();
      window.clearInterval(pollTimer);
      observer.disconnect();
      if ("serviceWorker" in navigator) navigator.serviceWorker.removeEventListener("message", handleStudentChange);
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("online", handleVisibility);
      window.removeEventListener("pageshow", handleVisibility);
      delete document.body.dataset.studentLiveRefresh;
    };
  }, [pathname, router]);

  useEffect(() => {
    if (pathname !== "/student/results") return;

    let cancelled = false;
    let unreadItems: Array<{ id: string; title: string; subject: string; type: string }> = [];
    const viewedIds = new Set<string>();

    const normalize = (value: string) => value.toLowerCase().replace(/\s+/g, " ").trim();

    const updateVisibleNewCount = () => {
      const remaining = document.querySelectorAll(".student-shell .new-result-badge").length;
      document.querySelectorAll<HTMLElement>(
        ".student-results-summary > div, .student-v2-results-summary > div, .student-metric"
      ).forEach((metric) => {
        const label = metric.querySelector<HTMLElement>("span");
        const value = metric.querySelector<HTMLElement>("strong");
        if (!label || !value || !/new results?/i.test((label.textContent || "").trim())) return;
        value.textContent = String(remaining);
        const detail = metric.querySelector<HTMLElement>("small");
        if (detail) detail.textContent = remaining ? "not yet opened" : "all caught up";
      });
    };

    const markViewed = async (assessmentId: string, card?: HTMLElement | null) => {
      const id = assessmentId.trim();
      if (!id || viewedIds.has(id)) return;
      viewedIds.add(id);
      try {
        const response = await fetch(`/api/student/results/${encodeURIComponent(id)}/view`, {
          method: "POST",
          credentials: "same-origin",
        });
        if (!response.ok) {
          viewedIds.delete(id);
          return;
        }
        if (cancelled) return;
        card?.querySelector(".new-result-badge")?.remove();
        unreadItems = unreadItems.filter((item) => item.id !== id);
        updateVisibleNewCount();
        window.dispatchEvent(new CustomEvent("medscores:result-viewed", { detail: { assessmentId: id } }));
        viewedIds.delete(id);
        // Refresh the current RSC tree only after the persisted view row succeeds.
        // The endpoint also revalidates Home/Results/Notifications, so navigating
        // away cannot resurrect a stale New badge or New-results count.
        router.refresh();
      } catch {
        viewedIds.delete(id);
      }
    };

    const mapUnreadCards = () => {
      const cards = Array.from(document.querySelectorAll<HTMLElement>(".student-result-card-button"));
      const assignedIds = new Set(cards.map((card) => card.dataset.assessmentId || "").filter(Boolean));
      for (const card of cards) {
        if (card.dataset.assessmentId) continue;
        const title = normalize(card.querySelector<HTMLElement>("h3")?.textContent || "");
        const meta = Array.from(card.querySelectorAll<HTMLElement>(".student-result-card-meta span"))
          .map((node) => normalize(node.textContent || ""));
        if (!title) continue;

        let match = unreadItems.find((item) => !assignedIds.has(item.id)
          && normalize(item.title) === title
          && meta.includes(normalize(item.subject)));
        if (!match) {
          const sameTitle = unreadItems.filter((item) => !assignedIds.has(item.id) && normalize(item.title) === title);
          if (sameTitle.length === 1) match = sameTitle[0];
        }
        if (match) {
          card.dataset.assessmentId = match.id;
          assignedIds.add(match.id);
        }
      }
    };

    const loadUnreadItems = async () => {
      try {
        const response = await fetch("/api/student/results/unread", {
          cache: "no-store",
          credentials: "same-origin",
        });
        if (!response.ok) return;
        const body = await response.json().catch(() => ({})) as {
          items?: Array<{ id?: string; title?: string; subject?: string; type?: string }>;
        };
        if (cancelled) return;
        unreadItems = (body.items || []).map((item) => ({
          id: String(item.id || ""),
          title: String(item.title || ""),
          subject: String(item.subject || ""),
          type: String(item.type || ""),
        })).filter((item) => item.id);
        mapUnreadCards();
      } catch {
        // Viewing a result must never be blocked by read-state bookkeeping.
      }
    };

    const markFromLocation = () => {
      const id = new URLSearchParams(window.location.search).get("assessment");
      if (id) void markViewed(id, document.querySelector<HTMLElement>(`.student-result-card-button[data-assessment-id="${CSS.escape(id)}"]`));
    };

    const handleResultClick = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      const card = target?.closest<HTMLElement>(".student-result-card-button");
      if (card?.dataset.assessmentId) void markViewed(card.dataset.assessmentId, card);

      const anchor = target?.closest<HTMLAnchorElement>('a[href*="assessment="]');
      if (anchor) {
        try {
          const id = new URL(anchor.href, window.location.href).searchParams.get("assessment");
          if (id) void markViewed(id, card);
        } catch { /* ignore malformed href */ }
      }
    };

    const observer = new MutationObserver(mapUnreadCards);
    observer.observe(document.body, { childList: true, subtree: true });
    document.addEventListener("click", handleResultClick, true);
    window.addEventListener("popstate", markFromLocation);
    window.addEventListener("medscores:portal-updated", loadUnreadItems);

    void loadUnreadItems().then(markFromLocation);

    return () => {
      cancelled = true;
      observer.disconnect();
      document.removeEventListener("click", handleResultClick, true);
      window.removeEventListener("popstate", markFromLocation);
      window.removeEventListener("medscores:portal-updated", loadUnreadItems);
    };
  }, [pathname, router]);

  useEffect(() => {
    // Browsers cannot attach a custom sound to a Web Push notification itself. For
    // a visible MedScores page, use one real preloaded chime asset. The service
    // worker waits for playback confirmation before silencing the OS alert, so a
    // blocked custom sound always falls back to the device/browser sound.
    const chime = new Audio("/notification-soft.wav");
    chime.preload = "auto";
    chime.volume = 0.5;
    let soundUnlocked = false;
    let primeTimer = 0;

    const postToServiceWorker = async (message: unknown) => {
      if (!("serviceWorker" in navigator)) return;
      if (navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage(message);
        return;
      }
      const registration = await navigator.serviceWorker.ready.catch(() => null);
      registration?.active?.postMessage(message);
    };

    const primeNotificationSound = () => {
      if (soundUnlocked) return;
      const previousVolume = chime.volume;
      chime.volume = 0.001;
      chime.currentTime = 0;
      void chime.play().then(() => {
        soundUnlocked = true;
        window.clearTimeout(primeTimer);
        primeTimer = window.setTimeout(() => {
          chime.pause();
          chime.currentTime = 0;
          chime.volume = previousVolume;
        }, 45);
      }).catch(() => {
        chime.volume = previousVolume;
        soundUnlocked = false;
      });
    };

    const playNotificationChime = async () => {
      if (document.visibilityState !== "visible" || !soundUnlocked) return false;
      try {
        chime.pause();
        chime.currentTime = 0;
        chime.volume = 0.5;
        await chime.play();
        return true;
      } catch {
        soundUnlocked = false;
        return false;
      }
    };

    const handleWorkerMessage = (event: MessageEvent) => {
      if (event.data?.type !== "MEDSCORES_PLAY_NOTIFICATION_SOUND") return;
      const token = typeof event.data?.token === "string" ? event.data.token : "";
      if (!token) return;
      void playNotificationChime().then((played) => {
        void postToServiceWorker({
          type: "MEDSCORES_SOUND_PLAYBACK_RESULT",
          token,
          played,
        });
      });
    };

    // A normal student interaction unlocks mobile audio for later foreground pushes.
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
        window.clearTimeout(primeTimer);
        chime.pause();
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
      window.clearTimeout(primeTimer);
      chime.pause();
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
      <div className="student-live-update-center-v422">
        <span className="student-live-update-mark-v422" aria-hidden="true" />
        <strong>{liveUpdateState === "updated" ? "Portal updated" : "Syncing your portal"}</strong>
        <small>{liveUpdateState === "updated" ? "Everything now reflects the latest changes." : "Applying the newest assessment and score changes."}</small>
        <span className="student-live-update-streak-v422" aria-hidden="true"><i /></span>
      </div>
    </div>
  );
}
