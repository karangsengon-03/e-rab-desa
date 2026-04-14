/* ============================================================
   e-RAB Desa v1.2 — sw.js
   Service Worker: Network-first + Aggressive Update
   Tujuan: Update cukup dengan soft refresh (Ctrl+R)
   ============================================================ */

const CACHE_VERSION = 'v1.2-' + Date.now();   // versi otomatis berubah tiap deploy
const CACHE_NAME = `e-rab-desa-${CACHE_VERSION}`;

const PRECACHE_URLS = [
  './',
  './index.html',
  './css/main.css',
  './js/utils.js',
  './js/auth.js',
  './js/activity-log.js',
  './js/master-harga.js',
  './js/ahsp.js',
  './js/kalkulasi.js',
  './js/rab-input.js',
  './js/export-pdf.js',
  './js/export-excel.js',
  './js/pages.js',
  './js/app.js',
  './js/projects.js',
  './data/ahsp-data.json',
  './manifest.json'
];

// ===== INSTALL =====
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('[SW] Pre-caching assets...');
      return cache.addAll(PRECACHE_URLS);
    })
  );
  self.skipWaiting();   // Langsung aktif
});

// ===== ACTIVATE =====
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames
          .filter(name => name.startsWith('e-rab-desa-') && name !== CACHE_NAME)
          .map(name => {
            console.log('[SW] Menghapus cache lama:', name);
            return caches.delete(name);
          })
      );
    })
  );
  self.clients.claim();   // Ambil kontrol semua tab
});

// ===== FETCH: Network First + Cache Fallback =====
self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Skip Firebase & external resources
  if (url.hostname.includes('firebase') || 
      url.hostname.includes('google') || 
      url.hostname.includes('gstatic')) {
    return;
  }

  event.respondWith(
    fetch(request)
      .then(networkResponse => {
        // Cache successful responses dari domain sendiri
        if (networkResponse.ok && url.hostname === self.location.hostname) {
          const cacheCopy = networkResponse.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, cacheCopy));
        }
        return networkResponse;
      })
      .catch(() => {
        // Offline → ambil dari cache
        return caches.match(request).then(cachedResponse => {
          if (cachedResponse) return cachedResponse;

          // Fallback untuk halaman utama
          if (request.mode === 'navigate') {
            return caches.match('./index.html');
          }
          return new Response('Offline', { status: 503 });
        });
      })
  );
});

// ===== Message dari app (skip waiting) =====
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

console.log('[SW] Service Worker v1.2 aktif');