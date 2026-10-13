const STATIC_CACHE = "fusionest-static-v3";
const DYNAMIC_CACHE = "fusionest-dynamic-v3";

const STATIC_ASSETS = ["/", "/index.html"];

// Install event - cache minimal shell
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    }),
  );
  self.skipWaiting();
});

// Activate event - clean old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== STATIC_CACHE && name !== DYNAMIC_CACHE)
          .map((name) => caches.delete(name)),
      );
    }),
  );
  self.clients.claim();
});

const isHtmlNavigation = (request) => {
  if (request.mode === "navigate") return true;
  const accept = request.headers.get("accept") || "";
  return accept.includes("text/html");
};

// Fetch event
self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Only handle GET requests
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Skip chrome extensions and non-http requests
  if (!url.protocol.startsWith("http")) return;

  // SPA navigation: always serve the app shell so deep links (e.g. /daily-activity) don't 404
  if (url.origin === self.location.origin && isHtmlNavigation(request)) {
    event.respondWith(
      fetch(request)
        .then((response) => (response && response.ok ? response : caches.match("/index.html")))
        .catch(() => caches.match("/index.html")),
    );
    return;
  }

  // Backend API calls and external services: always bypass service worker caching to prevent data leakage
  if (url.hostname.includes("supabase.co") || url.origin !== self.location.origin) {
    return;
  }

  // Static assets from same origin: cache first, network fallback (cache only successful responses)
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) return cachedResponse;

      return fetch(request).then((response) => {
        if (response && response.ok) {
          caches.open(DYNAMIC_CACHE).then((cache) => cache.put(request, response.clone()));
        }
        return response;
      });
    }),
  );
});
