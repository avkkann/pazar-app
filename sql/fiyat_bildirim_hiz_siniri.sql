-- ═══════════════════════════════════════════════════════════════════════
-- fiyat_bildirim — SUNUCU TARAFI HIZ SINIRI
-- Hazirlayan: denetim 2026-08-11.  BU DOSYAYI BEN CALISTIRMADIM.
-- Supabase SQL Editor'de sirayla calistir; her blogun basindaki notu oku.
-- ═══════════════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────────────────
-- 0) ONCE TEMIZLIK — DENETIM SIRASINDA YANLISLIKLA YAZILAN SATIR
-- ───────────────────────────────────────────────────────────────────────
-- Izin sondasi yaparken {"_sid":"x","market":"bim"} yuku 201 ile gecti ve
-- muhtemelen BIR SATIR olustu. anon rolunun DELETE yetkisi yok (401), bu
-- yuzden temizleyemedim. Once bak, sonra sil:

SELECT * FROM public.fiyat_bildirim WHERE _sid = 'x';

-- Yukaridaki sorgu satir donduruyorsa:
-- DELETE FROM public.fiyat_bildirim WHERE _sid = 'x' AND market = 'bim';


-- ───────────────────────────────────────────────────────────────────────
-- 1) MEVCUT DURUM — esigi VERIYE bakarak secmek icin
-- ───────────────────────────────────────────────────────────────────────
-- Denetimde bu sayilari OKUYAMADIM (anon GET 401, RPC suzulmus sonuc
-- donuyor). Asagidaki esik onerisi bu yuzden gozlemden DEGIL, uygulamanin
-- KENDI mevcut kuralindan turetildi (bkz. 2. blok). Once bunlari kosur ve
-- sayilar farkli cikarsa esigi ona gore ayarla:

SELECT count(*) AS toplam_satir FROM public.fiyat_bildirim;

SELECT date_trunc('day', created_at) AS gun, count(*) AS adet
FROM public.fiyat_bildirim
GROUP BY 1 ORDER BY 1 DESC LIMIT 30;

-- Ayni _sid+market icin gunde birden fazla bildirim gelmis mi (supheli desen):
SELECT _sid, market, date_trunc('day', created_at) AS gun, count(*) AS adet
FROM public.fiyat_bildirim
GROUP BY 1,2,3 HAVING count(*) > 1
ORDER BY adet DESC LIMIT 50;

-- Tek gunde cok bildirim atan kaynak var mi (IP kolonu varsa):
-- SELECT ip, count(*) FROM public.fiyat_bildirim
-- WHERE created_at > now() - interval '1 day' GROUP BY 1 ORDER BY 2 DESC LIMIT 20;


-- ───────────────────────────────────────────────────────────────────────
-- 2) ESIK — NEREDEN GELIYOR (uydurulmadi)
-- ───────────────────────────────────────────────────────────────────────
-- app.js:2451-2456 zaten sunu yapiyor:
--     const anahtar = 'fb_' + u._sid + '_' + market;
--     if (Date.now() - onceki < 86400000) -> "Bu urun icin bildirimin zaten alindi"
-- Yani uygulamanin KENDI kurali: ayni _sid+market icin 24 saatte 1 bildirim.
-- Ama bu localStorage'da, yani gercek bir sinir degil — temizle, gec.
-- Asagidaki trigger AYNI KURALI sunucuda uygular. Yeni bir politika
-- icat etmiyor, var olani zorunlu kiliyor.
--
-- Ikinci sinir (gunluk toplam) icin 1. bloktaki sayilara bak. Bugunku
-- hacmi bilmeden sayi yazmadim; asagida GUNLUK_TAVAN'i sen doldur.


-- ───────────────────────────────────────────────────────────────────────
-- 3) TRIGGER — ayni _sid+market icin 24 saatte 1 bildirim
-- ───────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fiyat_bildirim_hiz_siniri()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  son_kayit timestamptz;
BEGIN
  SELECT max(created_at) INTO son_kayit
  FROM public.fiyat_bildirim
  WHERE _sid = NEW._sid
    AND market = NEW.market
    AND created_at > now() - interval '24 hours';

  IF son_kayit IS NOT NULL THEN
    RAISE EXCEPTION
      'Bu urun ve market icin son 24 saatte zaten bildirim alindi'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_fiyat_bildirim_hiz ON public.fiyat_bildirim;
CREATE TRIGGER trg_fiyat_bildirim_hiz
  BEFORE INSERT ON public.fiyat_bildirim
  FOR EACH ROW EXECUTE FUNCTION public.fiyat_bildirim_hiz_siniri();


-- ───────────────────────────────────────────────────────────────────────
-- 4) IKINCI KATMAN — genel gunluk tavan (ISTEGE BAGLI)
-- ───────────────────────────────────────────────────────────────────────
-- 3. blok tek bir _sid+market'i korur ama saldirgan 16.807 farkli _sid ile
-- yine 16.807 satir yazabilir. Toplam tavan icin:
-- GUNLUK_TAVAN degerini 1. bloktaki gercek hacme bakarak doldur
-- (ornegin normal gunluk hacmin 10 kati).

-- CREATE OR REPLACE FUNCTION public.fiyat_bildirim_gunluk_tavan()
-- RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
-- DECLARE
--   bugun_adet int;
--   GUNLUK_TAVAN constant int := <<BURAYA_SAYI>>;
-- BEGIN
--   SELECT count(*) INTO bugun_adet FROM public.fiyat_bildirim
--   WHERE created_at > now() - interval '24 hours';
--   IF bugun_adet >= GUNLUK_TAVAN THEN
--     RAISE EXCEPTION 'Gunluk bildirim tavani asildi' USING ERRCODE = 'check_violation';
--   END IF;
--   RETURN NEW;
-- END; $$;
--
-- DROP TRIGGER IF EXISTS trg_fiyat_bildirim_tavan ON public.fiyat_bildirim;
-- CREATE TRIGGER trg_fiyat_bildirim_tavan
--   BEFORE INSERT ON public.fiyat_bildirim
--   FOR EACH ROW EXECUTE FUNCTION public.fiyat_bildirim_gunluk_tavan();


-- ───────────────────────────────────────────────────────────────────────
-- 5) KOLON DOGRULAMA — sema sondasindan cikan
-- ───────────────────────────────────────────────────────────────────────
-- Denetimde kisit hatalarindan sunlar dogrulandi:
--   _sid    : var
--   market  : var, NOT NULL
--   fiyat_tl: YOK (PGRST204)
-- created_at kolonunun ADI farkliysa 3. ve 4. bloklarda degistir:
-- SELECT column_name, data_type, is_nullable
-- FROM information_schema.columns
-- WHERE table_schema='public' AND table_name='fiyat_bildirim' ORDER BY ordinal_position;


-- ───────────────────────────────────────────────────────────────────────
-- 6) TRIGGER SONRASI DOGRULAMA
-- ───────────────────────────────────────────────────────────────────────
-- Ayni yuku iki kez gonderirsen ikincisi 'check_violation' ile reddedilmeli:
--   curl -X POST "$SUPABASE_URL/rest/v1/fiyat_bildirim" \
--     -H "apikey: $ANON" -H "Authorization: Bearer $ANON" \
--     -H "Content-Type: application/json" -H "Prefer: return=minimal" \
--     -d '{"_sid":"__test__","market":"bim"}'
-- Sonra temizle:
--   DELETE FROM public.fiyat_bildirim WHERE _sid = '__test__';
