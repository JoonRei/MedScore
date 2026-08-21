"use client";

import { useEffect, useRef, useState } from "react";
import { CloseIcon } from "@/components/icons";

export function ToastNotice({
  message,
  tone = "success",
  onDismiss,
  duration = 3000,
}: {
  message: string;
  tone?: "success" | "error" | "info";
  onDismiss?: () => void;
  duration?: number;
}) {
  const [visible, setVisible] = useState(Boolean(message));
  const dismissRef = useRef(onDismiss);

  useEffect(() => { dismissRef.current = onDismiss; }, [onDismiss]);

  useEffect(() => {
    if (!message) {
      setVisible(false);
      return;
    }
    setVisible(true);
    const timer = window.setTimeout(() => {
      setVisible(false);
      dismissRef.current?.();
    }, duration);
    return () => window.clearTimeout(timer);
  }, [message, duration]);

  if (!message || !visible) return null;

  return (
    <div className={`app-toast is-${tone}`} role={tone === "error" ? "alert" : "status"} aria-live="polite">
      <span>{message}</span>
      <button
        type="button"
        className="app-toast-close"
        onClick={() => {
          setVisible(false);
          dismissRef.current?.();
        }}
        aria-label="Dismiss notification"
      >
        <CloseIcon size={16} />
      </button>
    </div>
  );
}
