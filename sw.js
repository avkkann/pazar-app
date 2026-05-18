const CACHE_NAME = 'pazar-cache-v8';
const DATA_URLS = [
  new URL('./data/urunler.json', self.location).href,
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
    if (url.href.includes('hal.json')) event.respondWith(cacheFirst(event.request));
    else event.respondWith(staleWhileRevalidate(event.request));
  }
});
async function cacheFirst(r) { const c = await caches.open(CACHE_NAME); const h = await c.match(r); if (h) return h; const n = await fetch(r); if (n.ok) await c.put(r, n.clone()); return n; }
async function staleWhileRevalidate(r) { const c = await caches.open(CACHE_NAME); const h = await c.match(r); const np = fetch(r).then(async n => { if (n.ok) { await c.put(r, n.clone()); (await self.clients.matchAll({includeUncontrolled:true})).forEach(cl => cl.postMessage({type:'DATA_UPDATED'})); } return n; }).catch(() => h); return h || np; }
