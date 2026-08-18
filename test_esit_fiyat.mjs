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
const GEREKEN = ['_mktRowDurumu', '_esitFiyatBilgiHTML', '_veBaglacliListe', 'enIyiBirimIdleri', 'birimFiyatHesapla', 'fiyatlariTemizle'];
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
  ok('hicbir satir isFirst degil', r.durumlar.every(d => !d.isFirst), JSON.stringify(r.durumlar));
  ok('hicbir satir isWorst degil (rozet yok)', r.durumlar.every(d => !d.isWorst), JSON.stringify(r.durumlar));
}

console.log('\n=== 2. IKI MARKET, FARKLI FIYAT -> eski davranis (REGRESYON) ===');
{
  const mktler = [{ market: 'sok', fiyat: 20 }, { market: 'a101', fiyat: 25 }]; // zaten fiyata gore siralanmis geliyor
  ctx._m2 = mktler;
  const r = calis(ctx, '_mktRowDurumu(_m2)');
  ok('fiyatlarFarkli = true', r.fiyatlarFarkli === true);
  ok('ilk (en ucuz) satir isFirst', r.durumlar[0].isFirst === true, JSON.stringify(r.durumlar));
  ok('ilk satir isWorst degil', r.durumlar[0].isWorst === false);
  ok('son (en pahali) satir isWorst', r.durumlar[1].isWorst === true, JSON.stringify(r.durumlar));
  ok('son satir isFirst degil', r.durumlar[1].isFirst === false);
}

console.log('\n=== 3. UC MARKET, IKISI ESIT EN PAHALIDA -> HEPSI isaretlenir (karar) ===');
{
  // 10, 15, 15 -- siralanmis (fiyata gore artan)
  const mktler = [{ market: 'sok', fiyat: 10 }, { market: 'bim', fiyat: 15 }, { market: 'a101', fiyat: 15 }];
  ctx._m3 = mktler;
  const r = calis(ctx, '_mktRowDurumu(_m3)');
  ok('fiyatlarFarkli = true', r.fiyatlarFarkli === true);
  ok('en ucuz (ilk) satir isFirst', r.durumlar[0].isFirst === true);
  ok('esit-en-yuksek IKI satir da isWorst (tekil degil, ikisi de gercek)', r.durumlar[1].isWorst === true && r.durumlar[2].isWorst === true, JSON.stringify(r.durumlar));
  ok('en ucuz satir isWorst degil', r.durumlar[0].isWorst === false);
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

console.log('\nPASS=' + pass + '  FAIL=' + fail);
process.exit(fail ? 1 : 0);
