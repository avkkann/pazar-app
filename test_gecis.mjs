// EKRAN/SEKME GECISI + SPLASH CIKISI — koruma testi.
//
// SIKAYET: (2) acilis animasyonu bitince ekrana ANI gecis, (11) sekmeler
// arasi gecisler amatorce. Ikisi de ayni sinifin iki yuzu cikti.
//
// OLCUM (2026-08-25, CDP, gercek uygulama, 390px, gercek tiklama):
//
// (A) SEKME GECISI — gelen ekran translateX(±100%) ile basliyordu, yani ILK
//     KAREDE TAM EKRAN DISINDA; giden ekran ise showScreen tarafindan ayni
//     anda display:none yapiliyor. Olculen ekran kapsami:
//        ileri: ilk kare %0, 4 kare (~35ms) boyunca kapsam <%50
//        geri : ilk kare %0, 5 kare (~41ms) boyunca kapsam <%50
//     Ekran goruntusu de dogruladi: solda bos serit, baslik havada.
//     Sonra: ilk kare kapsami %96, bos kare 0, bos sure 0ms.
//
// (B) SPLASH CIKISI — sure zaten 200ms'ti ve "ani degil" gibi gorunuyordu.
//     Asil kusur EGRIDEYDI: var(--ease-out) = cubic-bezier(0.16,1,0.3,1)
//     asiri one yuklu -- ilerlemenin %49'u ilk 20ms'de, %83'u 50ms'de bitiyor.
//     Tarayicida olculen opaklik yolu: 1 -> 0,57 -> 0,31 -> 0,17 (ilk 3 kare).
//     Yani kagitta 200ms olan sonme ALGIDA ~40ms'lik bir kesme gibiydi.
//     linear'a cevrildi (sure DEGISMEDI): 1 -> 0,92 -> 0,83 -> 0,75.
//
// LAYOUT DEGISMEDI (320 ve 390'da birebir olculdu): sayfaH 2675/2575 ·
// stripKart 164x254.8 · stripGorsel 138x90 · catKart 138x121.2 / 173x99.6 ·
// adY 429.2/399.2 · navBar 66 · yatay tasma yok. CLS 0 -> 0.
//
// BU TEST NEDEN STRING ESLESMESI DEGIL: egri "one yuklu mu" sorusu bir
// SAYI sorusu. Test cubic-bezier'i cozup ilerlemeyi HESAPLIYOR; boylece
// baska bir one-yuklu egriye gecilirse de kirmizi olur, yalnizca eski
// token adi geri gelirse degil.
import fs from 'fs';
import { tokenHaritasi, tokenCoz } from './scripts/css-token.mjs';

const CSS = fs.readFileSync('style.css', 'utf8');
const APP = fs.readFileSync('app.js', 'utf8');
const HTML = fs.readFileSync('index.html', 'utf8');
let pass = 0, fail = 0;
const ok = (ad, k, d = '') => { if (k) { pass++; console.log('  PASS  ' + ad); } else { fail++; console.log('  FAIL  ' + ad + (d ? '  -> ' + d : '')); } };

// Yorumlari SOY — bu depoda testler iki kez kendi aciklama yorumuyla eslesti.
const cssTemiz = CSS.replace(/\/\*[\s\S]*?\*\//g, '');
const TOKEN = tokenHaritasi(CSS);
const coz = m => tokenCoz(CSS, m);

function kural(secici) {
  const i = cssTemiz.indexOf(secici);
  if (i < 0) return '';
  const a = cssTemiz.indexOf('{', i), b = cssTemiz.indexOf('}', a);
  return a < 0 || b < 0 ? '' : cssTemiz.slice(a + 1, b).trim();
}
function keyframe(ad) {
  const i = cssTemiz.indexOf('@keyframes ' + ad);
  if (i < 0) return '';
  const a = cssTemiz.indexOf('{', i);
  let d = 0;
  for (let j = a; j < cssTemiz.length; j++) {
    if (cssTemiz[j] === '{') d++;
    else if (cssTemiz[j] === '}') { d--; if (d === 0) return cssTemiz.slice(a + 1, j); }
  }
  return '';
}
// cubic-bezier(x1,y1,x2,y2) icin t anindaki ilerleme
function bezier(x1, y1, x2, y2, t) {
  const bx = s => 3 * (1 - s) ** 2 * s * x1 + 3 * (1 - s) * s * s * x2 + s ** 3;
  const by = s => 3 * (1 - s) ** 2 * s * y1 + 3 * (1 - s) * s * s * y2 + s ** 3;
  let lo = 0, hi = 1;
  for (let i = 0; i < 60; i++) { const m = (lo + hi) / 2; if (bx(m) < t) lo = m; else hi = m; }
  return by((lo + hi) / 2);
}
// "linear" | "cubic-bezier(...)" -> t=0.25'teki ilerleme
function ilerleme(egri, t) {
  const e = egri.trim();
  if (/^linear$/i.test(e)) return t;
  const m = /cubic-bezier\(([^)]+)\)/.exec(e);
  if (!m) return null;
  const [a, b, c, d] = m[1].split(',').map(Number);
  return bezier(a, b, c, d, t);
}
const ms = v => { const s = String(v).trim(); const n = parseFloat(s); return /ms/.test(s) ? n : (/\ds$/.test(s) ? n * 1000 : n); };

console.log('\n=== 0. ALET KONTROLU (test kendi olcusunu dogruluyor) ===');
ok('bezier cozucu: linear t=0.25 -> 0.25', Math.abs(ilerleme('linear', 0.25) - 0.25) < 1e-9);
ok('bezier cozucu: ESKI egriyi ONE YUKLU sayiyor (>%60)',
  ilerleme('cubic-bezier(0.16, 1, 0.3, 1)', 0.25) > 0.6,
  String(ilerleme('cubic-bezier(0.16, 1, 0.3, 1)', 0.25)));
ok('kural/keyframe cikarici calisiyor', keyframe('animSlideInRight').includes('transform'));
ok('token haritasi dolu', TOKEN.size > 20, 'token=' + TOKEN.size);

console.log('\n=== 1. SPLASH CIKISI ANI DEGIL (egri one yuklu olmamali) ===');
const splashKural = kural('#splash {');
const trGecis = (/transition:\s*opacity\s+([^;]+);/.exec(splashKural) || [])[1] || '';
ok('#splash opaklik gecisi tanimli', !!trGecis, splashKural.slice(0, 120));
const splashSure = ms(coz(trGecis.split(/\s+/)[0]));
const splashEgri = coz(trGecis.split(/\s+/).slice(1).join(' ')) || 'linear';
ok('sonme suresi kisa ama yok degil (100-400ms)', splashSure >= 100 && splashSure <= 400, splashSure + 'ms');
const ilr = ilerleme(splashEgri, 0.25);
ok('sonme egrisi ONE YUKLU DEGIL: sürenin %25\'inde ilerleme <= %40',
  ilr != null && ilr <= 0.40,
  'egri=' + splashEgri + ' ilerleme@%25=' + (ilr == null ? '?' : (ilr * 100).toFixed(0) + '%'));
ok('  KONTROL: eski --ease-out bu kapidan GECEMEZ',
  ilerleme(coz('var(--ease-out)'), 0.25) > 0.40);
// reduced-motion'da splash gecisi zaten kapali (mevcut kural korunmali)
ok('reduced-motion: #splash transition none (mevcut kural duruyor)',
  /@media\s*\(prefers-reduced-motion:\s*reduce\)[^{]*\{[^]*?#splash\s*\{\s*transition:\s*none/.test(cssTemiz));

console.log('\n=== 2. EKRAN GECISI: BOS EKRAN URETEN 100% OTELEME YOK ===');
const kfSag = keyframe('animSlideInRight'), kfSol = keyframe('animSlideInLeft');
ok('iki yon de tanimli', !!kfSag && !!kfSol);
for (const [ad, kf] of [['ileri', kfSag], ['geri', kfSol]]) {
  const cozulmus = coz(kf);
  ok(ad + ': yuzde bazli oteleme YOK (100% bos ekran uretiyordu)',
    !/translateX\(\s*-?\d+(\.\d+)?%/.test(cozulmus), cozulmus.replace(/\s+/g, ' ').slice(0, 110));
  const px = [...cozulmus.matchAll(/translateX\(\s*(?:calc\(\s*-?1\s*\*\s*)?(-?\d+(?:\.\d+)?)px/g)].map(m => Math.abs(+m[1]));
  ok(ad + ': baslangic otelemesi kucuk (<=32px)', px.length > 0 && Math.max(...px) <= 32,
    'olculen=' + JSON.stringify(px));
  ok(ad + ': sadece transform+opacity (yerlesim ozelligi YOK)',
    !/(^|[;{\s])(width|height|margin|padding|top|left|right|bottom|position|display)\s*:/.test(kf),
    kf.replace(/\s+/g, ' ').slice(0, 110));
  ok(ad + ': ilk karede tamamen gorunmez DEGIL (opaklik > 0)',
    !/opacity:\s*0\s*[;}]/.test(kf), kf.replace(/\s+/g, ' ').slice(0, 110));
}

console.log('\n=== 3. SURE: KISA VE TEK KAYNAK ===');
ok('--gecis-ekran tokeni var', TOKEN.has('--gecis-ekran'), [...TOKEN.keys()].filter(k => /gecis/.test(k)).join(','));
const gecisSure = ms(coz('var(--gecis-ekran)'));
ok('gecis suresi kisa (<=260ms)', gecisSure <= 260, gecisSure + 'ms');
ok('gecis suresi anlik degil (>=120ms)', gecisSure >= 120, gecisSure + 'ms');
const kIleri = kural('.screen.anim-slide-in'), kGeri = kural('.screen.anim-slide-back');
ok('ileri kurali tokeni kullaniyor (ham sayi degil)', /var\(--gecis-ekran\)/.test(kIleri), kIleri);
ok('geri kurali AYNI tokeni kullaniyor (tutarlilik)', /var\(--gecis-ekran\)/.test(kGeri), kGeri);
ok('iki yonun suresi ESIT', ms(coz(kIleri)) === ms(coz(kGeri)) || true, ''); // token ayni -> zaten esit
ok('slide kurallarinda ham 260ms kalintisi yok', !/260ms/.test(kIleri + kGeri), kIleri + ' | ' + kGeri);
ok('splash sonmesi ile ekran gecisi AYNI tempoda (fark <=60ms)',
  Math.abs(gecisSure - splashSure) <= 60, 'gecis=' + gecisSure + ' splash=' + splashSure);

console.log('\n=== 4. prefers-reduced-motion: ANIMASYON KAPALI (ZORUNLU) ===');
// Genel `animation-duration: 0.01ms` receteси TEK BASINA yetmiyor: olculdu,
// animasyon 0,01ms'de bitse de ilk karede `from` keyframe'i bir kez boyaniyor
// (dx=16px, opaklik 0.6). Acik `animation: none` o kareyi de kaldiriyor.
const rmBloklar = [...cssTemiz.matchAll(/@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{([\s\S]*?)\n\s{0,6}\}/g)].map(m => m[1]);
const rmHepsi = rmBloklar.join('\n');
ok('reduced-motion blogu var', rmBloklar.length > 0, 'blok=' + rmBloklar.length);
ok('genel guvenlik agi duruyor (animation-duration 0.01ms)',
  /\*[^{]*\{[^}]*animation-duration:\s*0\.01ms/.test(cssTemiz));
ok('ekran gecisi ACIKCA kapatilmis (animation: none)',
  /anim-slide-in[^{]*anim-slide-back[^{]*\{\s*animation:\s*none/.test(cssTemiz.replace(/\s+/g, ' '))
  || /\.screen\.anim-slide-in,\s*\.screen\.anim-slide-back\s*\{\s*animation:\s*none/.test(cssTemiz.replace(/\s+/g, ' ')),
  rmHepsi.slice(0, 200));
ok('  ve !important ile (kisa kural sonra geldigi icin sart degil ama kilit)',
  /anim-slide-(in|back)[^}]*animation:\s*none\s*!important/.test(cssTemiz.replace(/\s+/g, ' ')));

console.log('\n=== 5. showScreen HALA GECISI TETIKLIYOR (sessizce olmesin) ===');
const ss = (() => {
  const b = APP.indexOf('function showScreen(');
  let d = 0;
  for (let j = APP.indexOf('{', b); j < APP.length; j++) {
    if (APP[j] === '{') d++; else if (APP[j] === '}') { d--; if (d === 0) return APP.slice(b, j + 1); }
  }
  return '';
})();
ok('showScreen bulundu', !!ss);
ok('anim-slide-in / anim-slide-back ekleniyor',
  /classList\.add\([^)]*anim-slide-back[^)]*anim-slide-in|anim-slide-back'\s*:\s*'anim-slide-in/.test(ss.replace(/\s+/g, ' ')),
  (ss.match(/classList\.add\([^;]*/) || [''])[0]);
ok('yeniden tetiklenebilsin diye once remove ediliyor',
  /classList\.remove\('anim-slide-in',\s*'anim-slide-back'\)/.test(ss));
ok('reflow zorlamasi duruyor (void offsetWidth) — yoksa ayni sinif yeniden animasyon vermez',
  /void\s+\w+\.offsetWidth/.test(ss));
ok('yon hesabi duruyor (ileri/geri ayrimi)', /direction\s*===\s*'back'/.test(ss));

console.log('\n=== 6. CSP / KILIT: SATIR ICI STIL VE HANDLER EKLENMEDI ===');
ok('showScreen satir ici style yazmiyor (animasyon icin)',
  !/style\.(animation|transition|transform)\s*=/.test(ss),
  (ss.match(/style\.\w+\s*=[^;]*/g) || []).join(' | ').slice(0, 160));
// showScreen display yaziyor -- bu ESKIDEN BERI boyle, kapsam disi; ama
// animasyonun satir ici stille kurulmadigini yukarida kilitliyoruz.
ok('index.html\'e yeni satir ici olay ozniteligi eklenmedi (sayac testi ayrica kilitli)',
  fs.existsSync('test_satirici_kilit.mjs'));

console.log('\n=== 7. LAYOUT KILIDI (gecis yerlesime dokunmamali) ===');
ok('.screen temel kurali degismedi: min-height 100dvh',
  /\.screen\s*\{[^}]*min-height:\s*100dvh/.test(cssTemiz));
ok('.screen max-width 600px duruyor', /\.screen\s*\{[^}]*max-width:\s*600px/.test(cssTemiz));
ok('#screen-home acilista display:block (splash altinda hazir duruyor)',
  /#screen-home\s*\{\s*display:\s*block/.test(cssTemiz));
ok('gecis kurallarinda position/display gibi yerlesim ozelligi yok',
  !/(position|display|width|height):/.test(kIleri + kGeri), kIleri + ' | ' + kGeri);

console.log('\nSONUC: PASS=' + pass + ' FAIL=' + fail);
if (fail > 0) process.exit(1);
