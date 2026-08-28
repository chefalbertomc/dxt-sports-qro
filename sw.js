// DXT Sports QRO — Service Worker v330.0
const CACHE_NAME = 'dxt-sports-v330';
const STATIC_ASSETS = [
  '/dxt-sports-qro/',
  '/dxt-sports-qro/index.html',
  '/dxt-sports-qro/manifest.json',
  '/dxt-sports-qro/css/styles.css',
  '/dxt-sports-qro/js/app.js',
  '/dxt-sports-qro/js/firebase-config.js',
  '/dxt-sports-qro/js/teams.js',
  '/dxt-sports-qro/assets/dxt_logo.png',
  '/dxt-sports-qro/assets/icon-192.png',
  '/dxt-sports-qro/assets/icon-512.png'
];

// Install: cache static assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(STATIC_ASSETS).catch(err => {
        console.warn('SW install cache partial fail (non-critical):', err);
      });
    })
  );
  self.skipWaiting();
});

// Activate: clean old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// Fetch: Network-first for Firebase/API, Cache-first for static
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Always go to network for Firebase, Google APIs, external resources
  const isExternal = url.hostname.includes('firebase') ||
    url.hostname.includes('googleapis') ||
    url.hostname.includes('gstatic') ||
    url.hostname.includes('firebaseio') ||
    url.hostname.includes('firebaseapp') ||
    url.protocol === 'chrome-extension:';

  if (isExternal || event.request.method !== 'GET') return;

  // Cache-first for static assets (images, css, js)
  const isStatic = url.pathname.match(/\.(png|jpg|jpeg|gif|webp|svg|ico|css|js|woff2?)$/);

  if (isStatic) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        return cached || fetch(event.request).then(response => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          }
          return response;
        });
      })
    );
    return;
  }

  // Network-first for HTML pages
  event.respondWith(
    fetch(event.request).then(response => {
      if (response && response.status === 200) {
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
      }
      return response;
    }).catch(() => caches.match(event.request))
  );
});
