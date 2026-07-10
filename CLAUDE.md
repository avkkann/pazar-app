# Pazar App — Proje Handoff (Claude için)

**Son güncelleme:** 2026-07-08 oturumu sonunda. Bu dosya her oturum başında okunur, sohbete asla ham metin olarak yapıştırılmaz.

---

## Amaç & bağlam

Mustafa (GitHub: avkkann), **Pazar App**'in tek geliştiricisi — Türk market fiyat karşılaştırma PWA'sı, `avkkann.github.io/pazar-app` (repo: `avkkann/pazar-app`, yerel yol: `C:\Users\MUSTAFA KARABIYIK\Desktop\pazar-app`). Misyon: gizli zamları, sahte indirimleri, gramaj hilelerini ortaya çıkarmak — A101, BİM, Migros, CarrefourSA, ŞOK, Tarım Kredi. Slogan: **"Marketteki gizli zamları gör."**

**İş akışı:** İki-Claude modeli — bu Claude strateji/araştırma/OpenCode prompt yazımı yapar; OpenCode (Windows CMD/PowerShell) dosya düzenlemelerini uygular. Mustafa ham terminal çıktısını yapıştırır, Claude doğrular (kod + canlı tarayıcı ile). SQL şema değişiklikleri Supabase SQL Editor'a doğrudan verilir (OpenCode'a değil, Mustafa çalıştırır).

**İletişim tarzı:** Türkçe, kısa, doğrudan. Uzun terimlerden kaçın. Claude kısa gerekçeyle karar verir, seçenek listesi sunmaz — büyük ürün/mimari kararları hariç (onlarda sorar). Mustafa terminal çıktısını olduğu gibi yapıştırır, Claude özetlemeden okur.

**Supabase:** URL `https://gbgxxahhbfnulmyecxia.supabase.co`, region eu-central-1, project ID `gbgxxahhbfnulmyecxia`.

**Test:** iOS + web (masaüstü Chrome). Android kullanılmıyor, test/deploy talimatlarında Android'e referans verilmez.

---

## Mevcut durum (2026-07-08 itibarıyla)

### Backend / DB — bu oturumda tamamlanan büyük geçiş
Frontend'in ağır noktaları (8 kategori JSON dosyasını client'ta indirip tarama) tek tek DB sorgusuna taşındı:
- **Fırsatlar sekmesi** → doğrudan Supabase sorgusu (`ust_kategori`/`fiyat_farki_yuzde`/`fiyat_farki_tl` generated column'ları üzerinden, 7 paralel sorgu + 1 count sorgusu)
- **Profil "toplam ürün" sayacı** → tek `count` sorgusu (eskiden 9 dosya indiriyordu — 8 kategori + bayat `marketfiyati.json`; o dosya artık sayıma dahil değil, gerçek sayıyı bozuyordu)
- **Ana sayfa "Bu hafta düşenler"** → `get_fiyat_dusenler()` RPC fonksiyonu (`fiyat_gecmisi` üzerinden son 30 gün zirve/düşüş hesabı)
- **"Bugün yakaladığımız tuzaklar"** → hâlâ client'ta 8 dosya indirip tarıyor (bilinçli, aşağıda "Tuzak kararı" bölümüne bak), ama artık düşenler/mevsimle aynı anda çakışıp iki kere indirmiyor

**`data/urunler.json` tamamen kaldırıldı** — kalıcı olarak bayattı (scraper `dondurulmus_ayir()` sonrası bu dosyayı güncellemiyordu, ~211 donuk ürün eski kategoride görünüyordu). scraper.py'den üretimi, sw.js'den precache'i, repodan dosyanın kendisi silindi. Kaynak artık sadece 8 kategori dosyası (`urunler_meyve.json` ... `urunler_dondurulmus.json`).

### Yeni DB kolonları (bu oturumda eklendi)
`urunler` tablosuna eklenenler:
- `ust_kategori` (generated, `ana_kategori`'den CASE ile türetilir — meyve/sebze/et/sut/gida/icecek/temizlik/atistirmalik/dondurulmus/diger)
- `fiyat_farki_tl`, `fiyat_farki_yuzde` (generated, `market_fiyatlari` JSONB'den min/max — `jsonb_fiyat_max()` yardımcı fonksiyonu kullanır)
- `agirlik_hacim_gecmisi` JSONB (plain, sessiz toplama — aşağıya bak)
- `indirim_supheli_puan`, `indirim_supheli_sebepler`, `indirim_supheli_dusus_yuzde` (plain, `indirim_analiz.py` tarafından her gece yazılır)

RPC fonksiyonları: `get_fiyat_dusenler(p_limit)`, `indirim_puan_toplu_guncelle(guncellemeler jsonb)` (bkz. "Kritik öğrenme: PostgREST upsert").

### Tuzak kararı (2026-07-03/08 oturumu)
- **Bulgu:** `tuzakRozetiHesapla()` (index.html) sadece aynı ürünün farklı paket boyutları arasındaki birim fiyat farkını gösteriyor — tüketici markette kendi hesaplayabilir, gerçek farklılaşma değil.
- **Karar:** Kaldırılmıyor ama geliştirilmiyor de — **olduğu gibi bırakıldı**, sadece performans/çakışma düzeltmesi yapıldı (düşenler artık aynı anda `loadAllCats()` çağırmıyor, tuzaklar tek başına kaldı).
- **Yerine kurulan gerçek özellik: Sahte indirim tespiti.** `indirim_analiz.py` (yeni dosya, GitHub Actions'ta `sync_db.py`'dan hemen sonra çalışır, `continue-on-error: true`) her ürünün `fiyat_gecmisi`'ni 4 sinyalle puanlıyor: kısa zirve süresi (1-2 gün şüpheli), yüksek oynaklık, tekrarlı pompa-indirim döngüsü, aşırı yüksek indirim oranı (≥%50). Toplam puan ≥4 şüpheli, 2-3 dikkat. **Sessiz altyapı — henüz UI'da gösterilmiyor.** Canlı testte 14.418 üründen 30'u şüpheli, 532'si dikkat çıktı.
- **Shrinkflation (gramaj hilesi):** Şu an **yapılamaz** — `_sid` ürün adından üretiliyor (`meyve_patlican-1-kg`), gramaj değişince yeni `_sid` doğar, eski/yeni gramaj eşleştirmesi yok. `agirlik_hacim` hiç geçmişe kaydedilmiyordu. **Bu oturumda sessiz toplama başlatıldı**: `agirlik_hacim_gecmisi` JSONB kolonu + scraper'da `_apply_agirlik_gecmisi()` (fiyat geçmişi gibi ama süresiz saklanır, sadece değer değiştiğinde kayıt eklenir). UI'da hiçbir şey gösterilmiyor. **3-6 ay veri birikmeden gerçek shrinkflation analizi başlamaz.**

### MiniMax audit (uploaded doküman, 2026-07-01 tarihli — bu oturumda P0 tamamen bitti)
Doğrulama disiplini: her madde önce koda bakılarak gerçek olup olmadığı kontrol edildi, doküman bazen eskiydi.
- **Stale/dismissed:** P0-T1 (duplicate fetch — kod zaten `marketfiyatiYuklendi` bayrağıyla korunuyordu, canlıda network sekmesiyle doğrulandı, sorun yok), P0-T2 (8 dosyayı precache'e ekleme önerisi — bizim DB-migration yönümüzle çelişiyor, atlandı), P1-T3 (IndexedDB — localStorage'da zaten sadece küçük şeyler var), P1-İ1 (shrinkflation MVP — daha gerçekçi "sessiz toplama" planıyla değiştirildi).
- **Tamamlanan:** SEO meta paketi (description/robots/canonical/OG/twitter, OG image hariç — gerçek görsel yok), robots.txt+sitemap.xml, theme_color tutarlılığı (`#0E4938` her yerde), manifest shortcuts+lang+id+categories+screenshots (3 gerçek ekran görüntüsü eklendi), `?screen=` query routing (yoktu, eklendi), auth formu `<form>`+gizli `<label>`+Enter-submit, 5 native alert/confirm/prompt → mevcut `modalAc()` modal sistemine taşındı, veri kaynağı attribution footer (Ana Sayfa + Fırsatlar), GoatCounter analytics (Plausible yerine — kartsız/ücretsiz alternatif), WhatsApp paylaşım mesajı yeniden tasarlandı (gerçek tasarruf hesabı + WhatsApp formatlaması), sepete-ekleme toast+haptik, **3 sayfalık onboarding** (ilk profesyonel görünümü çok basitti, sonradan gradient arka plan + blob ikon rozetleri + giriş animasyonu + pill-şekilli nokta göstergesiyle yeniden tasarlandı), PWA kurulum banner'ı (konum düzeltildi — bottom-nav'la çakışmıyor artık, 3sn yerine 30sn/ilk-ürün-eklendiğinde tetikleniyor, kapatma artık kalıcı değil 14 gün TTL).
- **Bilinçli atlandı:** P0-G1 (KVKK) — Mustafa "uygulama bitince ekleriz" dedi. P0-U2 (5. nav sekmesi/Favoriler) — Mustafa hayır dedi, Profil'den erişim yeterli. P0-U3 (çift + giriş noktası) — kontrol edildi, zaten doğru çalışıyor (detay sayfası butonu "✓ Listemde"ye dönüşüyor, tekrar basınca çıkarıyor), dokunulmadı.
- **Büyük karar bekliyor (koda dökülmedi):** P1-T1 (Vite/build pipeline — BUL/DEĞİŞTİR iş akışının tamamını değiştirir), P1-T2 (CSP header — GitHub Pages'ten Cloudflare/Netlify'a taşınmayı gerektirir), P1-B1 (tuzak public landing sayfası — tuzak'ın geleceği belirsizken erken).
- **Henüz bakılmadı:** P1-U1 (erişilebilirlik taraması), P1-U2 (offline banner), P1-B2 (push izni zamanlaması), P2 maddeleri.

### Repo hijyeni
`.gitignore` düzeltildi — eski haliyle `supabasepas.txt` diye YANLIŞ yazılmıştı (gerçek dosya `supabasepw.txt`), hiç eşleşmiyordu. Düzeltildi + `kesif_*.py`, `kesif_a101_ham.html`, `a101_pilot_*.py`, `migrate_*.py`, `data/a101_*.json` eklendi. Bu dosyalar hâlâ diskte duruyor (silinmedi, sadece artık git tarafından görmezden geliniyor) — silme/taşıma kararı ayrı, henüz verilmedi.

---

## Bekleyen / ertelenen işler

- **P1-U1, P1-U2, P1-B2, P2 maddeleri** — MiniMax dokümanında var, henüz bakılmadı.
- **KVKK aydınlatma metni** — uygulama bitince eklenecek (Mustafa kararı).
- **OG image (og:image/twitter:image)** — gerçek tasarlanmış görsel yok, meta tag'leri şimdilik görselsiz.
- **A101 Kapıda entegrasyonu** — pilot scraper hazır (`a101_pilot_scraper.py`, artık gitignore'da), DB'ye nasıl/ayrı etiketli mi ekleneceği kararı bekliyor.
- **Sahte indirim rozetinin UI'da gösterilmesi** — puanlama çalışıyor ve DB'de birikiyor, ama henüz hiçbir ekranda kullanıcıya gösterilmiyor. Birkaç gün/hafta veri biriktikten sonra (false-positive oranını gözlemlemek için) rozet tasarımına geçilebilir.
- **Shrinkflation analizi** — 3-6 ay `agirlik_hacim_gecmisi` verisi birikmeden başlamaz.
- **kesif_*/migrate_*/a101_pilot_* dosyaları** — artık gitignore'da ama diskte duruyor, silme kararı Mustafa'da.
- **Vite/build pipeline, CSP/hosting migration, tuzak public landing** — büyük kararlar, tartışılmadı.

---

## Kritik öğrenmeler

- **PostgREST upsert, kısmi kolon seti ile NOT NULL ihlali verir.** `POST /rest/v1/table?on_conflict=col` ile upsert, sadece birkaç kolon gönderirsen bile arka planda `INSERT ... ON CONFLICT DO UPDATE` çalıştırır — INSERT tarafı tablo şemasındaki NOT NULL kolonlar için değer ister, UPDATE'e düşecek olsa bile. Sadece var olan satırları güncelleyecek toplu yazma işlerinde bunun yerine özel bir SQL fonksiyonu yaz: `UPDATE ... FROM jsonb_to_recordset($1) AS x(...) WHERE tablo._sid = x._sid` — asla INSERT denemez. (`indirim_analiz.py` bunu yaşayıp düzeltti: 0/14418 yazma → RPC'ye geçince tam başarı.)
- **Windows PowerShell `&&` desteklemiyor** — `;` kullan veya komutları ayrı sat gönder. Birden fazla escape'li tırnaklı `findstr` komutunu `;` ile birleştirmek parser'ı bozabilir (tırnak/parantez çakışması) — her `findstr`'ı kendi satırında/ayrı çağrıda çalıştır.
- **Scraper tam koşusu ~2 saat sürüyor** (20-25 dakika değil — bu yanlış tahmin edilmişti). Manuel workflow tetikleme kararı verirken bunu hesaba kat.
- **GitHub Actions log UI, uzun/ağır job'larda** ("Run python scraper.py" gibi 2 saatlik adımlar) tüm job'un loglarını "truncated due to large size" gösterir, normal step-tıkla-genişlet çalışmaz. "View raw logs" linkinin verdiği signed blob URL'ine git, DOM'dan hedef metni ara (`document.body.textContent.indexOf(...)` gibi dar/hedefli aramalarla — geniş dump'lar "cookie/query string" güvenlik filtresine takılabilir).
- **Smooth scroll (`scrollTo({behavior:'smooth'})` ve CSS `scroll-behavior:smooth`) otomatik tarayıcı testinde (Claude in Chrome/CDP) hiç animasyonlanmıyor** — `behavior:'auto'` (anlık) çalışıyor ama smooth hiç scrollLeft değiştirmiyor. Muhtemelen otomasyon ortamına özgü, gerçek kullanıcıda sorun olmaz — ama bu, "scroll pozisyonunu okuyup state çıkarma" pattern'inin KIRILGAN olduğunu da gösterdi (onboarding'de "İleri" butonu bu yüzden takılıyordu). Ders: sayfa/adım takibini scroll pozisyonundan DEĞİL, kendi tuttuğun bir sayaçtan yap; scroll sadece görsel yan etki olsun.
- **`marketfiyati.json` (ayrı, üst düzey dosya) bayat/farklı bir kaynak** — sadece 888 kayıttan 15'i güncel kategori dosyalarıyla aynı `_sid`'e sahip. Hâlâ `marketfiyatiYukle()`/productMap fallback için kullanılıyor, dokunulmadı ama biliniyor (urunler.json gibi bir sonraki temizlik adayı).
- **Stash cycle, prompt yarıda kesilirse asılı kalabilir.** Bir prompt çalışması stash push yapıp pop'a ulaşmadan durursa, BİR SONRAKİ prompt'un stash push'ı "boş" der (çünkü zaten stash'te) ve pop'u o eski/asılı stash'i açar — çelişkili görünür ama zararsızdır. Bu oturumda CLAUDE.md/sync_db.py'nin kalıcı leftover'ı `git checkout --` ile temizlenip bu döngü sonlandırıldı; artık stash cycle'a gerek yok (dosyalar temiz).
- **`urunler.json` gibi "artık kimsenin okumadığı ama hâlâ üretilen" dosyalar bir tuzak** — iki kere (DB migration, edge function) yanlışlıkla kaynak alınmış. Kural: yeni bir özellik yazarken önce `grep` ile gerçekten kim okuyor/yazıyor diye bak, dokümantasyona/hafızaya güvenme.

---

## Yaklaşım & desenler

- **SW cache version** her anlamlı index.html/sw.js değişikliğinde artırılır (şu an v140). Git stash cycle artık gerekmiyor (CLAUDE.md/sync_db.py temiz) — sadece `git add` → `git commit` → `git pull --rebase` → `git push`.
- **Commit doğrulama:** Her push sonrası `raw.githubusercontent.com` üzerinden commit-SHA-pinned URL ile içerik doğrulanır, sonra canlıda (Browser MCP) gerçek fonksiyonel test yapılır — sadece "dosyada var mı" değil, "gerçekten çalışıyor mu" (ör. modalAc() DOM'da doğru render oluyor mu, RPC gerçekten veri döndürüyor mu, onboarding baştan sona ilerliyor mu).
- **Kapsam disiplini:** İstenmeyen ekleme/çıkarma yapılmadan önce not düşülür, sessizce yapılmaz. Doküman/analiz önerileri körü körüne uygulanmaz — önce kodda gerçekten geçerli mi diye bakılır (bu oturumda birçok "bulgu" eskiydi/yanlıştı).
- **Büyük ürün/mimari kararları** (build pipeline, hosting migration, nav yapısı, onboarding var/yok, tuzak'ın geleceği) Mustafa'nın onayı olmadan koda dökülmez — sadece küçük/orta teknik düzeltmeler doğrudan yapılır.
- **OpenCode prompt yapısı:** Tam BUL/DEĞİŞTİR blokları + SW version bump + doğrulama komutları (tek tek, `;` ile birleştirilmeden) + ham terminal çıktısı istenir, özetlenmez.

---

## Araçlar & kaynaklar

- **OpenCode** — dosya düzenlemeleri (Windows CMD/PowerShell)
- **Supabase** — auth, DB, Edge Functions, RPC (`get_fiyat_dusenler`, `indirim_puan_toplu_guncelle`, `jsonb_fiyat_max` yardımcı fonksiyonu)
- **GitHub Actions** (`update-data.yml`) — sıra: checkout → scraper.py (~2 saat) → hal_scraper.py → veri commit'i → **DB Senkronizasyonu** (sync_db.py) → **Sahte Indirim Analizi** (indirim_analiz.py, yeni) → Pages Deploy → Fiyat Alarmı Taraması
- **GoatCounter** (`pazar-app.goatcounter.com`, hesap adı `pazar-app`) — analytics, kartsız/ücretsiz, çerezsiz
- **Claude in Chrome (Browser MCP)** — canlı doğrulama; smooth-scroll'un bu ortamda çalışmadığını unutma, state takibini scroll'a değil sayaca dayandır
- **raw.githubusercontent.com** — commit-SHA-pinned URL ile içerik doğrulama

---

## Diğer talimatlar

- Mustafa Android kullanmıyor — iOS ve web (masaüstü Chrome) üzerinden test ediyor.
- CLAUDE.md sohbete asla ham metin olarak yapıştırılmaz, sadece dosya olarak paylaşılır.
