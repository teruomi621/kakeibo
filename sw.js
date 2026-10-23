// Keeps the app shell available offline. Data itself is cached by Firestore.
const VERSION = "kakeibo-v10";
const SHELL = ["./", "index.html", "app.js", "receipt.js", "config.js", "manifest.webmanifest",
  "icons/icon-192.png", "icons/icon-512.png", "icons/apple-touch-icon.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET") return;
  const sameOrigin = url.origin === location.origin;
  const staticCdn = url.hostname === "www.gstatic.com" || url.hostname === "cdn.jsdelivr.net" || url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com";
  if (!sameOrigin && !staticCdn) return; // Firestore and login traffic go straight to the network
  e.respondWith(caches.open(VERSION).then(async (cache) => {
    const hit = await cache.match(e.request, { ignoreSearch: sameOrigin });
    const net = fetch(e.request).then((res) => { if (res.ok || res.type === "opaque") cache.put(e.request, res.clone()); return res; }).catch(() => hit);
    return sameOrigin ? (await net) || hit : hit || net; // app files: fresh first; CDN files: cache first
  }));
});
