// Service worker del panel: SOLO notificaciones push. No cachea nada a
// propósito: el dashboard debe ir siempre a la red para no quedarse con
// versiones viejas después de un despliegue.
self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (e) => {
  e.waitUntil(self.clients.claim());
});

// Listener vacío: Chrome exige un manejador de fetch para ofrecer "Instalar app".
// No intercepta nada (no llama respondWith), así que toda petición va a la red.
self.addEventListener('fetch', () => {});

// --- Notificaciones push (las envía el bot cuando llega un mensaje nuevo) ---
self.addEventListener('push', (e) => {
  let datos = { titulo: 'Panel del consultorio', cuerpo: 'Nuevo mensaje', datos: {} };
  try {
    if (e.data) datos = { ...datos, ...e.data.json() };
  } catch {}
  const telefono = datos.datos.telefono;
  e.waitUntil(
    self.registration.showNotification(datos.titulo, {
      body: datos.cuerpo,
      icon: '/pwa/icon-192.png',
      badge: '/pwa/icon-192.png',
      tag: telefono || 'panel',
      renotify: true,
      requireInteraction: true, // no se oculta sola; queda hasta que la toques
      vibrate: [200, 100, 200],
      data: { url: telefono ? '/?chat=' + encodeURIComponent(telefono) : '/' },
    })
  );
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || '/';
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((lista) => {
      const existente = lista.find((c) => c.url.startsWith(self.registration.scope));
      if (existente) return existente.navigate(url).then((c) => c.focus()).catch(() => clients.openWindow(url));
      return clients.openWindow(url);
    })
  );
});
