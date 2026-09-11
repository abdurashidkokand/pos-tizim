const CACHE_NAME = 'pos-cache-v2';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // Skip API requests
  if (request.url.includes('/api/')) return;

  // HTML pages — network-first (always get fresh, fallback to cache if offline)
  if (request.destination === 'document') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() =>
          caches.match(request).then((cached) =>
            cached || new Response(
              '<html><body style="font-family:sans-serif;text-align:center;padding:40px"><h1>Offline</h1><p>Internet aloqasi yo\'q. Qayta urinib ko\'ring.</p></body></html>',
              { headers: { 'Content-Type': 'text/html' } }
            )
          )
        )
    );
    return;
  }

  // Static assets (JS, CSS, images) — stale-while-revalidate
  if (request.url.includes('/_next/') || request.destination === 'style' || request.destination === 'script' || request.destination === 'image') {
    event.respondWith(
      caches.match(request).then((cached) => {
        const fetchPromise = fetch(request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        }).catch(() => cached || new Response('', { status: 503 }));

        return cached || fetchPromise;
      })
    );
    return;
  }
});
