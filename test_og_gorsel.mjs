// PAYLASIM KARTI (og:image). Trafigin buyuk kismi dogrudan link (WhatsApp)
// oldugu icin paylasim karti tek dagitim kanali; gorselsiz gitmesi kabul edilemez.
//
// KAYNAK SVG repoda durur, PNG ondan uretilir. Donusturme yolu:
//   node scripts/og-gorsel-uret.mjs      (Chrome headless --screenshot)
//
// ALAN ADI NOTU: og:image MUTLAK URL olmak zorunda (WhatsApp/Twitter goreli
// yolu cozmuyor). O yuzden burada alan adi geciyor — canonical ve og:url ile
// AYNI alan adi, alan adi degisince ucu birlikte degisir. Gorselin KENDISINDE
// alan adi YOK; bu testte onu da dogruluyoruz.
import fs from 'fs';

const HTML = fs.readFileSync('index.html', 'utf8');
let pass = 0, fail = 0;
const ok = (ad, k, d = '') => { if (k) { pass++; console.log('  PASS  ' + ad); } else { fail++; console.log('  FAIL  ' + ad + (d ? '  -> ' + d : '')); } };

const meta = (attr, ad) => {
  const re = new RegExp('<meta[^>]+' + attr + '=["\']' + ad.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '["\'][^>]*>', 'i');
  const m = HTML.match(re);
  if (!m) return null;
  return (m[0].match(/content=["']([^"']*)["']/i) || [])[1] ?? '';
};

console.log('\n=== 1. KAYNAK SVG REPODA ===');
const SVG_YOL = 'static/og-image.svg';
ok(SVG_YOL + ' var', fs.existsSync(SVG_YOL));
if (!fs.existsSync(SVG_YOL)) { console.log('\nPASS=' + pass + '  FAIL=' + fail); process.exit(1); }
const SVG = fs.readFileSync(SVG_YOL, 'utf8');
ok('  1200x630 (og onerilen olcu)', /width="1200"/.test(SVG) && /height="630"/.test(SVG), SVG.slice(0, 160));
ok('  viewBox 0 0 1200 630', /viewBox="0 0 1200 630"/.test(SVG));

console.log('\n=== 2. MEVCUT MARKA DILI (yeni palet YOK) ===');
ok('marka yesili #0E4938 kullanilmis', /#0E4938/i.test(SVG));
ok('marka gradyaninin ucu #1D9E75 kullanilmis', /#1D9E75/i.test(SVG));
ok('krem vurgu #E8DCC4 kullanilmis', /#E8DCC4/i.test(SVG));
{
  // paletin DISINDA renk uydurulmadi (beyaz/siyah ve saydamliklar serbest)
  const IZIN = ['#0E4938', '#1D9E75', '#E8DCC4', '#0F4F3E', '#FFFFFF', '#FFF', '#000'];
  const kacak = [...new Set((SVG.match(/#[0-9A-Fa-f]{3,6}/g) || []).map(x => x.toUpperCase()))]
    .filter(x => !IZIN.includes(x));
  ok('palet disinda renk YOK', kacak.length === 0, kacak.join(' '));
}

console.log('\n=== 3. ICERIK: logo + ad + slogan ===');
ok('uygulama logosu gomulu (data URI)', /data:image\/png;base64,/.test(SVG));
ok('  logo dis dosyaya bagli DEGIL (kendi kendine yeterli)', !/xlink:href="[^"]*\.png"/.test(SVG) && !/href="[^"]*\/static\//.test(SVG));
ok('"Pazar" adi var', />\s*Pazar\s*</.test(SVG));
ok('slogan tam gecer: "Marketteki gizli zamları gör"',
  SVG.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').includes('Marketteki gizli') &&
  SVG.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').includes('zamları gör'));

console.log('\n=== 4. ALAN ADINDAN BAGIMSIZ ===');
{
  // Kart uzerinde alan adi YAZILMAMALI: alan adi alinacak, yazsak gorsel bayatlar.
  // w3.org namespace'i ve fonts.googleapis.com @import'i altyapi — onlar sayilmaz.
  ok('SITE alan adi gecmiyor', !/avkkann|github\.io|pazar-app/i.test(SVG),
    (SVG.match(/avkkann|github\.io|pazar-app/gi) || []).join(' '));
  const gorunen = [...SVG.matchAll(/<text[^>]*>([^<]*)<\/text>/g)].map(m => m[1]).join(' | ');
  ok('gorunen metinde URL YOK', !/https?:|www\.|\.com|\.io/i.test(gorunen), gorunen);
  console.log('    gorunen metin: ' + gorunen);
  // Tek dis bagimlilik: Inter webfont. Bilerek — SVG tarayicida acildiginda
  // sitedeki tipografiyle ayni gorunsun diye. Font inmezse yedek yigin devreye
  // girer, kart yine calisir; PNG'de ise font zaten piksele gomulu.
  ok('tek dis kaynak Inter webfont (yedek yigin var)',
    (SVG.match(/https?:\/\/(?!www\.w3\.org)[^"')\s]+/g) || []).every(u => /fonts\.googleapis\.com/.test(u)) &&
    /'Segoe UI'|system-ui/.test(SVG),
    (SVG.match(/https?:\/\/(?!www\.w3\.org)[^"')\s]+/g) || []).join(' '));
}

console.log('\n=== 5. KUCUK ONIZLEMEDE OKUNURLUK ===');
{
  // WhatsApp liste onizlemesi karti ~200px genislige indiriyor: 1200/200 = 6x kucultme.
  // Baslik en az 12px kalmali -> kaynakta >= 72px olmali.
  const boy = [...SVG.matchAll(/font-size="(\d+)"/g)].map(m => +m[1]).sort((a, b) => b - a);
  ok('en buyuk metin >= 72px (6x kucultmede >=12px kalir)', boy[0] >= 72, 'boyutlar=' + boy.join(','));
  ok('en kucuk metin >= 26px', boy[boy.length - 1] >= 26, 'en kucuk=' + boy[boy.length - 1]);
  ok('metin blogu az (<= 5 <text>)', (SVG.match(/<text/g) || []).length <= 5,
    'adet=' + (SVG.match(/<text/g) || []).length);
  ok('emoji ikon YOK (ui-ux: SVG/logo kullan)', !/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(SVG));
}

console.log('\n=== 6. KONTRAST (WCAG 4.5:1) ===');
{
  const lin = c => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
  const L = h => { const n = parseInt(h.slice(1), 16); return 0.2126 * lin(n >> 16 & 255) + 0.7152 * lin(n >> 8 & 255) + 0.0722 * lin(n & 255); };
  const oran = (a, b) => { const [x, y] = [L(a), L(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
  const beyazKoyu = oran('#FFFFFF', '#0E4938');
  const kremKoyu = oran('#E8DCC4', '#0E4938');
  const beyazAcik = oran('#FFFFFF', '#1D9E75');
  ok('beyaz metin / #0E4938 >= 4.5', beyazKoyu >= 4.5, beyazKoyu.toFixed(2) + ':1');
  ok('krem metin / #0E4938 >= 4.5', kremKoyu >= 4.5, kremKoyu.toFixed(2) + ':1');
  // #1D9E75 gradyanin ACIK ucu: beyaz metin orada 4.5'i GECMIYOR, o yuzden
  // tum metin sol/ust koyu bolgede durmali. x >= 700 olan <text> olmamali.
  console.log('    (bilgi) beyaz / #1D9E75 = ' + beyazAcik.toFixed(2) + ':1 — metin bu bolgede OLMAMALI');
  const sagMetin = [...SVG.matchAll(/<text[^>]*\sx="(\d+)"/g)].map(m => +m[1]).filter(x => x >= 640);
  ok('metin gradyanin acik ucuna tasmiyor (x<640)', sagMetin.length === 0, 'x=' + sagMetin.join(','));
}

console.log('\n=== 7. URETILEN PNG ===');
const PNG_YOL = 'static/og-image.png';
ok(PNG_YOL + ' var', fs.existsSync(PNG_YOL));
if (fs.existsSync(PNG_YOL)) {
  const b = fs.readFileSync(PNG_YOL);
  ok('  gercek PNG (imza)', b.slice(0, 8).toString('hex') === '89504e470d0a1a0a', b.slice(0, 8).toString('hex'));
  const w = b.readUInt32BE(16), h = b.readUInt32BE(20);
  ok('  1200x630', w === 1200 && h === 630, w + 'x' + h);
  // ESIK NEDEN 500 KB: WhatsApp buyuk og:image'lari onizlemeye hic almiyor;
  // platformun bildirilen siniri ~600 KB (bu makineden dogrulanamadi, yaygin
  // olarak bildirilen deger). 500 KB marj birakiyor. Tam kanvasi kaplayan
  // gradyan PNG icin verimsiz bir icerik — olcum: 381 KB.
  ok('  boyut < 500 KB (WhatsApp onizleme siniri ~600 KB)', b.length < 500 * 1024, Math.round(b.length / 1024) + ' KB');
}
ok('uretim script\'i repoda (donusturme yolu belgeli)', fs.existsSync('scripts/og-gorsel-uret.mjs'));

console.log('\n=== 8. META ETIKETLERI ===');
{
  const img = meta('property', 'og:image');
  ok('og:image var', !!img, String(img));
  ok('  MUTLAK URL (https://)', /^https:\/\//.test(img || ''), String(img));
  ok('  og-image.png gosteriyor', /static\/og-image\.png$/.test(img || ''), String(img));
  ok('  canonical ile ayni alan adi',
    (img || '').startsWith((HTML.match(/rel="canonical" href="([^"]+)"/) || [])[1] || 'X'),
    'canonical=' + (HTML.match(/rel="canonical" href="([^"]+)"/) || [])[1]);
  ok('og:image:width 1200', meta('property', 'og:image:width') === '1200', String(meta('property', 'og:image:width')));
  ok('og:image:height 630', meta('property', 'og:image:height') === '630', String(meta('property', 'og:image:height')));
  ok('og:image:type image/png', meta('property', 'og:image:type') === 'image/png', String(meta('property', 'og:image:type')));
  ok('og:image:alt var (a11y)', (meta('property', 'og:image:alt') || '').length > 10, String(meta('property', 'og:image:alt')));
  ok('twitter:card = summary_large_image', meta('name', 'twitter:card') === 'summary_large_image', String(meta('name', 'twitter:card')));
  ok('twitter:image = og:image', meta('name', 'twitter:image') === img, String(meta('name', 'twitter:image')));
}

console.log('\n=== 9. BUILD PNG\'YI TASIYOR ===');
{
  const pp = fs.readFileSync('scripts/prepare-public.mjs', 'utf8');
  ok('prepare-public static/ klasorunu komple kopyaliyor', /cpSync\('static'/.test(pp), '');
}

console.log('\n=== 10. MEVCUT ETIKETLER BOZULMADI ===');
ok('canonical duruyor', /rel="canonical"/.test(HTML));
ok('meta robots index,follow duruyor', /content="index, follow/.test(HTML));
ok('og:url duruyor', !!meta('property', 'og:url'));
ok('og:site_name duruyor', !!meta('property', 'og:site_name'));
ok('theme-color #0E4938 duruyor', /content="#0E4938"/.test(HTML));

console.log('\nPASS=' + pass + '  FAIL=' + fail);
process.exit(fail ? 1 : 0);
