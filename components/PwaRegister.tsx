"use client";

import { useEffect } from "react";

export function PwaRegister() {
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
