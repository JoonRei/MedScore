"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";

type Options = {
  minWidth?: number;
  preferredWidth?: number;
  gap?: number;
  viewportPadding?: number;
  mobileBreakpoint?: number;
  mobileSheet?: boolean;
};

export function useFloatingPopover(open: boolean, options: Options = {}) {
  const triggerRef = useRef<HTMLElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const [style, setStyle] = useState<CSSProperties>({ visibility: "hidden" });

  const update = useCallback(() => {
    if (!open || typeof window === "undefined" || !triggerRef.current) return;
    const gap = options.gap ?? 8;
    const pad = options.viewportPadding ?? 12;
    const mobileBreakpoint = options.mobileBreakpoint ?? 600;
    const rect = triggerRef.current.getBoundingClientRect();

    if (options.mobileSheet && window.innerWidth <= mobileBreakpoint) {
      setStyle({
        position: "fixed",
        left: pad,
        right: pad,
        bottom: pad,
        width: "auto",
        maxHeight: `calc(100dvh - ${pad * 2}px)`,
        visibility: "visible",
      });
      return;
    }

    const desired = options.preferredWidth ?? rect.width;
    const minWidth = options.minWidth ?? rect.width;
    const width = Math.min(Math.max(desired, minWidth), window.innerWidth - pad * 2);
    const measuredHeight = popoverRef.current?.getBoundingClientRect().height || 320;

    let left = rect.left;
    if (left + width > window.innerWidth - pad) left = window.innerWidth - pad - width;
    if (left < pad) left = pad;

    const roomBelow = window.innerHeight - rect.bottom - pad;
    const roomAbove = rect.top - pad;
    let top: number;
    if (roomBelow >= Math.min(measuredHeight, 320) || roomBelow >= roomAbove) {
      top = Math.min(rect.bottom + gap, window.innerHeight - pad - measuredHeight);
    } else {
      top = Math.max(pad, rect.top - gap - measuredHeight);
    }

    setStyle({
      position: "fixed",
      left,
      top: Math.max(pad, top),
      width,
      maxHeight: `calc(100dvh - ${pad * 2}px)`,
      visibility: "visible",
    });
  }, [open, options.gap, options.minWidth, options.mobileBreakpoint, options.mobileSheet, options.preferredWidth, options.viewportPadding]);

  useLayoutEffect(() => {
    if (!open) return;
    update();
    const frame = requestAnimationFrame(update);
    return () => cancelAnimationFrame(frame);
  }, [open, update]);

  useEffect(() => {
    if (!open) return;
    const updatePosition = () => update();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open, update]);

  return { triggerRef, popoverRef, style, update };
}
