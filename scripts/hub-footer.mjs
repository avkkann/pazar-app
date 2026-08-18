// Uygulamanin ana ekranindaki HUB IC LINK BLOGU -- SAF fonksiyonlar.
// IO yok, fetch yok, dosya okuma yok: girdi manifest dizisi, cikti HTML dizesi.
// Cagiran taraf vite.config.js'teki eklenti (build aninda .hub/manifest.json'u
// okuyup index.html'e enjekte eder). hub-sayfa.mjs / sitemap.mjs deseni.
//
// TEK KAYNAK KURALI: burada hicbir hub yolu ve hicbir market/kategori adi
// YAZILI DEGILDIR. Yollar da etiketler de manifest kayitlarindan gelir; manifest
// ise hub-uret.mjs tarafindan app.js'in KATEGORILER / MARKET_NAMES / ZAM_AYLAR
// sabitlerinden uretilir. Buraya sabit bir liste yazmak, ATLANAN sayfalara
// (bugun /zam/2026-05/ ve /zam/2026-06/) link vererek canlida 404 uretirdi ve
// her yeni ay elle guncelleme isterdi. test_hub_footer.mjs bu iddiayi hem
// davranista hem KAYNAK duzeyinde olcuyor.

export const HUB_YER_TUTUCU = '<!--HUB-LINKLERI-->';

// Grup basliklari sayfa TIPINDEN geliyor (manifest'teki `tip` alani). Tanimsiz
// bir tip cikarsa sessizce dusmuyor: tipin kendisi baslik olarak basiliyor,
// boylece yeni bir hub tipi eklendiginde footer'da GORUNUR oluyor.
const GRUP_ADI = {
  zam: 'Aylık zam listeleri',
  kategori: 'Kategori fiyatları',
  market: 'Market fiyatları',
  hal: 'Hal fiyatları',
};
const GRUP_SIRASI = Object.keys(GRUP_ADI);

function kacir(metin) {
  return String(metin === null || metin === undefined ? '' : metin)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Manifest -> gruplanmis link modeli. Yalnizca durum === 'uretildi' kayitlari
// gecer; 'atlandi' olanlar (gerekceleriyle manifestte duruyorlar) hic bakilmaz.
export function hubFooterModeli(manifest) {
  if (!Array.isArray(manifest) || manifest.length === 0) return [];
  const uretilen = manifest.filter((k) => k && k.durum === 'uretildi');

  const gorulen = new Set();
  const gruplar = new Map();
  for (const k of uretilen) {
    const yol = String(k.yol || '');
    if (!yol.startsWith('/') || !yol.endsWith('/')) {
      throw new Error(`[hub-footer] gecersiz yol "${yol}" — mutlak olmali ve "/" ile bitmeli (hub sayfalari derin yolda durur, goreli yol yanlis cozulur)`);
    }
    if (gorulen.has(yol)) {
      throw new Error(`[hub-footer] "${yol}" manifestte iki kez gecirildi — yinelenen ic link uretilmez`);
    }
    gorulen.add(yol);
    const metin = String(k.kisa_ad || '').trim();
    if (!metin) {
      throw new Error(`[hub-footer] "${yol}" kaydinda kisa_ad yok — metinsiz link yayinlanmaz (etiket hub-uret.mjs'te uretilir)`);
    }
    const tip = String(k.tip || 'diger');
    if (!gruplar.has(tip)) gruplar.set(tip, []);
    gruplar.get(tip).push({ yol, metin });
  }

  const cikti = [...gruplar.entries()].map(([tip, linkler]) => ({
    tip, baslik: GRUP_ADI[tip] || tip, linkler,
  }));
  // Bilinen tipler tanimli sirada, tanimsiz tipler sona.
  cikti.sort((a, b) => {
    const ia = GRUP_SIRASI.indexOf(a.tip), ib = GRUP_SIRASI.indexOf(b.tip);
    return (ia < 0 ? GRUP_SIRASI.length : ia) - (ib < 0 ? GRUP_SIRASI.length : ib);
  });
  // Ay listesi YENIDEN ESKIYE: kullanici en guncel ayi arar, arsiv altta kalir.
  // Diger gruplar manifest sirasini korur (o sira app.js'teki KATEGORILER ve
  // MARKET_NAMES sirasidir -- uygulamadaki kategori izgarasiyla ayni).
  const zam = cikti.find((g) => g.tip === 'zam');
  if (zam) zam.linkler.sort((a, b) => (a.yol < b.yol ? 1 : a.yol > b.yol ? -1 : 0));
  return cikti;
}

// Model -> HTML. Baslik etiketi (<h1>..<h6>) KULLANILMIYOR: index.html'de
// sayfa basina tek h1 kurali var (test_baslik_hiyerarsi.mjs) ve bu blok ana
// ekranin icine giriyor. Grup basliklari <span> + role="group"/aria-labelledby
// ile erisilebilirlik agacinda yine de gruplu duruyor.
export function hubFooterHTML(manifest) {
  const model = hubFooterModeli(manifest);
  if (model.length === 0) return '';
  const gruplar = model.map((g, i) => {
    const id = `hub-grup-${i}`;
    const linkler = g.linkler
      .map((l) => `<li><a class="hub-link" href="${kacir(l.yol)}" tabindex="0">${kacir(l.metin)}</a></li>`)
      .join('');
    return `<div class="hub-grup" role="group" aria-labelledby="${id}">`
      + `<span class="hub-grup-baslik" id="${id}">${kacir(g.baslik)}</span>`
      + `<ul class="hub-liste">${linkler}</ul>`
      + `</div>`;
  }).join('');
  // <nav>'in KENDISI de burada uretiliyor: manifest bos oldugunda index.html'de
  // bos bir <nav> iskeleti kalmasin (ekran okuyucuya bos donen gezinti yer isareti).
  return `<nav class="hub-nav" aria-label="Fiyat sayfaları">`
    + `<span class="hub-nav-ust">Fiyat sayfaları</span>${gruplar}`
    + `</nav>`;
}

// index.html'deki yer tutucuyu uretilen blokla degistirir.
// Yer tutucu YOKSA atiyor: blok sessizce dusup uygulamanin hub sayfalarina
// hicbir ic link vermeden yayinlanmasi, bu isin tam olarak onlemek istedigi sey.
// Manifest yok/bos ise (henuz uretilmemis) blok BOS kaliyor ve build kirilmiyor
// -- prepare-public.mjs'in manifest yoksa uyariyla devam etme davranisiyla ayni.
export function hubFooterEkle(html, manifest) {
  if (!String(html).includes(HUB_YER_TUTUCU)) {
    throw new Error(`[hub-footer] yer tutucu ${HUB_YER_TUTUCU} index.html'de bulunamadi — hub ic link blogu enjekte edilemez`);
  }
  const blok = hubFooterHTML(manifest);
  return String(html).replace(HUB_YER_TUTUCU, () => blok);
}
