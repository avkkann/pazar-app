// EKRAN/SEKME GECISI + SPLASH CIKISI — koruma testi.
//
// SIKAYET: (2) acilis animasyonu bitince ekrana ANI gecis, (11) sekmeler
// arasi gecisler amatorce. Ikisinde de animasyon ZATEN VARDI; ayar yanlisti.
//
// ── ILK TUR: BOSLUK YANLIS COZULDU (ders, kayitta kalsin) ──
// Olculmustu: gecisin basinda ekran ~35-41ms BOS kaliyordu (giden ekran
// aninda display:none, gelen ekran translateX(100%) ile disarida; ilk kare
// kapsami %0). O tur bosluk OTELEME MESAFESI KISILARAK (100% -> 16px)
// kapatildi. Bosluk gitti AMA gecis de algilanamaz oldu -- "gecis yok gibi".
// DOGRU COZUM mesafeyi kismak degil, GIDEN EKRANI GORUNUR TUTMAK.
//
// ── SIMDIKI TASARIM ──
// Giden ekran gecis boyunca ekranda kalir, ters yone otelenir; ikisi tek
// film seridi gibi kayar. Olculen (CDP, 390px, gercek tiklama):
//   ilk kare kapsami %100 (once %0) · BOS KARE 0 (once 4-5) ·
//   IKI EKRAN GORUNUR 15 kare · YATAY TASMA 0 kare ·
//   t~117ms: ekran %37 eski / %63 yeni  · yerlesme 268/277ms · CLS 0
//
// Uc sey birbirine BAGLI ve testin asil isi bunlari kilitlemek:
//  1) Oteleme %100 olmali. %85-90'da gecis sonunda gidenin sag %15'i
//     ekranda kalir ve absolute oldugu icin girenin USTUNE boyanir.
//  2) Giren ve cikan AYNI sure + AYNI egriyi kullanmali, yoksa birebir
//     dosenmez (arada bosluk ya da bindirme).
//  3) Egri ONE YUKLU olmamali. Olculdu, 260ms uzerinde yol ilerlemesi:
//       --ease-giris  %76 / %96 / %100  (65/130/195ms)
//       ease-out kw   %38 / %68 / %91
//     Uygulamanin kendi egrileri 390px'lik kaymayi 130ms'lik SICRAMAYA
//     cevirir. Bu yuzden egri iddiasi string degil SAYI kapisi.
//
// SPLASH (dokunulmadi, kilit duruyor): sure zaten 200ms'ti, kusur EGRIDEYDI.
// var(--ease-out) ilerlemenin %83'unu ilk 50ms'de bitiriyordu; linear yapildi.
import fs from 'fs';
import { tokenHaritasi, tokenCoz } from './scripts/css-token.mjs';

const CSS = fs.readFileSync('style.css', 'utf8');
const APP = fs.readFileSync('app.js', 'utf8');
let pass = 0, fail = 0;
const ok = (ad, k, d = '') => { if (k) { pass++; console.log('  PASS  ' + ad); } else { fail++; console.log('  FAIL  ' + ad + (d ? '  -> ' + d : '')); } };

// Yorumlari SOY — bu depoda testler kendi aciklama yorumuyla UC kez esletti.
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
function govde(ad) {
  const b = APP.indexOf('function ' + ad + '(');
  if (b < 0) return '';
  let d = 0;
  for (let j = APP.indexOf('{', b); j < APP.length; j++) {
    if (APP[j] === '{') d++; else if (APP[j] === '}') { d--; if (d === 0) return APP.slice(b, j + 1); }
  }
  return '';
}
function bezier(x1, y1, x2, y2, t) {
  const bx = s => 3 * (1 - s) ** 2 * s * x1 + 3 * (1 - s) * s * s * x2 + s ** 3;
  const by = s => 3 * (1 - s) ** 2 * s * y1 + 3 * (1 - s) * s * s * y2 + s ** 3;
  let lo = 0, hi = 1;
  for (let i = 0; i < 60; i++) { const m = (lo + hi) / 2; if (bx(m) < t) lo = m; else hi = m; }
  return by((lo + hi) / 2);
}
// CSS anahtar sozcukleri de cozulur; yoksa "ease-out" gorunce sessizce
// null donup iddia bosa duserdi.
const KW = { linear: [0, 0, 1, 1], ease: [0.25, 0.1, 0.25, 1], 'ease-in': [0.42, 0, 1, 1], 'ease-out': [0, 0, 0.58, 1], 'ease-in-out': [0.42, 0, 0.58, 1] };
function ilerleme(egri, t) {
  const e = String(egri).trim();
  if (KW[e]) { const [a, b, c, d] = KW[e]; return bezier(a, b, c, d, t); }
  const m = /cubic-bezier\(([^)]+)\)/.exec(e);
  if (!m) return null;
  const [a, b, c, d] = m[1].split(',').map(Number);
  return bezier(a, b, c, d, t);
}
const ms = v => { const s = String(v).trim(); const n = parseFloat(s); return /ms/.test(s) ? n : (/\ds$/.test(s) ? n * 1000 : n); };

console.log('\n=== 0. ALET KONTROLU (test kendi olcusunu dogruluyor) ===');
ok('bezier: linear t=0.25 -> 0.25', Math.abs(ilerleme('linear', 0.25) - 0.25) < 1e-9);
ok('bezier: --ease-giris ONE YUKLU sayiliyor (>%60)',
  ilerleme('cubic-bezier(0.22, 1, 0.36, 1)', 0.25) > 0.6, String(ilerleme('cubic-bezier(0.22,1,0.36,1)', 0.25)));
ok('bezier: ease-out ANAHTAR SOZCUGU one yuklu DEGIL (<%50)',
  ilerleme('ease-out', 0.25) < 0.5, String(ilerleme('ease-out', 0.25)));
ok('keyframe/kural cikarici calisiyor', keyframe('animSlideInRight').includes('transform') && !!kural('.screen.anim-slide-in'));
ok('showScreen govdesi cikarilabiliyor', govde('showScreen').includes('classList'));

console.log('\n=== 1. OTELEME BUYUK (16px\'e geri donus YASAK) ===');
ok('--gecis-otele tokeni var', TOKEN.has('--gecis-otele'), [...TOKEN.keys()].filter(k => /gecis/.test(k)).join(','));
const otele = String(coz('var(--gecis-otele)')).trim();
ok('oteleme YUZDE cinsinden (viewport genisligine bagli)', /%$/.test(otele), otele);
const oteleYuzde = parseFloat(otele);
// TAM %100 — "buyuk olsun" degil, BIREBIR DOSENME sarti. %85 OLCULDU ve
// elendi: her karede iki ekranin kapsam toplami 1,15 cikiyor, yani sabit
// %15 BINDIRME var; cikan ekran absolute oldugu icin o bandi USTTEN
// kapatiyor ve giren ekran kirpik gorunuyor. %100'de toplam tam 1,000.
// (Bu iddia once ">=85" diye yazilmisti ve harness KOR oldugunu gosterdi:
// 85% mutasyonu yesil kalmisti. Gevsetilmedi, DUZELTILDI.)
ok('oteleme TAM %100 (birebir dosenme sarti; %85\'te sabit %15 bindirme olculdu)',
  /%$/.test(otele) && oteleYuzde === 100, otele);
// Asil kilit: 16px gibi kucuk bir DEGERE donulurse kirmizi.
ok('KUCUK px degerine donulmemis (gecis algilanamaz olurdu)',
  !/^\d+(\.\d+)?px$/.test(otele) || parseFloat(otele) > 200, otele);

console.log('\n=== 2. IKI EKRAN: CIKAN EKRAN GECIS BOYUNCA GORUNUR ===');
const kIleri = kural('.screen.anim-slide-in'), kGeri = kural('.screen.anim-slide-back');
const kCikSol = kural('.screen.anim-cikis-sol'), kCikSag = kural('.screen.anim-cikis-sag');
ok('cikis sinifi (sol) tanimli', !!kCikSol, 'bulunamadi');
ok('cikis sinifi (sag) tanimli', !!kCikSag, 'bulunamadi');
ok('cikis keyframe\'leri tanimli',
  !!keyframe('animSlideOutLeft') && !!keyframe('animSlideOutRight'));
for (const [ad, kf] of [['cikis-sol', keyframe('animSlideOutLeft')], ['cikis-sag', keyframe('animSlideOutRight')]]) {
  const c = coz(kf);
  ok(ad + ': 0\'dan BASLAR (ekranda duruyor)', /from\s*\{\s*transform:\s*translateX\(0\)/.test(c.replace(/\s+/g, ' ')), c.replace(/\s+/g, ' ').slice(0, 90));
  ok(ad + ': tam mesafe oteleniyor', new RegExp('translateX\\((calc\\([^)]*)?-?\\s*' + oteleYuzde + '%').test(c.replace(/\s+/g, ' ')), c.replace(/\s+/g, ' ').slice(0, 100));
  ok(ad + ': sadece transform (yerlesim ozelligi yok)',
    !/(^|[;{\s])(width|height|margin|padding|top|left|right|bottom)\s*:/.test(kf), kf.replace(/\s+/g, ' ').slice(0, 90));
}
// Cikan ekran AKISTAN CIKMALI: ekranlar BODY'nin dogrudan cocugu, ikisi de
// akistayken ALT ALTA dizilir (olculdu: sepetOffsetTop 2575).
const cikisOrtak = kural('.screen.anim-cikis-sol,');
ok('cikan ekran position:absolute (yoksa alt alta dizilir)',
  /position:\s*absolute/.test(cikisOrtak), cikisOrtak.replace(/\s+/g, ' ').slice(0, 120));
ok('cikan ekran top:0 (gorunur konum degismesin)', /top:\s*0/.test(cikisOrtak), cikisOrtak.replace(/\s+/g, ' ').slice(0, 120));
ok('cikan ekran tiklanamaz (pointer-events:none)', /pointer-events:\s*none/.test(cikisOrtak), cikisOrtak.replace(/\s+/g, ' ').slice(0, 120));

console.log('\n=== 3. BIREBIR DOSENME: AYNI SURE + AYNI EGRI ===');
// Giren ve cikan farkli sure/egri kullanirsa aralarinda bosluk ya da
// bindirme olusur; bu yuzden DORDU de ayni tokenlara bagli olmali.
for (const [ad, k] of [['giris-ileri', kIleri], ['giris-geri', kGeri], ['cikis-sol', kCikSol], ['cikis-sag', kCikSag]]) {
  ok(ad + ': sure tokeni var(--gecis-ekran)', /var\(--gecis-ekran\)/.test(k), k);
  ok(ad + ': egri tokeni var(--gecis-egri)', /var\(--gecis-egri\)/.test(k), k);
  ok(ad + ': `both` fill (bitiste geri sicramasin)', /\bboth\b/.test(k), k);
}
ok('slide kurallarinda ham sure kalintisi yok',
  !/\b\d+m?s\b/.test(kIleri + kGeri + kCikSol + kCikSag), kIleri + ' | ' + kCikSol);

console.log('\n=== 4. SURE VE EGRI: HAREKET SURE BOYUNCA OKUNSUN ===');
const gecisSure = ms(coz('var(--gecis-ekran)'));
ok('gecis suresi tanimli', !isNaN(gecisSure), String(gecisSure));
// TAM DEGER — aralik DEGIL. Onceki turda "oteleme >= %85" diye aralik yazilmis
// ve harness guard'in KOR oldugunu gostermisti (%85 mutasyonu yesil kalmisti).
// Ders: iddiayi olcumun soyledigi kadar dar yaz. 300ms secilmis bir degerdir
// (Mustafa "biraz daha uzun sursun" dedi, 260 -> 300); degisirse bu satir da
// BILEREK guncellenir, sessizce kaymaz.
ok('gecis suresi TAM 300ms', gecisSure === 300, gecisSure + 'ms');
const egri = String(coz('var(--gecis-egri)')).trim();
const ilr25 = ilerleme(egri, 0.25), ilr50 = ilerleme(egri, 0.5);
ok('egri cozulebiliyor', ilr25 != null, egri);
ok('egri ONE YUKLU DEGIL: yolun %25\'inde ilerleme <= %50',
  ilr25 != null && ilr25 <= 0.50, 'egri=' + egri + ' ilerleme@%25=' + (ilr25 == null ? '?' : (ilr25 * 100).toFixed(0) + '%'));
ok('yarida hareket henuz BITMEMIS: %50\'de ilerleme <= %80',
  ilr50 != null && ilr50 <= 0.80, 'ilerleme@%50=' + (ilr50 == null ? '?' : (ilr50 * 100).toFixed(0) + '%'));
ok('  KONTROL: --ease-giris bu kapidan GECEMEZ (390px kaymayi sicramaya cevirir)',
  ilerleme(coz('var(--ease-giris)'), 0.25) > 0.50);
ok('  KONTROL: --ease-out da GECEMEZ', ilerleme(coz('var(--ease-out)'), 0.25) > 0.50);
ok('egri hemen basliyor (ease-in gecikmesi yok): %10\'da ilerleme > 0',
  ilerleme(egri, 0.10) > 0.05, 'ilerleme@%10=' + (100 * ilerleme(egri, 0.10)).toFixed(0) + '%');

console.log('\n=== 5. YATAY TASMA KIRPILIYOR ===');
// Cikan ekran absolute; konumlanmis atasi yoksa kapsayici blok ILK KAPSAYICI
// BLOK olur ve html/body'nin overflow'u onu KIRPMAZ. Olculdu: geri geciste
// scrollWidth 390 -> 744 ve sayfa gercekten 354px kaydirilabiliyordu.
ok('html,body overflow-x kirpiyor', /html,\s*body\s*\{[^}]*overflow-x:\s*clip/.test(cssTemiz));
ok('body konumlanmis (cikan ekranin kapsayici blogu -> clip devreye girer)',
  /(^|\})\s*body\s*\{[^}]*position:\s*relative/.test(cssTemiz)
  || /\bbody\s*\{\s*position:\s*relative\s*;?\s*\}/.test(cssTemiz.replace(/\s+/g, ' ')),
  (cssTemiz.match(/body\s*\{[^}]{0,80}position[^}]{0,40}/) || [''])[0]);
ok('@supports yedegi duruyor (clip desteklenmeyen tarayici)',
  /@supports not \(overflow: clip\)/.test(cssTemiz));

console.log('\n=== 6. showScreen: GIDEN EKRANI HEMEN GIZLEMIYOR ===');
const ss = govde('showScreen');
ok('showScreen bulundu', !!ss);
ok('gizleme KOSULLU — giden ekran haric (once kosulsuz hepsi gizleniyordu)',
  /forEach\(function\(s\)\s*\{\s*\n?\s*if\s*\(!cikisVar \|\| s !== onceki\)/.test(ss)
  || /if\s*\(!cikisVar\s*\|\|\s*s\s*!==\s*onceki\)\s*s\.style\.display\s*=\s*'none'/.test(ss.replace(/\s+/g, ' ')),
  (ss.match(/querySelectorAll\('\.screen'\)[\s\S]{0,140}/) || [''])[0]);
ok('giden ekrana cikis sinifi ekleniyor',
  /classList\.add\(direction === 'back' \? 'anim-cikis-sag' : 'anim-cikis-sol'\)/.test(ss), '');
ok('giren ekrana giris sinifi ekleniyor',
  /classList\.add\(direction === 'back' \? 'anim-slide-back' : 'anim-slide-in'\)/.test(ss), '');
ok('reflow zorlamasi duruyor (void offsetWidth)', (ss.match(/void\s+\w+\.offsetWidth/g) || []).length >= 2,
  'sayi=' + (ss.match(/void\s+\w+\.offsetWidth/g) || []).length);
ok('yeni gecis baslamadan onceki cikis temizleniyor (hizli ard arda dokunus)',
  /_gecisTemizle\(\)/.test(ss));
ok('animationend ile ERKEN bitiriliyor', /addEventListener\('animationend'/.test(ss));
ok('setTimeout GUVENLIK AGI var (olay hic gelmezse ekranda kalmasin)', /setTimeout\(_gecisTemizle/.test(ss));
const temizle = govde('_gecisTemizle');
ok('_gecisTemizle sinifi kaldirip display:none yapiyor',
  /classList\.remove\('anim-cikis-sol', 'anim-cikis-sag'\)/.test(temizle) && /display = 'none'/.test(temizle), temizle.replace(/\s+/g, ' ').slice(0, 160));
// Sure TEK KAYNAK: JS ikinci bir sayi tutmamali
const sureFn = govde('_gecisSureMs');
ok('JS gecis suresini CSS TOKENINDEN okuyor (ikinci sayi yok)',
  /getPropertyValue\('--gecis-ekran'\)/.test(sureFn), sureFn.replace(/\s+/g, ' ').slice(0, 140));

console.log('\n=== 7. prefers-reduced-motion: ANIMASYON YOK (ZORUNLU) ===');
ok('genel guvenlik agi duruyor (animation-duration 0.01ms)',
  /\*[^{]*\{[^}]*animation-duration:\s*0\.01ms/.test(cssTemiz));
ok('giris sinifları ACIKCA kapatilmis (animation: none)',
  /\.screen\.anim-slide-in,\s*\.screen\.anim-slide-back\s*\{\s*animation:\s*none/.test(cssTemiz.replace(/\s+/g, ' ')),
  '');
// CIKIS sinifi CSS'te kapatilmamali; JS zaten HIC eklememeli. Sinif eklenip
// yalnizca animasyonu kapatilsaydi position:absolute yerinde kalir ve giden
// ekran gelenin USTUNDE hareketsiz dururdu.
ok('cikis sinifi reduced-motion\'da JS tarafinda hic EKLENMIYOR',
  /var azalt = _gecisAzalt\(\);/.test(ss) && /!azalt/.test(ss),
  (ss.match(/var cikisVar[^;]*/) || [''])[0]);
ok('_gecisAzalt prefers-reduced-motion sorguluyor',
  /matchMedia\('\(prefers-reduced-motion: reduce\)'\)\.matches/.test(govde('_gecisAzalt')));

console.log('\n=== 8. _ekranGorunur CIKAN EKRANI GORUNUR SAYMAZ ===');
// Iki ekranli gecis boyunca giden ekran hala display:block. Bu kapi olmasa
// openDetay'in _prevScreen bulucusu ESKI ekrani secip geri tusunu yanlis
// yere baglardi.
const eg = govde('_ekranGorunur');
ok('_ekranGorunur cikis sinifini eliyor',
  /anim-cikis-sol/.test(eg) && /anim-cikis-sag/.test(eg) && /return false/.test(eg),
  eg.replace(/\s+/g, ' ').slice(0, 200));

console.log('\n=== 9. SPLASH (bu turda DOKUNULMADI, kilit duruyor) ===');
const splashKural = kural('#splash {');
const trGecis = (/transition:\s*opacity\s+([^;]+);/.exec(splashKural) || [])[1] || '';
const splashSure = ms(coz(trGecis.split(/\s+/)[0]));
const splashEgri = coz(trGecis.split(/\s+/).slice(1).join(' ')) || 'linear';
ok('#splash opaklik gecisi tanimli', !!trGecis, splashKural.slice(0, 100));
ok('sonme suresi 100-400ms', splashSure >= 100 && splashSure <= 400, splashSure + 'ms');
const sIlr = ilerleme(splashEgri, 0.25);
ok('sonme egrisi ONE YUKLU DEGIL (%25\'te <= %40)', sIlr != null && sIlr <= 0.40,
  'egri=' + splashEgri + ' ilerleme@%25=' + (sIlr == null ? '?' : (sIlr * 100).toFixed(0) + '%'));
ok('reduced-motion: #splash transition none', /#splash\s*\{\s*transition:\s*none/.test(cssTemiz.replace(/\s+/g, ' ')));
// Splash sonmesi ile ekran gecisi ESIT OLMAK ZORUNDA DEGIL: biri opaklik
// sonmesi, digeri tam viewport genisliginde bir yol. Ikisi de KISA bantta
// olsun yeter. (Onceki turda "fark <=60ms" diye yazilmisti; oteleme
// buyuyunce o premis gecersiz kaldi -- iddia gevsetilmedi, DUZELTILDI.)
ok('ikisi de kisa bantta (150-320ms)',
  splashSure >= 150 && splashSure <= 320 && gecisSure >= 150 && gecisSure <= 320,
  'splash=' + splashSure + ' gecis=' + gecisSure);

console.log('\n=== 10. CSP / LAYOUT KILITLERI ===');
ok('showScreen animasyonu satir ici stille kurmuyor',
  !/style\.(animation|transition|transform)\s*=/.test(ss),
  (ss.match(/style\.\w+\s*=[^;]*/g) || []).join(' | ').slice(0, 140));
ok('gecis CSS\'i satir ici handler gerektirmiyor (sayac testi ayrica kilitli)',
  fs.existsSync('test_satirici_kilit.mjs'));
ok('.screen min-height 100dvh degismedi', /\.screen\s*\{[^}]*min-height:\s*100dvh/.test(cssTemiz));
ok('.screen max-width 600px degismedi', /\.screen\s*\{[^}]*max-width:\s*600px/.test(cssTemiz));
ok('#screen-home acilista display:block', /#screen-home\s*\{\s*display:\s*block/.test(cssTemiz));
ok('gecis kurallarinda display/width/height yok',
  !/(display|width|height):/.test(kIleri + kGeri + kCikSol + kCikSag), kIleri + ' | ' + kCikSol);

console.log('\nSONUC: PASS=' + pass + ' FAIL=' + fail);
if (fail > 0) process.exit(1);
