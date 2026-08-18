self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
// MedScores intentionally does not cache protected academic pages or API responses.
// The service worker exists only to support app installation without creating stale private data.
