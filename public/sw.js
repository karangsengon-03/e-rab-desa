/* ============================================================
   e-RAB Desa v1.0 — sw.js
   Service Worker: Network-first + Auto-update
   Strategy: Always try network first, cache as fallback
   ============================================================ */

const CACHE_VERSION = 'v1.0.0';
const CACHE_NAME = `e-rab-desa-${CACHE_VERSION}`;

// Assets to pre-cache on install
const PRECACHE_URLS = [
  './',
  './index.html',
  './css/main.css',
  './js/utils.js',
  './js/auth.js',
  './js/activity-log.js',
  './js/master-harga.js',
  './js/ahsp.js',
  './js/projects.js',
  './js/kalkulasi.js',
  './js/rab-input.js',
  './js/export-pdf.js',
  './js/export-excel.js',
  './js/pages.js',
  './js/app.js',
  './data/ahsp-data.json',
  './manifest.json',
];

// ===== INSTALL: Pre-cache core assets =====
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(PRECACHE_URLS).catch(err => {
        console.warn('[SW] Pre-cache error (non-fatal):', err);
      });
    })
  );
  // Activate immediately - don't wait for old SW to finish
  self.skipWaiting();
});

// ===== ACTIVATE: Clean up old caches =====
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames
          .filter(name => name.startsWith('e-rab-desa-') && name !== CACHE_NAME)
          .map(name => {
            console.log('[SW] Deleting old cache:', name);
            return caches.delete(name);
          })
      );
    })
  );
  // Take control of all clients immediately
  self.clients.claim();
});

// ===== FETCH: Network-first strategy =====
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET, Chrome extensions, Firebase, CDN requests
  if (request.method !== 'GET') return;
  if (!url.protocol.startsWith('http')) return;
  if (url.hostname.includes('firebase') || url.hostname.includes('google')) return;
  if (url.hostname.includes('fonts.googleapis') || url.hostname.includes('fonts.gstatic')) return;
  if (url.hostname.includes('cdnjs.cloudflare')) return;

  event.respondWith(networkFirst(request));
});

async function networkFirst(request) {
  const cache = await caches.open(CACHE_NAME);

  try {
    // Try network first
    const networkResponse = await fetch(request, { signal: AbortSignal.timeout(5000) });

    // Cache successful responses for our own assets
    if (networkResponse.ok && new URL(request.url).hostname === self.location.hostname) {
      cache.put(request, networkResponse.clone());
    }

    return networkResponse;
  } catch (err) {
    // Network failed - try cache
    const cached = await cache.match(request);
    if (cached) {
      console.log('[SW] Serving from cache (offline):', request.url);
      return cached;
    }

    // Cache miss - return offline fallback for navigation
    if (request.mode === 'navigate') {
      const fallback = await cache.match('./index.html');
      if (fallback) return fallback;
    }

    // No fallback available
    return new Response('Tidak ada koneksi internet dan cache tidak tersedia.', {
      status: 503,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' }
    });
  }
}

// ===== MESSAGE: Handle skip-waiting from app =====
self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
