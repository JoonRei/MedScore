"use client";

import { useEffect, useState } from "react";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

type PwaInstallProps = {
  compact?: boolean;
  mode?: "default" | "student-card";
};

export function PwaInstall({ compact = false, mode = "default" }: PwaInstallProps = {}) {
  const [promptEvent, setPromptEvent] = useState<InstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [isIos, setIsIos] = useState(false);

  useEffect(() => {
    const standalone = window.matchMedia("(display-mode: standalone)").matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
    setInstalled(standalone);
    setIsIos(/iphone|ipad|ipod/i.test(navigator.userAgent));

    const onPrompt = (event: Event) => {
      event.preventDefault();
      setPromptEvent(event as InstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setPromptEvent(null);
    };

    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  async function install() {
    if (!promptEvent) return;
    await promptEvent.prompt();
    const choice = await promptEvent.userChoice;
    if (choice.outcome === "accepted") setInstalled(true);
    setPromptEvent(null);
  }

  const description = installed
    ? "MedScores is already installed on this device."
    : isIos
      ? "Use Safari Share → Add to Home Screen."
      : "Install MedScores for quick app-like access.";

  const studentAction = installed
    ? <span className="student-setting-status-v419 is-active">Installed</span>
    : promptEvent
      ? <button type="button" className="button button-secondary button-sm" onClick={() => void install()}>Install app</button>
      : <span className="student-setting-status-v419">{isIos ? "Safari" : "Available when supported"}</span>;

  const defaultAction = installed
    ? "Installed"
    : promptEvent
      ? <button type="button" className="button button-secondary button-sm" onClick={() => void install()}>Install app</button>
      : isIos ? "Safari" : "Available when supported";

  if (mode === "student-card") {
    return (
      <div className="student-install-card-v419">
        <div className="student-setting-card-head-v419">
          <div>
            <span className="student-setting-eyebrow-v419">App</span>
            <h2>Install MedScores</h2>
            <p>{description}</p>
          </div>
        </div>
        <div className="student-install-action-v419">{studentAction}</div>
      </div>
    );
  }

  return (
    <div className={`${compact ? "student-settings-row" : "settings-row"} pwa-settings-row`}>
      <div><h3>Install MedScores</h3><p>{description}</p></div>
      <div className="settings-value pwa-settings-action">{defaultAction}</div>
    </div>
  );
}
