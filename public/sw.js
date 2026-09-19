const STATIC_CACHE = "attendpro-static-v2";
const DYNAMIC_CACHE = "attendpro-dynamic-v2";

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

  // Backend API calls - network first, cached fallback (cache only successful responses)
  if (url.hostname.includes("supabase.co")) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.ok) {
            caches.open(DYNAMIC_CACHE).then((cache) => cache.put(request, response.clone()));
          }
          return response;
        })
        .catch(() => caches.match(request)),
    );
    return;
  }

  // Static assets: cache first, network fallback (cache only successful responses)
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
