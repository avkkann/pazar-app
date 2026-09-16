// bildirim-ozet — "Bu fiyat tutmadi" bildirimlerinin GECELIK OZETI (2026-09-16).
//
// NEDEN VAR: bildirimler simdiye kadar YALNIZCA fiyat_bildirim tablosuna
// dusuyordu. Hicbir gece isi, hicbir fonksiyon o tabloyu OKUMUYORDU; Mustafa'ya
// haber gitmiyordu. Yani bir kullanici "bu fiyat markette tutmadi" dediginde
// kimsenin haberi olmuyor ve veri duzelmiyordu. Bu fonksiyon o halkayi kapatiyor.
//
// KARAR (Mustafa, 2026-09-16): e-posta HER GECE gidiyor, bildirim OLMASA DA.
// Gerekce onun secimi: e-postanin GELMEMESI dogrudan "bir sey bozuldu" demek
// olsun. Bu yuzden "bildirim yok" durumu sessiz gecilmiyor, acikca yaziliyor.
//
// GONDERICI NOTU: haftalik-bulten ile ayni 'onboarding@resend.dev' kullaniliyor.
// Resend'in bu dev gondericisi YALNIZCA hesap sahibine teslim ediyor; bu ozet
// zaten yalnizca hesap sahibine gittigi icin bugun DOGRU calisiyor. Kendi alan
// adi dogrulanirsa burasi da degisir (ayri is).
//
// GIZLILIK: e-postaya kullanici kimligi (kullanici_id) YAZILMIYOR. Kimlik
// yalnizca "kac farkli kisi" sayimi icin bellekte kullanilip atiliyor —
// uygulamanin kendi kuralinin (kac kisi gorunur, kim gorunmez) aynisi.
//
// TIP ANNOTASYONU BILEREK YOK: bekci (test_bildirim_ozet.mjs) bu dosyanin
// GERCEK kaynagini node:vm'de kosturuyor. Mantik kopyalanmasin diye kaynak
// duz JS sozdiziminde tutuluyor.
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Paylasilan gizli baslik kapisi — haftalik-bulten ve fiyat-alarm-scan ile AYNI.
// CRON_SECRET tanimsiz/bos ise kapi KAPALI kalir (guvenli varsayilan).
// Karsilastirma SABIT ZAMANLI (erken cikis yok).
function gizliDogru(req) {
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

// Urun adi bizim DB'mizden geliyor ama e-postaya HTML olarak giriyor; kaynak
// ne olursa olsun kacisi CIKTI tarafinda yapiyoruz (deponun B1 kurali).
function kacir(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const tl = (n) => (n == null || n === "" || isNaN(Number(n)) ? "—" : Number(n).toFixed(2) + " ₺");

// E-postada en fazla bu kadar satir gosterilir. USTU SESSIZCE KIRPILMAZ:
// kirpilan sayi hem e-postada hem yanit govdesinde yaziyor.
const SATIR_SINIRI = 100;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // ASIL IS BASLAMADAN ONCE: yetkisizse 401 ve HICBIR YAN ETKI YOK
  // (e-posta yok, DB okuma yok).
  if (!gizliDogru(req)) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Alici adresi KODA YAZILMIYOR: depo herkese acik. Secret unutulursa
  // fonksiyon sessizce "basarili" donmuyor, acik hatayla 500 veriyor.
  const alici = Deno.env.get("OZET_EPOSTA");
  if (!alici) {
    return new Response(JSON.stringify({ ok: false, error: "OZET_EPOSTA tanimsiz — ozet gonderilemedi" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL"),
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),
  );
  const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

  try {
    // Pencere KAYAN 24 SAAT (takvim gunu degil): gece isi her gun ayni saatte
    // kosmuyor (GitHub zamanlayicisi saatlerce gecikebiliyor — CLAUDE.md'de
    // olculdu). Takvim gunu kullanilsaydi gecikmeli kosularda bildirimler ya
    // iki kez ya hic raporlanirdi.
    const simdi = new Date();
    const baslangic = new Date(simdi.getTime() - 24 * 60 * 60 * 1000).toISOString();

    const { data: bildirimler, error: bildirimHata } = await supabase
      .from("fiyat_bildirim")
      .select("_sid, market, gosterilen_fiyat, bildirilen_fiyat, kullanici_id, olusturma")
      .gte("olusturma", baslangic)
      .order("olusturma", { ascending: false });
    if (bildirimHata) throw bildirimHata;

    const kayitlar = bildirimler || [];
    const kisiSayisi = new Set(kayitlar.map((b) => b.kullanici_id).filter(Boolean)).size;
    const urunSayisi = new Set(kayitlar.map((b) => b._sid).filter(Boolean)).size;

    // Urun adlari: yalnizca bildirilen _sid'ler icin tek sorgu.
    const adHaritasi = new Map();
    const sidler = [...new Set(kayitlar.map((b) => b._sid).filter(Boolean))];
    let adHatasi = null;
    if (sidler.length) {
      const { data: urunler, error: urunHata } = await supabase
        .from("urunler")
        .select("_sid, ad, agirlik_hacim")
        .in("_sid", sidler);
      // Ad gelmezse ozet YINE gider (_sid ile). Sessiz degil: konsola uyari
      // dusuyor ve yanit govdesinde 'adHatasi' olarak gorunuyor.
      if (urunHata) {
        adHatasi = urunHata.message || String(urunHata);
        console.warn("[bildirim-ozet] urun adlari alinamadi, _sid ile gonderiliyor:", adHatasi);
      } else if (urunler) {
        for (const u of urunler) adHaritasi.set(u._sid, u);
      }
    }

    const gosterilen = kayitlar.slice(0, SATIR_SINIRI);
    const kirpilan = kayitlar.length - gosterilen.length;

    const satirlar = gosterilen.map((b) => {
      const u = adHaritasi.get(b._sid);
      const ad = u ? u.ad + (u.agirlik_hacim ? " (" + u.agirlik_hacim + ")" : "") : (b._sid || "—");
      const bizim = Number(b.gosterilen_fiyat);
      const bildirilen = Number(b.bildirilen_fiyat);
      const farkVar = b.gosterilen_fiyat != null && b.bildirilen_fiyat != null && !isNaN(bizim) && !isNaN(bildirilen);
      const fark = farkVar ? bildirilen - bizim : null;
      const farkMetni = fark === null ? "—" : (fark > 0 ? "+" : "") + fark.toFixed(2) + " ₺";
      const farkRengi = fark === null ? "#666" : (fark > 0 ? "#B91C1C" : "#1D9E75");
      const saat = b.olusturma ? new Date(b.olusturma).toISOString().slice(11, 16) : "";
      return `<tr>
        <td style="padding:8px 6px;border-bottom:1px solid #eee;">${kacir(ad)}</td>
        <td style="padding:8px 6px;border-bottom:1px solid #eee;">${kacir(b.market)}</td>
        <td style="padding:8px 6px;border-bottom:1px solid #eee;text-align:right;">${tl(b.gosterilen_fiyat)}</td>
        <td style="padding:8px 6px;border-bottom:1px solid #eee;text-align:right;font-weight:600;">${tl(b.bildirilen_fiyat)}</td>
        <td style="padding:8px 6px;border-bottom:1px solid #eee;text-align:right;color:${farkRengi};">${farkMetni}</td>
        <td style="padding:8px 6px;border-bottom:1px solid #eee;text-align:right;color:#999;">${kacir(saat)}</td>
      </tr>`;
    }).join("");

    const govde = kayitlar.length
      ? `<p style="font-size:14px;color:#444;margin:0 0 16px;">
           Son 24 saatte <b>${kayitlar.length}</b> bildirim geldi:
           <b>${urunSayisi}</b> üründe, <b>${kisiSayisi}</b> farklı kişiden.
         </p>
         <table style="width:100%;border-collapse:collapse;font-size:13px;">
           <tr style="text-align:left;color:#666;font-size:12px;">
             <th style="padding:6px;">Ürün</th><th style="padding:6px;">Market</th>
             <th style="padding:6px;text-align:right;">Bizdeki</th>
             <th style="padding:6px;text-align:right;">Raftaki</th>
             <th style="padding:6px;text-align:right;">Fark</th>
             <th style="padding:6px;text-align:right;">Saat</th>
           </tr>
           ${satirlar}
         </table>
         ${kirpilan > 0 ? `<p style="font-size:12px;color:#B45309;margin-top:12px;">Listede ilk ${SATIR_SINIRI} bildirim var; ${kirpilan} bildirim daha geldi.</p>` : ""}
         <p style="font-size:12px;color:#999;margin-top:16px;">Raftaki fiyat isteğe bağlı; kullanıcı yazmadıysa "—" görünür. Kim bildirdiği kaydedilmiyor.</p>`
      : `<p style="font-size:14px;color:#444;margin:0;">Son 24 saatte hiç bildirim gelmedi.</p>
         <p style="font-size:12px;color:#999;margin-top:12px;">Bu e-posta her gece gönderiliyor. Gelmediği bir sabah, gece işi ya da özet fonksiyonu bozulmuş demektir.</p>`;

    const html = `
      <div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;color:#111;">
        <div style="background:#0E4938;padding:20px;text-align:center;">
          <h1 style="color:#fff;margin:0;font-size:18px;">Pazar — "Bu fiyat tutmadı" özeti</h1>
        </div>
        <div style="padding:20px 16px;">${govde}</div>
      </div>`;

    const konu = kayitlar.length
      ? `Pazar — ${kayitlar.length} fiyat bildirimi (son 24 saat)`
      : "Pazar — son 24 saatte fiyat bildirimi yok";

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Pazar <onboarding@resend.dev>",
        to: alici,
        subject: konu,
        html,
      }),
    });

    // Resend hatasini YUTMA: is kirmizi olsun ki sessizce "ozet gidiyor"
    // sanilmasin (bu deponun en pahali hata sinifi sessiz basarisizlik).
    if (!res.ok) {
      const metin = await res.text().catch(() => "");
      return new Response(JSON.stringify({ ok: false, error: "resend " + res.status, detay: String(metin).slice(0, 300) }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true, bildirim: kayitlar.length, urun: urunSayisi, kisi: kisiSayisi, kirpilan, adHatasi }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
