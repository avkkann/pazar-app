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
