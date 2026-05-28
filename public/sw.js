const CACHE_NAME = 'beelbem-motoboy-v3';
const APP_SHELL = ['/', '/index.html', '/manifest.webmanifest', '/beelbem-icon.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (url.origin !== self.location.origin || request.method !== 'GET') {
    event.respondWith(fetch(request));
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put('/index.html', copy));
          return response;
        })
        .catch(() => caches.match('/index.html'))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => cached || fetch(request))
  );
});

self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data?.json() || {};
  } catch {
    payload = {};
  }
  const title = payload.title || 'Nova entrega disponivel';
  const options = {
    body: payload.body || 'Abra o app para aceitar ou recusar o pedido.',
    icon: '/beelbem-icon.png',
    badge: '/beelbem-icon.png',
    tag: payload.deliveryId ? `delivery-offer-${payload.deliveryId}` : 'delivery-offer',
    renotify: true,
    requireInteraction: true,
    vibrate: [450, 160, 450, 160, 700],
    data: { url: payload.url || '/#courier-home' },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl = new URL(event.notification.data?.url || '/#courier-home', self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        const appClient = clientList.find((client) => client.url.includes(self.location.origin));
        if (appClient) {
          return appClient.navigate(targetUrl).then((client) => (client || appClient).focus());
        }
        return self.clients.openWindow(targetUrl);
      })
  );
});
