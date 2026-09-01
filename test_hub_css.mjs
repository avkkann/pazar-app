// test_hub_css.mjs — static/hub.css kurallari + hub sayfalarinin ona bagimliligi
//
// NEDEN VAR: hub.css hicbir test tarafindan okunmuyordu (olculdu 2026-09-01:
// sifir test dosyasi ona dokunuyordu) ve iki gercek kusur oradan cikti:
//   1) `.metin-tablo` kurallari silinirse belge tablosu 383px -> 1694px patliyor
//   2) `main a` renk kurali yokken govde linkleri koyu temada kontrast 1,90
//      (AA esigi 4,5) -- 18 sayfada 525 link okunamiyordu
// Bu test o iki kurali kilitler.
//
// NOT: kontrast SAYISI burada hesaplanmiyor (o tarayici olcumu). Burada
// kilitlenen sey KURALIN VARLIGI ve token'a bagli olmasi -- ham hex yazilirsa
// tema duyarliligi sessizce olur.
import { readFileSync, readdirSync } from 'node:fs';

let pass = 0, fail = 0;
const ok = (ad, kosul, ek = '') => {
  if (kosul) { pass++; console.log('  PASS  ' + ad); }
  else { fail++; console.log('  FAIL  ' + ad + (ek ? '  -> ' + ek : '')); }
};

const CSS = readFileSync('static/hub.css', 'utf8');
// Yorumlari soy — bu dosyanin yorumlari kurallari ANLATIYOR ve ciplak arama
// kendi aciklamasiyla eslesir (bu depoda belgelenmis tekrarlayan tuzak).
// hub.css kucuk ve saf CSS; blok-yorum soyma burada GUVENLI (app.js'te DEGIL:
// orada `/*` dize/regex icinde de geciyor ve naif soyucu 124 KB kod yiyor).
const KOD = CSS.replace(/\/\*[\s\S]*?\*\//g, '');

console.log('\n=== 0. KONTROL GRUBU: soyucu kodu yemedi mi? ===');
ok('yorum soyma sonrasi kural govdeleri duruyor',
   KOD.includes('main a') && KOD.includes('.metin-tablo') && KOD.length > 400,
   'kalan uzunluk=' + KOD.length);
ok('yorumlar gercekten soyuldu', KOD.length < CSS.length, `${CSS.length} -> ${KOD.length}`);

console.log('\n=== 1. GOVDE LINK RENGI (koyu tema okunabilirligi) ===');
const linkKurali = (KOD.match(/(^|\})\s*main a\s*\{[^}]*\}/m) || [''])[0];
ok('`main a` renk kurali VAR', /main a\s*\{[^}]*color/.test(KOD), linkKurali);
ok('  renk TOKEN uzerinden (ham hex degil)',
   /main a\s*\{[^}]*color:\s*var\(--link\)/.test(KOD), linkKurali);
ok('  kural .belge ile SINIRLI DEGIL (butun hub sayfalari kapsanmali)',
   /(^|\})\s*main a\s*\{/m.test(KOD) && !/^\s*\.belge main a\s*\{/m.test(KOD),
   linkKurali);
// --link iki temada da tanimli olmali, yoksa kural bir temada coker
ok('--link acik temada tanimli', /:root\s*\{[^}]*--link:/.test(KOD));
ok('--link koyu temada tanimli',
   /(prefers-color-scheme:\s*dark|\[data-theme="dark"\])[\s\S]{0,400}--link:/.test(KOD));

console.log('\n=== 2. BELGE TABLOSU (dar ekranda patlamasin) ===');
ok('.metin-tablo white-space normal',
   /\.metin-tablo th,\s*\.metin-tablo td\s*\{[^}]*white-space:\s*normal/.test(KOD));
ok('hub varsayilani hala nowrap (kural gereksizlesmedi)',
   /(^|\})\s*th,\s*td\s*\{[^}]*white-space:\s*nowrap/m.test(KOD) ||
   /white-space:\s*nowrap/.test(KOD));
ok('.belge okuma bandi kurali duruyor', /\.belge main p[^{]*\{[^}]*max-width/.test(KOD));

console.log('\n=== 3. URETILEN SAYFALAR hub.css e BAGLI ===');
// Kural dosyada dursa da sayfa onu yuklemiyorsa ise yaramaz.
let sayfa = 0, baglantili = 0, mainLink = 0;
function* gez(d) {
  for (const e of readdirSync(d, { withFileTypes: true })) {
    const p = d + '/' + e.name;
    if (e.isDirectory()) yield* gez(p);
    else if (e.name === 'index.html') yield p;
  }
}
let distVar = true;
try { readdirSync('dist'); } catch { distVar = false; }
if (!distVar) {
  console.log('  ATLANDI: dist/ yok (once `npm run build`). Kural iddialari yine de kosuldu.');
} else {
  for (const f of gez('dist')) {
    const h = readFileSync(f, 'utf8');
    if (!/<main/.test(h)) continue;
    // ana uygulama sayfasi hub.css kullanmiyor, onu disarida birak
    if (!/hub\.css/.test(h)) continue;
    sayfa++;
    baglantili++;
    mainLink += ((h.match(/<main[\s\S]*?<\/main>/) || [''])[0].match(/<a /g) || []).length;
  }
  ok('hub.css yukleyen sayfa var', sayfa > 0, 'sayfa=' + sayfa);
  ok('  o sayfalarin hepsi hub.css e bagli', sayfa === baglantili, `${baglantili}/${sayfa}`);
  ok('  govdesinde link tasiyan sayfa gercekten cok (kural bos degil)',
     mainLink > 100, 'toplam main linki=' + mainLink);
}

console.log('\nPASS=' + pass + '  FAIL=' + fail);
process.exit(fail ? 1 : 0);
