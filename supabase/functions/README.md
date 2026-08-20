# Edge Functions

Bu klasördeki Supabase Edge Function'ları **zamanlanmış (cron) işlerdir** —
uygulama/istemci tarafından çağrılmaz. İkisi de `service_role` ile çalışır ve
gerçek yan etki üretir (e-posta gönderimi, push bildirimi, DB güncelleme), bu
yüzden **paylaşılan gizli başlık** ile korunur.

## Fonksiyonlar

### `haftalik-bulten`
`bulten_aboneler` tablosundaki her aboneye haftalık özet e-postası gönderir
(düşen fiyatlar + şüpheli indirimler). İçerik sunucuda üretilir; alıcılar
DB'den gelir (istemci alıcı/içerik belirleyemez). E-posta sağlayıcısı: Resend.

### `fiyat-alarm-scan`
Aktif `fiyat_alarmlari` kayıtlarını tarar; güncel fiyat hedefin altına düşen
alarmlar için kullanıcının `push_subscriptions` uçlarına Web Push bildirimi
gönderir, tetiklenen alarmı pasife çeker ve ölü abonelikleri siler.

## Yetkilendirme — `x-cron-secret`

Her iki fonksiyon da **asıl iş başlamadan önce** şu kapıdan geçer:

- İstek `x-cron-secret` başlığını taşımalı ve `CRON_SECRET` ortam değişkeni ile
  **tam** eşleşmeli. Eşleşmezse **401** döner ve **hiçbir yan etki oluşmaz**
  (e-posta yok, push yok, DB yazma yok).
- Karşılaştırma **sabit zamanlıdır** (uzunluk + bayt-bazlı XOR); erken çıkışlı
  `===` kullanılmaz.
- `CRON_SECRET` **tanımlı değilse kapı KAPALI kalır** (güvenli varsayılan) —
  secret'i eklemeyi unutmak fonksiyonu açık bırakmaz, 401 döndürür.

### Kurulum (bir kez)

1. Supabase'de bir **secret** tanımla (gerçek değeri burada YAZILMAZ):

   ```
   supabase secrets set CRON_SECRET=<uzun-rastgele-deger>
   ```

   (Ya da Dashboard → Project Settings → Edge Functions → Secrets.)

2. Zamanlayıcıyı bu başlıkla çağıracak şekilde ayarla. Örn. Dashboard'da bir
   **Scheduled Function** ya da DB'de `pg_cron` + `net.http_post`; istek başlığı:

   ```
   x-cron-secret: <CRON_SECRET ile aynı değer>
   ```

   Başlık gönderilmezse çağrı 401 alır (iş yapılmaz).

> Not: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`,
> `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` de Supabase secret'ları olarak tanımlı
> olmalıdır. Hiçbir gerçek secret değeri bu repoya yazılmaz (repo PUBLIC).

## Değişiklik notu

- **2026-08-20:** Kapı canlıda doğrulanırken `CRON_SECRET` yeni rastgele bir
  değerle **yeniden üretildi** (`supabase secrets set`). Değeri hiçbir yere
  kaydedilmedi. Zamanlayıcı kurulurken `x-cron-secret` başlığı bu **güncel**
  değeri taşımalıdır; eski bir değer artık geçersizdir.
