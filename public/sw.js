const CACHE_NAME = 'autopulse-pwa-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

self.addEventListener('fetch', (event) => {
  // Pass-through fetch handler required by Chrome for PWA installability
  // We do not aggressively cache to avoid breaking SSR or API routes.
  event.respondWith(fetch(event.request).catch(() => {
    return new Response('Offline - Verifique sua conexão com a internet.', {
      status: 503,
      statusText: 'Service Unavailable'
    });
  }));
});
