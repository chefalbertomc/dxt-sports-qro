// ============================================
// DXT SPORTS QRO — Service Worker v330.2
// SISTEMA AGRESIVO DE ACTUALIZACIÓN (Network-First)
// ============================================
const CACHE_NAME = 'dxt-sports-v330.2';
const STATIC_ASSETS = [
  './',
  './index.html',
  './admin.html',
  './manifest.json',
  './css/styles.css',
  './js/app.js',
  './js/firebase-config.js',
  './js/teams.js',
  './js/notifications.js',
  './assets/dxt_logo.png',
  './assets/icon-192.png',
  './assets/icon-512.png'
];

// Install: Skip waiting immediately to activate fresh version without closing tab
self.addEventListener('install', event => {
  console.log('[SW v330.2] Instalando nueva versión...');
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(STATIC_ASSETS).catch(err => {
        console.warn('[SW] Cache precache warning:', err);
      });
    })
  );
});

// Activate: Delete ALL old caches aggressively and claim clients instantly
self.addEventListener('activate', event => {
  console.log('[SW v330.2] Activando y limpiando cachés antiguas...');
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.map(k => {
          if (k !== CACHE_NAME) {
            console.log('[SW] Borrando caché obsoleta:', k);
            return caches.delete(k);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch: NETWORK-FIRST para TODO excepto imágenes estáticas pesadas
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // External APIs (Firebase, Google, Firestore, WhatsApp) -> Direct Network
  const isExternal = url.hostname.includes('firebase') ||
    url.hostname.includes('googleapis') ||
    url.hostname.includes('gstatic') ||
    url.hostname.includes('firebaseio') ||
    url.hostname.includes('firebaseapp') ||
    url.hostname.includes('wa.me') ||
    url.protocol === 'chrome-extension:';

  if (isExternal || event.request.method !== 'GET') return;

  // NETWORK-FIRST para HTML, JS, CSS (Garantiza siempre la versión más reciente al abrir)
  const isCodeOrHtml = url.pathname.endsWith('.html') ||
    url.pathname.endsWith('.js') ||
    url.pathname.endsWith('.css') ||
    url.pathname.endsWith('/') ||
    url.pathname.endsWith('manifest.json');

  if (isCodeOrHtml) {
    event.respondWith(
      fetch(event.request, { cache: 'no-cache' })
        .then(networkResponse => {
          if (networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          }
          return networkResponse;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Stale-while-revalidate para imágenes locales
  event.respondWith(
    caches.match(event.request).then(cached => {
      const fetchPromise = fetch(event.request).then(networkResponse => {
        if (networkResponse && networkResponse.status === 200) {
          const clone = networkResponse.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return networkResponse;
      }).catch(() => null);

      return cached || fetchPromise;
    })
  );
});

// Escuchar orden de actualización forzada desde la app
self.addEventListener('message', event => {
  if (event.data && event.data.action === 'skipWaiting') {
    self.skipWaiting();
  }
});
