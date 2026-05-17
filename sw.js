const CACHE_NAME = 'pazar-cache-v2';
const DATA_URLS = [
  new URL('./data/urunler.json', self.location).href,
  new URL('./data/hal.json', self.location).href,
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(DATA_URLS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (DATA_URLS.includes(url.href)) {
    if (url.href.includes('hal.json')) {
      // hal.json → cache-first: önce cache'den ver, arka planda güncelleme
      event.respondWith(cacheFirst(event.request));
    } else {
      // diğer data dosyaları → stale-while-revalidate
      event.respondWith(staleWhileRevalidate(event.request));
    }
  }
});

// Cache-first: cache varsa ver, yoksa ağdan çek ve cache'e yaz
// Güncelleme sadece GitHub Actions'dan gelir (gece 03:00)
async function cacheFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) await cache.put(request, response.clone());
  return response;
}

// Stale-while-revalidate: cache'den ver, arka planda güncelle
async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  const networkPromise = fetch(request).then(async response => {
    if (response.ok) {
      await cache.put(request, response.clone());
      const clients = await self.clients.matchAll({ includeUncontrolled: true });
      clients.forEach(c => c.postMessage({ type: 'DATA_UPDATED' }));
    }
    return response;
  }).catch(() => cached);
  return cached || networkPromise;
}
