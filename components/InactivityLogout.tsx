"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Clock03Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

type Props = {
  role: "admin" | "student";
  timeoutMinutes?: number;
  warningSeconds?: number;
};

export function InactivityLogout({ role, timeoutMinutes = 15, warningSeconds = 60 }: Props) {
  const storageKey = useMemo(() => `medscores_${role}_last_activity`, [role]);
  const timeoutMs = timeoutMinutes * 60_000;
  const warningMs = warningSeconds * 1000;
  const lastWrite = useRef(0);
  const [remaining, setRemaining] = useState<number | null>(null);
  const loggingOut = useRef(false);

  const logout = useCallback(async () => {
    if (loggingOut.current) return;
    loggingOut.current = true;
    localStorage.removeItem(storageKey);
    try {
      await fetch(role === "admin" ? "/api/admin/logout" : "/api/student/logout", { method: "POST", redirect: "manual" });
    } catch {}
    window.location.replace(role === "admin" ? "/admin/login?reason=inactive" : "/?reason=inactive");
  }, [role, storageKey]);

  const markActivity = useCallback((force = false) => {
    const now = Date.now();
    if (!force && now - lastWrite.current < 10_000) return;
    lastWrite.current = now;
    localStorage.setItem(storageKey, String(now));
    if (force) setRemaining(null);
  }, [storageKey]);

  useEffect(() => {
    const saved = Number(localStorage.getItem(storageKey));
    if (!saved || Number.isNaN(saved)) markActivity(true);

    const events: Array<keyof WindowEventMap> = ["pointerdown", "keydown", "touchstart", "scroll"];
    const onActivity = () => markActivity();
    events.forEach((event) => window.addEventListener(event, onActivity, { passive: true }));

    const interval = window.setInterval(() => {
      const last = Number(localStorage.getItem(storageKey)) || Date.now();
      const idle = Date.now() - last;
      const left = timeoutMs - idle;
      if (left <= 0) {
        void logout();
        return;
      }
      setRemaining(left <= warningMs ? Math.ceil(left / 1000) : null);
    }, 1000);

    return () => {
      events.forEach((event) => window.removeEventListener(event, onActivity));
      window.clearInterval(interval);
    };
  }, [logout, markActivity, storageKey, timeoutMs, warningMs]);

  if (remaining == null) return null;

  return (
    <div className="session-warning-backdrop" role="presentation">
      <section className="session-warning" role="dialog" aria-modal="true" aria-labelledby="session-warning-title">
        <div className="session-warning-icon"><HugeiconsIcon icon={Clock03Icon} size={24} strokeWidth={1.7} /></div>
        <div>
          <h2 id="session-warning-title">Still there?</h2>
          <p>For privacy, MedScores will sign you out after {timeoutMinutes} minutes without activity.</p>
        </div>
        <div className="session-countdown">Signing out in <strong>{remaining}s</strong></div>
        <div className="session-actions">
          <button type="button" className="button button-secondary" onClick={() => void logout()}>Sign out now</button>
          <button type="button" className="button button-primary" onClick={() => markActivity(true)}>Stay signed in</button>
        </div>
      </section>
    </div>
  );
}
