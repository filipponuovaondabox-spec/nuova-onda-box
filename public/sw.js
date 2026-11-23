/* Nuova Onda Box — Service Worker (PWA)
 * Strategia:
 *  - Navigazioni/HTML: NETWORK-FIRST (sempre la pagina fresca; cache solo offline)
 *  - /api/*: MAI in cache, sempre rete diretta
 *  - Asset statici (JS/CSS/icone): cache-first con cache versionata
 * La cache è versionata (nuova-onda-v2): a ogni deploy si incrementa la
 * versione e le cache vecchie vengono eliminate in activate.
 * skipWaiting() + clients.claim() fanno sì che il nuovo SW prenda il
 * controllo subito, senza pulizia manuale della cache.
 */
const CACHE_VERSION = "nuova-onda-v2";
const SHELL = ["/", "/manifest.webmanifest", "/icons/icon.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_VERSION)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

// La pagina può chiedere l'attivazione immediata del nuovo SW
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // API: MAI dalla cache, sempre rete diretta (niente respondWith custom)
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(fetch(event.request));
    return;
  }

  if (event.request.method !== "GET") return;

  // Navigazioni / HTML: network-first, fallback alla shell solo se offline
  if (event.request.mode === "navigate" || event.request.destination === "document") {
    event.respondWith(
      fetch(event.request)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE_VERSION).then((c) => c.put("/", copy));
          }
          return res;
        })
        .catch(() =>
          caches.match(event.request).then((r) => r || caches.match("/")).then((r) => r || Response.error())
        )
    );
    return;
  }

  // Asset statici (chunk JS/CSS, icone, manifest): cache-first
  event.respondWith(
    caches.match(event.request).then(
      (cached) =>
        cached ||
        fetch(event.request).then((res) => {
          if (res.ok && url.origin === self.location.origin) {
            const copy = res.clone();
            caches.open(CACHE_VERSION).then((c) => c.put(event.request, copy));
          }
          return res;
        })
    )
  );
});
