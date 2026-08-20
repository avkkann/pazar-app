# Pazar App — Proje Handoff (Claude için)

**Son güncelleme:** 2026-08-20 oturumu (**B1/B2/B5 güvenlik kapanışları** — kaçış tam yeniden tarama, fiyat_bildirim hız sınırı canlı, SDK sürüm pin + SRI; **Edge Function'lar repoya alındı + `x-cron-secret` kapısı deploy edildi + workflow zamanlayıcıları**; splash yenileme + mobil düzeltmeler; **sw v228**). Ayrıntı için aşağıdaki "2026-08-20" bloğu. Bu dosya her oturum başında okunur, sohbete asla ham metin olarak yapıştırılmaz.

---

## Amaç & bağlam

Mustafa (GitHub: avkkann), **Pazar App**'in tek geliştiricisi — Türk market fiyat karşılaştırma PWA'sı, **`pazarapp.net`** (repo: `avkkann/pazar-app`, yerel yol: `C:\Users\MUSTAFA KARABIYIK\Desktop\pazar-app`). Barındırma **Cloudflare Workers** (2026-08-17'de GitHub Pages'ten taşındı; eski adres `avkkann.github.io/pazar-app` mezar taşı bekliyor). Misyon: gizli zamları, sahte indirimleri, gramaj hilelerini ortaya çıkarmak — A101, BİM, Migros, CarrefourSA, ŞOK, Tarım Kredi, Hakmar. Slogan: **"Marketteki gizli zamları gör."**

**İş akışı:** Dosya düzenlemeleri **Claude Code** ile doğrudan yapılır (Windows, PowerShell + Bash). Eski iki-Claude/OpenCode modeli bırakıldı — artık aynı oturumda hem karar veriliyor hem kod yazılıyor hem canlı doğrulanıyor. SQL şema değişiklikleri hâlâ Supabase SQL Editor'a verilir (Mustafa çalıştırır, Claude çalıştırmaz).

**İletişim tarzı:** Türkçe, kısa, doğrudan. Uzun terimlerden kaçın. Claude kısa gerekçeyle karar verir, seçenek listesi sunmaz — büyük ürün/mimari kararları hariç (onlarda sorar). Mustafa terminal çıktısını olduğu gibi yapıştırır, Claude özetlemeden okur.

**Supabase:** URL `https://gbgxxahhbfnulmyecxia.supabase.co`, region eu-central-1, project ID `gbgxxahhbfnulmyecxia`.

**Test:** iOS + web (masaüstü Chrome). Android kullanılmıyor, test/deploy talimatlarında Android'e referans verilmez.

---

## Mevcut durum (2026-08-20 itibarıyla)

### 2026-08-20 — Güvenlik kapanışları (B1/B2/B5) + Edge Function zamanlayıcıları + splash (CANLI)

**sw v228.** Bu oturumda üç güvenlik hattı kapandı, Edge Function altyapısı kuruldu, splash/mobil düzeltildi. (Repo PUBLIC — kapanmış zafiyetler "kapandı" diye yazılı; açık kapsam ayrıntısı yok.)

**B1 (XSS — çıktı kaçışı): tam yeniden tarama, kaçış tarafı KAPANDI.** Düzeltilmiş yorum-soyucuyla (satır-yorumları önce) üç parti yeniden tarandı; kalan tek DOM sink (arama sorgusu echo'su) merkezî kaçış yardımcısına alındı. `test_kacis.mjs` **86 iddia** (q echo guard dahil), kasten bozularak doğrulandı.

**B2 (fiyat_bildirim): TAMAMEN KAPANDI.** DB policy + istemci kapısı (önceki oturum) + **hız sınırı trigger'ı canlıda kurulu ve doğrulandı** (`sql/fiyat_bildirim_hiz_siniri.sql`): aynı ürün+market 24s içinde tekrar → HTTP 409/`PT409`; kullanıcı-günlük tavan (30) aşılınca → HTTP 429/`PT429` (SECURITY DEFINER, `search_path=''`). İstemci (`app.js`) PT409/PT429'u ayırt edip **dostane** mesaj gösteriyor (hata görünümü yok), İngilizce RAISE metni kullanıcıya gösterilmiyor; PT409'da localStorage soğuması da güncelleniyor. `test_bildirim_yetki.mjs` eşlemeyi kanıtlıyor.

**B5 (CDN tedarik zinciri): sürüm pin + SRI, tedarik zinciri saldırısı KAPANDI.** `index.html` Supabase SDK `<script>`: `@2` (kayan) → **`@2.112.3`** (tam sürüm) + `integrity` sha384 (indirilen dosyadan) + `crossorigin`. CDP ile doğrulandı; **negatif kontrol:** hash bozulunca tarayıcı betiği reddediyor. `test_cdn_pin.mjs` kayan sürüme/eksik integrity'ye dönerse kırmızı. Self-host artık güvenlik değil erişilebilirlik işi.

**Edge Function'lar (repoya alındı + güvenli + deploy edildi).** `supabase/functions/` (`.temp/` gitignore'lu; gömülü sır yok, hepsi `Deno.env.get`). `haftalik-bulten` (Resend e-posta; alıcı+içerik DB/sunucu tarafı) ve `fiyat-alarm-scan` (Web Push; fiyatı `raw.githubusercontent`'ten okur). Her ikisine **paylaşılan gizli başlık kapısı**: `x-cron-secret == CRON_SECRET`, sabit-zamanlı karşılaştırma, tanımsızsa da 401 (güvenli varsayılan), asıl iş başlamadan. **Deploy + canlı doğrulandı** (başlıksız/yanlış → 401; doğru → 200, yan etki yok). Tetikleyiciler: `fiyat-alarm-scan` → `update-data.yml` içinde **ayrı `fiyat-alarm` job'u** (`needs: update`); `haftalik-bulten` → **`haftalik-bulten.yml`** (cron `0 15 * * 5` = Cuma 15:00 UTC + `workflow_dispatch`). Eski çakışan `bulten.yml` **silindi** (iki workflow aynı `name` + aynı fonksiyon). Curl'ler artık teşhis edilebilir (kod+gövde loglanıyor). GitHub `CRON_SECRET` secret'ı **Supabase'deki değerle aynı olmalı**.

**Splash + mobil.** Claude Design splash → vanilla (token-bağlı, reduced-motion, `_tasarim_taslak/` gitignore'lu); çizelge ~2.36s → ~1.2s, kapanma = max(animasyon bitti, veri hazır), KİLİT 4000ms; rozet `--fs-1` (12px), mühre yaklaştırıldı. iPhone çift-tık zoom (`overflow-x: clip`) ve arama sonucu below-fold konumu düzeltildi.

**Kalan işler (sıralı, gerekçeli):**
1. **YARIN KONTROL (2026-08-21):** 03:00 UTC gecelik koşusunda **`fiyat-alarm` job'u yeşil mi** — bu yol hiç gerçek zamanlanmış koşuda doğrulanmadı (yalnız elle curl + haftalik-bulten dispatch). Actions log'unda `HTTP=200` olmalı. Kırmızıysa GitHub `CRON_SECRET` ≠ Supabase değeri (log artık kodu açıkça basıyor).
2. **Giriş yönlendirme (H4)** — hiç ölçülemedi; sonraki güvenlik turunda bakılmalı.
3. **Font + GoatCounter kaynakları pinsiz/SRI'siz** (`fonts.googleapis.com`/`api.fontshare.com` CSS, `gc.zgo.at/count.js`) — B5'in sıradaki adımı.
4. **`unsafe-inline` kaldırma** — satır içi handler göçü gerektirir; B1 kapandığı için artık kritik değil.
5. **SDK sürümü elle güncelleme** — pinli olduğundan otomatik yama yok; periyodik `@2.x.y` + yeni SRI (integrity'yi yeni dosyadan üret).
6. **KVKK: hesap silinince `profiles` satırı kalıyor** — DELETE policy yok, veri kalıntısı.
7. **CI hiç test koşturmuyor** (eski borç, "Teknik borç" bölümünde ayrıntı) — kırmızı testle deploy mümkün.

**Bu oturumun öğrenmeleri:**
> **Tetikleyici ararken desen taraması İKİ KEZ yanlış "yok" dedi.** `.github/workflows/` tek tek listelenip her dosya okunmalı — `update-data.yml` içindeki alarm adımı (ayrı dosya değil, bir step) ve `bulten.yml` (grep `haftalik-bulten` yakalamadı) böyle kaçtı.
> **Tarama araçları kendi kör noktalarıyla test edilmeli.** Yorum-soyucusundaki hata (blok-yorum önce) **2287 satırı** taramadan gizledi; düzeltmeden önce bir XSS sink'i kaçmıştı. Soyucu prove-by-breaking ile doğrulanmalı.
> **`verify_jwt` tek başına yetmez:** anon anahtar geçerli bir JWT'dir, gateway'i geçer. Gerçek kapı kod içi paylaşılan gizli başlıkla kurulur.
> **`curl -sf` hatayı yutar** (statü+gövde görünmez, yalnız exit≠0). Zamanlanmış işlerde `-o -w %{http_code}` ile kod+gövde loglanmalı; `-v`/istek başlıkları basılmamalı (secret sızmasın).
> **Supabase CLI fonksiyon deploy'unda entrypoint dosya adı `index.ts` olmalı** — indirince başka adla gelse de deploy `index.ts` bekler; ikiz dosya oluşabilir (bu oturumda oldu, temizlendi).

### 2026-08-19 — Güvenlik denetimi + fiyat_bildirim yazma açığı kapatıldı (CANLI)

**Salt-okunur güvenlik denetimi** yapıldı → [`DENETIM_GUVENLIK.md`](DENETIM_GUVENLIK.md)
(10 bulgu: 1 KRİTİK XSS, 2 YÜKSEK, 3 ORTA, 4 DÜŞÜK; sır sızıntısı ve git geçmişi temiz).
İlk düzeltme koşuldu: **`fiyat_bildirim` kimlik-doğrulamasız yazma açığı (B2)**.

**Neydi:** INSERT anon'a açıktı — hız sınırı değil, yazmanın kendisi. Anon `{"_sid":"x",…}`
→ 201, satır oluşuyordu. **DB düzeltmesi** (Mustafa çalıştırdı): policy `to authenticated,
with check kullanici_id = auth.uid()`. **İstemci düzeltmesi** (`app.js`, `sw.js` v216):
- Kapı artık **oturuma** bağlı (`_bildirimYetkiVarMi()`), "RPC hatası"na değil. Eski kapı
  kırıktı: `get_fiyat_bildirimleri` anon'a `200 []` döndüğü için hata olmuyor, bayrak `true`
  oluyor ve "Bu fiyat tutmadı" butonu oturumsuz kullanıcıya da çıkıyordu.
- `fiyatBildirimleriYukle`'de **boş sonuç / hata / veri** ayrı dallar; yetki buradan
  türetilmiyor (yalnızca rozet sayıları).
- `fiyatBildirAc` oturumsuz kullanıcıya `modalAc` yönlendirmesi (native alert yok), INSERT'e
  **hiç gitmiyor**. INSERT öncesi ikinci savunma; `kullanici_id` artık `null` değil session
  `user.id`. 24 saatlik localStorage soğuması UX için kaldı, **güvenlik sınırı olmadığı**
  koda not düşüldü.

**Canlı doğrulandı:** girişli 201, girişsiz reddediliyor; yerel derlemede oturumsuz kullanıcıda
buton **görünmüyor** (ölçüldü). Yeni test `test_bildirim_yetki.mjs` (18 iddia); kapı
RPC-mantığına geri bağlanınca **kırmızıya dönüyor** (mutasyonla kanıtlandı). 41/41 test yeşil.


### 2026-08-19 — Üç mobil sorun + bir yan bulgu (CANLI)

**Durum: yayında.** `b48ecd9` push edildi, deploy yeşil. `sw.js` **v215**, 40/40 test yeşil.

> **ORTAM — Kaspersky bu MAKİNEDEN canlıyı engelledi, kalıcı çözüm uygulandı.**
> Oturum ortasında `pazarapp.net` HTTP **499 "Request has been forbidden by antivirus"**
> dönmeye başladı (otomatik istek hacmi tetikledi); `curl` **`SEC_E_UNTRUSTED_ROOT`**
> veriyordu — yani TLS'i Kaspersky kendi köküyle açıp yeniden imzalıyordu, `-k` ile bile 403.
> **Site sağlamdı**, deploy yeşildi. Çözüm: `pazarapp.net` Kaspersky **güvenilir URL
> istisnasına** eklendi. Bu **yalnızca bu makineyi** ilgilendirir, siteyi/kullanıcıları
> etkilemez. Bu turun ölçümleri o yüzden HEAD'den derlenen **yerel yapıda** yapıldı.
> (Aynı yazılımın CSP'ye enjeksiyonu için aşağıdaki öğrenmeye bak — bu ikinci kez.)

**1+2 — çift tık zoom (ve "geçişte zoom" sanılan hâli).** Ölçüldü: viewport **doğru**
(`maximum-scale` yok, denetimde bilerek kaldırılmıştı) ama **tüm CSS'te tek bir
`touch-action` bildirimi yoktu** — 83 tıklanabilir öğenin 83'ü de `auto`, yani Safari'nin
double-tap-to-zoom'u her yerde açık.

> **"Ekran geçişinde zoom animasyonu" DİYE BİR ŞEY YOK — ikisi aynı kök.** Ölçüldü: geçiş
> `translateX(100%)→0` (yatay kaydırma), 260 ms; geçiş kurallarında `scale()` **sıfır**.
> Tüm CSS'teki 27 `scale()` kullanımı `:active` basma geri bildirimi (0,88–0,99) ya da
> splash/navPulse. Kullanıcının gördüğü şey çift tıkla zoomlanan sayfanın ekran değişince
> de zoomlu kalması. Yan ölçüm: çift dokunuş **iki tık** üretiyor ve ürün detayını açıyor —
> iOS'ta aynı anda zoom + gezinme demek.
>
> **TEORİ HENÜZ KAPANMADI.** Deploy sonrası Mustafa belirtiyi canlıda bir kez daha gördü;
> **yeni `sw` yüklenince geçti** (eski sürüm önbellekteydi). Yani gözlem düzeltmeyle
> tutarlı ama teoriyi bağımsız doğrulamıyor. **Tekrar ederse "geçiş = translateX, scale yok"
> iddiası yeniden ölçülecek** — o zaman gerçek bir ölçek animasyonu aranacak, sayfanın
> zoom durumu değil.

Çözüm: `html, body` + etkileşimli öğelere **`touch-action: manipulation`**. Bu değer
kaydırmayı ve **PINCH zoom'u serbest bırakır**, yalnızca double-tap zoom'u kapatır.
`none`/`pan-x`/`pan-y` **kullanılmadı** — onlar pinch'i de öldürürdü. Viewport'a
dokunulmadı.

> **Erişilebilirlik KANITLANDI, iddia edilmedi.** Pinch jesti CDP ile gerçekten
> uygulandı: `visualViewport.scale` **1 → 5**. Şerit yatay kaydırması da sınandı
> (`scrollLeft` 0 → 200, çalışıyor).

**3 — "+" butonunun yarısı görünmüyor.** Kök neden Faz 2 DEĞİL (o `.strip-card`'ı 164px
yaptı; kategori kartı `.product-card` ve bir `1fr 1fr` grid). Gerçek sebep **44px dokunma
hedefi çalışmasından (v202) kalma bir regresyon**: o tur eklenen `position: relative`
listesi `.add-btn`'in kendi `position: absolute`'ını **eziyordu** (daha sonra geliyor, aynı
özgüllük). `relative`de `right:8px` öğeyi 8px **sola**, `bottom:8px` 8px **yukarı** kaydırır
→ buton kartın sol kenarından 7px dışarı taşıp `overflow:hidden` ile kırpılıyordu.

| | önce | sonra |
|---|---|---|
| `position` | `relative` | **`absolute`** |
| kırpık kart | **48/48**, 8 kategoride de | **0/48** |
| görünen buton | 23px / 30px | **30px (tam)** |
| etkin dokunma hedefi | **30×44** | **44×44** |
| masaüstü | aynı şekilde kırpık | düzeldi |

Düzeltme: `.add-btn` o listeden çıkarıldı. `absolute` de `::after` için kapsayıcı blok
kurduğundan 44px katmanı listeye girmeden çalışıyor.

**YAN BULGU — ürün görseli yedeği tamamen bozukmuş.** Ölçüm sırasında 12 adet
`SyntaxError: Unexpected identifier 'product'` çıktı. Sebep tek karakter: şablon dizesinde
`class=\'…\'` yazılmış (şerit kartında doğru olan `class=\\'…\'`). Tek ters bölü JS
tarafından tek tırnağa çevrilip HTML'e gidiyor, `onerror` özniteliği orada **kapanıyor**.
Sonuç: kategori ekranında ürün görseli yüklenemeyen her kartta yedek **hiç çizilmiyordu**,
kullanıcı boş beyaz kutu görüyordu. Düzeltildi ve zorlanarak doğrulandı (yedek 3 → 9, 📦).

**Yeni test:** `test_mobil_dokunma.mjs` (23 iddia) — pinch'i öldüren değerlerin yasaklığı,
viewport'un kilitlenmemesi, `.add-btn`'in konum listesine geri girmemesi, iki kartın **aynı**
kaçış desenini kullanması. Üçü de kasten bozularak doğrulandı.

> **Test kendi açıklama yorumuyla eşleşti — ikinci kez.** `position:relative` taraması,
> kuralın üstündeki "`.add-btn` bu listede değil" yorumunu seçicinin parçası sanıp yanlış
> alarm verdi. Kaynakta desen ararken **önce yorumları soy** (bkz. `test_splash`).

### 2026-08-19 — Splash: sabit bekleme kalktı, tema-duyarlı zemin (CANLI, DOĞRULANDI)

**Durum: yayında.** `8503f6f` push edildi, deploy yeşil. `sw.js` **v214**, 39/39 test yeşil.
Ölçüm üç hata bulmuştu, üçü de düzeldi.

**A — 800 ms boşa bekleme.** Splash `setTimeout(600)` + 250 ms zinciriyle kalkıyordu ve
**hiçbir şeyi beklemiyordu** (blokta `await`/`then`/`fetch` sıfır). Artık `pazar:hazir`
olayını bekliyor. Aynı yerel sunucuda, 3 tur medyan:

| | öncesi | sonrası |
|---|---:|---:|
| soğuk | **785 ms** | **370 ms** |
| koyu tema | 769 ms | 341 ms |
| reduced-motion | 796 ms | **153 ms** |

> **Sinyal DOM'a bakmıyor, render zincirinin SETTLE olmasına bakıyor.** "İlk şerit doldu mu"
> diye yoklamak çevrimdışında **hiç gerçekleşmiyor** (ölçüldü: `data/*.json` bloklanınca
> kategori ızgarası 325 ms'de çiziliyor ama şeritler hiç dolmuyor) — splash sonsuza kadar
> asılı kalırdı. `_anaEkraniCiz()` dört şeridi `Promise.allSettled` ile bekliyor; render
> fonksiyonları veri yoksa bölümü gizleyip **çözülüyor**. Çevrimdışı ölçüldü: splash
> 828 ms'de kalkıyor ve kilit koruması **hiç devreye girmiyor**.

İki koruma var, ikisi de tavan değil: **TABAN** (200 ms, splash ilk KAREden sonra en az bu
kadar kalır — flaş önleme; `requestAnimationFrame` ile ölçülüyor, navigasyondan değil) ve
**KİLİT** (4000 ms, kilitlenme koruması — devreye girerse `console.warn` basıyor, sessiz
kalmıyor). Mevsim şeridi bilerek beklenmiyor: ayrı dosya indiriyor (477 ms vs 429) ve
ekranın çok altında.

**B — koyu temada beyaz çakma.** Splash zemini `#ffffff` sabitti; koyu temada
yeşil→BEYAZ→siyah diye 1,5 sn'de üç zemin çakıyordu. Artık `background: var(--bg)`.
Ölçüldü: koyu temada splash zemini `rgb(15,26,20)`, 129 ms'lik karede ekran **koyu**.
`index.html`'deki tema script'i stylesheet'ten önce koştuğu için `--bg` ilk boyamada doğru.

> **Bootstrap rengi zorunlu bir kopya — testle kilitlendi.** CSS henüz yokken token
> okunamıyor, bu yüzden `index.html` açılış zeminini ham hex yazmak zorunda
> (`dark ? '#0F1A14' : '#F8F9FA'`). `test_splash.mjs` bu iki değeri `style.css`'teki `--bg`
> tokenlarına karşı doğruluyor; token değişip burası unutulursa test kırılıyor (kasten
> bozup denendi).

**C — token + easing.** Splash'in renk/boyut/süre/easing'i tamamen hamdı; hepsi token'a
bağlandı (`--splash-logo`, `--splash-giris`, `--splash-cikis`, zemin `--bg`). JS sönme
süresini CSS tokeninden okuyor, ikinci bir sayı tutmuyor.

> **Easing "tutarsızlığı" aslında YAZILMAMIŞ İKİ ROLLÜ SİSTEMMİŞ.** Ölçüldü:
> `--ease-out` 9 kullanım (ağırlıklı `transition`), ham `cubic-bezier(0.22,1,0.36,1)`
> **7 kullanım ve 7'sinin 7'si de `animation`**. Yani biri durum geçişi, diğeri giriş
> animasyonu. Birini silmek iki farklı işi tek eğriye bağlamak olurdu; doğru düzeltme
> ikincisini **adlandırmaktı**: `--ease-giris`. Artık hiçbir kuralda ham eğri yok.

**Regresyon yok:** 5 şerit `[6,6,12,10,7]` · yatay taşma 0 (6 ekran) · konsol hatası 0 ·
onboarding tetikleniyor (ölçüldü: splash bitince 500 ms'de açılıyor) · iki tema da açılıyor.

**Yeni test:** `test_splash.mjs` (46 iddia). Korumalar kasten bozularak doğrulandı.

**Canlı doğrulama (uzantısız temiz profil + CDP, 390px, 3 tur medyan, iki tur):**

| senaryo | boşa bekleme (canlı) |
|---|---:|
| soğuk | **390 ms** (2. tur, cache buster: 362 ms) |
| koyu tema | **347 ms** |
| reduced-motion | **139 ms** — sönme anında (soluyor 489 = gitti 489) |
| onboarding | 366 ms; overlay splash bitince 726 ms'de açılıyor |

`sw.js` **v214**, önbellek tam `[v214]`, **v213 temizliği ölçüldü** (`[v214,v213]` → `[v214]`) ·
5 şerit `[6,6,12,10,7]` · yatay taşma 0 · CSP 9 direktif · kilit koruması hiç devreye
girmedi · konsol **gerçek hata 0** (3 yüklemede yalnızca bilinen Cloudflare beacon blokları).

> **Renk iddiası GERÇEK PİKSELDEN kapatıldı.** `getComputedStyle` sondam CSS uygulanmadan
> önceki ilk okumayı önbelleğe alıp `rgba(0,0,0,0)` diyordu — hesaplanan stille "beyaz yok"
> demek yanlış olurdu. Splash kareye alınıp PNG'nin sol-üst pikseli okundu: koyu temada
> **[15,26,20]** (`#0F1A14`), açık temada **[248,249,250]** (`#F8F9FA`). Hesaplanan stil ve
> boyanmış piksel birbirini doğruluyor.

> **AÇIK BORÇ — iOS `apple-touch-startup-image` yok.** Standalone PWA'da iOS'un kendi
> açılış ekranı için başlangıç görseli tanımlı değil; **temaya bağlı splash bunu TAM
> çözmez** çünkü bizim splash'imiz iOS'un launch ekranından SONRA geliyor. Masaüstü
> Chrome/CDP ile iOS standalone launch taklit edilemez — **Mustafa iOS'ta test edecek.**
> `manifest background_color` hâlâ `#0E4938` (marka yeşili) ve tema-duyarlı olamaz;
> koyu temada yeşil→koyu geçişi artık yumuşak, açık temada yeşil→açık farkı duruyor.

> **AÇIK BORÇ — ikon yazısı sloganla ayrışıyor.** `/static/icon-192.png` içinde
> "HAL FİYATLARI" yazıyor; uygulamanın sloganı "Marketteki gizli zamları gör" ve hal
> fiyatları bir özellik, tamamı değil. İkon dosyası değişimi — ayrı iş.

> **KÜÇÜK BORÇ — `modalSlideUp` rol uyumsuzluğu.** Bir GİRİŞ animasyonu ama `--ease-out`
> (durum geçişi) eğrisiyle yazılmış. Ham literal tokene bağlandı, **değer DEĞİŞTİRİLMEDİ** —
> eğriyi değiştirmek modalin hissini değiştirirdi. Rol uyumu ayrı karar.

### 2026-08-19 — Faz 3: kategori emojisi marka SVG diline çevrildi (CANLI, DOĞRULANDI)

**Durum: yayında.** `13501f7` push edildi, deploy yeşil. `sw.js` **v213**, 38/38 test yeşil.
Ana sayfanın en büyük görsel bloğu (ızgara, dikey alanın ~%20'si) 56px **işletim
sistemi emojisiyle** çiziliyordu: iOS'ta Apple, Windows'ta Segoe, Android'de Noto —
marka en büyük görsel öğesini kontrol etmiyordu. Seçenek C uygulandı (foto/illüstrasyon
üretmek yok, saf metne düşmek yok): 8 kategori **markanın kendi SVG ikon dilinde**.

**Dil envanteri (ana sayfada 26 görünür SVG, ölçüldü):** `viewBox 0 0 24 24` 26/26 ·
`fill:none` 25/26 · `stroke:currentColor` 24/26 · `stroke-width:2` 24/26 · `round/round`
24/26 · `aria-hidden` 24/26. Dil **tek üreticiden** geliyor: `lcIcon()` + `_LUCIDE_PATHS`.
Yeni ikonlar o haritaya eklendi — elle SVG yazılmadı, sapma riski sıfır.

**Metaforlar** (hepsi Lucide'ın kendi setinden): elma · but (`drumstick`; et+tavuk'u
BİRLİKTE karşılayan tek şekil, biftek kırmızı ete kayardı) · süt kutusu · buğday
(temel gıda) · pipetli bardak · sprey · kurabiye · kar tanesi.

**Boyut 32px** — 24/32/40 canlıda ölçüldü. Görünen çizgi = `stroke-width × (boyut/24)`:
24px→2,00 · 32px→2,67 · 40px→3,33 (mevcut 14px ikonlarda 1,17). 24 kartta kaybolup
ızgarayı "sadece metin"e düşürüyordu, 40 çizgiyi dilin dışına taşıyordu. Kart 124→100px,
sayfa 3258→3162px. `--ikon-kategori` token'ı.

**Neden satır içi SVG:** `<img src="*.svg">` `currentColor` ALMAZ (ayrı belge) — tema
duyarlılığı ölürdü, ki emojiden kurtulma sebebimizin yarısı buydu. `mask-image` tema
verirdi ama 8 ek istek. Satır içi SVG **markup**'tır, hiçbir CSP direktifine tabi değil;
9 direktif aynen duruyor. Maliyet: **+3.922 bayt ham / +1.836 bayt gzip** (%1,5 / %2,3).

> **Optik değişkenlik şüphem YANLIŞ ALARM çıktı — ölçüm kurtardı.** Yeni ikonların
> viewBox doluluğu %34,7–69,4 arasında oynuyordu (süt en ince) ve "düzelteyim" diyecektim.
> Mevcut 24 ikonu aynı ölçütle ölçtüm: **min 34,7 · max 69,4 · yayılım 34,7 · ort 57,3** —
> yenilerin ortalaması 57,8. Yani değişkenlik dilin kendi doğası; "düzeltseydim" yeni
> ikonları diğer 24'ünden AYIRMIŞ olurdum.

**Ölü kod temizliği (her biri tek tek doğrulandı, dinamik sınıf ataması da arandı):**
`.cat-card-emoji` · `.cat-card-img` · `.cat-card-count` CSS'ten silindi (kod tarafında
0 kullanım) · `KATEGORILER[].img` silindi (hiç okunmuyordu, `static/cat/` klasörü zaten
hiç var olmamıştı) · `KATEGORILER[].emoji` silindi (yalnızca ızgarada 1 kullanım) ·
Faz 1'de açılan `--glif-1..5` ailesinin tek tüketicisi kaldığı için tek anlamsal token'a
indi (`--glif-foto-yedek`).

> **Ürün fotoğrafı emoji yedeğine DOKUNULMADI** (`.strip-card-img-ph`, 6 kartta aktif).
> Onun emojisi `KATEGORILER`'den değil `placeholderRenk`'in KENDİ haritasından geliyor —
> silmeden önce ölçüldü, bağımlılık olsaydı 6 kartın yedeği sessizce bozulacaktı.

**Yeni test:** `test_kategori_ikon.mjs` (31 iddia) — 8 ikonun tanımlı olması, dile uyum,
**sessiz boş üretim** (`lcIcon` tanımsız isimde `''` döndürür, kart ikonsuz kalır ve kimse
fark etmez), emoji temizliği, foto yedeğinin korunması, token bağlantısı, ölü kod.
Koruma doğrulandı: bir kategori olmayan ikona bağlanınca test kırılıyor.

**Canlı doğrulama (uzantısız temiz profil + CDP, 390/1440, iki tema, iki tur):**
ızgarada emoji **0** · SVG ikon **8/8**, hepsi 32×32, boş çizim 0 · dil imzası **tek**
(`0 0 24 24|none|currentColor|2|round|round|true`) · ikon rengi açık `rgb(26,26,46)` →
koyu `rgb(229,231,235)` **otomatik** · `sw.js` **v213**, önbellek tam `[v213]`,
**v212 temizliği ölçüldü** (`[v213,v212]` → `[v213]`) · 5 şerit `[6,6,12,10,7]` ·
yatay taşma **0** · CSP **9 direktif**, negatif kontrol engellendi · konsol gerçek
hata **0** (yalnızca 2 bilinen Cloudflare beacon ihlali).

> **Foto yedeği MEKANİZMA olarak sınandı, "bugün görünüyor mu" diye değil.** Canlıda bir
> ürün görselinin `src`'si bozulup `onerror` tetiklendi: `.strip-card-img-ph` 6 → 7 arttı,
> yeni öğe 🍎 emojisini 32px'te bastı. Yani emoji temizliği yedeği bozmadı — iki temada da.

> **AÇIK BORÇ — arama kutusundaki büyüteç dilin dışında.** `index.html`'de satır içi,
> `stroke="#0E4938"` sabit hex (token değil), `butt`/`miter` (dil `round`/`round`),
> `aria-hidden` yok. Ana sayfadaki 26 SVG'nin dil dışında kalan **tek** öğesi (ikincisi
> kategori emojisiydi, Faz 3 onu kapattı). Faz 3'e dahil edilmedi çünkü kapsam kategori
> ızgarasıydı; ayrı ve küçük bir iş.

### 2026-08-18 — Ana sayfa tasarımı: token sistemi + hiyerarşi (CANLI, DOĞRULANDI)

**Durum: yayında.** `34f0c8b` (Faz 1) + `dbdec46` (Faz 2), deploy 43 sn yeşil. `sw.js` **v212**.
Teşhis "AI yapmış" değil **"kimse karar vermemiş"**ti: mor gradyan/cam efekti yoktu, yıkacak
bir şey de yoktu — hiyerarşi ve token yoktu. İki faz sırayla koşuldu (token önce, hiyerarşi
sonra; tersi iki kez iş demekti).

**Envanterin kanıtı:** 266 font-size bildirimi 56 farklı px değerine dağılıyordu, 139'u px
136'sı rem — iki ayrı sistem yan yana. Ana sayfada 12 metin boyutu, 11'i 10–15px bandında,
ardışık adımlar %1–4 (gözle ayırt edilemeyen fark hiyerarşi değil gürültüdür). Spacing gridi
tanımlıydı ama **%4,7** kullanılıyordu; fiili grid 6/10/14 ile 2px'ti. Rozet renkleri
`:root`'ta değil, 8 ayrı yerde elle hex'ti.

**FAZ 1 — token.** `--fs-1..6` = 12/14/16/20/24/32, **tek birim (px)**. Ana sayfadaki 31
bildirim ROL ile eşlendi (en yakın değerle değil): ürün adı gövde, birim fiyat ikincil, rozet
etiket. Emoji/glif boyutları ayrı isim alanında (`--glif-*`) — onlar metin değil, Faz 3'e ait.
Spacing 605 parça token'a taşındı (**%4,7 → %95,8**), 6/10/14 → 8/12/16. Rozet renkleri 25
kuralda anlamsal token'a geçti (`--rozet-zam-*` vb.), koyu tema karşılıkları **ayrı isimle**
(`--*-koyu`) çünkü `.strip-card-rozet`in koyu tema override'ı hiç yazılmamış — token'ı tema
bloğunda ezseydim o rozetler sessizce değişirdi.

> **`--fs-3` = 16px pazarlık konusu değil.** Kullanıcıların **%64'ü iOS Safari** ve iOS,
> 16px'ten küçük bir `<input>`'a odaklanınca sayfayı otomatik yakınlaştırır. Arama kutusu
> 14px'ti — her aramada zoom sıçraması. Ölçekten çıkan bedava kazanç; canlıda doğrulandı
> (3 input, üçü de 16px, 16px altı **0**).

**FAZ 2 — hiyerarşi.** Kart yeniden kuruldu: **görsel → FİYAT → rozet → ad → birim fiyat**.
Öncesinde kartın en büyük öğesi 56px emoji (bilgisiz), en küçüğü 10px zam oranıydı (en
değerli bilgi). Şimdi fiyat 24px/800 Cabinet Grotesk, ad 16px/500 — **ad küçültülmedi**,
hiyerarşi boyut+ağırlık karşıtlığıyla kuruldu, Faz 1'in iOS kazanımı korundu.

- **Fiyat karta girdi.** Bir fiyat karşılaştırma uygulamasının ana sayfasında ürünün fiyatı
  HİÇ YOKTU. Veri uydurulmadı: `en_dusuk_fiyat` katalogdaki **16.813 ürünün %100'ünde** dolu.
- **Kart 150 → 164px** (`--kart-genislik`, tek kaynak). 390px'te dört seçenek ölçüldü, Mustafa
  seçti: 164 **yapısal eşik** — altında zam rozeti ikiye bölünüyor ve birim fiyatın `₺`
  işareti tek başına alt satıra düşüyor. Bedeli ekrana sığan kart 2,48 → 2,28.
- **Cabinet Grotesk seçimi de ölçüm:** en uzun fiyat "1.849,95 ₺" 24px'te Cabinet Grotesk 800
  ile **109px**, Inter 800 ile **127px**. Kartın 138px iç genişliğine Inter sığmazdı.
- **Şerit önceliği:** ayrım BOŞLUKLA (24 → 32px), ağır ayraç çizgisi yok. Öncelikli iki şerit
  (tuzaklar, zam — slogan tam olarak bu ikisi) başlıkta bir ölçek adımı büyük ve bir kesim
  ağır (20/700 → 24/800). Vurgu ikiyle sınırlı: üçe bölmek vurguyu bitirir.
- **Tazelik göstergesi:** "Fiyatlar 18 Ağustos 2026 verisi" + `<time datetime>`. Kaynak
  `anasayfa.json`'un YENİ `veri_tarihi` alanı; `uretim` **bilerek kullanılmadı** (build anı).
  Hesap `scripts/veri-tarihi.mjs`'e çıkarıldı ve `hub-uret.mjs` de oradan besleniyor — iki
  üretici aynı günü söylemek zorunda. Maliyet 150 ms.

**Canlı doğrulama (uzantısız temiz profil + CDP, 390/1440, iki tema, iki tur):** fiyat
**41/41** kartta 24px Cabinet Grotesk · kartın en büyük öğesi 12/12 kartta fiyat · tazelik
"18 Ağustos 2026", `veri_tarihi` (`…T00:00:00+03:00`) ≠ `uretim` (`20:35:20Z`) · `sw.js`
**v212**, önbellek tam `[v212]`, **v211 temizliği ölçüldü** (`[v212,v211]` → `[v212]`) ·
5 şerit `[6,6,12,10,7]` · yatay taşma **0** · input 16px altı **0** · CSP **9 direktif**,
negatif kontrol engellendi · konsol hatası **0**.

> **Sayfanın en büyük öğesi hâlâ 56px `cat-emoji`** — bilerek. Kart hiyerarşisi çözüldü,
> emoji ızgarası Faz 3 (gerçek görsel üretme maliyeti var, ayrı karar).

**Yeni dosyalar:** `scripts/veri-tarihi.mjs`, `scripts/css-token.mjs`, `test_kart_fiyat.mjs`
(43 iddia). Kökteki `PROMPT_TASARIM.md` bu turun görev metni (commit edilmedi).

### 2026-08-18 — Görev 8+9: hub sayfaları uygulamadan keşfedilebilir (CANLI, DOĞRULANDI)

**Durum: yayında.** `63d8566` push edildi (deploy 34 sn, yeşil), üç şey birlikte canlıya çıktı:
(a) damga düzeltmesi `272f862`, (b) hub keşfedilebilirliği, (c) `?screen=kategori` rotası.
Görev 9 canlı doğrulaması koşuldu — **uzantısız temiz profil + CDP** (`--headless=new`,
`--disable-extensions`, taze `--user-data-dir`, `Runtime.evaluate` ana dünyada). Ölçümler:

- **18 footer linki 18/18 = 200, kırık 0** — iki tur (ikincisi cache buster'lı). 18 hub
  sayfasının İÇİNDEKİ 28 benzersiz iç linkin de hepsi 200.
- **`?screen=kategori&kat=<slug>`** — `et` (791 ürün) · `sut` (2326) · `temizlik` (3792) ·
  `meyve-sebze` (148) hepsi `screen-cat`'e düşüyor, `cat-title` doğru. `kat=yokboyle` →
  `screen-home` (sessiz düşüş çalışıyor). Rota `kat`'ı lowercase'e çevirdiği için `kat=ET` de
  `et`'i açıyor — kusur değil, büyük/küçük harfe duyarsızlık bedava geliyor.
- **`pazar-veri-damgasi` artık veriden** — 17 sayfa `2026-08-18T00:00:00+03:00` (bağımsız
  hesaplanan en yeni gözlem tarihiyle eşleşiyor), `/hal/` kendi `cekme_tarihi`'yle
  `2026-08-18T04:07:28+03:00`. Aynı anda canlı `anasayfa.json` `uretim` = **`16:47:48Z`**,
  yani build anı — damga onunla artık AYNI DEĞİL. Kusur kapandı, kapı görebilir hale geldi.
- **`sw.js` v210** kayıtlı, `active`, scope `/`, önbellek tam 2 kayıt (`hal.json`,
  `anasayfa.json`). **v209 temizliği ölçüldü** — aşağıdaki öğrenmeye bak.
- **Regresyon yok** — beş şerit dolu (6/6/12/10/7), konsol yalnızca Cloudflare beacon
  ihlalini basıyor (bilinen, hariç tutuluyor), `/zam/2026-08/` yerel üretimle **birebir aynı
  bayt** ve Loacker satırı yerinde (CarrefourSA 141,99 → 289,90, +%104).
- **CSP 9 direktif** — Görev 9 metni 10 bekliyordu, ama `src/worker.js` **her commit'inde 9**
  (`540d417`/`c2b1679`/`925893f`), CLAUDE.md de 9 diyor. Regresyon değil, beklenti yanlıştı.
  Ölçüm **negatif kontrollü**: `example.com`'dan görsel istendi, `img-src` ihlaliyle
  engellendi — yani başlık gerçekten uygulanıyor, sıyrılmıyor.

> **Uzantısız profilde bile yerel antivirüs CSP'ye ekleme yapıyor.** Sayfanın *uygulanan*
> politikasında `https://gc.kis.v2.scr.kaspersky-labs.com wss:` görünüyor — Kaspersky
> enjekte ediyor. `fetch()` ile okunan **yanıt başlığı** temiz 9 direktif. Yani ihlal
> mesajındaki politika metnine değil, yanıt başlığına bak.
>
> **AYNI YAZILIM 2026-08-19'da SİTEYİ TAMAMEN ENGELLEDİ (ikinci vaka).** Otomatik ölçüm
> istek hacmi tetikledi: `pazarapp.net` HTTP **499 "forbidden by antivirus"**, `curl`
> **`SEC_E_UNTRUSTED_ROOT`** (TLS Kaspersky köküyle yeniden imzalanıyor), `-k` ile 403.
> **Kalıcı çözüm: alan adı Kaspersky güvenilir URL istisnasına eklendi** — yalnızca bu
> makine, siteyi/kullanıcıları etkilemez. **Ders: canlı doğrulama aniden çökerse önce
> "site mi öldü yoksa yerel katman mı araya girdi" diye ayır** — sertifikayı kimin
> verdiğine bak. `localhost` bu taramaya girmiyor; yerel derleme her zaman kaçış yolu.

18 hub sayfası canlıya çıkmıştı ama uygulamadan onlara giden **hiçbir `<a href>` yoktu** —
keşif yalnızca sitemap'e kalıyordu. İki uç birleştirildi:

- **Uygulama → hub:** ana ekranın altında `<nav class="hub-nav">`. **Build'de üretiliyor**
  (`vite.config.js` → `hubFooterEnjekte` → `scripts/hub-footer.mjs` → `hubFooterEkle`), kaynak
  `.hub/manifest.json`'daki **`durum === "uretildi"`** kayıtları. `index.html` yalnızca
  `<!--HUB-LINKLERI-->` yer tutucusunu taşıyor. **SABİT LİSTE YASAK:** bugün 2 ay atlandı
  (`/zam/2026-05/`, `/zam/2026-06/`) ve elle yazılmış liste canlıda iki 404 üretirdi; Eylül
  sayfası üretildiğinde footer'a elle dokunulmadan giriyor. `test_hub_footer.mjs` bunu hem
  davranışta (manifeste sahte atlanan/üretilen kayıt enjekte ederek) hem **kaynak düzeyinde**
  (modül gövdesinde somut hub yolu ve market adı yok) ölçüyor.
- **Hub → uygulama:** `app.js`'e `?screen=kategori&kat=<slug>` rotası; kategori hub sayfasının
  "Uygulamada aç" linki artık oraya gidiyor. **Normalleştirme yazılmadı, çünkü gerekmiyor:**
  hub yolları `KATEGORILER`'in `slug` alanından kuruluyor (`hub-uret.mjs` onu `app.js`'ten
  `ic()` ile okuyor), 8 slug birebir aynı — ölçüldü, `test_routing_duzen.mjs` "HUB SLUG
  PARITESI". Tanınmayan `kat` sessizce Ana Sayfa'ya düşüyor; kapı **rotada**, çünkü
  `openCategory` tanımsız slug'da `kat.label` okurken patlar.
- **Manifest yeni alan: `kisa_ad`** — footer link metni. Sayfanın `h1`'i footer'a sığmıyor, ama
  etiketi footer tarafında yeniden üretmek `MARKET_NAMES`/`KATEGORILER`/`ZAM_AYLAR`'ın ikinci
  kopyası olurdu (bu depo o desenden iki kez yandı). Etiket sayfayı üreten yerde bir kez üretiliyor.
- **`sw.js` v209 → v210** (`app.js` + `index.html` + `style.css` değişti).

Yeni dosyalar: `scripts/hub-footer.mjs`, `test_hub_footer.mjs`. Kök dizindeki `PROMPT_G8.md`
bu turun görev metni (commit edilmedi). Ölçümler: `dist/`te 18 link, kırık link 0, dokunma
hedeflerinin en küçüğü 44px, yatay taşma yok, koyu temada kutu `#1C2823` / metin `#E5E7EB`.

### 2026-08-17 (akşam) — barındırma Cloudflare Workers'a taşındı, pazarapp.net canlı

**Site artık `https://pazarapp.net`, Cloudflare Workers üzerinde.** GitHub Pages bırakıldı. `sw.js` **v207**.

> **DOKÜMAN BAYATLIĞI — ÜÇÜNCÜ KEZ.** `wrangler.jsonc` (`e3a4a5f`, 2026-07-11) ve `src/worker.js` (`540d417`, 2026-07-12) **beş haftadır repodaydı** ve CLAUDE.md onlardan hiç söz etmiyordu; üstelik bu dosya "P1-T2 (CSP) hosting migration gerektirir, karar bekliyor" diye yazıyordu — oysa CSP kodu çoktan yazılmıştı. Aynı desen daha önce `urunler.json` ve `marketfiyati.json` ile yaşandı. **Kural: bir iş yarım bırakılıp repoda dosya kalıyorsa CLAUDE.md'ye o turda yazılacak; yoksa bir sonraki oturum onu yok sayıp baştan planlıyor.**

**Hedef Workers, Pages değil.** `wrangler.jsonc`: `main: src/worker.js`, `assets.directory: ./dist`, `run_worker_first: true`. `run_worker_first` **zorunlu** — `false` olsa statik varlıklar Worker'a hiç uğramadan servis edilir ve `index.html` CSP header'ı **almaz**.

**`not_found_handling`: `single-page-application` → `none`.** SPA fallback bu uygulamada **bozuktu**: routing `?screen=` query ile yapılıyor, path ile değil. Fallback açıkken `/herhangi/derin/yol` isteği `index.html` döndürüyor ve o sayfada `src="./app.<hash>.js"` → `/herhangi/derin/app.<hash>.js` olarak çözülüp 404'e düşüyordu (aynısı `./data/*.json` ve `./sw.js` için de). GitHub Pages'te fallback olmadığı için bu risk hiç yoktu; Cloudflare yapılandırması **getiriyordu**. Ölçüldü: derin yollar artık **404, 0 bayt gövde**, CSP header'ı 404'e de ekleniyor.

**P1-T2 (CSP) KAPANDI.** Header Worker'dan geliyor (`_headers` yolu 2026-07-12'de "güvenilmez" diye bırakılmıştı). Canlıda **9 direktif** + Cloudflare'in eklediği yok; 404'lere de uygulanıyor. İki genişletme ölçümle geldi:
- `img-src` += `lh3.googleusercontent.com` (Google OAuth avatarı, `app.js:225`) ve `pazar-app.goatcounter.com` (GoatCounter'ın `sendBeacon` yoksa düştüğü `img.src` yedeği).
- `font-src` += `cdn.fontshare.com` — **canlıda 6 ihlal yakalandı**, Cabinet Grotesk hiç yüklenmiyordu (aşağıdaki öğrenmeye bak).

**`deploy.yml` tek job'a indi.** KORUNAN: `push` + `workflow_run("Veri Guncelle")` + `workflow_dispatch`, `conclusion == 'success'` kapısı, `concurrency`, `checkout ref:main`, `npm ci`. KALDIRILAN: `pages: write`, `id-token: write`, `upload-pages-artifact`, `deploy-pages`, ayrı deploy job'ı, `github-pages` environment. EKLENEN: `cloudflare/wrangler-action@v3` (`CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`), **Node 24**, **`wranglerVersion: '4.122.0'` sabit**.
- Node 20 → 24 çünkü wrangler 4.x `node >= 22` istiyor; ilk deploy tam bu yüzden düştü. 22 değil 24: yerel ortam v24.18.0, hata zaten yerel-CI majör farkından çıkmıştı.
- Sürüm sabitlendi çünkü wrangler neredeyse her gün yayın yapıyor (21 Tem–13 Ağu arası 12 kararlı sürüm). 4.122.0 seçildi: latest'in bir minor gerisi ve ardından hotfix gelmemiş (4.120.0 ertesi gün 4.120.1 ile yamanmıştı).

**`vite.config.js` base varsayılanı `/pazar-app/` → `/`.** Eski varsayılanı bırakmak sessiz 404 tuzağıydı. Kaçış yolu duruyor: `DEPLOY_TARGET=ghpages` eski düzeni verir (ölçüldü).

**18 elle düzenleme** (index.html 4 meta, manifest 6, app.js 3 paylaşım URL'i, robots, sitemap `<loc>`, anasayfa-uret vm stub 2, test_sitemap, hal_gorsel_cek UA). **Dokunulmayanlar:** `index.html`'deki 17 kök-mutlak yolu Vite base ile yeniden yazıyor; `app.js`'in 6 fetch'i göreli; `sw.js`'te alan adı hiç yok (`new URL(..., self.location)`); `static/og-image.svg`'de alan adı bilerek yok.

**Canlı doğrulama (uzantısız temiz profil):** 13 `data/*.json` 200 · manifest `start_url`/`scope`/`id` = `/` · `sw.js` v207, cache tam 2 kayıt · beş şerit dolu (6/6/12/10/6 kart) · Cabinet Grotesk 700+800 `loaded` · TLS `CN=pazarapp.net`, Google Trust Services, 15 Kas 2026'ya kadar.

**Supabase URL Configuration güncellendi:** Site URL `https://pazarapp.net`, Redirect URLs'e `https://pazarapp.net/**`. Öncesinde Google girişi kullanıcıyı **eski alan adına** düşürüyordu (ölçüldü). E-posta/şifre girişi etkilenmiyordu — `signInWithPassword` yönlendirme kullanmıyor.

### 2026-08-11/17 oturumları — denetim borcu kapatıldı, karşılaştırma satırı yenilendi, SEO zemini kuruldu

Bu aralık `DENETIM.md`'nin (2026-08-11) bulgularını kapatmakla geçti. Sürüm eşlemesi: **v199** iddia doğrulaması, **v200** klavye+odak, **v201** sessiz catch, **v202** koyu tema + dokunma hedefleri, **v203** kalan satır içi tetikleyiciler, **v204** karşılaştırma satırı, **v205** son klavye açıkları, **v206** SEO.

**Sayısal iddialar HAM seriye karşı doğrulanıyor (`4d3dc47`, v199).** Değer düzeltmesi temiz seriye geçmişti ama rozet metni hâlâ "30 günün en düşüğü" diyordu — iddia ham seriyle çelişiyordu. `_hamDipMi()` kapısı kondu: iddia neyi kapsıyorsa o seriye karşı sınanıyor. Gerçek indirim rozeti 1492/91 yanlış (**%6,1**) → 1401/0 (**%0**); alarm cümlesi 9 yanlış → 0 (170 sustu), al/bekle 17 çelişki → 0 (94 sustu). En kötü sapma %45,5'ti. `indirimRozetiHesapla` ve `fiyatGecmisiBlogu` zaten ham seriden okuyordu, dokunulmadı.

**Klavye erişimi ve odak göstergesi (`ed290fd` v200, `e015eff` v203, `4bd0d19` v205).** Denetim ölçümü: onclick taşıyıp klavyeye kapalı **51 öğe**, sayfadaki toplam odaklanabilir öğe 15 ve **15'inin de** odak göstergesi yok. Uygulamanın ana işlevi — ürün detayına gitmek — klavyeye ve ekran okuyucuya tamamen kapalıydı. Üç turda 51 → 10 → 0 (taranan desende). `_kartTus`/`_satirTus` Enter+Space işleyicileri, `:focus-visible` halkaları (**10 kural**), toggle'da `aria-pressed`. `maximum-scale=1.0` kaldırıldı, yakınlaştırma serbest. **Modal arka planları (`.auth-sheet__backdrop`, `.app-modal-backdrop`, `.ms-sheet-backdrop`, `.mf-sheet-backdrop`) bilerek dışarıda** — arka planı tab sırasına sokmak ekran okuyucuda anlamsız bir durak yaratır, klavye yolu Escape dinleyicileri. **Ama tarama kör noktası bir öğeyi atladı, aşağıdaki teknik borca bak.**

**40 sessiz catch görünür yapıldı (`456a831`, v201).** **17 çıplak `catch(e){}` + 23 açıklamasız → 0 + 0.** Ölçüt "yutulan hata ne demek, kullanıcı ne kaybeder": kullanıcı bir şey kaybediyorsa **18'i** `console.warn`'a çıktı (`loadPazarFavoriler` favorileri EKSİK gösteriyordu, `gecmisVeriGetir` rozet/alarm/al-bekle'yi sessizce düşürüyordu, `supheliPuanlariYukle` hiç rozet çizmiyordu), kaybettirmeyen **22'sine** neden yorumu yazıldı. 38 `console.warn/error`, her biri ≥12 karakter anlamlı metin. `test_sessiz_catch.mjs` koruma testi: yeni çıplak catch eklenirse kırılır. Bu desen projeye üç kez pahalıya mal oldu (temizlik kategorisi 3 hafta, Searlo 74 gün, `loadData` TypeError 1 ay).

**Koyu tema kontrastı (`d87b286` + `cf83c5f`, v202).** Denetim: koyu tema açık temadan **kötü** durumdaydı (10 AA ihlali vs 7). **Kök neden değişken mimarisi DEĞİLDİ** — `[data-theme="dark"] { --card-bg:#1C2823 }` doğru kuruluydu ve elemanda doğru çözülüyordu. Gerçek kök neden: **auth modalinin koyu tema override'ı hiç yazılmamıştı** (grep: 0 kural), modal koyu temada açık zeminde açık gri metinle çiziliyordu → "veya" ayracı 2,54, `.auth-tab` 4,39. İki nokta daha: `.nav-btn.active` parlak yeşil zeminde beyaz metin 2,54 → koyu metin (#0F1A14); `.profil-item-icon` pastel çip zeminini koruyup metnini `--text`'e çeviriyordu 1,01 → ön plan koyu bırakıldı. Düzeltmelerin hepsi mevcut koyu tema paletinden. Yanlış pozitif olarak **dokunulmayanlar:** `.auth-submit` (gradient zemin, beyaz metin doğru), `.sr-only` (görsel olarak gizli).

**Dokunma hedefleri (`cf83c5f` v202, ölçüm `3937aae`).** 15 sınıfa **görünmez `::after` katmanı** (min-width/height 44px, ortalanmış): görsel boyut, padding, font, radius ve yerleşim aynı, yalnızca basılabilir alan büyüyor. Kaydırılabilir şeritlerde komşu hedefler üst üste binmesin diye `.firsat-tab` ve `.tazelik-chip` yalnızca dikey tamamlanıyor. Geometri parmak izi ilk turda ALINMAMIŞTI; iframe yöntemiyle 390px ve 1440px'te ölçüldü: ölçülebilen **8 sınıfın hepsi 44×44 geçiyor, altında kalan 0**, geometri değişmedi (`.add-btn` 30×30 → 44×44, `.filter-pill` 59×26 → 57×44, `.siralama-btn` 142×32 → 140×44).

> ⚠️ **DÜZELTME (2026-08-19): yukarıdaki `.add-btn` 44×44 iddiası GERÇEKTE TUTMUYORDU.**
> Aynı commit, `::after` katmanını demirlemek için bir `position: relative` listesi
> ekledi ve o liste `.add-btn`'in kendi `position: absolute`'ını **ezdi**. Buton kartın
> dışına kayıp `overflow:hidden` ile kırpıldı; etkin dokunma hedefi **30×44** oldu ve
> 48/48 kartta butonun üçte biri görünmez kaldı — **10 gün boyunca**, kullanıcı bildirene
> kadar. **Ölçüm `::after` KUTUSUNU ölçmüştü, kırpıldıktan sonra GERİYE KALANI değil.**
> Ders aşağıda ("bir ata `overflow:hidden`…"). Düzeltme: `b48ecd9`.

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
| `test_esit_fiyat.mjs` | 105 | Eşit fiyat durumları, "en ucuz" iddiasının çoklu markette davranışı |
| `test_hub_html.mjs` | 73 | Hub sayfası HTML iskeleti, meta/damga alanları |
| `test_hub_uret.mjs` | 68 | `hub-sayfa.mjs` saf fonksiyonları (fs/vm/ağ YOK) |
| `test_splash.mjs` | 46 | Splash: sabit süre yerine `pazar:hazir`, tema-duyarlı zemin, easing tokenları |
| `test_kart_fiyat.mjs` | 43 | Şerit kartı hiyerarşisi, fiyat satırı, rozet yuvası, genişlik tek kaynağı |
| `test_kategori_ikon.mjs` | 31 | 8 kategori ikonu, marka SVG diline uyum, sessiz boş üretim yasağı |
| `test_zam_olcut.mjs` | 25 | Zam ölçütünün market bazlı serisi, eşik davranışı |
| `test_mobil_dokunma.mjs` | 23 | Çift-tık zoom kapalı / PINCH açık, `.add-btn` konumu, kaçış deseni |
| `test_hub_veri_damgasi.mjs` | 17 | Damganın build anından değil veriden türemesi (regresyon kilidi) |
| `test_hub_zam_pencere.mjs` | 10 | Hub zam penceresi — gerçek script koşturulup stdout gözleniyor |
| `test_sinif_kacis.mjs` | 5 | Market etiketinde sınıf kaçışı beyaz listesi |
| `test_hub_footer.mjs` | 53 | Footer hub linkleri: sabit liste yasağı, `kisa_ad`, kaynak düzeyi kontrol |
| `test_hub_tazelik.py` | — | Hub tazelik kapısı (Python) |

**Toplam 46 takipli dosya (40 `.mjs` + 6 `.py`), `.mjs` paketi 40/40 yeşil (2026-08-19).**
Bu tablo 2026-08-17'de **33 dosyada donmuştu**; hub turu ve tasarım turlarında eklenen
13 dosya listelenmemişti. Sayılar `PASS=` / `SONUC:` çıktısından yeniden ölçüldü, tahmin
değil. (Diskte 3 takipsiz `.py` daha var — aşağıdaki Searlo denemeleri.) `test_debug.py` / `test_resim_mini.py` / `test_searlo.py` regresyon testi DEĞİL — `.gitignore`'daki tek seferlik Searlo denemeleri, kredi bittiği için hata basarlar.

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

`fiyat_bildirim` tablosu (2026-08-06): kullanıcı fiyat bildirimleri. **Yetkiler:** `authenticated` INSERT edebilir (policy `with check kullanici_id = auth.uid()`), SELECT/DELETE **edemez**; `anon` hiçbir şey yapamaz. Okuma yalnızca `get_fiyat_bildirimleri()` RPC'si üzerinden (security definer). RPC'nin içinde bir eşik var — tek bildirimde boş dönüyor.
> **DÜZELTME (2026-08-19):** "`anon` hiçbir şey yapamaz" **2026-08-19 öncesinde YANLIŞTI** — anon SELECT `42501` ile kapalıydı ama **INSERT AÇIKTI** (güvenlik denetimi B2; anon `{"_sid":"x","market":"bim"}` → 201). O tarihte DB policy'siyle (`to authenticated, with check kullanici_id = auth.uid()`) ve istemci tarafı kapıyla (`_bildirimYetkiVarMi()`, `app.js`) kapatıldı; canlı doğrulandı (girişli 201, girişsiz reddediliyor). Şimdi ifade gerçekten doğru.

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
- **P1-T2 (CSP header) TAMAMLANDI — 2026-08-17.** Cloudflare Workers'a geçişle birlikte kapandı; header `src/worker.js`'ten geliyor, 9 direktif, 404'lere de uygulanıyor. Kod aslında 2026-07-12'de yazılmıştı ama deploy edilmemişti (yukarıdaki doküman bayatlığı notuna bak).
- **Hâlâ karar bekliyor:** P1-B1 (tuzak public landing — tuzak'ın geleceği belirsizken erken).
- **Henüz bakılmadı:** P1-U1 (erişilebilirlik taraması), P1-U2 (offline banner), P1-B2 (push izni zamanlaması), P2 maddeleri.

### Dağıtım durumu (2026-08-17)

Uygulama teknik olarak çalışıyor ama **pratikte hâlâ dağıtılmamış durumda.** Bu bölüm o boşluğu görünür tutmak için var — özellik eklemeden önce buraya bak.

- **Alan adı geçişi TAMAM (2026-08-17).** `https://pazarapp.net` canlı, Cloudflare Workers, TLS geçerli. Custom domain `wrangler.jsonc`'taki `routes` bloğuyla apex olarak bağlı.
- **`www.pazarapp.net` YOK — NXDOMAIN.** DNS kaydı hiç oluşturulmadı. Bilerek: iki alan adı da aynı içeriği verirse yinelenen içerik olur ve yeni kurulan canonical bozulur. Ama `www` yazan kullanıcı **hata alır** — `www → apex` yönlendirmesi Cloudflare Redirect Rule ile panodan kurulmalı, bu repodan yapılamaz.
- **`*.workers.dev` adresi KAPANDI.** `routes` eklenince wrangler onu devre dışı bıraktı (deploy logunda uyarısı var); ölçüldü, `pazar-app.mustafaavkan72.workers.dev` → 404. SEO açısından iyi (aynı içeriği veren ikinci URL yok) ama **yedek test adresi kalmadı**; gerekirse `workers_dev: true` ile geri açılır.
- **Eski origin `avkkann.github.io/pazar-app` HÂLÂ ESKİ UYGULAMAYI SERVİS EDİYOR.** GitHub Pages kendiliğinden kapanmıyor. `mezar-tasi` dalı (orphan, `6f72f3a`, uzakta) hazır ve Pages Source ona çevrildi, ama **`actions/deploy-pages` 503 veriyor** (build başarılı, deploy adımı düşüyor; yeniden deneme de 503 aldı). Deploy geçene kadar eski adres donmuş veriyle, eski canonical'la ve eski `sw.js` (v206) ile ayakta.
- **GoatCounter (1 Tem – 17 Ağu): 59 ziyaret.** Kaynakların **%90'ı doğrudan/bilinmeyen**, **arama trafiği sıfır**. %97 Türkiye, **%68 telefon**, **%64 iOS/Safari**. İki sonuç: (a) tek dağıtım kanalı doğrudan link paylaşımı — o yüzden `og:image` en öncelikli SEO maddesiydi; (b) **kullanıcıların üçte ikisi Safari'de ve uygulama Safari'de hiç test edilmedi.**
- **Google'da hiç indekslenmemiş** (`site:` sorgusu 0 sonuç, eski adres için). 2026-08-17 zemin taraması: robots engellemiyor, `noindex` yok, `X-Robots-Tag` yok, canonical doğru, cloaking yok, sitemap geçerli ve erişilebilir, indekslenebilir metin var. **Teknik engel yok** — sebep Search Console'a hiç eklenmemiş olması ve dışarıdan bağlantı olmaması. Alan adı geçişi bittiği için **artık yapılabilir** ve sıradaki işlerin 1. maddesi.
- **Cloudflare Web Analytics beacon'ı bloklu ve öyle KALACAK.** Cloudflare `static.cloudflareinsights.com/beacon.min.js`'i HTML'e sonradan enjekte ediyor; `script-src` izin vermediği için çalışmıyor. **Karar: CSP'ye eklenmeyecek** — analitik zaten GoatCounter'dan geliyor, ikinci bir izleyici gereksiz. Konsolda bu tek ihlal görünür, uygulamayı etkilemiyor. (Kapatmak istenirse pano → Web Analytics.)
- **`fiyat_bildirim` hız sınırı CANLI (2026-08-20).** `sql/fiyat_bildirim_hiz_siniri.sql` kuruldu ve doğrulandı (PT409/PT429 — bkz. 2026-08-20 bloğu). Eski test kaydı (`{"_sid":"x"}`) temizlendi (ölçüldü: `_sid='x'` = 0). Tabloda şu an 1 kayıt var (kaynağı test/doğrulama, gerçek kullanıcı bildirimi değil).
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
> sessizce atlanması. **2026-08-20'de kapandı:** `fiyat_bildirim` hız sınırı (1.2 —
> trigger canlı) ve çıktı kaçışı (1.5 — B1, kaçış tarafı; bkz. 2026-08-20 bloğu).
> **Açık kalanlar:** `load` olayı 7,6 sn (3.1), SW sürüm/veri ayrışması (3.4).
> **DENETIM.md'nin kendi durum işaretleri geride** — yalnızca 4 madde `KAPANDI` diye
> işaretli, gerçekte daha fazlası kapandı. Durum için bu dosyayı esas al.

**Sıradaki işler (öncelik sırasıyla):**
1. **Search Console'a ekleme + sitemap gönderimi — ARTIK YAPILABİLİR.** Alan adı geçişi bitti, bekleme sebebi kalmadı. Repoda doğrulama dosyası/meta etiketi **yok**, git geçmişinde de iz yok. İndekslenmemenin tek sebebi bu + dış bağlantı yokluğu. Mülk **`pazarapp.net`** için açılmalı (eski adres için değil); `robots.txt` ve `sitemap.xml` zaten yeni alan adını gösteriyor.
2. **Mezar taşını yayına al** (`mezar-tasi` dalı hazır, Pages Source ayarlandı, `deploy-pages` 503 veriyor). Geçtikten sonra ölçülecek: mezar taşı mı geliyor, meta refresh süresi, canonical, JS kapalı metin, ve **eski `sw.js` gerçekten `unregister` oluyor mu**. **main'e MERGE EDİLMEZ** — dosya adları uygulamanınkiyle aynı, merge giriş sayfasını ve service worker'ı ezer.
3. **Aranabilir içerik üretimi.** Ürün başına statik sayfa + aylık zam listesi sayfası, **build zamanında** `anasayfa.json` deseniyle (`app.js`'i `node:vm`'de koşturup kendi fonksiyonlarını çağır — mantık ikinci kez yazılmaz). SPA'nın tek URL'si arama için yeterli değil.
4. **KVKK aydınlatma metni.** Artık hesap, fiyat alarmı, push bildirimi ve şehir tercihi tutuluyor — "uygulama bitince" erteleme gerekçesi kalmadı.
5. **Sepet şemasına `_sid` eklenmesi.** Karşılaştırma ekranındaki rozetler için gerekiyor. Etkilenenler: Listem, şablonlar ve **localStorage'daki mevcut sepetler** — geriye dönük uyumluluk düşünülmeli.
6. **Searlo kredisi kararı** — resim doldurma adımı artık boşa koşmuyor ama **hiç resim de doldurmuyor**. Ya kredi yenilenecek ya alternatif kaynak seçilecek ya da adım tamamen kaldırılacak. Alternatif kaynak araştırması bilinçli olarak yapılmadı.
7. **~2026-09-01: HAYALET ZAM kuralı ölçüye dayalı hale getirilecek.** `depot_id`/`depot_ad` **2026-08-11'den beri** birikiyor. O tarihte yeterli veri olacak ve "bu dip/zıplama gerçekten mağaza değişimi mi" sorusu **doğrudan** cevaplanabilecek; `zamSalinimVar`'daki yapısal salınım testi `depot_id` değişimini izleyen ölçüme dayalı kuralla değiştirilmeli. Not `app.js`'te `_seriKur` ve `zamSalinimVar` üzerinde duruyor. **Bu tarih geçmeden kuralı değiştirme, ölçüm olmadan yeni eşik uydurma.**
8. **`www.pazarapp.net` yönlendirmesi** — şu an NXDOMAIN, `www` yazan kullanıcı hata alıyor. Cloudflare Redirect Rule ile `www → apex`; bu repodan yapılamaz, pano işi. **İkinci custom domain olarak bağlanmamalı** (yinelenen içerik).

> Eski **kök `avkkann.github.io/sitemap.xml`** maddesi 2026-08-17'de düştü: artık `pazarapp.net` kendi host'u, kendi `robots.txt`'i ve kendi `sitemap.xml`'i var. `robots.txt` host başına okunduğu için Google artık bu depodan üretilen dosyayı okuyor. Başka bir depodaki o dosya bu proje için anlamsız.

**Karar bekleyen:**
- **Al/bekle'de kaybolan 900 çıktı.** Temiz seriye geçince alarm önerisi −492, al/bekle −408 düştü. Bunlar yeni bir susturma kuralı değil, **mevcut kapılar** düzeltilmiş veriye uygulandığı için: alarm "fiyat zaten dipteyse öneri yok"a, al/bekle `AL_ZAMANI_MIN_OYNAMA` %5 kapısına takılıyor. Düşenlerin yarısında temiz aralık **tam sıfır** (ürün 30 gündür kımıldamamış, "bekle" demek yanlıştı). Ama dürüst sınır: salınımlı seri "yanlış seri" değil — inip biten bir kampanya gerçek bir diptir ve o bilgiyi kaybettik. Kabul mü, yoksa hedefli bir istisna mı gerekiyor?
- **Tuzak şeridi rastgele seçiyor.** Havuz (30 kırmızı + 30 sarı) build'de hesaplanıyor, istemci karıştırıp 6 alıyor — bugünkü davranışın aynısı. Kalıcı/kişiselleştirilmiş seçim isteniyorsa ayrı karar.
- **"Tuzak" sekmesinin kaldırılması** — yerini alacak özellikler tamamlandı.
- **Gramaj hilesi (shrinkflation) analizi** — `agirlik_hacim_gecmisi` birikiyor, veri bekliyor (3-6 ay).
- **İlan edilen indirim vs gerçek düşüş karşılaştırması** — `ilan_indirim_gecmisi` ile `fiyat_gecmisi`'ni karşılaştırıp "ilan edilen indirim gerçek mi" sorusunu cevaplamak. Veri bekliyor; ilk dolu koşu 2026-08-09.
- **Hal–market karşılaştırması — ÇEŞİT EŞLEŞTİRME ÇÖZÜLMEDEN AÇILMASIN.** `renderFirsatHal`/`halEsles`/`halKgHesapla` 2026-08-10'da silindi (zaten ölü koddu, hiçbir yerden çağrılmıyordu). İki kusuru vardı: **(a) Çeşit vs dökme emtia.** Market ürünlerindeki nitelemeler halin dökme kaleminin karşılığı değil — ölçüm: ekrandaki 20 eşleşmenin **17'sinde** market adında hal kaleminde olmayan bir kelime vardı (`Şeker Domates 250 Gr` ↔ hal `Domates`: 158,00 vs 21,56 ₺/kg; `Kiraz Gurme` ↔ `Kiraz`: 229,90 vs 76,58; `Çengelköy Salatalık` ↔ `Salatalık`: 89,00 vs 16,32). Şeker domatesi halin dökme domatesiyle kıyaslamak farklı iki malı kıyaslamaktır. **(b) Paket bazlı hesap yok.** Tasarruf kg farkı olarak hesaplanıp küçük paketin üstüne basılıyordu: `Soya Filizi 125 Gr` raftaki 189,90 ₺ → 1.519,20 ₺/kg çevrimi → rozet "1.008,87 ₺ ucuz", oysa o paketteki gerçek fark 126,11 ₺. Ekrandaki 20 üründen 4'ü 1 kg'dan küçük paketliydi. Yeniden açılacaksa **önce** çeşit seviyesinde eşleştirme (marka/çeşit sözlüğü) çözülmeli, **sonra** tasarruf paket ağırlığı üzerinden hesaplanmalı.

**Teknik borç / arıza:**
- **CI HİÇBİR TEST KOŞTURMUYOR — açık borç, 2026-08-18'de fark edildi.** `deploy.yml` ve `update-data.yml` içinde tek bir `test_*`/`pytest`/`npm test` çağrısı yok; ölçüldü, sonuç sıfır. Depoda **34 `test_*.mjs` + `test_*.py`** var ve hepsi yalnızca yerel koşularda çalışıyor. Yani "testler yeşil" ifadesi yayına giren şey hakkında hiçbir garanti vermiyor: kırmızı bir testle deploy etmek bugün mümkün. Hub işi bu borcu büyüttü (bu turda 6 yeni test dosyası eklendi). Çözülürken dikkat: **`test_debug.py` ve `test_resim_mini.py` test DEĞİL**, Searlo API sondası — `PASS/FAIL` yok, çıkış kodu disiplini yok, canlı `api.searlo.tech`'e istek atıyorlar ve Searlo kredisi 27 Mayıs'ta bittiği için kalıcı kırmızılar. Süiti CI'a bağlamadan önce ikisi `sonda_searlo.py` gibi bir ada taşınmalı, yoksa kapı ilk günden yanlış alarmla açılır.
- **Hal'de iki kırılgan kalem** — `Tamarind(demirhindi)` (tek satır, 5 kg hacim) ve `Isırgan (yaş-taze)` (tek satır, 2 kg hacim). Fiyatları absürt değil ve `URUN_MAX_FIYAT`'ı geçmiyorlar, ama doğrulanacak ikinci kayıt yok — tek bir hatalı bültende sessizce yanlış değer gösterebilirler.
- **`app.js`'te çağrılmayan 4 fonksiyon + 1 ölü değişken** (2026-08-10 taraması, 177 fonksiyon içinde): `filterUrunler` (2660), `mfGorsel` (2924, boş stub), `mfPlaceholderEmoji` (2926, boş stub), `temaToggle` (4291); `activeMarket` (616) yalnızca `null` atanıyor, hiç okunmuyor. Ayrıca `halMap` (611) artık **yalnızca yazılıyor** — tek okuyucusu silinen `halEsles`'ti; `loadData` hâlâ dolduruyor. Hiçbiri silinmedi, karar Mustafa'da.
- **`.sablon-chip` klavyeye kapalı — üç klavye turunun hepsi kaçırdı.** Listem'deki kayıtlı şablon çipleri `<span class="sablon-chip" onclick="sablonYukleUI(...)">`; `tabindex`/`role`/`onkeydown` yok, JS yalnızca `touchstart/end/move` (uzun bas → düzenle) bağlıyor. **Neden kaçtı:** üç tur da tek satırlık markup'a baktı, bu öğe `'` + `'` ile çok satırlı birleştirmeyle üretiliyor, `class="sablon-chip" ... onclick=` deseni hiçbir satırda yan yana çıkmıyor. Hiçbir test de kapsamıyor. **Tarama yapacaksan önce birleştirmeleri düzleştir.** Doğrulandı 2026-08-17: düzleştirilmiş taramada onclick taşıyan 20 blok/inline öğeden `tabindex` taşımayan 5 tane — 4'ü bilerek dışarıda bırakılan modal arka planı, 5.'si bu.
- **Sürüm numarası tek kaynaktan gelmiyor** — `index.html:528`'de `v1.0` elle yazılı, `sw.js`'teki `CACHE_NAME` (şu an `v228`) ile hiçbir bağı yok.
- **`update-data.yml` hâlâ Node 20, `deploy.yml` Node 24 — AÇIK BORÇ.** Somut sonucu: `data/anasayfa.json` **iki farklı Node majöründe** üretiliyor — gece koşusu onu Node 20'de üretip repoya commit'liyor, deploy build'i aynı script'i Node 24'te yeniden koşturup `dist/`e onu koyuyor. Yani commit'lenen dosya ile yayına giden dosya farklı motorlarda doğuyor. Mantık aynı olduğu için çıktının da aynı olması beklenir ama **doğrulanmadı**; "aynı türetilmiş dosyanın iki kaynağı" bu dosyanın tuzak diye işaretlediği desen. `update-data.yml` wrangler kullanmadığı için geçiş turunda bilerek dokunulmadı. Kapatılırken iki koşunun çıktısı bayt bayt karşılaştırılmalı.
- **`style.css`'te iki adet birebir aynı ölü `@media` bloğu** (`CENTER-FIX-TAMAM` ×2) — temizlenmedi.
- **Ölü `.cmp-mkt-item-img` kuralı** — `style.css:650`'de eski 30px tanımı duruyor, dosyanın sonundaki yeniden tasarım bloğu 56px'le eziyor. Zararsız ama yanıltıcı.
- **B1 XSS — çıktı kaçışı (DENETIM 1.5). Kaçış sertleştirmesi TAMAMLANDI.**
  Merkezî kaçış yardımcıları mevcut; localStorage, dış API/DB kaynaklı render yolları
  ve satır içi olay bağlamı bunlara geçirildi — dinamik değerler artık olay
  handler'ına doğrudan yazılmıyor, `data-*` özniteliğinden okunuyor (bkz.
  `test_kacis.mjs` — **86 iddia** (2026-08-20 tam yeniden taramada arama sorgusu
  echo sink'i bulunup kapatıldı, q echo guard eklendi), gerçek tarayıcı DOM ölçümü
  + negatif kontrol + regresyon + işlevsel tıkla/klavye/sepet). `&` çift-kaçışa
  gitmiyor, Türkçe/görsel bozulmuyor. CSP bu iş boyunca değişmedi. Ayrıntılı bulgu
  listesi repo dışındaki denetim notlarında tutuluyor. `sw.js` **v228**.
- **`'Makyaj'` kategorisi (70 ürün) `app.js` beyaz listesi dışında** — Temizlik sekmesi yerine "diger"e düşüyor. Kategori bölünmesinden önce de böyleydi. (`/api/v2/search` ucu bu tür artıkları yakalamak için değerlendirilebilir.)
- **`marketfiyati.json`** — bayat/farklı kaynak, hâlâ `marketfiyatiYukle()`/productMap fallback'inde. `urunler.json` gibi bir sonraki temizlik adayı.
- **`kesif_*`/`migrate_*`/`a101_pilot_*` dosyaları** — gitignore'da ama diskte, silme kararı Mustafa'da.

**Diğer:**
- **A101 Kapıda entegrasyonu** — pilot scraper hazır, DB'ye nasıl ekleneceği kararı bekliyor.
- **P1-B1 (tuzak landing), P1-U1/U2/B2, P2** — tartışılmadı. (P1-T2 CSP 2026-08-17'de kapandı.)
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
- **Supabase'de RLS ≠ GRANT — policy tek başına YETMEZ.** `grant select, update, insert, delete on public.<tablo> to authenticated` ayrıca gerekiyor; yoksa `permission denied for table X (42501)` alırsın ve hata RLS policy'sini yanlış yazmışsın gibi görünür. **RLS policy yazdığın anda GRANT'i de yaz.** Yeni şema kurulumunda tek blok: tablo + RLS + policy + GRANT + trigger + index. (`profiles` ve `favoriler` tablolarında birer kez yaşandı. 2026-08-18'de beş haftalık bir stash'ten kurtarıldı — CLAUDE.md yeniden yazılırken düşmüştü.)
- **Supabase Edge Function'da CORS/OPTIONS unutulursa teşhis yanıltıcı olur.** `corsHeaders` + OPTIONS handling yokken tarayıcıdan `Authorization` başlıklı istek "Failed to fetch" veriyor, ama başlıksız `GET` düzgün bir 401 döndürdüğü için hata auth sorunu sanılıyor. Preflight'ı elle sına: `curl -X OPTIONS -i <fn-url>`. (Aynı stash'ten kurtarıldı.)
- **Windows PowerShell `&&` desteklemiyor** — `;` kullan veya ayrı çağrı yap. Bash tool'unda `&&` çalışır ama `grep` eşleşme bulamayınca exit 1 döner ve zinciri keser; kontrol amaçlı grep'leri `;` ile ayır.
- **`update-data.yml` tam koşusu ~20 dk sürüyor** (ölçüm 2026-08-20: son 5 gecelik koşu 17–21 dk; eski "~2 saat" notu yanlıştı). Manuel tetikleme kararı verirken hesaba kat; tek kategoriyi test etmek için `scrape_category()`'yi doğrudan çağıran küçük bir script yaz.
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
- **Tarayıcı uzantısı CSP response header'ını SIYIRIYOR — MCP tarayıcısıyla CSP doğrulanamaz.** 2026-08-17: `img-src` sınamamda kontrol grubu olarak koyduğum `example.com` de "geçti"; iki farklı yöntemde de. Sebep iki katmanlı: (a) `javascript_tool` uzantının **izole dünyasında** koşuyor ve içerik script'leri sayfa CSP'sine tabi değil; (b) o profildeki cüzdan uzantısı CSP header'ını **tamamen kaldırıyor** — sayfa `content-security-policy: yok` görürken curl aynı adreste 9 direktif görüyordu (`window.ethereum` varlığı ipucuydu). **CSP ölçümü uzantısız temiz profille yapılmalı** (`--disable-extensions` + taze `--user-data-dir`), tercihen CDP ile — `Runtime.evaluate` sayfanın ANA dünyasında koşar. **Ve her CSP sınamasına bir NEGATİF KONTROL koy**: izin verilmeyen bir hosttan kaynak iste, engellendiğini gör. Kontrol geçiyorsa ölçüm bozuktur, bulgu değil.
- **Statik tarama bir CSP ihlalini yakalayamaz — kaynak host, isteyen host değildir.** Her font sağlayıcısı CSS'i bir hosttan, font DOSYALARINI başka hosttan veriyor: `fonts.googleapis.com`→`fonts.gstatic.com`, `api.fontshare.com`→**`cdn.fontshare.com`**. İkincisi repoda **hiçbir yerde geçmiyor**; CSS'in içinde ve **protokol-göreli** (`//cdn.fontshare.com/...`). Repo taraması temiz dedi, canlı ölçüm 6 ihlal buldu ve Cabinet Grotesk hiç yüklenmiyordu. Aynı sınıf: **Cloudflare beacon'ı** HTML'e *sonradan* ve **UA'ya koşullu** enjekte ediliyor — curl varsayılan UA'sıyla görünmüyor, tarayıcı UA'sıyla görünüyor (34.570 vs 34.929 bayt). **CSP'yi repo grep'iyle doğrulama; canlı sayfada, gerçek tarayıcıda ölç.**
- **Supabase redirect allowlist'i CALLBACK'te uygulanıyor, authorize'da değil.** `/auth/v1/authorize?redirect_to=...` uydurma bir alan adına bile aynı 302'yi veriyor — orada bakmak hiçbir şey ayırt etmiyor. Doğrusu: authorize'dan `state`'i al, `/auth/v1/callback?state=...&error=access_denied` ile dön ve **nereye yönlendirdiğine** bak. Ama hedef alan adına bakmak da yetmez — Site URL zaten o alan adıysa izinli/izinsiz aynı yere düşer. **`redirect_to`'ya ayırt edici bir yol izi koy** (`/olcum-izi`): allowlist eşleşirse yol aynen korunur, eşleşmezse çıplak Site URL'e düşer. Kimlik bilgisi girmeden ölçülebilir.
- **Kullanılmayan bir hedefin varsayılan kalması sessiz 404 tuzağıdır.** `vite.config.js` `base` varsayılanı geçişten sonra da `/pazar-app/` idi; `DEPLOY_TARGET` set edilmeyen her build (yerel, ya da env satırı düşerse CI) sessizce yanlış önekli yollar üretip Cloudflare'de tüm varlıkları 404 yapardı. Bir hedef terk edildiğinde **varsayılanı da taşı**, eskisini opt-in yap.
- **Service worker `activate`'i "unregister + hemen register" ile ateşleyemezsin — yanlış NEGATİF verir.** 2026-08-18, v209 temizliğini ölçerken: sahte `pazar-cache-v209` kuruldu, kayıt `unregister()` edildi, aynı sayfada `/sw.js` yeniden register edildi → **v209 silinmedi**, "temizlik çalışmıyor" gibi göründü. Sebep kodda değil yöntemde: script baytı aynı ve sayfa hâlâ o SW tarafından kontrol ediliyorken Chrome kaydı diriltiyor, `install`/`activate` **hiç koşmuyor**. Çalışan yol: `unregister()` → **`about:blank`'e git** (kontrol edilen istemci kalmasın) → siteye geri dön. O zaman taze `install`+`activate` koşuyor ve `activate` `CACHE_NAME` dışındaki her anahtarı siliyor (ölçüldü: `[v210, v209]` → `[v210]`). **Kural: SW yaşam döngüsü iddiasını tek turda kapatma — beklenen sonuç çıkmazsa önce yöntemin o kod yolunu gerçekten çalıştırdığını kanıtla.**
- **Bir ata `overflow:hidden` ise, dokunma hedefini KUTUSUYLA DEĞİL KIRPILDIKTAN SONRAKİ HÂLİYLE ölç.** v202'de `.add-btn`'in 44×44 geçtiği "ölçüldü" ve yazıldı; oysa `::after` katmanının kutusu 44×44 olsa da kartın `overflow:hidden`'ı onu kesiyordu — gerçek hedef **30×44**'tü ve buton görünür şekilde ikiye bölünmüştü. **10 gün** kimse fark etmedi, kullanıcı bildirdi. Doğru ölçüt: `min(hedef.sag, ata.sag) − max(hedef.sol, ata.sol)`. Aynı mantık görünürlük için de geçerli — "öğe var ve boyutu doğru" ≠ "öğe görünüyor".
- **CSS'te `position` ezmesi sessizdir ve YÖNÜ TERSİNE ÇEVİRİR.** `.add-btn { position:absolute; right:8px; bottom:8px }` sonradan gelen bir `position: relative` listesiyle ezilince `right:8px` öğeyi 8px **SOLA**, `bottom:8px` 8px **YUKARI** kaydırdı (relative ofsetler adı verilen kenarın tersine iter). Hata mesajı yok, uyarı yok, yalnızca yanlış yerde bir düğme. **Ortak bir yardımcı kural (`position: relative` listesi gibi) yazarken, listedeki hiçbir öğenin KENDİ konumlandırması olmadığını doğrula** — burada 15 sınıftan yalnızca `.add-btn`'in vardı ve tek kurban oydu.
- **Satır içi olay özniteliğinde tırnak kaçışı: şablon dizesinde ÇİFT ters bölü gerekir.** `onerror="this.outerHTML='<div class=\'x\'>'"` yazınca JS `\'` → `'` çevirip HTML'e basıyor, öznitelik orada **kapanıyor** ve tarayıcı `SyntaxError` atıyor. Doğrusu `class=\\'x\\'`. Ürün kartında tek, şerit kartında çift yazılmıştı; **görsel yüklenemeyen her kartta yedek HİÇ çizilmiyordu** (kullanıcı boş beyaz kutu görüyordu) ve hata yalnızca `onerror` tetiklendiğinde çıktığı için normal koşulda görünmüyordu. **Aynı işi yapan iki yerin kaçış desenini test karşılaştırsın** — `test_mobil_dokunma` artık bunu yapıyor.
- **Flex öğesinin `min-width` varsayılanı `auto`dur ve `flex-basis`'i EZER.** 2026-08-18: rozet yazısı 11→12px olunca "+%137 CarrefourSA" 131px istedi, kartın iç genişliği 124px'ti — kart `flex:0 0 150px` olmasına rağmen **158px'e büyüdü** ve şerit boyunca kart genişliği tekdüzeliğini kaybetti. Görünür bir "hata" yok, geometri sessizce kayıyor. **Sabit genişlikli her flex kartına `min-width:0` yaz.** Ayrıca genişliği ezen İKİNCİ bir kural olabilir: `.detay-bolum-liste-strip .strip-card` 150px'e pinliyordu, ana sayfa 164'e geçince ürün detayı geride kaldı — testteki "hiçbir kural genişliği ham px ile ezmiyor" iddiası yakaladı.
- **Renk/boyut KORUMA testleri değer token'a taşınınca kırılır — testi zayıflatma, token'ı ÇÖZ.** `test_zam`/`test_supheli` kural gövdesinde ham hex arıyordu; renkler `:root`'a taşınınca kırmızıya döndü. **Anlam değil YÖNTEM bayatlamıştı.** `scripts/css-token.mjs` ile `var(--x)` çözülüp sınanıyor: iddia korundu, üstüne "token gerçekten doğru renge çözülüyor mu" eklendi (test_zam 66 → 68 iddia). **Kural: bir koruma testini yeşile döndürmek için iddiayı gevşetme; iddianın baktığı yeri güncelle, sonra kasten bozup hâlâ koruduğunu KANITLA** (`--rozet-zam-fg` `#DC2626` yapılınca test kırılıyor — denendi).
- **"Okuma kapalı" ≠ "yazma kapalı" — her fiili AYRI ölç.** `fiyat_bildirim`'de anon SELECT `42501` ile kapalıydı ve CLAUDE.md "`anon` hiçbir şey yapamaz" diyordu; oysa **INSERT açıktı** (anon `{"_sid":"x",…}` → 201, satır oluştu). SELECT reddini görüp "kapalı" demek yazmayı hiç sınamamaktı. Bir tabloda güven ölçerken SELECT/INSERT/UPDATE/DELETE + RPC'lerin **her biri** ayrı denenmeli; biri kapalı diğerini garanti etmez. (Denetimin ilk hâli bunu "hız sınırı yok" diye yanlış çerçeveledi — asıl mesele hız değil, kimlik-doğrulamasız yazmaydı.)
- **İstemci `yetki` bayrağını RPC'nin başarı/başarısızlığından TÜRETME.** `_bildirimYetkiVar`, `get_fiyat_bildirimleri` hata vermezse `true` oluyordu; RPC anon'a `200 []` döndüğü için oturumsuz kullanıcıda da `true` olup yazma butonunu açtı. Yetki = **oturum varlığı** (`window.pazarAuth.user`), "sunucu bu okuma isteğine hata verdi mi" değil. Ve boş sonuç ile hata **ayrı dallara** düşmeli — ikisi aynı davranışı üretirse "hata yoksa yetki var" gibi sessiz bir yanlış çıkar. Bir yazma yetkisi kararı yalnızca istemci bayrağına bırakılamaz; **DB policy'si (`with check … = auth.uid()`) asıl sınır**, istemci sadece UX.
- **Koruma testi yazarken YORUMLARI KODDAN AYIR — bu tuzağa İKİ KEZ düşüldü.** (1) `veriTazelikCiz` içindeki "toISOString().slice() YASAK" yorumu, testin `/toISOString\(\)\.slice/` aramasıyla eşleşti. (2) `position:relative` taraması, kuralın üstündeki "`.add-btn` bu listede değil" **açıklama yorumunu** seçicinin parçası sanıp yanlış alarm verdi. Desen ikisinde de aynı: **testin aradığı yasak şeyi, o şeyin neden yasak olduğunu anlatan yorum içeriyor.** Bu depoda yorumlar bilerek uzun, yani risk yapısal. **Kural: kaynakta desen ararken önce `/\*…\*/` ve `//…` soyulacak** (`CSS.replace(/\/\*[\s\S]*?\*\//g,'')`), sonra aranacak. Bir koruma testi ilk yazışta kırmızı veriyorsa, **önce testin kendi metnine bakılacak** — üründe olmayan bir hatayı kovalamadan.
- **Bir tasarım sayısı zevk değil EŞİK olabilir.** Kart genişliğinde 150/164/176/190 ölçüldü: 164, rozetin ikiye bölünmeyi bıraktığı nokta (sarma 8 → 0). Altı sıkışık, üstü sadece görünürlük yiyor (190'da ekrana 2 kart bile sığmıyor, "yandaki kart görünüyor" ipucu kayboluyor). **Genişlik/boşluk kararında "hangisi daha güzel" diye sorma; neyin kırıldığını ölç.**
- **Rozetin ne dediğini KODDAN doğrula.** "%100 pahalı" tuzak rozetini marketler arası fark sandım; `tuzakRozetiHesapla` → `digerPaketleriBul` okununca **aynı ürünün başka paket boyuna göre birim fiyat** farkı olduğu çıktı. Fark önemliydi: "birim fiyat = fiyat ise satırı gizle" kuralım tam da rozetin dayandığı satırı gizliyordu. **Karttan bir bilgiyi kaldırmadan önce, kalan öğelerden hangisinin ona dayandığına bak.**
- **Commit ile test koşusunu aynı komut zincirine bağlama.** `for ... done; echo; git commit` şeklinde zincirlediğim için kırmızı test varken commit geçti (`test_hakmar.mjs` 2 FAIL). Testi **ayrı** koştur, çıktısını gör, sonra commit et.

---

## Yaklaşım & desenler

- **SW cache version** her anlamlı `index.html`/`app.js`/`style.css`/`sw.js` değişikliğinde artırılır (şu an **v215**, canlıda 2026-08-19). Backend-only değişikliklerde (scraper, sync) bump edilmez. Akış: `git add` → `git commit` → `git pull --rebase` → `git push`. Not: `sw.js` yalnızca `data/hal.json` + `data/anasayfa.json`'ı önbelleğe alıyor ve `fetch`'i yalnızca o iki URL için yakalıyor — HTML/CSS/JS'i tutmuyor, onlar Cloudflare'den `Cache-Control: public, max-age=0, must-revalidate` ile geliyor (ölçüldü; eski GitHub Pages `max-age=600` notu bayattı). Bump proje kuralı ve tutarlılık için, HTML dağıtımını hızlandırmıyor.
- **Doğrulama:** Push sonrası `gh run watch` ile deploy'un koştuğu doğrulanır, sonra canlıda (Browser MCP) gerçek fonksiyonel test yapılır — "dosyada var mı" değil, "gerçekten çalışıyor mu". Layout değişikliklerinde ekran görüntüsü yetmez: değişiklikten ÖNCE geometri parmak izi (`getBoundingClientRect`) alınıp sonra sayısal karşılaştırılır.
- **Kapsam disiplini:** İstenmeyen ekleme/çıkarma sessizce yapılmaz, not düşülür. Doküman/analiz önerileri körü körüne uygulanmaz — önce kodda geçerli mi diye bakılır.
- **Büyük ürün/mimari kararları** (hosting migration, nav yapısı, tuzak'ın geleceği) Mustafa'nın onayı olmadan koda dökülmez.
- **Ölçüm önce, kod sonra:** Bir eşik/filtre önerilirse gerçek veride kaç kayıt etkiliyor diye ölçülür. (Fırsatlar için önerilen 400 üst sınırı ölü koddu — kolon 100'le sınırlıydı, gerçek eşik 70 çıktı.)

---

## Araçlar & kaynaklar

- **Claude Code** — dosya düzenlemeleri, git, gh CLI, canlı doğrulama (Windows; PowerShell ve Bash ayrı sözdizimi)
- **Supabase** — auth, DB, Edge Functions, RPC (`get_fiyat_dusenler`, `indirim_puan_toplu_guncelle`, `get_fiyat_bildirimleri`, `jsonb_fiyat_max`)
- **GitHub Actions — `update-data.yml`** (cron `0 3 * * *`, ~20 dk): checkout (`fetch-depth: 0`) → setup-python → pip install → `scraper.py` → `hal_scraper.py` → veri commit+push → **DB Senkronizasyonu** (`sync_db.py`) → **Sahte Indirim Analizi** (`indirim_analiz.py`, `continue-on-error`, başarı damgası `data/indirim_analiz_son.json`) → **Ana Sayfa Şeritleri** (`scripts/anasayfa-uret.mjs`) → **Ana Sayfa Şeritlerini İşle** (commit+push) → **Veri Tazelik Kontrolü** (`scripts/veri_tazelik_kontrol.py`, en son, kırmızıya çevirir). Fiyat alarmı taraması artık AYRI `fiyat-alarm` job'u (`needs: update`, checkout yok, edge function'a `x-cron-secret`'li curl — yan iş yayın yolunu bloke etmesin diye). Secrets: `SEARLO_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`, `CRON_SECRET`.
- **Tetikleyici/iş ararken desen taraması YETMEZ — `.github/workflows/` tek tek listelenip HER dosya okunmalı.** Bu depoda iki tetikleyici desen taramasıyla kaçırıldı: `update-data.yml` içindeki alarm adımı (bir `curl` step'i, ayrı dosya değil) ve `bulten.yml` (grep'in `haftalik-bulten` yakalamadığı ayrı bir workflow — sonuçta iki workflow aynı `name: Haftalik Bulten` ile çakışıyordu). Ders: workflow envanteri için `ls .github/workflows/` + her dosyanın `name:`/`on:`/`run:` bloğunu oku; ayrıca yeni workflow eklerken `name:`'i dosya adıyla eşleştir ki isim çakışması olmasın.
- **GitHub Actions — `deploy.yml`** ("Build ve Deploy"): `push` + **`workflow_run` ("Veri Guncelle" completed)** + `workflow_dispatch`. **Tek job**, `permissions: contents: read`. checkout(`ref: main`) → setup-node **24** → `npm ci` → `npm run build` (`DEPLOY_TARGET=cloudflare`) → **`cloudflare/wrangler-action@v3`** (`wranglerVersion: '4.122.0'` sabit). Secrets: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`. GitHub Pages'e **artık yayınlamıyor**.
- **Cloudflare Workers** — `wrangler.jsonc`: `name: pazar-app`, `main: ./src/worker.js`, `assets: { directory: ./dist, binding: ASSETS, not_found_handling: "none", run_worker_first: true }`, `routes: [{ pattern: "pazarapp.net", custom_domain: true }]`. **`run_worker_first: true` zorunlu** — CSP'nin uygulanmasının tek yolu. `src/worker.js` `env.ASSETS.fetch()` yapıp yanıta CSP header'ı ekliyor.
- **Vite** — `npm run build` = `scripts/anasayfa-uret.mjs` + `scripts/prepare-public.mjs` + `vite build` → `dist/`. **`base: '/'`** varsayılan; eski Pages düzeni için `DEPLOY_TARGET=ghpages`.
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
