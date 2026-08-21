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
        : "";

    if (route) document.body.dataset.studentRoute = route;
    else delete document.body.dataset.studentRoute;

    return () => {
      if (document.body.dataset.studentRoute === route) delete document.body.dataset.studentRoute;
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
      return () => toastObserver.disconnect();
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
      toastObserver.disconnect();
    };
  }, []);
  return null;
}
