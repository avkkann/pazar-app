const CACHE_NAME = 'pazar-cache-v172';
const DATA_URLS = [
  new URL('./data/hal.json', self.location).href,
];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(DATA_URLS)));
  self.skipWaiting();
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (DATA_URLS.includes(url.href)) {
    event.respondWith(staleWhileRevalidate(event.request));
  }
});
async function cacheFirst(r) { const c = await caches.open(CACHE_NAME); const h = await c.match(r); if (h) return h; const n = await fetch(r); if (n.ok) await c.put(r, n.clone()); return n; }
async function staleWhileRevalidate(r) { const c = await caches.open(CACHE_NAME); const h = await c.match(r); const np = fetch(r).then(async n => { if (n.ok) { await c.put(r, n.clone()); (await self.clients.matchAll({includeUncontrolled:true})).forEach(cl => cl.postMessage({type:'DATA_UPDATED'})); } return n; }).catch(() => h); return h || np; }

self.addEventListener('push', event => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (e) { data = { title: 'Pazar App', body: event.data ? event.data.text() : '' }; }
  const title = data.title || 'Pazar App';
  const options = {
    body: data.body || '',
    icon: './static/icon-192.png',
    badge: './static/icon-192.png',
    data: { url: data.url || './' }
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || './';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});
