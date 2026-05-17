# Pazar Uygulaması — Claude Proje Dosyası

## Proje Nedir
Türkiye'de hal toptancı fiyatları + zincir market fiyatlarını karşılaştıran PWA uygulaması.

- **Canlı URL:** https://avkkann.github.io/pazar-app
- **GitHub:** https://github.com/avkkann/pazar-app
- **Kullanıcı:** Mustafa Karabıyık (avkkann)
- **Masaüstü:** `C:\Users\MUSTAFA KARABIYIK\Desktop\pazar-app`
- **Araç:** OpenCode (CMD üzerinden) — `cd Desktop\pazar-app` → `opencode`

---

## Teknik Yapı
- **Frontend:** Tek `index.html` dosyası (HTML/CSS/JS) — backend yok
- **Hosting:** GitHub Pages (statik)
- **Veri:** JSON dosyaları `data/` klasöründe
- **PWA:** Service Worker (`sw.js`) — telefona kurulabiliyor
- **Otomatik güncelleme:** GitHub Actions her gece 03:00'da çalışıyor

---

## Dosya Yapısı
```
pazar-app/
├── index.html          ← Tüm uygulama (HTML/CSS/JS tek dosya)
├── manifest.json       ← PWA manifest
├── sw.js               ← Service Worker (cache-first for hal.json)
├── CLAUDE.md           ← Bu dosya
├── data/
│   ├── hal.json        ← 142 ürün (hal.gov.tr + antalyakomisyonculardernegi.com)
│   ├── urunler_meyve.json   ← 193 ürün
│   ├── urunler_et.json      ← 752 ürün
│   ├── urunler_sut.json     ← 2169 ürün
│   ├── urunler_gida.json    ← 1800 ürün
│   ├── urunler_icecek.json  ← 1331 ürün
│   └── urunler_temizlik.json ← 3432 ürün
├── static/
│   ├── icon-192.png    ← PWA ikon (yaprak damla + PAZAR logo)
│   └── icon-512.png    ← PWA ikon büyük
└── .github/
    └── workflows/
        └── update-data.yml  ← Gece 03:00 scraper
```

---

## Veri Yapıları

### Ürün JSON (market fiyatları)
```json
{
  "ad": "Patates 1 Kg",
  "ana_kategori": "Sebze",
  "agirlik_hacim": "1 KG",
  "resim": "https://cdn.marketfiyati.org.tr/...",
  "en_dusuk_fiyat": 15.25,
  "market_fiyatlari": [
    {"market": "a101", "fiyat": 15.25, "depo_adi": "İstanbul Üsküdar"},
    {"market": "bim", "fiyat": 18.75, "depo_adi": "İstanbul Üsküdar"}
  ]
}
```
Market değerleri: `a101`, `bim`, `migros`, `carrefour`, `sok`, `tarim_kredi`

### Hal JSON
```json
{
  "kaynak": "...",
  "sehir": "Antalya",
  "bulten_tarihi": "2026-05-17",
  "cekme_tarihi": "...",
  "toplam_urun": 142,
  "urunler": [
    {"ad": "Domates", "fiyat": 75.00, "birim": "Kg", "tarih": "16.05.2026"}
  ]
}
```

---

## Ekranlar (screen-* id'leri)
- `screen-home` — Ana sayfa (kategori kartları)
- `screen-cat` — Kategori ürün listesi
- `screen-sepet` — Sepet + market karşılaştırma
- `screen-detay` — Ürün detay
- `screen-hal` — Hal fiyatları ekranı

---

## Mevcut Özellikler
- ✅ 2 kolonlu grid kart tasarımı (Getir tarzı)
- ✅ Market filtresi (pill butonlar)
- ✅ Sepet + market karşılaştırma (1/2/3 marketten al)
- ✅ Hal fiyatları ekranı (meyve/sebze filtresi — whitelist sistemi)
- ✅ PWA — iOS ve Android'e kurulabiliyor
- ✅ Service Worker cache (hal.json → cache-first, tek fetch)
- ✅ GitHub Actions otomatik veri güncelleme
- ✅ apple-touch-icon (iOS PWA ikon desteği)
- ✅ Profesyonel logo (yaprak damla + PAZAR tipografi)

---

## Önemli Teknik Notlar

### hal.json Cache Sistemi
`index.html` içinde `halVeriGetir()` fonksiyonu var — hal.json'u tek seferlik çeker:
```javascript
let _halCache = null;
let _halPromise = null;
function halVeriGetir() {
  if (_halCache) return Promise.resolve(_halCache);
  if (_halPromise) return _halPromise;
  _halPromise = fetch('./data/hal.json')...
}
```
**ÖNEMLİ:** hal.json'a doğrudan `fetch()` yapma, her zaman `halVeriGetir()` kullan.

### Hal Sebze/Meyve Sınıflandırması
`renderHalScreen()` içinde `HAL_SEBZE_LISTESI` adlı `Set` var — whitelist tabanlı sistem.
Türkçe karakter normalize ediliyor (`ğ→g`, `ü→u` vb.).
142 ürünün tamamı elle doğrulandı: 82 sebze, 60 meyve.

### Service Worker Stratejisi
- `hal.json` → **cache-first** (günde 1 kez Actions günceller, tekrar çekmeye gerek yok)
- Diğer data dosyaları → **stale-while-revalidate**

### manifest.json
- İkon yolları göreceli: `"src": "static/icon-192.png"` (başında `/` yok)
- `purpose: "any maskable"` — Android adaptif ikon için şart
- `background_color: "#0F5132"` — yeşil arka plan

---

## GitHub Actions
- `.github/workflows/update-data.yml` — her gece 03:00 çalışır
- Manuel tetikleme: Actions sekmesi → Run workflow
- Scraper dosyaları: `scraper.py`, `hal_scraper.py`
- Veri kaynakları: `marketfiyati.org.tr`, `hal.gov.tr`, `antalyakomisyonculardernegi.com`

---

## Bilinen Sorunlar / Yapılacaklar
- [ ] Bazı ürünlerde resim eksik — placeholder görseli iyileştirilebilir
- [ ] Android'de manifest ikon yolu CDN cache sorunu yaşandı (göreceli yola geçildi)

---

## OpenCode Kullanım Notu
OpenCode'a değişiklik yaptırırken dikkat:
- **Büyük değişikliklerde** index.html'i buraya yapıştır, Claude doğrudan düzeltsin
- OpenCode bazen çok fazla satır siliyor — kritik değişikliklerde güvenilmez
- Her işlem sonrası: `git add . && git commit -m "açıklama" && git push`
- Sorun olursa: `git log --oneline -5` ile çalışan commit'e `git reset --hard <hash> && git push --force`
