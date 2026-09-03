// scripts/kart-bicimi.mjs
// _asKart — istemciye giden kart nesnesinin TEK tanimi.
//
// NEDEN AYRI DOSYA: bu tanim 2026-09-03'e kadar anasayfa-uret.mjs icinde satir
// ici duruyordu. mercek-uret.mjs de ayni bicimi uretmek zorunda; kopyalamak
// IKI KAYNAK yaratirdi ve bu depoda "iki ayri uygulama = kacinilmaz sapma"
// kurali zaten yazili (anasayfa-uret.mjs bas yorumu). Bir alan eklenirse iki
// uretici de ayni anda ogrenmeli.
//
// Kart cizimi icin gereken ALANLAR (bkz. _stripKartHTML + birimFiyatHesapla).
// market_fiyatlari yalnizca market+fiyat ile tasiniyor: sehir filtresi ve
// birim fiyat bunu kullaniyor, gerisi ana sayfada gereksiz.
export const AS_KART_KAYNAK = `function _asKart(u) {
  return {
    _id: u._id, _sid: u._sid, ad: u.ad, resim: u.resim || null,
    ana_kategori: u.ana_kategori || '', agirlik_hacim: u.agirlik_hacim || null,
    en_dusuk_fiyat: u.en_dusuk_fiyat != null ? u.en_dusuk_fiyat : null,
    market_fiyatlari: (u.market_fiyatlari || [])
      .filter(f => f && f.market && f.fiyat != null)
      .map(f => ({ market: f.market, fiyat: f.fiyat })),
  };
}`;

/** VM baglamina _asKart'i tanimlar. ic = appOrtamiKur().ic */
export function asKartTanimla(ic) { ic(AS_KART_KAYNAK); }
