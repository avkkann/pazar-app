const CACHE_NAME = 'pazar-cache-v234';
const DATA_URLS = [
  new URL('./data/hal.json', self.location).href,
  // Ana sayfanin dort seridi buradan besleniyor (25,9 KB gzip). Ilk boyamada
  // gerektigi icin precache'te; kategori JSON'lari ve gecmis_fiyatlar.json
  // artik ana sayfa icin GEREKMIYOR, tembel yukleniyorlar.
  new URL('./data/anasayfa.json', self.location).href,
];
// Self-host fontlar (2026-08-21). Immutable -> cacheFirst; CACHE_NAME bump'i
// eski surumu (ve eski Google/Fontshare referanslarini) temizler. Lisans .txt
// dosyalari cache'e ALINMAZ (yalniz woff2).
const FONT_URLS = [
  new URL('./static/fonts/inter-latin.woff2', self.location).href,
  new URL('./static/fonts/inter-latin-ext.woff2', self.location).href,
  new URL('./static/fonts/cabinet-grotesk-700.woff2', self.location).href,
  new URL('./static/fonts/cabinet-grotesk-800.woff2', self.location).href,
];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(DATA_URLS.concat(FONT_URLS))));
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
  } else if (FONT_URLS.includes(url.href)) {
    // Fontlar immutable -> cacheFirst (revalidate yok). Yeni surum icin CACHE_NAME bump.
    event.respondWith(cacheFirst(event.request));
  }
});
async function cacheFirst(r) { const c = await caches.open(CACHE_NAME); const h = await c.match(r); if (h) return h; const n = await fetch(r); if (n.ok) await c.put(r, n.clone()); return n; }
// DATA_UPDATED artik YALNIZCA icerik GERCEKTEN degistiginde yollaniyor.
// ONCE her basarili revalidate'te yollaniyordu. Istemci tarafi memo'lari
// bosaltmadigi icin bu zararsizdi (mesaj hicbir sey yapmiyordu, bkz. app.js);
// memo bosaltma eklenince mesaj -> loadData -> fetch -> revalidate -> mesaj
// diye SONSUZ DONGU olurdu. Mesajin anlami artik "veri degisti", "istek
// tamamlandi" degil.
function _damga(res) {
  return res.headers.get('ETag') || res.headers.get('Last-Modified') || '';
}
async function _degistiMi(eski, yeni) {
  if (!eski) return true;                       // ilk kez: degisim sayilir
  const de = _damga(eski), dy = _damga(yeni);
  if (de && dy) return de !== dy;               // Cloudflare ETag veriyor
  // Damga yoksa GOVDEYI karsilastir. "damga yok -> hic haber verme" demek
  // ozelligi sessizce olduruyordu; bu dosyalar kucuk (26 KB gzip).
  try { return (await eski.clone().text()) !== (await yeni.clone().text()); }
  catch (e) { console.warn('[sw] govde karsilastirilamadi, degisti sayiliyor:', e && e.message); return true; }
}
async function staleWhileRevalidate(r) {
  const c = await caches.open(CACHE_NAME);
  const h = await c.match(r);
  const np = fetch(r).then(async n => {
    if (n.ok) {
      const degisti = await _degistiMi(h, n);
      await c.put(r, n.clone());
      if (degisti) {
        (await self.clients.matchAll({ includeUncontrolled: true }))
          .forEach(cl => cl.postMessage({ type: 'DATA_UPDATED' }));
      }
    }
    return n;
  }).catch(() => h);
  return h || np;
}

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
  // ORIGIN KAPISI: push yukundeki url'e GUVENILMEZ. Bugun sunucu sabit "./"
  // yolluyor (fiyat-alarm-scan) ve push VAPID ozel anahtari ister, ama dogrulama
  // olmadan yuke dinamik bir url konursa dis origin'e pencere acilirdi.
  // Yalniz AYNI ORIGIN acilir; degilse guvenli varsayilan "./".
  // SESSIZ YUTMA YOK: red ve ayristirma hatasi AYRI dallarda ve her biri
  // console.warn ile iz birakiyor (bu depoda en sik hata sinifi sessiz basarisizlik).
  const ham = (event.notification.data && event.notification.data.url) || './';
  let url = './';
  try {
    const cozulen = new URL(ham, self.location.origin);
    if (cozulen.origin === self.location.origin) {
      url = ham;
    } else {
      // javascript:/data: gibi semalar burada origin "null" verir -> yine reddedilir.
      console.warn('[sw] notificationclick: dis origin reddedildi, ana sayfa acildi:', cozulen.origin);
    }
  } catch (e) {
    console.warn('[sw] notificationclick: url ayristirilamadi, ana sayfa acildi:', ham, e && e.message);
  }
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});
