# Pazar App — Proje Handoff (Claude için)

**Son güncelleme:** 2026-08-08 oturumu sonunda. Bu dosya her oturum başında okunur, sohbete asla ham metin olarak yapıştırılmaz.

---

## Amaç & bağlam

Mustafa (GitHub: avkkann), **Pazar App**'in tek geliştiricisi — Türk market fiyat karşılaştırma PWA'sı, `avkkann.github.io/pazar-app` (repo: `avkkann/pazar-app`, yerel yol: `C:\Users\MUSTAFA KARABIYIK\Desktop\pazar-app`). Misyon: gizli zamları, sahte indirimleri, gramaj hilelerini ortaya çıkarmak — A101, BİM, Migros, CarrefourSA, ŞOK, Tarım Kredi, Hakmar. Slogan: **"Marketteki gizli zamları gör."**

**İş akışı:** Dosya düzenlemeleri **Claude Code** ile doğrudan yapılır (Windows, PowerShell + Bash). Eski iki-Claude/OpenCode modeli bırakıldı — artık aynı oturumda hem karar veriliyor hem kod yazılıyor hem canlı doğrulanıyor. SQL şema değişiklikleri hâlâ Supabase SQL Editor'a verilir (Mustafa çalıştırır, Claude çalıştırmaz).

**İletişim tarzı:** Türkçe, kısa, doğrudan. Uzun terimlerden kaçın. Claude kısa gerekçeyle karar verir, seçenek listesi sunmaz — büyük ürün/mimari kararları hariç (onlarda sorar). Mustafa terminal çıktısını olduğu gibi yapıştırır, Claude özetlemeden okur.

**Supabase:** URL `https://gbgxxahhbfnulmyecxia.supabase.co`, region eu-central-1, project ID `gbgxxahhbfnulmyecxia`.

**Test:** iOS + web (masaüstü Chrome). Android kullanılmıyor, test/deploy talimatlarında Android'e referans verilmez.

---

## Mevcut durum (2026-08-08 itibarıyla)

### 2026-08-07/08 oturumu — sessiz altyapı görünür oldu, resim hattı onarıldı, ürün katmanı

**Sahte indirim rozeti UI'a çıktı (`307edf1`, `fb8dc0b`, `5e6cd77`).** 3 Temmuz'dan beri sessizce biriken `indirim_supheli_*` puanlaması artık ekranda: kartta rozet, ürün detayında açıklama kutusu. Rozet **yalnızca bir indirim iddiası varken** çizilir — ölçüt mevcut `indirimRozetiHesapla()`, yeni bir indirim tanımı uydurulmadı. Kutu eşiği **5**; `asiri_yuksek_oran` tek başına kutu açmaz (mevsimsel ürünler yanlış pozitif veriyordu). Puanlar tek istekte çekilir (`.gte('indirim_supheli_puan', 2)`, üç kolon, ~350 KB) ve Map'te tutulur; istek başarısız olursa hiçbir rozet gösterilmez ve hata basılmaz. Şüpheli ürünler ana sayfadaki "Bu hafta düşenler" şeridinden çıkarılıp kendi **"Bu indirimlere dikkat"** bölümüne alındı — "Tuzak" bölümüne dokunulmadı.

**Hakmar filtresi + market filtresinin kendisi onarıldı (`809a8e6`).** Hakmar rozeti vardı ama filtre pill'i, `MARKET_SIRALIYE` ve 3 yerde daha eksikti. Daha büyük bulgu: `uygulaCatFiltre` market seçimini **hiç uygulamıyordu** — listeyi daraltmıyor, sadece kart içindeki fiyatı değiştiriyordu. Artık gerçekten daraltıyor; "Seçili markette yok" kartı hiç oluşmuyor.

**`liste_fiyat` + `ilan_indirim_gecmisi` (`452f8da`).** marketfiyati API'si depot seviyesinde **`discountlessPrice`** (marketin ilan ettiği liste fiyatı) veriyordu, `parse_product` bunu atıyordu. Artık `market_fiyatlari` kayıtlarına `liste_fiyat` olarak yazılıyor, `_apply_ilan_indirim_gecmisi()` ile `ilan_indirim_gecmisi` JSONB'sine tarihçe birikiyor (yalnızca ilan edilen indirim VARKEN, değişince). Kolon Supabase'de açıldı ve `sync_db.py` yazıyor. UI'da **sadece ürün detayında** gösteriliyor, kartta değil. **Uyarı: `data/`'da henüz %0 kapsam** — 8 Ağustos gece koşusu 04:15 UTC'de başlamış, commit 05:22 UTC'de gelmiş, yani koşu eski scraper'ı kullandı. İlk gerçek veri **9 Ağustos koşusunda** gelecek. Tek kategoriyle canlı API ölçümünde kapsam ~%17 ve yalnızca `carrefour`/`migros`/`bim` alanı dolduruyordu.

**Resim doldurma adımı onarıldı (`f5f530d`, `a18a982`).** Sebep bulundu: **Searlo kredisi 27 Mayıs'ta bitmiş**, o günden beri (74 gün) her istek `402 INSUFFICIENT_CREDITS` dönüyor, kod durum kodunu sessizce yutuyordu — her gece 950 istek boşa atılıyordu. `_searlo_resim_ara` artık üçüncü dönüş değeri olarak `{"tur","kod","kalici"}` veriyor; kalıcı kodlar `SEARLO_KALICI_KODLAR = {401, 402, 403}`, geçiciler 429/5xx/timeout/bağlantı/boş sonuç. **5 ardışık kalıcı hatadan sonra tüm adım iptal ediliyor** (`ARDISIK_KALICI_ESIK`). Özet artık hata SAYISI değil **hata TÜRÜ dağılımı** basıyor. Ölçüm: 950 istek → 5; koşudan **1 sa 42 dk** düştü. Ayrıca `_apply_resim_koru()`: `parse_product` her gece `resim`'i `item['imageUrl']` ile eziyordu, Searlo'nun 26 Mayıs'ta doldurduğu 73 resim ertesi gece uçmuştu — API bu kez resim vermediyse dosyadaki korunuyor (`agirlik_hacim_gecmisi` deseni). `.env` okumasındaki `except Exception: pass` de kapatıldı: dosya okunamıyor ile anahtar hiç yok artık ayırt ediliyor.

**Profil ekranı zenginleştirildi (`56fd4db`).** Altı bölüm, hepsi **veriye bağlı** — verisi yoksa bölüm hiç çizilmiyor (boş kabuk yok): tasarruf, kayıtlı listeler (şablonlar), fiyat alarmları, market tercihi, katkılarım (`get_kendi_bildirim_sayim()` RPC'si — mevcut, anon'a kapalı), ve statik "Uygulama Hakkında" (önbellek temizle, uygulamayı paylaş).

**`?screen=` routing gerçekten çalışıyor (`1ba9a9e`, `3189f52`).** Harita sadece `{list, firsat, hal}` içeriyordu — MiniMax audit'inde "tamamlandı" yazılmıştı ama diğer ekranlar sessizce ana sayfaya düşüyordu. Artık 11 anahtar / 6 ekran: home+anasayfa, list+listem+sepet, firsat+firsatlar, profil, favori+favoriler, hal. **PWA kısayol adları (`list`, `firsat`, `hal`) aynen korundu.** Ayrı bir tuzak: routing script sonunda senkron koşuyor, Supabase oturumu asenkron geliyor — `?screen=favoriler` auth kapısından dönüyordu; auth gerektiren ekranlar için `pazarAuthReady` bir kez bekleniyor.

**Ürün katmanı (`1f03c31`, `7c165ab`, `a77c75e`, `2ac1939`).** Dördü de mevcut tasarım diline oturdu, yeni palet/bileşen yok:
- **Birim fiyat vurgusu** — `birimfiyat` sıralaması zaten vardı; eksik olan "bu listede en iyisi hangisi"ydi. `enIyiBirimIdleri()` her birim grubunda (kg/L/adet) tek kazanan seçiyor, mevcut `.urun-birim-fiyat` satırı yeşile (`#059669`) dönüp "· en ucuz" yazıyor. Grupta tek ürün varsa vurgu yok.
- **"Senin enflasyonun"** — sepetteki ürünlerin 30 günlük değişimi, iki tarafta da marketler arası en ucuz fiyat. Hesaba katılan ürün **3'ten azsa kart hiç çizilmiyor**. Düşüş yeşil, artış amber — kırmızı yok.
- **Sepeti böl + dürüst toplam** — "Toplam (en ucuz fiyatlar)" etiketi yanıltıcıydı; artık "N farklı markete giderek" yazıyor, altında market bazında **gerçek** toplamlar var. Eksik ürün başka marketin fiyatıyla doldurulmuyor. Kazanç ≥50 ₺ ise en iyi ikili öneriliyor, **ikiden fazla markete bölme hiç önerilmiyor**.
- **msSheet kapsam bilgisi** — "Marketleri Karşılaştır" sayfasında aynı yanıltma duruyordu: 2 ürünlük bir toplam, 4 ürünlük olanın yanında "daha ucuz" görünüyordu (sayı yanlış değildi, kıyaslanabilir gibi sunulması yanlıştı). Satırda "N ürün yok (tutar eksik)", footer'da seçili marketlerin kapsamı yazıyor.

### 2026-08-05/06 oturumu — hat onarımı + güven katmanı + masaüstü

**Deploy hattı onarıldı (`4081002`).** `update-data.yml`'ın varsayılan `GITHUB_TOKEN` ile attığı push, GitHub'ın döngü koruması yüzünden `deploy.yml`'ın `on: push` tetikleyicisini uyandırmıyordu. Sonuç: site **15 Temmuz – 5 Ağustos arası hiç build edilmedi**, kullanıcılar 21 gün boyunca 15 Temmuz verisini gördü (git ve Supabase her gün güncelleniyordu — kopukluk yalnızca yayın adımındaydı). `deploy.yml`'a `workflow_run` tetikleyicisi eklendi; build job'ına `if: conclusion == 'success'` koşulu ve checkout'a `ref: main` verildi.

**Temizlik kategorisi onarıldı (`e24b22d`).** marketfiyati.org.tr 25 Temmuz'da "Temizlik ve Kişisel Bakım"ı **"Temizlik Ürünleri" + "Kişisel Bakım"** olarak ikiye ayırmıştı. API eski isme hata değil **HTTP 200 + `numberOfFound: 0`** dönüyordu; scraper bunu ağ hatasıyla aynı dala düşürüp `[ATLA]` ile sessizce yutuyor, dosyayı hiç yazmıyordu. `urunler_temizlik.json` 12 gün 24 Temmuz'da dondu, `sync_db.py` bayat dosyayı her gece taze sanıp Supabase'e yazdı, iş yeşil geçti. Çözüm: `scraper.py`'de `API_KEYWORDS` sözlüğü — bir kategori birden fazla API adından çekilip `_sid` bazında tekilleştirilip tek dosyaya yazılıyor. `_sid` öneki ve `ana_kategori` fallback'i değişmedi, 2618 ürünün fiyat geçmişi korundu.

**Sessizlik bitti.** `scraper.py` artık boş sonuç ile ağ hatasını ayırıyor: ağ hatası `[HATA]`, boş sonuç **`[KRITIK] Kategori bos dondu (HTTP 200, numberOfFound=0)`**. Koşu kesilmiyor, diğer kategoriler işlenmeye devam ediyor. Ayrıca `scripts/veri_tazelik_kontrol.py` eklendi: herhangi bir `data/urunler_*.json` `ESIK_GUN`'den (2 gün) eskiyse `exit 1`. Workflow'un **en son** adımı — veri yine de aksın ama iş kırmızı olsun. `continue-on-error` YOK. `actions/checkout`'a `fetch-depth: 0` verildi (shallow clone'da `git log -1 -- <dosya>` çalışmıyor).

**`urunler.son_senkron` (timestamptz).** `sync_db.py` her koşuda tek bir UTC ISO 8601 damgası üretip (`SENKRON_ZAMANI`) tüm satırlara yazıyor. Hattın 3 hafta sessiz kalabilmesinin temel sebebi böyle bir damganın hiç olmamasıydı.

**Güven katmanı (`96e184b`).** Kullanıcıların bu tür uygulamalara en büyük itirazı "sitede yazan fiyat markette tutmuyor":
- `fiyatlariTemizle(market_fiyatlari)` — aykırı fiyat filtresi. 3+ markette kendisi hariç diğerlerinin medyanının 3 katından, 2 markette diğerinin 5 katından yüksek fiyat gizlenir. Dönüş `{ gecerli, gizlenen }`. **Kart, ürün detayı ve en ucuz/en pahalı hesabının üçü de bunu kullanır** — üçünde de aynı sayı çıkar. Gizlenen fiyat detayda tıklanınca açılır.
- **Tazelik chip'i** — ürün adının altında, `son_senkron`'a göre: 0-1 gün yeşil, 2-4 amber, 5+ gri + "Bu fiyat eski olabilir". Değer yoksa chip hiç çizilmez.
- **"Bu fiyat tutmadı"** — mevcut `modalAc()`'a `bodyHtml` slotu eklendi (yeni modal sistemi yazılmadı), market pill seçimi + isteğe bağlı raf fiyatı. Aynı `_sid`+market için 24 saat localStorage spam koruması.
- **Uyarı gösterimi** — açılışta `get_fiyat_bildirimleri()` RPC'si (security definer) bir kez çağrılıp bellekte Map'te tutulur, eşleşen market satırının altında amber uyarı. Fiyat gizlenmez.
- Fırsatlar sorgusuna `fiyat_farki_yuzde < 70` üst sınırı eklendi (kolon 100'le sınırlı; ölçümde 1224 üründen 7'si eleniyor).

**Masaüstü düzen, 1024px+ (`43ef8d1`, `3c50243`).** Uygulama PC'de 720px'lik dar bir sütuna sıkışıyordu. Listem, Profil ve Ürün Detayı iki sütuna alındı; içerik 1180px'e kadar genişleyip ortalanıyor. Tüm yeni kurallar dosya sonundaki **tek bir `@media (min-width: 1024px)`** bloğunda, mevcut kuralların değerlerine dokunulmadı. Düzen için `app.js`/`index.html`'e mobilde stilsiz kalan sarmalayıcılar eklendi (`.detay-sol`/`.detay-sag`, `.listem-ozet`, `.profil-kartlar`) ve üç ayrı `.detay-section` ayrılabilsin diye `--market`/`--gecmis`/`--alarm` modifier'ları verildi. Mobil geometri deploy öncesi/sonrası ölçülüp karşılaştırıldı: Listem ve Profil birebir aynı, Ürün Detayı yalnızca tazelik chip'inin yüksekliği kadar (+27px) kaydı.

**Tazelik damgası kategori ürünlerinde de çalışıyor.** `data/*.json`'a alan eklenmedi (15 bin ürünü şişirirdi); `loadCat()` `fetch` yanıtının `Last-Modified` başlığını okuyup o kategorinin ürünlerine besliyor. Başlık yoksa chip hiç gösterilmiyor.

**`hakmar` market rozeti eklendi.** Veride 1345 fiyat kaydıyla vardı ama `MARKET_NAMES`'te ve `.m-*` sınıflarında yoktu; `.m-tag { color:#fff }` arka planı olmayınca beyaz üstüne beyaz yazıyordu. `MARKET_NAMES`'e `hakmar:'Hakmar'` ve `.m-hakmar` rengi eklendi.

### Kaynak API (marketfiyati.org.tr) — ölçülmüş uçlar

- **`/api/v2/searchByCategories`** — scraper'ın kullandığı uç (`API_URL`). Kategori filtresi gerçekten çalışıyor. Sayfa boyutu 25'te tavanlı.
- **`/api/v3/searchByCategories`** — **`keywords` alanını tamamen yok sayıyor.** Hangi kategori sorulursa sorulsun (anlamsız bir kategori adı dahil) tüm katalog dönüyor: **16847 ürün**. "Aynı kategoride 4,6 kat ürün döndürüyor" yorumu bu yüzden yanlıştı; v3'e geçişin maliyet tahmini (9,3 saat / 66 MB) da geçersiz — v3 kategori bazlı çekim için kullanılamaz.
- **`/api/v2/search`** — gerçek bir metin arama ucu, çalışıyor. **Scraper kullanmıyor.** Kategori beyaz listesi dışında kalan ürünleri (örn. 'Makyaj') yakalamak için değerlendirilebilir.
- **`/api/v3/info/categories`** — kategori listesi.
- `imageUrl` **ürün seviyesinde** tutuluyor; `productDepotInfoList` kayıtlarında resim alanı yok.

### Testler (repoda takipli)

`.gitignore`'daki geniş `test_*.py` kuralı daraltıldı (`4cf6795`), kalıcı testler artık versiyonlanıyor. Hepsi gerçek kaynağı okur — JS testleri `app.js`'ten fonksiyon **kaynağını** çıkarıp `node:vm`'de çalıştırır, mantık kopyalanmaz.

| Dosya | Assertion | Neyi koruyor |
|---|---|---|
| `test_supheli.mjs` | 114 | Sahte indirim rozeti/kutusu, eşikler, puan cache'i |
| `test_profil.mjs` | 55 | Profil bölümleri, "verisi yoksa çizme" kuralı |
| `test_resim.py` | 53 | Searlo kalıcı hata kesmesi, resim koruma, `.env` okuma |
| `test_hakmar.mjs` | 39 | Hakmar bütünlüğü, market filtresinin gerçekten daraltması |
| `test_routing_duzen.mjs` | 36 | `?screen=` haritası, PWA kısayolları, masaüstü sütun dengesi |
| `test_ms_sheet.mjs` | 34 | msSheet kapsam bilgisi, eksik ürünün doldurulmaması |
| `test_enflasyon.mjs` | 34 | Enflasyon hesabı, 3 ürün eşiği, renk yönü |
| `test_sepet_bol.mjs` | 33 | Dürüst toplam, bölme önerisi, "ikiden fazla market yok" |
| `test_liste_fiyat.mjs` | 30 | `liste_fiyat` UI gösterimi (yalnızca detayda) |
| `test_birim_fiyat.mjs` | 22 | Birim fiyat vurgusu, diğer ekranların etkilenmemesi |
| `test_liste_fiyat.py` | 21 | `discountlessPrice` parse'ı, `ilan_indirim_gecmisi` birikimi |

### Backend / DB — 2026-07-08 geçişi (hâlâ geçerli)
Frontend'in ağır noktaları (8 kategori JSON dosyasını client'ta indirip tarama) tek tek DB sorgusuna taşındı:
- **Fırsatlar sekmesi** → doğrudan Supabase sorgusu (`ust_kategori`/`fiyat_farki_yuzde`/`fiyat_farki_tl` generated column'ları üzerinden)
- **Profil "toplam ürün" sayacı** → tek `count` sorgusu
- **Ana sayfa "Bu hafta düşenler"** → `get_fiyat_dusenler()` RPC
- **"Bugün yakaladığımız tuzaklar"** → hâlâ client'ta 8 dosya indirip tarıyor (bilinçli, aşağıya bak)

**`data/urunler.json` tamamen kaldırıldı** — kalıcı olarak bayattı. Kaynak artık sadece 8 kategori dosyası (`urunler_meyve.json` ... `urunler_dondurulmus.json`).

### DB kolonları
`urunler` tablosunda:
- `ust_kategori` (generated, `ana_kategori`'den CASE ile — meyve/sebze/et/sut/gida/icecek/temizlik/atistirmalik/dondurulmus/diger)
- `fiyat_farki_tl`, `fiyat_farki_yuzde` (generated, `market_fiyatlari` JSONB'den min/max, `jsonb_fiyat_max()` yardımcısı)
- `agirlik_hacim_gecmisi` JSONB (plain, sessiz toplama)
- `indirim_supheli_puan`, `indirim_supheli_sebepler`, `indirim_supheli_dusus_yuzde` (plain, `indirim_analiz.py` her gece yazar)
- `son_senkron` timestamptz (2026-08-05'te eklendi, `sync_db.py` yazar)
- `ilan_indirim_gecmisi` JSONB (2026-08-08'de eklendi, `NOT NULL DEFAULT '[]'`; `sync_db.py` yazar, ilk dolu koşu 2026-08-09)
- `market_fiyatlari` kayıtlarında `liste_fiyat` (API'nin `discountlessPrice`'ı; şema değişikliği değil, JSONB içinde alan)

`fiyat_bildirim` tablosu (2026-08-06): kullanıcı fiyat bildirimleri. **Yetkiler:** `authenticated` INSERT edebilir, SELECT/DELETE **edemez**; `anon` hiçbir şey yapamaz. Okuma yalnızca `get_fiyat_bildirimleri()` RPC'si üzerinden (security definer). RPC'nin içinde bir eşik var — tek bildirimde boş dönüyor.

RPC fonksiyonları: `get_fiyat_dusenler(p_limit)`, `indirim_puan_toplu_guncelle(guncellemeler jsonb)`, `get_fiyat_bildirimleri()`, `get_kendi_bildirim_sayim()` (2026-08-08, security definer; anon'a kapalı — profil "Katkılarım" bölümü bunu kullanır).

### Tuzak kararı (2026-07-03/08, 2026-08-06'da güncellendi)
- **Bulgu:** `tuzakRozetiHesapla()` (`app.js`) sadece aynı ürünün farklı paket boyutları arasındaki birim fiyat farkını gösteriyor — tüketici markette kendi hesaplayabilir, gerçek farklılaşma değil.
- **Karar:** Sekmenin **kaldırılması düşünülüyor**; yerini alacak iki madde (sahte indirim rozeti ve birim fiyat gösterimi) 2026-08-07/08'de tamamlandı. Sekme şimdilik olduğu gibi duruyor, geliştirilmiyor.
- **Yerine kurulan gerçek özellik: Sahte indirim tespiti.** `indirim_analiz.py` (GitHub Actions'ta `sync_db.py`'dan hemen sonra, `continue-on-error: true`) her ürünün `fiyat_gecmisi`'ni 4 sinyalle puanlıyor: kısa zirve süresi, yüksek oynaklık, tekrarlı pompa-indirim döngüsü, aşırı yüksek indirim oranı (≥%50). **2026-08-07'de UI'a çıktı** — rozet indirim iddiasına bağlı, kutu eşiği 5, `asiri_yuksek_oran` tek başına kutu açmıyor (yukarı bak).
- **Shrinkflation:** `_sid` ürün adından üretildiği için gramaj değişince yeni `_sid` doğuyor. `agirlik_hacim_gecmisi` sessiz toplaması sürüyor. **3-6 ay veri birikmeden analiz başlamaz.**

### MiniMax audit (2026-07-01 dokümanı — P0 bitti)
- **Tamamlanan:** SEO meta paketi, robots.txt+sitemap.xml, theme_color tutarlılığı (`#0E4938`), manifest shortcuts+lang+id+categories+screenshots, `?screen=` query routing (yarım kalmıştı — 2026-08-08'de gerçekten tamamlandı), auth formu iyileştirmeleri, 5 native alert/confirm/prompt → `modalAc()`, veri kaynağı attribution footer, GoatCounter analytics, WhatsApp paylaşım mesajı, sepete-ekleme toast+haptik, 3 sayfalık onboarding, PWA kurulum banner'ı.
- **P1-T1 (Vite/build pipeline) TAMAMLANDI** — 2026-07-10'da geldi (`54d3ec2` inline script/style → `app.js`+`style.css`, `dd4c6a7` Vite + Pages deploy). Artık `npm run build` = `scripts/prepare-public.mjs` (static/, data/, manifest, robots, sitemap, sw.js → `public/`) + `vite build` → `dist/`. `app.js` içeriğinin sha256'sından hash'lenmiş dosya adı üretiliyor.
- **Stale/dismissed:** P0-T1, P0-T2, P1-T3, P1-İ1.
- **Bilinçli atlandı:** P0-G1 (KVKK — "uygulama bitince"), P0-U2 (5. nav sekmesi), P0-U3 (kontrol edildi, zaten doğru).
- **Hâlâ karar bekliyor:** P1-T2 (CSP header — hosting migration gerektirir), P1-B1 (tuzak public landing — tuzak'ın geleceği belirsizken erken).
- **Henüz bakılmadı:** P1-U1 (erişilebilirlik taraması), P1-U2 (offline banner), P1-B2 (push izni zamanlaması), P2 maddeleri.

### Repo hijyeni
`.gitignore` düzeltildi (`supabasepas.txt` → `supabasepw.txt`) + `kesif_*.py`, `kesif_a101_ham.html`, `a101_pilot_*.py`, `migrate_*.py`, `data/a101_*.json`, `node_modules/`, `dist/`, `/public/` eklendi. Bu dosyalar hâlâ diskte duruyor — silme kararı verilmedi. **2026-08-08:** geniş `test_*.py` kuralı daraltıldı (`4cf6795`) — kalıcı testler artık takip ediliyor, yalnızca geçici keşif script'leri yok sayılıyor.

---

## Bekleyen / ertelenen işler

**Ürün yönü (öncelik sırasıyla):**
1. **Searlo kredisi kararı** — resim doldurma adımı artık boşa koşmuyor ama **hiç resim de doldurmuyor**. Ya kredi yenilenecek ya alternatif kaynak seçilecek ya da adım tamamen kaldırılacak. Alternatif kaynak araştırması bilinçli olarak yapılmadı — ayrı karar, Mustafa'da.
2. **Gramaj hilesi (shrinkflation) analizi** — `agirlik_hacim_gecmisi` birikiyor, veri bekliyor (3-6 ay).
3. **İlan edilen indirim vs gerçek düşüş karşılaştırması** — `ilan_indirim_gecmisi` ile `fiyat_gecmisi`'ni karşılaştırıp "ilan edilen indirim gerçek mi" sorusunu cevaplamak. Veri bekliyor; ilk dolu koşu 2026-08-09.
4. **"Tuzak" sekmesinin kaldırılması** — yerini alacak özellikler tamamlandı, karar Mustafa'da.

**Teknik borç / arıza:**
- **`.filter-pill` dokunma hedefi 44×44'ün altında** — `padding: 5px 13px` + `font-size: .7rem`. Erişilebilirlik minimumunu karşılamıyor.
- **Sürüm numarası tek kaynaktan gelmiyor** — `index.html:484`'te `v1.0` elle yazılı, `sw.js`'teki `CACHE_NAME` ile hiçbir bağı yok.
- **`style.css`'te iki adet birebir aynı ölü `@media` bloğu** (`CENTER-FIX-TAMAM` ×2) — temizlenmedi.
- **`'Makyaj'` kategorisi (70 ürün) `app.js` beyaz listesi dışında** — Temizlik sekmesi yerine "diger"e düşüyor. Kategori bölünmesinden önce de böyleydi. (`/api/v2/search` ucu bu tür artıkları yakalamak için değerlendirilebilir.)
- **`marketfiyati.json`** — bayat/farklı kaynak, hâlâ `marketfiyatiYukle()`/productMap fallback'inde. `urunler.json` gibi bir sonraki temizlik adayı.
- **`kesif_*`/`migrate_*`/`a101_pilot_*` dosyaları** — gitignore'da ama diskte, silme kararı Mustafa'da.

**Diğer:**
- **KVKK aydınlatma metni** — uygulama bitince (Mustafa kararı).
- **OG image** — gerçek tasarlanmış görsel yok.
- **A101 Kapıda entegrasyonu** — pilot scraper hazır, DB'ye nasıl ekleneceği kararı bekliyor.
- **P1-T2 (CSP/hosting migration), P1-B1 (tuzak landing), P1-U1/U2/B2, P2** — tartışılmadı.

---

## Kritik öğrenmeler

- **GitHub Actions, varsayılan `GITHUB_TOKEN` ile atılan push'lardan yeni workflow TETİKLEMEZ** (sonsuz döngü koruması). İstisnası `workflow_run` ve `workflow_dispatch` — PAT/secret gerekmez. Bir workflow'un commit'i başka bir workflow'u tetiklemeli diyorsan `workflow_run` kullan. Bu tam olarak 21 gün fark edilmeden yayının durmasına yol açtı.
- **Kaynak sitedeki kategori/isim değişiklikleri sessizce gelir; API hata değil BOŞ SONUÇ döner.** Boş sonuç ile ağ hatasını asla aynı dala düşürme — biri retry ister, diğeri insan müdahalesi. Boş sonuç sesli olsun (`[KRITIK]`) ve mümkünse hattı görünür şekilde kırmızıya çevirsin. Sessiz `[ATLA]` + "dosyayı hiç yazma" kombinasyonu bayat veriyi 12 gün taze gösterdi.
- **`showScreen()` aktif ekrana inline `display: block` yazıyor.** Bu yüzden `#screen-*` seçicisine CSS'ten `display: grid`/`flex` vermek ÇALIŞMAZ (inline stil stil sayfasını ezer). Düzeni her zaman bir iç sarmalayıcıya ver (`.profil-kartlar` gibi).
- **Claude in Chrome'da `resize_window` çalışmıyor** — başarı raporluyor ama sayfanın viewport'u değişmiyor (`outerWidth: 0`). Responsive test için aynı origin'de **iframe** aç (`<iframe width=390>`); medya sorguları iframe genişliğine göre değerlendiği için gerçek render verir. Not: ekran geçiş animasyonu iframe'de tamamlanmadığı için `.screen` `translateX(100%)`'te takılı kalabilir — ölçümden önce `anim-slide-in`/`anim-slide-out` sınıflarını kaldır.
- **Dosya tazeliğini `fetch` yanıtının `Last-Modified` başlığından okuyabilirsin** — 15 bin ürünlük JSON'a satır başına zaman alanı eklemeye gerek yok. Başlık yoksa özelliği sessizce kapat.
- **PostgREST upsert, kısmi kolon seti ile NOT NULL ihlali verir.** `POST /rest/v1/table?on_conflict=col` arka planda `INSERT ... ON CONFLICT DO UPDATE` çalıştırır; INSERT tarafı NOT NULL kolonlar için değer ister, UPDATE'e düşecek olsa bile. Sadece var olan satırları güncelleyecek toplu yazmalarda özel SQL fonksiyonu yaz: `UPDATE ... FROM jsonb_to_recordset($1) AS x(...) WHERE tablo._sid = x._sid`.
- **PostgREST'te `Prefer: return=representation` SELECT yetkisi ister.** INSERT yetkisi olup SELECT olmayan bir tabloya yazarken `return=minimal` kullan, yoksa satır yazılsa bile 403 alırsın.
- **Windows PowerShell `&&` desteklemiyor** — `;` kullan veya ayrı çağrı yap. Bash tool'unda `&&` çalışır ama `grep` eşleşme bulamayınca exit 1 döner ve zinciri keser; kontrol amaçlı grep'leri `;` ile ayır.
- **Scraper tam koşusu ~2 saat sürüyor.** Manuel tetikleme kararı verirken hesaba kat; tek kategoriyi test etmek için `scrape_category()`'yi doğrudan çağıran küçük bir script yaz.
- **Smooth scroll (`behavior:'smooth'`) otomatik tarayıcı testinde animasyonlanmıyor.** Sayfa/adım takibini scroll pozisyonundan DEĞİL kendi sayacından yap.
- **Windows'ta `core.autocrlf=true`** — disk kopyası CRLF, git blob'u LF. Canlı içerikle yerel dosyanın sha256'sı bu yüzden tutmaz; karşılaştırmayı `git show HEAD:dosya` ile yap.
- **Dış servis sessizce ölebilir.** HTTP durum kodunu asla yutma. Kalıcı hatada (401/402/403) döngüyü kes — retry'ın düzeltemeyeceği bir şeyi 950 kere denemek 1,7 saat yakar. Log'a hata SAYISI değil **hata TÜRÜ** bas; "950 hata" hiçbir şey anlatmıyordu, `402 INSUFFICIENT_CREDITS: 5` teşhisin kendisi. Bu deseni iki kere yedik: temizlik kategorisi (HTTP 200 + boş sonuç) ve Searlo (402, 74 gün).
- **Türetilmiş alan her koşuda sıfırdan kuruluyorsa "eskiyi koru" adımı şarttır.** Resim, geçmiş, zenginleştirme — kaynak bu kez vermediyse dosyadaki değer korunmalı, yoksa doldurulan veri ertesi gün silinir. Searlo'nun doldurduğu 73 resim tam olarak böyle uçtu; `agirlik_hacim_gecmisi` deseni doğru desen.
- **`imageUrl` kaynakta ÜRÜN seviyesinde tutuluyor, depot seviyesinde değil.** `productDepotInfoList` kayıtlarında resim alanı yok — "şu marketin resmi yok" diye bir şey mümkün değil. Bir markette resimsizlik oranı yüksekse sebep o market değil, o markette satılan ürünlerin kendisidir.
- **Yanıltıcı toplam deseni.** Eksik kapsamlı bir toplamı tam kapsamlı olanın yanında göstermek kullanıcıyı yanlış markete yönlendirir — sayı doğru olsa bile. Toplam gösteren her yerde **kapsamı da yaz** ("N ürün yok"), ve eksiği asla başka bir kaynağın değeriyle doldurma. Bu tuzağa aynı üründe iki ayrı ekranda düştük (Listem ve msSheet).
- **"Artık kimsenin okumadığı ama hâlâ üretilen" dosyalar bir tuzak** (`urunler.json` iki kere yanlışlıkla kaynak alındı). Yeni özellik yazarken önce `grep` ile gerçekten kim okuyor/yazıyor diye bak, dokümantasyona/hafızaya güvenme.

---

## Yaklaşım & desenler

- **SW cache version** her anlamlı `index.html`/`app.js`/`style.css`/`sw.js` değişikliğinde artırılır (şu an **v180**). Backend-only değişikliklerde (scraper, sync) bump edilmez. Akış: `git add` → `git commit` → `git pull --rebase` → `git push`.
- **Doğrulama:** Push sonrası `gh run watch` ile deploy'un koştuğu doğrulanır, sonra canlıda (Browser MCP) gerçek fonksiyonel test yapılır — "dosyada var mı" değil, "gerçekten çalışıyor mu". Layout değişikliklerinde ekran görüntüsü yetmez: değişiklikten ÖNCE geometri parmak izi (`getBoundingClientRect`) alınıp sonra sayısal karşılaştırılır.
- **Kapsam disiplini:** İstenmeyen ekleme/çıkarma sessizce yapılmaz, not düşülür. Doküman/analiz önerileri körü körüne uygulanmaz — önce kodda geçerli mi diye bakılır.
- **Büyük ürün/mimari kararları** (hosting migration, nav yapısı, tuzak'ın geleceği) Mustafa'nın onayı olmadan koda dökülmez.
- **Ölçüm önce, kod sonra:** Bir eşik/filtre önerilirse gerçek veride kaç kayıt etkiliyor diye ölçülür. (Fırsatlar için önerilen 400 üst sınırı ölü koddu — kolon 100'le sınırlıydı, gerçek eşik 70 çıktı.)

---

## Araçlar & kaynaklar

- **Claude Code** — dosya düzenlemeleri, git, gh CLI, canlı doğrulama (Windows; PowerShell ve Bash ayrı sözdizimi)
- **Supabase** — auth, DB, Edge Functions, RPC (`get_fiyat_dusenler`, `indirim_puan_toplu_guncelle`, `get_fiyat_bildirimleri`, `jsonb_fiyat_max`)
- **GitHub Actions — `update-data.yml`** (cron `0 3 * * *`, ~2 saat): checkout (`fetch-depth: 0`) → setup-python → pip install → `scraper.py` → `hal_scraper.py` → veri commit+push → **DB Senkronizasyonu** (`sync_db.py`) → **Sahte Indirim Analizi** (`indirim_analiz.py`, `continue-on-error`) → **Fiyat Alarmı Taraması** (curl edge function) → **Veri Tazelik Kontrolü** (`scripts/veri_tazelik_kontrol.py`, en son, kırmızıya çevirir). Secrets: `SEARLO_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`.
- **GitHub Actions — `deploy.yml`** ("Build ve Deploy"): `push` + **`workflow_run` ("Veri Guncelle" completed)** + `workflow_dispatch`. `npm ci` → `npm run build` → Pages deploy.
- **Vite** — `npm run build` = `scripts/prepare-public.mjs` + `vite build` → `dist/`. `base: '/pazar-app/'`.
- **GoatCounter** (`pazar-app.goatcounter.com`) — analytics, kartsız/ücretsiz, çerezsiz
- **Claude in Chrome (Browser MCP)** — canlı doğrulama; `resize_window` çalışmıyor (iframe kullan), smooth-scroll animasyonlanmıyor
- **gh CLI** — `gh run list/watch/view --log`, deploy ve veri koşusu doğrulaması

---

## Diğer talimatlar

- Mustafa Android kullanmıyor — iOS ve web (masaüstü Chrome) üzerinden test ediyor.
- CLAUDE.md sohbete asla ham metin olarak yapıştırılmaz, sadece dosya olarak paylaşılır.
