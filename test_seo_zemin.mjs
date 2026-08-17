// SEO ZEMINI: arama sonucunda gorunen metinler + JS kapali durum.
// Denetim bulgulari:
//   - meta description 196 karakterdi, arama sonucunda "...tasarruf et" kesiliyordu
//   - <noscript> hic yoktu; JS kapaliyken kullanici bos sayfa goruyordu
import fs from 'fs';

const HTML = fs.readFileSync('index.html', 'utf8');
let pass = 0, fail = 0;
const ok = (ad, k, d = '') => { if (k) { pass++; console.log('  PASS  ' + ad); } else { fail++; console.log('  FAIL  ' + ad + (d ? '  -> ' + d : '')); } };

const meta = (attr, ad) => {
  const re = new RegExp('<meta[^>]+' + attr + '=["\']' + ad + '["\'][^>]*>', 'i');
  const m = HTML.match(re);
  return m ? ((m[0].match(/content=["']([^"']*)["']/i) || [])[1] ?? '') : null;
};

console.log('\n=== 1. META ACIKLAMA KESILMIYOR ===');
{
  const d = meta('name', 'description') || '';
  console.log('    "' + d + '"');
  console.log('    uzunluk: ' + d.length + ' karakter');
  // Google masaustunde ~155-160 karakterde kesiyor. Ust sinir 155: kesilme yok.
  // Alt sinir 140: alani bos birakmak da kayip.
  ok('uzunluk 140-155 arasi', d.length >= 140 && d.length <= 155, d.length + ' karakter');
  ok('  kelime ortasinda bitmiyor', /[.!?]$/.test(d.trim()), '...' + d.slice(-24));

  // "Marketleri saymak yerine ne ise yaradigini anlat": zincir adlari listesi cikti.
  const ZINCIR = ['A101', 'BİM', 'Migros', 'CarrefourSA', 'ŞOK', 'Tarım Kredi', 'Hakmar'];
  const gecen = ZINCIR.filter(z => d.includes(z));
  ok('  market adi listesi YOK (en fazla 1 ornek)', gecen.length <= 1, gecen.join(', '));

  // En onemli bilgi basta: mobilde ~90 karakter gorunuyor, fayda orada olmali.
  const bas = d.slice(0, 90);
  ok('  ilk 90 karakterde fayda gecivor (zam/ucuz/karsilastir)',
    /zam|ucuz|ucuzu|karşılaştır|kıyasla/i.test(bas), bas);
  ok('  baslikla ayni degil', d !== (HTML.match(/<title>([^<]*)<\/title>/) || [])[1], '');
}

console.log('\n=== 2. BASLIK KESILMIYOR (mevcut durum korunuyor) ===');
{
  const t = (HTML.match(/<title>([^<]*)<\/title>/) || [])[1] || '';
  ok('baslik <= 60 karakter', t.length <= 60, t.length + ' -> ' + t);
}

console.log('\n=== 3. ONCEKI ISLER BOZULMADI ===');
ok('tek h1 duruyor', (HTML.match(/<h1/g) || []).length === 1, 'adet=' + (HTML.match(/<h1/g) || []).length);
ok('og:image duruyor', !!meta('property', 'og:image'));
ok('twitter:card summary_large_image duruyor', meta('name', 'twitter:card') === 'summary_large_image');
ok('canonical duruyor', /rel="canonical"/.test(HTML));
ok('meta robots index,follow duruyor', /content="index, follow/.test(HTML));

console.log('\nPASS=' + pass + '  FAIL=' + fail);
process.exit(fail ? 1 : 0);
