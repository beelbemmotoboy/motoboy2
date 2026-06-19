self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { title: 'Beelbem Obras', body: event.data?.text() || 'Nova atividade registrada.' };
  }

  const title = payload.title || 'Beelbem Obras';
  const options = {
    body: payload.body || 'Nova atividade registrada.',
    tag: payload.notificationId || payload.type || 'beelbem-obras',
    data: {
      url: payload.url || '/obras',
      notificationId: payload.notificationId || '',
      projectId: payload.projectId || '',
    },
    icon: '/beelbem-obras.svg',
    badge: '/beelbem-obras.svg',
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/obras';

  event.waitUntil((async () => {
    const clientsList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const existingClient = clientsList.find((client) => client.url.includes('/obras'));

    if (existingClient) {
      await existingClient.focus();
      return;
    }

    await self.clients.openWindow(url);
  })());
});
