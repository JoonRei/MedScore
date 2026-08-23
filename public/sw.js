self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

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
    const soundClient = visibleWindows.find((client) => client.focused) || visibleWindows[0];

    // The Web Notifications API has no custom sound option. If MedScores is open,
    // silence the system alert and ask one visible page to play our gentle chime.
    // If it is backgrounded or closed, keep the normal OS/browser notification sound.
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
