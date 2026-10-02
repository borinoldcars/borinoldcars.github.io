/* Service worker : l'app fonctionne hors ligne (carte de membre comprise). */
const CACHE = "boc-v3";
const SHELL = [
  "./",
  "index.html",
  "manifest.webmanifest",
  "app/app.css",
  "app/app.js",
  "app/icons/logo.png",
  "app/icons/favicon.png",
  "app/icons/icon-192.png",
  "app/data/config.json",
  "app/data/events.json",
  "app/data/members.json",
  "app/data/photos.json",
  "app/data/boutique.json",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Réseau d'abord (contenu toujours à jour), cache en secours hors ligne.
self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET" || new URL(req.url).origin !== location.origin) return;
  e.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      })
      .catch(() => caches.match(req, { ignoreSearch: true }).then((r) => r || caches.match("index.html")))
  );
});
