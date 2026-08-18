// Detay ekraninda market fiyatlari EŞİT oldugunda "en pahalı" rozeti /
// best-worst boyamasi YANLIŞLIKLA basiliyordu -- tek sart mktler.length>1'di,
// fiyatlarin farkli olup olmadigi hic sorulmuyordu. app.js'ten fonksiyon
// KAYNAGINI cikarip vm'de calistirir -- kopya mantik degil.
import fs from 'fs';
import vm from 'vm';

const APP = fs.readFileSync('app.js', 'utf8');

let pass = 0, fail = 0;
const ok = (ad, kosul, detay = '') => {
  if (kosul) { pass++; console.log('  PASS  ' + ad); }
  else { fail++; console.log('  FAIL  ' + ad + (detay ? '  -> ' + detay : '')); }
};

function fnKaynak(ad) {
  let bas = APP.indexOf('function ' + ad + '(');
  if (bas < 0) return null;
  if (APP.slice(Math.max(0, bas - 6), bas) === 'async ') bas -= 6;
  let derinlik = 0;
  for (let j = APP.indexOf('{', bas); j < APP.length; j++) {
    const c = APP[j];
    if (c === '{') derinlik++;
    else if (c === '}') { derinlik--; if (derinlik === 0) return APP.slice(bas, j + 1); }
  }
  return null;
}

console.log('\n=== 0. YAPI ===');
const GEREKEN = ['_mktRowDurumu', '_esitFiyatBilgiHTML', '_veBaglacliListe', 'enIyiBirimIdleri', 'birimFiyatHesapla', 'fiyatlariTemizle', '_kacir', '_bildirimMarketSec'];
const eksik = [];
for (const f of GEREKEN) { const v = !!fnKaynak(f); ok('function ' + f + ' tanimli', v); if (!v) eksik.push(f); }
if (eksik.length) {
  console.log('\n  Eksik: ' + eksik.join(', '));
  console.log('\nPASS=' + pass + '  FAIL=' + fail);
  process.exit(1);
}

function kur() {
  const ctx = { console, Math, Object, Array, Set, Number };
  vm.createContext(ctx);
  vm.runInContext(fnKaynak('_mktRowDurumu'), ctx);
  vm.runInContext(fnKaynak('_veBaglacliListe'), ctx);
  vm.runInContext('const MARKET_NAMES = ' + APP.match(/const MARKET_NAMES = (\{[\s\S]*?\n\};)/)[1], ctx);
  vm.runInContext(fnKaynak('_kacir'), ctx);
  vm.runInContext(fnKaynak('_esitFiyatBilgiHTML'), ctx);
  return ctx;
}
const calis = (ctx, i) => vm.runInContext(i, ctx);

const ctx = kur();

console.log('\n=== 1. IKI MARKET, ESIT FIYAT -> notr ===');
{
  const mktler = [{ market: 'migros', fiyat: 58.5 }, { market: 'carrefour', fiyat: 58.5 }];
  ctx._m1 = mktler;
  const r = calis(ctx, '_mktRowDurumu(_m1)');
  ok('fiyatlarFarkli = false', r.fiyatlarFarkli === false, JSON.stringify(r));
  ok('hicbir satir isBest degil', r.durumlar.every(d => !d.isBest), JSON.stringify(r.durumlar));
  ok('hicbir satir isWorst degil (rozet yok)', r.durumlar.every(d => !d.isWorst), JSON.stringify(r.durumlar));
}

console.log('\n=== 2. IKI MARKET, FARKLI FIYAT -> eski davranis (REGRESYON) ===');
{
  const mktler = [{ market: 'sok', fiyat: 20 }, { market: 'a101', fiyat: 25 }]; // zaten fiyata gore siralanmis geliyor
  ctx._m2 = mktler;
  const r = calis(ctx, '_mktRowDurumu(_m2)');
  ok('fiyatlarFarkli = true', r.fiyatlarFarkli === true);
  ok('ilk (en ucuz) satir isBest', r.durumlar[0].isBest === true, JSON.stringify(r.durumlar));
  ok('ilk satir isWorst degil', r.durumlar[0].isWorst === false);
  ok('son (en pahali) satir isWorst', r.durumlar[1].isWorst === true, JSON.stringify(r.durumlar));
  ok('son satir isBest degil', r.durumlar[1].isBest === false);
}

console.log('\n=== 3. UC MARKET, IKISI ESIT EN PAHALIDA -> HEPSI isaretlenir (karar) ===');
{
  // 10, 15, 15 -- siralanmis (fiyata gore artan)
  const mktler = [{ market: 'sok', fiyat: 10 }, { market: 'bim', fiyat: 15 }, { market: 'a101', fiyat: 15 }];
  ctx._m3 = mktler;
  const r = calis(ctx, '_mktRowDurumu(_m3)');
  ok('fiyatlarFarkli = true', r.fiyatlarFarkli === true);
  ok('en ucuz (ilk) satir isBest', r.durumlar[0].isBest === true);
  ok('esit-en-yuksek IKI satir da isWorst (tekil degil, ikisi de gercek)', r.durumlar[1].isWorst === true && r.durumlar[2].isWorst === true, JSON.stringify(r.durumlar));
  ok('en ucuz satir isWorst degil', r.durumlar[0].isWorst === false);
  ok('esit-en-yuksek satirlar isBest degil', r.durumlar[1].isBest === false && r.durumlar[2].isBest === false, JSON.stringify(r.durumlar));
}

console.log('\n=== 3b. UC MARKET, IKISI ESIT EN UCUZDA -> HEPSI isaretlenir (simetri, karar) ===');
{
  // 10, 10, 15 -- siralanmis (fiyata gore artan); iki market ayni en dusuk fiyatta
  const mktler = [{ market: 'sok', fiyat: 10 }, { market: 'bim', fiyat: 10 }, { market: 'a101', fiyat: 15 }];
  ctx._m3b = mktler;
  const r = calis(ctx, '_mktRowDurumu(_m3b)');
  ok('fiyatlarFarkli = true', r.fiyatlarFarkli === true);
  ok('esit-en-ucuz IKI satir da isBest (tekil degil, ikisi de gercek)', r.durumlar[0].isBest === true && r.durumlar[1].isBest === true, JSON.stringify(r.durumlar));
  ok('esit-en-ucuz satirlar isWorst degil', r.durumlar[0].isWorst === false && r.durumlar[1].isWorst === false, JSON.stringify(r.durumlar));
  ok('en pahali (son) satir isWorst', r.durumlar[2].isWorst === true, JSON.stringify(r.durumlar));
  ok('en pahali satir isBest degil', r.durumlar[2].isBest === false);
}

console.log('\n=== 3c. UC MARKET, EN UCUZ TEK -> yalnizca o isBest (REGRESYON) ===');
{
  const mktler = [{ market: 'sok', fiyat: 10 }, { market: 'bim', fiyat: 15 }, { market: 'a101', fiyat: 20 }];
  ctx._m3c = mktler;
  const r = calis(ctx, '_mktRowDurumu(_m3c)');
  ok('yalnizca en ucuz satir isBest', r.durumlar[0].isBest === true && r.durumlar[1].isBest === false && r.durumlar[2].isBest === false, JSON.stringify(r.durumlar));
  ok('yalnizca en pahali satir isWorst', r.durumlar[2].isWorst === true && r.durumlar[0].isWorst === false && r.durumlar[1].isWorst === false, JSON.stringify(r.durumlar));
}

console.log('\n=== 4. ESITLIK BILGI SATIRI -- market adlari + baglac ===');
{
  ctx._e2 = [{ market: 'migros', fiyat: 58.5 }, { market: 'carrefour', fiyat: 58.5 }];
  const h2 = calis(ctx, '_esitFiyatBilgiHTML(_e2, false)');
  ok('iki market -> "Migros ve CarrefourSA"', /Migros ve CarrefourSA/.test(h2), h2);
  ok('aynı fiyatı veriyor metni var', /aynı fiyatı veriyor/.test(h2), h2);
  ok('fg-ozet sinifini kullaniyor (yeni sinif uydurulmadi)', /class="fg-ozet"/.test(h2), h2);

  ctx._e3 = [{ market: 'sok', fiyat: 22 }, { market: 'a101', fiyat: 22 }, { market: 'bim', fiyat: 22 }];
  const h3 = calis(ctx, '_esitFiyatBilgiHTML(_e3, false)');
  ok('uc market -> "ŞOK, A101 ve BİM"', /ŞOK, A101 ve BİM/.test(h3), h3);

  ctx._e4 = [{ market: 'sok', fiyat: 20 }, { market: 'a101', fiyat: 25 }];
  const h4 = calis(ctx, '_esitFiyatBilgiHTML(_e4, true)');
  ok('fiyatlarFarkli=true iken bos string', h4 === '', JSON.stringify(h4));

  const h5 = calis(ctx, '_esitFiyatBilgiHTML([{market:"sok",fiyat:9.9}], false)');
  ok('tek market varken bos string', h5 === '', JSON.stringify(h5));
}

console.log('\n=== 5. DETAY EKRANI _mktRowDurumu KULLANIYOR MU ===');
{
  const det = APP.slice(APP.indexOf('function openDetay('), APP.indexOf('function openDetay(') + 4500);
  ok('openDetay _mktRowDurumu cagiriyor', /_mktRowDurumu\s*\(\s*mktler\s*\)/.test(det));
  ok('rozet isWorst durumuna bagli', /isWorst \? '<span class="detay-mkt-badge">/.test(det), det);
  ok('_esitFiyatBilgiHTML detay sablonuna baglanmis', /_esitFiyatBilgiHTML\s*\(\s*mktler\s*,\s*fiyatlarFarkli\s*\)/.test(det));
}

console.log('\n=== 6. enIyiBirimIdleri -- ESIT birim fiyatli TUM urunler isaretlenir ===');
{
  const ctx2 = { console, Math, Object, Set };
  vm.createContext(ctx2);
  vm.runInContext(fnKaynak('birimFiyatHesapla'), ctx2);
  vm.runInContext(fnKaynak('_birimFiyatAyristir'), ctx2);
  vm.runInContext(fnKaynak('enDusukFiyat'), ctx2);
  vm.runInContext(fnKaynak('enIyiBirimIdleri'), ctx2);

  // Iki urun, ayni birim fiyat (10 TL/kg): 1 KG @ 10, 2 KG @ 20
  const esitListe = [
    { _id: 'u1', agirlik_hacim: '1 KG', market_fiyatlari: [{ market: 'sok', fiyat: 10 }] },
    { _id: 'u2', agirlik_hacim: '2 KG', market_fiyatlari: [{ market: 'bim', fiyat: 20 }] },
    { _id: 'u3', agirlik_hacim: '1 KG', market_fiyatlari: [{ market: 'a101', fiyat: 50 }] }, // pahali, isaretlenmemeli
  ];
  ctx2._liste = esitListe;
  const setEsit = calis(ctx2, 'enIyiBirimIdleri(_liste)');
  ok('esit birim fiyatli IKI urun de isaretli', setEsit.has('u1') && setEsit.has('u2'), JSON.stringify([...setEsit]));
  ok('pahali urun isaretli degil', !setEsit.has('u3'), JSON.stringify([...setEsit]));
  ok('set boyutu 2', setEsit.size === 2, setEsit.size);

  console.log('\n=== 7. enIyiBirimIdleri -- ESIT OLMAYAN durumda yalnizca minimum (REGRESYON) ===');
  const farkliListe = [
    { _id: 'v1', agirlik_hacim: '1 KG', market_fiyatlari: [{ market: 'sok', fiyat: 10 }] },
    { _id: 'v2', agirlik_hacim: '1 KG', market_fiyatlari: [{ market: 'bim', fiyat: 15 }] },
  ];
  ctx2._liste2 = farkliListe;
  const setFarkli = calis(ctx2, 'enIyiBirimIdleri(_liste2)');
  ok('yalnizca en ucuz isaretli', setFarkli.has('v1') && !setFarkli.has('v2'), JSON.stringify([...setFarkli]));
  ok('set boyutu 1', setFarkli.size === 1, setFarkli.size);

  console.log('\n=== 8. enIyiBirimIdleri -- tek urunlu grup vurgulanmaz (REGRESYON) ===');
  const tekListe = [{ _id: 'w1', agirlik_hacim: '1 KG', market_fiyatlari: [{ market: 'sok', fiyat: 10 }] }];
  ctx2._liste3 = tekListe;
  const setTek = calis(ctx2, 'enIyiBirimIdleri(_liste3)');
  ok('tek urunlu grup bos set doner', setTek.size === 0, setTek.size);
}

// f.market marketfiyati.org.tr -> scraper.py -> data/urunler_*.json uzerinden
// gelen UCUNCU TARAF veri. Asagidaki testler _kacir'in HTML'e ham gecisi
// engelledigini ve taninan market adlarini bozmadigini dogrular.
console.log('\n=== 9. _kacir -- HTML kacis yardimcisi ===');
{
  ok('& kaciyor', calis(ctx, `_kacir('&')`) === '&amp;');
  ok('< kaciyor', calis(ctx, `_kacir('<')`) === '&lt;');
  ok('> kaciyor', calis(ctx, `_kacir('>')`) === '&gt;');
  ok('" kaciyor', calis(ctx, `_kacir('"')`) === '&quot;');
  ok("' kaciyor", calis(ctx, `_kacir("'")`) === '&#39;');
  const cift = calis(ctx, `_kacir('&<')`);
  ok('& ONCE kaciyor, cift kacmiyor (&< -> &amp;&lt;)', cift === '&amp;&lt;', cift);
  ok('null -> bos dize', calis(ctx, '_kacir(null)') === '');
  ok('undefined -> bos dize', calis(ctx, '_kacir(undefined)') === '');
}

console.log('\n=== 10. _esitFiyatBilgiHTML -- zararli/taninmayan market kodu (GUVENLIK) ===');
{
  // sondadaki PoC: taninmayan market kodu ham <img onerror> olarak basiliyordu
  const kotu = [{ market: '<img src=x onerror=alert(1)>', fiyat: 5 }, { market: 'bim', fiyat: 5 }];
  ctx._kotu = kotu;
  const h = calis(ctx, '_esitFiyatBilgiHTML(_kotu, false)');
  ok('ham <img etiketi uretilmiyor', !/<img/.test(h), h);
  ok('kacirilmis &lt;img... goruluyor', /&lt;img/.test(h), h);
  ok('taninan market adi (BİM) bozulmadan cikiyor', /BİM/.test(h), h);

  // taninmayan ama zararsiz kod: kacis normal metni bozmamali
  const zararsiz = [{ market: 'yeniMarket', fiyat: 5 }, { market: 'sok', fiyat: 5 }];
  ctx._zararsiz = zararsiz;
  const h2 = calis(ctx, '_esitFiyatBilgiHTML(_zararsiz, false)');
  ok('zararsiz taninmayan kod oldugu gibi cikiyor', /yeniMarket ve ŞOK/.test(h2), h2);
}

console.log('\n=== 11. bildirim pill HTML -- market kodu onclick disinda, ayrisik oznitelik kaciyor, data-market CAKISMIYOR (GUVENLIK) ===');
{
  const ctx5 = { console };
  vm.createContext(ctx5);
  vm.runInContext('const MARKET_NAMES = ' + APP.match(/const MARKET_NAMES = (\{[\s\S]*?\n\};)/)[1], ctx5);
  vm.runInContext(fnKaynak('_kacir'), ctx5);
  const bas = APP.indexOf('const pills = mktler.map');
  if (bas < 0) { ok('const pills = mktler.map satiri bulundu', false); }
  else {
    const son = APP.indexOf('\n', bas);
    const pillKaynak = APP.slice(bas, son);
    // tek tirnak (eski onclick="...'${f.market}'..." JS-dize kirma yolu) VE
    // cift tirnak (data-bildirim-market="..." HTML oznitelik kirma yolu) birlikte
    ctx5.mktler = [{ market: `o'brien"><script>alert(1)</script>`, fiyat: 5 }];
    vm.runInContext(pillKaynak, ctx5);
    // 'const pills = ...' vm baglaminin ust-duzey sozluksel kapsaminda kalir,
    // ctx5 nesnesinin bir ozelligi olmaz -- ayri bir runInContext ile okunur.
    const pillsHtml = vm.runInContext('pills', ctx5);
    ok('onclick icinde market degeri YOK (JS-dize kirma yolu kapatildi)',
      /onclick="_bildirimMarketSec\(this\)"/.test(pillsHtml), pillsHtml);
    ok('ham <script> etiketi uretilmiyor', !/<script>/.test(pillsHtml), pillsHtml);
    ok('data-market OZNITELIGI YOK (kategori/detay filtre cipleriyle CAKISMASIN diye)',
      !/\sdata-market="/.test(pillsHtml), pillsHtml);
    ok('data-bildirim-market tam kacirilmis haliyle gorunuyor (ayrisik oznitelik)',
      pillsHtml.includes('data-bildirim-market="o&#39;brien&quot;&gt;&lt;script&gt;alert(1)&lt;/script&gt;"'),
      pillsHtml);
  }
}

console.log('\n=== 11b. document.querySelectorAll(\'[data-market]\') dongusu bildirim pill\'ini YAKALAMIYOR (REGRESYON/CAKISMA) ===');
{
  // app.js:3595 civarinda (uygulaCatFiltre icinde) filtre cipleri icin
  // KAPSAMSIZ document.querySelectorAll('[data-market]') donguSu var. Bildirim
  // pill'i eskiden data-market tasidigi icin bu donguye yanlislikla yakalanip
  // active/disabled/pointerEvents uygulanabiliyordu. data-bildirim-market'e
  // gecince bu artik mumkun degil -- asagida TUM '[data-market]' secici
  // gecislerini listeleyip hicbirinin bildirim pill sinifini (.bildirim-pill)
  // hedeflemedigini dogruluyoruz.
  const seciciGecisleri = [...APP.matchAll(/document\.querySelectorAll\(\s*'([^']*data-market[^']*)'\s*\)/g)].map(m => m[1]);
  ok('en az bir [data-market] gecisi bulundu (test kendini kontrol ediyor)', seciciGecisleri.length > 0, JSON.stringify(seciciGecisleri));
  ok('hicbir [data-market] secicisi .bildirim-pill sinifini hedeflemiyor',
    seciciGecisleri.every(s => !s.includes('bildirim-pill')), JSON.stringify(seciciGecisleri));
  console.log('  [data-market] secici gecisleri: ' + JSON.stringify(seciciGecisleri));
}

console.log('\n=== 12. _bildirimMarketSec -- tirnakli market kodu handler i kirmiyor, dataset.bildirimMarket okunuyor ===');
{
  const ctx6 = { console };
  vm.createContext(ctx6);
  vm.runInContext(fnKaynak('_bildirimMarketSec'), ctx6);
  const zorluKod = `o'brien"drop`;
  ctx6._el = {
    dataset: { bildirimMarket: zorluKod },
    parentElement: { querySelectorAll: () => [ctx6._el] },
    classList: { toggle() {} },
    setAttribute() {},
  };
  vm.runInContext('_bildirimMarketSec(_el)', ctx6);
  const secilen = vm.runInContext('_bildirimSecilenMarket', ctx6);
  ok('tek+cift tirnakli market kodu dataset.bildirimMarket uzerinden dogru okunuyor (handler kirilmadi)',
    secilen === zorluKod, secilen);
}

console.log('\n=== 13. _fgAsiriDegerBilgisi -- esitlikte TUM market adlari + EN GEC tarih ===');
{
  const ctx7 = { console };
  vm.createContext(ctx7);
  vm.runInContext(fnKaynak('_veBaglacliListe'), ctx7);
  vm.runInContext(fnKaynak('_kacir'), ctx7);
  vm.runInContext('const _FG_AYLAR = ' + APP.match(/const _FG_AYLAR = (\[[\s\S]*?\]);/)[1] + ';', ctx7);
  vm.runInContext(fnKaynak('_fgTarihFormatla'), ctx7);
  vm.runInContext('const _FG_MKT_AD = ' + APP.match(/const _FG_MKT_AD = (\{[\s\S]*?\n\};)/)[1], ctx7);
  vm.runInContext(fnKaynak('_fgAsiriDegerBilgisi'), ctx7);
  const koStr = (kod) => vm.runInContext(kod, ctx7);

  // 13a. tek market + tek tarih -> "en son" YOK
  ctx7._t13a = [
    { t: '2026-08-10', m: 'bim', f: 9.90 },
    { t: '2026-08-05', m: 'migros', f: 12.00 },
  ];
  const r13a = koStr(`_fgAsiriDegerBilgisi(_t13a, 'min')`);
  ok('13a fiyat dogru', r13a.fiyat === 9.90, JSON.stringify(r13a));
  ok('13a "en son" YOK (tek tarih)', r13a.tarihText === '10 Ağu', r13a.tarihText);
  ok('13a tek market adi', r13a.marketText === 'BİM', r13a.marketText);

  // 13b. tek market + cok tarih (ayni market iki farkli tarihte ayni min fiyati veriyor)
  ctx7._t13b = [
    { t: '2026-08-01', m: 'bim', f: 9.90 },
    { t: '2026-08-10', m: 'bim', f: 9.90 },
    { t: '2026-08-05', m: 'migros', f: 12.00 },
  ];
  const r13b = koStr(`_fgAsiriDegerBilgisi(_t13b, 'min')`);
  ok('13b fiyat dogru', r13b.fiyat === 9.90, JSON.stringify(r13b));
  ok('13b "en son " ONEKI VAR (cok tarih)', r13b.tarihText === 'en son 10 Ağu', r13b.tarihText);
  ok('13b secilen tarih EN GEC (10 Agu, 1 Agu degil)', /10 Ağu/.test(r13b.tarihText), r13b.tarihText);
  ok('13b tekrar eden market adi BIR KEZ yazildi', r13b.marketText === 'BİM', r13b.marketText);

  // 13c. cok market + tek tarih (iki market ayni gunde ayni min fiyati veriyor)
  ctx7._t13c = [
    { t: '2026-08-10', m: 'bim', f: 9.90 },
    { t: '2026-08-10', m: 'sok', f: 9.90 },
    { t: '2026-08-05', m: 'migros', f: 12.00 },
  ];
  const r13c = koStr(`_fgAsiriDegerBilgisi(_t13c, 'min')`);
  ok('13c fiyat dogru', r13c.fiyat === 9.90, JSON.stringify(r13c));
  ok('13c "en son" YOK (tek tarih)', r13c.tarihText === '10 Ağu', r13c.tarihText);
  ok('13c iki ad "ve" ile birlesik', r13c.marketText === 'BİM ve ŞOK', r13c.marketText);

  // 13d. cok market + cok tarih
  ctx7._t13d = [
    { t: '2026-08-01', m: 'bim', f: 9.90 },
    { t: '2026-08-14', m: 'sok', f: 9.90 },
    { t: '2026-08-05', m: 'migros', f: 12.00 },
  ];
  const r13d = koStr(`_fgAsiriDegerBilgisi(_t13d, 'min')`);
  ok('13d fiyat dogru', r13d.fiyat === 9.90, JSON.stringify(r13d));
  ok('13d "en son " oneki VAR ve tarih EN GEC (14 Agu)', r13d.tarihText === 'en son 14 Ağu', r13d.tarihText);
  ok('13d iki ad "ve" ile birlesik', r13d.marketText === 'BİM ve ŞOK', r13d.marketText);

  // 13e. yon='max' de ayni kural (en pahali icin de gecerli)
  ctx7._t13e = [
    { t: '2026-08-01', m: 'bim', f: 20.00 },
    { t: '2026-08-14', m: 'sok', f: 20.00 },
    { t: '2026-08-05', m: 'migros', f: 12.00 },
  ];
  const r13e = koStr(`_fgAsiriDegerBilgisi(_t13e, 'max')`);
  ok('13e (max) fiyat dogru', r13e.fiyat === 20.00, JSON.stringify(r13e));
  ok('13e (max) "en son " oneki VAR ve tarih EN GEC (14 Agu)', r13e.tarihText === 'en son 14 Ağu', r13e.tarihText);
  ok('13e (max) iki ad "ve" ile birlesik', r13e.marketText === 'BİM ve ŞOK', r13e.marketText);

  // 13f. taninmayan/zararli market kodu kaciyor (guvenlik regresyonu yok)
  ctx7._t13f = [{ t: '2026-08-10', m: '<img src=x onerror=alert(1)>', f: 5 }];
  const r13f = koStr(`_fgAsiriDegerBilgisi(_t13f, 'min')`);
  ok('13f taninmayan market kodu kaciyor', !/<img/.test(r13f.marketText) && /&lt;img/.test(r13f.marketText), r13f.marketText);
}

console.log('\n=== 14. Grafik gun secimi -- esitlikte EN GEC gun isaretleniyor (dogrulama + regresyon) ===');
{
  const dBas = APP.indexOf('const enDusukGun = gunler.reduce');
  if (dBas < 0) { ok('const enDusukGun = gunler.reduce satiri bulundu', false); }
  else {
    const ySatirBas = APP.indexOf('const enYuksekGun = gunler.reduce', dBas);
    const dSon = APP.indexOf('\n', ySatirBas);
    const kaynak = APP.slice(dBas, dSon);

    // her senaryo icin YENI vm baglami -- ayni 'const' iki kez calisirsa
    // ("Identifier already declared") hata verir.
    const gunSec = (gunlerListesi) => {
      const c = { console };
      vm.createContext(c);
      c.gunler = gunlerListesi;
      vm.runInContext(kaynak, c);
      return { min: vm.runInContext('enDusukGun', c), maks: vm.runInContext('enYuksekGun', c) };
    };

    // 14a. esit ortalamali GUNLERDE en GEC olan secilmeli (min tarafi)
    const r14aMin = gunSec([
      { t: '2026-08-01', avg: 5 },
      { t: '2026-08-02', avg: 3 },
      { t: '2026-08-03', avg: 3 }, // enDusukGun ile esit, daha GEC -> bu secilmeli
      { t: '2026-08-04', avg: 4 },
    ]);
    ok('14a esit min ortalamada EN GEC gun (03 Agu) secildi', r14aMin.min.t === '2026-08-03', JSON.stringify(r14aMin.min));

    // 14a. esit ortalamali GUNLERDE en GEC olan secilmeli (maks tarafi)
    const r14aMaks = gunSec([
      { t: '2026-08-01', avg: 3 },
      { t: '2026-08-02', avg: 9 },
      { t: '2026-08-03', avg: 5 },
      { t: '2026-08-04', avg: 9 }, // enYuksekGun ile esit, daha GEC -> bu secilmeli
    ]);
    ok('14a esit maks ortalamada EN GEC gun (04 Agu) secildi', r14aMaks.maks.t === '2026-08-04', JSON.stringify(r14aMaks.maks));

    // 14b. esitlik YOKKEN davranis degismemis (REGRESYON)
    const r14b = gunSec([
      { t: '2026-08-01', avg: 3 },
      { t: '2026-08-02', avg: 7 },
      { t: '2026-08-03', avg: 5 },
    ]);
    ok('14b esitlik yokken en dusuk hala dogru (01 Agu)', r14b.min.t === '2026-08-01', JSON.stringify(r14b.min));
    ok('14b esitlik yokken en yuksek hala dogru (02 Agu)', r14b.maks.t === '2026-08-02', JSON.stringify(r14b.maks));
  }
}

console.log('\nPASS=' + pass + '  FAIL=' + fail);
process.exit(fail ? 1 : 0);
