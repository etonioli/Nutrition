// Service worker for the Nutrition Quick Reference PWA.
// Packaging-only addition — see index.html's top comment for lineage notes.
//
// Strategy split, added 2026-07-30 after this app started iterating fast:
// pure cache-first (the original approach) meant every push sat invisible
// behind a never-expiring cache until someone manually cleared site data —
// confirmed happening on both the local dev server and the live GitHub
// Pages deploy. Fix: HTML/manifest go network-first (always fresh when
// online, falling back to cache only when offline); the icons stay
// cache-first since they never change and aren't worth a network round
// trip. Offline capability is unchanged — everything still has a cache
// fallback — this only removes the "stuck on an old version" failure mode.
//
// PLAN.md Task 12 / ANALYSIS.md §5.2-5.3: './' (the bare scope URL the
// installed PWA's start_url resolves to) is now precached alongside
// index.html -- previously only index.html was, so an install followed by
// an immediately-offline first launch could fail to load. RULE: bump
// CACHE_NAME on every content change to index.html/manifest.json/icons, even
// though the network-first strategy above makes forgetting much less
// damaging than it was pre-v2 -- there is no automated enforcement of this,
// it is a manual discipline.

var CACHE_NAME = 'nutrition-pwa-v3';
var PRECACHE_URLS = [
  './',
  'index.html',
  'manifest.json',
  'icons/icon-192.png',
  'icons/icon-512.png'
];
var NETWORK_FIRST_PATHS = ['index.html', 'manifest.json'];

function isNetworkFirst(url) {
  return NETWORK_FIRST_PATHS.some(function (path) { return url.indexOf(path) !== -1; });
}

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(function (cache) { return cache.addAll(PRECACHE_URLS); })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys()
      .then(function (names) {
        return Promise.all(
          names
            .filter(function (name) { return name !== CACHE_NAME; })
            .map(function (name) { return caches.delete(name); })
        );
      })
      .then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (event) {
  var url = event.request.url;

  if (isNetworkFirst(url) || url === self.registration.scope) {
    event.respondWith(
      fetch(event.request)
        .then(function (response) {
          var copy = response.clone();
          caches.open(CACHE_NAME).then(function (cache) { cache.put(event.request, copy); });
          return response;
        })
        .catch(function () { return caches.match(event.request); })
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then(function (cached) {
      return cached || fetch(event.request);
    })
  );
});
