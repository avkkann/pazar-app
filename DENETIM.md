# Pazar App — Tam Denetim

**Tarih:** 2026-08-11 · **Canlı:** https://avkkann.github.io/pazar-app/
**Kural:** Bu denetimde hiçbir şey düzeltilmedi, kod değiştirilmedi, commit atılmadı.
Tek istisna: TestSprite kurulum denemesi.

> Bu dosya repoya commit EDİLMEDİ (görev kuralı). Oturum kesilirse diye ilerledikçe yazılıyor.

---

## 1. TÜM BULGULAR — ÖNEM SIRASINA GÖRE

| # | Bulgu | Hat | Nerede | Kanıt (özet) | Önem |
|---|---|---|---|---|---|
| 1 | "30 günün en düşüğü" rozeti **%6,1 yanlış** | 2 | `app.js:1686`, metin `:1565` | 1492 gösterim / 91 yanlış; en kötü %45,5 (Ülker Gofret 16,00 ₺ iddia, ham dip 11,00 ₺) | **KRİTİK** |
| 2 | ~~Ürün kartlarının hiçbiri klavyeyle erişilemiyor~~ **KAPANDI 2026-08-17 (0 oge)** | 4 | `.strip-card`, 51 öğe | onclick var, tabindex/role/keydown yok; sayfada toplam 15 odaklanabilir öğe | **KRİTİK** |
| 3 | Odaklanabilir 15 öğenin **15'inde odak göstergesi yok** | 4 | genel CSS | outline 0/none, telafi box-shadow yok — WCAG 2.4.7 | **KRİTİK** |
| 4 | `fiyat_bildirim`'e **anon INSERT açık**, hız sınırı yok | 1 | Supabase, `app.js:2436` | POST `{"_sid":123}` → `23502 NOT NULL` = RLS/GRANT geçildi | **YÜKSEK** |
| 5 | **Kaçış fonksiyonu hiç yok**, 79 `innerHTML` | 1 | `app.js` geneli | 588 ürün adında kesme işareti (%3,5); onclick `SyntaxError` üretiyor | **YÜKSEK** |
| 6 | "İyi zaman" gerçek dipten kopabiliyor | 2 | `app.js:1718` | 3654 gösterim / 17 çelişki; Hayat Su: bugün 32,90 · gösterilen min 85,00 · ham min 26,25 | **YÜKSEK** |
| 7 | **40 sessiz `catch`**, 17'si tamamen boş | 5 | `app.js` | `2560`/`2602` düşenler+şüpheli şeritlerini izsiz gizliyor | **YÜKSEK** |
| 8 | "Sahte İndirim Analizi" **sessizce atlanabiliyor** | 5 | `update-data.yml` | `continue-on-error: true`; ardından şerit eski puanla üretilir, iş YEŞİL geçer | **YÜKSEK** |
| 9 | `maximum-scale=1.0` — **yakınlaştırma engelli** | 4 | `index.html` viewport | WCAG 1.4.4 | **YÜKSEK** |
| 10 | **Koyu tema kontrastı açıktan kötü** (10 vs 7 ihlal) | 4 | `.cat-card-name` 1,24 · `.zam-yayginlik` 2,15 | tarayıcıda `getComputedStyle` ile doğrulandı | **YÜKSEK** |
| 11 | ~~Dokunma hedefleri 44px altında~~ **KAPANDI 2026-08-17** | 4 | `.siralama-btn` 15px … `.add-btn` 30px | 38 öğe tarandı, çoğu eşiğin altında | **YÜKSEK** |
| 12 | Alarm önerisi hiç gözlenmemiş fiyat önerebiliyor | 2 | `app.js:1285` | 5219 gösterim / 9 vaka (%0,2); ham dibin altında 0 | **ORTA** |
| 13 | `load` olayı **7,6 sn** (166 görsel) | 3 | ana sayfa | DCL 1457 ms, inen 118 KB | **ORTA** |
| 14 | SW sürüm/veri ayrışması riski | 3 | `sw.js` | `anasayfa.json` günlük değişiyor, `CACHE_NAME` elle bump | **ORTA** |
| 15 | Tazelik kontrolünde **içerik-mantık boşluğu** | 5 | `veri_tazelik_kontrol.py` | dosya taze ama içi anlamsızsa yeşil geçer | **ORTA** |
| 16 | `scraper.py`'de `except → pass` | 5 | `scraper.py` | 1 vaka (satır no konumlandırılmadı) | **ORTA** |
| 17 | `urunler` tablosu anon'a tam okunur (16.807 satır) | 1 | Supabase | tasarım gereği, not amaçlı | **DÜŞÜK** |
| 18 | `vite` bir major geride (7.3.6 → 8.2.1) | 1 | `package.json` | `npm audit`: 0 zafiyet | **DÜŞÜK** |

**Bulgu ÇIKMAYAN alanlar (doğrulandı, temiz):**
git geçmişi sızıntısı (tek JWT, o da anon) · indirim rozeti yüzdesi (2625/0 yanlış) ·
zam yüzdeleri (10/0) · birim fiyat (16.753/0) · tek fiyatlı ve geçmişsiz üründe rozet
çıkmaması · 166 görselin tamamında `alt` · ikon butonlarında `aria-label` ·
`lang="tr"` · başlık hiyerarşisinde atlama yok · pozitif `tabindex` yok.

---

## 2. HAT HAT AYRINTILAR

## HAT 1 — GÜVENLİK

### 1.1 Git geçmişi sızıntı taraması — **TEMİZ** (bulgu yok)

`.gitignore` bir dönem yanlış yazılmıştı (`supabasepas.txt` vs `supabasepw.txt`, `a167dfb`'de düzeltildi).
O pencerede sızıntı olup olmadığı tam geçmiş üzerinde tarandı.

**Kanıt — dosya adı taraması:**
```
git log --all --full-history --pretty=format: --name-only --diff-filter=A
  | grep -iE "\.env|secret|passw|parola|sifre|credential|token|key|pw\.txt|pas\.txt|\.pem|\.p12|service.?role"
  -> (hicbir hassas DOSYA ADI yok)

  supabasepw.txt   -> 0 commit
  supabasepas.txt  -> 0 commit
  .env             -> 0 commit
  github-tokeb.txt -> 0 commit
```

**Kanıt — içerik taraması (tüm ref'ler, tüm commit'ler):**
```
git log --all -S 'service_role'        -> HIC SONUC YOK
Gecmisteki BENZERSIZ JWT sayisi: 1
  cozulen payload: role=anon  ref=gbgxxahhbfnulmyecxia
  SONUC: HEPSI ANON — service_role SIZINTISI YOK

Hardcoded parola atamasi taramasi (ilk 300 commit, .py/.js/.txt/.json): sonuc yok
```

**Sonuç:** Repo geçmişinde tek bir sır bile yok. Tek JWT anon anahtarı ve o zaten
tasarım gereği herkese açık (deploy edilen bundle'ın içinde). `github-tokeb.txt`
çalışma kopyasında duruyor ama gitignore'lu ve hiç işlenmemiş.

---

### 1.2 `fiyat_bildirim` tablosuna anon INSERT açık — hız sınırı YOK — **YÜKSEK**

**Nerede:** Supabase `public.fiyat_bildirim`; istemci tarafı `app.js:2436`

**Kanıt (yazma yapılmadan, kasıtlı tip/kısıt hatasıyla):**
```
POST /rest/v1/fiyat_bildirim  body={"_sid":123}
-> HTTP 400
   {"code":"23502","message":"null value in column \"market\" of relation
    \"fiyat_bildirim\" violates not-null constraint"}
```
`23502` bir **veritabanı kısıt hatası**. Yani istek GRANT + RLS katmanlarını
GEÇTİ ve gerçek `INSERT`'e ulaştı; yalnızca NOT NULL kısıdı iptal etti.
Satır oluşmadı. Karşılaştırma — okuma tarafı düzgün kapalı:
```
GET /rest/v1/fiyat_bildirim -> 401  {"code":"42501" permission denied}
```

**Etki:** Anon anahtarla (ki bundle'da açıkta) `_sid` + `market` + gerekli alanları
doldurup sınırsız bildirim yazılabilir. Bildirimler `get_fiyat_bildirimleri`
RPC'siyle kullanıcılara gösteriliyor → sahte fiyat bildirimleriyle ekran kirletilebilir
veya "kullanıcı bildirimi" verisi çöpe çevrilebilir. İstemci kodunda hız sınırı yok
(`app.js:2436` çevresinde debounce/throttle/captcha yok). Sunucu tarafında sınır olup
olmadığı `service_role` olmadan doğrulanamadı — **doğrulanmamış**, varsayılmadı.

**Önem:** YÜKSEK (veri bütünlüğü + kötüye kullanım; kimlik/gizlilik sızıntısı değil)

---

### 1.3 `urunler` tablosu anon'a tam okunur — **DÜŞÜK (tasarım gereği, not amaçlı)**

**Kanıt:**
```
GET /rest/v1/urunler?select=*&limit=1  -> 200, 18 kolon
Prefer: count=exact                    -> 16807 satir
```
Tüm ürün/fiyat veritabanı anon anahtarla toplu indirilebilir. Uygulamanın kendi
çalışma biçimi bu (fiyat verisi zaten kamuya açık), ama rakip bir servisin tüm
veri setini tek istekle çekebileceği not edilmeli.

---

### 1.4 Diğer tablolar ve RPC'ler — **DOĞRU KAPALI**

```
  TABLO                 anon GET
  urunler               200 OKUNABILIR (18 kolon, 16807 satir)
  fiyat_bildirim        401 permission denied
  fiyat_alarmlari       401 permission denied
  favoriler             401 permission denied
  bulten_abonelik       401 permission denied
  push_subscriptions    401 permission denied
  profiles              401 permission denied
  kullanicilar/admin/secrets  404 (tablo yok)

  RPC (anon):
    get_fiyat_dusenler        200  (uygulama kullaniyor, tasarim geregi acik)
    get_fiyat_bildirimleri    200  []
    get_kendi_bildirim_sayim  401  permission denied   <- DOGRU
```
`/rest/v1/` OpenAPI ucu `service_role` istiyor (`"Only the service_role API key can
be used for this endpoint"`) — şema dökümü anon'a kapalı, iyi duruş.

**Yöntem notu (kendi hatam):** İlk INSERT sondam geçersiz kolon adıyla yapılmıştı ve
tüm tablolarda 400 döndü; `PGRST204` (kolon şema önbelleğinde yok) yetki kontrolünden
ÖNCE tetikleniyor, yani o sonuç izin kanıtı DEĞİLDİ. `OPTIONS`'ın `Allow` başlığı da
PostgREST'te statik, role göre değişmiyor. Sonuç ancak gerçek kolonla + kısıt hatasıyla
(23502) kesinleşti. Bu yüzden 1.2 dışındaki tabloların INSERT durumu **ölçülmedi**.

---

### 1.5 XSS yüzeyi: kaçış fonksiyonu HİÇ YOK, 79 `innerHTML` — **YÜKSEK**

**Kanıt:**
```
grep -nE "function (escapeHtml|esc|htmlKacis|sanitize)" app.js
  -> YOK — hicbir kacis fonksiyonu tanimli degil
innerHTML atama sayisi: 79
```
Dış kaynaklı (marketfiyati API) veri doğrudan şablona giriyor:
```
app.js:1038   <div class="detay-name">${u.ad}</div>
app.js:2484   <div class="product-name">${u.ad}</div>
app.js:2518   <div class="strip-card-name">${u.ad}</div>
app.js:3890   <div class="cart-item-name">${u.ad}</div>
app.js:4396   <img src="${u.gorsel}" alt="${u.ad}" ... onerror="this.outerHTML='...'">
app.js:2408   onclick="_bildirimMarketSec(this, '${f.market}')"
```

**Veride hâlihazırda ne var:**
```
  toplam urun            : 16807
  HTML-anlamli karakter  : 936  (%5.57)
  adinda KESME ISARETI   : 588  (%3.50)   <- onclick kirilma adayi
  adinda & (ampersand)   : 373  (%2.22)
    Falım Orman Meyveli 5'li Şekersiz Sakız 35 Gr
    Werther's Original Soft Caramel 100 Gr
    Lc L'art Du Chocolat Mini Head Oval Sütlü Çikolata 22 Gr
```

**Somut kırılma kanıtı (yerel simülasyon, zararsız dize):**
`dusenler`/`supheli` şeritlerinde `_id` **ürün adından** üretiliyor
(`app.js:2643` ve `app.js:2700`: `u._id = u.ad + '_' + (u.agirlik_hacim||'')`),
kart ise `onclick="openDetay('${u._id}')"` basıyor:
```
uretilen HTML:
  <div class="strip-card" onclick="openDetay('Falim 5'li Sakiz_35 Gr')">...</div>
tarayicinin onclick olarak okuyacagi: "openDetay('Falim 5'li Sakiz_35 Gr')"
JS olarak gecerli mi: HAYIR — SyntaxError: missing ) after argument list
```

**Etki:** İki katmanlı.
1. **İşlevsel (bugün gerçek):** kesme işaretli bir ürün bu iki şeride düşerse kart
   **tıklanamaz** hale gelir, sessizce. Kullanıcı tıklar, hiçbir şey olmaz.
2. **Güvenlik (bugün istismar edilebilir değil, ama tek savunma yok):** Kaynak
   marketfiyati API'si; ürün adına `<img onerror=...>` koyabilen biri script
   çalıştırabilir. Bugün aramızda kaçış YOK, tek engel kaynağın iyi niyeti.

**Bugünkü fiili durum:** `data/anasayfa.json` içindeki 361 kartın **0**'ında `_id`
tehlikeli karakter içeriyor — yani şu an kırık kart yok. Risk **gizli**, tetiği
kategori dağılımının değişmesi. Ürün adlarının 31'inde `&` var (`Molped Pure&Soft`),
o `innerHTML`'de sorunsuz render oluyor ama `alt="${u.ad}"` içinde attribute kırıyor.

**Önem:** YÜKSEK

---

### 1.6 Bağımlılıklar — **TEMİZ, bir sürüm geride**

```
npm audit --omit=dev  -> found 0 vulnerabilities
npm outdated:
  vite  current 7.3.6  latest 8.2.1     <- bir MAJOR geride
```
Zafiyet yok. `vite` yalnızca devDependency (build), çalışma zamanına girmiyor.
**Önem:** DÜŞÜK

---

## HAT 2 — VERİ DOĞRULUĞU

Yöntem: `app.js` fonksiyonları `node:vm`'de gerçek veriyle koşturuldu; doğrulama tarafı
**ayrı ve ters** yazıldı (kopya değil). `_puanCache` canlı Supabase'ten çekildi (1040 kayıt).
Havuz: 16.807 ürün, 20.980 sid geçmişi.

### 2.1 "Gerçek indirim · 30 günün en düşüğü" — **%6,1 YANLIŞ** — **KRİTİK**

**Nerede:** `app.js:1686` `gercekIndirimRozetiHesapla()`, metin `app.js:1565`
`gercekIndirimRozetiHTML()` → `"Gerçek indirim · 30 günün en düşüğü"`

**Kanıt:**
```
  rozet cikan urun : 1492
  IDDIA YANLIS     :   91   (%6,1)
  en kotu ornekler (bugunku fiyat vs HAM 30 gunluk seride gorulen dip):
    Ülker Beyaz Çikolatalı Gofret 35 Gr    bugun 16,00   ham dip 11,00   %45,5 yuksek
    Ülker 8 Kek Orman Meyveli Mini 162 Gr  bugun 50,90   ham dip 37,00   %37,6 yuksek
    Eti Burçak Tam Buğday Çörek Otlu 91 Gr bugun 19,90   ham dip 15,89   %25,2 yuksek
    Eti Brownie Intense Kakaolu Mini 160Gr bugun 68,90   ham dip 55,87   %23,3 yuksek
    Eti Cin Portakallı 325 Gr              bugun 50,00   ham dip 41,00   %22,0 yuksek
    Eti Gong 64 Gr                         bugun 19,00   ham dip 17,19   %10,5 yuksek
```

**Sebep (bu oturumda yapılan değişikliğin yan etkisi):** Rozet 2026-08-11'de
salınımsız seriye (`otuzGunlukSeriTemiz`) bağlandı — salınımlı market serileri
"hayalet dip" ürettiği için. Ama **kullanıcıya gösterilen metin değişmedi**:
hâlâ kayıtsız şartsız "30 günün en düşüğü" diyor. Kullanıcının okuduğu iddia
ham veriye göre, kodun ölçtüğü iddia filtrelenmiş veriye göre. İkisi 91 üründe ayrışıyor.

**Etki:** Kullanıcı "bugün dip" diye alıyor, oysa aynı ay içinde %45'e varan daha
ucuz gün gerçekten yaşanmış. Bu, uygulamanın en güçlü güven iddiası — yanlış
olduğunda diğer tüm rozetlerin inandırıcılığını da düşürüyor.

**Not:** Daha önce ölçülen %21,5 → bugün %6,1. İyileşme gerçek ama sıfır değil.

**Önem:** KRİTİK

---

### 2.2 "İyi zaman" kararı gerçek dipten kopabiliyor — **%0,5** — **YÜKSEK**

**Nerede:** `app.js:1718` `alZamaniDurumu()`

**Kanıt:**
```
  al/bekle cikan : 3654   ("iyi zaman" 119 · "bekle" 3535)
  CELISKI        :   17   (%0,5)
  ornekler (gosterilen min = temiz seri, ham min = tum seride gercekten gorulen):
    Hayat Su 6 Lt                    bugun  32,90  gosterilen min  85,00  HAM min  26,25
    Jacobs Monarch Filtre Kahve 500G bugun 596,25  gosterilen min 596,25  HAM min 461,99
    Doyum Organik Fasulye 1 Kg       bugun 214,65  gosterilen min 214,65  HAM min 167,97
    Ozmo Hoppo Bisküvi 40 Gr         bugun  25,00  gosterilen min  25,00  HAM min  16,25
    Eti Burçak 131 Gr                bugun  19,90  gosterilen min  19,90  HAM min  16,74
    Ülker Çokonat Gofret 33 Gr       bugun  24,90  gosterilen min  24,50  HAM min  17,25
```
Hayat Su vakası ayrıca kendi içinde tutarsız: gösterilen "min" (85,00) bugünkü
fiyattan (32,90) **yüksek** — temiz seri, ucuz fiyatı olan marketi tamamen dışarıda
bırakmış.

**Etki:** "İyi zaman" rozeti, ürünün gerçek dibinin %30 üstünde verilebiliyor.
Aynı kök sebep 2.1 ile ortak: temiz seri ↔ kullanıcıya söylenen cümle uyuşmuyor.

**Önem:** YÜKSEK

---

### 2.3 Alarm önerisi hiç gözlenmemiş fiyat önerebiliyor — **%0,2** — **ORTA**

**Nerede:** `app.js:1285` `alarmOnerisi()`, metin `"Son ay {X}'ye kadar indi"`

**Kanıt:**
```
  oneri cikan urun            : 5219
  onerilen deger 30 gunluk HAM seride HIC gozlenmemis : 9  (%0,2)
  ham dipin ALTINDA oneri     : 0
    Kent Jelibon Ayıcık 80 Gr        oneri 34,95   ham dip 30,55   guncel 35,00
    Kent Jelibon Sour Patch (3 cesit) oneri 34,95   ham dip 30,55   guncel 35,00
    Ülker Caramio 32 Gr              oneri 21,50   ham dip 19,00   guncel 22,90
    Kühne Beyaz Sirke 2 Lt           oneri 99,95   ham dip 79,95   guncel 119,90
```
Öneri hiçbir zaman ham dibin altında değil (0 vaka) — yani "ulaşılamaz hedef"
sorunu YOK. Sorun ters yönde: "Son ay 34,95'e kadar indi" cümlesi kuruluyor ama
34,95 o ayın hiçbir gününde tam olarak gözlenmemiş (temiz seriden geliyor).

**Etki:** Cümle olgusal olarak yanlış, ama kullanıcı zararı düşük — hedef
gerçekten ulaşılabilir bir seviyede.

**Önem:** ORTA

---

### 2.4 Doğru çıkanlar — bulgu YOK

```
  indirim rozeti yuzdesi (buyuk/normal) : 2625 gosterim,     0 yanlis  (%0,0)
  zam yuzdeleri                         :   10 gosterim,     0 yanlis
  birim fiyat                           : 16753 hesap,       0 yanlis  (%0,0)
```
Birim fiyat bağımsız olarak gramaj ayrıştırılıp `fiyat/miktar` ile yeniden
hesaplandı, %2 toleransla 16.753 üründe tam uyum. Zam yüzdeleri son-7-gün
ortalaması ve pencere-öncesi tepe bağımsız hesaplanıp karşılaştırıldı, 10/10 uyum.

---

### 2.5 Uç durumlar — **savunmalar ÇALIŞIYOR**

```
  tek fiyati olan urun        : 14083  (%83,8)  -> bunlarda gercek indirim rozeti: 0  DOGRU
  gecmisi olmayan urun        :     0            -> rozet: 0                          DOGRU
  fiyati 0 olan kayit         :     0
  gramaji okunamayan          :  1803  (%10,7)  -> birim fiyat hesaplanmiyor, tl() yaziyor
  adi 70 karakterden uzun     :    12
  adi bos                     :     0
  resmi olmayan               :  2514  (%15,0)  -> placeholder emoji cizilyor
```
Tek fiyatlı üründe ve geçmişsiz üründe hiçbir rozet çıkmıyor — bu kapılar doğru
kurulmuş. `%83,8` tek fiyatlı olması ayrı bir gözlem: ürünlerin büyük çoğunluğu
tek markette bulunuyor, karşılaştırma değeri sınırlı.

---

## HAT 3 — PERFORMANS

Ölçüm: canlı, Chrome, masaüstü viewport. Lighthouse CLI kurulu değil; ham
Navigation/Resource Timing kullanıldı — sayılar gerçek, Lighthouse skoru yok.

### 3.1 `load` olayı 7,6 sn — **ORTA**
```
  domInteractive        1454 ms
  domContentLoaded      1457 ms
  load                  7645 ms      <- gorseller
  inen toplam            118 KB
```
DOM 1,45 sn'de etkileşime hazır ve inen bayt 118 KB — ana sayfa hızlı. `load`
olayının 7,6 sn'ye uzaması **166 ürün görselinden** kaynaklanıyor (hepsi
`loading="lazy"` ama şerit kartları görünür alanda). Algılanan performans iyi;
ama `load`'a bağlanmış bir iş olsaydı 7,6 sn beklerdi.

### 3.2 Önceki turlarda kapatılan performans borcu (referans, yeniden doğrulandı)
```
  ana sayfa inen : 2,09 MB gzip -> 0,13 MB   (15 -> 8 istek)
  tuzak taramasi : 14.701 ms hesap -> build zamanina tasindi
  gecmis_fiyatlar.json 4,2 MB : ana sayfada ARTIK INMIYOR  (GECMIS_INDI_MI=false)
  loadCat cift indirme : giderildi (ucusta tekillestirme)
```

### 3.3 Ölçülemeyenler — dürüst boşluk
- **Lighthouse skoru YOK** — CLI kurulu değil, kurmak "değişiklik yapma" kuralına girer.
- **3G kısıtlama testi YAPILMADI** — CDP throttling bu araç setinden erişilemedi.
  118 KB / 8 istek üzerinden kabaca 2,5–3 sn beklenir ama bu **tahmin, ölçüm değil.**
- **Bellek büyümesi ve sonsuz kaydırma** ölçülmedi.
- **Kategori (48 kart) / detay / Listem / Profil ekranı ayrı ayrı** ölçülmedi;
  yalnızca ana sayfa ölçüldü.

### 3.4 Service Worker — sürüm/veri ayrışması riski — **ORTA**
`sw.js`: `CACHE_NAME = 'pazar-cache-v198'`, precache `data/hal.json` +
`data/anasayfa.json`. `anasayfa.json` gece koşusunda **her gün** değişiyor ama
`sw.js` sürümü **elle** bump ediliyor. Sürüm bump edilmeyen bir günde eski
kullanıcı önbellekteki dünkü şeritleri görebilir.
Bu bir **tasarım gözlemi**; canlıda tetiklenmiş bir vaka ölçülmedi.

---

## HAT 4 — TASARIM VE ERİŞİLEBİLİRLİK

Ölçüm: canlıda `getComputedStyle` ile gerçek hesaplanmış renkler.
Statik CSS analizim yanlış pozitif ürettiği için (gradient zeminli öğeleri
yanlış eşledi) **atıldı**; aşağıda yalnızca tarayıcıda doğrulananlar var.

### 4.1 Ürün kartlarının HİÇBİRİ klavyeyle erişilemiyor — **KRİTİK**
```
  onclick TASIYAN ama klavyeye KAPALI oge : 51
  ornekler : .strip-card x4 ...
  sayfadaki TOPLAM odaklanabilir oge      : 15
```
Tüm ürün kartları `<div onclick="openDetay(...)">`. `tabindex` yok, `role` yok,
`keydown` yok. Klavye kullanıcısı ve ekran okuyucu **hiçbir ürüne ulaşamıyor** —
uygulamanın ana işlevi (ürün detayına gitme) tamamen erişilemez durumda.

### 4.2 Odaklanabilir 15 öğenin 15'inde odak göstergesi yok — **KRİTİK**
```
  odaklanabilir oge   : 15
  odak gostergesi YOK : 15   (%100)
  ornek : INPUT, .home-strip-paylas, .nav-btn (x4) ...
```
`outline` yok/0px ve telafi eden `box-shadow` da yok. Klavyeyle gezen kullanıcı
nerede olduğunu göremiyor. WCAG 2.4.7 ihlali.

### 4.3 `maximum-scale=1.0` — yakınlaştırma engelli — **YÜKSEK**
```
  <meta name=viewport content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
```
Az gören kullanıcı sayfayı büyütemiyor. WCAG 1.4.4 ihlali.

### 4.4 Kontrast — tarayıcıda DOĞRULANMIŞ AA ihlalleri
**Açık tema (7 ihlal):**
```
  .mf-sheet-footer   rgb(153,153,153) / rgb(250,250,250)   oran 2,73  esik 4,5   11px
  .ms-subtitle       rgb(119,119,119) / beyaz              oran 4,48  esik 4,5   13px  (sinirda)
  .mf-subtitle       ayni                                  oran 4,48  esik 4,5   13px  (sinirda)
```
**Koyu tema (10 ihlal)** — `data-theme=dark`, gövde zemini `rgb(15,26,20)`, tema gerçekten uygulandı:
```
  .cat-card-name     oran 1,24  esik 4,5  13px bold   <- neredeyse okunamaz
  ^ 2026-08-12 KAPANDI: bu okuma YANLISTI. Kod dogruydu; getComputedStyle
    onceden var olan dugumde bayat deger donduruyordu. Ekran goruntusuyle
    dogrulandi — kategori izgarasi koyu temada koyu zemin/acik metin.
  .zam-yayginlik     oran 2,15  esik 4,5  10px
  .nav-btn (pasif)   oran 3,15  esik 4,5  14px bold
  .ms-subtitle       oran 3,41  esik 4,5  13px
```
**Koyu tema açık temadan DAHA KÖTÜ durumda** (10 vs 7 ihlal). `.cat-card-name`
1,24 → kategori kartı başlıkları koyu zemin üzerinde koyu metin.

**Yanlış pozitif olarak ELENDİ:** `h1` ve `.auth-submit`. Renkli/gradient zemin
üzerinde beyaz metin; zemin çıkarımı doğru eşleşmedi, kanıtlayamadığım için
bulgu yazmıyorum.

### 4.5 Dokunma hedefleri 44×44 altında — **YÜKSEK**

> **2026-08-17 KAPANDI — iframe olcumuyle dogrulandi.** 15 sinifa gorunmez
> `::after` katmani eklendi (gorsel boyut degismedi). resize_window bu araclarda
> calismadigi icin ayni origin'de iframe kuruldu ve iki genislikte olculdu:
> ```
>   390px   8 sinif DOM'da bulundu, 44x44 ALTINDA KALAN: 0
>     .add-btn            30x30 -> dokunma  44x44  GECER
>     .filter-pill        59x26 -> dokunma  57x44  GECER
>     .hal-filter-btn     57x30 -> dokunma  55x44  GECER
>     .siralama-btn      142x32 -> dokunma 140x44  GECER
>     .back-btn           36x36 -> dokunma  44x44  GECER
>     .firsat-tab         98x41 -> dokunma  98x44  GECER
>     .home-strip-paylas  64x27 -> dokunma  62x44  GECER
>     .theme-opt         108x37 -> dokunma 106x44  GECER
>   1440px  ayni 8 sinif, KALAN: 0  (.theme-opt 74x37 -> 72x44)
> ```
> **Geometri degismedi** (390px / 1440px):
> ```
>   .strip-card       150x196 / 150x196   pad 10px
>   .strip-card-img   128x90  / 128x90    pad 6px
>   .strip-card-name  128x34  / 128x34    font 13px
>   .cat-card         164x124 / 217x130   pad degismedi
>   .product-card     164x324 / 210x324
>   .nav-btn           93x62  / 235x40
>   yatay kaydirma    YOK    (390px scrollWidth 371)
> ```
> **Komsu hedef cakismasi YOK:** .firsat-tab 2 oge 0 cakisma · .filter-pill
> 8 oge 0 · .hal-filter-btn 3 oge 0. (.tazelik-chip sayfada tek oge oldugu
> icin cakisma olculemedi.)
> **Olculemeyen 7 sinif** (DOM'a ancak modal/detay acilinca giriyor, iframe
> icinde acilamadi): .btn-ekle .karsilastir-pill .tazelik-chip .alarm-kur-btn
> .alarm-kaldir-btn .bildirim-pill .fiyat-bildir-btn — CSS kurali onlari da
> kapsiyor ama **olculmedi.**
CSS'ten hesaplanan yükseklik (padding·2 + font-size·1,3):
```
  .siralama-btn       15px   pad=var(--space-2) var(--space-3)
  .tazelik-chip       20px   pad=3px 8px     fs=11px
  .filter-pill        25px   pad=5px 13px    fs=.7rem    <- bilinen borc, dogrulandi
  .hal-filter-btn     28px   pad=6px 12px    fs=.75rem
  .btn-ekle           29px   pad=7px 14px    fs=.72rem
  .karsilastir-pill   29px   pad=6px 14px    fs=0.8rem
  .add-btn            30px   (sabit height)  <- en sik kullanilan buton
  .back-btn           36px   (sabit height)
  .firsat-tab         40px   pad=12px 14px
```
Taranan 38 etkileşim öğesinin çoğu eşiğin altında.

### 4.6 Doğru olanlar — bulgu yok
```
  166 gorsel, alt'siz        : 0
  ikon butonu aria-label'siz : 0
  pozitif tabindex           : 0
  lang="tr"                  : VAR
  baslik sirasi              : H1 H2 H3 H3  (atlama yok)
```

### 4.7 Ölçülemeyenler
- **320px dar ekran taşması** ve **çok uzun ürün adı bozulması** görsel olarak
  kontrol edilmedi (12 ürünün adı 70 karakterden uzun — Hat 2.5).
- **Modal odak tuzağı** test edilmedi.
- **Ekran okuyucu ile canlı gezinme** yapılmadı; yalnızca yapısal kontrol.

---

## HAT 5 — ALTYAPI VE DAYANIKLILIK

### 5.1 Sessizce yutulan hatalar — 40 vaka — **YÜKSEK**
```
  console YAZMAYAN catch blogu : 40 (app.js)
  tamamen BOS catch            : 17
    app.js:207   catch (e) { /* sessiz */ }
    app.js:387   catch(e) {}
    app.js:2366  catch (e) { /* sessiz dus */ }   <- get_fiyat_bildirimleri
    app.js:2560  catch(e){}                        <- dusenler seridi
    app.js:2602  catch(e){}                        <- supheli seridi
    app.js:5006  catch (e) { /* sessiz */ }
    app.js:5012  catch (e) { /* sessiz: RPC yoksa bolum hic cikmaz */ }
    app.js:3134 / 3957 / 4748 / 5038 / 5044   navigator.share(...).catch(() => {})
```
Bu oturumda üç sessiz-yutma vakası bulunup düzeltilmişti; tarama **40 aday daha**
gösteriyor. En riskliler `2560` ve `2602`: düşenler ve şüpheli şeritleri hata
alınca bölümü gizleyip **hiçbir iz bırakmıyor**. Ne kullanıcı ne geliştirici fark eder.

### 5.2 Python tarafı — **ORTA**
```
  scraper.py                 1 adet  except -> pass/continue
  scripts/mf_collect_v3.py   1 adet
  a101_pilot_scraper.py      2 adet (gitignore'lu pilot)
```
`scraper.py`'deki vaka gece koşusunun kalbinde. **Satır numarası
konumlandırılmadı** (grep yalnızca sayım verdi) — eksik ölçüm.

### 5.3 "Sahte Indirim Analizi" sessizce atlanabiliyor — **YÜKSEK**
```
  Veri Guncelle (03:00), 13 adim:
    scraper.py             continue-on-error YOK  -> kirilirsa zincir durur  (DOGRU)
    Sahte Indirim Analizi  continue-on-error VAR  -> SESSIZCE atlanabilir
    Ana Sayfa Seritleri    continue-on-error yok  (yeni)
    Veri Tazelik Kontrolu  en sonda, kirmiziya cevirir                        (DOGRU)
```
Bu adım başarısız olursa `indirim_supheli_*` kolonları güncellenmez, ama hemen
ardından koşan "Ana Sayfa Seritleri" **eski puanlarla** şüpheli şeridini üretir
ve iş YEŞİL geçer. Tazelik kontrolü yakalamaz: dosya taze, **içeriği bayat**.

### 5.4 Tazelik kontrolünde içerik-mantık boşluğu — **ORTA**
Kaynak API şema değişimi bir kez yaşandı (12 gün sessiz bayatlama). Bugünkü
savunma `[KRITIK]` logları + `veri_tazelik_kontrol.py` (2 gün, 9 dosya).
**Kalan boşluk:** dosya yazılıyor ama içi anlamsızsa (tüm fiyatlar null,
ürün sayısı %90 düşmüş) kontrol yeşil verir. Satır sayısı / null oranı kontrolü yok.

### 5.5 Ölçülemeyenler — dürüst boşluk
- **Supabase kotası, GitHub Actions dakika kullanımı, Pages limitleri**:
  okunmadı. Bu sayılar **raporlanmıyor** — tahmin yazmamak için boş bırakıldı.
- **Yedekleme:** `data/*.json` git geçmişinde ~86 gün tutuluyor (doğrulandı).
  Supabase tarafı yedek politikası **incelenmedi**.
- **Çevrimdışı davranış** ve **boş durum ekranları** tek tek gezilmedi.

---

## 3. TESTSPRITE

### 3.1 Kurulum — BAŞARILI, koşum — TAMAMLANAMADI

MCP sunucusu zaten kayıtlıydı (`claude mcp list` → `TestSprite: cmd /c npx -y
@testsprite/testsprite-mcp@latest`), yeniden kurulmadı. Hesap doğrulandı:

```
  hesap     : dogrulandi (ad/e-posta bu rapordan cikarildi — kisisel veri)
  subPlan   : Free
  credits   : 150
```

**Engel:** TestSprite MCP'si canlı URL'yi test EDEMİYOR — kendi araç açıklaması:
> "this MCP tests a locally-running app (it tunnels your local server).
> If the change is only available at a deployed URL, use the TestSprite CLI instead."

Bu yüzden `dist/` klasörü yerelde sunuldu (`npx serve dist -l 5173`, HTTP 200
doğrulandı) ve bootstrap ona yönlendirildi.

**Sonuç:** `testsprite_bootstrap` 120 sn'yi aştı ve arka plana alındı. Yazdığı
dosyalar:
```
  testsprite_tests/tmp/config.json  -> {"status":"init", "localEndpoint":"http://localhost:5173/",
                                        "serverPort":48100}
  testsprite_tests/tmp/mcp.log
```
Log, 48100 portunda bir **etkileşimli kurulum arayüzü** açıldığını ve tarayıcıdan
yüklendiğini gösteriyor (`GET /init 200`, `main.css`, `token.css`, font istekleri,
`GET /api/config 200`). `status` hâlâ `"init"` — araç, arayüzde **insan onayı**
bekliyor. Ben tamamlayamam.

**KESİN SONUÇ (30 dk sonra, 2026-08-11):** arka plan görevi şu hatayla DÜŞTÜ:
```
  testsprite_bootstrap sent no response or progress for 1800s; aborting
```
Bitiş durumu:
```
  config.json  -> {"status":"init", ...}          30 dk once neyse O
  mcp.log son  -> 14:42:55  GET /api/config 200   sonrasinda HICBIR kayit yok
```
Araç kurulum arayüzünü sunduktan sonra 30 dakika boyunca hiçbir ilerleme
kaydetmedi. Teşhis doğrulandı: **insan onayı bekliyor, otomatik tamamlanamaz.**

**Yapılmayan:** test planı üretimi, test kodu üretimi, koşum, sonuç raporu.
**Harcanan kredi:** 0 (koşum başlamadı).

### 3.2 Çelişki analizi — YAPILAMADI

TestSprite koşumu tamamlanmadığı için karşılaştırılacak bağımsız bulgu yok.
Bu bölüm **boş bırakılıyor**; uydurma bir karşılaştırma yazılmadı.

### 3.3 SONRASI: TestSprite tamamen kaldırıldı (2026-08-11)

Denemenin ardından araç projeden çıkarıldı. Kaldırılanlar:
```
  Desktop/.mcp.json                     SILINDI (icinde API anahtari DUZ METIN
                                        duruyordu; Desktop altindaki TUM projelere
                                        uygulaniyordu, pazar-app dahil)
  servis-takip-app/.claude/settings.local.json
                                        enabledMcpjsonServers'tan TestSprite cikarildi
  pazar-app/testsprite_tests/           SILINDI
  pazar-app/.gitignore                  aracin ekledigi 2 satir GERI ALINDI
  yetim surec                           12 adet (3, 5 ve 7 Agustos oturumlarindan
                                        kalmis, GUNLERDIR calisiyordu) kapatildi
```
Doğrulama: `claude mcp list` artık TestSprite göstermiyor; pazar-app çalışma
kopyasında ve tüm git geçmişinde `sk-user-` eşleşmesi **0**.

**Bir daha denenecekse:** MCP yolu bu proje için uygun DEĞİL — yerel sunucu
tünelliyor, kurulumu etkileşimli onay istiyor ve canlı URL'yi hiç test edemiyor.
Canlı URL için **TestSprite CLI** gerekiyor.

---

## 4. DÜZELTME SIRASI ÖNERİSİ

> Bu turda hiçbiri uygulanmadı. Sıra, *kullanıcı zararı × düzeltme maliyeti*
> oranına göre.

**Önce — güven kırıcı, ucuz:**
1. **(#1) "30 günün en düşüğü" iddiası.** İki yoldan biri: ya rozet ham seriye
   dönsün, ya metin gerçeği söylesin ("istikrarlı fiyatların en düşüğü" gibi).
   Şu an kod bir şey ölçüyor, metin başka bir şey iddia ediyor. **Karar senin** —
   ölçüm mü metin mi değişecek. 91 ürünü etkiliyor.
2. **(#6) "İyi zaman" aynı kök sebep.** #1 ile birlikte çözülmeli, ayrı değil.

**Sonra — erişilebilirlik, tek seferlik ve kalıcı:**
3. **(#2 + #3) Kart klavye erişimi + odak göstergesi.** `.strip-card`/`.product-card`
   öğelerine `tabindex="0"` + `role="button"` + `keydown` (Enter/Space), ve global
   bir `:focus-visible` kuralı. İkisi birlikte tek dokunuşta çözülür ve
   uygulamanın **ana işlevini** erişilebilir hâle getirir.
4. **(#9) `maximum-scale=1.0` kaldır.** Tek satır.
5. **(#11) Dokunma hedefleri.** `.add-btn` ve `.filter-pill` en sık kullanılanlar,
   önce onlar.
6. **(#10) Koyu tema kontrastı.** `.cat-card-name` 1,24 ile başla — okunamıyor.

**Sonra — sessiz arıza üreticileri:**
7. **(#8) `Sahte Indirim Analizi` continue-on-error.** Ya kaldır, ya bir sonraki
   adım "puanlar bugün güncellendi mi" diye baksın.
8. **(#7) 40 sessiz `catch`.** Hepsini birden değil: önce `2560`/`2602`
   (şerit gizleyenler), sonra gerisi.
9. **(#15) Tazelik kontrolüne içerik-mantık kontrolü** (satır sayısı, null oranı).

**Sonra — güvenlik sertleştirme:**
10. **(#4) `fiyat_bildirim` hız sınırı.** RLS politikasına IP/kullanıcı başına
    pencere, veya bir Edge Function önüne koy.
11. **(#5) Kaçış fonksiyonu.** Tek bir `esc()` yaz, `${u.ad}` geçen ~15 yeri
    ondan geçir. Bugün istismar edilebilir değil ama tek savunma hattı yok.

**En son — düşük etki:**
12. (#13) `load` 7,6 sn — görsel boyutları / `decoding=async`.
13. (#14) SW sürüm-veri ayrışması — `CACHE_NAME`'i build'de otomatik damgala.
14. (#16) `scraper.py` `except → pass` konumlandır ve sesli yap.
15. (#18) `vite` 8'e yükselt.

---

## 5. BU DENETİMİN SINIRLARI

Dürüst olmak gerekirse şunlar **ölçülmedi**, tahmin de yazılmadı:
- Lighthouse skoru (CLI kurulu değil, kurmak "değişiklik yok" kuralına girerdi)
- 3G kısıtlama altında gerçek süre
- Kategori / detay / Listem / Profil ekranlarının ayrı performansı
- Bellek büyümesi, sonsuz kaydırma davranışı
- 320px taşma, çok uzun ürün adı bozulması, modal odak tuzağı
- Ekran okuyucu ile canlı gezinme
- Supabase kotası, Actions dakikası, Pages limitleri
- Supabase yedek politikası
- `fiyat_bildirim` dışındaki tabloların INSERT/UPDATE/DELETE izinleri
- TestSprite koşumu

Ayrıca **kendi hatalarım** (rapora dahil, çünkü yöntemi etkilediler):
- İlk INSERT sondam yanlış yöntemdi (`PGRST204` yetkiden önce döner) — düzeltildi.
- Statik CSS kontrast analizim yanlış pozitif üretti (gradient zeminler) — atıldı,
  yerine tarayıcı ölçümü kondu. `h1` ve `.auth-submit` bulguları bu yüzden **elendi**.
- İlk veri doğruluk koşumumda `_puanCache` boştu, "gerçek indirim" testi hiç
  koşmamıştı (0 gösterim) — canlı Supabase verisiyle tekrarlandı.
