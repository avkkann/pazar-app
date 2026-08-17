// MEZAR TASI SERVICE WORKER — avkkann.github.io/pazar-app icin.
// Gorevi tek: eski SW'nin yerine gecip butun onbellekleri silmek ve kendini
// kayittan dusurmek. Uygulama pazarapp.net'e tasindi.
//
// NEDEN CALISIYOR (olculdu, varsayilmadi):
// Eski sw.js'in fetch dinleyicisi YALNIZCA iki URL'i yakiliyordu —
// ./data/hal.json ve ./data/anasayfa.json. Ne HTML navigasyonunu ne de
// sw.js'in kendisini yakalamiyordu. Dolayisiyla:
//   - staleWhileRevalidate guncelleme yolunda DEGIL; bu script'i tarayicinin
//     Update algoritmasi dogrudan agdan cekiyor.
//   - Ana SW script'i HTTP onbellegini varsayilan olarak atliyor
//     (updateViaCache: 'imports'), yani GitHub Pages'in max-age=600'u
//     guncellemeyi geciktirmiyor.
// Tetikleyici: mezar tasi index.html'indeki register('./sw.js') cagrisi
// (ve kapsam icine yapilan her navigasyonun tetikledigi soft update).
//
// SINIR — durustce: kullanici eski adresi BIR KEZ daha acmazsa bu script
// ona hic ulasmaz ve eski SW kayitli kalir. Bunu zorlamanin yolu YOK; bir
// origin'in SW'si baska origin'den silinemez. Ancak pratik zarari da yok:
// eski SW yalnizca o iki veri URL'ini yakaliyor ve mezar tasi yayinlandiktan
// sonra o origin'de o dosyalari isteyen bir sayfa kalmiyor — SW atil hale
// geliyor.

self.addEventListener('install', () => {
  // Bekleme yok: eski SW hala aktifken devral.
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    // 1) Eski surumlerin biraktigi TUM onbellekleri sil (pazar-cache-v*).
    const anahtarlar = await caches.keys();
    await Promise.all(anahtarlar.map(k => caches.delete(k)));

    // 2) Acik sekmeleri devral — boylece eski SW artik hicbir istegi gormez.
    await self.clients.claim();

    // 3) Kendini kayittan dus. Kayit, onu kullanan tum client'lar
    //    bosaldiginda tamamen kalkar; meta refresh sayfayi zaten terk ediyor.
    await self.registration.unregister();
  })());
});

// fetch dinleyicisi BILEREK YOK — hicbir istek yakalanmiyor, her sey aga
// gidiyor. Yakalasak yonlendirmenin kendisini bozma riski dogardi.
