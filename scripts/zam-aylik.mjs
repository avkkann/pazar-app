// scripts/zam-aylik.mjs — TAKVIM AYI zam listesi, TEK TANIM.
//
// NEDEN AYRI DOSYA: bu hesap iki yerde tuketiliyor --
//   1) scripts/hub-uret.mjs   -> /zam/2026-08/ gibi hub sayfalari
//   2) scripts/anasayfa-uret.mjs -> data/anasayfa.json'daki `zamAylik`
//      (uygulamada Firsatlar > Zamlananlar sekmesi)
// Ikisi ayri ayri yazilsaydi UYGULAMA ile HUB SAYFASI farkli listeler
// gosterirdi. Bu depoda "ayni turetilmis degerin iki kaynagi" defalarca
// tuzak diye isaretlenmis (urunler.json, marketfiyati.json, anasayfa.json);
// fonksiyon 2026-09-01'de hub-uret.mjs'ten AYNEN buraya tasindi -- mantik
// DEGISTIRILMEDI, yalnizca bagimliliklar parametre haline getirildi.
//
// ZAM OLCUTU YENIDEN YAZILMIYOR: `zamOlcutu` app.js'in KENDI fonksiyonu,
// buraya cagri sarmalayicisi olarak geciyor. Pencere SADECE takvim ayi.

/**
 * Bir takvim ayinda esigi gecen (urun x market) ciftlerini dondurur.
 *
 * @param {string} ay            'YYYY-AA'
 * @param {number} sonGun        ayin kacinci gunune kadar bakilacagi
 *                               (icinde bulunulan ayda BUGUN, gecmis ayda ayin son gunu)
 * @param {object} d             bagimliliklar:
 *   gecmisFiyatlar  sid -> [{t,m,f}]
 *   sidSlug         Map sid -> kategori slug
 *   sidUrun         Map sid -> urun
 *   MARKET_NAMES    bilinen market kodlari
 *   ZAM_ESIK        app.js'ten
 *   zamOlcutu(kayitlar, pencereBas, pencereSon)  app.js'in kendi fonksiyonu
 *   salinimVar(seri)                             app.js'in _salinimVarSeri'si
 */
export function ayZamCiftleri(ay, sonGun, d) {
  const { gecmisFiyatlar, sidSlug, sidUrun, MARKET_NAMES, ZAM_ESIK, zamOlcutu, salinimVar } = d;
  const [yilS, ayS] = ay.split('-');
  const gunler = [];
  for (let g = 1; g <= sonGun; g++) gunler.push(`${yilS}-${ayS}-${String(g).padStart(2, '0')}`);
  const pencereBas = gunler[0];
  const pencereSon = gunler[gunler.length - 1];

  const ciftler = [];
  let salinimElenen = 0;
  for (const sid of Object.keys(gecmisFiyatlar)) {
    const kategoriSlug = sidSlug.get(sid);
    // Katalogda olmayan (artik satilmayan) urunler ve MEVSIM TUZAGI:
    // meyve-sebze zam havuzunun disinda tutuluyor -- zamHavuzu()'nun
    // 'meyve'/'sebze' disarida birakma ilkesiyle ayni.
    if (!kategoriSlug || kategoriSlug === 'meyve-sebze') continue;
    const urun = sidUrun.get(sid);
    const kayitlar = gecmisFiyatlar[sid];
    if (!Array.isArray(kayitlar) || !kayitlar.length) continue;
    const marketler = {};
    for (const k of kayitlar) {
      if (!k || !k.t || k.f == null || !(k.f > 0)) continue;
      const m = k.m || '?';
      (marketler[m] ||= []).push(k);
    }
    for (const m of Object.keys(marketler)) {
      if (!MARKET_NAMES[m]) continue;
      const a = marketler[m].slice().sort((x, y) => (x.t < y.t ? -1 : (x.t > y.t ? 1 : 0)));
      // Salinim testi TAM gun izgarali seri istiyor.
      const seri = new Array(gunler.length).fill(null);
      let j = 0, son = null;
      for (let i = 0; i < gunler.length; i++) {
        while (j < a.length && a[j].t <= gunler[i]) { son = a[j]; j++; }
        seri[i] = son ? son.f : null;
      }
      // ZAM OLCUTU: onceki zirveye gore, app.js'in KENDI fonksiyonuyla.
      const r = zamOlcutu(a, pencereBas, pencereSon);
      if (!r || !(r.artis >= ZAM_ESIK)) continue;
      if (salinimVar(seri)) { salinimElenen++; continue; }
      ciftler.push({
        sid, market: m, ad: urun ? urun.ad : sid, kategoriSlug,
        zirve: r.zirve, sonDeger: r.sonDeger, artis: r.artis,
        sonGozlemTarihi: son.t
      });
    }
  }
  return { ciftler, salinimElenen, pencereBas, pencereSon, gunSayisi: gunler.length };
}

/**
 * Bir ayin kac gun surdugu. Icinde bulunulan ayda BUGUNE kadar bakilir --
 * yoksa henuz yasanmamis gunler pencereye girer.
 */
export function ayIcinSonGun(ay, bugunISO) {
  const [yilS, ayS] = ay.split('-');
  if (ay === bugunISO.slice(0, 7)) return Number(bugunISO.slice(8, 10));
  return new Date(Number(yilS), Number(ayS), 0).getDate();
}
