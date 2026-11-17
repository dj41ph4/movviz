const CACHE = "movviz-shell-v2";
const SHELL = ["/", "/manifest.json", "/icon.svg",
  "/brand/movviz-mobile-192.png", "/brand/movviz-mobile-512.png", "/brand/movviz-mobile-maskable-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith("movviz-shell-") && k !== CACHE).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

// Network-first for everything — this is a live app, not a static site; the
// cache only exists so the shell still loads if the server is briefly down.
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request).then((r) => r ?? caches.match("/")))
  );
});
