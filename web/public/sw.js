/**
 * Service worker for Antojo de Yanet. Handles Web Push notifications: shows a native
 * OS notification and navigates to the relevant URL when clicked.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 */

self.addEventListener('push', (event) => {
  if (!event.data) return;
  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { titulo: 'Antojo de Yanet', cuerpo: event.data.text() };
  }

  const titulo = payload.titulo ?? 'Antojo de Yanet';
  const opciones = {
    body: payload.cuerpo ?? '',
    icon: '/logo-antojo.webp',
    badge: '/logo-antojo.webp',
    data: { url: payload.url ?? '/', ...(payload.data ?? {}) },
    requireInteraction: false,
  };

  event.waitUntil(self.registration.showNotification(titulo, opciones));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url ?? '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.focus();
          client.navigate(url);
          return;
        }
      }
      if (clients.openWindow) return clients.openWindow(url);
    }),
  );
});
