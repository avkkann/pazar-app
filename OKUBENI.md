# mezar-tasi dalı — eski adres için

Bu dal `avkkann.github.io/pazar-app` adresinde yayınlanmak üzere hazırlandı.
İçinde sadece iki dosya var: yönlendiren `index.html` ve kendini silen `sw.js`.

## BU DAL main'E MERGE EDİLMEZ

`index.html` ve `sw.js` adları uygulamanın kendi dosyalarıyla aynı. main'e
merge edilirse uygulamanın giriş sayfasını ve service worker'ını ezer.
Bu dal bir **deploy hedefi**, main'e giden bir değişiklik değil.

## Yayınlama sırası — önce yeni site canlı olmalı

1. `pazarapp.net` Cloudflare Workers'ta canlı ve doğrulanmış olsun.
   (Bundan önce yayınlanırsa kullanıcı hiçbir yere gidemez.)
2. GitHub → Settings → Pages → Source: **Deploy from a branch**
   → Branch: `mezar-tasi` / `(root)` → Save.
   Şu an Source "GitHub Actions"; deploy.yml artık Pages'e yayınlamadığı için
   Pages en son artifact'i sonsuza kadar servis etmeye devam eder — bu adım
   olmadan eski site donmuş hâlde yayında kalır.
3. Doğrula: `curl -s https://avkkann.github.io/pazar-app/ | grep refresh`
   ve `curl -sI https://avkkann.github.io/pazar-app/sw.js`

## Eski service worker ne olacak

Ölçüldü: eski `sw.js` yalnızca `./data/hal.json` ve `./data/anasayfa.json`
isteklerini yakalıyordu — HTML navigasyonunu ve kendi script'ini yakalamıyordu.
Bu yüzden `staleWhileRevalidate` güncelleme yolunda değil; tarayıcı bu dalın
`sw.js`'ini doğrudan ağdan çeker, `skipWaiting` + `clients.claim()` +
`unregister()` zinciri çalışır ve önbellekler silinir.

**Sınır:** kullanıcı eski adresi bir kez daha açmazsa bu script ona ulaşmaz.
Bir origin'in SW'si başka origin'den silinemez. Pratik zararı yok — mezar taşı
yayınlandıktan sonra o origin'de o iki veri dosyasını isteyen sayfa kalmıyor.

**Kurulu PWA'lar:** eski adresten kuranların `start_url`'ü `/pazar-app/`.
Uygulamayı açınca bu sayfa gelir ve `pazarapp.net`'e yönlenir; yeni adres
kurulu uygulamanın kapsamı dışında olduğu için tarayıcıda açılır. Sayfadaki
metin kullanıcıya yeni adresten tekrar eklemesini söylüyor.

## Google

GitHub Pages statik barındırma, 301/308 üretilemiyor (header yazılamıyor).
0 gecikmeli `meta refresh` + `rel=canonical` kullanıldı; Google bunu soft
redirect sayıp sinyali aktarır. Site hiç indekslenmemiş olduğu için (site:
sorgusu 0 sonuç) aktarılacak sıralama sermayesi de yok — yönlendirmenin
gerekçesi SEO değil, paylaşılmış linkler ve kurulu PWA'lar.
