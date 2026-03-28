/**
 * GDI Service Worker
 * Strategy:
 *   - CDN assets (versioned):  Cache-First
 *   - Worker API calls (/0:*, /1:*, /download.aspx, /dl):  Network-Only
 *   - Everything else:  Network-First with short stale fallback
 */

const CACHE_VERSION = 'gdi-2.4.0';
const CDN_ORIGIN = 'https://cdn.jsdelivr.net';

// Static CDN assets to pre-cache on install
const PRECACHE_URLS = [
  // These are populated at build time — SW will also cache them lazily on first fetch
];

// ── Install ───────────────────────────────────────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then(cache => {
      if (PRECACHE_URLS.length) return cache.addAll(PRECACHE_URLS);
    })
  );
  self.skipWaiting();
});

// ── Activate — purge old caches ───────────────────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_VERSION)
          .map(key => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// ── Fetch ─────────────────────────────────────────────────────────────────────
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // 1. Never intercept non-GET or chrome-extension requests
  if (request.method !== 'GET') return;
  if (url.protocol === 'chrome-extension:') return;

  // 2. API calls — always go to network
  const isApiCall =
    /^\/([\d]+)[:](search|fallback|id2path|id_info|findpath)/.test(url.pathname) ||
    url.pathname.startsWith('/download.aspx') ||
    url.pathname.startsWith('/dl') ||
    url.pathname.startsWith('/login') ||
    url.pathname.startsWith('/logout') ||
    url.pathname.startsWith('/signup') ||
    url.pathname.startsWith('/google_callback');

  if (isApiCall) {
    // Passthrough — don't intercept
    return;
  }

  // 3. CDN assets — Cache-First
  if (url.origin === CDN_ORIGIN || url.hostname.endsWith('.jsdelivr.net')) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // 4. Other CDN origins used by GDI (vjs, plyr, stackpath, fonts)
  const cdnHosts = [
    'vjs.zencdn.net',
    'cdn.plyr.io',
    'stackpath.bootstrapcdn.com',
    'fonts.googleapis.com',
    'fonts.gstatic.com',
    'code.jquery.com',
  ];
  if (cdnHosts.some(h => url.hostname === h || url.hostname.endsWith('.' + h))) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // 5. Same-origin static files (sw.js itself, /app.js dev mode, images served from worker)
  if (url.origin === self.location.origin) {
    // Don't cache the worker HTML pages — they're dynamic
    if (url.pathname === '/' || url.pathname.endsWith('/')) return;
    if (url.pathname === '/sw.js') return;
    event.respondWith(cacheFirst(request));
    return;
  }
});

// ── Strategies ────────────────────────────────────────────────────────────────

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(CACHE_VERSION);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch {
    return new Response('Offline — resource not cached', { status: 503 });
  }
}
