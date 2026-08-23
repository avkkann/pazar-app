-- ═══════════════════════════════════════════════════════════════════════
-- HESAP SILME (KVKK "silme/unutulma hakki") — FK + ON DELETE CASCADE
-- Taslak: 2026-08-21.  BU DOSYA HENUZ CALISTIRILMADI.
--
-- OLCULEN DURUM (2026-08-21, Mustafa SQL Editor'de dort tani sorgusunu kostu):
--   • FK/cascade: HICBIR tabloda auth.users'a FK YOK -> sifirdan kurulacak.
--   • Yetim satir: alti tabloda da 0 (temiz zemin).
--   • DELETE policy: favoriler / fiyat_alarmlari / push_subscriptions'ta VAR;
--     profiles / fiyat_bildirim / bulten_abonelik'te YOK.
--   • bulten_aboneler = VIEW (DOKUNMA), bulten_abonelik = BASE TABLE (asil bu).
--   • Kolon adlari DOGRULANDI: yetim sorgusu (query 3) hatasiz kostugu icin
--     asagidaki (tablo, kolon) eslesmesi kesin:
--       profiles.id, favoriler.user_id, fiyat_alarmlari.user_id,
--       push_subscriptions.user_id, fiyat_bildirim.kullanici_id,
--       bulten_abonelik.user_id
--
-- YON: FK her zaman CHILD public tablo -> PARENT auth.users(id). ASLA TERS.
--   (Ters yon — auth.users'a child gibi davranmak — cascade'de tum kullanicilari
--    silebilirdi. Buradaki her ALTER child tabloda; auth.users'a DOKUNULMUYOR.)
--
-- ⚠️  VERI MIMARISINI DEGISTIREN + (test/silmede) VERI SILEN islem. Mustafa
--     gormeden calistirilmaz. Calistirma sirasi ayrica kararlastirilacak.
-- ═══════════════════════════════════════════════════════════════════════


-- ───────────────────────────────────────────────────────────────────────
-- BLOK 0 — UCUS ONCESI (ADD FK'den hemen once; HICBIR SEY DEGISTIRMEZ)
-- ───────────────────────────────────────────────────────────────────────
-- 0a) Kolonlar gercekten var mi (ada gore ADD FK yaziyoruz; teyit).
SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE table_schema='public' AND (
     (table_name='profiles'           AND column_name='id')
  OR (table_name='favoriler'          AND column_name='user_id')
  OR (table_name='fiyat_alarmlari'    AND column_name='user_id')
  OR (table_name='push_subscriptions' AND column_name='user_id')
  OR (table_name='fiyat_bildirim'     AND column_name='kullanici_id')
  OR (table_name='bulten_abonelik'    AND column_name='user_id'))
ORDER BY table_name;
-- Beklenen: 6 satir, hepsi uuid. 6'dan az donerse EKSIK kolon var -> DUR.

-- 0b) Yetim = 0 TEKRAR teyit (FK eklemeden hemen once). Herhangi biri > 0 ise
--     ADD CONSTRAINT o tabloda PATLAR; once BLOK 3'teki yetim temizligini kosur.
SELECT 'profiles' t,count(*) yetim FROM public.profiles p LEFT JOIN auth.users u ON u.id=p.id WHERE u.id IS NULL
UNION ALL SELECT 'favoriler',count(*) FROM public.favoriler f LEFT JOIN auth.users u ON u.id=f.user_id WHERE u.id IS NULL
UNION ALL SELECT 'fiyat_alarmlari',count(*) FROM public.fiyat_alarmlari a LEFT JOIN auth.users u ON u.id=a.user_id WHERE u.id IS NULL
UNION ALL SELECT 'push_subscriptions',count(*) FROM public.push_subscriptions s LEFT JOIN auth.users u ON u.id=s.user_id WHERE u.id IS NULL
UNION ALL SELECT 'fiyat_bildirim',count(*) FROM public.fiyat_bildirim b LEFT JOIN auth.users u ON u.id=b.kullanici_id WHERE u.id IS NULL
UNION ALL SELECT 'bulten_abonelik',count(*) FROM public.bulten_abonelik n LEFT JOIN auth.users u ON u.id=n.user_id WHERE u.id IS NULL;
-- Hepsi 0 olmali (2026-08-21 olcumu 0'di; teyit).


-- ───────────────────────────────────────────────────────────────────────
-- BLOK 1 — FK + ON DELETE CASCADE (alti tablo). SADECE ADD — mevcut FK yok.
-- ───────────────────────────────────────────────────────────────────────
-- Her biri: child public.<tablo>.<kol> -> parent auth.users(id) ON DELETE CASCADE.
-- IF NOT EXISTS yok (Postgres ADD CONSTRAINT'te desteklemez); FK yok, tekil kosu.
-- Tekrar kosarsan "already exists" hatasi verir -> zaten kurulmus demektir.

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_id_auth_fk
  FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.favoriler
  ADD CONSTRAINT favoriler_user_id_auth_fk
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.fiyat_alarmlari
  ADD CONSTRAINT fiyat_alarmlari_user_id_auth_fk
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.push_subscriptions
  ADD CONSTRAINT push_subscriptions_user_id_auth_fk
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.fiyat_bildirim
  ADD CONSTRAINT fiyat_bildirim_kullanici_id_auth_fk
  FOREIGN KEY (kullanici_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.bulten_abonelik
  ADD CONSTRAINT bulten_abonelik_user_id_auth_fk
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- Teyit: alti FK ve delete_rule=CASCADE gorunmeli.
SELECT tc.table_name, tc.constraint_name, rc.delete_rule
FROM information_schema.table_constraints tc
JOIN information_schema.referential_constraints rc
  ON tc.constraint_name=rc.constraint_name AND tc.table_schema=rc.constraint_schema
WHERE tc.constraint_type='FOREIGN KEY' AND tc.table_schema='public'
  AND tc.constraint_name LIKE '%\_auth\_fk' ORDER BY tc.table_name;


-- ───────────────────────────────────────────────────────────────────────
-- BLOK 2 — (ISTEGE BAGLI) eksik DELETE policy'ler
-- ───────────────────────────────────────────────────────────────────────
-- GORUS: KVKK silme icin GEREKLI DEGIL. Cascade + "Hesabimi sil" akisi (edge
--   function) hesabi silince bu satirlar zaten duser. Bu policy'ler yalnizca
--   kullanicinin TEK TEK satir silmesi icin (profiles: tek satir, silme=hesap
--   silme; fiyat_bildirim: tek yonlu rapor; bulten_abonelik: cikis=UPDATE
--   aktif_mi=false, DELETE degil). Yani su an UI ihtiyaci YOK.
-- KARAR: Simdilik EKLEME (yorumlu birak). Ileride "kaydimi sil" ozelligi
--   eklenirse ac. Tutarlilik istiyorsan acabilirsin — zararsiz ama gereksiz.
--
-- CREATE POLICY "kendi profilini siler" ON public.profiles
--   FOR DELETE TO authenticated USING (id = auth.uid());
-- CREATE POLICY "kendi bildirimini siler" ON public.fiyat_bildirim
--   FOR DELETE TO authenticated USING (kullanici_id = auth.uid());
-- CREATE POLICY "kendi bulten kaydini siler" ON public.bulten_abonelik
--   FOR DELETE TO authenticated USING (user_id = auth.uid());


-- ───────────────────────────────────────────────────────────────────────
-- BLOK 3 — ROLLBACK + (gerekirse) yetim temizligi
-- ───────────────────────────────────────────────────────────────────────
-- FK'leri geri al (cascade'i kaldirir; SILINEN veri GERI GELMEZ -> yalniz PITR):
-- ALTER TABLE public.profiles           DROP CONSTRAINT profiles_id_auth_fk;
-- ALTER TABLE public.favoriler          DROP CONSTRAINT favoriler_user_id_auth_fk;
-- ALTER TABLE public.fiyat_alarmlari    DROP CONSTRAINT fiyat_alarmlari_user_id_auth_fk;
-- ALTER TABLE public.push_subscriptions DROP CONSTRAINT push_subscriptions_user_id_auth_fk;
-- ALTER TABLE public.fiyat_bildirim     DROP CONSTRAINT fiyat_bildirim_kullanici_id_auth_fk;
-- ALTER TABLE public.bulten_abonelik    DROP CONSTRAINT bulten_abonelik_user_id_auth_fk;
-- (BLOK 2 policy'leri eklendiyse: DROP POLICY "..." ON public.<tablo>;)
--
-- Yetim temizligi (BLOK 0b > 0 donerse; VERI SILER). 2026-08-21'de 0'di, gerekmedi:
-- DELETE FROM public.profiles p WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id=p.id);
--   (digerleri ayni desende: favoriler.user_id, ... , fiyat_bildirim.kullanici_id)


-- ───────────────────────────────────────────────────────────────────────
-- BLOK 4 — THROWAWAY TEST: TEK TRANSACTION, KALICI DEGISIKLIK YOK
-- ───────────────────────────────────────────────────────────────────────
-- Cascade'i GERCEK veriye dokunmadan, FK'leri KALICI kurmadan dogrular:
-- transaction icinde FK'leri kur -> test kullanicisi + 6 satir ekle -> auth
-- kullanicisini sil -> 6'sinin de dustugunu SAY -> ROLLBACK (FK'ler + test
-- verisi dahil HER SEY geri alinir; hicbir iz kalmaz).
--
-- NOT (auth.users insert): GoTrue surumune gore auth.users'ta ekstra NOT NULL
--   kolon olabilir; asagidaki INSERT NOT NULL hatasi verirse, hatanin adini
--   verdigi kolonu VALUES'a ekle (yaygin: instance_id, aud, role — asagida var).
--   id disi cogu kolon nullable/default. Test kullanicisi ROLLBACK ile silinir.

BEGIN;
  -- (1) FK'leri GECICI kur (bu transaction icinde aktif)
  ALTER TABLE public.profiles           ADD CONSTRAINT _t_p  FOREIGN KEY (id)           REFERENCES auth.users(id) ON DELETE CASCADE;
  ALTER TABLE public.favoriler          ADD CONSTRAINT _t_f  FOREIGN KEY (user_id)      REFERENCES auth.users(id) ON DELETE CASCADE;
  ALTER TABLE public.fiyat_alarmlari    ADD CONSTRAINT _t_a  FOREIGN KEY (user_id)      REFERENCES auth.users(id) ON DELETE CASCADE;
  ALTER TABLE public.push_subscriptions ADD CONSTRAINT _t_s  FOREIGN KEY (user_id)      REFERENCES auth.users(id) ON DELETE CASCADE;
  ALTER TABLE public.fiyat_bildirim     ADD CONSTRAINT _t_b  FOREIGN KEY (kullanici_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  ALTER TABLE public.bulten_abonelik    ADD CONSTRAINT _t_n  FOREIGN KEY (user_id)      REFERENCES auth.users(id) ON DELETE CASCADE;

  -- (2) Test auth kullanicisi (sabit UUID; gercek kullaniciyla cakismaz)
  INSERT INTO auth.users (id, instance_id, aud, role, email, created_at, updated_at)
    VALUES ('00000000-0000-4000-8000-00000000dead',
            '00000000-0000-0000-0000-000000000000',
            'authenticated','authenticated','kvkk-cascade-test@example.com', now(), now());

  -- (3) Alti tabloya BIRER satir
  INSERT INTO public.profiles           (id, email, ad)                                  VALUES ('00000000-0000-4000-8000-00000000dead','kvkk-cascade-test@example.com','Test');
  INSERT INTO public.favoriler          (user_id, urun_sid)                              VALUES ('00000000-0000-4000-8000-00000000dead','test_sid');
  INSERT INTO public.fiyat_alarmlari    (user_id, urun_sid, hedef_fiyat, aktif_mi)       VALUES ('00000000-0000-4000-8000-00000000dead','test_sid',9.9,true);
  INSERT INTO public.push_subscriptions (user_id, endpoint, p256dh, auth_key)            VALUES ('00000000-0000-4000-8000-00000000dead','https://test','p','a');
  INSERT INTO public.fiyat_bildirim     (_sid, market, gosterilen_fiyat, bildirilen_fiyat, kullanici_id) VALUES ('test_sid','bim',10,8,'00000000-0000-4000-8000-00000000dead');
  INSERT INTO public.bulten_abonelik    (user_id, aktif_mi)                              VALUES ('00000000-0000-4000-8000-00000000dead',true);

  -- (4) Silme ONCESI toplam (6 beklenir)
  SELECT (SELECT count(*) FROM public.profiles           WHERE id='00000000-0000-4000-8000-00000000dead')
       + (SELECT count(*) FROM public.favoriler          WHERE user_id='00000000-0000-4000-8000-00000000dead')
       + (SELECT count(*) FROM public.fiyat_alarmlari    WHERE user_id='00000000-0000-4000-8000-00000000dead')
       + (SELECT count(*) FROM public.push_subscriptions WHERE user_id='00000000-0000-4000-8000-00000000dead')
       + (SELECT count(*) FROM public.fiyat_bildirim     WHERE kullanici_id='00000000-0000-4000-8000-00000000dead')
       + (SELECT count(*) FROM public.bulten_abonelik    WHERE user_id='00000000-0000-4000-8000-00000000dead') AS silmeden_once;  -- 6

  -- (5) auth kullanicisini sil -> CASCADE tetiklenir
  DELETE FROM auth.users WHERE id='00000000-0000-4000-8000-00000000dead';

  -- (6) Silme SONRASI toplam (0 beklenir = cascade calisti)
  SELECT (SELECT count(*) FROM public.profiles           WHERE id='00000000-0000-4000-8000-00000000dead')
       + (SELECT count(*) FROM public.favoriler          WHERE user_id='00000000-0000-4000-8000-00000000dead')
       + (SELECT count(*) FROM public.fiyat_alarmlari    WHERE user_id='00000000-0000-4000-8000-00000000dead')
       + (SELECT count(*) FROM public.push_subscriptions WHERE user_id='00000000-0000-4000-8000-00000000dead')
       + (SELECT count(*) FROM public.fiyat_bildirim     WHERE kullanici_id='00000000-0000-4000-8000-00000000dead')
       + (SELECT count(*) FROM public.bulten_abonelik    WHERE user_id='00000000-0000-4000-8000-00000000dead') AS silmeden_sonra;  -- 0
ROLLBACK;
-- ROLLBACK: FK'ler (_t_*), test kullanicisi ve 6 satir DAHIL her sey geri alinir.
-- Kalici FK kurmak icin: test 6->0 verince BLOK 1'i ayri kosur (COMMIT'li).
