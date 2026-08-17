// SON KLAVYE ACIKLARI. Denetim: onclick tasiyip klavyeye kapali 51 oge vardi;
// 41'i kapandi, 10 uretim noktasi kalmisti. Bu test o 10'u kapatiyor.
//
// SINIFLANDIRMA (statik tarama, 2026-08-17):
//   GERCEK ETKILESIM (6) -> tabindex + role + onkeydown SART
//     app.js:3263  .cat-card        openCategory   <- ANA gezinme
//     app.js:3741  .mf-card         mfSheetAc
//     app.js:3958  .cart-item       openDetay
//     app.js:4225  .ms-market-row   msSheetToggle  <- TOGGLE, aria-pressed
//     index.html   .hal-mini-btn    openHalScreen
//     index.html   .profil-isim     duzenleKullaniciAdi
//   MODAL ARKA PLANI (4) -> BILEREK odaklanabilir YAPILMIYOR
//     .auth-sheet__backdrop .app-modal-backdrop
//     .ms-sheet-backdrop    .mf-sheet-backdrop
//   Arka plani tab sirasina sokmak ekran okuyucuda anlamsiz bir durak
//   yaratir; klavye yolu Escape ve o dinleyiciler zaten var.
//
// NOT: hal ekrani kartlarinda onclick YOK — tiklanabilir degiller, bu yuzden
// "hal kartlari" kaleminde yalnizca .hal-mini-btn var.
import fs from 'fs';

const APP = fs.readFileSync('app.js', 'utf8');
const HTML = fs.readFileSync('index.html', 'utf8');
const CSS = fs.readFileSync('style.css', 'utf8');
let pass = 0, fail = 0;
const ok = (ad, k, d = '') => { if (k) { pass++; console.log('  PASS  ' + ad); } else { fail++; console.log('  FAIL  ' + ad + (d ? '  -> ' + d : '')); } };

// Bir seciciyi uretin satiri: onclick tasiyan ve o sinifi iceren satir
function uretimSatiri(kaynak, sinif) {
  const L = kaynak.split('\n');
  for (const l of L) {
    if (l.includes('class="' + sinif) && /onclick=/.test(l)) return l.trim();
    if (l.includes("class=\\'" + sinif) && /onclick=/.test(l)) return l.trim();
  }
  return null;
}

console.log('\n=== 1. GERCEK ETKILESIM OGELERI KLAVYEYE ACIK ===');
const HEDEF = [
  ['app.js',     APP,  'cat-card',      'openCategory'],
  ['app.js',     APP,  'mf-card',       'mfSheetAc'],
  ['app.js',     APP,  'cart-item',     'openDetay'],
  ['app.js',     APP,  'ms-market-row', 'msSheetToggle'],
  ['index.html', HTML, 'hal-mini-btn',  'openHalScreen'],
  ['index.html', HTML, 'profil-isim',   'duzenleKullaniciAdi'],
];
for (const [dosya, kaynak, sinif, fn] of HEDEF) {
  const s = uretimSatiri(kaynak, sinif);
  if (!s) { ok(dosya + ' .' + sinif + ' bulundu', false); continue; }
  ok('.' + sinif + ' tabindex="0"', /tabindex="0"/.test(s), s.slice(0, 110));
  ok('  .' + sinif + ' role var', /role="(button|checkbox)"/.test(s), s.slice(0, 110));
  ok('  .' + sinif + ' onkeydown var', /onkeydown=/.test(s), s.slice(0, 110));
  ok('  .' + sinif + ' onclick islevi korundu', s.includes(fn), s.slice(0, 110));
}

console.log('\n=== 2. TOGGLE OGESI DURUMUNU BILDIRIYOR ===');
{
  const s = uretimSatiri(APP, 'ms-market-row');
  ok('.ms-market-row aria-pressed tasiyor', /aria-pressed=/.test(s || ''), (s || '').slice(0, 130));
  const t = (APP.match(/function msSheetToggle[\s\S]{0,420}?\n\}/) || [''])[0];
  ok('  msSheetToggle aria-pressed GUNCELLIYOR', /aria-pressed/.test(t), t.slice(0, 200));
  ok('  secim mantigi korundu (_msSecili)', /_msSecili/.test(t), '');
}

console.log('\n=== 3. MODAL ARKA PLANLARI BILEREK KAPALI ===');
for (const sinif of ['auth-sheet__backdrop', 'app-modal-backdrop', 'ms-sheet-backdrop', 'mf-sheet-backdrop']) {
  const s = uretimSatiri(HTML, sinif);
  ok('.' + sinif + ' odaklanabilir DEGIL', !!s && !/tabindex=/.test(s), (s || '(yok)').slice(0, 90));
}
ok('Escape dinleyicileri duruyor', (APP.match(/'Escape'/g) || []).length >= 2,
  'adet=' + (APP.match(/'Escape'/g) || []).length);

console.log('\n=== 4. TUS ISLEYICILERI ===');
ok('_kartTus var (Enter/Space -> openDetay)', /function _kartTus\s*\(/.test(APP));
ok('_satirTus var (Enter/Space -> geri cagri)', /function _satirTus\s*\(/.test(APP));
for (const [ad, fn] of [['_kartTus', (APP.match(/function _kartTus[\s\S]{0,300}?\n\}/) || [''])[0]],
                        ['_satirTus', (APP.match(/function _satirTus[\s\S]{0,300}?\n\}/) || [''])[0]]]) {
  ok('  ' + ad + ' Enter yakaliyor', /'Enter'/.test(fn));
  ok('  ' + ad + ' Space yakaliyor', /' '|Spacebar/.test(fn));
  ok('  ' + ad + ' preventDefault cagiriyor', /preventDefault/.test(fn));
}

console.log('\n=== 5. ODAK GOSTERGESI YENI OGELERI KAPSIYOR ===');
{
  const fv = (CSS.match(/[^}]*:focus-visible[^{]*\{[^}]*\}/g) || []).join('\n');
  ok('genel :focus-visible kurali var', /^\s*:focus-visible\s*\{/m.test(CSS) || /\s:focus-visible\s*\{/.test(fv), '');
  ok('  outline tanimli', /outline\s*:\s*2px/.test(fv), '');
  ok('  outline-offset var', /outline-offset/.test(fv), '');
  for (const s of ['cat-card', 'mf-card', 'cart-item', 'ms-market-row']) {
    // ya kendi kurali var ya genel :focus-visible kapsiyor (ikisi de kabul)
    ok('  .' + s + ' odak halkasi alabiliyor',
      new RegExp('\\.' + s + ':focus-visible').test(CSS) || /^\s*:focus-visible\s*\{/m.test(CSS), '');
  }
}

console.log('\n=== 6. GORSEL TASARIM DEGISMEDI ===');
// NOT: markup .cat-emoji + .cat-card-name kullaniyor; CSS'teki
// .cat-card-emoji ve .cat-card-img kurallari OLU (hicbir yerde uretilmiyor).
// Bu turda dokunulmadi, yalnizca not.
ok('.cat-card sinifi ve yapisi duruyor',
  /class="cat-card"/.test(APP) && /class="cat-emoji"/.test(APP) && /cat-card-name/.test(APP));
ok('.cart-item yapisi duruyor', /cart-item-name/.test(APP));
ok('.ms-market-row yapisi duruyor', /ms-market-avatar/.test(APP) && /ms-tick/.test(APP));
ok('.mf-card yapisi duruyor', /mf-card/.test(APP));
ok('yeni gorsel kural EKLENMEDI (yalnizca oznitelik)',
  !/\.cat-card\s*\{[^}]*background\s*:\s*#/.test(CSS.split('CMP SATIR')[1] || ''), '');

console.log('\nPASS=' + pass + '  FAIL=' + fail);
process.exit(fail ? 1 : 0);
