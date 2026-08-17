# Pazar App — Proje Handoff (Claude için)

**Son güncelleme:** 2026-08-17 oturumu sonunda. Bu dosya her oturum başında okunur, sohbete asla ham metin olarak yapıştırılmaz.

---

## Amaç & bağlam

Mustafa (GitHub: avkkann), **Pazar App**'in tek geliştiricisi — Türk market fiyat karşılaştırma PWA'sı, `avkkann.github.io/pazar-app` (repo: `avkkann/pazar-app`, yerel yol: `C:\Users\MUSTAFA KARABIYIK\Desktop\pazar-app`). Misyon: gizli zamları, sahte indirimleri, gramaj hilelerini ortaya çıkarmak — A101, BİM, Migros, CarrefourSA, ŞOK, Tarım Kredi, Hakmar. Slogan: **"Marketteki gizli zamları gör."**

**İş akışı:** Dosya düzenlemeleri **Claude Code** ile doğrudan yapılır (Windows, PowerShell + Bash). Eski iki-Claude/OpenCode modeli bırakıldı — artık aynı oturumda hem karar veriliyor hem kod yazılıyor hem canlı doğrulanıyor. SQL şema değişiklikleri hâlâ Supabase SQL Editor'a verilir (Mustafa çalıştırır, Claude çalıştırmaz).

**İletişim tarzı:** Türkçe, kısa, doğrudan. Uzun terimlerden kaçın. Claude kısa gerekçeyle karar verir, seçenek listesi sunmaz — büyük ürün/mimari kararları hariç (onlarda sorar). Mustafa terminal çıktısını olduğu gibi yapıştırır, Claude özetlemeden okur.

**Supabase:** URL `https://gbgxxahhbfnulmyecxia.supabase.co`, region eu-central-1, project ID `gbgxxahhbfnulmyecxia`.

**Test:** iOS + web (masaüstü Chrome). Android kullanılmıyor, test/deploy talimatlarında Android'e referans verilmez.

---

## Mevcut durum (2026-08-17 itibarıyla)

### 2026-08-11/17 oturumları — denetim borcu kapatıldı, karşılaştırma satırı yenilendi, SEO zemini kuruldu

Bu aralık `DENETIM.md`'nin (2026-08-11) bulgularını kapatmakla geçti. Sürüm eşlemesi: **v199** iddia doğrulaması, **v200** klavye+odak, **v201** sessiz catch, **v202** koyu tema + dokunma hedefleri, **v203** kalan satır içi tetikleyiciler, **v204** karşılaştırma satırı, **v205** son klavye açıkları, **v206** SEO.

**Sayısal iddialar HAM seriye karşı doğrulanıyor (`4d3dc47`, v199).** Değer düzeltmesi temiz seriye geçmişti ama rozet metni hâlâ "30 günün en düşüğü" diyordu — iddia ham seriyle çelişiyordu. `_hamDipMi()` kapısı kondu: iddia neyi kapsıyorsa o seriye karşı sınanıyor. Gerçek indirim rozeti 1492/91 yanlış (**%6,1**) → 1401/0 (**%0**); alarm cümlesi 9 yanlış → 0 (170 sustu), al/bekle 17 çelişki → 0 (94 sustu). En kötü sapma %45,5'ti. `indirimRozetiHesapla` ve `fiyatGecmisiBlogu` zaten ham seriden okuyordu, dokunulmadı.

**Klavye erişimi ve odak göstergesi (`ed290fd` v200, `e015eff` v203, `4bd0d19` v205).** Denetim ölçümü: onclick taşıyıp klavyeye kapalı **51 öğe**, sayfadaki toplam odaklanabilir öğe 15 ve **15'inin de** odak göstergesi yok. Uygulamanın ana işlevi — ürün detayına gitmek — klavyeye ve ekran okuyucuya tamamen kapalıydı. Üç turda 51 → 10 → 0 (taranan desende). `_kartTus`/`_satirTus` Enter+Space işleyicileri, `:focus-visible` halkaları (**10 kural**), toggle'da `aria-pressed`. `maximum-scale=1.0` kaldırıldı, yakınlaştırma serbest. **Modal arka planları (`.auth-sheet__backdrop`, `.app-modal-backdrop`, `.ms-sheet-backdrop`, `.mf-sheet-backdrop`) bilerek dışarıda** — arka planı tab sırasına sokmak ekran okuyucuda anlamsız bir durak yaratır, klavye yolu Escape dinleyicileri. **Ama tarama kör noktası bir öğeyi atladı, aşağıdaki teknik borca bak.**

**40 sessiz catch görünür yapıldı (`456a831`, v201).** **17 çıplak `catch(e){}` + 23 açıklamasız → 0 + 0.** Ölçüt "yutulan hata ne demek, kullanıcı ne kaybeder": kullanıcı bir şey kaybediyorsa **18'i** `console.warn`'a çıktı (`loadPazarFavoriler` favorileri EKSİK gösteriyordu, `gecmisVeriGetir` rozet/alarm/al-bekle'yi sessizce düşürüyordu, `supheliPuanlariYukle` hiç rozet çizmiyordu), kaybettirmeyen **22'sine** neden yorumu yazıldı. 38 `console.warn/error`, her biri ≥12 karakter anlamlı metin. `test_sessiz_catch.mjs` koruma testi: yeni çıplak catch eklenirse kırılır. Bu desen projeye üç kez pahalıya mal oldu (temizlik kategorisi 3 hafta, Searlo 74 gün, `loadData` TypeError 1 ay).

**Koyu tema kontrastı (`d87b286` + `cf83c5f`, v202).** Denetim: koyu tema açık temadan **kötü** durumdaydı (10 AA ihlali vs 7). **Kök neden değişken mimarisi DEĞİLDİ** — `[data-theme="dark"] { --card-bg:#1C2823 }` doğru kuruluydu ve elemanda doğru çözülüyordu. Gerçek kök neden: **auth modalinin koyu tema override'ı hiç yazılmamıştı** (grep: 0 kural), modal koyu temada açık zeminde açık gri metinle çiziliyordu → "veya" ayracı 2,54, `.auth-tab` 4,39. İki nokta daha: `.nav-btn.active` parlak yeşil zeminde beyaz metin 2,54 → koyu metin (#0F1A14); `.profil-item-icon` pastel çip zeminini koruyup metnini `--text`'e çeviriyordu 1,01 → ön plan koyu bırakıldı. Düzeltmelerin hepsi mevcut koyu tema paletinden. Yanlış pozitif olarak **dokunulmayanlar:** `.auth-submit` (gradient zemin, beyaz metin doğru), `.sr-only` (görsel olarak gizli).

**Dokunma hedefleri (`cf83c5f` v202, ölçüm `3937aae`).** 15 sınıfa **görünmez `::after` katmanı** (min-width/height 44px, ortalanmış): görsel boyut, padding, font, radius ve yerleşim aynı, yalnızca basılabilir alan büyüyor. Kaydırılabilir şeritlerde komşu hedefler üst üste binmesin diye `.firsat-tab` ve `.tazelik-chip` yalnızca dikey tamamlanıyor. Geometri parmak izi ilk turda ALINMAMIŞTI; iframe yöntemiyle 390px ve 1440px'te ölçüldü: ölçülebilen **8 sınıfın hepsi 44×44 geçiyor, altında kalan 0**, geometri değişmedi (`.add-btn` 30×30 → 44×44, `.filter-pill` 59×26 → 57×44, `.siralama-btn` 142×32 → 140×44).

**`.cat-card` koyu tema "hatası" YOKMUŞ (`17d6123`).** Kalıcı bir kusur değil, stil yeniden hesaplaması oturmadan alınan ölçümün **yanlış negatifi**ydi. Reflow zorlanınca `.cat-card` koyu temada `rgb(28,40,35)` okuyor — düzeltme baştan çalışıyordu. `.zam-yayginlik` ve `.ms-subtitle` de aynı sebeple "düzelmemiş" görünüyordu. Ayrıntı Araçlar bölümündeki `getComputedStyle` maddesinde.

**"Sahte İndirim Analizi" artık sessizce atlanamıyor (`c1005db`).** Adım `continue-on-error: true` ile koşuyor; başarısız olunca `indirim_supheli_*` kolonları güncellenmiyor ama hemen ardındaki "Ana Sayfa Şeritleri" ESKİ puanlarla şeridi üretiyor ve iş YEŞİL geçiyordu. Tazelik kontrolü yakalamıyordu: dosya taze, **içeriği** bayat. Kolonların kendi zaman damgası olmadığı için **başarı damgası** kondu: `indirim_analiz.py` yazma gerçekten yapıldıysa (`basarili > 0`) `data/indirim_analiz_son.json` yazıyor; hiçbir batch yazılamadıysa damga yazılmıyor ve `[KRITIK]` basılıyor. Tazelik kontrolü artık `anasayfa.json` **ve** `indirim_analiz_son.json`'ı izliyor. `continue-on-error` bilerek kaldı — koşu kesilmesin ama sessiz kalmasın.

**Karşılaştırma sonuç satırı yeniden tasarlandı (`3029609`, v204).** "Marketleri Karşılaştır" sonuç ekranı (`.cmp-mkt-*` ailesi, `_cmpItemHTML`) 30px görsel + tek satır ada sıkışmıştı, ad `nowrap`+ellipsis ile kesiliyordu. Görsel **30 → 56px**, ad iki satıra sarıyor (`line-clamp: 2`), ikinci satırda **gramaj + birim fiyat** var. Birim fiyat `_birimFiyatHam()` ile **atanan** market fiyatından hesaplanıyor (`birimFiyatHesapla` global minimumu kullanıyor, o değişmedi) — gramaj sepette vardı ama `hesaplaSecili` projeksiyonunda düşüyordu. Dürüstlük bilgisi aynen duruyor: "N ürün yok (tutar eksik)", footer kapsam uyarısı, market başına gerçek toplam. Yeni palet/bileşen yok, yeni kurallar yalnızca `cmp-*` hedefliyor.

**SEO zemini (`ad144e6`…`4e9e5d6`, v206).** Zemin taraması: robots/canonical/meta robots temiz, `noindex` yok, cloaking yok — **indekslenmemenin teknik engeli yoktu**. Düzeltilenler:
- **`og:image`** — 1200×630 paylaşım kartı. Kaynak `static/og-image.svg` (marka gradyanı #0E4938→#1D9E75, krem #E8DCC4, uygulama ikonu base64 gömülü), PNG `node scripts/og-gorsel-uret.mjs` ile **Chrome headless `--screenshot`** üzerinden üretiliyor (makinede ImageMagick/rsvg/sharp yok; Chrome sitenin motoru, Inter webfont'unu aynı çözüyor). 381 KB. Kontrast beyaz/#0E4938 9,86:1. Kartta **alan adı yazılmadı** — geçiş yakın, bayatlardı. `twitter:card` `summary` → `summary_large_image`.
- **Tek h1** — 8 `<h1>` (her ekran için bir tane, hepsi aynı anda DOM'da) → 1 h1 (`Pazar`) + 7 h2. CSS'te yalnızca seçici taşındı; 8 ekranın geometri parmak izi **birebir aynı**, değişen tek şey etiket adı. Onboarding'in 3 h2'si h1'den önce ama overlay `display:none`, seviye atlaması değil.
- **Meta açıklama** 196 → **153 karakter** (Google ~155'te kesiyor, "...tasarruf et" hiç görünmüyordu). Market adlarını saymak yerine ne işe yaradığını anlatıyor.
- **`<noscript>`** — sorun "içerik yok" değildi: `#splash` `position:fixed/inset:0/z-index:9999/#fff` ve onu **sadece app.js** kaldırıyor, yani ham HTML'deki 2475 karakter metnin üstü kapalıydı. İki blok: head'de `<style>` splash'i kaldırıyor, body'de `.nojs` paneli ne olduğunu anlatıyor.
- **Sitemap `lastmod`** — kaynakta tarih yok, yer tutucu var; `scripts/sitemap.mjs`'in iki saf fonksiyonu damgayı `data/anasayfa.json`'un `uretim` alanından alıyor (içerikten, mtime'dan değil — CI'da checkout mtime'ları eziyor). Tam ISO damgası, güne **kırpılmadan**.

### 2026-08-09/11 oturumu — ana sayfa 16× hızlandı, zam ölçütü yeniden kuruldu, hayalet zam bulundu

**Ana sayfa önceden hesaplanıyor (`aa60d59`, `5e54234`, `4f97113`, `158bf81`).** Dört şerit (tuzaklar, düşenler, dikkat, zam) build zamanında `scripts/anasayfa-uret.mjs` ile hesaplanıp `data/anasayfa.json`'a yazılıyor: **168 KB ham / 26 KB gzip**. Ana sayfanın indirdiği: **2,09 MB → 0,13 MB gzip** (17,14 MB → 0,67 MB ham), 15 → 8 istek. Asıl kazanç ağda değil hesapta: **tuzak taraması 16.807 üründe 14.701 ms sürüyordu** ve şerit 18.311 ms'de çiziliyordu — o tarama kritik yoldan tamamen çıktı, dört şerit artık `requestIdleCallback` bile beklemiyor.

> **Mantık YENİDEN YAZILMADI.** Üretici `app.js`'i `node:vm` içinde **olduğu gibi** koşturup kendi fonksiyonlarını çağırıyor (`zamHavuzu`, `tuzakRozetiHesapla`, `supheliDurum`, `indirimRozetiHesapla`, `_seriKur`). Betikte tek bir eşik, filtre veya sıralama kuralı yok; Supabase için yalnızca taşıma katmanı (PostgREST'e `fetch`) var. Bu kural bilerek kondu — iki ayrı uygulama = kaçınılmaz sapma.

**Şehir filtresi bozulmadan korundu.** `zamAdaylari()` ikiye ayrıldı: `zamHavuzu()` şehirden bağımsız (ürünün HER marketi için artış), `zamSecHavuzdan()` şehir filtresi + çeşitlilik + `ZAM_MAX`. `zamAdaylari() = zamSecHavuzdan(zamHavuzu())`. Build havuzu yazıyor, istemci **aynı** `zamSecHavuzdan`'ı koşuyor. 6 senaryoda (seçim yok / İstanbul / Erzurum / Trabzon / Gaziantep / İzmir) liste ve yaygınlık metni **birebir aynı, fark 0**; tuzaklarda kırmızı 30/30, sarı 30/30, rozet farkı 0.

**Tembelleştirme (`5e54234`).** `gecmis_fiyatlar.json` (4,2 MB / 653 KB gzip) ana sayfada artık **inmiyor**; yalnızca ürün detayı, kategori ekranı ve profil enflasyonu açılınca `gecmisGerekli(yenile)` ile yükleniyor ve veri gelince ekran bir kez yenileniyor. `loadCat` uçuştaki isteği `_catYukleniyor` Map'inde tekilleştiriyor — öncesinde her kategori JSON'u **iki kez** iniyordu (`urunler_et` 733 ms ve 734 ms), çünkü iki şerit `loadAllCats()`'i eş zamanlı çağırıyordu. Canlı test: kategori 3 kez hızlıca açıldı → her dosya 1 kez indi.

**Zam ölçütü MARKET BAZLI oldu (`52a2c0d`, `4df772a`).** Ölçüt günlük EN UCUZ seriye bakıyordu; bir market zamlanmayınca minimum onu izliyor ve ürün eşiği hiç geçemiyordu. Eşiği geçen 159 ürünün 153'ü tek markette satılan ürünlerdi. Market bazlı seriye geçince: 295 ürün-market çifti, birden çok markette satılan **6 → 118**, "biri zamlı diğeri aynı" **0 → 91**. Çeşitlilik kuralı: marka başına ≤2, alt kategori başına ≤3; kural yüzünden liste dolmazsa **eşik düşürülmez**.

**Salınım elemesi (`f6ec19b`).** Ölçütün ilkesi zaten "eski seviyeye dönüş zam değildir"di; zikzak bunun ihlal edilmiş hâliydi (Lux Zigzag: `27 → 85,90 → 28 → 85,90`). `zamSalinimVar` 30 günlük market serisinde bir değere **ayrılıp geri dönüşü** arıyor. **Tolerans 0 seçilmedi, ÖLÇÜLDÜ**: "ayrılıp geri dönen" 34.919 noktanın **%59,4'ü tam aynı fiyata** dönüyor, sonraki kutu %4,6 — 13× uçurum, ve bu uçurum "ayrıldı" eşiğine %0–%20 arasında tamamen duyarsız. Geçmiş saf change-log (47.104 ardışık çiftin 0'ı aynı fiyat), fiyatların %84'ü `,95`/`,00`/`,90`/`,50` ile bitiyor — yuvarlanacak kuruş gürültüsü yok. Yaygınlık: 17.668 serinin %22,7'si salınımlı (carrefour %28,6 · bim %24,7 · migros %21,0 · a101 %13,1). Havuz 295 → 231, liste 10'a doluyor.
> İlk denemem yanlıştı ve ölçüm yakaladı: "serinin herhangi bir yerinde tekrar" dersem serilerin **%84,7'si** salınımlı çıkıyordu — bu kusur değil promosyonun normali. Doğru test, iddianın **kapsadığı** 30 günlük pencerede geri dönüş olup olmadığı.

**Hedefli değer düzeltmesi (`7a61f6b`).** Alarm önerisi, al/bekle ve "gerçek indirim" rozeti artık salınımsız seriden ölçüyor (`otuzGunlukSeriTemiz`). Uygunluk kapıları TÜM seride kaldı — susturma yok, sadece değer düzeltme. Etki (aynı gün, kirli vs temiz): alarm 5603 → 5111, al/bekle 3953 → 3563 ("iyi zaman" 100 → 125, "bekle" 3853 → 3438), gerçek indirim 2068 → **2180** (düşen 0). Alarm önerisi değeri değişen 162 ürün, sapma medyan %12,6 · max %48,7 (Erikli Su hedefi 10,00 ₺ → 18,75 ₺, ürün 28,00 ₺). Performans **iyileşti**: `_seriKur` market kırılımını tek geçişte kuruyor, tam tarama 1014 → 793 ms, üç özellik 2259 → 1401 ms, `zamAdaylari` 1554 → 782 ms.

**HAYALET ZAM BULGUSU — çözülmedi, önlem alındı (`bd31c1f`).** API her market zinciri için **tek temsilci mağaza** döndürüyor ve temsilci sabit değil. 2026-08-11 ölçümü, aynı ürün aynı dakika: `depots` parametresi yokken `carrefour-1012 "Istanbul Acıbadem Hıper" 169,95`, 5 İstanbul depotu verilince `carrefour-5027 "Karaköy Mını" 171,50`. Scraper `depots` göndermiyor, yani temsilciyi backend seçiyor. Mağaza değişimi geçmişimizde zam gibi görünüyor. **Önlem:** `parse_product` artık `market_fiyatlari` kayıtlarına `depot_id`/`depot_ad` yazıyor (`liste_fiyat` gibi additive, alan boşsa anahtar hiç açılmıyor). Maliyet: ham +%15,2 (kayıt başına 56 bayt), **gzip +%4,6 (47 KB)**. Geriye dönük doldurma YAPILMADI. Üretimde %100 dolu (2026-08-11 gecelik koşusu). Kontrol grubu: BİM iki farklı mağazada aynı 159,00 verdi; tarih kümelenmesi Carrefour'a özgü DEĞİL (migros %25 vs carrefour %22), yani kümelenme tek başına kanıt değil.

**Şehir seçimi + zincir mevcudiyeti.** `il_market_tara.py` 81 ilin koordinatından `/api/v2/nearest` sorgulayıp `data/il_marketler.json` üretiyor (6,9 KB ham / 0,9 KB gzip); ayrı **haftalık** iş (`il-marketler.yml`, Pazar 04:30 UTC). Konum izni İSTENMİYOR — kullanıcı ili elle seçiyor (KVKK borcu doğmasın). `marketVarMi(m)` tek kapı: zam adayları, yaygınlık metni, market toplamları ve karşılaştırma hepsi buradan geçiyor. Bir il için hiç sonuç dönmezse eski değer korunuyor.

**Hal verisi düzeltildi.** `MAX_PRICE` satır filtresi kaldırıldı, yerine ürün bağlamında aykırı-satır elemesi (`AYKIRI_KAT = 20`, `URUN_MAX_FIYAT = 2000`) kondu; birleştirme **hacim ağırlıklı** (medyan yedekli). Sonuç: 127 → 135 ürün, kayıp 0. Yalnızca `MAX_PRICE`'ı kaldırmak 13 ürünü bozuyordu (Tarhun 90 → 1984). `hal_gecmis_kaydet()` geçmiş biriktiriyor, geriye dönük doldurma yok. `turler` alanı çıkarıldı.

**Gün sınırı yerel takvime geçti.** `_yerelGunISO` tek kaynak; `toISOString()` UTC'ye çevirdiği için UTC+3'te her gece 00:00–03:00 arası pencere bir gün geri kayıyordu. 5 yerde düzeltildi: `_seriKur`, `_zamGunISO`, `zamOncekiZirve`, `fiyatGecmisiBlogu`, `_otuzGunOncekiEnUcuz`. İkisini ayrı bırakmak gece yarısı ölçümü bozacağı için hepsi aynı ızgaraya bağlandı.

**Tazelik kontrolü `anasayfa.json`'ı da izliyor.** Ana sayfanın tamamı o dosyaya bağlı; bayatlarsa ekran sessizce eskir. Aynı 2 gün eşiği. Üretimi bilerek **"Veri Guncelle" işine de** eklendi — yalnızca "Build ve Deploy" üretseydi repoya hiç işlenmezdi (o işin izni `contents: read`) ve git tabanlı kontrol iki günde **yanlış alarm** verirdi.

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
| `test_hal.py` | 83 | Hal birleştirme (hacim ağırlıklı), aykırı eleme, geçmiş |
| `test_zam_gerekce.mjs` | 64 | Zam gerekçesi: tarih, kademe, yaygınlık, kategori bağlamı |
| `test_zam.mjs` | 62 | Zam ölçütü, kampanya bitişinin zam sayılmaması, çeşitlilik |
| `test_al_zamani.mjs` | 58 | Al/bekle, uygunluk kapıları, rozet-blok yığılma kuralı |
| `test_profil.mjs` | 55 | Profil bölümleri, "verisi yoksa çizme" kuralı |
| `test_resim.py` | 53 | Searlo kalıcı hata kesmesi, resim koruma, `.env` okuma |
| `test_klavye_kalan.mjs` | 52 | Son 10 klavye açığı, modal arka planlarının bilerek dışarıda kalması |
| `test_sehir.mjs` | 51 | Şehir seçimi, `marketVarMi` kapısı, il market haritası |
| `test_temiz_seri.mjs` | 47 | Salınımsız seri, susturma-yok kuralı, yerel gün sınırı |
| `test_routing_duzen.mjs` | 44 | `?screen=` haritası, PWA kısayolları, masaüstü sütun dengesi |
| `test_cmp_satir.mjs` | 43 | Karşılaştırma satırı (56px, iki satır ad, atanan fiyattan birim fiyat) |
| `test_og_gorsel.mjs` | 42 | Paylaşım kartı: ölçü, palet, kontrast, og/twitter etiketleri |
| `test_hakmar.mjs` | 39 | Hakmar bütünlüğü, market filtresinin gerçekten daraltması |
| `test_ms_sheet.mjs` | 34 | msSheet kapsam bilgisi, eksik ürünün doldurulmaması |
| `test_enflasyon.mjs` | 34 | Enflasyon hesabı, 3 ürün eşiği, renk yönü |
| `test_alarm_oneri.mjs` | 34 | Alarm hedef önerisi (30 günün gerçek dibi) |
| `test_sepet_bol.mjs` | 33 | Dürüst toplam, bölme önerisi, "ikiden fazla market yok" |
| `test_tembel.mjs` | 30 | Tembel geçmiş, uçuşta tekilleştirme, `_ekranGorunur` |
| `test_liste_fiyat.mjs` | 30 | `liste_fiyat` UI gösterimi (yalnızca detayda) |
| `test_baslik_hiyerarsi.mjs` | 29 | Sayfada tek h1, seviye atlaması yok, CSS seçicilerinin taşınması |
| `test_tek_kaynak.mjs` | 26 | 30 günlük serinin TEK kaynak olması, `_seriKur` önbelleği |
| `test_salinim.mjs` | 24 | Salınım elemesi, tolerans 0, eşiğin düşürülmemesi |
| `test_seo_zemin.mjs` | 24 | Meta açıklama uzunluğu, `<noscript>` paneli, splash'in kaldırılması |
| `test_sitemap.mjs` | 24 | `lastmod` damgası, yer tutucu, bozuk girdide yedek yol |
| `test_klavye.mjs` | 23 | Kart klavye erişimi, odak göstergesi, yakınlaştırmanın serbest olması |
| `test_anasayfa.mjs` | 22 | Havuz/seçim ayrımı, şehirli-şehirsiz birebir eşitlik |
| `test_birim_fiyat.mjs` | 22 | Birim fiyat vurgusu, diğer ekranların etkilenmemesi |
| `test_iddia.mjs` | 22 | Sayısal iddiaların HAM seriye karşı doğrulanması (`_hamDipMi`) |
| `test_liste_fiyat.py` | 21 | `discountlessPrice` parse'ı, `ilan_indirim_gecmisi` birikimi |
| `test_depot.py` | 19 | `depot_id`/`depot_ad` additive kaydı, boş alan taşınmaması |
| `test_tazelik.py` | 18 | Tazelik kontrolü kapsamı, `anasayfa.json` + `indirim_analiz_son.json` |
| `test_sessiz_catch.mjs` | 9 | Çıplak `catch(e){}` yasağı — yeni sessiz catch eklenirse kırılır |

**Toplam 33 dosya, hepsi yeşil (2026-08-17).** `test_debug.py` / `test_resim_mini.py` / `test_searlo.py` regresyon testi DEĞİL — `.gitignore`'daki tek seferlik Searlo denemeleri, kredi bittiği için hata basarlar.

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
- **P1-T1 (Vite/build pipeline) TAMAMLANDI** — 2026-07-10'da geldi (`54d3ec2` inline script/style → `app.js`+`style.css`, `dd4c6a7` Vite + Pages deploy). Artık `npm run build` = `scripts/anasayfa-uret.mjs` + `scripts/prepare-public.mjs` (static/, data/, manifest, robots, sw.js → `public/`; sitemap **kopyalanmıyor**, `lastmod` doldurularak yazılıyor) + `vite build` → `dist/`. `app.js` içeriğinin sha256'sından hash'lenmiş dosya adı üretiliyor.
- **SEO meta paketi 2026-08-17'de tamamlandı** — og:image, tek h1, açıklama uzunluğu, noscript, sitemap lastmod. Yukarıdaki oturum bölümüne bak.
- **Stale/dismissed:** P0-T1, P0-T2, P1-T3, P1-İ1.
- **Bilinçli atlandı:** P0-G1 (KVKK — "uygulama bitince"), P0-U2 (5. nav sekmesi), P0-U3 (kontrol edildi, zaten doğru).
- **Hâlâ karar bekliyor:** P1-T2 (CSP header — hosting migration gerektirir), P1-B1 (tuzak public landing — tuzak'ın geleceği belirsizken erken).
- **Henüz bakılmadı:** P1-U1 (erişilebilirlik taraması), P1-U2 (offline banner), P1-B2 (push izni zamanlaması), P2 maddeleri.

### Dağıtım durumu (2026-08-17)

Uygulama teknik olarak çalışıyor ama **pratikte dağıtılmamış durumda.** Bu bölüm o boşluğu görünür tutmak için var — özellik eklemeden önce buraya bak.

- **GoatCounter (1 Tem – 17 Ağu): 59 ziyaret.** Kaynakların **%90'ı doğrudan/bilinmeyen**, **arama trafiği sıfır**. %97 Türkiye, **%68 telefon**, **%64 iOS/Safari**. İki sonuç: (a) tek dağıtım kanalı doğrudan link paylaşımı — o yüzden `og:image` en öncelikli SEO maddesiydi; (b) **kullanıcıların üçte ikisi Safari'de ve uygulama Safari'de hiç test edilmedi.**
- **Google'da hiç indekslenmemiş** (`site:` sorgusu 0 sonuç). 2026-08-17 zemin taraması: robots engellemiyor, `noindex` yok, `X-Robots-Tag` yok, canonical doğru, cloaking yok, sitemap geçerli ve erişilebilir, 371 kelime indekslenebilir metin var, kökten iç bağlantı var. **Teknik engel yok** — sebep Search Console'a hiç eklenmemiş olması (dolayısıyla sitemap hiç sunulmamış) ve dışarıdan bağlantı olmaması.
- **Alan adı `pazarapp.net` alındı (Cloudflare). Geçiş YAPILMADI** — site hâlâ `avkkann.github.io/pazar-app`.
- **`fiyat_bildirim` tablosunda 1 kayıt var, o da test** (2026-08-11 denetiminde yanlışlıkla eklenen `{"_sid":"x","market":"bim"}`). **Gerçek kullanıcı bildirimi yok.** anon DELETE kapalı olduğu için Claude silemedi; temizlik SQL'i `sql/fiyat_bildirim_hiz_siniri.sql`'in başında, hız sınırıyla birlikte bekliyor.
- **TÜBİTAK BİLGEM'e veri kullanımı için e-posta başvurusu yapıldı, cevap bekleniyor.** Cevap gelmezse CİMER'den tekrarlanacak. Veri kaynağı attribution footer'da zaten duruyor (`marketfiyati.org.tr` + `hal.gov.tr`).

### Repo hijyeni
`.gitignore` düzeltildi (`supabasepas.txt` → `supabasepw.txt`) + `kesif_*.py`, `kesif_a101_ham.html`, `a101_pilot_*.py`, `migrate_*.py`, `data/a101_*.json`, `node_modules/`, `dist/`, `/public/` eklendi. Bu dosyalar hâlâ diskte duruyor — silme kararı verilmedi. **2026-08-08:** geniş `test_*.py` kuralı daraltıldı (`4cf6795`) — kalıcı testler artık takip ediliyor, yalnızca geçici keşif script'leri yok sayılıyor.

---

## Bekleyen / ertelenen işler

> **TAM DENETİM RAPORU: [`DENETIM.md`](DENETIM.md)** — 2026-08-11, beş hat (güvenlik, veri
> doğruluğu, performans, tasarım/erişilebilirlik, altyapı) + TestSprite denemesi. 18 bulgu,
> hepsi kanıtlı; önem sırası, hat hat ayrıntı, düzeltme sırası önerisi ve **ölçülemeyenlerin
> açık listesi** içinde.
>
> **2026-08-17 itibarıyla kapananlar** (commit'lerle doğrulandı): rozet/sayısal iddialar
> (2.1–2.3), klavye erişimi (4.1) ve odak göstergesi (4.2), yakınlaştırma engeli (4.3),
> koyu tema kontrastı (4.4), dokunma hedefleri (4.5), sessiz catch'ler, analiz adımının
> sessizce atlanması. **Açık kalanlar:** `fiyat_bildirim` hız sınırı (1.2 — SQL
> `sql/fiyat_bildirim_hiz_siniri.sql`'de hazır, **çalıştırılmadı**), kaçış fonksiyonu +
> 79 `innerHTML` (1.5), `load` olayı 7,6 sn (3.1), SW sürüm/veri ayrışması (3.4).
> **DENETIM.md'nin kendi durum işaretleri geride** — yalnızca 4 madde `KAPANDI` diye
> işaretli, gerçekte daha fazlası kapandı. Durum için bu dosyayı esas al.

**Sıradaki işler (öncelik sırasıyla):**
1. **`pazarapp.net` geçişi.** Alan adı alındı (Cloudflare), geçiş yapılmadı. Dokunulacaklar: `CNAME`, Vite `base`, SW scope, **tüm mutlak URL'ler**, `manifest.json`, `og:url`, `og:image`, `twitter:image`, `canonical`, `sitemap.xml`'deki `<loc>`. Not: `og:image` mutlak URL olmak zorunda (WhatsApp göreli yolu çözmüyor), o yüzden canonical/og:url ile birlikte değişir. `vite.config.js`'te `DEPLOY_TARGET=cloudflare` dalı zaten `base: '/'` veriyor.
2. **Search Console'a ekleme + sitemap gönderimi.** Repoda doğrulama dosyası/meta etiketi **yok**, git geçmişinde de iz yok. İndekslenmemenin tek sebebi bu + dış bağlantı yokluğu; teknik engel yok. Alan adı geçişinden **sonra** yapılmalı, yoksa iki kez yapılır.
3. **Aranabilir içerik üretimi.** Ürün başına statik sayfa + aylık zam listesi sayfası, **build zamanında** `anasayfa.json` deseniyle (`app.js`'i `node:vm`'de koşturup kendi fonksiyonlarını çağır — mantık ikinci kez yazılmaz). SPA'nın tek URL'si arama için yeterli değil.
4. **KVKK aydınlatma metni.** Artık hesap, fiyat alarmı, push bildirimi ve şehir tercihi tutuluyor — "uygulama bitince" erteleme gerekçesi kalmadı.
5. **Sepet şemasına `_sid` eklenmesi.** Karşılaştırma ekranındaki rozetler için gerekiyor. Etkilenenler: Listem, şablonlar ve **localStorage'daki mevcut sepetler** — geriye dönük uyumluluk düşünülmeli.
6. **Searlo kredisi kararı** — resim doldurma adımı artık boşa koşmuyor ama **hiç resim de doldurmuyor**. Ya kredi yenilenecek ya alternatif kaynak seçilecek ya da adım tamamen kaldırılacak. Alternatif kaynak araştırması bilinçli olarak yapılmadı.
7. **~2026-09-01: HAYALET ZAM kuralı ölçüye dayalı hale getirilecek.** `depot_id`/`depot_ad` **2026-08-11'den beri** birikiyor. O tarihte yeterli veri olacak ve "bu dip/zıplama gerçekten mağaza değişimi mi" sorusu **doğrudan** cevaplanabilecek; `zamSalinimVar`'daki yapısal salınım testi `depot_id` değişimini izleyen ölçüme dayalı kuralla değiştirilmeli. Not `app.js`'te `_seriKur` ve `zamSalinimVar` üzerinde duruyor. **Bu tarih geçmeden kuralı değiştirme, ölçüm olmadan yeni eşik uydurma.**
8. **Kök `avkkann.github.io/sitemap.xml` `lastmod`'u bayat** (2026-07-03'te takılı). O dosya **başka bir depoda** (`avkkann.github.io`), bu repodan erişilemiyor. Google'ın okuduğu `Sitemap:` satırı da oradaki `robots.txt`'ten geliyor — `robots.txt` host başına okunur, `/pazar-app/robots.txt` hiç okunmuyor.

**Karar bekleyen:**
- **Al/bekle'de kaybolan 900 çıktı.** Temiz seriye geçince alarm önerisi −492, al/bekle −408 düştü. Bunlar yeni bir susturma kuralı değil, **mevcut kapılar** düzeltilmiş veriye uygulandığı için: alarm "fiyat zaten dipteyse öneri yok"a, al/bekle `AL_ZAMANI_MIN_OYNAMA` %5 kapısına takılıyor. Düşenlerin yarısında temiz aralık **tam sıfır** (ürün 30 gündür kımıldamamış, "bekle" demek yanlıştı). Ama dürüst sınır: salınımlı seri "yanlış seri" değil — inip biten bir kampanya gerçek bir diptir ve o bilgiyi kaybettik. Kabul mü, yoksa hedefli bir istisna mı gerekiyor?
- **Tuzak şeridi rastgele seçiyor.** Havuz (30 kırmızı + 30 sarı) build'de hesaplanıyor, istemci karıştırıp 6 alıyor — bugünkü davranışın aynısı. Kalıcı/kişiselleştirilmiş seçim isteniyorsa ayrı karar.
- **"Tuzak" sekmesinin kaldırılması** — yerini alacak özellikler tamamlandı.
- **Gramaj hilesi (shrinkflation) analizi** — `agirlik_hacim_gecmisi` birikiyor, veri bekliyor (3-6 ay).
- **İlan edilen indirim vs gerçek düşüş karşılaştırması** — `ilan_indirim_gecmisi` ile `fiyat_gecmisi`'ni karşılaştırıp "ilan edilen indirim gerçek mi" sorusunu cevaplamak. Veri bekliyor; ilk dolu koşu 2026-08-09.
- **Hal–market karşılaştırması — ÇEŞİT EŞLEŞTİRME ÇÖZÜLMEDEN AÇILMASIN.** `renderFirsatHal`/`halEsles`/`halKgHesapla` 2026-08-10'da silindi (zaten ölü koddu, hiçbir yerden çağrılmıyordu). İki kusuru vardı: **(a) Çeşit vs dökme emtia.** Market ürünlerindeki nitelemeler halin dökme kaleminin karşılığı değil — ölçüm: ekrandaki 20 eşleşmenin **17'sinde** market adında hal kaleminde olmayan bir kelime vardı (`Şeker Domates 250 Gr` ↔ hal `Domates`: 158,00 vs 21,56 ₺/kg; `Kiraz Gurme` ↔ `Kiraz`: 229,90 vs 76,58; `Çengelköy Salatalık` ↔ `Salatalık`: 89,00 vs 16,32). Şeker domatesi halin dökme domatesiyle kıyaslamak farklı iki malı kıyaslamaktır. **(b) Paket bazlı hesap yok.** Tasarruf kg farkı olarak hesaplanıp küçük paketin üstüne basılıyordu: `Soya Filizi 125 Gr` raftaki 189,90 ₺ → 1.519,20 ₺/kg çevrimi → rozet "1.008,87 ₺ ucuz", oysa o paketteki gerçek fark 126,11 ₺. Ekrandaki 20 üründen 4'ü 1 kg'dan küçük paketliydi. Yeniden açılacaksa **önce** çeşit seviyesinde eşleştirme (marka/çeşit sözlüğü) çözülmeli, **sonra** tasarruf paket ağırlığı üzerinden hesaplanmalı.

**Teknik borç / arıza:**
- **Hal'de iki kırılgan kalem** — `Tamarind(demirhindi)` (tek satır, 5 kg hacim) ve `Isırgan (yaş-taze)` (tek satır, 2 kg hacim). Fiyatları absürt değil ve `URUN_MAX_FIYAT`'ı geçmiyorlar, ama doğrulanacak ikinci kayıt yok — tek bir hatalı bültende sessizce yanlış değer gösterebilirler.
- **`app.js`'te çağrılmayan 4 fonksiyon + 1 ölü değişken** (2026-08-10 taraması, 177 fonksiyon içinde): `filterUrunler` (2660), `mfGorsel` (2924, boş stub), `mfPlaceholderEmoji` (2926, boş stub), `temaToggle` (4291); `activeMarket` (616) yalnızca `null` atanıyor, hiç okunmuyor. Ayrıca `halMap` (611) artık **yalnızca yazılıyor** — tek okuyucusu silinen `halEsles`'ti; `loadData` hâlâ dolduruyor. Hiçbiri silinmedi, karar Mustafa'da.
- **`.sablon-chip` klavyeye kapalı — üç klavye turunun hepsi kaçırdı.** Listem'deki kayıtlı şablon çipleri `<span class="sablon-chip" onclick="sablonYukleUI(...)">`; `tabindex`/`role`/`onkeydown` yok, JS yalnızca `touchstart/end/move` (uzun bas → düzenle) bağlıyor. **Neden kaçtı:** üç tur da tek satırlık markup'a baktı, bu öğe `'` + `'` ile çok satırlı birleştirmeyle üretiliyor, `class="sablon-chip" ... onclick=` deseni hiçbir satırda yan yana çıkmıyor. Hiçbir test de kapsamıyor. **Tarama yapacaksan önce birleştirmeleri düzleştir.** Doğrulandı 2026-08-17: düzleştirilmiş taramada onclick taşıyan 20 blok/inline öğeden `tabindex` taşımayan 5 tane — 4'ü bilerek dışarıda bırakılan modal arka planı, 5.'si bu.
- **Sürüm numarası tek kaynaktan gelmiyor** — `index.html:529`'da `v1.0` elle yazılı, `sw.js`'teki `CACHE_NAME` (`v206`) ile hiçbir bağı yok.
- **`style.css`'te iki adet birebir aynı ölü `@media` bloğu** (`CENTER-FIX-TAMAM` ×2) — temizlenmedi.
- **Ölü `.cmp-mkt-item-img` kuralı** — `style.css:650`'de eski 30px tanımı duruyor, dosyanın sonundaki yeniden tasarım bloğu 56px'le eziyor. Zararsız ama yanıltıcı.
- **Kaçış fonksiyonu hâlâ YOK, 79 `innerHTML`** (DENETIM 1.5, YÜKSEK). Doğrulandı 2026-08-17: `esc`/`kacis` tipi bir fonksiyon 0, `innerHTML` sayısı 79. Kullanıcı girdisi tutan alanlar (şablon adı, bildirim notu) tek tek `replace` ile kaçırılıyor — merkezi bir kapı yok.
- **`'Makyaj'` kategorisi (70 ürün) `app.js` beyaz listesi dışında** — Temizlik sekmesi yerine "diger"e düşüyor. Kategori bölünmesinden önce de böyleydi. (`/api/v2/search` ucu bu tür artıkları yakalamak için değerlendirilebilir.)
- **`marketfiyati.json`** — bayat/farklı kaynak, hâlâ `marketfiyatiYukle()`/productMap fallback'inde. `urunler.json` gibi bir sonraki temizlik adayı.
- **`kesif_*`/`migrate_*`/`a101_pilot_*` dosyaları** — gitignore'da ama diskte, silme kararı Mustafa'da.

**Diğer:**
- **A101 Kapıda entegrasyonu** — pilot scraper hazır, DB'ye nasıl ekleneceği kararı bekliyor.
- **P1-T2 (CSP/hosting migration), P1-B1 (tuzak landing), P1-U1/U2/B2, P2** — tartışılmadı. Not: alan adı Cloudflare'de olduğu için CSP header artık **mümkün** — geçiş yapılınca yeniden değerlendir.
- **Safari'de hiç test edilmedi** — kullanıcıların **%64'ü** iOS/Safari (aşağıdaki dağıtım durumuna bak). Test hep masaüstü Chrome ve Claude in Chrome ile yapıldı.

---

## Kritik öğrenmeler

- **GitHub Actions, varsayılan `GITHUB_TOKEN` ile atılan push'lardan yeni workflow TETİKLEMEZ** (sonsuz döngü koruması). İstisnası `workflow_run` ve `workflow_dispatch` — PAT/secret gerekmez. Bir workflow'un commit'i başka bir workflow'u tetiklemeli diyorsan `workflow_run` kullan. Bu tam olarak 21 gün fark edilmeden yayının durmasına yol açtı.
- **Kaynak sitedeki kategori/isim değişiklikleri sessizce gelir; API hata değil BOŞ SONUÇ döner.** Boş sonuç ile ağ hatasını asla aynı dala düşürme — biri retry ister, diğeri insan müdahalesi. Boş sonuç sesli olsun (`[KRITIK]`) ve mümkünse hattı görünür şekilde kırmızıya çevirsin. Sessiz `[ATLA]` + "dosyayı hiç yazma" kombinasyonu bayat veriyi 12 gün taze gösterdi.
- **`showScreen()` inline `display` yazıyor — bu tuzağa ÜÇ kez düşüldü.** (1) Aktif ekrana inline `display: block` yazdığı için `#screen-*` seçicisine CSS'ten `display: grid`/`flex` vermek ÇALIŞMAZ (inline stil stil sayfasını ezer); düzeni her zaman bir iç sarmalayıcıya ver (`.profil-kartlar` gibi). (2) Diğer ekranlara `display: none` yazdığı için `style.display !== 'none'` kontrolü ancak *showScreen bir kez koştuktan sonra* doğrudur. (3) **showScreen İLK KEZ koşana kadar TÜM ekranların inline `display`'i BOŞ (`""`), gizlilik yalnızca CSS'ten geliyor** — 2026-08-11 ölçümü: `screen-profil` → `inline=""`, `hesaplanan="none"`, `offsetParent=null`. Yani `style.display !== 'none'` açılışta gizli ekranı GÖRÜNÜR sanıyor. Somut zarar: `profilBolumleriCiz()` açılışta da çağrılıyor, oraya konan tembel-yükleme tetikleyicisi ateşlendi ve **4,2 MB geçmiş her sayfa açılışında indi** (üç deploy sürdü, her adımda canlı ölçümle yakalandı). **Görünürlük kontrolü inline stile değil `getComputedStyle`'a bakmalı** — `_ekranGorunur(id)` bunun için var, yeni kontrol yazma, onu kullan.
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
- **Chrome headless `--window-size` viewport'u KIRPIYOR.** İstenen genişlikte PNG üretiyor ama sayfayı daha geniş bir viewport'ta yerleştirip kırpıyor: 390px'te `position:fixed; inset:0` olan onboarding overlay'i bile sağdan kesildi. Yani "metin taşıyor" gibi görünen şey sayfa hatası değil araç artefaktı. **Genişliğe bağlı her ölçüm (sarma, taşma, dokunma hedefi, medya sorgusu) aynı origin'de iframe ile yapılmalı** — `resize_window` maddesiyle aynı sebep. Ekran görüntüsü yalnızca "var mı/görünüyor mu" sorusunu cevaplar, "kaç px" sorusunu cevaplamaz.
- **JS'i kapatıp render almanın çalışan yolu profil tercihi.** `--blink-settings=scriptEnabled=false` screenshot'ı tamamen bozuyor (dosya hiç yazılmıyor, hata da vermiyor). Çalışan yol: taze bir `--user-data-dir` içine `Default/Preferences` yazıp `profile.default_content_setting_values.javascript = 2`.
- **PowerShell `Set-Content` test dosyalarındaki Türkçe karakterleri bozuyor** — `gerçek` → `gerÃ§ek`, 5 test bir seferde kırıldı. **Bu üçüncü tekrar.** Test dosyalarında (ve genel olarak Türkçe metin taşıyan dosyalarda) **Edit aracını kullan**, `Set-Content`/`Out-File` ile yazma.
- **Test canlı veriye sabit sayı PİNLEMEMELİ.** `test_sehir.mjs` `ilMarketleri().length === 5` diye pinliyordu; haftalık il taraması Gaziantep'i 4'e düşürünce test HEAD'de kırmızıya döndü — kod değişmemişti, veri değişti. **Davranışı doğrula, sayıyı değil:** "dosyada ne yazıyorsa fonksiyon onu döndürüyor mu".
- **Tam ekran örtüler ham HTML'deki metni GÖRÜNMEZ kılar.** `#splash` `position:fixed; inset:0; z-index:9999` ve onu yalnızca `app.js` kaldırıyordu; ham HTML'de 2475 karakter indekslenebilir metin vardı ama JS kapalıyken kullanıcı beyaz ekran görüyordu. "Bot ne görüyor" ile "JS kapalı kullanıcı ne görüyor" **ayrı sorular** — ikincisi için `<noscript>` içinden örtüyü de kaldır.
- **Commit ile test koşusunu aynı komut zincirine bağlama.** `for ... done; echo; git commit` şeklinde zincirlediğim için kırmızı test varken commit geçti (`test_hakmar.mjs` 2 FAIL). Testi **ayrı** koştur, çıktısını gör, sonra commit et.

---

## Yaklaşım & desenler

- **SW cache version** her anlamlı `index.html`/`app.js`/`style.css`/`sw.js` değişikliğinde artırılır (şu an **v206**). Backend-only değişikliklerde (scraper, sync) bump edilmez. Akış: `git add` → `git commit` → `git pull --rebase` → `git push`. Not: `sw.js` yalnızca `data/hal.json` + `data/anasayfa.json`'ı önbelleğe alıyor ve `fetch`'i yalnızca o iki URL için yakalıyor — HTML/CSS/JS'i tutmuyor, onlar GitHub Pages'in `max-age=600`'üyle gelir. Bump proje kuralı ve tutarlılık için, HTML dağıtımını hızlandırmıyor.
- **Doğrulama:** Push sonrası `gh run watch` ile deploy'un koştuğu doğrulanır, sonra canlıda (Browser MCP) gerçek fonksiyonel test yapılır — "dosyada var mı" değil, "gerçekten çalışıyor mu". Layout değişikliklerinde ekran görüntüsü yetmez: değişiklikten ÖNCE geometri parmak izi (`getBoundingClientRect`) alınıp sonra sayısal karşılaştırılır.
- **Kapsam disiplini:** İstenmeyen ekleme/çıkarma sessizce yapılmaz, not düşülür. Doküman/analiz önerileri körü körüne uygulanmaz — önce kodda geçerli mi diye bakılır.
- **Büyük ürün/mimari kararları** (hosting migration, nav yapısı, tuzak'ın geleceği) Mustafa'nın onayı olmadan koda dökülmez.
- **Ölçüm önce, kod sonra:** Bir eşik/filtre önerilirse gerçek veride kaç kayıt etkiliyor diye ölçülür. (Fırsatlar için önerilen 400 üst sınırı ölü koddu — kolon 100'le sınırlıydı, gerçek eşik 70 çıktı.)

---

## Araçlar & kaynaklar

- **Claude Code** — dosya düzenlemeleri, git, gh CLI, canlı doğrulama (Windows; PowerShell ve Bash ayrı sözdizimi)
- **Supabase** — auth, DB, Edge Functions, RPC (`get_fiyat_dusenler`, `indirim_puan_toplu_guncelle`, `get_fiyat_bildirimleri`, `jsonb_fiyat_max`)
- **GitHub Actions — `update-data.yml`** (cron `0 3 * * *`, ~2 saat): checkout (`fetch-depth: 0`) → setup-python → pip install → `scraper.py` → `hal_scraper.py` → veri commit+push → **DB Senkronizasyonu** (`sync_db.py`) → **Sahte Indirim Analizi** (`indirim_analiz.py`, `continue-on-error`, başarı damgası `data/indirim_analiz_son.json`) → **Fiyat Alarmı Taraması** (curl edge function) → **Ana Sayfa Şeritleri** (`scripts/anasayfa-uret.mjs`) → **Ana Sayfa Şeritlerini İşle** (commit+push) → **Veri Tazelik Kontrolü** (`scripts/veri_tazelik_kontrol.py`, en son, kırmızıya çevirir). Secrets: `SEARLO_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`.
- **GitHub Actions — `deploy.yml`** ("Build ve Deploy"): `push` + **`workflow_run` ("Veri Guncelle" completed)** + `workflow_dispatch`. `npm ci` → `npm run build` → Pages deploy.
- **Vite** — `npm run build` = `scripts/anasayfa-uret.mjs` + `scripts/prepare-public.mjs` + `vite build` → `dist/`. `base: '/pazar-app/'` (`DEPLOY_TARGET=cloudflare` ise `/`).
- **`scripts/og-gorsel-uret.mjs`** — `static/og-image.svg` → `static/og-image.png` (1200×630), Chrome headless `--screenshot`. SVG kaynak dosyadır, elle düzenlenir; script yalnızca PNG üretir. PNG'yi build ayrıca taşımıyor — `prepare-public.mjs` `static/` klasörünü komple kopyalıyor.
- **`scripts/sitemap.mjs`** — `lastmod` damgası (iki saf fonksiyon, `prepare-public.mjs` çağırıyor). Kaynak `sitemap.xml`'de tarih değil yer tutucu var; **elle tarih yazma**.
- **GoatCounter** (`pazar-app.goatcounter.com`) — analytics, kartsız/ücretsiz, çerezsiz
- **Claude in Chrome (Browser MCP)** — canlı doğrulama; `resize_window` çalışmıyor (iframe kullan), smooth-scroll animasyonlanmıyor. **`Tab` tuşu da sayfanın odak sistemine ulaşmıyor** (odak `BODY`'de kalıyor), ve `element.focus()` programatik olduğu için `:focus-visible` tanım gereği eşleşmez — **odak halkasını bu araçla görsel olarak doğrulayamazsın**, kuralın yüklendiğini CSSOM'dan oku, görünürlüğü insan doğrulasın.
- **`getComputedStyle` bu araçta ÖNCEDEN VAR OLAN düğümlerde BAYAT değer döndürebiliyor — üç tur boyunca olmayan bir hatayı kovaladık.** 2026-08-12: `.cat-card` koyu temada `rgb(255,255,255)` okuyordu, kontrast 1,24 çıkıyordu. Kanıt zinciri: (a) CSS kaynağında `--card-bg` yalnızca iki yerde tanımlı (`:root` beyaz, `[data-theme="dark"]` koyu), build çıktısında sıra doğru; (b) 826 kural tarandı, 0 seçici hatası, elemana uyan **yalnızca iki** background kuralı ve ikisi de `var(--card-bg)`; (c) elemanın **kendi üzerinde** `--card-bg` = `#1C2823`; (d) **elemana doğrudan inline `background-color:#1C2823` yazıldı, okuma yine beyaz döndü** — canlı bir eleman için imkânsız; (e) yanı başına eklenen klon ve `renderCatGrid()` sonrası yeni kartlar `rgb(28,40,35)` veriyor; (f) **ekran görüntüsü kartları koyu ve okunur gösteriyor.** Yani kod doğruydu, ölçüm yanlıştı. **KURAL: renk/geometri iddiasını yalnızca `getComputedStyle` ile kapatma — ekran görüntüsüyle veya taze oluşturulmuş bir düğümle çapraz doğrula.** Bir okumanın gerçek olup olmadığını sınamanın en hızlı yolu: elemana inline stil yaz, değişmiyorsa okuma bayattır.
- **TestSprite — DENENDİ, UYMADI (2026-08-11), tekrar deneme.** MCP sunucusu *yerel* sunucuyu tünelliyor; canlı URL'yi (`avkkann.github.io/pazar-app`) test EDEMİYOR — kendi açıklaması "use the TestSprite CLI instead" diyor. `dist/` yerelde sunulup denendi: `testsprite_bootstrap` 48100'de **etkileşimli bir kurulum arayüzü** açıp insan onayı bekledi, 1800 sn sessizlik sonrası düştü (`status` hep `"init"`, 0 kredi harcandı). Ayrıca **12 yetim süreç** bıraktı (3/5/7 Ağustos oturumlarından, günlerdir çalışıyorlardı) ve `Desktop/.mcp.json`'da API anahtarını **düz metin** tutuyordu. Hepsi temizlendi. Canlı URL denenecekse **MCP değil CLI**.
- **gh CLI** — `gh run list/watch/view --log`, deploy ve veri koşusu doğrulaması

---

## Diğer talimatlar

- Mustafa Android kullanmıyor — iOS ve web (masaüstü Chrome) üzerinden test ediyor.
- CLAUDE.md sohbete asla ham metin olarak yapıştırılmaz, sadece dosya olarak paylaşılır.
