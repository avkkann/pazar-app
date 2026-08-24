// GORSEL YUVASI — "kutu ayrilmis ama BOS" hatasinin koruma testi.
//
// OLCUM (2026-08-24, CDP, 390px, soguk + yavas 4G):
//   splash kalktigi an gorus alanindaki 6 serit kartinin 6'si da BOS BEYAZ
//   kutuydu; 800ms sonra hala 5 bos; dolmasi ~9 saniye surdu.
//   CLS = 0 idi -- yani kutu DOGRU ayrilmis, sicrama YOK. Sorun sicrama
//   degil, kutunun ICINDEKI BOSLUKTU. "CLS 0" tek basina "iyi gorunuyor"
//   demek DEGIL; bu testin var olma sebebi tam olarak bu ayrim.
//   Ayni hata urun detayinda da vardi (resim 1,5-2,5 sn gec geliyor).
//
// DUZELTME: '-ph' yedek kutusu ARTIK HER ZAMAN ciziliyor (emoji icinde),
// resim CSS ile onun USTUNE biniyor. Resim gelince .yuklendi sinifi emojiyi
// gizliyor. Sinifi ekleyen dinleyici CAPTURE fazinda -- 'load' KABARCIKLANMAZ.
//
// LAYOUT DEGISMEDI (olculdu, once/sonra birebir ayni):
//   strip-card 164x255 · gorsel 138x90 · product-card 173x292 · gorsel 171x130
//   detay-img-wrap 390x228 · img 180x180 · altOgeY 296 · sayfaH 3179
import fs from 'fs';
import vm from 'node:vm';

const APP = fs.readFileSync('app.js', 'utf8');
const CSS = fs.readFileSync('style.css', 'utf8');
let pass = 0, fail = 0;
const ok = (ad, k, d = '') => { if (k) { pass++; console.log('  PASS  ' + ad); } else { fail++; console.log('  FAIL  ' + ad + (d ? '  -> ' + d : '')); } };

function govde(ad) {
  const b = APP.indexOf('function ' + ad + '(');
  if (b < 0) return '';
  let d = 0;
  for (let j = APP.indexOf('{', b); j < APP.length; j++) {
    const c = APP[j];
    if (c === '{') d++;
    else if (c === '}') { d--; if (d === 0) return APP.slice(b, j + 1); }
  }
  return '';
}

console.log('\n=== 1. YEDEK KUTUSU RESIMDEN BAGIMSIZ CIZILIYOR ===');
// Asil iddia: resim GELMEDEN once de kutuda bir sey var.
ok('serit: -ph kutusu img\'yi SARIYOR',
   /strip-card-img-ph gorsel-yuva[^`]*<img class="strip-card-img"/.test(APP), '');
ok('kategori: -ph kutusu img\'yi SARIYOR',
   /product-card-img-ph gorsel-yuva[^`]*<img class="product-card-img"/.test(APP), '');
// Detayda kap zaten vardi (.detay-img-wrap); emoji resimle BIRLIKTE basilmali.
const od = govde('openDetay');
ok('detay: emoji resimle BIRLIKTE basiliyor (once yalnizca img vardi)',
   /\$\{emoji\}<img src=/.test(od), (od.match(/const imgHtml[\s\S]{0,180}/) || [''])[0]);

console.log('\n=== 2. onerror ARTIK HTML URETMIYOR ===');
// Eski onerror satir ici HTML kuruyordu ve kacis hatasi 2026-08-19'da
// gorsel yedegini TAMAMEN kirmisti. Yeni yedek kutusu zaten yerinde
// oldugu icin onerror'in tek isi resmi kaldirmak.
for (const [ad, desen] of [['serit', /<img class="strip-card-img"[^`]*/], ['kategori', /<img class="product-card-img"[^`]*/]]) {
  const s = (APP.match(desen) || [''])[0];
  const oe = (/onerror="([^"]*)"/.exec(s) || [])[1] || '';
  ok(ad + ': onerror = this.remove()', /this\.remove\(\)/.test(oe), oe);
  ok('  ' + ad + ': onerror icinde HTML yok', !oe.includes('<') && !/outerHTML|innerHTML/.test(oe), oe);
}

console.log('\n=== 3. SATIR ICI onload EKLENMEDI (117 kilidi) ===');
// Yuklendi sinyali delegasyonla aliniyor; satir ici bir yukleme ozniteligi
// sayaci buyuturdu.
// YORUMLAR SOYULUYOR: bu depoda testin kendi ACIKLAMA YORUMUYLA eslesmesi
// UC KEZ yanlis alarm uretti (bkz. CLAUDE.md). Ilk yazisimda yine oldu --
// app.js'teki "satir ici onload= EKLENMEDI" yorumu iddiayi kirmiziya
// dusurmustu. Once soy, sonra ara.
const APP_KODU = APP.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
ok('app.js\'te satir ici yukleme oznitelig\'i YOK', !/\bonload\s*=/.test(APP_KODU),
   (APP_KODU.match(/.{0,40}onload\s*=.{0,40}/) || [''])[0]);

console.log('\n=== 4. DINLEYICI DAVRANISI (kontrol gruplu) ===');
const gy = govde('_gorselYuklendi');
ok('_gorselYuklendi tanimli', gy.length > 0);

const kutu = { console };
vm.createContext(kutu);
vm.runInContext(gy, kutu);
// Sahte DOM: classList'i gercekten tutan minik nesne
const sahteKap = (siniflar) => {
  const set = new Set(siniflar);
  return { _set: set, classList: { contains: (c) => set.has(c), add: (c) => set.add(c) } };
};
const calistir = (tag, kap) => {
  kutu.olay = { target: { tagName: tag, parentElement: kap } };
  vm.runInContext('_gorselYuklendi(olay)', kutu);
  return kap && kap._set ? kap._set.has('yuklendi') : false;
};
ok('gorsel-yuva kabina .yuklendi EKLENIYOR', calistir('IMG', sahteKap(['strip-card-img-ph', 'gorsel-yuva'])));
ok('detay-img-wrap kabina .yuklendi EKLENIYOR', calistir('IMG', sahteKap(['detay-img-wrap'])));
// KONTROL GRUBU: alakasiz kaplara ve IMG olmayan hedeflere DOKUNMAMALI
ok('KONTROL: alakasiz kaba EKLENMIYOR', !calistir('IMG', sahteKap(['baska-kutu'])));
ok('KONTROL: IMG olmayan hedefte EKLENMIYOR', !calistir('DIV', sahteKap(['gorsel-yuva'])));
// Cokmemeli
kutu.olay = { target: null };
let patladi = false;
try { vm.runInContext('_gorselYuklendi(olay)', kutu); } catch (e) { patladi = true; }
ok('KONTROL: hedefsiz olayda patlamiyor', !patladi);

console.log('\n=== 5. CAPTURE FAZI ZORUNLU ===');
// 'load' olayi KABARCIKLANMAZ. ucuncu argüman true olmadan document
// uzerindeki dinleyici bu olayi HIC gormez ve emoji hep gorunur kalir.
ok("document.addEventListener('load', _gorselYuklendi, true) kayitli",
   /document\.addEventListener\(\s*['"]load['"]\s*,\s*_gorselYuklendi\s*,\s*true\s*\)/.test(APP),
   (APP.match(/document\.addEventListener\([^)]*load[^)]*\)/) || [''])[0]);

console.log('\n=== 6. CSS SOZLESMESI ===');
const cssTemiz = CSS.replace(/\/\*[\s\S]*?\*\//g, '');   // yorumlari SOY (bu depoda iki kez yanlis alarm verdi)
ok('.gorsel-yuva konumlandirma kabi', /\.gorsel-yuva\s*\{[^}]*position:\s*relative/.test(cssTemiz));
ok('.gorsel-yuva > img akistan cikmis', /\.gorsel-yuva\s*>\s*img\s*\{[^}]*position:\s*absolute/.test(cssTemiz));
ok('  img arka plani SEFFAF (yoksa emojiyi orter)', /\.gorsel-yuva\s*>\s*img\s*\{[^}]*background:\s*transparent/.test(cssTemiz));
ok('.gorsel-yuva.yuklendi emojiyi gizliyor', /\.gorsel-yuva\.yuklendi\s*\{[^}]*font-size:\s*0/.test(cssTemiz));
ok('.detay-img-wrap.yuklendi emojiyi gizliyor', /\.detay-img-wrap\.yuklendi\s*\{[^}]*font-size:\s*0/.test(cssTemiz));
// Layout kilidi: resim akistan cikinca yuksekligi emoji belirlerdi (180->128)
// ve sayfa 48px KAYARDI. min-height olculen degere civilendi.
ok('.detay-img-wrap min-height 228px (olculen deger, layout kilidi)',
   /\.detay-img-wrap\s*\{[^}]*min-height:\s*228px/.test(cssTemiz),
   (cssTemiz.match(/\.detay-img-wrap\s*\{[^}]*\}/) || [''])[0].slice(0, 160));
ok('masaustu min-height 308px (260 + 48 padding)',
   /#detayContent\s+\.detay-img-wrap\s*\{[^}]*min-height:\s*308px/.test(cssTemiz));

console.log('\nSONUC: PASS=' + pass + ' FAIL=' + fail);
process.exit(fail ? 1 : 0);
