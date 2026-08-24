// supabase/functions/hesap-sil/index.ts
// CANLI (deploy: 2026-08-23, uctan uca dogrulandi: 2026-08-23).
//
// "Hesabimi sil" (KVKK silme/unutulma hakki). Kullanici KENDI hesabini siler.
//   auth.users satiri silinir -> sql/hesap_silme_cascade.sql'deki ON DELETE
//   CASCADE FK'leri tum kisisel veriyi (profiles, favoriler, fiyat_alarmlari,
//   push_subscriptions, fiyat_bildirim, bulten_abonelik) otomatik dusurur.
//   >>> ONKOSUL: cascade FK'ler kurulmus olmali; yoksa auth silinir ama public
//       tablolarda yetim satir kalir.
//
// GUVENLIK (kritik):
//   • uid ISTEMCIDEN ALINMAZ. Caller'in KENDI oturum JWT'sinden dogrulanir
//     (anon client + getUser). Body'deki bir id'ye ASLA guvenilmez — yoksa bir
//     kullanici baskasinin uid'sini gonderip onun hesabini sildirebilir.
//   • x-cron-secret DEGIL (o makine-makine cron icindi). Bu uc, kullanicinin
//     kendi Authorization: Bearer <access_token>'i ile cagrilir.
//   • Silme (admin.deleteUser) YALNIZCA service_role ile yapilir; o anahtar
//     yalniz fonksiyon icinde (Deno.env), istemcide DEGIL.
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "method_not_allowed" });

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return json(401, { error: "unauthorized" });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;

  // 1) CALLER'I KENDI JWT'SINDEN DOGRULA. uid buradan gelir; body okunmaz.
  const callerClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: { user }, error: userErr } = await callerClient.auth.getUser();
  if (userErr || !user) return json(401, { error: "unauthorized" });

  // 2) service_role ile YALNIZCA dogrulanan uid'yi sil (hard delete).
  //    Cascade FK'leri gerisini (public.* satirlari) temizler.
  const admin = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error: delErr } = await admin.auth.admin.deleteUser(user.id); // shouldSoftDelete=false (hard)
  if (delErr) {
    console.warn("[hesap-sil] deleteUser hatasi:", delErr.message);
    return json(500, { error: "delete_failed" });
  }

  // Kullanici artik yok; istemci oturumu temizleyip ana ekrana donmeli.
  return json(200, { ok: true, silinen: user.id });
});
