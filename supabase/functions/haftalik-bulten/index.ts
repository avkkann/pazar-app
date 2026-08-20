import { createClient } from "jsr:@supabase/supabase-js@2";
 
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
 
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
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // ASIL IS BASLAMADAN ONCE: yetkisizse 401 ve HICBIR YAN ETKI YOK
  // (e-posta yok, DB okuma/yazma yok).
  if (!gizliDogru(req)) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
 
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
  const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
 
  try {
    const { data: aboneler, error: aboneErr } = await supabase
      .from("bulten_aboneler")
      .select("email");
    if (aboneErr) throw aboneErr;
    if (!aboneler || aboneler.length === 0) {
      return new Response(JSON.stringify({ ok: true, gonderilen: 0, not: "abone yok" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
 
    const { data: dusenler } = await supabase.rpc("get_fiyat_dusenler", { p_limit: 5 });
    const { data: supheli } = await supabase.rpc("get_supheli_urunler", { p_limit: 3 });
 
    const tl = (n: number) => (n != null ? `${Number(n).toFixed(2)} ₺` : "");
 
    const dusenlerHTML = (dusenler || []).map((u: any) =>
      `<tr>
        <td style="padding:8px 0;border-bottom:1px solid #eee;">${u.ad}${u.agirlik_hacim ? " (" + u.agirlik_hacim + ")" : ""}</td>
        <td style="padding:8px 0;border-bottom:1px solid #eee;text-align:right;color:#1D9E75;font-weight:600;">%${u.dusus_yuzde} düştü</td>
      </tr>`
    ).join("");
 
    const supheliHTML = (supheli || []).map((u: any) =>
      `<tr>
        <td style="padding:8px 0;border-bottom:1px solid #eee;">${u.ad}${u.agirlik_hacim ? " (" + u.agirlik_hacim + ")" : ""}</td>
        <td style="padding:8px 0;border-bottom:1px solid #eee;text-align:right;color:#B45309;font-weight:600;">Şüpheli indirim</td>
      </tr>`
    ).join("");
 
    const html = `
      <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;color:#111;">
        <div style="background:#0E4938;padding:24px;text-align:center;">
          <h1 style="color:#fff;margin:0;font-size:20px;">Pazar — Haftalık Özet</h1>
        </div>
        <div style="padding:24px 16px;">
          ${dusenlerHTML ? `
          <h2 style="font-size:15px;color:#0E4938;">Bu hafta düşen fiyatlar</h2>
          <table style="width:100%;border-collapse:collapse;font-size:14px;margin-bottom:24px;">${dusenlerHTML}</table>
          ` : ""}
          ${supheliHTML ? `
          <h2 style="font-size:15px;color:#0E4938;">Dikkat: şüpheli indirimler</h2>
          <table style="width:100%;border-collapse:collapse;font-size:14px;margin-bottom:24px;">${supheliHTML}</table>
          ` : ""}
          <div style="text-align:center;margin-top:24px;">
            <a href="https://avkkann.github.io/pazar-app/" style="background:#0E4938;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;font-size:14px;">Uygulamayı Aç</a>
          </div>
        </div>
        <div style="padding:16px;text-align:center;font-size:11px;color:#999;">
          Bu bülteni Pazar uygulaması Profil ekranından kapatabilirsin.
        </div>
      </div>`;
 
    let gonderilen = 0;
    let hatali = 0;
    for (const abone of aboneler) {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "Pazar <onboarding@resend.dev>",
          to: abone.email,
          subject: "Pazar — Bu haftaki gizli zamlar ve düşen fiyatlar",
          html,
        }),
      });
      if (res.ok) gonderilen++; else hatali++;
    }
 
    return new Response(JSON.stringify({ ok: true, gonderilen, hatali, toplamAbone: aboneler.length }), {
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
 