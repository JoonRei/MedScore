self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

// MedScores intentionally does not cache protected academic pages or API responses.
// The service worker supports installation and opt-in result notifications only.
self.addEventListener("push", (event) => {
  if (!event.data) return;
  let payload = {};
  try { payload = event.data.json(); } catch { payload = { body: event.data.text() }; }
  const title = payload.title || "MedScores notification";
  const options = {
    body: payload.body || "A new result is available.",
    icon: "/logo.png",
    data: { url: payload.url || "/student/notifications", assessmentId: payload.assessmentId || null },
    tag: payload.assessmentId ? `medscores-result-${payload.assessmentId}` : "medscores-result",
    renotify: true,
  };
  event.waitUntil(self.registration.showNotification(title, options));
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
