# Pazar Uygulaması — Claude Proje Dosyası

## Proje Nedir
Türkiye'de hal toptancı fiyatları + zincir market fiyatlarını karşılaştıran PWA uygulaması.

> **2026-05-24:** Dondurulmuş canlıya çıktı (217 ürün). Searlo eşik 0.55'e düşürüldü. CI'a git pull --rebase eklendi (race fix).

- **Canlı URL:** https://avkkann.github.io/pazar-app
- **GitHub:** https://github.com/avkkann/pazar-app
- **Kullanıcı:** Mustafa Karabıyık (avkkann)
- **Masaüstü:** C:\Users\MUSTAFA KARABIYIK\Desktop\pazar-app
- **Araç:** OpenCode (CMD veya PowerShell) — cd Desktop\pazar-app → opencode
- **Test ortamı:** Web (masaüstü Chrome) + iOS (Android KULLANILMIYOR)
- **Python:** `py` komutu ile çalışır (`python` PATH'te yok)

---

## Teknik Yapı
- Frontend: Tek index.html (~1840+ satır), backend yok
- Hosting: GitHub Pages
- PWA: sw.js — telefona kurulabiliyor, **cache şu an v32**
- Otomatik güncelleme: GitHub Actions her gece 03:00 (`.github/workflows/update-data.yml`)
- **Toplam ürün: ~14.269** (8 kategori — dondurulmuş ürünler 8. kategori olarak ayrıldı 2026-05)

---

## Ekranlar
- screen-home — Ana sayfa
- screen-cat — Kategori (2 kolonlu grid, Getir tarzı)
- screen-sepet — Listem + market karşılaştırma + optimal alışveriş
- screen-detay — Ürün detay
- screen-hal — Hal fiyatları (whitelist sistemi)
- screen-firsatlar — Fırsatlar (En Ucuz / Hal vs Market / En Tasarruflu)
- screen-profil — Profil (istatistikler dinamik, tema toggle)

## Nav
- navHome → showScreen('screen-home')
- navSepet → goSepet()  (JS adı eski, kullanıcıya görünen metin "Listem")
- navFirsat → goFirsatlar()
- navProfil → goProfil()

**ÖNEMLİ DİL NOTU:** Kullanıcıya görünen tüm metinler **"Liste/Listem/Listeme/Listemde"** kullanır.
JS değişken/fonksiyon/id adları (sepet, productMap, toggleSepet, navSepet, goSepet, sepetCount, vs) **eski "sepet" terimini koruyor** — bunlara DOKUNMA, kod kırılır. Sadece UI metinleri değişti.

---

## Kategoriler (8 adet — slug → file → emoji)
```js
KATEGORILER = [
  { slug:'meyve-sebze',  file:'urunler_meyve',        emoji:'🍎' },
  { slug:'et',           file:'urunler_et',           emoji:'🥩' },
  { slug:'sut',          file:'urunler_sut',          emoji:'🧀' },
  { slug:'gida',         file:'urunler_gida',         emoji:'🥫' },
  { slug:'icecek',       file:'urunler_icecek',       emoji:'🥤' },
  { slug:'temizlik',     file:'urunler_temizlik',     emoji:'🧴' },
  { slug:'atistirmalik', file:'urunler_atistirmalik', emoji:'🍫' },
  { slug:'dondurulmus',  file:'urunler_dondurulmus',  emoji:'🧊' }, // ← 2026-05 eklendi (scraper post-process)
];
```

**KAT_EMOJI** (kart üst köşesindeki emoji):
```js
{ meyve:'🍎', sebze:'🥦', et:'🥩', sut:'🧀', gida:'🥫', icecek:'🥤',
  temizlik:'🧴', atistirmalik:'🍫', dondurulmus:'🧊', diger:'📦' }
```

**ustKategori()** — alt kategori → ust slug eşlemesi. Atıştırmalık branch'ı:
```js
['Bisküvi ve Kraker','Cips','Dondurmalar','Gofret','Kek',
 'Kuruyemiş ve Kuru Meyve','Sakız ve Şekerleme','Tatlılar','Çikolata']
→ 'atistirmalik'
```

**Dondurulmuş branch:** ana_kategori "Dondurulmuş Ürünler" → 'dondurulmus' (scraper post-process bu değeri yazıyor)

**placeholderRenk()** — resim YOK fallback'i: kategori adına göre `{bg, emoji}` döner.
Atıştırmalık: `{bg:'#FFF4E0', emoji:'🍫'}`.
Dondurulmuş: `{bg:'#E0F2FE', emoji:'🧊'}`.
**ÖNEMLİ:** Yeni kategori eklerken placeholderRenk'i de güncelle, yoksa kart 📦 gösterir (detay sayfası KAT_EMOJI'yi okuyor, kart placeholderRenk'i okuyor — farklı kaynaklar).

---

## Kritik Teknik Notlar

### hal.json Cache
let _halCache, _halPromise → halVeriGetir() kullan, direkt fetch yapma

### halEsles
- Sadece meyve/sebze eşleşir
- **HAL_UYUMSUZ listesi** (2026-05 genişletildi, 60+ madde): donuk, dondurulmus, dondurulmuş, dondurma, konserve, hazir, islenmis, salca, tursu, kurutulmus, fileto, salam, sucuk, sosis, pastirma, corba, pure, püre, cipsi, cips, nugget, kroket, burger, superfresh, pack, paket, kutu, sis, rulo, dilim, mince, frozen, recel, reçel, marmelat, meyve suyu, suyu, nektar, smoothie, sirup, şurup, surup, komposto, kompoto, suzme, sikma, sıkma, dondurmasi, dondurmali, dondurmalı, tatlandirici, aromali, aromalı, feast, tukas, tukaş, garden, migrosone, tat, penguen, lapestos, yagi, yağı
- **"adet" birimi filtresi**: ürün adında `\d+\s*adet` regex'i eşleşirse hal eşleştirme iptal (ananas, karpuz gibi büyük meyveler için yanlış birim varsayımını önler)
- Birim normalize: "300 Gr" → kg'a çevrilir
- Skor 0.6+ ve oran 0.1x-5x arası gerekli

### SW Cache
Şu an: pazar-cache-v32
Her büyük JS/HTML değişikliğinde sw.js CACHE_NAME versiyonunu artır!

### Fiyat
tl() fonksiyonu zaten ₺ ekliyor — ekstra ₺ ekleme!

### Fırsatlar Sepete Ekle
firsatSepetEkle(btn, id) kullan — toggleSepet değil!
_id yoksa: u._id = u.ad + '_' + u.agirlik_hacim ile oluşturuluyor
**id BASE64 ile encode ediliyor**:
- Render: `btoa(unescape(encodeURIComponent(u._id)))`
- Decode (fonksiyon başında): `try { id = decodeURIComponent(escape(atob(id))); } catch(e) {}`

### Fırsatlar catFiles HARDCODED
`renderFirsatlar()` içinde `catFiles` dizisi statik tanımlı.
**Yeni kategori eklerken buraya da eklemek ZORUNLU**, yoksa fırsatlarda görünmez:
```js
const catFiles = ['urunler_meyve','urunler_et','urunler_sut','urunler_gida',
                  'urunler_icecek','urunler_temizlik','urunler_atistirmalik','urunler_dondurulmus'];
```

### Fırsatlar İstatistik Kartları (2026-05)
- `_firsatOzetHesapla(tumUrunler)` — Fırsatlar açıldığında üç sayıyı paralel hesaplar (En Ucuz / Hal Fırsatı / Fiyat Farkı)
- Tab değişimde sayılar bozulmaz, daima tüm sekmeler için dolu görünür
- Hal Fırsatı async hesaplanır (halVeriGetir bekler), önce '…' sonra gerçek sayı yazar
- renderFirsatUcuz / renderFirsatHal / renderFirsatTasarruf fonksiyonları artık _firsatOzetGuncelle ÇAĞIRMAZ

### Kategori countNum (2026-05 fix)
- `loadKategoriSayfasi` sonunda `document.getElementById('countNum').textContent = all.length` zorunlu
- Önceden sadece filtre tetiklenince güncellenirdi → ilk açılışta '…' kalırdı

### loadCat 404 dayanıklılığı (2026-05 fix)
- Kategori JSON dosyası 404 veya parse hatası verirse boş array döner (try/catch + resp.ok kontrol)
- Yeni kategori eklendiğinde scraper henüz çalışmadıysa "Ürün bulunamadı" gösterir, hata vermez

### Dondurulmuş Kategori (2026-05 eklendi)
- scraper.py post-process: 7 ana kategori normal scrape edildikten sonra `dondurulmus_ayir()` çalışır
- DONDURULMUS_ANAHTAR: ['dondurul', 'donuk', 'superfresh', 'feast', 'lapestos']
- DONDURULMUS_ATLA_KAT: ['dondurmalar'] (ice cream — bunlar atıştırmalıkta kalmalı)
- DONDURULMUS_ATLA_DOSYA: ['urunler_temizlik'] (Koroplast yanlış pozitifini önler)
- Eşleşen ürünler ana_kategori'si "Dondurulmuş Ürünler" olarak değiştirilip urunler_dondurulmus.json'a taşınır
- Orijinal kategori `_original_kategori` alanında saklanır
- Yaklaşık 218 ürün

### Ürün Kartı
- product-card-img: 130px yükseklik, object-fit: contain
- Hal badge: product-hal-badge class, turuncu
- **Kategori kartı buton class'ı: `.add-btn`** (NOT `.btn-ekle`)
- setEkleBtns selector: `.add-btn[data-pid="..."]` (textContent + style.background ile günceller)

### ⚠️ SEPET SCOPE KURALI (KRİTİK)
- `let sepet = ...` **module-scope** — global window'a yazılmaz
- `let productMap = ...` **module-scope** — global window'a yazılmaz
- saveSepet() **module-scope sepet**'i localStorage'a yazar
- **HER YERDE `sepet` ve `productMap` kullan**, `window.` KULLANMA
- Bunlar uyumsuzluk yaratırsa: rozet doğru gösterir ama sepet ekranı boş kalır, profil 0 gösterir, kategori butonu görsel güncellenmez
- **openDetay productMap'i KOŞULSUZ doldurmalı** (`productMap[u._id] = u`). Yoksa toggleSepet `productMap[id] || urunler.find(...)` fallback'ine düşer ve `urunler` çoğu zaman boş olduğu için sessizce fail eder. Hata Console'a düşmez, sadece sepete ekleme çalışmaz. (2026-05 fix)

### _firsatKartHtml
- u._id eksikse oluşturur
- productMap[u._id] = u ile **koşulsuz** map'e yazar

### Karşılaştırma Ekranı (Listem → Marketleri Karşılaştır)
- `karsilastir()` fonksiyonu 3 senaryo üretir: bestN(1), bestN(2), bestN(3) — kombinasyon optimizasyonu
- `bestIdx` ile en düşük tutarlı kart belirlenir, otomatik `.selected` class'ı alır + "✓ EN UCUZ" badge görünür
- `showKombo(idx)` tıklama sadece detayı günceller — selected class'ı en ucuzda **sabit kalır** (2026-05 fix: önceden toggling vardı, kafa karıştırıyordu)
- `.cmp-best-badge` CSS class'ı: yeşil rozet (#059669 bg, beyaz yazı)

### Profil Sayıları
**Dinamik** — hardcoded sayı YOK:
- "Ürün" → KATEGORILER üzerinden Promise.all ile toplam hesaplanır
- "Hal Ürünü" → halVerisi.urunler.length
- "Listemde" → sepet.length (label "Listemde", içerik dinamik)

---

## Ürün JSON Şeması (KORUMA ŞART)
```json
{
  "ad": "...",
  "ana_kategori": "Bisküvi ve Kraker",  // ← alt kategori adı
  "agirlik_hacim": "40 GR",
  "resim": "https://...",                // null/boş olabilir → placeholder
  "en_dusuk_fiyat": 7.5,
  "market_fiyatlari": [{"market": "...", "fiyat": 0}]
}
```
**ana_kategori değerleri** ustKategori()'de eşleştirilir. Bu şema bozulursa index.html komple patlar.

---

## Veri Kaynağı
- **API:** marketfiyati.org.tr — searchByCategories (liste) + searchByIdentity (detay)
- **Detay endpoint'i:** `https://api.marketfiyati.org.tr/api/v2/searchByIdentity` (POST, payload: identity/identityType/keywords/depots/distance/latitude/longitude/pages/size)
- **NOT:** Detay endpoint'i resim TUTMUYOR — `imageUrl` alanı dönmüyor. Eksik resimler için harici kaynak gerekli.

---

## Searlo Resim Doldurma (2026-05 AKTİF — ÇALIŞIYOR)
- **API:** `https://api.searlo.tech/api/v1/search/images`
- **Header:** `x-api-key: sk_...`
- **Param:** `q=ürün adı`
- **Response:** `{images: [{imageUrl, title, source, ...}]}`
- **Key:** `.env` dosyasında `SEARLO_API_KEY=sk_...`
- **GitHub Secret:** `SEARLO_API_KEY` (Settings → Secrets → Actions)
- **Workflow:** `update-data.yml` içinde `python scraper.py` adımında env değişkeni geçilir
- **Eşleşme eşiği:** 0.65 (SEARLO_MATCH_THRESHOLD)
- **Ücretsiz plan limitleri:** 5 istek/saniye · 10 istek/dakika · 200 istek/saat · 1000 istek/gün
- **Yeni mantık (2026-05):**
  - `time.sleep(6.5)` her istek arasında (dakikada ~9 istek, marjlı)
  - `GUNLUK_LIMIT = 950` sayacı → güvenli marj, limit aşılmaz
  - `resimleri_doldur()` aktif (yorum kaldırıldı)
- **Doğrulama (2026-05):** 1361 istek yapılmış, ~%85.8 kapsama (12.242/14.269 ürün resimli). Çalışıyor.

---

## Önemli Fonksiyonlar
- halVeriGetir() — tek fetch cache
- halEsles(u) — hal eşleştirme (HAL_UYUMSUZ filtresi + adet birimi filtresi + ana_kategori meyve/sebze)
- halKgHesapla(ad, f) — birim normalize
- loadCat(slug) — kategori JSON yükle (catCache, 404'te boş array)
- loadKategoriSayfasi(slug, sayfa) — sayfa render (countNum güncelleme sonda)
- uygulaCatFiltre() — market + arama filtresi
- cardHTML(u) — ürün kartı HTML (placeholderRenk kullanır)
- openDetay(urunId) — ürün detay (KAT_EMOJI kullanır, **productMap[u._id] = u zorunlu**)
- toggleSepet(id) — kategori/detay sepete ekle (module-scope sepet)
- setEkleBtns(id, inCart) — `.add-btn[data-pid]` görsel güncelle
- firsatSepetEkle(btn, id) — fırsatlar sepete ekle (base64 decode + module-scope sepet)
- _firsatKartHtml(u, badge, cls, alt) — fırsat kartı HTML
- renderFirsatlar(tab) — fırsatlar render (catFiles HARDCODED!) + _firsatOzetHesapla çağrısı
- _firsatOzetHesapla(tumUrunler) — 3 istatistik sayısını paralel hesaplar (2026-05)
- renderFirsatHal(container, tumUrunler) — Hal vs Market sekmesi (sadece meyve+sebze, HAL_UYUMSUZ filtresi)
- karsilastir() — Listem market karşılaştırma + optimal alışveriş (bestN(1/2/3) + bestIdx vurgu)
- showKombo(idx) — karşılaştırma detayı (selected toggling YOK, sadece detay güncellenir)
- profilGuncelle() — profil istatistikleri (Promise.all dinamik)
- temaToggle() — tema değiştir (data-theme attribute)
- placeholderRenk(anaKat) — resim YOK için {bg, emoji}
- (scraper.py) dondurulmus_ayir() — post-process: dondurulmuş ürünleri ayrı dosyaya taşır (2026-05)

---

## OpenCode Kuralları
1. Bul-değiştir formatı kullan
2. Tek seferde tek değişiklik
3. "Başka hiçbir şeye dokunma" ibaresi
4. SW versiyonunu değişiklikle birlikte artır
5. **Komutu çalıştırmadan önce kendi yorumunu/özetini değil, terminalin HAM çıktısını yapıştırmasını iste** — OpenCode özetlerken yanlış bilgi verebiliyor
6. Sorun: git log --oneline -5 → git reset --hard <hash> → git push --force
7. Commit/push'u OpenCode yapsın diye prompt'a ekle:
   ```
   git add <dosyalar>
   git commit -m "..."
   git pull --rebase  ← her gece 03:00 GitHub Actions push'ladığı için ŞART
   git push
   ```
8. scraper.py ve diğer dosyalara dokunmaması için "kesinlikle dokunma" yaz
9. git diff sonucunda beklenmeyen dosya varsa: `git checkout <dosya>` ile geri al, sonra commit
10. **OpenCode kendi karar vermesin** — sadece verilen değişikliği uygulasın (geçmişte 0.70 yerine 0.60 yazmıştı; ayrıca 3b talimatı vermedim deyip 3b'yi atlama denemiştir)
11. **CLAUDE.md unstaged ise stash döngüsü kullan:** `git stash push` → `git pull --rebase` → `git push` → `git stash pop`. Aksi halde pull rebase patlar.

---

## Tamamlanan
- 2 kolonlu grid kart (Getir tarzı)
- Market filtresi + kategori içi arama
- Sepet + market karşılaştırma
- Hal fiyatları (whitelist)
- halEsles akıllı eşleştirme
- hal.json tek fetch cache
- Fırsatlar ekranı (3 tab, arama, resim, sepete ekle)
- Profil ekranı (dinamik sayılar)
- PWA iOS + web
- Profesyonel logo
- Scraper 3 katmanlı resim sistemi (eski not, scraper sadeleşti)
- Fırsat sepete ekle "?" sorunu (productMap scope + base64 encode)
- Sepet ekranı ürünleri kaybetme (window.sepet → module-scope sepet)
- Profil ekranında sepet sayısı 0 (window.sepet → sepet)
- Kategori + butonu görsel güncellenmeme (.btn-ekle → .add-btn)
- **2026-05: Atıştırmalık kategorisi (3831 ürün, 7. kategori olarak eklendi)**
- **2026-05: Searlo API entegrasyonu (kod hazır)**
- **2026-05: Profil ürün sayısı dinamik hesaplanıyor**
- **2026-05: placeholderRenk atıştırmalık branch'ı**
- **2026-05: manifest.json path düzeltildi (./manifest.json), favicon eklendi, apple-touch-icon göreli path, mobile-web-app-capable meta eklendi, SW cache v19**
- **2026-05: Header logosu icon-192.png ile değiştirildi (P placeholder kaldırıldı, cache v20)**
- **2026-05: Searlo resim doldurma aktif edildi: sleep 6.5s + günlük 950 istek limiti (rate limit teşhis edildi: 10 istek/dk ücretsiz plan)**
- **2026-05: Sepet → Liste dil değişikliği (Sepetim/Sepete Ekle → Listem/Listeme Ekle, cache v21)**
- **2026-05: Karşılaştırma ekranında en ucuz seçenek otomatik vurgulu + "✓ EN UCUZ" badge eklendi (cache v22-v23)**
- **2026-05: Kalan "Sepette/sepette" referansları "Listemde/listemde" olarak düzeltildi (detay buton state + profil label, cache v24)**
- **2026-05: openDetay bug fix: productMap[u._id] = u eklendi (kategori detayından "Listeme Ekle" sessizce fail ediyordu, cache v25)**
- **2026-05: HAL_UYUMSUZ listesi genişletildi (dondurulmuş/reçel/meyve suyu/smoothie/kompoto/sıkma/marmelat vs hal ile eşleşmeyecek), profil "Sepet boş" → "Liste boş" (cache v26)**
- **2026-05: countNum fix — kategori ekranında "..." yerine ürün sayısı gösteriliyor (cache v27)**
- **2026-05: HAL_UYUMSUZ market markaları + "adet" birimi filtresi (Feast Çilek, Ananas 1 Adet vs hal ile eşleşmiyor, cache v28)**
- **2026-05: HAL_UYUMSUZ lapestos + yağı (Dnk Lapestos donuk meyve serisi + Avokado Yağı elendi, cache v29)**
- **2026-05: Fırsatlar istatistik kartları her tab'da dolu görünüyor (_firsatOzetHesapla paralel hesaplama, cache v30)**
- **2026-05: 8. kategori — Dondurulmuş Ürünler (scraper post-process, ~218 ürün, cache v31)**
- **2026-05: loadCat 404 dayanıklılığı (yeni kategori scrape edilmemişken zarif boş ekran, cache v32)**
- **2026-05: Bug 10 yan etki — Atıştırmalık tek kart sorunu (Dondurulmuş eklenince grid 2x4 tam doldu)**
- **2026-05: Searlo doğrulandı — 1361 istek yapılmış, ~%85.8 kapsama (12.242/14.269 ürün resimli). Çalışıyor.**

## Bekleyen
- Sıralama seçeneği (En ucuz / A-Z)
- Fiyat geçmişi grafiği
- Sepet paylaşma (WhatsApp)
- Şehir seçimi (hal.gov.tr iller)
- Ürün resimleri (eksik ~2267/14430 = %15.7 — Searlo eşik 0.55, takip)
- Landing page (OpenDesign'da yapılıyor — v1 ve v2 hazır ama v2 mobilde bozuk; v3 bekleniyor)

---

## Landing Page Notları (yan proje)
- Renk paleti: #0F5132 (primary), #1D9E75 (light), #D97606 (hal accent), #F8F9FA (bg)
- Font: Fraunces (display serif) + Inter (body)
- Tarz: editorial, sessiz, zamansız (Stripe/Linear/Are.na vibe)
- Telefon mockup için gerçek ekran görüntüleri gerekli: app-screen-1.webp, -2.webp, -3.webp
- v2'nin bilinen sorunu: mobilde hero sonrası tüm section'lar görünmüyor (büyük olasılıkla bir JS hatası IntersectionObserver setup'ından önce ölüyor, .reveal opacity:0 kalıyor)
- v3 için: progressive enhancement (JS olmadan içerik görünsün), custom cursor / drift orbs / sticky timeline KALDIRILSIN, try/catch ile robust

---

## .gitignore İçeriği (önemli)
```
.env
test_*.py
*.test.py
firsat_kod.txt
test_export.xlsx
scraper.py.bak
```
**.env içinde API key var, asla repo'ya gitmemeli!**

---

## Dikkat — API Key Güvenliği
- Searlo API key `.env`'de, repo'ya GİTMİYOR
- GitHub Actions için **Settings → Secrets → SEARLO_API_KEY** olarak eklendi
- **API key'ler ekran görüntüsünde gösterilmemeli** (bu projede 2 key yandı, revoke edildi — yeni keylerde dikkat)
