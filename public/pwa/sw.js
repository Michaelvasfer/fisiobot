// Service worker del panel PWA: cachea solo los archivos estáticos del panel.
// Las llamadas a la API y al webhook siempre van a la red.
const CACHE = 'panel-consultorio-v15';
const ESTATICOS = ['/admin/', '/admin/pwa/icon-192.png', '/admin/pwa/icon-512.png', '/admin/pwa/manifest.webmanifest'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ESTATICOS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((claves) => Promise.all(claves.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  // Solo GET de archivos estáticos del panel; todo lo demás va directo a la red.
  if (e.request.method !== 'GET' || url.pathname.startsWith('/admin/api') || url.pathname.startsWith('/webhook')) {
    return;
  }
  e.respondWith(
    // El HTML del panel va primero a la red (para no quedarse con versiones
    // viejas); si no hay internet, se usa la copia en caché. Los demás
    // estáticos (íconos, manifest) se sirven de la caché y se actualizan atrás.
    caches.match(e.request).then((enCache) => {
      const deRed = fetch(e.request).then((respuesta) => {
        if (respuesta.ok) {
          const copia = respuesta.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copia));
        }
        return respuesta;
      });
      const esHtml = e.request.mode === 'navigate' || (e.request.headers.get('accept') || '').includes('text/html');
      if (esHtml) return deRed.catch(() => enCache);
      return enCache || deRed;
    })
  );
});

// --- Notificaciones push ---
self.addEventListener('push', (e) => {
  let datos = { titulo: 'Panel del consultorio', cuerpo: 'Nuevo mensaje', datos: {} };
  try {
    if (e.data) datos = { ...datos, ...e.data.json() };
  } catch {}
  const telefono = datos.datos.telefono;
  e.waitUntil(
    self.registration.showNotification(datos.titulo, {
      body: datos.cuerpo,
      icon: '/admin/pwa/icon-192.png',
      badge: '/admin/pwa/icon-192.png',
      tag: telefono || 'panel',
      renotify: true,
      requireInteraction: true, // no se oculta sola; queda hasta que la toques
      vibrate: [200, 100, 200],
      data: { url: telefono ? '/admin/?chat=' + encodeURIComponent(telefono) : '/admin/' },
    })
  );
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || '/admin/';
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((lista) => {
      const existente = lista.find((c) => c.url.includes('/admin'));
      if (existente) return existente.navigate(url).then((c) => c.focus()).catch(() => clients.openWindow(url));
      return clients.openWindow(url);
    })
  );
});
