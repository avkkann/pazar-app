# Pazar Uygulaması — Claude Proje Dosyası

## Proje Nedir
Türkiye'de hal toptancı fiyatları + zincir market fiyatlarını karşılaştıran PWA uygulaması.

- **Canlı URL:** https://avkkann.github.io/pazar-app
- **GitHub:** https://github.com/avkkann/pazar-app
- **Kullanıcı:** Mustafa Karabıyık (avkkann)
- **Masaüstü:** C:\Users\MUSTAFA KARABIYIK\Desktop\pazar-app
- **Araç:** OpenCode (CMD) — cd Desktop\pazar-app → opencode

---

## Teknik Yapı
- Frontend: Tek index.html (~1700+ satır), backend yok
- Hosting: GitHub Pages
- PWA: sw.js — telefona kurulabiliyor, cache v9
- Otomatik güncelleme: GitHub Actions her gece 03:00

---

## Ekranlar
- screen-home — Ana sayfa
- screen-cat — Kategori (2 kolonlu grid, Getir tarzı)
- screen-sepet — Sepet + market karşılaştırma
- screen-detay — Ürün detay
- screen-hal — Hal fiyatları (whitelist sistemi)
- screen-firsatlar — Fırsatlar (En Ucuz / Hal vs Market / En Tasarruflu)
- screen-profil — Profil (istatistikler, tema toggle)

## Nav
- navHome → showScreen('screen-home')
- navSepet → goSepet()
- navFirsat → goFirsatlar()
- navProfil → goProfil()

---

## Kritik Teknik Notlar

### hal.json Cache
let _halCache, _halPromise → halVeriGetir() kullan, direkt fetch yapma

### halEsles
- Sadece meyve/sebze eşleşir
- HAL_UYUMSUZ listesi: donuk, dondurulmus, konserve... ('paket' YOK, 'pack' var)
- Birim normalize: "300 Gr" → kg'a çevrilir
- Skor 0.6+ ve oran 0.1x-5x arası gerekli

### SW Cache
Şu an: pazar-cache-v9
Her büyük JS değişikliğinde sw.js CACHE_NAME versiyonunu artır!

### Fiyat
tl() fonksiyonu zaten ₺ ekliyor — ekstra ₺ ekleme!

### Fırsatlar Sepete Ekle
firsatSepetEkle(btn, id) kullan — toggleSepet değil!
_id yoksa: u._id = u.ad + '_' + u.agirlik_hacim ile oluşturuluyor

### Ürün Kartı
- product-card-img: 130px yükseklik, object-fit: contain
- Hal badge: product-hal-badge class, turuncu

---

## Önemli Fonksiyonlar
- halVeriGetir() — tek fetch cache
- halEsles(u) — hal eşleştirme
- halKgHesapla(ad, f) — birim normalize
- uygulaCatFiltre() — market + arama filtresi
- cardHTML(u) — ürün kartı HTML
- firsatSepetEkle(btn, id) — fırsatlar sepete ekle
- _firsatKartHtml(u, badge, cls, alt) — fırsat kartı HTML
- profilGuncelle() — profil istatistikleri güncelle
- temaToggle() — tema değiştir (data-theme attribute)

---

## OpenCode Kuralları
1. Bul-değiştir formatı kullan
2. Tek seferde tek değişiklik
3. "Başka hiçbir şeye dokunma" ekle
4. SW versiyonunu değişiklikle birlikte artır
5. Sorun: git log --oneline -5 → git reset --hard <hash> → git push --force

---

## Tamamlanan
- 2 kolonlu grid kart (Getir tarzı)
- Market filtresi + kategori içi arama
- Sepet + market karşılaştırma
- Hal fiyatları (whitelist)
- halEsles akıllı eşleştirme
- hal.json tek fetch cache
- Fırsatlar ekranı (3 tab, arama, resim, sepete ekle)
- Profil ekranı
- PWA iOS + Android
- Profesyonel logo
- Scraper 3 katmanlı resim (API + depot + Open Food Facts)

## Bekleyen
- Fırsatlar sepete ekle son test
- Sıralama seçeneği (En ucuz / A-Z)
- Fiyat geçmişi grafiği
- Sepet paylaşma (WhatsApp)
- Şehir seçimi (hal.gov.tr iller)
