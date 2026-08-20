-- ═══════════════════════════════════════════════════════════════════════
-- fiyat_bildirim — SUNUCU TARAFI HIZ SINIRI
-- Taslak: denetim 2026-08-11.  Sema/mantik duzeltmesi: 2026-08-20.
-- BU DOSYA HENUZ CALISTIRILMADI. Supabase SQL Editor'de sirayla kosur;
-- once tani bloklarini (0,1) oku, sonra trigger'i (3) uygula.
--
-- GERCEK SEMA (2026-08-20 dogrulandi):
--   public.fiyat_bildirim(
--     id               bigint,
--     _sid             text,
--     market           text,
--     gosterilen_fiyat numeric,
--     bildirilen_fiyat numeric,
--     kullanici_id     uuid,
--     olusturma        timestamptz default now())
-- Mevcut yetki: policy "kendi bildirimini ekler" — TO authenticated,
--   WITH CHECK (kullanici_id = auth.uid()); anon'un hicbir yetkisi yok;
--   authenticated yalnizca INSERT (SELECT policy YOK).
--
-- 11.08 TASLAGINA GORE DUZELTMELER:
--   - created_at -> olusturma          (dogru kolon adi)
--   - fiyat_tl (PGRST204'te "yok" sanilan) -> gercekte gosterilen_fiyat +
--     bildirilen_fiyat (numeric); ayrica kullanici_id (uuid), id (bigint).
--   - ip kolonu YOK -> ip'ye dayali tani sorgusu kaldirildi.
--   - anahtar _sid+market -> kullanici_id+_sid+market (PER-USER). Eski hali
--     iki FARKLI kullanicinin ayni urun+market'i bildirmesini engelliyordu,
--     bu YANLISTI. kullanici_id artik auth.uid()'e bagli oldugu icin
--     per-user sinir hem anlamli hem dogru.
--   - ikinci katman "global gunluk tavan" -> PER-USER gunluk tavan.
--   - trigger SET search_path = '' (en siki; tam-nitelikli referanslar).
-- ═══════════════════════════════════════════════════════════════════════


-- ───────────────────────────────────────────────────────────────────────
-- 0) ONCE TEMIZLIK — denetim/test sirasinda olusmus olabilecek satirlar
-- ───────────────────────────────────────────────────────────────────────
SELECT id, _sid, market, kullanici_id, olusturma
FROM public.fiyat_bildirim
WHERE _sid IN ('x', '__test__');

-- Yukaridaki satir donduruyorsa:
-- DELETE FROM public.fiyat_bildirim WHERE _sid IN ('x', '__test__');


-- ───────────────────────────────────────────────────────────────────────
-- 1) MEVCUT DURUM — hacim sorgulari (gelecekteki esik degerlendirmesi icin)
--    Uc sorgu: A tek-satir ozet (butun skaler metrikler), B top-10 patlama,
--    C NULL _sid cakismasi.
-- ───────────────────────────────────────────────────────────────────────
-- ╔═══════════════════════════════════════════════════════════════════════╗
-- ║ ESIK VERIDEN SECILMEDI (20.08.2026). Olcum kosuldu, tablo BOSTU (tek   ║
-- ║ test satiri, gunluk en yuksek 1). PER_USER_GUNLUK_TAVAN = 30 tavani    ║
-- ║ MUHAKEMEYLE secildi: asil koruma Layer 1 (ayni kullanici+urun+market   ║
-- ║ 24s'de 1); Layer 2 yalnizca emniyet supabi. Gercek trafik olusunca     ║
-- ║ 'olusturma' verisinden (asagidaki A/B) YENIDEN degerlendirilecek.      ║
-- ║ BU NOTU SILMEDEN esigi "olculmus" SAYMA.                               ║
-- ║ Not: tablo su an bos oldugu icin A/B bugun anlamli sayi VERMEZ         ║
-- ║ (burst24_* NULL/0, yeterlilik = "az veri"). Sorgular veri birikince    ║
-- ║ islevsel — simdi kosman GEREKMIYOR.                                    ║
-- ╚═══════════════════════════════════════════════════════════════════════╝

-- ── SORGU A — TEK SATIR OZET (butun skaler metrikler) ──────────────────
-- Cikti: 1 satir. Dagilim metrikleri TRIGGER ILE AYNI PENCEREDEN gelir:
-- kullanici basina KAYAN 24 saatlik max patlama (takvim gunu DEGIL — trigger
-- de kayan 24s kullaniyor, iki farkli sayi birakmiyoruz). Kolonlar:
--   toplam_kayit, benzersiz_kullanici,
--   burst24_medyan, burst24_p90, burst24_p99, burst24_max
--     (kullanici-basi kayan-24s max patlama dagilimi; PER_USER_GUNLUK_TAVAN
--      esigini BUNA gore sec)
--   null_sid_kayit,    (Layer 1 NULL _sid riski)
--   layer1_ust_sinir,  (asagida: gercek engellemenin UST SINIRI)
--   yeterlilik         (az veri -> yuzdelikler istatistiksel anlamsiz uyarisi)
WITH pencere AS (
  -- Her kayit icin: o kullanicinin ONCEKI 24 saatteki kayit sayisi (kayan).
  SELECT kullanici_id,
    count(*) OVER (PARTITION BY kullanici_id ORDER BY olusturma
      RANGE BETWEEN interval '24 hours' PRECEDING AND CURRENT ROW) AS pencere_adet
  FROM public.fiyat_bildirim
),
kullanici_max AS (
  -- Kullanici basina EN YUKSEK kayan-24s patlama. Dagilim BUNDAN turetiliyor.
  SELECT kullanici_id, max(pencere_adet) AS max_24s
  FROM pencere GROUP BY kullanici_id
),
tekrar AS (
  SELECT olusturma - lag(olusturma) OVER (
           PARTITION BY kullanici_id, _sid, market ORDER BY olusturma) AS fark
  FROM public.fiyat_bildirim
)
SELECT
  (SELECT count(*) FROM public.fiyat_bildirim)                     AS toplam_kayit,
  (SELECT count(DISTINCT kullanici_id) FROM public.fiyat_bildirim) AS benzersiz_kullanici,
  (SELECT percentile_cont(0.5)  WITHIN GROUP (ORDER BY max_24s) FROM kullanici_max) AS burst24_medyan,
  (SELECT percentile_cont(0.9)  WITHIN GROUP (ORDER BY max_24s) FROM kullanici_max) AS burst24_p90,
  (SELECT percentile_cont(0.99) WITHIN GROUP (ORDER BY max_24s) FROM kullanici_max) AS burst24_p99,
  (SELECT max(max_24s) FROM kullanici_max)                        AS burst24_max,
  (SELECT count(*) FROM public.fiyat_bildirim WHERE _sid IS NULL) AS null_sid_kayit,
  -- lag-tabanli sayim: engellenen satirlarin tabloda KALDIGINI varsayar
  -- (gercekte trigger onlari hic yazmazdi, dolayisiyla ardisik tekrarlar
  -- birbirini de sayar) -> gercek engelleme sayisinin UST SINIRI, kesin sayi
  -- degil.
  (SELECT count(*) FROM tekrar WHERE fark IS NOT NULL
                                 AND fark < interval '24 hours')  AS layer1_ust_sinir,
  CASE
    WHEN (SELECT count(*) FROM public.fiyat_bildirim) < 50
      OR (SELECT count(DISTINCT kullanici_id) FROM public.fiyat_bildirim) < 10
    THEN 'UYARI: az veri (kayit<50 veya kullanici<10) — yuzdelikler anlamsiz'
    ELSE 'yeterli'
  END                                                             AS yeterlilik;

-- ── SORGU B — kullanici basina EN YUKSEK 24s pencere (top 10) ──────────
-- Cikti: en fazla 10 satir (kullanici_id, max_24s). Layer 2 tavaninin (30)
-- gercek en-agir kullaniciyi engelleyip engellemeyecegini gosterir.
SELECT kullanici_id, max(pencere_adet) AS max_24s
FROM (
  SELECT kullanici_id,
    count(*) OVER (PARTITION BY kullanici_id ORDER BY olusturma
      RANGE BETWEEN interval '24 hours' PRECEDING AND CURRENT ROW) AS pencere_adet
  FROM public.fiyat_bildirim
) t
GROUP BY kullanici_id
ORDER BY max_24s DESC
LIMIT 10;

-- ── SORGU C — NULL _sid cakismasi (IS NOT DISTINCT FROM mesru mu?) ──────
-- Ayni (kullanici_id, market)'te birden fazla NULL _sid kaydi VARSA, Layer 1
-- (IS NOT DISTINCT FROM NULL) o kullaniciyi bloklardi. Bos donerse yazim guvenli.
-- Cikti: 0+ satir (kullanici_id, market, null_sid_adet).
SELECT kullanici_id, market, count(*) AS null_sid_adet
FROM public.fiyat_bildirim
WHERE _sid IS NULL
GROUP BY 1, 2 HAVING count(*) > 1
ORDER BY null_sid_adet DESC
LIMIT 20;


-- ───────────────────────────────────────────────────────────────────────
-- 2) SINIR MANTIGI — ne, neden, hangi pencere (net)
-- ───────────────────────────────────────────────────────────────────────
-- Layer 1 — (kullanici_id, _sid, market) icin SON 24 SAATTE 1 bildirim.
--   app.js zaten localStorage'da 'fb_<sid>_<market>' 24s sogumasi yapiyor,
--   ama o istemci tarafi (temizlenebilir / baska cihaz). Bu, ayni kurali
--   sunucuda PER-USER zorunlu kilar. Anahtar kullanici_id ICERIR: iki farkli
--   kullanici ayni urun+market'i bildirebilir; ayni kullanici gunde 1 kez.
--
-- Layer 2 — bir kullanici SON 24 SAATTE en fazla PER_USER_GUNLUK_TAVAN kayit.
--   KARAR = 30/gun/kullanici (20.08.2026). VERIDEN SECILMEDI — tablo bostu
--   (bkz. blok 1 notu); MUHAKEMEYLE secildi:
--   Gerekce: mesru kullanici bir alisveriste birkac urunun fiyatinin
--   tutmadigini bildirebilir; 30 bol bir tavan (tipik kullanici 1-3). Asil
--   koruma zaten Layer 1; Layer 2 yalnizca emniyet supabi.
--   Etki: bir hesabi 30/gun ile sinirlar (ONCE SINIRSIZDI). Katalog 16.807
--   urun; eskiden tek authenticated hesap 16.807 satir yazabiliyordu, artik
--   30. 16.807'ye ulasmak icin ~560 dogrulanmis hesap gerekir.
--   YENIDEN DEGERLENDIRME: gercek trafik olusunca blok 1'i (burst24_p99/max)
--   kosup tavani ona gore ayarla. Kalici deger blok 3'teki coalesce VARSAYILANI
--   (30) — tek yerde; degistirmek icin orayi degistir. (Test icin gecici dusurme
--   GUC ile, kalici degeri bozmadan; bkz. blok 6.)


-- ───────────────────────────────────────────────────────────────────────
-- 3) TRIGGER — Layer 1 + Layer 2 tek fonksiyonda
-- ───────────────────────────────────────────────────────────────────────
-- SECURITY DEFINER ZORUNLU: authenticated rolunun SELECT policy'si YOK, yani
--   RLS altinda trigger mevcut satirlari GOREMEZ (count 0 doner, sinir hic
--   tetiklenmez). Definer, tabloyu owner haklariyla okuyup dogru sayar.
-- SET search_path = '' : en siki. Tum tablo referanslari tam-nitelikli
--   (public.fiyat_bildirim); now()/count()/interval pg_catalog'dan ortuk
--   gelir. Boylece SECURITY DEFINER'da sema-kacirma (public.now() vb.) yuzeyi
--   yok.
CREATE OR REPLACE FUNCTION public.fiyat_bildirim_hiz_siniri()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  -- KALICI VARSAYILAN 30 (GUC 'app.fb_gunluk_tavan' AYARSIZKEN). Kalici deger
  -- bu 30 literal'i; degistirmek icin BURAYI degistir. Test icin GECICI dusurme:
  -- transaction icinde `SET LOCAL app.fb_gunluk_tavan = '2'` -> trigger onu okur,
  -- kalici deger DEGISMEZ (GUC reset/commit sonrasi yine 30). Bkz. blok 6.
  PER_USER_GUNLUK_TAVAN constant int :=
    coalesce(nullif(current_setting('app.fb_gunluk_tavan', true), '')::int, 30);
  ayni_var  boolean;
  bugun_adet int;
BEGIN
  -- Policy kullanici_id = auth.uid() zorunlu kiliyor; yine de savunma:
  IF NEW.kullanici_id IS NULL THEN
    RAISE EXCEPTION 'kullanici_id zorunlu'
      USING ERRCODE = 'not_null_violation';
  END IF;

  -- Layer 1: ayni kullanici + urun + market, son 24 saatte var mi?
  -- (_sid NULL olabilir; IS NOT DISTINCT FROM NULL=NULL'i eslestirir.)
  SELECT EXISTS (
    SELECT 1 FROM public.fiyat_bildirim
    WHERE kullanici_id = NEW.kullanici_id
      AND _sid IS NOT DISTINCT FROM NEW._sid
      AND market = NEW.market
      AND olusturma > now() - interval '24 hours'
  ) INTO ayni_var;

  IF ayni_var THEN
    -- SQLSTATE 'PT409' -> PostgREST HTTP 409 Conflict, govde "code" = "PT409".
    -- (Layer 1 = duplicate.) 'FB' sinifi standart-ayrilmis araliktaydi (F);
    -- PT4xx hem o araligin disinda hem de dogru HTTP durumunu ayarliyor.
    -- Kullaniciya gosterilen metin ISTEMCIDE koda gore sabitlenir (blok 4).
    RAISE sqlstate 'PT409' USING
      message = 'Layer1 duplicate: ayni kullanici+_sid+market 24s icinde';
  END IF;

  -- Layer 2: kullanicinin son 24 saatteki toplam kayit sayisi
  SELECT count(*) INTO bugun_adet
  FROM public.fiyat_bildirim
  WHERE kullanici_id = NEW.kullanici_id
    AND olusturma > now() - interval '24 hours';

  IF bugun_adet >= PER_USER_GUNLUK_TAVAN THEN
    -- SQLSTATE 'PT429' -> PostgREST HTTP 429 Too Many Requests, "code" = "PT429".
    -- (Layer 2 = per-user gunluk tavan.) Mesaj log icin; UI koda gore sabit.
    RAISE sqlstate 'PT429' USING
      message = format('Layer2 cap: per-user 24s tavan (%s) asildi', PER_USER_GUNLUK_TAVAN);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_fiyat_bildirim_hiz ON public.fiyat_bildirim;
CREATE TRIGGER trg_fiyat_bildirim_hiz
  BEFORE INSERT ON public.fiyat_bildirim
  FOR EACH ROW EXECUTE FUNCTION public.fiyat_bildirim_hiz_siniri();


-- ───────────────────────────────────────────────────────────────────────
-- 3b) INDEKSLER — trigger'in her INSERT'te kostugu iki sorguyu hizlandirir
-- ───────────────────────────────────────────────────────────────────────
-- ONCE MEVCUT INDEKSLERI OL: asagidaki iki indeks (ayni kolonlarla, isim
-- farkli olsa bile) zaten varsa TEKRAR EKLEME. Bu SELECT'i kosur, indexdef'e
-- bak; ayni kolon dizilisini goruyorsan alttaki CREATE'leri ATLA.
SELECT indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public' AND tablename = 'fiyat_bildirim'
ORDER BY indexname;

-- Layer 2 sayimi icin: WHERE kullanici_id = X AND olusturma > now()-24h
CREATE INDEX IF NOT EXISTS ix_fb_kullanici_olusturma
  ON public.fiyat_bildirim (kullanici_id, olusturma);

-- Layer 1 EXISTS icin: WHERE kullanici_id = X AND _sid [NOT DISTINCT]
--   AND market = Y AND olusturma > now()-24h
CREATE INDEX IF NOT EXISTS ix_fb_kullanici_sid_market_olusturma
  ON public.fiyat_bildirim (kullanici_id, _sid, market, olusturma);

-- NOT: CREATE INDEX IF NOT EXISTS yalniz AYNI ISIMLI indeks varsa atlar; ayni
--   kolonlu FARKLI isimli indeks varsa (yukaridaki SELECT'te gorursun) bunlari
--   KOSMA — gereksiz cift indeks INSERT yukunu artirir.


-- ───────────────────────────────────────────────────────────────────────
-- 4) ISTEMCI HATA GOSTERIMI — olculdu (app.js fiyatBildirAc)
-- ───────────────────────────────────────────────────────────────────────
-- INSERT payload'i sema ile birebir: _sid, market, gosterilen_fiyat,
--   bildirilen_fiyat, kullanici_id (= _user.id). olusturma gonderilmiyor
--   (DB default now()).
-- Su anki hata dali JENERIK: `if (error) toastGoster('Bildirim gonderilemedi')`.
-- Layer 1 -> PT409, Layer 2 -> PT429 (AYRI kod); istemci error.code'a gore
--   SABIT Turkce metin esler (UI metni SQL RAISE'ine baglanmaz; error.message
--   ham gosterilmez). Onerilen (app.js fiyatBildirAc, insert sonrasi):
--
--     if (error) {
--       const M = {
--         PT409: 'Bu urun icin son 24 saatte zaten bildirim aldik.',
--         PT429: 'Gunluk bildirim sinirina ulastin, yarin tekrar dene.',
--       };
--       toastGoster(M[error.code] || 'Bildirim gonderilemedi');
--       return;
--     }
--
--   error.code = PostgREST error govdesindeki "code" (= "PT409"/"PT429";
--   supabase-js PostgrestError.code). Sabit metin haritasi UI'da; SQL mesaji
--   yalniz log.
--
-- POSTGREST HTTP ESLEMESI (docs.postgrest.org/errors — 2026-08-20 okundu):
--   'PTxyz' mekanizmasi: xyz = 3 haneli HTTP status. PT409 -> HTTP 409
--   Conflict, PT429 -> HTTP 429 Too Many Requests; govde "code" = "PT409"/
--   "PT429" (korunur), message/detail/hint da korunur. FB* (class F) standart-
--   ayrilmis araliktaydi; PT4xx hem disinda hem dogru status'u veriyor.
--   Yine de KENDI PostgREST surumunde TEYIT ET (blok 6b): bazi surumlerde
--   PTxyz ile "code" alaninin dustugu bildirilmis — code'un geldigini ve
--   status'un 409/429 oldugunu curl -i ile dogrula.


-- ───────────────────────────────────────────────────────────────────────
-- 5) KOLON DOGRULAMA (uygulamadan once bir kez kosur, semayi teyit et)
-- ───────────────────────────────────────────────────────────────────────
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'fiyat_bildirim'
ORDER BY ordinal_position;
-- Beklenen: id bigint, _sid text, market text, gosterilen_fiyat numeric,
--   bildirilen_fiyat numeric, kullanici_id uuid, olusturma timestamptz.


-- ───────────────────────────────────────────────────────────────────────
-- 6) TRIGGER SONRASI DOGRULAMA — SIRA, KIRLILIK KONTROLU, HTTP OLCUMU
-- ───────────────────────────────────────────────────────────────────────
-- !!! SIRA UYARISI !!! ESIK OLCUMU (blok 1: Sorgu A/B) her zaman testlerden
--   ONCE kosulur — aksi halde test satirlari burst24_max/p99'u sisirir ve
--   tavani KENDI test verimize gore secmis oluruz.
--   BUGUNKU GERCEK (20.08.2026): tablo BOS, olculecek trafik YOK; tavan (30)
--   muhakemeyle secildi (blok 1/2 notlari). Bu sira kurali gercek trafik
--   birikince gecerli olacak. Once olc, sonra
--   test et. (Zaten 6a kirlilik yazMIYOR — rollback; 6b yalniz 1 satir yazar,
--   6c siler.)
--
-- HIPOTEZ (#4) — DOGRULANMADI, 6b bunu OLCECEK:
--   PostgREST docs PTxyz'i FONKSIYON icindeki RAISE baglaminda anlatiyor. Bizim
--   hata TRIGGER'dan, DUZ TABLO INSERT'u sirasinda geliyor. Eslemenin SQLSTATE
--   duzeyinde (nereden RAISE edilirse edilsin) calistigini VARSAYIYORUZ; teyit
--   edilmedi. Sonuclar ve anlamlari (cikti yorumlanirken TAHMIN YURUTME):
--   * BEKLENEN: HTTP 409/429 + govde "code"="PT409"/"PT429". -> Plan aynen gecerli.
--   * ALTERNATIF: HTTP 400 + "code"="PT409"/"PT429" (PTxyz trigger'a uygulanmiyor;
--       PostgREST 400'e dusuruyor AMA SQLSTATE'i code'a koyuyor). -> Istemci code
--       ile AYIRT EDER; yalniz HTTP semantigi (409/429) kaybolur. KABUL EDILEBILIR,
--       geri donulemez degil.
--   * KOTU: govdede "code" HIC yok. -> Istemci Layer1/Layer2 ayrimi IMKANSIZ.
--       PLAN DEGISMELI (ornek: RAISE sqlstate 'PGRST' USING message='{...json...}'
--       ile govdeyi biz kuralim). Tam yaniti + PostgREST surumunu bana getir.
--
-- ── (6a) SQLSTATE TESTI — SQL Editor, KIRLILIK YOK (transaction ROLLBACK) ──
--   Trigger SECURITY DEFINER; SET LOCAL GUC'unu okur. <UID> = kendi auth uid'in.
--   Her blogu ayri kosur; beklenen HATA transaction'i abort eder, ROLLBACK geri
--   alir -> HICBIR satir yazilmaz. (Hata sonrasi ROLLBACK yine calisir; editor
--   otomatik geri almazsa elle `ROLLBACK;` kosur.)
--
--   -- (6a-1) Layer 1 -> beklenen ERROR SQLSTATE PT409:
--   BEGIN;
--     INSERT INTO public.fiyat_bildirim (_sid,market,gosterilen_fiyat,bildirilen_fiyat,kullanici_id)
--       VALUES ('__hiztest__','bim',10,8,'<UID>');   -- 1. ok
--     INSERT INTO public.fiyat_bildirim (_sid,market,gosterilen_fiyat,bildirilen_fiyat,kullanici_id)
--       VALUES ('__hiztest__','bim',10,8,'<UID>');   -- 2. -> ERROR: SQLSTATE PT409
--   ROLLBACK;
--
--   -- (6a-2) Layer 2 -> beklenen ERROR SQLSTATE PT429 (tavan GECICI 2):
--   BEGIN;
--     SET LOCAL app.fb_gunluk_tavan = '2';           -- yalniz bu transaction; kalici 30 durur
--     INSERT INTO public.fiyat_bildirim (_sid,market,gosterilen_fiyat,bildirilen_fiyat,kullanici_id)
--       VALUES ('__hiztest_a__','bim',10,8,'<UID>'); -- 1. ok
--     INSERT INTO public.fiyat_bildirim (_sid,market,gosterilen_fiyat,bildirilen_fiyat,kullanici_id)
--       VALUES ('__hiztest_b__','sok',10,8,'<UID>'); -- 2. ok
--     INSERT INTO public.fiyat_bildirim (_sid,market,gosterilen_fiyat,bildirilen_fiyat,kullanici_id)
--       VALUES ('__hiztest_c__','a101',10,8,'<UID>');-- 3. -> ERROR: SQLSTATE PT429
--   ROLLBACK;
--
-- ── (6b) HTTP MEKANIZMA OLCUMU — surum + status + code (yalniz 1 satir yazar) ──
--   Mekanizma PT409 ile olculur; PT429 AYNI yoldan gecer (mekanizma dogrulaninca
--   429 da ayni davranir), o yuzden 31 satir yazan bir PT429 HTTP testi YOK.
--   GERCEK oturum JWT'si gerekir (anon INSERT edemez): giris yapip DevTools >
--   Network'ten access_token al.
--     TOKEN=<access_token>;  URL=<SUPABASE_URL>;  ANON=<anon_key>;  UID=<auth_uid>
--
--   # (i) PostgREST SURUMU:
--     curl -sD - -o /dev/null "$URL/rest/v1/" -H "apikey: $ANON" \
--       | grep -iE 'server:|proxy-status|postgrest'
--     # Cikmazsa: Supabase panosu > Project Settings > Infrastructure. Surumu yaz.
--
--   # (ii) PT409 (Layer 1): ayni urun+market iki kez; 1.si 1 satir YAZAR (commit),
--   #      2.si reddedilir. IKINCI yanitin status + "code"unu olc:
--     for i in 1 2; do
--       echo "--- istek $i ---"
--       curl -i -sS -X POST "$URL/rest/v1/fiyat_bildirim" \
--         -H "apikey: $ANON" -H "Authorization: Bearer $TOKEN" \
--         -H "Content-Type: application/json" -H "Prefer: return=minimal" \
--         -w '\nHTTP_STATUS=%{http_code}\n' \
--         -d "{\"_sid\":\"__hiztest_http__\",\"market\":\"bim\",\"gosterilen_fiyat\":10,\"bildirilen_fiyat\":8,\"kullanici_id\":\"$UID\"}"
--     done
--   # 2. istek icin: ILK satirdaki "HTTP/.. NNN" + son satir HTTP_STATUS + JSON
--   #   govdedeki "code". Yukaridaki HIPOTEZ tablosuna gore yorumla.
--
-- ── (6c) TEMIZLIK — 6b'nin yazdigi satir(lar)i sil (6a rollback, iz birakmaz) ──
--   Once KAC satir etkilenecek GOR (beklenen: 6b'den 1). Test _sid'leri ayirt
--   edilebilir ('__hiztest' onekli); gercek urun _sid'leri boyle baslamaz:
SELECT count(*) AS silinecek FROM public.fiyat_bildirim WHERE _sid LIKE '\_\_hiztest%';
--   Sayi bekledigin gibiyse sil:
-- DELETE FROM public.fiyat_bildirim WHERE _sid LIKE '\_\_hiztest%';
