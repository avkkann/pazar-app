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
-- 1) MEVCUT DURUM — esikleri VERIYE bakarak dogrula (uydurma degil)
-- ───────────────────────────────────────────────────────────────────────
SELECT count(*) AS toplam_satir FROM public.fiyat_bildirim;

-- Gunluk hacim:
SELECT date_trunc('day', olusturma) AS gun, count(*) AS adet
FROM public.fiyat_bildirim
GROUP BY 1 ORDER BY 1 DESC LIMIT 30;

-- Ayni kullanici gunde kac bildirim atmis? (Layer 2 tavani icin EN KRITIK
-- sayi budur — 30 onerisini buna gore ayarla):
SELECT kullanici_id, date_trunc('day', olusturma) AS gun, count(*) AS adet
FROM public.fiyat_bildirim
GROUP BY 1, 2 HAVING count(*) > 5
ORDER BY adet DESC LIMIT 50;

-- Ayni kullanici+urun+market gunde birden fazla mi? (Layer 1 ihlali adayi):
SELECT kullanici_id, _sid, market, date_trunc('day', olusturma) AS gun, count(*) AS adet
FROM public.fiyat_bildirim
GROUP BY 1, 2, 3, 4 HAVING count(*) > 1
ORDER BY adet DESC LIMIT 50;


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
--   ONERI = 30/gun/kullanici.
--   Gerekce: mesru kullanici bir alisveriste birkac urunun fiyatinin
--   tutmadigini bildirebilir; 30 bol bir tavan (tipik kullanici 1-3).
--   Etki: bir hesabi 30/gun ile sinirlar (ONCE SINIRSIZDI). Katalog 16.807
--   urun; eskiden tek authenticated hesap 16.807 satir yazabiliyordu, artik
--   30. 16.807'ye ulasmak icin ~560 dogrulanmis hesap gerekir.
--   AYAR: 1. bloktaki "ayni kullanici gunde kac" gercek sayisi 30'u asiyorsa
--   tavani yukselt (mesru kullaniciyi engelleme); cok altindaysa 15-20'ye
--   dusur. Deger asagida tek yerde (constant) — SANA BIRAKIYORUM, tartisalim.


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
  PER_USER_GUNLUK_TAVAN constant int := 30;   -- Layer 2 (bkz. blok 2)
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
    RAISE EXCEPTION 'Bu urun ve market icin son 24 saatte zaten bildirim aldik'
      USING ERRCODE = 'check_violation';
  END IF;

  -- Layer 2: kullanicinin son 24 saatteki toplam kayit sayisi
  SELECT count(*) INTO bugun_adet
  FROM public.fiyat_bildirim
  WHERE kullanici_id = NEW.kullanici_id
    AND olusturma > now() - interval '24 hours';

  IF bugun_adet >= PER_USER_GUNLUK_TAVAN THEN
    RAISE EXCEPTION 'Gunluk bildirim sinirina ulastin (24 saat sonra tekrar dene)'
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
-- 4) ISTEMCI HATA GOSTERIMI — olculdu (app.js fiyatBildirAc)
-- ───────────────────────────────────────────────────────────────────────
-- INSERT payload'i sema ile birebir: _sid, market, gosterilen_fiyat,
--   bildirilen_fiyat, kullanici_id (= _user.id). olusturma gonderilmiyor
--   (DB default now()).
-- Hata dali JENERIK: `if (error) toastGoster('Bildirim gonderilemedi')`.
--   Yani trigger'in ozel mesaji (yukaridaki RAISE metinleri) kullaniciya
--   AYNEN gosterilmiyor; kullanici "Bildirim gonderilemedi" gorur.
-- Ama normal yolda: app.js INSERT'ten ONCE localStorage 24s sogumasini
--   kontrol edip "Bu urun icin bildirimin zaten alindi" (dostca) gosteriyor;
--   trigger yalniz o kontrol bypass edilince (baska cihaz / dogrudan API)
--   devreye girer. O durumda jenerik mesaj kabul edilebilir.
-- ISTEGE BAGLI IYILESTIRME (bu dosyanin disinda, app.js degisikligi):
--   error.code === '23514' ise dostca mesaj goster (ornegin duplicate icin
--   "zaten alindi", tavan icin "gunluk sinira ulastin"). Simdilik SART DEGIL.


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
-- 6) TRIGGER SONRASI DOGRULAMA — GERCEK oturumla (anon INSERT edemez)
-- ───────────────────────────────────────────────────────────────────────
-- Bu trigger'i anon anahtarla test EDEMEZSIN (INSERT policy authenticated).
-- Uygulamada oturum acip ayni urun+market'e iki kez "Bu fiyat tutmadi"
-- dokun: ikincisi reddedilmeli. Ya da SQL Editor'de kendi uid'inle bir
-- satir ekleyip ikinciyi dene (check_violation beklenir):
--   INSERT INTO public.fiyat_bildirim (_sid, market, gosterilen_fiyat,
--     bildirilen_fiyat, kullanici_id)
--   VALUES ('__test__', 'bim', 10, 8, '<KENDI_AUTH_UID>');
--   -- ayni satiri tekrar calistir -> check_violation
-- Sonra temizle:
--   DELETE FROM public.fiyat_bildirim WHERE _sid = '__test__';
