/*
 * Notifications, loaded into the service worker (vite.config.ts, workbox importScripts).
 * The server sends { title, body, url, tag } (worker/push.ts). Tapping one opens the app at
 * `url`, in the window that's already open if there is one.
 */
self.addEventListener('push', (event) => {
  let note = {};
  try {
    note = event.data ? event.data.json() : {};
  } catch (e) { /* not JSON: show the default */ }
  event.waitUntil(
    self.registration.showNotification(note.title || 'Dara X&O', {
      body: note.body || '',
      icon: '/icons/icon-192.png',
      badge: '/icons/badge-96.png',
      tag: note.tag || 'dara',
      renotify: !!note.tag,
      data: { url: note.url || '/' },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = new URL((event.notification.data && event.notification.data.url) || '/', self.location.origin).href;
  event.waitUntil(
    (async () => {
      const open = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const app = open.find((c) => new URL(c.url).origin === self.location.origin);
      if (app) {
        await app.focus();
        if (app.url !== url && 'navigate' in app) await app.navigate(url).catch(() => {});
        return;
      }
      await self.clients.openWindow(url);
    })(),
  );
});
