// scripts/sitemap.mjs
// sitemap.xml'in <lastmod> damgasini uretir. Saf fonksiyonlar — yan etkisi yok,
// test dogrudan import edip cagiriyor (test_sitemap.mjs).
//
// NEDEN data/anasayfa.json'un "uretim" ALANI:
//   - Her veri kosusunda anasayfa-uret.mjs yeniden yaziyor; "site ne zaman
//     guncellendi" sorusunun dogru cevabi bu.
//   - ICERIKTEN geliyor, dosya mtime'indan degil. CI'da git checkout butun
//     mtime'lari checkout anina cekiyor, mtime yalan soyluyor.
//
// NEDEN TAM ISO DAMGASI (gun'e kirpmadan):
//   Bu projede toISOString().slice(0,10) tipi kesme UC KEZ yerel-gun hatasina
//   yol acti. Sitemap'in W3C Datetime bicimi tam damgayi kabul ediyor, boylece
//   ne kesme ne de saat dilimi varsayimi gerekiyor. Sadece milisaniye atiliyor.

const W3C = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;

/**
 * anasayfa.json nesnesinden lastmod damgasi uretir.
 * Bozuk/eksik girdide build'i KIRMAZ; o anin UTC damgasina duser.
 */
export function lastmodDamgasi(anasayfa) {
  const ham = anasayfa && typeof anasayfa.uretim === 'string' ? anasayfa.uretim.trim() : '';
  if (W3C.test(ham)) return ham.replace(/\.\d+(?=Z|[+-])/, '');
  // Yedek yol: uretim alani yok ya da tanimadigimiz bicimde. Damgayi
  // uydurmuyoruz, "su an" diyoruz — ve neden oldugunu sesli sikayet ediyoruz.
  console.warn('[sitemap] data/anasayfa.json uretim damgasi okunamadi (' +
    JSON.stringify(ham) + '); build anina dusuluyor.');
  return new Date().toISOString().replace(/\.\d+Z$/, 'Z');
}

/** sitemap.xml kaynagindaki __LASTMOD__ yer tutucusunu damgayla degistirir. */
export function sitemapDoldur(xml, damga) {
  if (!W3C.test(damga)) throw new Error('[sitemap] gecersiz lastmod damgasi: ' + damga);
  if (!xml.includes('__LASTMOD__')) throw new Error('[sitemap] kaynakta __LASTMOD__ yer tutucusu yok');
  return xml.replace(/__LASTMOD__/g, damga);
}

// ── HUB GIRDILERI ────────────────────────────────────────────────────
// NEDEN AYRI FONKSIYON (sitemapDoldur'a KARISTIRILMADI):
//   sitemapDoldur tek bir yer tutucuyu tek bir damgayla degistiren saf bir
//   string islemi. sitemapEkle ise DEGISKEN SAYIDA girdiden <url> bloklari
//   KURUYOR ve her birini DOGRULUYOR — bozuk bir girdi (goreli adres,
//   gecersiz tarih, yinelenen sayfa) sessizce yayina cikip Google'a
//   yalan sitemap sunmasin diye burada throw ediliyor. Cagiran
//   (prepare-public.mjs) manifest'teki "durum" alanina bakip hangi
//   girisleri gonderecegine kendi karar veriyor; bu fonksiyon yalnizca
//   kendisine verilen girisleri XML'e cevirip DOGRULUYOR — esik/karar
//   mantigi burada YOK.
/**
 * xml icindeki </urlset> etiketinden hemen once, girisler dizisinden
 * <url> bloklari ekler. girisler[i] = { loc, lastmod }.
 * Saf fonksiyon: xml ve girisler degistirilmez, yeni bir string doner.
 * Gecersiz girdide (goreli/yanlis-sonlu loc, gecersiz lastmod, yinelenen
 * loc, </urlset> eksik) build'i sessizce bozuk XML'le devam ettirmemek
 * icin throw eder.
 */
export function sitemapEkle(xml, girisler) {
  if (!xml.includes('</urlset>')) throw new Error('[sitemap] xml icinde </urlset> yok');
  const gorulenler = new Set();
  const bloklar = [];
  for (const giris of girisler) {
    const { loc, lastmod } = giris || {};
    if (typeof loc !== 'string' || !loc.startsWith('https://pazarapp.net')) {
      throw new Error('[sitemap] loc mutlak olmali (https://pazarapp.net ile baslamali): ' + loc);
    }
    if (!loc.endsWith('/')) {
      throw new Error('[sitemap] loc "/" ile bitmeli: ' + loc);
    }
    if (!W3C.test(lastmod)) {
      throw new Error('[sitemap] gecersiz lastmod damgasi (' + loc + '): ' + lastmod);
    }
    if (gorulenler.has(loc)) {
      throw new Error('[sitemap] yinelenen loc: ' + loc);
    }
    gorulenler.add(loc);
    bloklar.push(`  <url><loc>${loc}</loc><lastmod>${lastmod}</lastmod></url>`);
  }
  if (!bloklar.length) return xml;
  return xml.replace('</urlset>', bloklar.join('\n') + '\n</urlset>');
}

// ── MANIFEST KAYITLARINI UC KOVAYA AYIRMA ───────────────────────────
// NEDEN BURADA (prepare-public.mjs'te DEGIL):
//   Bu fonksiyon dosya okumuyor/yazmiyor — girdisi zaten ayristirilmis
//   manifest dizisi, ciktisi sitemapEkle'nin bekledigi { loc, lastmod }
//   girisleri + kova sayaclari. "Manifest kaydini sitemapEkle'nin
//   anladigi bicime nasil cevirirm" sorusu sitemapEkle ile ayni
//   sorumluluk alaninda (sitemap.xml uretim mantigi); prepare-public.mjs
//   ise orkestratordur (dosya oku/yaz, PUB klasoru kur) — is mantigini
//   orada birikmeye birakmamak icin burada, dogrudan import edilip test
//   edilebilir saf bir fonksiyon olarak tutuluyor (bkz. test_sitemap.mjs
//   "6. MANIFESTGIRISLERI").
//
// Bilinen `durum` degerleri: "uretildi" (sitemap'e girer) ve "atlandi"
// (sayfaKarari'nin BILEREK disarida biraktigi sayfa — bu UYARI GEREKTIRMEZ,
// yanlis alarm olur). Bu ikisi DISINDAKI her deger "taninmayan": sessizce
// dusmesin diye console.warn ile GORUNUR yapiliyor. Bu, "bos sonuc ile
// hatayi ayni dala dusurme" dersinin (bkz. CLAUDE.md, temizlik kategorisi
// olayi) bir versiyonu — beklenmeyen bir `durum` degeri de sessiz kalirsa
// ayni sekilde bayat/eksik veriyi taze gibi gosterir.
/**
 * Hub manifest kayitlarini (.hub/manifest.json) uc kovaya ayirir ve
 * sitemapEkle'ye verilecek girisleri uretir. Dosya G/C yapmaz.
 * Donus: { girisler, uretildi, atlandi, taninmayan }.
 * Taninmayan `durum` degeri VARSA console.warn ile GORUNUR uyari basar —
 * build'i KIRMAZ (throw etmez), yalnizca o kaydi sitemap'e ALMAZ.
 */
export function manifestGirisleri(kayitlar) {
  const liste = Array.isArray(kayitlar) ? kayitlar : [];
  const girisler = [];
  let uretildi = 0, atlandi = 0, taninmayan = 0;
  const taninmayanDegerler = new Set();
  for (const kayit of liste) {
    const durum = kayit && kayit.durum;
    if (durum === 'uretildi') {
      uretildi++;
      girisler.push({ loc: 'https://pazarapp.net' + kayit.yol, lastmod: kayit.son_veri });
    } else if (durum === 'atlandi') {
      atlandi++;
    } else {
      taninmayan++;
      taninmayanDegerler.add(JSON.stringify(durum));
    }
  }
  if (taninmayan > 0) {
    console.warn('[sitemap] UYARI: ' + taninmayan + ' kayitta taninmayan durum: ' +
      [...taninmayanDegerler].join(', ') + ' — sitemap\'e ALINMADI');
  }
  return { girisler, uretildi, atlandi, taninmayan };
}
