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

console.log('\n=== 3. NOSCRIPT ===');
{
  // JS kapaliyken sorun sadece "icerik yok" degildi: #splash tam ekran
  // (position:fixed, inset:0, z-index:9999, background:#fff) ve onu SADECE
  // app.js kaldiriyor. Yani DOM'daki 2475 karakter metnin ustu kapaliydi,
  // kullanici beyaz ekran + ikon goruyordu. Iki parca gerekiyor:
  //   head'de <noscript><style> -> splash'i kaldirir
  //   body'de <noscript><div>   -> gorunur aciklama
  const bodyBas = HTML.indexOf('<body>');
  const bloklar = [...HTML.matchAll(/<noscript>([\s\S]*?)<\/noscript>/g)]
    .map(m => ({ ic: m[1], head: m.index < bodyBas }));
  ok('<noscript> var', bloklar.length > 0, 'adet=' + bloklar.length);

  const kafa = bloklar.find(b => b.head);
  ok('head\'de <noscript><style> var', !!kafa && /<style>/.test(kafa.ic), (kafa?.ic || '(yok)').slice(0, 90));
  ok('  splash overlay\'i kaldiriyor', /#splash[^}]*display:\s*none/.test(kafa?.ic || ''), (kafa?.ic || '').slice(0, 120));

  const govde = bloklar.find(b => !b.head);
  ok('body\'de gorunur <noscript> icerigi var', !!govde);
  if (govde) {
    const metin = govde.ic.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    console.log('    "' + metin + '"');
    ok('  tek paragraf aciklama (>=120 karakter)', metin.length >= 120, metin.length + ' karakter');
    ok('  uygulamanin NE OLDUGUNU anlatiyor', /market/i.test(metin) && /fiyat/i.test(metin), '');
    ok('  JavaScript gerektigini soyluyor', /JavaScript/i.test(metin), '');
    ok('  kendisi display:none DEGIL', !/display:\s*none/.test(govde.ic), '');
  }
  // kontrast: panel marka yesili uzerine beyaz metin
  {
    const CSS = fs.readFileSync('style.css', 'utf8');
    const k = (CSS.match(/\.nojs\s*\{([^}]*)\}/) || [, ''])[1];
    ok('.nojs CSS kurali var', k.length > 10, k.trim());
    ok('  marka yesili zemin #0E4938', /#0E4938/i.test(k), k.trim());
    ok('  beyaz metin (9.86:1)', /color:\s*#fff/i.test(k), k.trim());
    ok('  okunur govde olcusu >= 16px', /font-size:\s*(1[6-9]|[2-9]\d)px/.test(k), k.trim());
    ok('  satir yuksekligi 1.5-1.75', /line-height:\s*1\.[5-7]\d?/.test(k), k.trim());
  }
}

console.log('\n=== 4. ONCEKI ISLER BOZULMADI ===');
ok('tek h1 duruyor', (HTML.match(/<h1/g) || []).length === 1, 'adet=' + (HTML.match(/<h1/g) || []).length);
ok('og:image duruyor', !!meta('property', 'og:image'));
ok('twitter:card summary_large_image duruyor', meta('name', 'twitter:card') === 'summary_large_image');
ok('canonical duruyor', /rel="canonical"/.test(HTML));
ok('meta robots index,follow duruyor', /content="index, follow/.test(HTML));

console.log('\nPASS=' + pass + '  FAIL=' + fail);
process.exit(fail ? 1 : 0);
