// ============================================
// DXT SPORTS QRO — Notifications Manager v330.0
// Gestiona permisos FCM, tokens, y envío de notificaciones.
// Tipos: new_order | payment | status_change | promo
// ============================================

// ⚠️  VAPID KEY — Obtén la tuya en:
//  Firebase Console → ⚙️ Configuración del proyecto
//  → Pestaña "Cloud Messaging" → Web Push Certificates → Generar par de claves
const VAPID_KEY = 'REEMPLAZA_CON_TU_VAPID_KEY';

let fcmMessaging = null;
let fcmToken = null;

// ============================================
// INIT — llamar después de que Firebase esté listo
// ============================================
window.initFCM = async function(isAdmin = false) {
  if (!firebase.messaging) {
    console.warn('FCM no disponible en este navegador.');
    return;
  }

  // Safari iOS no soporta FCM — notificar al usuario
  const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent) && !window.MSStream;
  if (isIOS) {
    console.info('iOS Safari: notificaciones push no disponibles via FCM. Usa notificaciones locales.');
    return;
  }

  try {
    fcmMessaging = firebase.messaging();
    const permission = await Notification.requestPermission();

    if (permission === 'granted') {
      console.log('✅ Permiso de notificaciones concedido.');
      fcmToken = await fcmMessaging.getToken({ vapidKey: VAPID_KEY });

      if (fcmToken) {
        console.log('🔑 FCM Token:', fcmToken.substring(0, 20) + '...');
        await saveTokenToFirestore(fcmToken, isAdmin);
      }

      // Handle foreground messages (app open)
      fcmMessaging.onMessage(payload => {
        console.log('[FCM] Mensaje en primer plano:', payload);
        showLocalNotification(payload);
      });

    } else {
      console.warn('Permiso de notificaciones denegado por el usuario.');
    }
  } catch (err) {
    console.warn('FCM init error (non-critical):', err);
  }
};

// ============================================
// SAVE TOKEN → Firestore (admins o clientes)
// ============================================
async function saveTokenToFirestore(token, isAdmin) {
  if (!window.db || !token) return;
  try {
    const collection = isAdmin ? 'fcm_admin_tokens' : 'fcm_client_tokens';
    const docId = token.substring(0, 40); // Unique per device/browser
    await db.collection(collection).doc(docId).set({
      token,
      isAdmin,
      platform: navigator.userAgentData?.platform || navigator.platform || 'web',
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    console.log('✅ FCM token guardado en Firestore →', collection);
  } catch (err) {
    console.warn('Error guardando token FCM:', err);
  }
}

// ============================================
// SHOW LOCAL NOTIFICATION (app en primer plano)
// ============================================
function showLocalNotification(payload) {
  const n = payload.notification || {};
  const title = n.title || '🔔 DXT Sports';
  const body = n.body || '';
  const icon = n.icon || '/dxt-sports-qro/assets/icon-192.png';

  if ('Notification' in window && Notification.permission === 'granted') {
    const notif = new Notification(title, {
      body,
      icon,
      badge: '/dxt-sports-qro/assets/icon-96.png',
      vibrate: [200, 100, 200],
      tag: 'dxt-fg-notif',
      requireInteraction: false
    });
    notif.onclick = () => {
      window.focus();
      notif.close();
    };
  }
}

// ============================================
// NOTIFY ADMIN: Nuevo Pedido
// ============================================
window.notifyAdminNewOrder = async function(orderData) {
  if (!window.db) return;
  try {
    // Save notification request to Firestore (processed by Cloud Function or admin polling)
    await db.collection('notification_queue').add({
      type: 'new_order',
      title: '📦 Nuevo Pedido — DXT Sports',
      body: `${orderData.customerName} pidió ${orderData.itemCount} artículo(s) — $${orderData.totalAmount} MXN`,
      data: {
        type: 'new_order',
        orderId: orderData.orderId || '',
        customerName: orderData.customerName || '',
        amount: String(orderData.totalAmount || 0)
      },
      sentAt: firebase.firestore.FieldValue.serverTimestamp(),
      delivered: false
    });

    // Also try foreground notification if admin is here
    showLocalNotification({
      notification: {
        title: '📦 Nuevo Pedido — DXT Sports',
        body: `${orderData.customerName} → $${orderData.totalAmount} MXN`
      }
    });
  } catch (err) {
    console.warn('notifyAdminNewOrder error:', err);
  }
};

// ============================================
// NOTIFY ADMIN: Pago / Abono
// ============================================
window.notifyAdminPayment = async function(orderData) {
  if (!window.db) return;
  try {
    await db.collection('notification_queue').add({
      type: 'payment',
      title: '💰 Pago Recibido — DXT Sports',
      body: `${orderData.customerName} abonó $${orderData.amount} MXN. Restante: $${orderData.remaining} MXN`,
      data: {
        type: 'payment',
        orderId: orderData.orderId || '',
        customerName: orderData.customerName || '',
        amount: String(orderData.amount || 0)
      },
      sentAt: firebase.firestore.FieldValue.serverTimestamp(),
      delivered: false
    });

    showLocalNotification({
      notification: {
        title: '💰 Pago Recibido — DXT Sports',
        body: `${orderData.customerName} abonó $${orderData.amount} MXN`
      }
    });
  } catch (err) {
    console.warn('notifyAdminPayment error:', err);
  }
};

// ============================================
// NOTIFY ADMIN: Cambio de Estatus
// ============================================
window.notifyAdminStatusChange = async function(orderData) {
  if (!window.db) return;
  const statusLabels = {
    ready: '📦 Listo para Entrega',
    transit: '🚚 En Camino',
    delivered: '✅ Entregado'
  };
  const label = statusLabels[orderData.newStatus] || orderData.newStatus;
  try {
    await db.collection('notification_queue').add({
      type: 'status_change',
      title: `${label} — DXT Sports`,
      body: `Pedido de ${orderData.customerName} actualizado a: ${label}`,
      data: {
        type: 'status_change',
        orderId: orderData.orderId || '',
        status: orderData.newStatus || ''
      },
      sentAt: firebase.firestore.FieldValue.serverTimestamp(),
      delivered: false
    });
  } catch (err) {
    console.warn('notifyAdminStatusChange error:', err);
  }
};

// ============================================
// NOTIFY CLIENTS: Promo / Lanzamiento (BROADCAST)
// Admin envía desde Reportes → aparece en todos los celulares
// ============================================
window.sendPromoNotification = async function(title, body, imageUrl = '') {
  if (!window.db) return;
  try {
    await db.collection('notification_queue').add({
      type: 'promo',
      title: title || '🔥 DXT Sports — Oferta Especial',
      body: body || 'Visita nuestra tienda y encuentra los mejores jerseys.',
      imageUrl,
      targetAudience: 'all_clients',
      data: { type: 'promo' },
      sentAt: firebase.firestore.FieldValue.serverTimestamp(),
      delivered: false
    });
    alert(`✅ Notificación programada:\n"${title}"\nSe enviará a todos los clientes con la app instalada.`);
  } catch (err) {
    alert('Error al programar notificación: ' + err.message);
  }
};

// ============================================
// WATCH NOTIFICATION QUEUE (Admin polling)
// Muestra notificaciones locales cuando el admin está en línea
// ============================================
window.startAdminNotificationWatcher = function() {
  if (!window.db) return;

  const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);

  db.collection('notification_queue')
    .where('delivered', '==', false)
    .where('sentAt', '>=', fiveMinAgo)
    .onSnapshot(snapshot => {
      snapshot.docChanges().forEach(change => {
        if (change.type === 'added') {
          const n = change.doc.data();
          if (n.type !== 'promo') { // Solo alertas de pedidos al admin
            showLocalNotification({ notification: { title: n.title, body: n.body } });
          }
        }
      });
    });
};
