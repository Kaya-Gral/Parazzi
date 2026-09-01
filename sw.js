const CACHE = 'parazzi-v6';

/* Precache: every file the app needs to run */
const PRECACHE = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './db.js',
  './offline.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './icon-192-maskable.png',
  './icon-512-maskable.png',
  './apple-touch-icon.png',
  /* External libs — cached so the app renders without network */
  'https://cdn.jsdelivr.net/npm/alpinejs@3.14.3/dist/cdn.min.js',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js',
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap'
];

/* Install: cache each file individually so one failure doesn't kill everything */
self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE).then(async cache => {
      for (const url of PRECACHE) {
        try {
          const res = await fetch(url, { cache: 'reload' });
          if (res && (res.status === 200 || res.status === 0)) {
            await cache.put(url, res);
          }
        } catch (err) {
          console.warn('[SW] Precache failed:', url);
        }
      }
      console.log('[SW] Install complete');
    })
  );
});

/* Activate: delete old caches, claim clients immediately */
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

/* Fetch: cache-first for everything, including cross-origin libs */
self.addEventListener('fetch', e => {
  const { request } = e;
  if (request.method !== 'GET') return;

  e.respondWith(
    caches.match(request, { ignoreSearch: true }).then(cached => {
      if (cached) return cached;

      return fetch(request).then(res => {
        if (res && (res.status === 200 || res.status === 0)) {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(request, clone));
        }
        return res;
      }).catch(() => {
        /* Network failed */
        if (request.mode === 'navigate' || request.destination === 'document') {
          return caches.match('./offline.html')
            .then(off => off || caches.match('./index.html', { ignoreSearch: true }))
            .then(page => page || new Response(
              '<!DOCTYPE html><html><head><meta charset=utf-8><meta name=viewport content="width=device-width"><title>Offline</title><style>body{font-family:sans-serif;text-align:center;padding:40px;color:#333}</style></head><body><h1>You are offline</h1><p>Please check your connection and try again.</p></body></html>',
              { headers: { 'Content-Type': 'text/html' } }
            ));
        }
        return new Response('Offline', { status: 503 });
      });
    })
  );
});

/* Message: skip waiting on update */
self.addEventListener('message', event => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

/* Push notifications */
self.addEventListener('push', event => {
  let data = { title: 'Parazzi', body: 'You have a new notification.', url: './?source=push' };
  try { if (event.data) data = event.data.json(); } catch(e) {}
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: './icon-192.png',
      badge: './icon-192.png',
      tag: data.tag || 'parazzi-default',
      requireInteraction: false,
      data: { url: data.url || './?source=push' },
      actions: data.actions || []
    })
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = event.notification.data?.url || './?source=push';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windowClients => {
      for (const client of windowClients) {
        if (client.url && client.url.includes(url.split('?')[0]) && 'focus' in client) {
          client.focus();
          if ('postMessage' in client) client.postMessage({ type: 'navigate', url });
          return;
        }
      }
      if (clients.openWindow) clients.openWindow(url);
    })
  );
});

/* Background sync */
self.addEventListener('sync', event => {
  if (event.tag === 'parazzi-sync-sales') {
    event.waitUntil(
      clients.matchAll({ type: 'window' }).then(clients => {
        clients.forEach(c => c.postMessage({ type: 'force-sync' }));
      })
    );
  }
});
