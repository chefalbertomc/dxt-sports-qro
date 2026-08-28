// ============================================
// DXT SPORTS QRO — Firebase Messaging SW v330.0
// Este archivo DEBE estar en la raíz del proyecto.
// Maneja notificaciones push en segundo plano (teléfono bloqueado).
// ============================================
importScripts('https://www.gstatic.com/firebasejs/9.22.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.22.2/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyAuBz1xZKFjuQVdga4RoiVsZWOWR80oSws",
  authDomain: "dxt-sports-qro.firebaseapp.com",
  projectId: "dxt-sports-qro",
  storageBucket: "dxt-sports-qro.firebasestorage.app",
  messagingSenderId: "285839494358",
  appId: "1:285839494358:web:290ab53eafc3de542dcd77"
});

const messaging = firebase.messaging();

// Handle background push messages (phone locked / app closed)
messaging.onBackgroundMessage(payload => {
  console.log('[FCM SW] Mensaje en background:', payload);

  const { title, body, icon, badge, tag, data } = payload.notification || {};

  const notifTitle = title || '🔔 DXT Sports';
  const notifOptions = {
    body: body || 'Tienes una notificación nueva.',
    icon: icon || '/dxt-sports-qro/assets/icon-192.png',
    badge: badge || '/dxt-sports-qro/assets/icon-96.png',
    tag: tag || 'dxt-notif',
    vibrate: [200, 100, 200],
    requireInteraction: true,
    data: data || {},
    actions: [
      { action: 'open', title: '👁️ Ver' },
      { action: 'close', title: 'Cerrar' }
    ]
  };

  self.registration.showNotification(notifTitle, notifOptions);
});

// Handle notification click — open/focus admin or store
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const action = event.action;
  const data = event.notification.data || {};

  let targetUrl = '/dxt-sports-qro/';
  if (data.type === 'new_order' || data.type === 'payment' || action === 'open') {
    targetUrl = '/dxt-sports-qro/admin.html#tab-orders';
  }

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      for (const client of clientList) {
        if (client.url.includes('dxt-sports-qro') && 'focus' in client) {
          client.focus();
          return;
        }
      }
      if (clients.openWindow) return clients.openWindow(targetUrl);
    })
  );
});
