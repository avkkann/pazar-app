# Hub Sayfaları (Faz 1 — Aranabilir İçerik) Uygulama Planı

> **Ajanlar için:** Bu plan `superpowers:subagent-driven-development` veya
> `superpowers:executing-plans` ile görev görev uygulanır. Adımlar `- [ ]` ile işaretlenir.
> **Bu belgede kod YOK** (Mustafa'nın talebi) — dosya yolları, imzalar, eşikler ve
> doğrulama komutları var. Kod, uygulama turunda yazılacak.

**Amaç:** Ürün sayfası açmadan, ince içerik üretmeden, veriden doğal olarak dolu
çıkan **hub sayfaları** üretmek ve bayat sayfa yayınlamayı imkânsız kılmak.

**Mimari:** `anasayfa.json` deseninin aynısı — üretim build zamanında, mantık
`app.js`'ten `node:vm` ile çağrılarak. Sayfalar `.hub/` ara dizinine yazılır,
`prepare-public.mjs` onları `public/`e taşır ve sitemap'i manifestten kurar.
Yayın öncesi `veri_tazelik_kontrol.py --hub dist` sayfa sayısını ve tazelik
damgasını doğrular; düşerse deploy hiç olmaz.

**Teknoloji:** Node 24, Vite 7, Cloudflare Workers statik varlıklar, Python 3 (kontrol).

---

## Global Kısıtlar

Her görevin gereksinimleri bunları örtük olarak içerir.

- **Mantık yeniden yazılmaz.** Eşik, filtre, sıralama kuralı `app.js`'ten gelir
  (`ZAM_ESIK`, `_salinimVarSeri`, `fiyatlariTemizle`, `ustKategori`, `_zamMarka`,
  `birimFiyatHesapla`, `MARKET_NAMES`, `KATEGORILER`). Üretici betikte yeni eşik icat edilmez.
  Tek istisna aşağıda **açıkça** işaretli: aylık pencere (bkz. Risk 3).
- **Yol biçimi mutlak.** Hub sayfaları `/zam/2026-08/` gibi **derin** yollarda duruyor;
  `./static/...`, `./data/...` gibi göreli yol oradan yanlış çözülür. Tüm varlık ve iç
  linkler `/` ile başlar. (`not_found_handling: "none"` — yanlış yol sessiz 404 değil,
  görünür 404 verir ama sayfa yine bozulur.)
- **Tarih kesme YASAK.** `toISOString().slice(0,10)` tipi kesme bu projede üç kez
  yerel-gün hatası üretti. Tarih üretimi tam ISO damgası ya da açık `+03:00` ofsetiyle yapılır.
- **Sessiz kırpma yok.** Sayfa bir listeyi kırpıyorsa (ilk 50 vb.) sayfanın **kendi metninde**
  kaç kayıttan kaç tanesinin gösterildiği yazar; atlanan sayfa manifest'e **gerekçesiyle** düşer.
- **Türkçe metin taşıyan dosyalar `Edit`/`Write` ile yazılır**, `Set-Content`/`Out-File` ile **değil**
  (üç kez bozuldu).
- **Test canlı veriye sabit sayı pinlemez.** Sayfa sayısı testte sabit yazılmaz; beklenen sayı
  `MARKET_NAMES` + `KATEGORILER` + veri içindeki ay sayısı + 1'den **türetilir**.
- **Yeni HTML sayfaları JS içermez.** CSP `default-src 'self'` + `style-src 'unsafe-inline'`;
  hub sayfaları satır içi `<style>` kullanır, harici script kullanmaz, `app.js` yüklemez.
- **CLAUDE.md aynı turda güncellenir.** Yarım bırakılan iş repoda dosya bırakıyorsa CLAUDE.md'ye
  yazılır (bu tuzağa üç kez düşüldü).

---

## Ölçülmüş zemin (2026-08-18, gerçek veri)

Plan bu sayılara dayanıyor; hepsi bu turda `data/` üzerinde ölçüldü.

| Ölçüm | Değer |
|---|---|
| Toplam ürün | 16.825 |
| ≥2 market fiyatı olan | 2.747 (%16,3) |
| `gecmis_fiyatlar.json` seri sayısı | 21.158, toplam 82.032 nokta (ort. 3,88 nokta/seri) |
| Veride bulunan aylar | 2026-05 (kısmi, 25 Mayıs'ta başlıyor), 2026-06, 2026-07, 2026-08 |
| Aylık ≥%15 artış (salınım elenmiş) — **YANLIŞ ÖLÇÜT, Görev 4'te düzeltildi** | 06: 1.907 · 07: 1.727 · 08: 2.315 — ay başı→ay sonu karşılaştırması. Ağustos'ta bu satırların **%74,9'u** app.js ölçütüyle düşüyor (son fiyat ay öncesinde zaten görülmüş). |
| Market başına ürün | carrefour 6.575 · migros 5.283 · a101 2.377 · sok 1.897 · bim 1.794 · tarim_kredi 1.417 · hakmar 1.338 |
| Market başına "en ucuz olduğu ürün" (≥2 marketli) | carrefour 1.216 · migros 851 · sok 307 · a101 292 · bim 289 · tarim_kredi 239 · hakmar 102 |
| Market başına il (`il_marketler.json`) | a101/bim/migros/sok 81 · tarim_kredi 61 · carrefour 34 · hakmar 9 |
| Kategori başına ürün / ≥2 marketli / alt kategori | atistirmalik 3.856/747/9 · temizlik 3.788/491/20 · gida 3.487/569/15 · sut 2.325/389/11 · icecek 2.130/403/8 · et 795/75/6 · dondurulmus 295/28/1 · meyve 149/45/2 |
| `hal.json` | 142 kalem, bülten 17.08.2026 |

**Sonuç: bugün 18 sayfa.** 2 ay + 7 market + 8 kategori + 1 hal.
> **GÜNCELLEME (Görev 4, ölçümle):** ay sayfası ay ÖNCESİNDE en az 30 günlük geçmiş istiyor
> (app.js'in 30 günlük penceresinden türedi) — "önceki zirve" ölçütü daha kısa bir pencereye
> dayanamaz. 2026-06 öncesinde 7 günlük veri var, o yüzden düştü. Eylül'den itibaren her ay
> bu şartı kendiliğinden sağlıyor.
2026-05 **elenir** (veri ayın 25'inde başlıyor, ay temsil edilmiyor) — manifest'e gerekçeyle yazılır.
Her ay başında liste kendiliğinden 1 artar.

---

## Dosya yapısı

**Yeni:**
- `scripts/app-vm.mjs` — `app.js`'i `node:vm` içinde koşturan tarayıcı gövdesi + Supabase taşıma
  katmanı. **Bugün `anasayfa-uret.mjs` içinde gömülü olan ~140 satırın aynısı**, oradan çıkarılıyor.
  Dışa verir: `appOrtamiKur({veriYolu}) -> { ic(kod), ctx }`.
- `scripts/hub-sayfa.mjs` — **saf** fonksiyonlar: sayfa modeli kurma, eşik kararı, HTML üretimi,
  kaçış, slug, damga biçimi. IO yok, `fetch` yok. `sitemap.mjs`'in deseni.
- `scripts/hub-uret.mjs` — orkestratör: veriyi okur, `app-vm` ile `app.js` fonksiyonlarını çağırır,
  `hub-sayfa.mjs`'e model verir, `.hub/` altına HTML + `.hub/manifest.json` yazar.
- `docs/superpowers/plans/2026-08-18-hub-sayfalari.md` — bu belge.

**Değişen:**
- `scripts/anasayfa-uret.mjs` — gövde `app-vm.mjs`'e taşınır, davranış **birebir aynı** kalır.
- `scripts/prepare-public.mjs` — `.hub/` içeriğini `public/`e kopyalar, sitemap'i manifest'ten kurar.
- `scripts/sitemap.mjs` — yeni saf fonksiyon `sitemapEkle(xml, girisler)`. Mevcut iki fonksiyon
  **dokunulmadan** kalır (testleri geçmeye devam etmeli).
- `scripts/veri_tazelik_kontrol.py` — yeni `--hub <dizin>` kipi (aşağıda).
- `package.json` — build zinciri.
- `.gitignore` — `.hub/`.
- `.github/workflows/deploy.yml` — build ile wrangler arasına hub kontrolü.
- `index.html` + `sw.js` — uygulamadan hub'lara footer linkleri (Görev 8, **onay gerektirir**).
- `app.js` — `?screen=kategori&kat=<slug>` rotası (Görev 8, **onay gerektirir**).
- `CLAUDE.md` — durum notu.

**Üretilen (repoya girmez):** `.hub/**`, `public/**`, `dist/**`.

---

## a) Her hub tipinde tam olarak ne var

Ortak iskelet (dört tip için de aynı, `hub-sayfa.mjs` tek yerden üretir):

```
<head>  title (≤60 krk) · meta description (140–155 krk, sayfaya özgü sayı içerir)
        canonical (mutlak, sondaki / dahil) · og:title/description/url/image · og:locale tr_TR
        meta name="pazar-veri-damgasi" content="<kaynak verinin ISO damgası>"
        meta name="pazar-hub-tipi" content="zam|market|kategori|hal"
        meta name="pazar-satir" content="<sayfadaki veri satırı sayısı>"
        <style> satır içi, ~2 KB, tema değişkenleri index.html'deki paletten </style>
<body>  <header> Pazar logosu → "/" · üst gezinti (tüm hub tipleri) </header>
        <main>  h1 · özet paragraf · h2 bölümleri · yöntem notu </main>
        <footer> tazelik satırı · "Uygulamada aç" linki · iç link bloğu </footer>
```

Başlık kuralı: **sayfa başına tek `h1`**, bölümler `h2`, tablo başlığı `th`. `h3` yok
(seviye atlaması riski). `index.html`'deki tek-h1 kuralıyla aynı disiplin.

### 1. `/zam/<yyyy-aa>/` — aylık zam listesi (bugün 2 sayfa: Temmuz, Ağustos)

- **h1:** `Ağustos 2026'da zamlanan ürünler`
- **Özet paragrafı (üretilen sayılarla):** o ay ≥%15 artış gözlenen ürün-market çifti sayısı,
  ayrı ürün sayısı, kaç zincirde, kaç kategoride, kapsanan gün aralığı.
  Örn. Ağustos: 205 çift / 198 ürün / 7 zincir / 1–18 Ağustos (Temmuz 363 çift).
- **h2 "Ayın en çok zamlanan N ürünü"** — başlık gerçek satır sayısını söyler, en çok 50 satır:
  `Ürün · Market · Ay başı ₺ · Son ₺ · Artış % · Kategori (→ /kategori/<slug>/)`.
  Kırpma sayfada yazılı (gerçek sayılarla, `kirpmaNotu` üretir).
- **h2 "Zincir bazında dağılım"** — **7 satır**: `Market (→ /market/<slug>/) · zam sayısı · medyan artış %`.
- **h2 "Kategori bazında dağılım"** — **8 satır**: `Kategori (→ /kategori/<slug>/) · zam sayısı · medyan artış %`.
- **h2 "Bu liste nasıl hesaplandı"** — yöntem paragrafı: %15 eşiği, salınım elemesi
  (kaç kayıt elendi — Ağustos'ta 36, Temmuz'da 523), taze meyve/sebzenin mevsim gerekçesiyle
  dışarıda olduğu, geçmişin değişim-günlüğü olduğu, tek temsilci mağaza uyarısı.
- **İç linkler:** önceki/sonraki ay · `/hal/` · 8 kategori · 7 market · `/` .
- **Toplam veri satırı:** 65. **Gövde kelime:** ~600.

### 2. `/market/<slug>/` — 7 sayfa (a101, bim, carrefour, migros, sok, tarim-kredi, hakmar)

- **h1:** `CarrefourSA fiyatları — 6.575 ürün, 34 ilde`
- **Özet paragrafı:** kaç üründe fiyat var, kaç kategoride, kaç ilde mağazası var,
  ≥2 marketli ürünlerin kaçında **en ucuz** (carrefour 1.216), veri kaynağı ve günlük tazelik.
- **h2 "Bu markette en ucuz olan ürünler"** — **40 satır**:
  `Ürün · Bu market ₺ · En yakın rakip ₺ (market adıyla) · Fark % · Kategori (link)`.
  Sıralama fark yüzdesine göre; `fiyatlariTemizle()` geçerli fiyatlarıyla.
- **h2 "Bu markette son 30 günde zamlananlar"** — **≤30 satır**, kaynak `data/anasayfa.json`
  içindeki **hazır zam havuzu**, market kırılımıyla filtrelenmiş. Yeni ölçüt yok — ana sayfa
  şeridiyle **aynı** sayı. Satır: `Ürün · Zirve ₺ · Son hafta ₺ · Artış %`.
- **h2 "Kategori dağılımı"** — **8 satır**: `Kategori (link) · bu markette ürün · en ucuz olduğu ürün`.
- **h2 "Hangi illerde var"** — `il_marketler.json`'dan **il adı listesi** (34 ad) + kapsam cümlesi
  ("81 ilin 34'ünde, 40 km yarıçapla taranan mağaza verisine göre"). 81 il sayfası yerine
  o verinin gideceği yer burası.
- **h2 "Ölçüm notu"** — zincir başına tek temsilci mağaza, şehre göre fiyat sapması,
  eksik ürünlerin toplamlara katılmadığı.
- **İç linkler:** 8 kategori · diğer 6 market · güncel ay zam sayfası · `/hal/` · `/` .
- **Toplam veri satırı:** ~78 + 34 il adı. **Gövde kelime:** ~700.

### 3. `/kategori/<slug>/` — 8 sayfa (`KATEGORILER` slug'ları; `meyve-sebze` dahil)

- **h1:** `Süt & Kahvaltı fiyatları — 2.325 ürün, 7 markette karşılaştırma`
- **Özet paragrafı:** ürün sayısı, ≥2 marketli sayısı (**ve oranı — dürüstlük kuralı**),
  alt kategori sayısı, en geniş kapsamlı market.
- **h2 "Marketler arası fark en yüksek ürünler"** — **40 satır** (≥2 marketli havuzdan):
  `Ürün · En ucuz market ₺ · En pahalı market ₺ · Fark % · Gramaj/birim fiyat`.
  Birim fiyat `birimFiyatHesapla()` ile — yeniden hesaplanmaz.
- **h2 "Son 30 günde zamlananlar"** — **≤20 satır**, `anasayfa.json` zam havuzundan
  kategori filtresiyle. Yeni ölçüt yok.
- **h2 "Alt kategoriler"** — `ana_kategori` kırılımı, **n satır** (sut 11, temizlik 20,
  dondurulmus 1): `Alt kategori · ürün sayısı · ≥2 marketli sayısı`.
- **h2 "Market kapsamı"** — **7 satır**: `Market (link) · bu kategoride ürün · en ucuz olduğu ürün`.
- **h2 "Nasıl okunur"** — birim fiyatın neden karşılaştırmanın esası olduğu, gramaj hilesi,
  kapsam uyarısı.
- **İç linkler:** 7 market · diğer 7 kategori · güncel ay · `/hal/` · `/` .
- **Toplam veri satırı:** ~78 (dondurulmus'ta ~68). **Gövde kelime:** ~650.

### 4. `/hal/` — 1 sayfa

- **h1:** `Hal fiyatları — 142 kalem (17.08.2026 bülteni)`
- **Özet paragrafı:** kaynak `hal.gov.tr` bülteni, bülten tarihi, kapsam (TR geneli),
  toplam kalem, birim (₺/kg), bültenin hafta sonu yayınlanmadığı.
- **h2 "Bülten fiyatları"** — **142 satır**: `Ürün · ₺/kg · En düşük · En yüksek · Kayıt sayısı`.
  Tek kayıtlı kalemler işaretli (`Tamarind`, `Isırgan` — teknik borçta yazılı kırılganlık).
- **h2 "Bir haftada en çok değişenler"** — `hal_gecmis.json`'dan **≤20 satır**:
  `Ürün · 7 gün önce ₺ · Şimdi ₺ · Değişim % · Haftanın en düşük/en yüksek ₺`.
  (Şema doğrulandı: kalem adı → günlük `{t, f}` serisi, bugün 8 gün derinlik — carry-forward
  gerekmiyor, seri zaten günlük.)
- **h2 "Hal fiyatı market fiyatıyla neden doğrudan karşılaştırılmıyor"** — projedeki
  ölçülmüş karar: 20 eşleşmenin 17'sinde market adında hal kaleminde olmayan bir çeşit
  nitelemesi vardı (`Şeker Domates 250 Gr` ↔ `Domates`: 158,00 ↔ 21,56 ₺/kg), ve tasarruf
  paket ağırlığı üzerinden hesaplanmadığı için `Soya Filizi 125 Gr` için "1.008 ₺ ucuz"
  çıkıyordu. Bu bölüm sayfanın en özgün metni ve kullanıcıyı yanlış çıkarımdan koruyor.
- **İç linkler:** `/kategori/meyve-sebze/` · `/` · `/?screen=hal`.
- **Toplam veri satırı:** ~162. **Gövde kelime:** ~700.

---

## b) "Sayfa gerçekten dolu mu" ölçüsü

Tek eşik yetmez — bu sayfalar tablo ağırlıklı, sadece kelime sayarsan 142 satırlık
hal tablosu "ince" görünür; sadece satır sayarsan boş başlıklı bir iskelet "dolu" görünür.
**İki eşik birden, ikisi de `hub-sayfa.mjs`'te tek yerde tanımlı:**

| Eşik | Değer | Ölçüm |
|---|---|---|
| `ESIK_SATIR` | **12** | modeldeki `tur:'tablo'` bölümlerinin `satirlar` uzunlukları toplamı |
| `ESIK_KELIME` | **300** | modelin metin alanlarındaki kelime toplamı: `baslik` + `ozet` + bölüm başlıkları + `metin` gövdeleri + `liste` öğeleri + tablo hücreleri |
| `ESIK_AY_BASLANGIC` | **3 gün** | ay sayfası: verinin o aydaki ilk gözlem günü ayın 1'i + 3 günü geçiyorsa ay temsil edilmiyor |

**ÖLÇÜM MODELDEN YAPILIR, HTML'DEN DEĞİL — ve yalnızca tek yerde.** Sayaç
`hub-sayfa.mjs`'teki `sayfaKarari(model)`; başka hiçbir katman satır/kelime saymaz:

| Katman | Ne yapar |
|---|---|
| `hub-sayfa.mjs` → `sayfaKarari(model)` | **tek sayaç.** `{ durum, sebep, satir, kelime }` üretir |
| `hub-sayfa.mjs` → `sayfaHTML(model)` | sayfayı çizer; `pazar-satir` meta'sına `sayfaKarari`'nin **satir** değerini basar, yeniden saymaz |
| `hub-uret.mjs` | kararı manifest'e yazar; `atlandi` olanı diske hiç yazmaz |
| `prepare-public.mjs` (sitemap) | manifest'teki `durum`'a bakar; **kendi eşiğini uygulamaz** |
| `veri_tazelik_kontrol.py --hub` | `pazar-satir` meta'sını manifest'teki `satir` ile karşılaştırır; **kendi saymaz** |

Ortak header/footer modelde zaten yok, o yüzden "hariç tutma" ayrı bir kural değil —
modelin şeklinden geliyor. HTML'den saymak ikinci bir sayaç doğururdu ve iki sayaç
kaçınılmaz olarak ayrışır (bu projenin `urunler.json` ve `marketfiyati.json` ile iki kez
yediği desen). Tazelik kontrolünün karşılaştırması tam da bu ayrışmayı yakalamak için var.

**Eşiğin altında kalan sayfa ÜRETİLMEZ.** Ve:
1. `.hub/manifest.json` içine `{ yol, durum: "atlandi", sebep, satir, kelime }` olarak yazılır,
2. `hub-uret.mjs` `stdout`'a görünür bir `[hub] ATLANDI ...` satırı basar,
3. sitemap'e **girmez** (atlanmış sayfayı sitemap'e koymak Google'a 404 sunmaktır),
4. diğer sayfalardaki iç link bloğundan da düşer (kırık iç link üretmemek için).

**Atlama tek başına build'i kırmaz** (tasarlanmış davranış), ama **gerekçesiz eksik kırar**:
tazelik kontrolü türetilmiş beklenen kümeyle manifest'i karşılaştırır, manifest'te ne
`uretildi` ne `atlandi` olarak görünen bir sayfa varsa **kırmızı**.

Bugünkü ölçüme göre üretilen sayfaların hiçbiri eşiğin altında değil; en dar sayfa
`/kategori/dondurulmus/` (~68 satır) ve o da eşiğin 5 katı. Eşik gelecekteki
çürümeyi yakalamak için var, bugünü kısıtlamak için değil.

---

## c) Üretici script nereye oturuyor

**`anasayfa-uret.mjs`'in içine GİRMİYOR.** Gerekçe: o betiğin tek çıktısı `data/anasayfa.json`
ve dört şerit boşsa `process.exit(1)` ediyor; hub üretimi farklı bir çıktı kümesi ve farklı
bir başarısızlık anlamı taşıyor. İkisini birleştirmek "ay sayfası eşiğin altında kaldı"
ile "ana sayfa şeridi boş" arızalarını aynı çıkışa bindirir.

**Zincir (package.json `build`):**

```
node scripts/anasayfa-uret.mjs      # data/anasayfa.json  (mevcut)
node scripts/hub-uret.mjs           # .hub/**  + .hub/manifest.json   (YENİ)
node scripts/prepare-public.mjs     # public/ = static+data+.hub+sitemap  (değişiyor)
vite build                          # dist/
```

**Neden `hub-uret` `prepare-public`'ten ÖNCE:** `prepare-public.mjs` ilk iş olarak
`public/`i `rmSync` ediyor. Hub sayfaları doğrudan `public/`e yazılsaydı sıraya bağlı,
sessizce silinebilen bir bağımlılık olurdu. Ara dizin `.hub/` bu bağı kesiyor ve
`prepare-public` "public/'i tek elden kuran betik" olarak kalıyor.

**Neden `.hub/` repoya girmiyor:** türetilmiş dosya. `anasayfa.json` repoya *giriyor* çünkü
git tabanlı tazelik kontrolü onu izliyor; hub sayfalarının tazeliği ise **sayfanın içindeki
damgadan** ölçülüyor, git'e ihtiyaç yok. "Aynı türetilmiş dosyanın iki kaynağı" tuzağına
girmiyoruz.

**`app-vm.mjs` çıkarımı:** `hub-uret.mjs` de `app.js` fonksiyonlarına ihtiyaç duyuyor
(`fiyatlariTemizle`, `ustKategori`, `birimFiyatHesapla`, `_salinimVarSeri`, `ZAM_ESIK`,
`MARKET_NAMES`, `KATEGORILER`). Gövdeyi kopyalamak = iki ayrı tarayıcı taklidi = kaçınılmaz
sapma. Ortak modüle çıkarılıyor ve `anasayfa-uret.mjs` de onu kullanıyor.
**Kabul ölçütü: çıkarım öncesi ve sonrası `data/anasayfa.json` bayt bayt aynı** (Görev 1).

**Supabase gerekmiyor:** hub sayfalarının hiçbiri Supabase'e sormuyor; `anasayfa.json` +
`data/urunler_*.json` + `data/gecmis_fiyatlar.json` + `data/hal*.json` + `data/il_marketler.json`
yeterli. `hub-uret.mjs` ağa **hiç** çıkmaz — CI'da tek başına, sırsız koşabilir.

**Süre bütçesi:** `anasayfa-uret.mjs` bugün ~20 sn (tuzak taraması 14,7 sn dahil).
`hub-uret.mjs` aynı veriyi tekrar tarıyor ama tuzak hesabı yok; hedef **< 30 sn**.
Aşarsa ölçülüp raporlanır, eşik uydurulmaz.

---

## d) `scripts/sitemap.mjs` nasıl değişiyor, `lastmod` nereden geliyor

**Mevcut iki fonksiyon aynen kalıyor** (`lastmodDamgasi`, `sitemapDoldur`) — `test_sitemap.mjs`
onları doğrudan import ediyor, kırılmamalı. `sitemap.xml` kaynak dosyası da kalıyor: kök
girdinin şablonu o.

**Yeni saf fonksiyon:**
`sitemapEkle(xml, girisler) -> xml` — `</urlset>` öncesine `girisler` dizisinden `<url>`
blokları ekler. `girisler[i] = { loc, lastmod }`. Doğrulama: `loc` mutlak ve `/` ile bitmeli,
`lastmod` W3C Datetime olmalı, aynı `loc` iki kez geçmemeli — üçünde de `throw`
(bozuk sitemap sessizce yayınlanmaz).

**`prepare-public.mjs` akışı:** `anasayfa.json` → `lastmodDamgasi` → `sitemapDoldur` (kök)
→ `.hub/manifest.json` oku → `durum === "uretildi"` olanları `sitemapEkle`'ye ver
→ `public/sitemap.xml`. Manifest yoksa **uyarı basıp yalnızca kökle devam eder**
(build kırılmaz; asıl kapı tazelik kontrolü).

**`lastmod` kuralı — her sayfa için, içerikten:**

| Sayfa | `lastmod` kaynağı | Gerekçe |
|---|---|---|
| `/` | `anasayfa.json` → `uretim` (bugünkü davranış) | değişmedi |
| `/zam/<ay>/` | o sayfada gösterilen kayıtların **en yeni gözlem tarihi** (`+03:00`) | geçmiş aylar doğal olarak donuyor; Google'a "her gün değişti" yalanı söylenmiyor |
| `/market/<slug>/` | sayfadaki satırların en yeni gözlem tarihi (`+03:00`) | aynı |
| `/kategori/<slug>/` | sayfadaki satırların en yeni gözlem tarihi (`+03:00`) | aynı |
| `/hal/` | `hal.json` → `bulten_tarihi` (`17.08.2026` → `2026-08-17T00:00:00+03:00`) | hal kendi ritminde; hafta sonu güncellenmiyor |

Damgayı üreten `hub-uret.mjs`, manifest'e `son_veri` alanı olarak yazar. **Tarih kesme yok:**
gün bazlı kaynaklarda saat açıkça `T00:00:00+03:00` ekleniyor, `toISOString()` ile
gün sınırına hiç dokunulmuyor. `bulten_tarihi` `gg.aa.yyyy` biçiminde — çevirim
`hub-sayfa.mjs` içinde tek bir saf fonksiyon (`gunDamgasi(gg.aa.yyyy | yyyy-aa-gg)`).

`robots.txt` değişmiyor (`Sitemap:` satırı zaten `pazarapp.net/sitemap.xml`).

---

## e) Sayfalardan uygulamaya, uygulamadan sayfalara

### Hub → uygulama (kesin, bu fazda yapılıyor)

Her hub sayfasının footer'ında **"Uygulamada aç"** bloğu, mevcut `?screen=` rotalarıyla:

| Sayfa | Link |
|---|---|
| `/hal/` | `/?screen=hal` (mevcut rota) |
| `/zam/<ay>/` | `/?screen=firsat` (mevcut rota) |
| `/market/<slug>/` | `/` (marketi hedefleyen rota yok, uydurulmuyor) |
| `/kategori/<slug>/` | `/?screen=kategori&kat=<slug>` — **yeni rota gerekiyor** |

**Yeni rota önerisi (ONAY GEREKTİRİR):** `ekranRotasiUygula()` içine tek dal:
`kategori` → `openCategory(kat)` (fonksiyon `app.js:3271`'de zaten var, `slug` alıyor).
Bilinmeyen `kat` değeri mevcut davranışla tutarlı biçimde sessizce ana sayfaya düşer.
`manifest.json` kısayolları etkilenmez. **Gerekçesi:** 8 kategori sayfası tıklanabilir bir
hedef olmadan uygulamaya hiç dönüş üretmez; bu, hub sayfalarının tek dönüşüm yolu.
Karar Mustafa'da — reddedilirse kategori sayfaları da `/`'a bağlanır, plan bozulmaz.

### Uygulama → hub (öneri: EVET, sınırlı)

**Öneriyorum, çünkü keşif yolu başka yok.** Sitemap Google'a listeyi verir ama iç link
grafiği olmayan sayfalar taramada en son sıraya düşer; dış bağlantı da yok. `index.html`'in
**yalnızca ana ekranına**, mevcut şeritlerin altına küçük bir footer bloğu:

```
Fiyat sayfaları:  Ağustos zamları · Hal fiyatları
Kategoriler:      Meyve & Sebze · Et & Tavuk · … (8 link)
Marketler:        A101 · BİM · CarrefourSA · … (7 link)
```

Gerçek `<a href="/kategori/sut/">` — SPA'dan çıkan tam sayfa yüklemesi. Kabul ediyorum ki
bu bir kullanıcı akışı kesintisi; bu yüzden footer'da, şeritlerin içinde değil.

**Maliyeti:** `index.html` büyür, **`sw.js` sürümü v207 → v208** (proje kuralı),
`test_seo_zemin.mjs` ve `test_baslik_hiyerarsi.mjs` yeşil kalmalı (yeni `h1`/`h2` eklenmiyor,
sadece `<a>` ve bir `<h2 class="sr-only">` değil — düz `<nav aria-label="Fiyat sayfaları">`).
Ay linki her ay değişir → link üretimi build'de, `hub-uret.mjs`'in manifestinden.
**Bu, `index.html`'e üretilmiş içerik enjekte etmek demek** — bugün öyle bir mekanizma yok.
En ucuz yol: Vite `transformIndexHtml` kancası (mevcut `hashClassicScript` eklentisinin yanına).
Onay verilmezse: footer statik yazılır, ay linki yerine `/zam/` yerine **yalnızca** kategori +
market + hal linkleri konur (ay linki sitemap'te kalır).

---

## f) Testler — 3 yeni dosya + 1 mevcut dosyaya bölüm

Proje deseni: kök dizinde tek dosya, `node test_x.mjs` / `py test_x.py`, `PASS/FAIL` sayan
kendi mini koşucusu, canlı veriye **sayı pinlemeyen** iddialar.

**1. `test_hub_uret.mjs`** — `scripts/hub-sayfa.mjs`'in saf fonksiyonları, elle kurulmuş
küçük fixture'larla (gerçek 17 MB veri okunmaz):
- ay penceresi: ayın 1'inden sonra başlayan veri → `atlandi` + sebep dolu (2026-05 senaryosu)
- eşik altı sayfa üretilmiyor: 11 satır → `atlandi`, 12 satır → `uretildi` (sınır dahil)
- kelime eşiği ortak header/footer'ı **saymıyor** (boş tablo + uzun footer → `atlandi`)
- kırpma metni satır sayısıyla tutarlı ("2.315 çiftin ilk 50'si" — sayı modelden geliyor)
- `gunDamgasi('17.08.2026')` → `2026-08-17T00:00:00+03:00`; `toISOString` kullanılmadığı
  saat dilimi kaydırılarak sınanır (TZ=UTC ve TZ=Europe/Istanbul aynı sonucu vermeli)
- eşiklerin **tek** yerde tanımlı olduğu (modülden import edilen sabit, dosyada ikinci kez geçmiyor)
- slug üretimi: `tarim_kredi` → `tarim-kredi`, `KATEGORILER` slug'larıyla birebir örtüşme

**2. `test_hub_html.mjs`** — üretilen HTML dizesi üzerinde (yine fixture modelden):
- sayfa başına **tek `h1`**, `h2` sırası atlamasız, tablo başlıkları `th`
- **hiçbir göreli yol yok**: `href="./`, `src="./`, `href="static/` deseni **0 eşleşme**
- `pazar-veri-damgasi` meta'sı var ve W3C Datetime
- **`pazar-satir` meta'sı `sayfaKarari(model).satir` ile birebir aynı** — HTML katmanı
  ikinci bir sayaç kurmuyor (modele bir satır eklendiğinde meta da değişiyor, sabit değil)
- `canonical` mutlak ve `/` ile bitiyor; `og:url` ile aynı
- `title` ≤ 60 karakter, `description` 140–155 karakter (mevcut SEO testiyle aynı ölçüt)
- `<script` **hiç geçmiyor** (CSP `default-src 'self'` + JS'siz sayfa sözü)
- ürün adı kaçırılıyor: `<`, `&`, `"` içeren ad enjeksiyon üretmiyor
  (projede merkezi kaçış fonksiyonu **yok** — hub tarafında baştan `hub-sayfa.mjs` içinde olacak)
- her sayfada en az 3 iç link ve **atlanmış sayfaya link yok**

**3. `test_hub_tazelik.py`** — `scripts/veri_tazelik_kontrol.py`'yi import eder (kopya mantık yok):
- geçici dizine kurulan sahte `dist/`: üretilen sayfalar + manifest → `exit 0`
- manifest'te `uretildi` yazan bir sayfa dosya olarak **yoksa** → `exit 1` ve adı çıktıda
- manifest'te hiç görünmeyen beklenen sayfa (ne `uretildi` ne `atlandi`) → `exit 1`
- `atlandi` + sebep dolu → **yeşil**, sebep boş → `exit 1`
- sayfadaki `pazar-satir` meta'sı manifest'teki `satir` ile **uyuşmuyorsa** → `exit 1`
  (kontrol kendi saymaz, iki kaydın ayrışmasını yakalar — tek sayaç kuralının bekçisi)
- damgası 3 gün eski sayfa → `exit 1`; 1 gün eski → yeşil (eşik `ESIK_GUN` ile **aynı sabit**)
- `/hal/` için gevşetilmiş eşik (`ESIK_GUN_HAL = 5`) uygulanıyor, diğerlerine uygulanmıyor
- damgası hiç olmayan sayfa → `exit 1`
- beklenen sayfa kümesi **türetiliyor**: `MARKET_NAMES`/`KATEGORILER` uzunluğu değişince
  test kendiliğinden uyum sağlıyor, sabit 19 yok
- `deploy.yml`'da hub kontrolünün **build'den sonra, wrangler'dan önce** olduğu
  (mevcut `test_tazelik.py`'nin workflow bölümüyle aynı desen)

**4. `test_sitemap.mjs`'e "5. HUB GİRDİLERİ" bölümü** (yeni dosya değil — fonksiyon aynı modülde):
- `sitemapEkle` girdiyi bozmuyor (saf), kök girdi yerinde kalıyor
- `<url>` sayısı = 1 + `uretildi` sayısı; `atlandi` olanlar **yok**
- yinelenen `loc` → `throw`; `/` ile bitmeyen `loc` → `throw`; geçersiz `lastmod` → `throw`
- geçmiş ay sayfasının `lastmod`'u kök damgasından **farklı** (donmuş içerik kanıtı)

**Koşum:** dördü de `npm run build` gerektirmiyor (fixture tabanlı). Ek olarak
Görev 9'da gerçek build sonrası `dist/` üzerinde bir kez elle koşulacak.

---

## g) Riskler ve şüphelendiğim yerler

1. ~~**Cloudflare dizin yolu davranışı**~~ — **KAPANDI, 2026-08-18 canlı ölçümle** (Görev 0).
   `wrangler.jsonc`'de `html_handling` **yazılı değil**, varsayılan geçerli ve varsayılan
   **doğru olanı yapıyor**. `pazarapp.net`'e geçici bir sonda deploy edilip `curl -sI` ile ölçüldü
   (tarayıcı MCP'siyle değil — o profilde uzantı header sıyırıyor):

   | İstek | Sonuç |
   |---|---|
   | `/zam/test-olcum/` | **200**, `Content-Type: text/html`, gövde doğru, CSP 9 direktif |
   | `/zam/test-olcum` (eğik çizgisiz) | **307** → `/zam/test-olcum/` |
   | `/zam/test-olcum/index.html` | **307** → `/zam/test-olcum/` |
   | `/zam/` (index'i olmayan dizin) | **404** ← negatif kontrol |
   | `/zam/olmayan-yol/` | **404** ← negatif kontrol |
   | `/zam/test-olcum/olmayan.html` | **404** ← negatif kontrol |

   Negatif kontroller 404 verdiği için ölçüm başarısızlığı görebiliyor — bulgu gerçek.
   **Bağlayıcı sonuç: kanonik biçim sondaki eğik çizgili yol.** `index.html` ve çizgisiz
   biçim 307 ile ona yönleniyor; `canonical`, `og:url`, sitemap `loc` ve iç linklerin
   hepsi `/zam/2026-08/` biçiminde olmalı. Sonda ölçümden sonra revert edildi
   (`c159f44`), canlıda 404 döndüğü doğrulandı, kök 200 ve `app.<hash>.js` yerinde.
2. **Derin yolda göreli varlık yolu.** SPA fallback arızasıyla aynı sınıf hata: `./static/...`
   `/zam/2026-08/static/...`e çözülür. Testte 0-eşleşme iddiası var (f-2) ama asıl kanıt
   canlı sayfada 404 olmaması.
3. **Aylık ölçüt ana sayfanın 30 günlük ölçütünden FARKLI — bilerek.** `zamHavuzu()`
   `_yerelGunISO` ile bugüne çakılı; takvim ayı için parametreleştirilemez.
   Ay sayfası bu yüzden **ay başı → ay sonu** karşılaştırması yapıyor; eşik (`ZAM_ESIK`) ve
   salınım elemesi (`_salinimVarSeri`) `app.js`'ten geliyor ama **pencere yeni**.
   Somut sonucu: bir ürün `/zam/2026-08/`'de görünüp ana sayfa şeridinde görünmeyebilir.
   *Önlem:* ay sayfası "30 günün en yükseği" tipi bir iddia **kurmuyor**, cümle
   "Ağustos 2026'da gözlenen artış" — ve yöntem bölümü farkı açıkça yazıyor.
   Bu, projenin "iddia–hesap uyumu" kuralının hub tarafındaki karşılığı.
   **Şüphem:** ilerideki bir oturum bu iki ölçütü "tutarsız" görüp birini diğerine
   uydurmaya kalkabilir. Yöntem bölümü ve testler bunu belgeliyor.
4. **Yinelenen içerik: market × kategori kesişimi.** Aynı ürün satırı hem
   `/market/migros/` hem `/kategori/sut/` sayfasında çıkabilir. Sütunlar ve çerçeve farklı
   (biri "rakibe göre fark", diğeri "market içi dağılım") ama Google'ın bunu nasıl
   değerlendireceğini bilmiyorum. *Önlem:* farklı sıralama ölçütü + sayfaya özgü özet
   paragrafı; ölçüsü Search Console'dan gelecek.
5. **Bayat veri artık kod deploy'unu da bloke ediyor.** Kontrol wrangler'dan önce
   koştuğu için, scraper iki gün düşerse acil bir kod düzeltmesi de yayınlanamaz.
   Bu, istenen davranışın (sessizce bayat yayınlama) doğrudan bedeli. Kaçamak anahtar
   (`ZORLA=1`) **koymuyorum** — bu projede sessiz bypass'ın maliyeti ölçülü.
   Alternatif isteniyorsa: `workflow_dispatch` girdisi olarak açık, loglanan bir atlama.
6. **`dondurulmus` (1 alt kategori, 28 adet ≥2 marketli) ve `meyve-sebze` (2 alt kategori)
   sayfaları en zayıf halkalar.** Eşiği geçiyorlar ama "karşılaştırma" vaadi bu iki sayfada
   en ince. Search Console 8-12 hafta sonra bu ikisini ilk düşürecek adaylar.
7. **`hal_gecmis.json` şeması doğrulandı, risk kapandı** — kalem adı → günlük `{t, f}` serisi,
   bugün 8 gün. Kalan küçük risk: anahtar **ürün adının küçük harfli hâli**
   (`adaçayi (yaş-taze)`), `hal.json`'daki `ad` alanıyla eşleşme Türkçe küçültme
   (`toLocaleLowerCase('tr')`) gerektiriyor — `I/ı/İ/i` tuzağı. Eşleşmeyen kalem sessizce
   düşmemeli, sayısı loglanmalı.
8. **`index.html`'e üretilmiş footer enjekte etmek yeni bir mekanizma.** Vite
   `transformIndexHtml` bugün yalnızca `app.js` hash'i için kullanılıyor; ikinci bir
   dönüşüm eklemek o eklentinin sırasına duyarlı. Onay gelmezse statik footer yeterli.
9. **`app-vm.mjs` çıkarımı çalışan bir dosyayı kırabilir.** `anasayfa-uret.mjs` bugün
   üretimin belkemiği. Bayt bayt karşılaştırma kabul ölçütü olarak Görev 1'de duruyor;
   geçmezse çıkarım geri alınır ve `hub-uret.mjs` kendi gövdesiyle koşar (kopya kabul edilir,
   gerekçesi yazılır).
10. **Node 20 / Node 24 ayrışması hub tarafını etkilemiyor** — hub sayfaları yalnızca
    `deploy.yml`'de (Node 24) üretiliyor, `update-data.yml` onlara dokunmuyor. Ama
    `anasayfa.json` hâlâ iki majörde doğuyor (açık borç) ve hub sayfaları o dosyayı okuyor;
    yani borç kapanmadıkça hub içeriği de dolaylı olarak iki motora bağlı.
11. **Hub sayfaları indekslenmeyebilir.** Dış bağlantı hâlâ yok. Bu faz "indekslenecek
    içerik üretmek"; "indekslenmesini sağlamak" Search Console + zaman işi. Sayfaların
    trafik getireceğine dair bir söz vermiyorum, ölçüm 8-12 hafta sonra.

---

## Görevler

Her görev bağımsız test edilebilir bir çıktı bırakır. Kod, uygulama turunda yazılacak.

### Görev 1 — `app.js` vm gövdesini `scripts/app-vm.mjs`'e çıkar
**Dosyalar:** Oluştur `scripts/app-vm.mjs` · Değiştir `scripts/anasayfa-uret.mjs`
**Üretir:** `appOrtamiKur({ kok }) -> { ic, ctx }`
- [ ] Çıkarımdan **önce** `node scripts/anasayfa-uret.mjs` koştur, `data/anasayfa.json`'un
      sha256'sını al (Windows CRLF tuzağı: dosya JSON, tek satır — sorun yok)
- [ ] Gövdeyi taşı, `anasayfa-uret.mjs` import etsin, davranışa dokunma
- [ ] Yeniden koştur, sha256 karşılaştır — **fark varsa görev başarısız**, `uretim` alanı
      hariç tut (zaman damgası her koşuda değişir; karşılaştırma `uretim` alanı çıkarılarak yapılır)
- [ ] Commit

### Görev 2 — `scripts/hub-sayfa.mjs`: saf model + eşikler (TDD)
**Dosyalar:** Oluştur `scripts/hub-sayfa.mjs`, `test_hub_uret.mjs`
**Üretir:** `ESIK_SATIR`, `ESIK_KELIME`, `ESIK_AY_BASLANGIC`, `gunDamgasi()`, `slug()`,
`sayfaKarari(model) -> { durum, sebep, satir, kelime }`
- [ ] `test_hub_uret.mjs`'i yaz (f-1'deki iddialar), koştur, **kırmızı** olduğunu gör
- [ ] `hub-sayfa.mjs`'in model/eşik yarısını yaz, testi yeşile çevir
- [ ] Commit

### Görev 3 — `scripts/hub-sayfa.mjs`: HTML üretimi (TDD)
**Dosyalar:** `scripts/hub-sayfa.mjs`, `test_hub_html.mjs`
**Üretir:** `sayfaHTML(model) -> string`, `kacir(metin) -> string`
- [ ] `test_hub_html.mjs`'i yaz (f-2), kırmızı gör
- [ ] Ortak iskelet + dört tip gövdesi, testi yeşile çevir
- [ ] Commit

### Görev 4 — `scripts/hub-uret.mjs`: orkestrasyon
**Dosyalar:** Oluştur `scripts/hub-uret.mjs` · Değiştir `.gitignore`
- [ ] Veriyi oku, `app-vm` ile `app.js` sabitlerini/fonksiyonlarını al, dört tip modeli kur
- [ ] `.hub/**` + `.hub/manifest.json` yaz; atlananları `[hub] ATLANDI` ile bas
- [ ] Koştur: beklenen sayfaların üretildiğini, 2026-05 ve 2026-06'nın gerekçeyle atlandığını, sürenin < 30 sn
      olduğunu çıktıdan doğrula
- [ ] Commit

### Görev 5 — sitemap genişletmesi (TDD)
**Dosyalar:** `scripts/sitemap.mjs`, `test_sitemap.mjs` (5. bölüm), `scripts/prepare-public.mjs`
- [ ] Test bölümünü yaz (f-4), kırmızı gör
- [ ] `sitemapEkle` + `prepare-public` bağlantısı, yeşile çevir
- [ ] `node scripts/prepare-public.mjs` sonrası `public/sitemap.xml`'de `1 + üretilen sayfa` kadar `<url>` say (bugün 19)
- [ ] Commit

### Görev 6 — tazelik kontrolü `--hub` kipi (TDD, ÖN KOŞUL)
**Dosyalar:** `scripts/veri_tazelik_kontrol.py`, `test_hub_tazelik.py`
- [ ] `test_hub_tazelik.py`'yi yaz (f-3), kırmızı gör
- [ ] `--hub <dizin>` kipini yaz: manifest ↔ dosya ↔ türetilmiş beklenti + damga yaşı
- [ ] `py test_tazelik.py` hâlâ yeşil (mevcut kip bozulmadı)
- [ ] Commit

### Görev 7 — build zinciri + CI kapısı
**Dosyalar:** `package.json`, `.github/workflows/deploy.yml`
- [ ] `build` zincirine `hub-uret.mjs` ekle
- [ ] `deploy.yml`: `npm run build` ile wrangler **arasına**
      `python scripts/veri_tazelik_kontrol.py --hub dist` (`continue-on-error` **YOK**)
- [ ] `deploy.yml`'a `setup-python` ekle (bugün yalnızca Node var)
- [ ] Yerel tam build koştur, `dist/zam/2026-08/index.html` ve 18 kardeşinin var olduğunu gör
- [ ] Commit

### Görev 8 — uygulama ↔ hub bağlantıları (**ONAY GEREKTİRİR**)
**Dosyalar:** `app.js`, `index.html`, `sw.js`, `vite.config.js`
- [ ] `?screen=kategori&kat=<slug>` rotası (`openCategory`)
- [ ] Ana ekran footer'ına `<nav>` link bloğu (manifest'ten üretilmiş)
- [ ] `sw.js` v207 → **v208**
- [ ] `node test_seo_zemin.mjs`, `node test_baslik_hiyerarsi.mjs`, `node test_routing_duzen.mjs`
      **ayrı ayrı** koştur (commit ile aynı zincire bağlama — bu ders alındı)
- [ ] Commit

### Görev 9 — canlı doğrulama + belge
**Dosyalar:** `CLAUDE.md`
- [ ] Deploy sonrası `curl -sI https://pazarapp.net/zam/2026-08/` → **200** (Risk 1'in kapanışı;
      tarayıcı uzantısı header sıyırdığı için ölçüm `curl` ile, MCP tarayıcısıyla değil)
- [ ] 19 URL'nin hepsi için durum kodu tablosu çıkar; 404 varsa `html_handling` yaz ve tekrar
- [ ] `sitemap.xml` canlıda `1 + üretilen sayfa` kadar `<url>` içeriyor mu (bugün 19)
- [ ] Bir hub sayfasını canlı tarayıcıda aç: göreli yol 404'ü var mı (Ağ sekmesi)
- [ ] `CLAUDE.md`'ye durum notu: ne üretiliyor, nerede duruyor, hangi kapı kırmızıya çeviriyor,
      Search Console ölçüm penceresi (8-12 hafta) ve ürün sayfalarının **açılmadığı** kararı
- [ ] Commit

---

## Öz-denetim

- **Kapsam:** a→g'nin yedisi de karşılandı (a: dört tip ayrıntılı · b: iki eşik + atlama akışı ·
  c: yeni dosya + zincir yeri + gerekçe · d: `sitemapEkle` + beş satırlık `lastmod` tablosu ·
  e: iki yön + onay gereken iki değişiklik · f: 3 yeni dosya + 1 bölüm · g: 11 risk).
- **Ön koşul:** Görev 6 (tazelik `--hub`) ve Görev 7 (CI kapısı) olmadan sayfa yayınlanmıyor —
  Mustafa'nın "bunsuz başlama" şartı zincire gömülü.
- **81 il sayfası:** elendi; `il_marketler.json` verisi 7 market sayfasının içinde kullanılıyor.
- **Ürün sayfaları:** açılmıyor, planda hiçbir görev üretmiyor.
- **Ad tutarlılığı:** `hub-sayfa.mjs` (saf) / `hub-uret.mjs` (IO) / `app-vm.mjs` (ortak gövde)
  adları tüm bölümlerde aynı; manifest alanları `durum`, `sebep`, `satir`, `kelime`, `son_veri`,
  `yol` olarak tek biçimde geçiyor.
