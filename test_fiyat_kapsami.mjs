// FIYAT KAPSAMI: "bu fiyatlar nereden geliyor" cumlesi.
//
// KUSUR (olculdu 2026-09-13, kullanici bildirdi): CarrefourSA'nin kendi
// uygulamasi 449,90/749,90 derken biz 399,90 gosteriyorduk. Kaynakta da 399,90
// yaziyordu -- yani ayristirma hatasi DEGIL, KAPSAM hatasi: marketfiyati her
// zincir icin TEK temsilci magaza donduruyor ve olculdu ki katalogu besleyen
// 27 magazanin HEPSI Istanbul'da. Antalya'daki kullaniciya Istanbul fiyati
// "fiyat" diye gosteriliyordu ve bunu hicbir yerde SOYLEMIYORDUK.
// Ornek olcum (25 canli indirim iddiasi, Antalya depolariyla): %12 urun o
// illerde kaynakta YOK, %20 fiyat FARKLI -> 3'te 1'i gecersiz.
//
// Bu bekci: (a) kapsamin VERIDEN turedigini (sabit sehir adi yazilmadigini),
// (b) build'in anasayfa.json'a yazdigini, (c) istemcinin tazelik satirinda
// gosterdigini kilitler.
import fs from 'node:fs';
import vm from 'node:vm';

const APP = fs.readFileSync('app.js', 'utf8');
const URET = fs.readFileSync('scripts/anasayfa-uret.mjs', 'utf8');

let pass = 0, fail = 0;
const ok = (ad, kosul, detay = '') => {
  if (kosul) { pass++; console.log('  PASS  ' + ad); }
  else { fail++; console.log('  FAIL  ' + ad + (detay ? '  -> ' + String(detay).slice(0, 200) : '')); }
};
// Satir tabanli yorum soyucu (CRLF guvenli) -- bkz. test_dusenler.mjs.
function kodTemiz(src) {
  const cikti = [];
  let blokta = false;
  for (let l of String(src).split(String.fromCharCode(10))) {
    if (l.charCodeAt(l.length - 1) === 13) l = l.slice(0, -1);
    if (blokta) { if (l.indexOf('*/') >= 0) blokta = false; cikti.push(''); continue; }
    if (/^\s*\/\*/.test(l)) { if (l.indexOf('*/') < 0) blokta = true; cikti.push(''); continue; }
    cikti.push(l.replace(/^\s*\/\/.*$/, ''));
  }
  return cikti.join(String.fromCharCode(10));
}
{
  const CR = String.fromCharCode(13), LF = String.fromCharCode(10);
  const a = kodTemiz('// SOYULMALI' + CR + LF + 'const k = 1;' + CR + LF);
  ok('ALET: CRLF satirda yorum soyuluyor, kod korunuyor', !/SOYULMALI/.test(a) && /const k = 1;/.test(a), JSON.stringify(a));
}
const APP_T = kodTemiz(APP), URET_T = kodTemiz(URET);

function fnKaynak(ad) {
  let bas = APP.indexOf('function ' + ad + '(');
  if (bas < 0) return null;
  if (APP.slice(Math.max(0, bas - 6), bas) === 'async ') bas -= 6;
  let d = 0;
  for (let j = APP.indexOf('{', bas); j < APP.length; j++) {
    const c = APP[j];
    if (c === '{') d++;
    else if (c === '}') { d--; if (d === 0) return APP.slice(bas, j + 1); }
  }
  return null;
}

console.log('\n=== 1. BUILD: kapsam VERIDEN turuyor ===');
ok('anasayfa-uret kapsami hesapliyor (fiyatKapsami)', /const fiyatKapsami = ic\(/.test(URET_T));
ok('  magaza sayisi depot_id\'den, il listesi depot_il\'den', /depot_id/.test(URET_T) && /depot_il/.test(URET_T));
ok('  cikti anasayfa.json\'a yaziliyor (fiyat_kapsami)', /fiyat_kapsami:\s*fiyatKapsami/.test(URET_T));
// SABIT SEHIR YASAGI: yarin temsilci magaza baska ile gecerse cumle
// kendiliginden degismeli (zam sekmesindeki "sabit ay yazma" kuralinin aynisi).
ok('  build\'de SABIT sehir adi YOK', !/['"`]İstanbul['"`]/.test(URET_T), 'build icinde sabit il adi var');
ok('  app.js\'te SABIT kapsam cumlesi YOK', !/İstanbul'daki|İstanbul mağaza/.test(APP_T));

console.log('\n=== 2. ISTEMCI: tazelik satirinda gosteriliyor ===');
const src = fnKaynak('veriTazelikCiz');
ok('veriTazelikCiz kapsami ikinci arguman olarak aliyor', !!src && /function veriTazelikCiz\(\s*veriTarihi\s*,\s*\w+/.test(src), (src || '').slice(0, 80));
{
  const ctx = { document: null, ZAM_AYLAR: ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'],
                lcIcon: () => '<svg></svg>',
                _kacir: s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') };
  const el = { innerHTML: '', className: '', hidden: true };
  ctx.document = { getElementById: () => el };
  vm.createContext(ctx);
  // _fiyatKapsamiYazi de GERCEK kaynagiyla yukleniyor (veriTazelikCiz onu
  // cagiriyor). Sahte koymuyoruz: kural bozulursa test de bozulmali.
  vm.runInContext((fnKaynak('_fiyatKapsamiYazi') || '') + '\n' + (src || 'function veriTazelikCiz(){}'), ctx);
  const ciz = (kapsam) => { el.innerHTML = ''; vm.runInContext('veriTazelikCiz("2026-09-13", ' + JSON.stringify(kapsam) + ')', ctx); return el.innerHTML; };

  const h = ciz({ magaza: 27, iller: ['İstanbul'] });
  ok('magaza sayisi yaziliyor', /27/.test(h), h);
  ok('  il adi yaziliyor', /İstanbul/.test(h), h);
  ok('  tarih satiri BOZULMADI', /13 Eylül 2026/.test(h), h);

  const h2 = ciz({ magaza: 40, iller: ['Ankara', 'İstanbul', 'İzmir'] });
  ok('cok il: hepsi yaziliyor', /Ankara/.test(h2) && /İzmir/.test(h2), h2);

  const h3 = ciz({ magaza: 27, iller: [] });
  ok('il bilinmiyorsa yalniz magaza sayisi (uydurma il YOK)', /27/.test(h3) && !/İstanbul/.test(h3), h3);

  const h4 = ciz(null);
  ok('kapsam yoksa cumle HIC cikmiyor (eski veri bozulmuyor)', !/mağaza/.test(h4) && /13 Eylül 2026/.test(h4), h4);

  const h5 = ciz({ magaza: 0, iller: [] });
  ok('magaza 0 ise cumle cikmiyor ("0 magazadan derlendi" YANLIS bilgi olurdu)', !/mağaza/.test(h5), h5);

  const h6 = ciz({ magaza: 3, iller: ['<img src=x>'] });
  ok('kacis uygulaniyor', /&lt;img/.test(h6) && !/<img src=x>/.test(h6), h6);
}

console.log('\n=== 3. CAGRI YERI: veri gelince kapsam da veriliyor ===');
{
  const getir = fnKaynak('anasayfaVeriGetir') || '';
  ok('anasayfaVeriGetir kapsami veriTazelikCiz\'e geciriyor',
     /veriTazelikCiz\([^)]*fiyat_kapsami/.test(kodTemiz(getir)), kodTemiz(getir).slice(0, 200));
}

console.log('\nPASS=' + pass + '  FAIL=' + fail);
process.exit(fail ? 1 : 0);
