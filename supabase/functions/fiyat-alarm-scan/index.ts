import { createClient } from "jsr:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const VAPID_PUBLIC = Deno.env.get("VAPID_PUBLIC_KEY")!;
const VAPID_PRIVATE = Deno.env.get("VAPID_PRIVATE_KEY")!;

webpush.setVapidDetails("mailto:pazarapp@gmail.com", VAPID_PUBLIC, VAPID_PRIVATE);

const KATEGORI_DOSYALARI = [
  "urunler_meyve", "urunler_et", "urunler_sut", "urunler_gida",
  "urunler_icecek", "urunler_temizlik", "urunler_atistirmalik", "urunler_dondurulmus",
];

async function buildFiyatMap() {
  const fiyatMap = new Map();

  // 1) 8 kategori dosyasi - asil dogru kaynak (urunler.json degil, o eski/tutarsiz)
  for (const dosya of KATEGORI_DOSYALARI) {
    try {
      const r = await fetch(`https://raw.githubusercontent.com/avkkann/pazar-app/main/data/${dosya}.json`);
      const urunler = await r.json();
      for (const u of urunler) {
        if (u && u._sid && u.en_dusuk_fiyat != null) fiyatMap.set(u._sid, u.en_dusuk_fiyat);
      }
    } catch (_e) {
      // bir kategori dosyasi cekilemezse digerleriyle devam et
    }
  }

  // 2) marketfiyati.json - kategori dosyalarinda olmayan sid'ler icin fallback
  //    (bazi urunler sadece burada var, productMap'e buradan da ekleniyor)
  const r2 = await fetch("https://raw.githubusercontent.com/avkkann/pazar-app/main/data/marketfiyati.json");
  const urunler2 = await r2.json();
  for (const u of urunler2) {
    if (!u || !u._sid || fiyatMap.has(u._sid) || !Array.isArray(u.market_fiyatlari)) continue;
    let min = Infinity;
    for (const mf of u.market_fiyatlari) {
      const f = parseFloat(mf.fiyat);
      if (!isNaN(f) && f > 0 && f < min) min = f;
    }
    if (min !== Infinity) fiyatMap.set(u._sid, min);
  }

  return fiyatMap;
}

// Paylasilan gizli baslik kapisi. Istek 'x-cron-secret' basligini tasimali ve
// Deno.env.get('CRON_SECRET') ile TAM eslesmeli. CRON_SECRET tanimsiz/bos ise
// kapi KAPALI kalir (guvenli varsayilan — secret'i eklemeyi unutursak fonksiyon
// acik kalmaz). Karsilastirma SABIT ZAMANLI: erken cikisli === yok; once
// uzunluk, sonra bayt-bazli XOR birikimi (zamanlama sizintisi olmasin).
function gizliDogru(req: Request): boolean {
  const beklenen = Deno.env.get("CRON_SECRET");
  if (!beklenen) return false;
  const gelen = req.headers.get("x-cron-secret") ?? "";
  const a = new TextEncoder().encode(gelen);
  const b = new TextEncoder().encode(beklenen);
  if (a.length !== b.length) return false;
  let fark = 0;
  for (let i = 0; i < a.length; i++) fark |= a[i] ^ b[i];
  return fark === 0;
}

Deno.serve(async (req) => {
  // ASIL IS BASLAMADAN ONCE: yetkisizse 401 ve HICBIR YAN ETKI YOK
  // (push yok, DB okuma/yazma/silme/guncelleme yok).
  if (!gizliDogru(req)) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  const { data: alarmlar, error: alarmErr } = await supabase
    .from("fiyat_alarmlari")
    .select("id, user_id, urun_sid, hedef_fiyat")
    .eq("aktif_mi", true);

  if (alarmErr) {
    return new Response(JSON.stringify({ ok: false, error: alarmErr.message }), { status: 500 });
  }
  if (!alarmlar || alarmlar.length === 0) {
    return new Response(JSON.stringify({ ok: true, tetiklenen: 0 }), { status: 200 });
  }

  const fiyatMap = await buildFiyatMap();

  const tetiklenenler = alarmlar.filter((a) => {
    const guncelFiyat = fiyatMap.get(a.urun_sid);
    return guncelFiyat != null && guncelFiyat <= a.hedef_fiyat;
  });

  let gonderilenBildirim = 0;

  for (const alarm of tetiklenenler) {
    const { data: subs } = await supabase
      .from("push_subscriptions")
      .select("endpoint, p256dh, auth_key")
      .eq("user_id", alarm.user_id);

    const guncelFiyat = fiyatMap.get(alarm.urun_sid);
    const payload = JSON.stringify({
      title: "Fiyat alarmı!",
      body: `Takip ettiğin ürün ${guncelFiyat.toFixed(2)} TL'ye düştü`,
      url: "./",
    });

    for (const sub of subs || []) {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth_key } },
          payload,
        );
        gonderilenBildirim++;
      } catch (e) {
        if (e && (e.statusCode === 404 || e.statusCode === 410)) {
          await supabase.from("push_subscriptions").delete().match({ endpoint: sub.endpoint });
        }
      }
    }

    await supabase.from("fiyat_alarmlari").update({ aktif_mi: false }).eq("id", alarm.id);
  }

  return new Response(
    JSON.stringify({
      ok: true,
      taranan_alarm: alarmlar.length,
      tetiklenen: tetiklenenler.length,
      bildirim: gonderilenBildirim,
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
});