// Kategori ikonlari (Faz 3) — marka SVG dilinden sapmasin.
// Kullanim: node test_kategori_ikon.mjs
import fs from 'fs';
import vm from 'vm';

const APP = fs.readFileSync('app.js', 'utf8');
const CSS = fs.readFileSync('style.css', 'utf8');

let pass = 0, fail = 0;
const ok = (ad, k, d = '') => { if (k) { pass++; console.log('  PASS  ' + ad); } else { fail++; console.log('  FAIL  ' + ad + (d ? '  -> ' + d : '')); } };

function fnKaynak(ad) {
  let bas = APP.indexOf('function ' + ad + '(');
  if (bas < 0) return null;
  if (APP.slice(Math.max(0, bas - 6), bas) === 'async ') bas -= 6;
  let dd = 0;
  for (let j = APP.indexOf('{', bas); j < APP.length; j++) {
    const c = APP[j];
    if (c === '{') dd++;
    else if (c === '}') { dd--; if (dd === 0) return APP.slice(bas, j + 1); }
  }
  return null;
}

// _LUCIDE_PATHS + KATEGORILER + lcIcon'u gercek kaynaktan al
const blok = (ad) => {
  const bas = APP.indexOf('const ' + ad + ' = ');
  if (bas < 0) return null;
  const ac = APP.indexOf(ad === 'KATEGORILER' ? '[' : '{', bas);
  const kapa = ad === 'KATEGORILER' ? ']' : '}';
  let dd = 0;
  for (let j = ac; j < APP.length; j++) {
    if (APP[j] === APP[ac]) dd++;
    else if (APP[j] === kapa) { dd--; if (dd === 0) return APP.slice(bas, j + 1) + ';'; }
  }
  return null;
};

const ctx = { console };
vm.createContext(ctx);
vm.runInContext([blok('_LUCIDE_PATHS'), blok('KATEGORILER'), fnKaynak('lcIcon')].join('\n'), ctx);
const calis = (i) => vm.runInContext(i, ctx);

const KATEGORILER = calis('KATEGORILER');
const SLUGLAR = ['meyve-sebze','et','sut','gida','icecek','temizlik','atistirmalik','dondurulmus'];

console.log('\n=== 1. HER KATEGORININ IKONU VAR ===');
{
  ok('8 kategori tanimli', KATEGORILER.length === 8, 'adet=' + KATEGORILER.length);
  ok('  sluglar degismedi (hub yollari bunlardan kuruluyor)',
     JSON.stringify(KATEGORILER.map(k => k.slug)) === JSON.stringify(SLUGLAR),
     JSON.stringify(KATEGORILER.map(k => k.slug)));
  const ikonsuz = KATEGORILER.filter(k => !k.ikon);
  ok('  hepsinin ikon alani var', ikonsuz.length === 0, ikonsuz.map(k => k.slug).join(','));
  const eksik = KATEGORILER.filter(k => !calis('_LUCIDE_PATHS')[k.ikon]);
  ok('  her ikon _LUCIDE_PATHS icinde TANIMLI', eksik.length === 0,
     eksik.map(k => k.slug + '→' + k.ikon).join(','));
  // lcIcon tanimsiz isimde SESSIZCE bos dondurur -> kart ikonsuz kalir, kimse fark etmez
  const bos = KATEGORILER.filter(k => calis(`lcIcon(${JSON.stringify(k.ikon)}, 'cat-ikon')`) === '');
  ok('  hicbiri sessizce BOS uretmiyor', bos.length === 0, bos.map(k => k.slug).join(','));
}

console.log('\n=== 2. MARKA SVG DILI (mevcut ikonlarla AYNI) ===');
{
  // Dil tek ureticiden geliyor; her kategori ikonu ondan gecmeli.
  for (const k of KATEGORILER) {
    const h = calis(`lcIcon(${JSON.stringify(k.ikon)}, 'cat-ikon')`);
    const uyum = /viewBox="0 0 24 24"/.test(h) && /fill="none"/.test(h) &&
                 /stroke="currentColor"/.test(h) && /stroke-width="2"/.test(h) &&
                 /stroke-linecap="round"/.test(h) && /stroke-linejoin="round"/.test(h) &&
                 /aria-hidden="true"/.test(h);
    ok(`  ${k.slug} (${k.ikon}) dile uyuyor`, uyum, h.slice(0, 120));
  }
  ok('render lcIcon uzerinden (elle SVG yazilmamis)',
     /lcIcon\(k\.ikon, 'cat-ikon'\)/.test(APP), '');
  // Kategori izgarasinda ELLE yazilmis <svg> olmamali -- yazilirsa dil catallanir
  const izgara = (APP.match(/function renderCatGrid\(\)[\s\S]*?\n\}/) || [''])[0];
  ok('  izgarada elle <svg> yok', !/<svg/.test(izgara), izgara.slice(0, 160));
}

console.log('\n=== 3. EMOJI GITTI, FOTO YEDEGI KALDI ===');
{
  const emojiRe = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;
  ok('KATEGORILER artik emoji tasimiyor',
     !KATEGORILER.some(k => k.emoji || Object.values(k).some(v => typeof v === 'string' && emojiRe.test(v))),
     JSON.stringify(KATEGORILER[0]));
  ok('  kullanilmayan img alani da kalkti', !KATEGORILER.some(k => k.img), '');
  const izgara = (APP.match(/function renderCatGrid\(\)[\s\S]*?\n\}/) || [''])[0];
  ok('  izgara markup\'inda emoji yok', !emojiRe.test(izgara), izgara.slice(0, 160));
  ok('  .cat-emoji CSS kurali kalkti', !/\.cat-emoji\s*\{/.test(CSS), '');
  // AYRI KONU: urun fotografi yuklenemeyince devreye giren emoji yedegi DURMALI
  ok('ürün fotoğrafı emoji yedeği KORUNDU (.strip-card-img-ph)',
     /\.strip-card-img-ph\s*\{/.test(CSS) && /strip-card-img-ph/.test(APP), '');
  ok('  yedegin kendi emoji kaynagi (placeholderRenk) duruyor',
     /function placeholderRenk/.test(APP) && emojiRe.test((APP.match(/function placeholderRenk[\s\S]*?\n\}/) || [''])[0]), '');
}

console.log('\n=== 4. TOKEN BAGLANTISI (ham px/hex yok) ===');
{
  const kural = (CSS.match(/\.cat-ikon \{[^}]*\}/) || [''])[0];
  ok('.cat-ikon kurali var', kural.length > 10, kural);
  ok('  boyut token uzerinden', /var\(--ikon-kategori\)/.test(kural), kural);
  ok('  token 32px tanimli', /--ikon-kategori:\s*32px/.test(CSS), '');
  ok('  kuralda ham px YOK', !/\b\d+px/.test(kural), kural);
  ok('  renk verilmiyor (currentColor devralinsin)', !/color\s*:/.test(kural), kural);
}

console.log('\n=== 5. OLU KOD TEMIZLIGI ===');
{
  for (const s of ['cat-card-emoji', 'cat-card-img', 'cat-card-count']) {
    ok(`  .${s} CSS kurali silindi`, !new RegExp('\\.' + s + '\\s*\\{').test(CSS), '');
  }
  // Faz 1'de acilan glif ailesinin tek tuketicisi kaldi
  ok('kullanilmayan --glif-1..5 ailesi kalkti', !/--glif-[1-5]\s*:/.test(CSS), '');
  ok('  kalan tek glif tokeni foto yedegi icin', /--glif-foto-yedek:\s*32px/.test(CSS)
     && /font-size:\s*var\(--glif-foto-yedek\)/.test(CSS), '');
}

console.log(`\nPASS=${pass}  FAIL=${fail}`);
process.exit(fail ? 1 : 0);
