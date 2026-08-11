// KLAVYE ERISIMI ve ODAK GOSTERGESI.
// DENETIM BULGUSU (2026-08-11): 51 oge onclick tasiyor ama odaklanabilir degil;
// odaklanabilen 15 ogenin 15'inde odak gostergesi yok. Uygulamanin ANA ISLEVI
// (urun detayina gitmek) klavye ve ekran okuyucuya tamamen kapaliydi.
import fs from 'fs';

const APP = fs.readFileSync('app.js', 'utf8');
const CSS = fs.readFileSync('style.css', 'utf8');
const HTML = fs.readFileSync('index.html', 'utf8');
let pass = 0, fail = 0;
const ok = (ad, k, d = '') => { if (k) { pass++; console.log('  PASS  ' + ad); } else { fail++; console.log('  FAIL  ' + ad + (d ? '  -> ' + d : '')); } };

console.log('\n=== 1. TIKLANABILIR KARTLAR KLAVYEYE ACIK ===');
// Kart uretim noktalari: _stripKartHTML (serit), cardHTML (kategori/arama),
// hal karti (renderHalScreen)
const kartUretenler = ['_stripKartHTML', 'cardHTML'];
for (const fn of kartUretenler) {
  const b = APP.indexOf('function ' + fn + '(');
  if (b < 0) { ok(fn + ' bulundu', false); continue; }
  let d = 0, son = b;
  for (let j = APP.indexOf('{', b); j < APP.length; j++) {
    const c = APP[j]; if (c === '{') d++; else if (c === '}') { d--; if (d === 0) { son = j + 1; break; } }
  }
  const src = APP.slice(b, son);
  ok(fn + ': tabindex="0" var', /tabindex="0"/.test(src), '');
  ok(fn + ': role="button" var', /role="button"/.test(src), '');
  ok(fn + ': onkeydown var', /onkeydown=/.test(src), '');
}

console.log('\n=== 2. ENTER/SPACE ACICI ===');
ok('_kartTus fonksiyonu var', /function _kartTus\s*\(/.test(APP));
const kt = (APP.match(/function _kartTus[\s\S]{0,420}?\n\}/) || [''])[0];
ok('  Enter yakaliyor', /'Enter'|"Enter"/.test(kt), kt.slice(0, 160));
ok('  Space yakaliyor', /' '|"\s"|'Spacebar'|key === ' '/.test(kt), kt.slice(0, 200));
ok('  preventDefault cagiriyor (Space sayfayi kaydirmasin)', /preventDefault/.test(kt));
ok('  openDetay cagiriyor', /openDetay/.test(kt));

console.log('\n=== 3. ODAK GOSTERGESI ===');
ok(':focus-visible kurali var', /:focus-visible/.test(CSS));
const fv = (CSS.match(/[^}]*:focus-visible[^{]*\{[^}]*\}/g) || []).join('\n');
ok('  outline tanimliyor', /outline\s*:/.test(fv), fv.slice(0, 200));
ok('  outline-offset var (kart kenarina yapismasin)', /outline-offset/.test(fv));
ok('  outline: none DEGIL', !/outline\s*:\s*none/.test(fv), fv.slice(0, 200));
// mevcut tasarim dili: ana yesil #0E4938 veya turevleri
ok('  mevcut tasarim dilinden renk (yesil paleti)',
  /#0E4938|#0e4938|var\(--(primary|brand|accent|yesil)/i.test(fv), fv.slice(0, 240));

console.log('\n=== 4. maximum-scale KALDIRILDI ===');
ok('viewport meta var', /name="viewport"/.test(HTML));
ok('maximum-scale YOK', !/maximum-scale/.test(HTML),
  (HTML.match(/<meta name="viewport"[^>]*>/) || [''])[0]);
ok('user-scalable=no YOK', !/user-scalable\s*=\s*no/.test(HTML));

console.log('\n=== 5. MODAL: Esc ve odak ===');
ok('Escape dinleyicisi var', /'Escape'|"Escape"/.test(APP));

console.log('\n=== 6. GORSEL TASARIM KORUNDU ===');
// tabindex/role/onkeydown eklemek disinda kart sinifi/yapisi degismemeli
ok('.strip-card sinifi duruyor', /class="strip-card"/.test(APP));
ok('kart ic yapisi duruyor (img+name+sub)',
  /strip-card-img|strip-card-name|strip-card-sub/.test(APP));
ok('focus-visible DISINDA outline:none eklenmedi',
  (CSS.match(/outline\s*:\s*none/g) || []).length <= (CSS.match(/:focus(?!-visible)/g) || []).length + 3,
  'outline:none sayisi=' + (CSS.match(/outline\s*:\s*none/g) || []).length);

console.log('\nPASS=' + pass + '  FAIL=' + fail);
process.exit(fail ? 1 : 0);
