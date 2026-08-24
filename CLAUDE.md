# Pazar App — Proje Handoff (Claude için)

**Son güncelleme:** 2026-08-23 (**KVKK HESAP SİLME UÇTAN UCA CANLI** — cascade FK + `hesap-sil` edge function + iki adımlı onaylı UI (`2ecfa41`); gerçek hesapla kontrol gruplu doğrulandı, kalan tek halka **KVKK aydınlatma metni**. Öncesi: BLOK 4 + BLOK 1 geçti, altı FK `ON DELETE CASCADE`, `sql/` repoya alındı; **`style-src`'den `'unsafe-inline'` kaldırıldı**, `script-src` bilinçli ertelendi + satır içi handler kilidi). Öncesi — 2026-08-21/22 oturumu (**güvenlik başlıkları** — `font-src 'self'` + `frame-ancestors 'none'` + nosniff, **HSTS** 1. basamak `max-age=300` → **2026-08-22'de 2. basamak `max-age=86400`**; **CI test kapısı** — `deploy needs: test`, 50 test (glob), kasıtlı FAIL ile kanıtlandı; **B1 kaçış** dört kaçışsız nokta kapatıldı (`test_kacis` 93 iddia); GITHUB_TOKEN varsayılanı read + workflow başına açık `permissions`; Grup 1 (M1/M2/M3/M4); **`www` → apex 301 kuruldu**, CF beacon panelden kapatıldı; fontlar self-host + GoatCounter pin; **KVKK / hesap silme DEVAM EDİYOR** — ölçüm bitti, taslaklar henüz çalıştırılmadı; **sw v232**). Ayrıntı için aşağıdaki "2026-08-21" blokları. Bu dosya her oturum başında okunur, sohbete asla ham metin olarak yapıştırılmaz.

---

## Amaç & bağlam

Mustafa (GitHub: avkkann), **Pazar App**'in tek geliştiricisi — Türk market fiyat karşılaştırma PWA'sı, **`pazarapp.net`** (repo: `avkkann/pazar-app`, yerel yol: `C:\Users\MUSTAFA KARABIYIK\Desktop\pazar-app`). Barındırma **Cloudflare Workers** (2026-08-17'de GitHub Pages'ten taşındı; eski adres `avkkann.github.io/pazar-app` mezar taşı bekliyor). Misyon: gizli zamları, sahte indirimleri, gramaj hilelerini ortaya çıkarmak — A101, BİM, Migros, CarrefourSA, ŞOK, Tarım Kredi, Hakmar. Slogan: **"Marketteki gizli zamları gör."**

**İş akışı:** Dosya düzenlemeleri **Claude Code** ile doğrudan yapılır (Windows, PowerShell + Bash). Eski iki-Claude/OpenCode modeli bırakıldı — artık aynı oturumda hem karar veriliyor hem kod yazılıyor hem canlı doğrulanıyor. SQL şema değişiklikleri hâlâ Supabase SQL Editor'a verilir (Mustafa çalıştırır, Claude çalıştırmaz).

**İletişim tarzı:** Türkçe, kısa, doğrudan. Uzun terimlerden kaçın. Claude kısa gerekçeyle karar verir, seçenek listesi sunmaz — büyük ürün/mimari kararları hariç (onlarda sorar). Mustafa terminal çıktısını olduğu gibi yapıştırır, Claude özetlemeden okur.

**Supabase:** URL `https://gbgxxahhbfnulmyecxia.supabase.co`, region eu-central-1, project ID `gbgxxahhbfnulmyecxia`.

**Test:** iOS + web (masaüstü Chrome). Android kullanılmıyor, test/deploy talimatlarında Android'e referans verilmez.

---

## Mevcut durum (2026-08-21 itibarıyla)

### 2026-08-23 — KVKK / hesap silme: **UÇTAN UCA GEÇTİ — hesap silme CANLI** ✅

**Zincirin tamamı kapandı:** cascade FK (BLOK 1) → `hesap-sil` edge function (deploy) → UI (`2ecfa41`) → **gerçek hesapla canlı silme**. Artık kullanıcı kendi hesabını uygulamadan silebiliyor ve kişisel verisi gerçekten düşüyor.

**KANIT — iki yönlü ve kontrol gruplu:**
- **Taban:** test hesabı altı tabloda **1/1/1/3/1/1 = dokuz satır**; ikinci (dokunulmayacak) hesap **1/0/0/0/0/0**.
- **Silme sonrası:** test hesabı `auth.users`'ta **YOK**, dokuz satırın **hepsi düştü**; **ikinci hesap AYNEN duruyor**. Beş tabloda toplam yetim satır **0**.
- **Yöntem notu (bu turun asıl dersi):** *"sıfır oldu" tek başına yetmez.* Cascade'in **fazla silmediğini** ancak dokunulmayan bir hesabın bozulmadan kalması kanıtlar. Kontrol grubu olmadan "hepsi sıfır" ölçümü, kapsamın çok geniş olduğu bir hatayı da aynı şekilde gösterirdi.

**Edge function `hesap-sil` — canlı, negatif kapıları doğrulanmış:**
- `uid` **caller'ın kendi JWT'sinden** (`getUser()`). Gövde **parse bile edilmiyor** — `req.json`/`req.text`/`req.body`/`searchParams` taraması sıfır eşleşme. Yani body'deki uid *reddedilmiyor*, **hiç okunmuyor**; bu daha güçlü bir güvence.
- **401 kapıları iki katmanlı:** başlıksız ve bozuk JWT → **gateway** (`verify_jwt`); **anon anahtar → BİZİM KOD** (L48–49).
- **Ayrım gövde biçiminden ölçüldü:** gateway `{"code":…,"message":…}`, bizim kod `{"error":"unauthorized"}`. Böylece "hangi kapı tuttu" tahmin değil, ölçüm.
- **"anon anahtar geçerli bir JWT'dir, gateway'i geçer" dersi canlıda doğrulandı** — `verify_jwt` tek başına kullanıcı kapısı değil, asıl kapı kodun kendi `getUser()` kontrolü.

**UI (`2ecfa41`):** iki adımlı onay (bilgilendirme + **yazarak** onay), başarıda **zorunlu `signOut`**, katı hata dalı (`status !== 200 || !govde || govde.ok !== true` → hata; gövde okunamazsa **hata sayılır**). Hata dalında `signOut` yok, mesaj açıkça "verilerin SİLİNMEDİ" diyor.

#### Açık kalanlar (bu turda kapatılmadı, kayda geçti)
1. **`hesap-sil` CORS'u `Access-Control-Allow-Origin: *`** — `https://pazarapp.net`'e daraltılmalı. **CSRF riski yok** (kimlik `Authorization` başlığında taşınıyor, çerezde değil; tarayıcı otomatik göndermez), ama gereğinden geniş.
2. **Edge function silmeyi DOĞRULAMIYOR.** `deleteUser` başarılıysa `{ok:true}` dönüyor; `public.*` tablolarında yetim kalıp kalmadığına bakmıyor. Bugün risk yok (FK'ler kurulu ve `delete_rule=CASCADE` doğrulandı), ama **fonksiyon kendi önkoşulunu kontrol etmiyor** — FK'ler bir gün kaldırılırsa "sildim" der, veri kalır. Dosyanın kendi yorumu da bunu kabul ediyor (index.ts L8–9).
3. ~~**`supabase/functions/hesap-sil/` hâlâ TAKİPSİZ**~~ **KAPANDI (2026-08-24, `a71c02f`).** 64 satırlık kaynak depoya alındı; aynı commit'te bayat `// TASLAK — HENUZ DEPLOY EDILMEDI` yorumu `// CANLI (deploy: 2026-08-23, uctan uca dogrulandi: 2026-08-23)` ile değiştirildi (kod mantığı değişmedi, `--numstat` 1 eklendi / 1 silindi). `supabase/.temp/` engelli KALDI. **Yöntem notu:** `git check-ignore -v` ilk bakışta `.gitignore:60` diye bir kural gösterdi ama o satır **boş** — yanlış alarm; **çıkış kodu esas alınmalı** (`-q` → 1 = engel yok). Sır taraması temiz: üç anahtarın üçü de `Deno.env.get` ile geliyor (L41/L44/L53), gömülü yok.
4. **`on_auth_user_created` / `handle_new_user` hâlâ repoda tanımlı değil** — şemanın bir parçası sürüm kontrolü dışında.
5. **localStorage KARARI (eksik değil, karar):** `pazar_sepet` / `pazar_sablonlar` / `pazar_theme` / `pazar_onboarded` silme sonrası **temizlenmiyor**. Gerekçe: paylaşılan cihazda başkasının listesini silmek geri alınamaz. Onay ekranı bunu **açıkça bildiriyor** ("bu cihazda kalır — hesabına değil, tarayıcına kayıtlı"), yani kullanıcı yanıltılmıyor. Ölçüldü: bu dört anahtarın hiçbirinde e-posta/uuid/jwt yok; kimlik taşıyan tek anahtar SDK'nın `sb-<ref>-auth-token`'ı ve onu `signOut` gerçekten siliyor.

**SIRADAKİ: KVKK aydınlatma metni.** Mekanizma artık oturdu — silme uçtan uca çalışıyor, dolayısıyla metinde "hesabınızı silebilirsiniz" demek artık doğru. Zincirin son halkası bu.

### 2026-08-22 — KVKK / hesap silme: **BLOK 4 ve BLOK 1 GEÇTİ** — cascade CANLI

**BLOK 4 (throwaway rollback testi) GEÇTİ.** Kanıt **iki ayrı koşuda** toplandı, tek koşuda değil:
- `silmeden_once = 6` — altı tablonun her birine satır **gerçekten eklendi**. Bu **kontrol grubu**: 6 görülmeden 0 anlamsızdı, çünkü satırlar hiç eklenmemiş olsa da sonuç 0 çıkardı.
- `silinen_kullanici = 1` — `DELETE FROM auth.users` gerçekten bir satır sildi.
- Sonra altı tablo **ayrı ayrı** sayıldı, hepsi **0** → cascade altısında da çalıştı.
- **Tek başına "0 gördüm" kabul edilmedi.** Bu turun yöntem kuralı: bir silme testinde sıfır, ancak öncesinde sıfır-olmayan bir taban ölçüldüyse kanıttır.

**BLOK 1 (kalıcı FK) GEÇTİ.** Altı FK **kalıcı olarak kuruldu**, `information_schema` sorgusuyla doğrulandı: altısında da `delete_rule = CASCADE`. Constraint adları `*_auth_fk` deseninde (`profiles_id_auth_fk` … `bulten_abonelik_user_id_auth_fk`) — BLOK 4'ün geçici `_t_*` adlarından farklı, çakışma yok.
**BLOK 1'de `BEGIN`/`COMMIT` yok:** altı `ALTER` çıplak ifade olarak koştu, yani her biri kendi örtük transaction'ında **ayrı ayrı kalıcı** oldu (biri patlasa öncekiler geri gelmez). Geri alma yolu dosyada **BLOK 3**'te yorumlu duruyor — FK'ler `DROP CONSTRAINT` ile alınır, ama **cascade'in sildiği veri geri gelmez** (yalnız PITR).

**ÖLÇÜLEN BULGULAR — dördü de yeni, hiçbiri repoda kayıtlı değildi:**
- **`auth.users` üzerinde `on_auth_user_created` trigger'ı VAR** → `handle_new_user` fonksiyonunu çağırıyor, `AFTER INSERT`, ve **`profiles` satırını kendisi açıyor**. BLOK 4'te `INSERT INTO public.profiles` bu yüzden duplicate key'e düşüyordu; `ON CONFLICT (id) DO NOTHING` tam olarak bunun için gerekti.
  **ÖNEMLİ: bu trigger REPODA TANIMLI DEĞİL.** Şemanın bir parçası sürüm kontrolünün dışında duruyor — makine/proje giderse tanımı da gider. (Gövdesi okunmadan repoya eklenmeyecek; ayrı tur.)
- **Supabase SQL Editor yalnız SON sorgunun sonucunu gösteriyor** → çok adımlı bir ölçümde ara sonuçlar sessizce kaybolur. Ölçümü buna göre kur.
- **CTE'ler aynı anlık görüntüyü (snapshot) görür.** `DELETE`'i bir CTE içine alıp sonrasını **aynı** sorguda saymak **YANLIŞ** sonuç verir: sayım silme öncesi görüntüden okur, **6 görünür** ve cascade çalışmamış sanılır. Ölçüm **ikiye bölünmeli** — sil, sonra ayrı sorguda say.
- **`CREATE TEMP TABLE` ile ara sonuç saklamak işe yaramıyor:** editör ifadeleri ayrı bağlantıda koşturabiliyor, geçici tablo aradan kayboluyor.

> **Bu üçü birlikte "ölçüm yanlış, kod doğru" sınıfının yeni vakası.** Cascade baştan beri çalışıyordu; yanlış olan ölçüm düzeneğiydi. Aynı sınıf bu depoda daha önce de görüldü (şablon "Bağlantı hatası" vakası, dokunma hedefi A/C premisleri).

**SIRADAKİ:** edge function deploy → UI → gerçek test hesabıyla canlı uçtan uca silme → KVKK aydınlatma metni.

### 2026-08-21 — KVKK / hesap silme: ölçüm turu *(tarihsel — 2026-08-22'de BLOK 4 ve BLOK 1 geçti, yukarı bak)*

**Durum (o gün):** İki taslak dosya diskte hazırdı, hiçbiri çalıştırılmamış/deploy edilmemiş/commit edilmemişti: `sql/hesap_silme_cascade.sql` ve `supabase/functions/hesap-sil/index.ts`.
**GÜNCEL:** SQL 2026-08-22'de koştu (BLOK 4 + BLOK 1 geçti) ve `sql/hesap_silme_cascade.sql` 2026-08-23'te **repoya alındı**. `supabase/functions/hesap-sil/index.ts` **2026-08-23'te deploy edildi ve uçtan uca doğrulandı** (yukarıdaki 2026-08-23 bloğu) ve **2026-08-24'te depoya alındı** (`a71c02f`) — artık diskte değil, sürüm kontrolünde.

**Amaç:** kullanıcı hesabını silince kişisel verisinin de silinmesi (KVKK silme/unutulma hakkı). Bugüne kadar `handleLogout` dışında bir hesap silme akışı **hiç yoktu**.

**Ölçülen zemin (Mustafa Supabase SQL Editor'de koştu, 2026-08-21):**
- Kullanıcı-verisi tablolarının hiçbirinde `auth.users`'a FK **yok** → cascade sıfırdan kurulacak.
- Altı tabloda da yetim satır **0** (temiz zemin; `ADD CONSTRAINT` takılmaz).
- FK kolonları hepsi `uuid`: `profiles.id`, `favoriler.user_id`, `fiyat_alarmlari.user_id`, `push_subscriptions.user_id`, `fiyat_bildirim.kullanici_id`, `bulten_abonelik.user_id`.
- `bulten_aboneler` **VIEW** (dokunma), `bulten_abonelik` **BASE TABLE** (asıl olan bu).

**Kararlar (değişmez):**
- **DELETE policy EKLENMEYECEK** — ölü tesisat olurdu. Silme cascade + edge function ile yapılacak.
- FK yönü her zaman **child `public.<tablo>` → parent `auth.users(id)`**, asla ters (`auth.users`'a dokunulmuyor).
- Edge function `uid`'yi **caller'ın kendi oturum JWT'sinden** alır (`callerClient.auth.getUser()`), istek gövdesinden **asla** — gövdedeki bir id'ye güvenilse bir kullanıcı başkasının hesabını sildirebilirdi. Silme `service_role` ile ve yalnız doğrulanan o `uid` için (`admin.auth.admin.deleteUser(user.id)`); anahtar yalnız `Deno.env`'de.

**Sıra (KİLİTLİ, atlanmaz) — TAMAMLANDI:** BLOK 0 (bitti) → BLOK 4 rollback testi (**2026-08-22 GEÇTİ**) → BLOK 1 kalıcı FK (**2026-08-22 GEÇTİ**) → edge function deploy (**2026-08-23 GEÇTİ**) → UI (**2026-08-23, `2ecfa41`**) → gerçek hesapla uçtan uca canlı silme (**2026-08-23 GEÇTİ**) → **KVKK aydınlatma metni (kalan tek halka)**. Kilit kuralı ("FK'ler kalıcı geçmeden edge deploy YOK; edge canlı olmadan UI deploy YOK") sırayla uygulandı, hiçbir adım atlanmadı.

**BLOK 4 nedir:** tek transaction içinde 6 FK'yi geçici kur → test kullanıcısı + 6 tabloya birer satır → say (6 beklenir) → `DELETE FROM auth.users` → say (0 beklenir) → **`ROLLBACK`** (dosyada tek `BEGIN`/tek `ROLLBACK`, arada `COMMIT` yok — doğrulandı). Kalıcı iz bırakmaz.

**İş bölümü:** SQL'i **Mustafa** SQL Editor'de koşar (Claude'un DB erişimi yok, açılmayacak). Edge function + UI Claude Code'da yazılır.

### 2026-08-21 — `www.pazarapp.net` yönlendirmesi kuruldu (pano işi, KAPANDI)

Cloudflare panosundan: `www` **CNAME (Proxied)** + **Redirect Rule 301 `www` → apex**, **query string korunuyor**. `www` yazan kullanıcı artık hata almıyor. İkinci bir custom domain olarak **bağlanmadı** — 301 tek kanonik adrese götürdüğü için yinelenen içerik/canonical riski doğmuyor. (Bekleyen listesindeki 6. madde bununla kapandı.)

### 2026-08-21 — Cloudflare Web Analytics beacon'ı panelden kapatıldı

`static.cloudflareinsights.com/beacon.min.js` enjeksiyonu **pano → Web Analytics → Disable** ile **kaynağında** durduruldu; artık sayfaya hiç eklenmiyor, dolayısıyla bloklanacak bir istek de yok. **Karar sabit ve değişmedi: beacon CSP'ye ASLA eklenmeyecek** — analitik GoatCounter'dan geliyor, ikinci izleyici gereksiz.
**Ölçüm sonucu (önemli):** bundan sonraki konsol ölçümlerinde "bilinen CF beacon ihlali" mazereti **artık geçersiz** — konsolda bir CSP ihlali görünüyorsa o gerçek bir bulgudur, geçmiş oturumlardaki gibi göz ardı edilmez.

### 2026-08-20 akşamı (sw v229 → v230) — sepet `_sid` + `.sablon-chip` erişilebilirliği

Bu iki iş 2026-08-20 bloğu yazıldıktan **sonra** girdi, 2026-08-21 hattıyla yayına çıktı:
- **Sepet şemasına `_sid` (additive) + sepet ekranında rozet** (`2524839`, sw v228 → **v229**). Borç yanlış ifade edilmişti: "karşılaştırma ekranında rozetler çalışmıyor" iddiası **çürütüldü** — o ekranlarda rozet hiç yoktu. `_sid` sepet öğesine additive eklendi; eski (`_sid`'siz) öğeler `_id → productMap` ile **tembel backfill** ediliyor ve öğeye yazılıyor, katalogdan çıkmış üründe `null` (rozet çizilmez, sessiz catch yok). Rozet **canlı** üründen hesaplanıyor (sepetteki eski snapshot'tan değil); çift-cache şartı (`_gecmisCache && _puanCache`) — `_puanCache` olmadan şüpheli/gerçek ayırt edilemeyeceği için plain "indirim" gizleniyor. Karşılaştırma ekranı **kapsam dışı**. `test_sepet_rozet.mjs` (12 iddia, prove-by-breaking).
- **`.sablon-chip` klavye erişimi + 44px dokunma hedefi** (`64d93a2`, sw v229 → **v230**). `role="button" tabindex="0" aria-label` + `keydown` (Enter/Space, `addEventListener` — satır içi handler eklenmedi); chip'e kendi `::after` (dikey 44), `.sablon-chip-del`'e ayrı `::after` (32×44) → görsel boyut değişmedi, gerçek hit-test doğrulandı (del merkezi → SİL, chip solu → YÜKLE). A ve C premisleri **bayat çıktı** (zaten kapalıydı) — ayrıntı Teknik borç bölümünde.

### 2026-08-23 — `style-src` `'unsafe-inline'` KALDIRILDI · `script-src` BİLİNÇLİ ERTELENDİ

**Canlı CSP artık `style-src 'self'`.** `script-src`'deki `'unsafe-inline'` **duruyor ve bu bir karar** — aşağıdaki gerekçeye bak.

**Taşınanlar:** 58 satır içi `style="…"` özniteliği CSS sınıflarına (`index.html` 37 + `app.js` 21), 2 `<style>` bloğu harici dosyaya: `<noscript>` bloğu → `static/noscript.css`, hub şablonunun `HUB_STIL` sabiti → `static/hub.css` (`<link>` ile). **HASH KULLANILMADI** — hash her içerik değişiminde elle bakım demek, hub şablon ürettiği için özellikle kırılgan. `element.style` / `cssText` yazımları (84 adet) **CSP'ye tabi değil**, dokunulmadı.

**Ölçümde çıkan asıl engel — `display:none`'ı sınıfa çevirmek 15 öğeyi kıracaktı.** `index.html`'deki 23 gizli öğenin 15'i JS'ten `style.display = ''` (varsayılana dön) ile gösteriliyordu: 6 ana sayfa şeridi + `#home-zam-paylas` + `#mf-ara-btn` + `#msSheetEksik` + 7 `profil-*` bölümü. Gizliliği CSS'e taşıyınca `''` artık onları **gösteremez** — sınıf yerinde kalır, öğe kalıcı kaybolur. Çözüm: `.gizli` sınıfı + JS'te `style.display=''` → `classList.remove('gizli')`, `= koşul ? '' : 'none'` → `classList.toggle('gizli', !koşul)` (27 yazım noktası). **Anlamsal olarak birebir aynı** — öğe yine stylesheet'teki doğal `display`'ini alır; `'block'` gibi sabit bir değere çevirmek layout'u sessizce bozabilirdi.
**`.gizli`'de `!important` YOK ve olmamalı:** kalan 8 öğe `style.display='block'/'flex'` ile gösteriliyor, satır içi değerin sınıfı yenmesi gerekiyor. `!important` eklenirse o sekizi kalıcı gizlenir.

**`script-src` neden ertelendi (karar, ihmal değil):** 117 satır içi olay özniteliği (`index.html` 66 + `app.js` 51) ve 63 farklı fonksiyon delegasyona taşınmalı; en zoru 11 `onerror` (`error` olayı kabarcıklanmaz → capture fazı gerekir). Her etkileşimli yüzeyi elleyen **4–6 turluk** bir iş. Asıl savunma olan çıktı kaçışı (B1) kapalı ve `test_kacis.mjs` 93 iddiayla koruyor; `'unsafe-inline'` ancak bir enjeksiyon noktası varsa istismar edilir.
**SOMUT TETİKLEYİCİ:** *kullanıcı girdisi veya üçüncü taraf içeriği render eden yeni bir yüzey eklenirse* (yorum, inceleme, kullanıcı adı listesi, dış kaynaklı HTML) bu göç öne alınır — ertelemenin dayanağı o an düşer.

**Borç büyümesin diye kilit:** yeni `test_satirici_kilit.mjs` (19 iddia) satır içi handler sayısını **taban 117**'ye kilitliyor; üstüne çıkarsa KIRMIZI. Azalma serbest (göç ilerledikçe taban düşürülür). Ayrıca iki yönlü: `script-src`'den `'unsafe-inline'` habersiz kaldırılırsa da kırmızı (117 handler sessizce ölürdü).

**Guard'lar (ikisi de davranışsal):** `test_cdn_pin.mjs` worker'ı koşturup ürettiği başlığı ayrıştırıyor — `style-src`'de `'unsafe-inline'` YOK, `script-src`'de VAR. Prove-by-breaking 4 kırılma, hepsi kırmızı: index.html'e handler ekle · app.js'e handler ekle · style-src'e `'unsafe-inline'` geri koy · script-src'ten sessizce kaldır.

**Kilidin sayım deseni kendi kontrol grubunu taşıyor:** test her koşuda 13 sentetik örneği sınıflandırıyor (düz/tek tırnak/boşluklu/BÜYÜK harf/şablon tırnağı + `content=` tuzağı, Türkçe `oneri`/`onceki`, `el.onclick = fn`, iç içe `this.onerror=`). Yanlış sınıflandırırsa kaynak dosyalara bakmadan kırmızı olur.

### 2026-08-22 — CSP daraltma: dört ölü font host'u çıkarıldı (ÖNCE ÖLÇÜLDÜ)

`style-src` → **`'self' 'unsafe-inline'`**, `font-src` → **`'self'`**. Çıkanlar: `fonts.googleapis.com`, `fonts.gstatic.com`, `api.fontshare.com`, `cdn.fontshare.com`. Supabase, GoatCounter ve marketfiyati host'larına **dokunulmadı**.

**Yöntem: host listesi CANLI BAŞLIKTAN çıkarıldı, varsayılmadı.** Sunucu taraflı okunan CSP'de 11 dış origin vardı; her biri için "bugün bu origin'e gerçekten istek gidiyor mu" ayrı ayrı ölçüldü (temiz zemin: SW `unregister` + `caches.delete`, sonra uygulama gezildi — anasayfa, kategori, fırsatlar, hal, sepet, profil; ölçüm `performance.getEntriesByType('resource')`).

| Host | Direktif | Ölçüm | Karar |
|---|---|---|---|
| `cdn.jsdelivr.net` | script-src | 1 istek (SDK) | kaldı |
| `gc.zgo.at` | script-src | 1 istek (`count.v5.js`) | kaldı |
| `…supabase.co` | connect-src | 15 istek | kaldı |
| `cdn.marketfiyati.org.tr` | img-src | 3 istek (lazy görseller zorlanınca) | kaldı |
| `pazar-app.goatcounter.com` | img-src + connect-src | beacon `sendBeacon` ile gider, Resource Timing'de **görünmez** → yokluğu kanıt değil | kaldı |
| **`api.marketfiyati.org.tr`** | connect-src | ilk bakışta 0 istek — **ama canlı kod yolu**: `#mf-ara-btn` → `marketfiyatiCanliAra()` → `POST /api/v2/search`. **Buton gerçekten tıklandı, istek gitti, sonuç döndü.** | **kaldı** |
| **`lh3.googleusercontent.com`** | img-src | 0 istek — **ama koşullu**: Google ile girmiş kullanıcının avatarı (`app.js:287`, `user_metadata.avatar_url/picture`). Giriş yapılmadan tetiklenemez. | **kaldı** |
| `fonts.googleapis.com` / `fonts.gstatic.com` / `api.fontshare.com` / `cdn.fontshare.com` | style-src / font-src | **0 istek.** Dört `@font-face`'in dördü de `/static/fonts/*.woff2`; dört woff2 de `pazarapp.net`'ten geldi, dört yüz de `loaded`. | **ÇIKARILDI** |

**En önemli ders — "sıfır istek" ≠ "ölü".** `api.marketfiyati.org.tr` yalnız gözlemle silinseydi canlı arama özelliği kırılacaktı; `lh3.googleusercontent.com` silinseydi girişli kullanıcıların avatarı bloklanacaktı. **Kural: bir host'u silmeden önce (a) çalışma anında sıfır istek VE (b) o host'a çıkabilecek bir kod yolunun olmadığı — ikisi birden gösterilmeli.** Koşullu yollar (giriş gerektiren, butona bağlı) gözlemle asla çürütülemez.

**Guard davranışsal (`test_cdn_pin.mjs`, kaynak grep'i DEĞİL).** Worker'ın `default.fetch`'i sahte bir `ASSETS` ile **gerçekten çalıştırılıp ürettiği `Content-Security-Policy` başlığı** okunuyor, direktiflere ayrıştırılıyor ve "şu URL bu direktifçe izinli mi" diye sorgulanıyor. Böylece CSP nasıl kurulursa kurulsun iddia son çıktıya bakıyor. (Bir önceki turda tam bu kör noktaya düşülmüştü: kaynakta desen aramak, dallardan biri değişince yeşil kalabiliyor.)
- **TDD:** guard önce yazıldı → **KIRMIZI** (8 iddia, `hala su direktifte: style-src` gibi), sonra worker daraltıldı → **YEŞİL (45/45)**.
- **Prove-by-breaking (5 kırılma, hepsi kırmızı):** (1) `fonts.googleapis.com` style-src'e geri geldi; (2) `cdn.fontshare.com` font-src'e geri geldi; (3) **`api.fontshare.com` BAŞKA bir direktife (img-src) gizlendi** — "hiçbir direktifte yok" iddiası bunu da yakaladı; (4) kalan bir host (`api.marketfiyati`) silindi → "KALDI" iddiası kırmızı, yani guard iki yönlü; (5) `frame-ancestors` düşürüldü → kırmızı.

**Ölçüm kirletici notu:** tarayıcı ölçümünde `gc.kis.v2.scr.kaspersky-labs.com` origin'i göründü — Kaspersky sayfaya kendi script'ini enjekte ediyor (yerel AV MITM'i, sitenin kodu değil). Aynı tur sonunda daha kötüsü ölçüldü: **CSP başlığı seçici olarak sıyrılıyor** → tarayıcı-taraflı CSP ölçümü bu makinede geçersiz. Tam kayıt ve kontrol grubu reçetesi: **Araçlar & kaynaklar → "ORTAM — Kaspersky bu makinede araya giriyor"**.

**Geri dönülürse:** dışarıdan font yüklemeye dönülürse **çiftin iki yarısı da** eklenmeli (CSS host'u + woff2 host'u: `googleapis`→`gstatic`, `api.fontshare`→`cdn.fontshare`). 2026-08-17'de ikinci yarı atlandığı için Cabinet Grotesk sessizce Inter'e düşmüştü.

### 2026-08-22 — H4 giriş açık-yönlendirme denetimi: **TEMİZ**, madde KAPANDI

Denetimde hiç ölçülememiş maddeydi. Ölçüldü: **açık yönlendirme yok.** (Bu depoda dört borçtan üçü ölçümde çürümüştü; bu dördüncüsü.)

**Yönlendirme hedefi belirleyen noktaların TAMAMI çıkarıldı ve tek tek ölçüldü:**
- `app.js:247` `signInWithOAuth({redirectTo})` = `window.location.origin + window.location.pathname` — kullanıcı girdisi yok, yapıca aynı-origin. (Canlı bundle'da da böyle olduğu tarayıcıdan okundu, yalnız kaynaktan değil.)
- `?screen=` (`app.js:5845`) **sabit obje allowlist'i**, bilinmeyen değer → `screen-home`; `?kat=` `KATEGORILER.some(slug===kat)` ile doğrulanıyor. İkisi de URL'e değil ekrana çözülüyor.
- `window.open` üç yerde, üçünde de host sabit (`https://wa.me/?text=` + `encodeURIComponent`).
- `src/worker.js`'te yönlendirme kodu **yok**; `index.html`'de `http-equiv="refresh"` yok, tek satır içi script tema ayarlıyor.
- `app.js`'te `href=` **sıfır** tane (dinamik link üretimi yok); `location` geçen yalnızca 5 satır var, beşi de okundu.
- Tek `message` dinleyicisi `navigator.serviceWorker` üzerinde ve `type==='DATA_UPDATED'` dışını dönüyor — navigasyon yok.

**Taramanın kör noktası kontrol grubuyla kanıtlandı.** `app.js` kopyasına 7 yapay sink eklendi; üç grep'in birleşimi 6'sını yakaladı. Yakalanmayan tek sınıf: **`window['loc'+'ation'].href`** (parçalı string özellik erişimi). O sınıf ayrıca tarandı (`window[` / `self[` / `globalThis[` / `document[` + `'loc'`/`'ation'`/`'hre'` parçaları) — **dört dosyada sıfır eşleşme**. Yani kör nokta gerçekten boş, "grep görmedi" değil.

**Çalışma anı ölçümleri (kaynak okumakla yetinilmedi):**
- **`www → apex` 301:** `//evil.example.com` → `https://pazarapp.net/evil.example.com` (çift eğik çizgi tek'e iniyor, **protokol-göreli kaçış yok**); `?next=https://evil…` host'u değiştirmiyor. Hedef host sabit yazılmış.
- **Supabase `/auth/v1/verify` — kontrol gruplu, belirleyici:** allowlist'li `https://pazarapp.net/` **onurlanıyor**, `https://evil.example.com/` **Site URL'e düşüyor**. İki çıktı farklı → parametre yok sayılmıyor, **doğrulanıyor**. Atlatma denemelerinin hepsi apex'e düştü: `pazarapp.net@evil…` (userinfo), `evil…/#https://pazarapp.net` (fragment), **`pazarapp.net.evil.example.com` (sonek — naif prefix eşleşmesi olsa geçerdi)**, `//evil…`, `http://pazarapp.net/`. `javascript:` GoTrue'ya varmadan Cloudflare'de **403**. Onurlanan kontrol: `https://pazarapp.net/derin/yol?a=1` aynen korunuyor → `/**` joker'i çalışıyor, test anlamlı.
- **OAuth dalı ayrıca uçtan uca:** `authorize` ile flow açılıp dönen `state`, `/auth/v1/callback?state=…&error=access_denied` ile geri verildi. Allowlist'li derin yol onurlandı, `evil.example.com` Site URL'e düştü. Yani **e-posta yolu ve OAuth yolu ayrı ayrı** ölçüldü.
- **Gerçek tarayıcıda:** `pazarapp.net`'e aynı anda beş yönlendirme parametresi (`next`, `redirect=//evil…`, `returnTo`, `url`, `continue`) verildi — origin değişmedi, hiçbiri tüketilmedi, yalnız `screen=profil` çalıştı; `screen=https://evil…` → `screen-home`.

**KARAR — `www` Supabase allowlist'inde YOK, ve öyle kalacak.** Bu bir eksik değil: kullanıcı `www`'ye gelse bile Cloudflare 301'i onu apex'e taşıyor, yani auth her zaman apex origin'inde başlıyor. Allowlist'i dar tutmak (tek origin) doğru olan. **Sonuç: auth linkleri apex üzerinden üretilir; `www` tabanlı bir auth akışı kurulmayacak.** Kurulursa sessizce Site URL'e düşer — o yüzden bu satır uyarı olarak burada.

**`_guvenliUrl` teyidi:** dokuz kullanımın **hepsi `<img src="...">`**; navigasyon üreten hiçbir yerde kullanılmıyor. Zaten şema sınırlayıcı — kendi doküman yorumu da "URL'nin nereye gittiğini denetlemez, yalnızca ŞEMAyı sınırlar" diyor. Yani H4 için ilgili değil, karıştırma.

**Tek gerçek sertleştirme: `sw.js` `notificationclick` origin kapısı** (aşağıdaki blok).

**ÖLÇÜLEMEYEN SINIR (dürüst kayıt):** (1) Tam bir **Google OAuth turu gerçek hesapla tamamlanmadı** — `callback` dalı `error=access_denied` ile sürülerek ölçüldü; yönlendirme kararını veren kod yolu aynı ama "başarılı giriş" varyantı ampirik denenmedi. (2) **Supabase panosundaki Redirect URLs listesi gözle görülmedi** — davranışı dışarıdan ölçüldü. Bu iki boşluk kapanmadan "allowlist'te ne yazıyor" sorusuna kaynak-doğruluğunda cevap verilemez.

### 2026-08-22 — `sw.js` notificationclick origin kapısı (bulgu değil, sertleştirme)

Push yükündeki `data.url` doğrudan `clients.openWindow`'a gidiyordu; **doğrulama yoktu**. Bugün istismar edilebilir değil (sunucu sabit `"./"` yolluyor — `fiyat-alarm-scan/index.ts:109` — ve push göndermek VAPID özel anahtarı ister), ama yüke bir gün dinamik url konursa dış origin'e pencere açardı. Kapı: `new URL(ham, self.location.origin).origin === self.location.origin` değilse `"./"`.

- **Sessiz yutma yok:** dış origin reddi ve URL ayrıştırma hatası **ayrı dallarda**, her biri `console.warn` ile iz bırakıyor.
- **Guard: `test_sw_origin.mjs` (28 iddia).** Kaynağı regex'lemiyor — `sw.js` **gerçek kaynağı** `node:vm`'de sahte bir ServiceWorkerGlobalScope içinde koşturuluyor, `notificationclick` handler'ı yakalanıp çağrılıyor. Mantık kopyalanmıyor.
- **TDD:** guard önce yazıldı → KIRMIZI (8 iddia düştü) ve **gerçek sızıntıyı gösterdi**: mevcut kod `https://evil.example.com/`, `//evil.example.com`, `javascript:alert(1)` ve ayrıştırılamaz URL'i olduğu gibi `openWindow`'a geçiriyordu. Kapı eklendi → YEŞİL.
- **Prove-by-breaking, guard'ın KENDİ kör noktasını buldu.** İlk sürümde "görünür iz var" iddiası kaynakta `console.warn` arıyordu; red dalındaki warn silinince **guard yeşil kaldı** (EXIT=0). İddia davranışsal hale getirildi (vm içinde `console.warn` kaydediliyor) + **kontrol grubu** eklendi (meşru url uyarı ÜRETMEMELİ). Sonra beş kırılmanın hepsi kırmızı verdi: kapı kaldırıldı (7 kırmızı), prefix eşleşmesine zayıflatıldı (3 kırmızı — sonek hilesi yakalandı), red dalı warn'ı silindi, catch dalı warn'ı silindi, koşulsuz warn eklendi.
- **Cache sürümü bump'ı GEREKMİYOR — ölçüldü, varsayılmadı.** (a) `CACHE_NAME` yalnız `DATA_URLS` (2 JSON) + `FONT_URLS` (4 woff2) içeriğini yönetiyor; `sw.js` kendisi bu listelerde **yok**, o cache'ten servis edilmiyor. (b) Canlı başlık sunucu-taraflı okundu: `sw.js` → `Cache-Control: public, max-age=0, must-revalidate` + `ETag` → bayt değişince tarayıcı yeni SW'yi indirip kuruyor. (c) Hiçbir test belirli bir sürüme çivilenmemiş (`test_hub_footer.mjs:230` yalnız `pazar-cache-v(\d+)` deseni arıyor). Bump edilseydi her kullanıcıda ~171KB font + 2 JSON boşuna silinip yeniden inecekti. **sw v232 KALDI.**

### 2026-08-22 — HSTS kademeli rollout, 2. BASAMAK: max-age=86400 (1 gün)

`src/worker.js`: `max-age=300` → **`max-age=86400`**. **includeSubDomains ve preload YİNE EKLENMEDİ** — kademeli plan bozulmadı.
- **Neden şimdi:** 1. basamak (300 sn) 2026-08-21'de canlıya çıktı ve sorunsuz çalıştı. Sıra: 5 dk → **1 gün** → 1 hafta → daha uzun.
- **includeSubDomains neden hâlâ yok:** `www` yönlendirmesi artık kurulu ama **subdomain envanteri tek tek ölçülmedi**. Bu bayrak bugün var olmayan, yarın açılacak subdomain'leri de HTTPS'e kilitler ve `max-age` dolana kadar geri alınamaz. Önce max-age basamakları, sonra envanter ölçümü, en son bu bayrak. **preload neden yok:** listeye girmek aylarca geri alınamaz.
- **Neden 1 gün hâlâ güvenli:** yanlış giderse tarayıcı kilidi `max-age` kadar sürer. 1 gün kurtarılabilir bir pencere; 1 yıl değil.
- **Guard** (`test_cdn_pin.mjs`): basamak değeri **tek yerde** sabitli (`max-age=86400`), includeSubDomains/preload YOK iddiaları aynen duruyor. **TDD ile yapıldı:** önce guard 86400'e çekildi → KIRMIZI (`gelen: "max-age=300"`), sonra worker.js değişti → YEŞİL (21/21).
- **Prove-by-breaking (4 kırılma, hepsi kırmızı verdi, sonra geri alındı):** (1) yanlış basamak `3600` → kırmızı; (2) `includeSubDomains` eklendi → kırmızı; (3) `preload` eklendi → kırmızı; (4) HSTS satırı komple silindi → kırmızı. Yani guard hem değeri hem de iki yasak bayrağı gerçekten koruyor.

### 2026-08-21 — HSTS kademeli rollout, 1. BASAMAK: max-age=300 (CANLI, DOĞRULANDI) — *2026-08-22'de 2. basamağa geçildi, yukarı bak*

`src/worker.js`'e `Strict-Transport-Security: max-age=300` eklendi (`2f23925`). **SADECE max-age=300; includeSubDomains YOK, preload YOK** — bilinçli kademeli plan.
- **Neden kademeli:** HSTS tarayıcıya "bu siteye artık SADECE HTTPS" der; yanlış giderse (bir subdomain HTTP'de, sertifika sorunu) kullanıcı siteye HİÇ giremez ve **geri alınamaz** — max-age dolana kadar tarayıcıda kilitli. 5 dk = risk 5 dakikaya iniyor. Sorunsuz görülünce ayrı turlarda 1 gün → 1 hafta → daha uzun.
- **includeSubDomains neden yok:** yazıldığı anda `www.pazarapp.net` yönlendirmesi yoktu ve tüm subdomain'lerin HTTPS olduğu doğrulanmamıştı. **GÜNCELLEME (aynı gün, sonra):** `www → apex` 301 kuruldu (yukarıdaki `www` bloğuna bak), ama `includeSubDomains` **yine de eklenmedi** — `max-age` hâlâ 1. basamakta (300 sn) ve subdomain envanteri tek tek ölçülmedi. Kademeli plan sırasını bozma: önce `max-age` basamakları, sonra ölçüm, en son `includeSubDomains`. **preload neden yok:** preload listesi aylarca geri alınamaz, asla acele.
- **Guard** (`test_cdn_pin.mjs`): HSTS var + `max-age=300` + includeSubDomains YOK + preload YOK. Prove-by-breaking doğrulandı (includeSubDomains/preload eklenirse ya da HSTS silinirse KIRMIZI) → erken kilitlenme yayına gitmeden yakalanır. İleride max-age artınca guard'ın o satırı bilerek güncellenecek. **(Öyle oldu: 2026-08-22'de guard `max-age=86400`'e çekildi — güncel değer için yukarıdaki 2. basamak bloğu esas.)**
- **Doğrulama:** canlı başlık sunucu-taraflı okundu (`Server: cloudflare`, CF-RAY): `Strict-Transport-Security: max-age=300`, includeSubDomains/preload YOK. ✅ (Kaspersky yerelde 499/MITM ile kestiği için header inspector üzerinden.)

### 2026-08-21 — Grup 1: dört küçük düşük-riskli iş (M1/M3/M4 + M2 hepsi CANLI/DOĞRULANDI)

Her madde AYRI commit (biri bozulursa tek revert). superpowers + tasarım maddelerinde ui-ux-pro-max kullanıldı.

- **M1 — tanınmayan market kodu uyarısı** (`e51937f`). `scraper.py parse_product`: market kodu `BILINEN_MARKET_KODLARI` (app.js:654 MARKET_NAMES ile aynı: a101/bim/carrefour/migros/sok/tarim_kredi/hakmar) dışındaysa gece koşusu log'una tek satır `[UYARI] taninmayan market kodu: <kod>`. Dedup: kod ilk görülüşünde. Sessiz yutma yok. Kaçış birincil savunma; bu erken uyarı.
- **M3 — üç tasarım borcu, tek commit** (`f962b51`). (a) `.search-box svg` ikon diline alındı: `stroke-linecap/linejoin: round` (büyüteç sapı köşeli→yuvarlak). (b) og-image alt metninden `· hal fiyatı` çıkarıldı → "7 zincir market · günlük fiyat"; PNG yeniden üretildi (uygulama hal/market karşılaştırmasını bilerek öne çıkarmıyor). (c) `modalSlideUp` easing `--ease-out` → `--ease-giris` (rol ayrımı; ikisi de ease-out ailesi). sw.js bump YOK (og-image/style.css precache'te değil). Öncesi/sonrası görsel Mustafa'ya iletildi.
- **M4 — apple-touch-startup-image** (`8592856`). iOS ana ekrana eklenince açılış görseli yoktu. `scripts/splash-uret.mjs` (Chrome headless, og ile aynı desen) 11 iPhone çözünürlüğünde marka splash üretiyor (koyu yeşil + krem "Pazar"); index.html'e cihaz-eşlemeli 11 `<link rel="apple-touch-startup-image">`. Medya sorgusu eşleşmezse iOS göstermez (regresyon yok). sw.js bump YOK (iOS natif yükler). **iPhone'da test edilecek.**
- **M2 — Node sürüm hizalama: HİZALANDI + DOĞRULANDI** (`844183f`). update-data.yml `node-version: '20'`→`'24'` (deploy.yml zaten 24; artık `anasayfa.json` tek Node majöründe üretiliyor). ÖLÇÜM (yerelde, aynı girdi, `uretim` normalize): Node 20.20.2 vs 24.18.0 → **bayt bayt AYNI** (SHA256 `310c843e…`, 153.838 B); ICU/localeCompare dahil çıktı Node-sürümünden bağımsız. Hizalama sonrası doğrulama (gece koşusu beklemeden, mevcut mekanizmayla): (1) canlı deploy koşusunun `setup-node@v4 '24'` adımı **node v24.19.0** kurdu ([run 32477517505]) — aynı aksiyon/sürüm update-data'da da; (2) yerelde Node 24 çıktısı Node 20 ile yine bayt bayt aynı. "Aynı türetilmiş dosyanın iki motoru" borcu kapandı.

### 2026-08-21 — GITHUB_TOKEN yetkileri kısıldı: workflow başına açık permissions + varsayılan READ (TAM KAPANDI, canlı kanıtlı)

Depo varsayılanı `default_workflow_permissions: write` idi; açık blok yazmayan 3 workflow bunu (write-all) miras alıyordu. Her workflow'a gerçek ihtiyacı kadar yetki (commit `9169e66`):
- `deploy.yml` → `contents: read` (zaten vardı; deploy commit atmıyor)
- `update-data.yml` → `contents: write` (data/ + anasayfa.json commit+push)
- `il-marketler.yml` → `contents: write` (il_marketler.json commit+push)
- `haftalik-bulten.yml` → `permissions: {}` (yalnızca Edge Function'a curl; GITHUB_TOKEN kullanmıyor, secret'lar bağımsız)

Açık bloklar depo varsayılanını **EZER** → varsayılan read'e çekilse de gecelik hat kırılmaz.

**Doğrulama (yeşil ekran yetmez):**
- `deploy.yml` `contents: read` → push sonrası deploy YEŞİL ([run 32473793545](https://github.com/avkkann/pazar-app/actions/runs/32473793545)).
- `il-marketler` elle tetiklendi → GERÇEK commit düştü (`4b179b8` "Il market haritasi guncellendi", GitHub Actions, 10:50Z, [run 32473932125](https://github.com/avkkann/pazar-app/actions/runs/32473932125)) → `contents: write` commit+push'a **yetiyor**. ✅

**Depo varsayılanı READ'e çekildi + override CANLI KANITLANDI (2026-08-21, TAM KAPANDI):**
- `gh api -X PUT … default_workflow_permissions=read` → okundu, `read` döndü. Artık açık blok yazmayan gelecekteki bir workflow write-all miras alamaz.
- **Kanıt (açık `contents: write` bloğu, varsayılan READ iken de push ediyor):** (1) `il-marketler` varsayılan read'e çekildikten SONRA elle tetiklendi ([run 32483142391], 12:42Z), gerçek commit pushladı → **`a0e2796`** "Il market haritasi guncellendi" (12:49Z, GitHub Actions). (2) Ek/bağımsız teyit: geçici `perm-probe` workflow'u (açık contents:write) throwaway dala boş commit pushladı; sonra workflow + dal silindi. → "açık blok varsayılanı EZER" kararı canlı doğrulandı.
- **Not (zamanlama):** bugünkü `update-data` nightly'si (03:54Z) permissions commit'inden (`9169e66`, 10:41Z) ÖNCE koştuğu için eski write-all default'unu kullandı; yeni blok kanıtı yukarıdaki il-marketler + probe'dan geldi. Yarınki nightly yeni blok + default read altında çalışacak (ilk üretim koşusu).
- `haftalik-bulten` **hiç elle tetiklenmedi** (bilinçli): fonksiyon her yetkili çağrıda `bulten_aboneler`'deki HER aboneye Resend ile e-posta yolluyor → program dışı spam riski. `permissions: {}` curl'ü etkilemez (GITHUB_TOKEN kullanmıyor, secret'lar bağımsız), YAML geçerli/deploy parse etti — ampirik tetikleme gereksiz, yapılmadı.

### 2026-08-21 — İş 3: CSP başlıkları — font-src 'self' + frame-ancestors 'none' + nosniff (CANLI, BAŞLIK DOĞRULANDI; gizli-sekme konsol onayı Mustafa'da)

`src/worker.js`'e üç değişiklik (tek deploy, [run 32467193580](https://github.com/avkkann/pazar-app/actions/runs/32467193580)):
- **`font-src 'self'` eklendi — GERÇEK blok açıldı.** Inter self-host'a geçince (v232) `font-src`'ye `'self'` eklenmesi atlanmıştı; `index.html:50` `/static/fonts/inter-latin.woff2`'yi (aynı-origin) preload ediyor, `'self'` olmadan CSP bunu blokluyordu. Mustafa'nın gizli sekmesinde ölçüldü: "Loading the font violates font-src ... blocked" kırmızısı. Kozmetik değil.
- **`frame-ancestors 'none'`** — clickjacking'e karşı sertleştirme. Ölçüldü: gerçek uygulamada `<iframe>` yok, hub sayfaları/PWA iframe kullanmıyor, OAuth redirect tabanlı; `_tasarim_taslak/` deploy edilmiyor. Meşru iframe kullanımı olmadığı için `'self'` değil `'none'` (en sıkı doğru). X-Frame-Options eklenmedi (frame-ancestors modern eşdeğeri).
- **`X-Content-Type-Options: nosniff`** eklendi.
- **HSTS bilerek DIŞARIDA** — geri alması zor; ayrı, kademeli turda konuşulacak.

**Ölçüm dersi (kök neden — ilk ÖLÇÜM 3'ün kör noktası):** İlk CSP ölçümü `worker.js` kaynağını canlı başlıkla karşılaştırdı ve HSTS/frame-ancestors/nosniff eksiklerini yakaladı, ama **self-host edilen varlıkların `'self'` gerektirdiğini çapraz kontrol etmedi** → `font-src 'self'` eksiğini kaçırdı. Mustafa gizli-sekme konsolundan yakaladı. **Ders: CSP denetiminde her direktifi yalnızca "canlıda var mı" diye değil, "uygulamanın gerçekten yüklediği kaynak bu direktifçe izinli mi" diye de ölç — özellikle self-host font/script/img.**

**Doğrulama:** Canlı başlıklar sunucu-taraflı header inspector ile teyit edildi (`Server: cloudflare`, `CF-RAY`): `font-src 'self' …`, `frame-ancestors 'none'`, `X-Content-Type-Options: nosniff` hepsi canlı; bu deploy anında HSTS yoktu (aynı gün ayrı turda `2f23925` ile eklendi, yukarı bak). **AÇIK KALAN adım (Mustafa):** gizli sekmede (SW yok) pazarapp.net aç, konsol TEMİZ olmalı — font-src ihlali KAYBOLMALI. (Claude yerelden ölçemiyor: Kaspersky pazarapp.net'i 499/MITM ile kesiyor; başlık sunucu-taraflı teyit edildi ama tarayıcı-konsol onayı Mustafa'da.) **Beacon notu artık geçersiz:** CF Web Analytics aynı gün panelden kapatıldı → beacon sayfaya hiç enjekte edilmiyor, konsolda o ihlal **beklenmiyor**. Konsolda hâlâ bir ihlal görünüyorsa mazeret değil, bulgudur.

~~**AÇIK — CSP daraltma YAPILMADI (ölçüldü 2026-08-21).**~~ **2026-08-22'de KAPANDI** — `49fd871` yalnızca `'self'` eklemiş, hiçbir host çıkarmamıştı; daraltma ayrı tur olarak yapıldı. Ayrıntı: aşağıdaki "CSP daraltma" bloğu.

### 2026-08-21 — Şablon kaydetme "Bağlantı hatası" bug'ı: yanlış slug kaynağı + yalan hata mesajı (DÜZELTİLDİ)

**Belirti:** Ana sayfa şeritlerinden (düşenler/zam/mevsim) eklenen bir ürünü şablona kaydederken "Bağlantı hatası — Ürün verileri yüklenemedi. İnternet bağlantınızı kontrol edin." çıkıyordu. Kategori ekranından eklenen ürünlerde sorun yoktu.

**Kök neden (ölçüldü, ağ DEĞİL):** Şablon slug'ı `_id`'den türetiliyordu (`_id.split('_').slice(0,-1)`). Ama `_id` biçimi tutarsız: kategori ürünlerinde `<slug>_<index>` (geçerli slug verir), ana sayfa şerit ürünlerinde `<ad>_<gramaj>` (geçerli slug DEĞİL, ürün adı). Geçersiz slug → `KATEGORILER.find` `undefined` → `_loadCatGetir` içindeki `catch` bloğu `kat.file`'a **ikinci kez** dokunup `TypeError` fırlatıyor → çağıran bunu "Bağlantı hatası" diye **yanlış etiketliyordu** (bu depoda 5. kez görülen "yanlış sebep gösterme" deseni).

**Ölçüm (yerelde — Kaspersky canlıyı 499 ile engelliyor):** Ana sayfa 218 şerit ürününün **218'inde `_sid` dolu** ve `_sid.split('_')[0]` **218/218 geçerli** KATEGORİLER slug'ı veriyor. `ana_kategori` ise görünen ad ("Çikolata", "Ağız Bakım"…), slug'la eşleşmiyor — doğrudan kullanılamaz (ancak `ustKategori()` ile çevrilebilir).

**Düzeltme:**
1. Tek `urunKategoriSlugu(u)` yardımcısı — fallback zinciri `_sid` (birincil) → `_id` (yalnızca zaten `slug_index` ise) → `ana_kategori`+`ustKategori()`, her adım `KATEGORILER.some` ile doğrulanır, çözülemezse `null`. İki kopya (`sablonKaydet` + `sablonKaydetUI`) bu tek fonksiyona indirildi (üçüncü kopya doğamaz).
2. `_loadCatGetir` geçersiz slug'da **ayırt edilebilir** hata fırlatıyor (`err.kod='GECERSIZ_KATEGORI'`) — sessiz boş dönmüyor.
3. `_yuklemeHataModali(e)` mesajı gerçek hata sınıfıyla eşliyor: "Bağlantı hatası / internetinizi kontrol edin" **yalnızca** gerçek ağ hatasında (`TypeError` + fetch); geçersiz kategori ve diğer hatalar ayrı mesaj.

**CI boşluğu (ders):** 49 test yeşilken canlıda kırıktı çünkü `test_tembel.mjs` `KATEGORILER`'i **stub'lıyor** ve `loadCat`'i yalnızca geçerli slug ("et") ile çağırıyordu — geçersiz-slug → TypeError yolu hiç test edilmiyordu. Yeni `test_sablon_slug.mjs` boşluğu kapatır: **gerçek** `KATEGORILER` (app.js'ten çıkarılır) + gerçek slug türetme + gerçek `loadCat`, ana sayfa biçimli `_id` VE kategori biçimli `_id` ile. Üç düzeltmenin her biri prove-by-breaking ile doğrulandı (kaldır → kırmızı). **Genel kural: bir birimi stub'larken, o stub tam da bug'ın yaşadığı yeri maskeliyorsa test kördür — gerçek veriyi kullan.**

### 2026-08-20 — Güvenlik kapanışları (B1/B2/B5) + Edge Function zamanlayıcıları + splash (CANLI)

**sw v228.** Bu oturumda üç güvenlik hattı kapandı, Edge Function altyapısı kuruldu, splash/mobil düzeltildi. (Repo PUBLIC — kapanmış zafiyetler "kapandı" diye yazılı; açık kapsam ayrıntısı yok.)

**B1 (XSS — çıktı kaçışı): tam yeniden tarama, kaçış tarafı KAPANDI.** Düzeltilmiş yorum-soyucuyla (satır-yorumları önce) üç parti yeniden tarandı; kalan tek DOM sink (arama sorgusu echo'su) merkezî kaçış yardımcısına alındı. `test_kacis.mjs` **86 iddia** (q echo guard dahil), kasten bozularak doğrulandı.

**B2 (fiyat_bildirim): TAMAMEN KAPANDI.** DB policy + istemci kapısı (önceki oturum) + **hız sınırı trigger'ı canlıda kurulu ve doğrulandı** (`sql/fiyat_bildirim_hiz_siniri.sql`): aynı ürün+market 24s içinde tekrar → HTTP 409/`PT409`; kullanıcı-günlük tavan (30) aşılınca → HTTP 429/`PT429` (SECURITY DEFINER, `search_path=''`). İstemci (`app.js`) PT409/PT429'u ayırt edip **dostane** mesaj gösteriyor (hata görünümü yok), İngilizce RAISE metni kullanıcıya gösterilmiyor; PT409'da localStorage soğuması da güncelleniyor. `test_bildirim_yetki.mjs` eşlemeyi kanıtlıyor.

**B5 (CDN tedarik zinciri): sürüm pin + SRI, tedarik zinciri saldırısı KAPANDI.** `index.html` Supabase SDK `<script>`: `@2` (kayan) → **`@2.112.3`** (tam sürüm) + `integrity` sha384 (indirilen dosyadan) + `crossorigin`. CDP ile doğrulandı; **negatif kontrol:** hash bozulunca tarayıcı betiği reddediyor. `test_cdn_pin.mjs` kayan sürüme/eksik integrity'ye dönerse kırmızı. Self-host artık güvenlik değil erişilebilirlik işi.

**Edge Function'lar (repoya alındı + güvenli + deploy edildi).** `supabase/functions/` (`.temp/` gitignore'lu; gömülü sır yok, hepsi `Deno.env.get`). `haftalik-bulten` (Resend e-posta; alıcı+içerik DB/sunucu tarafı) ve `fiyat-alarm-scan` (Web Push; fiyatı `raw.githubusercontent`'ten okur). Her ikisine **paylaşılan gizli başlık kapısı**: `x-cron-secret == CRON_SECRET`, sabit-zamanlı karşılaştırma, tanımsızsa da 401 (güvenli varsayılan), asıl iş başlamadan. **Deploy + canlı doğrulandı** (başlıksız/yanlış → 401; doğru → 200, yan etki yok). Tetikleyiciler: `fiyat-alarm-scan` → `update-data.yml` içinde **ayrı `fiyat-alarm` job'u** (`needs: update`); `haftalik-bulten` → **`haftalik-bulten.yml`** (cron `0 15 * * 5` = Cuma 15:00 UTC + `workflow_dispatch`). Eski çakışan `bulten.yml` **silindi** (iki workflow aynı `name` + aynı fonksiyon). Curl'ler artık teşhis edilebilir (kod+gövde loglanıyor). GitHub `CRON_SECRET` secret'ı **Supabase'deki değerle aynı olmalı**.

**Splash + mobil.** Claude Design splash → vanilla (token-bağlı, reduced-motion, `_tasarim_taslak/` gitignore'lu); çizelge ~2.36s → ~1.2s, kapanma = max(animasyon bitti, veri hazır), KİLİT 4000ms; rozet `--fs-1` (12px), mühre yaklaştırıldı. iPhone çift-tık zoom (`overflow-x: clip`) ve arama sonucu below-fold konumu düzeltildi.

**Kalan işler (sıralı, gerekçeli):**
1. ~~**YARIN KONTROL (2026-08-21):** gecelik koşuda `fiyat-alarm` job'u yeşil mi~~ **KONTROL EDİLDİ — YEŞİL (2026-08-21).** İlk gerçek zamanlanmış koşu 03:54Z'de döndü: [run 32445055637](https://github.com/avkkann/pazar-app/actions/runs/32445055637) → `update: success`, **`fiyat-alarm: success`**. Yani GitHub `CRON_SECRET` = Supabase değeri ve zamanlanmış yol elle curl olmadan da çalışıyor. Bu madde kapandı.
2. ~~**Giriş yönlendirme (H4)** — hiç ölçülemedi~~ **ÖLÇÜLDÜ ve KAPANDI (2026-08-22): TEMİZ, açık yönlendirme yok.** Tüm yönlendirme noktaları çıkarıldı, taramanın kör noktası kontrol grubuyla kanıtlandı, `www` 301'i + Supabase `verify` ve OAuth `callback` dalları + gerçek tarayıcı ile çalışma anında denendi. Tek sertleştirme `sw.js` origin kapısı oldu (bulgu değil). **Ölçülemeyen sınır:** gerçek Google turu tamamlanmadı, pano Redirect URLs listesi gözle görülmedi. Ayrıntı: yukarıdaki "H4 giriş açık-yönlendirme denetimi" bloğu.
3. ~~**Font + GoatCounter kaynakları pinsiz/SRI'siz**~~ **TAMAMEN KAPANDI.** (a) GoatCounter (2026-08-21, sw v231): `//gc.zgo.at/count.js` → **`https://gc.zgo.at/count.v5.js` (frozen) + SRI + crossorigin**. (b) **Fontlar self-host (2026-08-21, sw v232):** Google Fonts + Fontshare TAMAMEN kaldırıldı (preconnect/gstatic/api.fontshare dahil) → **dış font host'una sıfır istek** (CDP ile ölçüldü). `static/fonts/`: `inter-latin.woff2` (47KB) + `inter-latin-ext.woff2` (83KB, Inter VARIABLE 400-800) + `cabinet-grotesk-700/800.woff2` (~41KB) = **~171KB, 4 dosya** (≈eski dış indirmeyle aynı boyut). Lisanslar `static/fonts/Inter-OFL.txt` (SIL OFL 1.1 — metni birlikte dağıtmak ZORUNLU) + `CabinetGrotesk-FFL.txt` (ITF FFL, satır 36 self-host'a açıkça izin verir). `@font-face` style.css başında, `font-display: swap`, Google'ın unicode-range'leriyle (latin: ç/ö/ü/ı + U+0131; latin-ext: ğ/ş/İ — Türkçe ürün adları ikisini de kullanıyor). **inter-latin PRELOAD'lu** (ölçüldü: 4G'de FOUT'u ~1.9s azaltıyor; latin-ext preload EDİLMEDİ). Parite: auth-tab (Cabinet 600), Inter 300, italic ŞU AN da yedeğe/en-yakına düşüyordu → self-host mevcut ağırlıkları (Inter 400-800, Cabinet 700/800) koruduğu için öncesi/sonrası ekran görüntüleri **birebir aynı**. sw.js `FONT_URLS` cacheFirst (immutable; lisans .txt cache'e ALINMAZ). `test_cdn_pin.mjs` guard: dış font referansı geri gelirse KIRMIZI. Not: repo PUBLIC — Cabinet FFL satır 59 kendi-site self-host'u dağıtım kısıtından muaf tutuyor.
4. **`unsafe-inline` kaldırma — YARISI BİTTİ (2026-08-23).** `style-src` → **KAPANDI** (`'self'`). `script-src` → **BİLİNÇLİ ERTELENDİ**: 117 satır içi handler + 63 fonksiyon delegasyona taşınmalı, 4–6 tur. **Tetikleyici:** kullanıcı girdisi ya da üçüncü taraf içeriği render eden yeni bir yüzey eklenirse öne alınır. Borç `test_satirici_kilit.mjs` ile 117'ye kilitli, büyüyemez. Ayrıntı: yukarıdaki 2026-08-23 bloğu.
5. **SDK sürümü elle güncelleme — AÇIK MADDE (kapanmaz), en son kontrol: 2026-08-22.** Pinli olduğundan otomatik yama yok; periyodik `@2.x.y` + yeni SRI (integrity'yi **yeni dosyadan üret**, changelog'dan/tahminden değil).
   **2026-08-22 kontrolünün sonucu — yükseltme GEREKMEDİ:**
   - **`2.112.3` zaten en güncel kararlı.** İki bağımsız kaynak aynı: npm `dist-tags.latest` ve jsdelivr resolver (`latest` ve `^2`). Yayın 2026-08-11.
   - Daha yenisi **yalnız ön-sürüm**: `2.112.4-canary.*`, `3.0.0-next.*`, `2.112.0-beta.0`, `2.100.0-rc.0` — **pinlenmez**. (`2.112.4-canary.1` zaten "version bump only, no code changes".)
   - **GitHub Advisory: 0 kayıt** — pinli kalmak bilinen bir açığa maruz bırakmıyor.
   - **Pin GERÇEK dosyayla doğrulandı:** indirilen **212199 bayt**ın sha384'ü `index.html`'deki `integrity` ile **ESLESIYOR** → CDN hâlâ pinlenen baytları veriyor, pin bayat/bozuk değil.
   - **SRI'nin uygulandığı kontrol gruplu ölçüldü:** doğru hash'li script **yüklendi**, bozuk hash'li **bloklandı**. (Tek başına "bozuk bloklandı" yetmez; doğrunun yüklendiği de gösterilmeli.)
   - **`3.0.0` kararlı çıkınca OTOMATİK GEÇİLMEYECEK:** majör sürüm, auth yüzeyine dokunabilir → ayrı tur, changelog okunarak, aynı negatif/pozitif doğrulamayla.
6. ~~**KVKK: hesap silme akışı**~~ **KAPANDI (2026-08-23) — hesap silme UÇTAN UCA CANLI.** Bu madde başta "DELETE policy yok, veri kalıntısı" diye yazılmıştı; **çözüm yolu değişti**: DELETE policy eklenmedi, yerine `auth.users`'a `ON DELETE CASCADE` FK + kullanıcının kendi JWT'siyle çağırdığı `hesap-sil` edge function'ı + iki adımlı onaylı UI kuruldu. Gerçek hesapla, kontrol gruplu doğrulandı. Ayrıntı ve açık kalan 5 madde: üstteki 2026-08-23 bloğu.
7. ~~**CI hiç test koşturmuyor**~~ **KAPANDI 2026-08-21** — `deploy.yml`'de ayrı `test` job + `deploy needs: test`; kanıtlandı (Teknik borç bölümüne bak).

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
> (Bu, üç vakadan biri. **Tek kayıt: Araçlar & kaynaklar → "ORTAM — Kaspersky bu makinede araya giriyor"** — enjeksiyon ve CSP başlığını seçici sıyırma dahil.)

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
>
> **(Bu iki vaka ve 2026-08-22'deki üçüncüsü — CSP başlığının seçici sıyrılması — artık tek yerde toplandı: Araçlar & kaynaklar → "ORTAM — Kaspersky bu makinede araya giriyor". Yeni tarayıcı ölçümünden önce oradaki kontrol grubu reçetesini koş.)**

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
| `test_sablon_slug.mjs` | 30 | Şablon kategori slug türetme (gerçek `KATEGORILER`), `_loadCatGetir` guard, dürüst hata mesajı — ana sayfa `_id` bug'ı koruması |
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
| `test_kacis.mjs` | 93 | Çıktı kaçışı (B1): gerçek `_kacir` vm'inde render yolları, metot-zincirli interpolasyonlar, q echo guard |
| `test_bildirim_yetki.mjs` | 28 | `fiyat_bildirim` istemci kapısı + PT409/PT429 kod→mesaj eşlemesi |
| `test_cdn_pin.mjs` | 45 | SDK/GoatCounter sürüm pini + SRI, HSTS basamağı `max-age=86400` (includeSubDomains/preload YOK), **CSP davranışı** — worker koşturulup üretilen başlık ölçülüyor: silinen dört font host'u hiçbir direktifte olmamalı, kalan host'lar izinli kalmalı |
| `test_sepet_rozet.mjs` | 12 | Sepet `_sid` backfill'i, canlı rozet hesabı, çift-cache şartı |
| `test_satirici_kilit.mjs` | 19 | Satir ici olay ozniteligi KILIDI: sayi taban 117'yi asarsa kirmizi (script-src gocu ertelendi, borc buyumesin); sayim deseni 13 sentetik ornekle kendini dogruluyor; style-src/script-src unsafe-inline durumu iki yonlu kilitli |
| `test_sw_origin.mjs` | 28 | `sw.js` `notificationclick` origin kapısı — gerçek kaynak `node:vm`'de koşturulup handler çağrılıyor; dış origin/protokol-göreli/sonek hilesi reddi, meşru url'in bozulmaması, sessiz yutma yasağı (davranışsal, kontrol gruplu) |

**Toplam 53 takipli dosya (47 `.mjs` + 6 `.py`) — `git ls-files` ile sayıldı, 2026-08-23. CI kapısından geçen 52 (47 `.mjs` + 5 `.py`).** Her iki CI adımı da **glob** ile çalışıyor (`for t in test_*.mjs` / `test_*.py`) → yeni test eklenince kapıya kendiliğinden giriyor, elle liste yok. Tek açık dışlama `test_resim.py` (canlı Searlo API'sine çıkıyor). Sayı gün içinde 49→50 oldu: `test_sablon_slug.mjs` kapı kurulduktan sonra eklendi.
Bu tablo 2026-08-17'de **33 dosyada donmuştu**; hub turu ve tasarım turlarında eklenen
13 dosya listelenmemişti. Sayılar `PASS=` / `SONUC:` çıktısından yeniden ölçüldü, tahmin
değil. (Diskte 3 takipsiz `.py` daha var — aşağıdaki Searlo denemeleri.) `sonda_debug.py` / `sonda_resim_mini.py` / `sonda_searlo.py` (2026-08-21'de `test_*`'ten yeniden adlandırıldı) regresyon testi DEĞİL — `.gitignore`'daki tek seferlik Searlo sondaları, kredi bittiği için hata basarlar; CI `test_*` glob'una sızmasınlar diye `sonda_*` önekli.

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
- **`www.pazarapp.net` KURULDU (2026-08-21).** Cloudflare: `www` **CNAME (Proxied)** + **Redirect Rule 301 `www` → apex**, query string korunuyor. `www` yazan kullanıcı artık hata almıyor. İkinci custom domain olarak **bağlanmadı** — 301 tek kanonik adrese götürdüğü için yinelenen içerik sorunu doğmuyor, canonical bozulmuyor. (Pano işi; bu repodan yapılamıyordu.)
- **`*.workers.dev` adresi KAPANDI.** `routes` eklenince wrangler onu devre dışı bıraktı (deploy logunda uyarısı var); ölçüldü, `pazar-app.mustafaavkan72.workers.dev` → 404. SEO açısından iyi (aynı içeriği veren ikinci URL yok) ama **yedek test adresi kalmadı**; gerekirse `workers_dev: true` ile geri açılır.
- **Eski origin `avkkann.github.io/pazar-app` HÂLÂ ESKİ UYGULAMAYI SERVİS EDİYOR.** GitHub Pages kendiliğinden kapanmıyor. `mezar-tasi` dalı (orphan, `6f72f3a`, uzakta) hazır ve Pages Source ona çevrildi, ama **`actions/deploy-pages` 503 veriyor** (build başarılı, deploy adımı düşüyor; yeniden deneme de 503 aldı). Deploy geçene kadar eski adres donmuş veriyle, eski canonical'la ve eski `sw.js` (v206) ile ayakta.
- **GoatCounter (1 Tem – 17 Ağu): 59 ziyaret.** Kaynakların **%90'ı doğrudan/bilinmeyen**, **arama trafiği sıfır**. %97 Türkiye, **%68 telefon**, **%64 iOS/Safari**. İki sonuç: (a) tek dağıtım kanalı doğrudan link paylaşımı — o yüzden `og:image` en öncelikli SEO maddesiydi; (b) **kullanıcıların üçte ikisi Safari'de ve uygulama Safari'de hiç test edilmedi.**
- **Google'da hiç indekslenmemiş** (`site:` sorgusu 0 sonuç, eski adres için). 2026-08-17 zemin taraması: robots engellemiyor, `noindex` yok, `X-Robots-Tag` yok, canonical doğru, cloaking yok, sitemap geçerli ve erişilebilir, indekslenebilir metin var. **Teknik engel yoktu** — sebep Search Console'a eklenmemiş olması ve dışarıdan bağlantı olmamasıydı. **2026-08-18'de Search Console'a eklendi + sitemap gönderildi**; artık indeksleme Google'ın sürecine bağlı (dış bağlantı azlığı hâlâ etken).
- **Cloudflare Web Analytics beacon'ı KAPATILDI (2026-08-21, pano → Web Analytics → Disable).** Cloudflare `static.cloudflareinsights.com/beacon.min.js`'i HTML'e sonradan enjekte ediyordu; `script-src` izin vermediği için hiç çalışmıyordu ve her yüklemede konsola bir CSP ihlali basıyordu. Artık **kaynağında** durduruldu — script sayfaya eklenmiyor. **Karar sabit: CSP'ye ASLA eklenmeyecek** (analitik GoatCounter'dan geliyor, ikinci izleyici gereksiz). **Sonuç:** "konsolda görünen o ihlal bilinen/zararsız" mazereti **artık yok**; konsolda CSP ihlali görünüyorsa gerçek bulgudur.
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
1. **Mezar taşını yayına al** (`mezar-tasi` dalı hazır, Pages Source ayarlandı, `deploy-pages` 503 veriyor). Geçtikten sonra ölçülecek: mezar taşı mı geliyor, meta refresh süresi, canonical, JS kapalı metin, ve **eski `sw.js` gerçekten `unregister` oluyor mu**. **main'e MERGE EDİLMEZ** — dosya adları uygulamanınkiyle aynı, merge giriş sayfasını ve service worker'ı ezer.
2. **Aranabilir içerik üretimi.** Ürün başına statik sayfa + aylık zam listesi sayfası, **build zamanında** `anasayfa.json` deseniyle (`app.js`'i `node:vm`'de koşturup kendi fonksiyonlarını çağır — mantık ikinci kez yazılmaz). SPA'nın tek URL'si arama için yeterli değil.
3. **KVKK aydınlatma metni — SIRADAKİ İŞ. Hesap silme tarafı 2026-08-23'te UÇTAN UCA BİTTİ.** Zincirin tamamı geçti: BLOK 0 → BLOK 4 → BLOK 1 (altı FK `delete_rule=CASCADE`) → edge deploy → UI (`2ecfa41`) → **gerçek hesapla canlı silme, kontrol gruplu** (dokuz satır düştü, dokunulmayan ikinci hesap aynen kaldı). **Aydınlatma metni bilerek en sona bırakılmıştı** — silme uçtan uca çalışmadan metinde "hesabınızı silebilirsiniz" demek yanlış olurdu. **Artık doğru, yazılabilir.** Ayrıntı ve açık kalan 5 madde: üstteki 2026-08-23 bloğu.
4. **Searlo kredisi kararı** — resim doldurma adımı artık boşa koşmuyor ama **hiç resim de doldurmuyor**. Ya kredi yenilenecek ya alternatif kaynak seçilecek ya da adım tamamen kaldırılacak. Alternatif kaynak araştırması bilinçli olarak yapılmadı.
5. **~2026-09-01: HAYALET ZAM kuralı ölçüye dayalı hale getirilecek.** `depot_id`/`depot_ad` **2026-08-11'den beri** birikiyor. O tarihte yeterli veri olacak ve "bu dip/zıplama gerçekten mağaza değişimi mi" sorusu **doğrudan** cevaplanabilecek; `zamSalinimVar`'daki yapısal salınım testi `depot_id` değişimini izleyen ölçüme dayalı kuralla değiştirilmeli. Not `app.js`'te `_seriKur` ve `zamSalinimVar` üzerinde duruyor. **Bu tarih geçmeden kuralı değiştirme, ölçüm olmadan yeni eşik uydurma.**
6. ~~**`www.pazarapp.net` yönlendirmesi**~~ **KAPANDI (2026-08-21).** Cloudflare'de `www` CNAME (Proxied) + Redirect Rule 301 `www → apex` kuruldu, query string korunuyor; ikinci custom domain olarak bağlanmadı. Ayrıntı: yukarıdaki `www` bloğu.

> Eski **kök `avkkann.github.io/sitemap.xml`** maddesi 2026-08-17'de düştü: artık `pazarapp.net` kendi host'u, kendi `robots.txt`'i ve kendi `sitemap.xml`'i var. `robots.txt` host başına okunduğu için Google artık bu depodan üretilen dosyayı okuyor. Başka bir depodaki o dosya bu proje için anlamsız.

**Karar bekleyen:**
- **Al/bekle'de kaybolan 900 çıktı.** Temiz seriye geçince alarm önerisi −492, al/bekle −408 düştü. Bunlar yeni bir susturma kuralı değil, **mevcut kapılar** düzeltilmiş veriye uygulandığı için: alarm "fiyat zaten dipteyse öneri yok"a, al/bekle `AL_ZAMANI_MIN_OYNAMA` %5 kapısına takılıyor. Düşenlerin yarısında temiz aralık **tam sıfır** (ürün 30 gündür kımıldamamış, "bekle" demek yanlıştı). Ama dürüst sınır: salınımlı seri "yanlış seri" değil — inip biten bir kampanya gerçek bir diptir ve o bilgiyi kaybettik. Kabul mü, yoksa hedefli bir istisna mı gerekiyor?
- **Tuzak şeridi rastgele seçiyor.** Havuz (30 kırmızı + 30 sarı) build'de hesaplanıyor, istemci karıştırıp 6 alıyor — bugünkü davranışın aynısı. Kalıcı/kişiselleştirilmiş seçim isteniyorsa ayrı karar.
- **"Tuzak" sekmesinin kaldırılması** — yerini alacak özellikler tamamlandı.
- **Gramaj hilesi (shrinkflation) analizi** — `agirlik_hacim_gecmisi` birikiyor, veri bekliyor (3-6 ay).
- **İlan edilen indirim vs gerçek düşüş karşılaştırması** — `ilan_indirim_gecmisi` ile `fiyat_gecmisi`'ni karşılaştırıp "ilan edilen indirim gerçek mi" sorusunu cevaplamak. Veri bekliyor; ilk dolu koşu 2026-08-09.
- **Hal–market karşılaştırması — ÇEŞİT EŞLEŞTİRME ÇÖZÜLMEDEN AÇILMASIN.** `renderFirsatHal`/`halEsles`/`halKgHesapla` 2026-08-10'da silindi (zaten ölü koddu, hiçbir yerden çağrılmıyordu). İki kusuru vardı: **(a) Çeşit vs dökme emtia.** Market ürünlerindeki nitelemeler halin dökme kaleminin karşılığı değil — ölçüm: ekrandaki 20 eşleşmenin **17'sinde** market adında hal kaleminde olmayan bir kelime vardı (`Şeker Domates 250 Gr` ↔ hal `Domates`: 158,00 vs 21,56 ₺/kg; `Kiraz Gurme` ↔ `Kiraz`: 229,90 vs 76,58; `Çengelköy Salatalık` ↔ `Salatalık`: 89,00 vs 16,32). Şeker domatesi halin dökme domatesiyle kıyaslamak farklı iki malı kıyaslamaktır. **(b) Paket bazlı hesap yok.** Tasarruf kg farkı olarak hesaplanıp küçük paketin üstüne basılıyordu: `Soya Filizi 125 Gr` raftaki 189,90 ₺ → 1.519,20 ₺/kg çevrimi → rozet "1.008,87 ₺ ucuz", oysa o paketteki gerçek fark 126,11 ₺. Ekrandaki 20 üründen 4'ü 1 kg'dan küçük paketliydi. Yeniden açılacaksa **önce** çeşit seviyesinde eşleştirme (marka/çeşit sözlüğü) çözülmeli, **sonra** tasarruf paket ağırlığı üzerinden hesaplanmalı.

**Teknik borç / arıza:**
- **CI TEST KAPISI — KURULDU ve KANITLANDI (2026-08-21).** Eskiden CI hiç test koşturmuyordu; kırmızı testle deploy mümkündü (ve oldu: 7 `.mjs` testi B1 XSS Party 2'den — `f1f2ee5`, 2026-08-19 — beri `_kacir is not defined` ile ÇÖKÜYORDU, CI koşmadığı için ~2 gün fark edilmedi). Artık `deploy.yml`'de **ayrı `test` job**; `deploy` job'u `needs: test` → kırmızı test yayını durdurur. **`continue-on-error` YOK.** Node ve Python **ayrı adım**, her kırmızı `::error file=...` ile, çıktılar `::group::` ile → hangi dosya/iddia bir bakışta. **Kapıya giren: yazıldığı anda 44 `test_*.mjs`, 2026-08-21 sonu itibarıyla 45** (glob'la seçiliyor, elle liste yok → yeni test kendiliğinden kapıya girer; `test_sablon_slug.mjs` gün içinde eklendi) (Node builtin + yerel `scripts/*.mjs`, ağsız; `npm ci` gerekmiyor) **+ 5 standalone `test_*.py`** (`test_depot/hal/hub_tazelik/liste_fiyat/tazelik`; test job `pip install requests beautifulsoup4` yapıyor çünkü bunlar scraper modüllerini — `hal_scraper` vb. — import ediyor, o modüller modül seviyesinde `requests` çekiyor). **DIŞARIDA:** `test_resim.py` (gerçek test ama canlı `api.searlo.tech` tüketir → Python glob'unda **açıkça atlanıyor**, yorumlu) + 3 Searlo sondası **`sonda_debug/resim_mini/searlo.py`** (2026-08-21'de `test_*` → `sonda_*` yeniden adlandırıldı, gitignore'lu → CI checkout'unda yok; `sonda_searlo.py`'de gömülü API anahtarı var, ignore kalıyor — **2026-08-21 denetimi: anahtar git geçmişine HİÇ girmemiş** (638 commit tüm dallar, tam anahtarla `-S` = 0 eşleşme; eski/yeni adların hiçbiri commit'li değil → iptal gerekmedi). **KANIT (yeşil ekran yetmez):** kasıtlı FAIL push edildi → test KIRMIZI + deploy **SKIPPED** ([run 32419371652](https://github.com/avkkann/pazar-app/actions/runs/32419371652)); revert → yeşil ([32419432723](https://github.com/avkkann/pazar-app/actions/runs/32419432723)). Bildirim ölçüldü: Mustafa'nın (avkkann) inbox'ında **16 `ci_activity`** kaydı → CI kırmızısı ona ulaşıyor (e-posta ayrı toggle, API'de görünmez).
- **B1 S4 dış-API render yolları — KAPANDI (2026-08-21).** Önceki turda 9 render yolu (`_kartaRozetEkle, renderUrunler, alarmOneriHTML, profilAlarmlarHTML, sepetMarketOzetiHTML, gercekIndirimRozetiHTML, alZamaniHTML, renderZamSeridi, fiyatAlarmiBlogu`) `_kacir` passthrough stub'ı yüzünden kaçış açısından doğrulanmamıştı. Ölçüldü (gerçek `_kacir` ile, runtime + kontrol grubu): 7 yol zaten güvenli (interpolasyon yok / `_kacir`'li / numeric / çıktı komple `_kacir(metin)` / kapsanan fonksiyona delege). **`sepetMarketOzetiHTML` içinde market adlarının bir dizi-metot ifadesiyle (`.join`) kaçışsız geçtiği bir nokta bulunup `_kacir`'lendi.** **Tarama yöntemi dersi (kök neden):** önceki "tam tarama" `${değişken}` / `${_kacir(…)}` desenlerini tanıyıp **metot-zincirli interpolasyonları** (`.join`/`.map`/`.slice`) sınıflandırma dışı bıraktığı için o noktayı kaçırmıştı. Bu kör-nokta sınıfı yeniden tarandı (14 metot-çağrılı interpolasyon); aynı sınıftan **2 nokta daha** (`_cmpItemHTML` gramaj alanı = `it.agirlik_hacim`; hal rozeti = `bulten_tarihi`) bulunup `_kacir`'lendi. `profilAlarmlarHTML`'deki kısmi manuel kaçış (`replace(/</g,'&lt;')`) `_kacir`'e normalleştirildi. Passthrough stub'lar (o 7 test) **gerçek `_kacir`'e çevrildi** — biri (`test_zam_gerekce`) kaçışlı çıktıyı yansıtacak şekilde güncellendi (apostrof `&#39;`; entity DECODE etme, körlüğü geri getirir). `test_kacis.mjs` bu yollara genişletildi (gerçek `_kacir` vm, kontrol grubu, prove-by-breaking). **Ders: interpolasyon içinde metot çağrısı (`.join/.map/.filter/.slice`) olan her nokta ayrı taranmalı; bare-değişken deseni bunları atlar.** Görsel değişiklik yok (kaçış yalnız kötücül veride devreye girer; regresyon gerçek render'la doğrulandı: Türkçe/apostrof/`+` ayırıcı bozulmuyor, çift-kaçış yok).
- **Hal'de iki kırılgan kalem** — `Tamarind(demirhindi)` (tek satır, 5 kg hacim) ve `Isırgan (yaş-taze)` (tek satır, 2 kg hacim). Fiyatları absürt değil ve `URUN_MAX_FIYAT`'ı geçmiyorlar, ama doğrulanacak ikinci kayıt yok — tek bir hatalı bültende sessizce yanlış değer gösterebilirler.
- **`app.js`'te çağrılmayan 4 fonksiyon + 1 ölü değişken** (2026-08-10 taraması, 177 fonksiyon içinde): `filterUrunler` (2660), `mfGorsel` (2924, boş stub), `mfPlaceholderEmoji` (2926, boş stub), `temaToggle` (4291); `activeMarket` (616) yalnızca `null` atanıyor, hiç okunmuyor. Ayrıca `halMap` (611) artık **yalnızca yazılıyor** — tek okuyucusu silinen `halEsles`'ti; `loadData` hâlâ dolduruyor. Hiçbiri silinmedi, karar Mustafa'da.
- **`.sablon-chip` klavye + dokunma hedefi — KAPANDI (2026-08-20, sw v230).** Eskiden: Listem'deki şablon çipleri `<span class="sablon-chip" onclick="sablonYukleUI(...)">`, `tabindex`/`role`/`onkeydown` yok, JS yalnızca `touchstart/end/move` (uzun bas → düzenle). **Neden üç klavye turu kaçırdı:** hepsi tek satırlık markup'a baktı, bu öğe `'` + `'` birleştirmeyle üretiliyor, `class="sablon-chip" ... onclick=` deseni hiçbir satırda yan yana çıkmıyor. **Ders: taramadan önce birleştirmeleri düzleştir.** Kapanış: span'e `role="button" tabindex="0" aria-label` + `keydown` (Enter/Space → yükle, `addEventListener` ile — satır içi handler EKLENMEDİ); sil butonu zaten native `<button>`. Dokunma: `.sablon-chip` ailesi paylaşılan `::after` kuralında DEĞİLDİ (iç içe `sil` butonu var; kural del'i de kaplayıp tıklamayı yükle'ye çevirirdi) → chip'e kendi `::after`'ı (dikey 44), `.sablon-chip-del`'e `position:relative; z-index:1` + kendi `::after`'ı (32×44); **gerçek tıklama hit-test'iyle doğrulandı** (del merkezi→SIL, chip solu→YUKLE). `test_mobil_dokunma.mjs` bölüm 7 (prove-by-breaking).
- **Dokunma hedefi A/C — ÖLÇÜLDÜ, PREMISE BAYAT (2026-08-20).** "`.filter-pill` 26px" (A) ve "modal/detay içindeki 7 sınıf hiç ölçülmedi" (C) **zaten kapalıydı**: `::after` kuralı (style.css 2730) filter-pill + 7 sınıfı kapsıyor. Probe ile 15 sınıfın hepsinde `::after min-height:44px` doğrulandı; canlı `.alarm-kur-btn` görsel 98×40 → **etkin 98×44 GECER**, kırpılma yok. 7 sınıfın gerçekliği: `alarm-kur-btn`/`alarm-kaldir-btn`/`bildirim-pill`/`fiyat-bildir-btn` gerçek+kapsamda; `tazelik-chip` etkileşimsiz `<div>` (hedef değil); `btn-ekle`/`karsilastir-pill` markup'ta YOK (ölü sınıf, gerçek ekle butonu `.detay-btn-ekle` 358×52). Gerçekten açık olan tek şey `.sablon-chip` ailesiydi (yukarıda).
- **Sürüm numarası tek kaynaktan gelmiyor** — `index.html:604`'te (`#profilSurum`) `v1.0` elle yazılı, `sw.js`'teki `CACHE_NAME` (şu an **`pazar-cache-v232`**) ile hiçbir bağı yok. İki numara bağımsız sürükleniyor; satır numarası ve sürüm 2026-08-21'de dosyadan yeniden okundu.
- ~~**`update-data.yml` hâlâ Node 20, `deploy.yml` Node 24 — AÇIK BORÇ.**~~ **KAPANDI (2026-08-21, `844183f`).** `update-data.yml` `node-version: '20'` → `'24'`; artık `data/anasayfa.json` tek Node majöründe üretiliyor. Kapatma şartı (aşağıda "iki koşunun çıktısı bayt bayt karşılaştırılmalı" deniyordu) **yerine getirildi**: aynı girdiyle Node 20.20.2 ve 24.18.0 çıktıları bayt bayt aynı (SHA256 `310c843e…`, 153.838 B) ve canlı deploy koşusu `setup-node '24'` ile node v24.19.0 kurdu. Aşağıdaki metin borcun neden açıldığını anlatmak için duruyor. Somut sonucu: `data/anasayfa.json` **iki farklı Node majöründe** üretiliyor — gece koşusu onu Node 20'de üretip repoya commit'liyor, deploy build'i aynı script'i Node 24'te yeniden koşturup `dist/`e onu koyuyor. Yani commit'lenen dosya ile yayına giden dosya farklı motorlarda doğuyor. Mantık aynı olduğu için çıktının da aynı olması beklenir ama **doğrulanmadı**; "aynı türetilmiş dosyanın iki kaynağı" bu dosyanın tuzak diye işaretlediği desen. `update-data.yml` wrangler kullanmadığı için geçiş turunda bilerek dokunulmadı. Kapatılırken iki koşunun çıktısı bayt bayt karşılaştırılmalı.
- **`style.css`'te iki adet birebir aynı ölü `@media` bloğu** (`CENTER-FIX-TAMAM` ×2) — temizlenmedi.
- **Ölü `.cmp-mkt-item-img` kuralı** — `style.css:650`'de eski 30px tanımı duruyor, dosyanın sonundaki yeniden tasarım bloğu 56px'le eziyor. Zararsız ama yanıltıcı.
- ~~**CSP'de kullanılmayan font host'ları — DARALTMA YAPILMADI**~~ **KAPANDI (2026-08-22).** Dört host çıkarıldı: `style-src` → `'self' 'unsafe-inline'`, `font-src` → `'self'`. Ölçüm ve guard için yukarıdaki "CSP daraltma" bloğuna bak.
- **B1 XSS — çıktı kaçışı (DENETIM 1.5). Kaçış sertleştirmesi TAMAMLANDI.**
  Merkezî kaçış yardımcıları mevcut; localStorage, dış API/DB kaynaklı render yolları
  ve satır içi olay bağlamı bunlara geçirildi — dinamik değerler artık olay
  handler'ına doğrudan yazılmıyor, `data-*` özniteliğinden okunuyor (bkz.
  `test_kacis.mjs` — **93 iddia** (2026-08-20 taramasında arama sorgusu echo
  sink'i + q echo guard; **2026-08-21'de dört kaçışsız nokta daha kapatıldı** —
  `sepetMarketOzetiHTML`, `_cmpItemHTML` gramaj alanı, hal rozeti `bulten_tarihi`,
  `profilAlarmlarHTML`'deki kısmi manuel kaçış `_kacir`'e normalleştirildi; testler
  artık passthrough stub yerine **gerçek `_kacir`** vm'inde koşuyor), gerçek tarayıcı
  DOM ölçümü + negatif kontrol + regresyon + işlevsel tıkla/klavye/sepet). `&`
  çift-kaçışa gitmiyor, Türkçe/görsel bozulmuyor. CSP bu iş boyunca değişmedi.
  Ayrıntılı bulgu listesi repo dışındaki denetim notlarında tutuluyor. `sw.js`
  **v232** (bu maddedeki iş sırasında v228'di; sonraki turlarda GoatCounter pin →
  v231, font self-host → v232).
- **`'Makyaj'` kategorisi (70 ürün) `app.js` beyaz listesi dışında** — Temizlik sekmesi yerine "diger"e düşüyor. Kategori bölünmesinden önce de böyleydi. (`/api/v2/search` ucu bu tür artıkları yakalamak için değerlendirilebilir.)
- **`marketfiyati.json`** — bayat/farklı kaynak, hâlâ `marketfiyatiYukle()`/productMap fallback'inde. `urunler.json` gibi bir sonraki temizlik adayı.
- **`kesif_*`/`migrate_*`/`a101_pilot_*` dosyaları** — gitignore'da ama diskte, silme kararı Mustafa'da.

**Diğer:**
- ~~**Cloudflare Insights beacon'ı — panelden KAPATILACAK**~~ **KAPATILDI (2026-08-21).** Cloudflare panel → Web Analytics **Disable** edildi; `static.cloudflareinsights.com/beacon.min.js` artık sayfaya hiç enjekte edilmiyor, dolayısıyla bloklanacak istek de yok. **Karar sabit ve süresiz: CF Web Analytics CSP'ye EKLENMEYECEK, GoatCounter yeterli — beacon'ı CSP'ye asla ekleme.** Kod tarafında yapılan/yapılacak bir şey yok. **Yan sonuç:** konsol ölçümlerinde artık "bilinen beacon ihlali" diye göz ardı edilecek bir gürültü yok; görülen her CSP ihlali incelenir.
- **A101 Kapıda entegrasyonu** — pilot scraper hazır, DB'ye nasıl ekleneceği kararı bekliyor.
- **P1-B1 (tuzak landing), P1-U1/U2/B2, P2** — tartışılmadı. (P1-T2 CSP 2026-08-17'de kapandı.)
- **Safari'de hiç test edilmedi** — kullanıcıların **%64'ü** iOS/Safari (aşağıdaki dağıtım durumuna bak). Test hep masaüstü Chrome ve Claude in Chrome ile yapıldı.

---

## Kritik öğrenmeler

- **DOKÜMAN BAYATLIĞI — DÖRDÜNCÜ KEZ, ve bu kez ZARARI SOMUT (2026-08-24).** `a71c02f` `supabase/functions/hesap-sil/index.ts`'i depoya aldı ama **CLAUDE.md'nin "hâlâ TAKİPSİZ" satırını güncellemedi**. Ertesi tur o bayat satır Mustafa'yı **bitmiş bir işi yeniden istemeye** yönlendirdi; tur, ölçüm yapıp "bu zaten yapılmış" demekle geçti. Önceki üç vaka (`urunler.json`, `marketfiyati.json`, `wrangler.jsonc`/`src/worker.js` — satır 688) yalnızca *yanlış plan* üretmişti; bu dördüncüsü **doğrudan boşa tur** üretti. **KURAL: bir işi bitiren commit, o işle ilgili CLAUDE.md satırını AYNI commit'te günceller.** Doküman güncellemesini ayrı tura bırakma — pratikte o tur gelmiyor. "Commit mesajında yazdım" yeterli değil: bir sonraki oturum CLAUDE.md'yi okuyor, `git log`'u değil.
- **`git check-ignore -v` YANLIŞ ALARM verebilir — karar ÇIKIŞ KODUNA göre verilir.** 2026-08-24: `supabase/functions/hesap-sil/index.ts` için `-v` çıktısı `.gitignore:60` diye bir kural gösterdi, ama **60. satır boş** (uzunluk 0) — gerçek bir eşleşme yok. Doğru ölçüm `git check-ignore -q <yol>` ve **çıkış kodu**: `0` = engelli, `1` = engel yok. Bu tek başına önemli değil gibi görünür ama "dosya ignore'lu sandım, eklemedim" hatası tam olarak böyle doğar. Kontrol grubu da aynı komutla alınır: engelli KALMASI gereken bir yol (`supabase/.temp/…`) `0` dönmeli — dönmüyorsa `.gitignore`'u bozmuşsundur.
- **CSP'de nonce/hash satır içi olay özniteliklerini KAPSAMAZ.** İkisi de yalnızca `<script>`/`<style>` **bloklarını** kapsar; `onclick="…"` gibi öznitelikler kapsam dışıdır. Kapsatmanın tek yolu `'unsafe-hashes'` eklemektir, o da korumayı fiilen geri açar. **Sonuç:** handler göçü yapılmadan `script-src`'e nonce/hash eklemenin net kazancı **sıfırdır** — "hash'leyelim de bitsin" bir çözüm değil. Önce handler'lar delegasyona taşınır, sonra kalan 1-2 blok için hash doğal adım olur.
- **Tarama kör noktası kontrol grubuyla kanıtlanmadan SAYIM GÜVENİLMEZ — grep bu depoda bir turda BEŞ kez yanılttı (2026-08-23).** (1) `content=` içindeki `ontent=` → 23 sahte handler; (2) Türkçe değişkenler `oneri=`/`onceki=`/`onecikan=`/`onBoardingIdx=` → 8 sahte; (3) `el.onclick = fn` DOM **özellik ataması** handler sanıldı → 9 sahte (CSP'yi ilgilendirmez); (4) `onerror` içinde **kaçışlı tırnakla** yazılmış 3 iç içe `style=` (`\'…\'` ve `&quot;`) **sayımdan tamamen kaçmıştı** — göç etmeseydi görsel yedekleri stilsiz kalacaktı; (5) `node -e` içinde `\s` kabuk kaçışında düşüp regex'i sessizce bozdu, test yanlış yeşil/kırmızı verdi. **Kural:** sayıma dayanarak silme/taşıma yapmadan önce sayaca **sentetik örnekler** ver (doğru sayılması gerekenler + sayılmaması gerekenler) ve yanlış sınıflandırma varsa deseni düzelt. Kalıcı sayaçlarda kontrol grubunu **testin içine** koy (`test_satirici_kilit.mjs` deseni) — böylece her koşuda kendini doğrular.
- **"Sıfır istek" ≠ "ölü" — bir izni/host'u silmeden önce İKİ ŞEY BİRDEN gösterilmeli.** (a) Çalışma anında o origin'e sıfır istek **VE** (b) o host'a çıkabilecek bir kod yolunun bulunmadığı. Tek başına gözlem yeterli değil, çünkü **koşullu yollar gözlemle çürütülemez**: giriş gerektiren (`lh3.googleusercontent.com` — yalnız Google ile girmiş kullanıcının avatarı, `app.js:287`), butona bağlı (`api.marketfiyati.org.tr` — `#mf-ara-btn` → `marketfiyatiCanliAra()`, ancak buton tıklanınca istek çıkıyor), ya da beacon gibi ölçüm aracında **hiç görünmeyen** yollar (`pazar-app.goatcounter.com` — `sendBeacon` Resource Timing'e düşmez). 2026-08-22 CSP daraltmasında ilk ikisi "0 istek" diye silinseydi canlı arama kırılacak, girişli kullanıcıların avatarı bloklanacaktı. **Reçete:** ölçüm + kaynak taraması + tetiklenebiliyorsa özelliği gerçekten tetikle; üçü de aynı yöne işaret etmeden silme.
- **GitHub Actions, varsayılan `GITHUB_TOKEN` ile atılan push'lardan yeni workflow TETİKLEMEZ** (sonsuz döngü koruması). İstisnası `workflow_run` ve `workflow_dispatch` — PAT/secret gerekmez. Bir workflow'un commit'i başka bir workflow'u tetiklemeli diyorsan `workflow_run` kullan. Bu tam olarak 21 gün fark edilmeden yayının durmasına yol açtı.
- **Kaynak sitedeki kategori/isim değişiklikleri sessizce gelir; API hata değil BOŞ SONUÇ döner.** Boş sonuç ile ağ hatasını asla aynı dala düşürme — biri retry ister, diğeri insan müdahalesi. Boş sonuç sesli olsun (`[KRITIK]`) ve mümkünse hattı görünür şekilde kırmızıya çevirsin. Sessiz `[ATLA]` + "dosyayı hiç yazma" kombinasyonu bayat veriyi 12 gün taze gösterdi.
- **`showScreen()` inline `display` yazıyor — bu tuzağa ÜÇ kez düşüldü.** (1) Aktif ekrana inline `display: block` yazdığı için `#screen-*` seçicisine CSS'ten `display: grid`/`flex` vermek ÇALIŞMAZ (inline stil stil sayfasını ezer); düzeni her zaman bir iç sarmalayıcıya ver (`.profil-kartlar` gibi). (2) Diğer ekranlara `display: none` yazdığı için `style.display !== 'none'` kontrolü ancak *showScreen bir kez koştuktan sonra* doğrudur. (3) **showScreen İLK KEZ koşana kadar TÜM ekranların inline `display`'i BOŞ (`""`), gizlilik yalnızca CSS'ten geliyor** — 2026-08-11 ölçümü: `screen-profil` → `inline=""`, `hesaplanan="none"`, `offsetParent=null`. Yani `style.display !== 'none'` açılışta gizli ekranı GÖRÜNÜR sanıyor. Somut zarar: `profilBolumleriCiz()` açılışta da çağrılıyor, oraya konan tembel-yükleme tetikleyicisi ateşlendi ve **4,2 MB geçmiş her sayfa açılışında indi** (üç deploy sürdü, her adımda canlı ölçümle yakalandı). **Görünürlük kontrolü inline stile değil `getComputedStyle`'a bakmalı** — `_ekranGorunur(id)` bunun için var, yeni kontrol yazma, onu kullan.
- **Doküman "borç" ifadesini ÖLÇMEDEN kabul etme — yanlış ifade edilmiş olabilir.** "Sepet şemasına `_sid`" borcu "karşılaştırma ekranındaki rozetler çalışmıyor" diyordu; canlı ölçüm (2026-08-20) o ekranlarda rozetin **hiç olmadığını** gösterdi — bozuk değil, yoktu (`_cmpItemHTML`/`renderSepet` rozet üretmiyordu). Bu depoda tekrarlayan desen: bir iddia (rozet metni ya da borç maddesi) ham veriden farklı şey söyler. Kod yazmadan önce iddiayı **ölçerek** doğrula/çürüt (Faz 1 = ölçüm). Kapanış (2026-08-20): `_sid` sepet şemasına **additive** eklendi (toggleSepet + firsatSepetEkle) + `_sepetSid` tembel backfill (eski sepetler `_id`→productMap'ten çözer, öğeye yazar) + sepet ekranına rozet — **canlı üründen** (`productMap[u._id]`, en_dusuk_fiyat günlük değişir) ve **çift-cache şartıyla** (`_gecmisCache && _puanCache`; `_puanCache` yoksa plain "indirim" sahteyi olumlu etiketleyebilir → hiç gösterme). Karşılaştırma ekranı kasıtlı kapsam dışı. `test_sepet_rozet.mjs` (prove-by-breaking: backfill + çift-cache).
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

### ORTAM — Kaspersky bu makinede araya giriyor (TEK KAYIT, üç vaka)

**Bu bölüm tek doğru kaynaktır.** Aynı yazılım üç ayrı turda üç farklı şekilde ölçümü bozdu ve her seferinde sıfırdan keşfedildi. Yeni bir tarayıcı ölçümü yapmadan önce burayı oku.

**Vaka 1 — siteyi tamamen engelledi (2026-08-19).** Otomatik istek hacmi tetikledi: `pazarapp.net` → HTTP **499 "Request has been forbidden by antivirus"**; `curl` → **`SEC_E_UNTRUSTED_ROOT`**, yani TLS Kaspersky'nin kendi köküyle açılıp yeniden imzalanıyor (`-k` ile bile 403). **Site sağlamdı**, deploy yeşildi. Çözüm: `pazarapp.net` Kaspersky **güvenilir URL istisnasına** eklendi — kalıcı, yalnızca bu makine.

**Vaka 2 — CSP'ye enjeksiyon.** Uzantısız temiz profilde bile, sayfanın *uygulanan* politikasında `https://gc.kis.v2.scr.kaspersky-labs.com wss:` görünüyor. `fetch()` ile okunan **yanıt başlığı** temizdi. Ders: ihlal mesajındaki politika metnine değil, yanıt başlığına bak.

**Vaka 3 — CSP başlığını SEÇİCİ SIYIRMA (2026-08-22, en sinsisi).** Aynı sayfada `Strict-Transport-Security` **okunabiliyor**, ama `Content-Security-Policy` **boş dönüyor**; sayfada `gc.kis.v2.scr.kaspersky-labs.com` kaynağı mevcut. Yani başlık seçici olarak düşürülüyor — "başlık okunamıyor" gibi genel bir kısıt değil.

**KAPSAM SINIRI (2026-08-22'de ölçüldü):** AV **CSP başlığını** sıyırıyor ama **script gövdesine DOKUNMUYOR** — Supabase SDK'sı SRI'ye takılmadan yükleniyor (`window.supabase` = `object`), üstelik bozuk hash'li bir kopya aynı sayfada bloklanıyor. Yani SRI bu makinede geçerli bir koruma ve script bütünlüğü ölçümleri **güvenilir**; geçersiz olan yalnızca CSP-tabanlı tarayıcı ölçümleri.

> **SONUÇ — BU MAKİNEDE "tarayıcı konsolunda CSP ihlali yok" ÖLÇÜMÜ GEÇERSİZDİR.**
> Uygulanan bir CSP olmadığı için ihlal *doğmaz*; sıfır görmek "temiz" değil, **"ölçecek bir şey yok"** demektir. Bu sonucu "doğrulandı" diye yazmak yanlış olur.
>
> **Doğru iş bölümü:** CSP **sunucu taraflı** doğrulanır (`curl -s -o /dev/null -D - https://pazarapp.net/ | grep -i content-security-policy` — Kaspersky bunu bozmuyor, başlık doğru geliyor). **Tarayıcı teyidi Kaspersky'siz bir makinede** yapılır (Mustafa'nın gizli sekmesi bu koşulu sağlıyorsa orada).

**KONTROL GRUBU REÇETESİ — ölçüme başlamadan önce koş.** Bir tarayıcı ölçümünün geçerli olup olmadığı ancak böyle anlaşılır:
1. **Dış stylesheet enjekte et:** CSP'ce bloklu olması gereken bir host'tan `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter">` ekle. **İhlal düşmüyorsa CSP uygulanmıyordur** — ölçüm geçersiz, dur. (`link.sheet` dolu geliyorsa stylesheet gerçekten yüklenmiş demektir.)
2. **Başlığı sayfadan oku:** `(await fetch(location.href, {cache:'no-store'})).headers.get('content-security-policy')` → `null`/boş ise başlık tarayıcıya ulaşmıyordur. Aynı çağrıda `strict-transport-security` dolu geliyorsa bu **seçici sıyırmadır** (Vaka 3).

**Genel ders:** canlı doğrulama aniden çökerse veya "şüpheli temiz" çıkarsa, önce **"site mi bozuldu yoksa yerel katman mı araya girdi"** diye ayır — sertifikayı kimin verdiğine ve başlığın sunucudan mı tarayıcıdan mı okunduğuna bak. `localhost` bu taramaya girmiyor; yerel derleme her zaman kaçış yolu.

---

## Diğer talimatlar

- Mustafa Android kullanmıyor — iOS ve web (masaüstü Chrome) üzerinden test ediyor.
- CLAUDE.md sohbete asla ham metin olarak yapıştırılmaz, sadece dosya olarak paylaşılır.
