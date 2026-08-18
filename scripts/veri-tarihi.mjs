// Veri kumesinin EN YENI GOZLEM TARIHI — tek kaynak.
//
// Neden ayri modul: bu hesap once yalnizca hub-uret.mjs'in govdesinde vardi.
// Ana sayfaya tazelik gostergesi eklenince ayni hesap ikinci kez yazilacakti;
// bu depo o desenden iki kez yandi (MARKET_NAMES/KATEGORILER kopyalari,
// urunler.json). Iki uretici ayni sayiyi farkli yerden turetirse hub sayfasi
// "18 Agustos" derken ana sayfa "17 Agustos" diyebilir ve hangisinin dogru
// oldugu belirsiz kalir.
//
// NEDEN BU KAYNAK: build ani ya da dosya mtime'i tazelik OLCEMEZ. anasayfa.json'un
// `uretim` alani build zincirinde her kosuda "simdi"ye esitlenir; CI'da checkout
// tum mtime'lari cekim anina ceker. Scraper durursa yalnizca EN YENI GOZLEM
// tarihi ilerlemeyi keser -- damga o zaman kendiliginden yaslanir ve tazelik
// kapisi bunu yakalayabilir. (Gorev 8'de hub damgasi tam bu yuzden duzeltildi.)

/**
 * @param {Record<string, Array<{t?: string}>>} gecmisFiyatlar  data/gecmis_fiyatlar.json
 * @param {Array<{fiyat_gecmisi?: Array<[string, ...any]>}>} urunler  urunler_*.json kayitlari
 * @returns {string} 'yyyy-aa-gg' — iki kaynagin maksimumu
 * @throws hicbir gozlem bulunamazsa (sessizce bozuk damga uretmektense dur)
 */
export function enYeniGozlemTarihi(gecmisFiyatlar, urunler) {
  let enYeni = null;
  for (const sid of Object.keys(gecmisFiyatlar || {})) {
    for (const k of gecmisFiyatlar[sid] || []) {
      if (k && k.t && (!enYeni || k.t > enYeni)) enYeni = k.t;
    }
  }
  for (const u of urunler || []) {
    for (const kayit of (u && u.fiyat_gecmisi) || []) {
      const tarih = kayit && kayit[0];
      if (tarih && (!enYeni || tarih > enYeni)) enYeni = tarih;
    }
  }
  if (!enYeni) {
    throw new Error('[veri-tarihi] en yeni gozlem tarihi bulunamadi — gecmis_fiyatlar.json ve urunler_*.json fiyat_gecmisi bos mu?');
  }
  return enYeni;
}
