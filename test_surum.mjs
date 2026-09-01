// test_surum.mjs — surum numarasi TEK KAYNAKTAN geliyor mu?
//
// Korudugu borc: Profil'deki surum `index.html`'e elle `v1.0` yazilmisti,
// `sw.js`'teki `pazar-cache-v232` ile hicbir bagi yoktu. Iki numara bagimsiz
// suruklendi. Bu test o bagi kilitler.
//
// Saf fonksiyonlar test ediliyor (fs/ag yok) + index.html/vite.config.js
// KAYNAK duzeyinde: yuva duruyor mu, eklenti zincire bagli mi, ve en onemlisi
// sabit surum GERI GELMIS mi.
import { readFileSync } from 'node:fs';
import { swSurumOku, surumEkle } from './scripts/surum.mjs';

let pass = 0, fail = 0;
const ok = (ad, kosul, ek = '') => {
  if (kosul) { pass++; console.log('  PASS  ' + ad); }
  else { fail++; console.log('  FAIL  ' + ad + (ek ? '  -> ' + ek : '')); }
};

// ── 0. KONTROL GRUBU: okuyucu gercekten okuyor mu, yoksa hep null mu? ────────
console.log('\n=== 0. KONTROL GRUBU ===');
ok('gecerli kaynaktan surum okunuyor',
  swSurumOku("const CACHE_NAME = 'pazar-cache-v99';") === '99',
  String(swSurumOku("const CACHE_NAME = 'pazar-cache-v99';")));
ok('BASKA bir surum de okunuyor (sabit doner mi kontrolu)',
  swSurumOku('const CACHE_NAME = "pazar-cache-v7";') === '7',
  String(swSurumOku('const CACHE_NAME = "pazar-cache-v7";')));
ok('desen yoksa null', swSurumOku('const X = 1;') === null);
ok('string olmayan girdi patlatmiyor', swSurumOku(null) === null);

// YORUM TUZAGI: bu depoda testler/enjektorler defalarca ACIKLAMA YORUMUYLA
// eslesti. Okuyucu yorumlari soymali, yoksa yorumdaki ornek surumu alir.
const yorumlu = `
// Ornek: CACHE_NAME = 'pazar-cache-v111' seklinde yazilir
/* eski deger: pazar-cache-v222 idi */
const CACHE_NAME = 'pazar-cache-v333';
`;
ok('yorumdaki ornek surum DEGIL, gercek deger okunuyor',
  swSurumOku(yorumlu) === '333', String(swSurumOku(yorumlu)));

// ── 1. ENJEKSIYON ────────────────────────────────────────────────────────────
console.log('\n=== 1. ENJEKSIYON ===');
const yuva = '<div id="profilSurum"><span id="surumNo">v?</span> · slogan</div>';
ok('yuva dolduruluyor',
  surumEkle(yuva, '232').includes('<span id="surumNo">v232</span>'),
  surumEkle(yuva, '232'));
ok('yuva DISINDAKI metne dokunulmuyor',
  surumEkle(yuva, '232').includes('· slogan'));
ok('surum null ise HTML aynen kaliyor (build kirilmaz)',
  surumEkle(yuva, null) === yuva);
ok('ikinci kez uygulanabilir (idempotent)',
  surumEkle(surumEkle(yuva, '232'), '232').includes('v232') &&
  !surumEkle(surumEkle(yuva, '232'), '232').includes('v232v232'));

// ── 2. GERCEK DOSYALAR ───────────────────────────────────────────────────────
console.log('\n=== 2. GERCEK DOSYALAR ===');
const HTML = readFileSync('index.html', 'utf8');
const SW = readFileSync('sw.js', 'utf8');
const VITE = readFileSync('vite.config.js', 'utf8');

ok('index.html surum yuvasini tasiyor',
  /<span id="surumNo">[^<]*<\/span>/.test(HTML));
ok('sw.js okunabiliyor ve surum veriyor', swSurumOku(SW) !== null, String(swSurumOku(SW)));
ok('vite.config.js eklentiyi zincire baglamis',
  /plugins:\s*\[[^\]]*surumEnjekte\(\)/.test(VITE));

// EN ONEMLI IDDIA: sabit surum geri gelmemis olmali.
// `v1.0` gibi elle yazilmis bir surum yuvanin ICINDE olmamali.
const yuvaIci = (HTML.match(/<span id="surumNo">([^<]*)<\/span>/) || [])[1] || '';
ok('yuvada ELLE yazilmis surum numarasi YOK',
  !/^v\d+\.\d+/.test(yuvaIci.trim()),
  'yuvada: ' + JSON.stringify(yuvaIci));

// index.html'de yuva disinda "v1.0" gibi bir surum kalintisi da olmamali
const yorumsuzHTML = HTML.replace(/<!--[\s\S]*?-->/g, '');
ok('index.html govdesinde bagimsiz "v1.0" kalintisi yok',
  !/>v\d+\.\d+\s*·/.test(yorumsuzHTML));

console.log('\nPASS=' + pass + '  FAIL=' + fail);
process.exit(fail ? 1 : 0);
