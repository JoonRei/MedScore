self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

const medscoresSoundPlaybackWaiters = new Map();

self.addEventListener("message", (event) => {
  if (event.data?.type !== "MEDSCORES_SOUND_PLAYBACK_RESULT") return;
  const token = typeof event.data?.token === "string" ? event.data.token : "";
  const resolve = token ? medscoresSoundPlaybackWaiters.get(token) : null;
  if (!resolve) return;
  medscoresSoundPlaybackWaiters.delete(token);
  resolve(Boolean(event.data?.played));
});

async function requestForegroundChime(visibleWindows) {
  if (!visibleWindows.length) return false;
  const soundClient = visibleWindows.find((client) => client.focused) || visibleWindows[0];
  if (!soundClient) return false;

  const token = `medscores-sound-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const result = new Promise((resolve) => {
    medscoresSoundPlaybackWaiters.set(token, resolve);
    setTimeout(() => {
      const pending = medscoresSoundPlaybackWaiters.get(token);
      if (!pending) return;
      medscoresSoundPlaybackWaiters.delete(token);
      resolve(false);
    }, 450);
  });

  soundClient.postMessage({ type: "MEDSCORES_PLAY_NOTIFICATION_SOUND", token });
  return result;
}

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

    // Tell every open Student Portal window that fresh score data is available.
    // The page refreshes its server data behind a dedicated loading overlay.
    for (const client of windows) {
      client.postMessage({
        type: "MEDSCORES_SCORE_RELEASED",
        assessmentId: payload.assessmentId || null,
        releasedAt: payload.releasedAt || null,
      });
    }

    // Web Push cannot specify a custom OS notification sound. If MedScores is
    // visibly open, ask the page to play the real bundled chime first. Silence the
    // OS alert only after playback actually starts; otherwise keep normal device sound.
    const customSoundPlayed = await requestForegroundChime(visibleWindows);
    options.silent = customSoundPlayed;
    await self.registration.showNotification(title, options);

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
