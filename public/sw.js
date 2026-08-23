self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

const medscoresSoundReadyClients = new Set();

self.addEventListener("message", (event) => {
  if (event.data?.type !== "MEDSCORES_SOUND_READY") return;
  const clientId = event.source && "id" in event.source ? event.source.id : null;
  if (clientId) medscoresSoundReadyClients.add(clientId);
});

// MedScores intentionally does not cache protected academic pages or API responses.
// The worker is dedicated to installation and opt-in score release notifications.
self.addEventListener("push", (event) => {
  if (!event.data) return;
  let payload = {};
  try { payload = event.data.json(); } catch { payload = { body: event.data.text() }; }

  const title = payload.title || "MedScores";
  const options = {
    body: payload.body || "A new score is available.",
    icon: "/logo.png",
    badge: "/logo.png",
    data: {
      url: payload.url || "/student/notifications",
      assessmentId: payload.assessmentId || null,
      releasedAt: payload.releasedAt || null,
    },
    tag: payload.tag || (payload.assessmentId ? `medscores-result-${payload.assessmentId}` : "medscores-notification"),
    renotify: true,
    requireInteraction: false,
    silent: false,
    timestamp: Date.now(),
  };

  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    const visibleWindows = windows.filter((client) => client.visibilityState === "visible");

    // A service worker may be restarted between notifications, so its in-memory
    // sound-ready set can be empty even though a visible page still has an unlocked
    // AudioContext. Probe the visible page briefly before deciding which sound path
    // to use. If it does not confirm readiness, keep the normal OS alert sound.
    for (const client of visibleWindows) client.postMessage({ type: "MEDSCORES_SOUND_PROBE" });
    if (visibleWindows.length) await new Promise((resolve) => setTimeout(resolve, 90));
    const readyVisibleWindows = visibleWindows.filter((client) => medscoresSoundReadyClients.has(client.id));
    const soundClient = readyVisibleWindows.find((client) => client.focused) || readyVisibleWindows[0] || null;

    // Tell every open Student Portal window that fresh score data is available.
    // The page refreshes its server data in place and shows a compact updating state.
    for (const client of windows) {
      client.postMessage({
        type: "MEDSCORES_SCORE_RELEASED",
        assessmentId: payload.assessmentId || null,
        releasedAt: payload.releasedAt || null,
      });
    }

    // Custom Web Notification sounds are not supported. Only silence the OS alert
    // after a visible page explicitly confirms that Web Audio was unlocked by a
    // user gesture. Otherwise retain the device/browser notification sound.
    options.silent = Boolean(soundClient);
    await self.registration.showNotification(title, options);
    if (soundClient) soundClient.postMessage({ type: "MEDSCORES_NOTIFICATION_SOUND" });

    // Keep the installed PWA badge useful when the platform supports it.
    if (self.navigator && "setAppBadge" in self.navigator) {
      try { await self.navigator.setAppBadge(); } catch { /* optional platform feature */ }
    }
  })());
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || "/student/notifications", self.location.origin).href;
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const client of windows) {
      if ("focus" in client) {
        if ("navigate" in client) await client.navigate(target).catch(() => undefined);
        return client.focus();
      }
    }
    return self.clients.openWindow ? self.clients.openWindow(target) : undefined;
  })());
});
