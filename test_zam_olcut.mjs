// zamOlcutu(kayitlar, pencereBas, pencereSon) SAF fonksiyonunun kendi testi.
// AYRI DOSYA (test_zam.mjs'e gomulmedi): zamOlcutu artik IKI cagiran
// tarafindan paylasiliyor (app.js:zamMarketArtisi VE scripts/hub-uret.mjs:
// ayZamHesapla) -- cekirdegin kendisi TEK bir dosyada, cagiranlardan BAGIMSIZ
// test edilmeli. Cagiranlarin DOGRU PENCERE gectigi ayrica sinaniyor:
//   - zamMarketArtisi icin: test_zam.mjs, bolum "PENCERE DOGRULAMA"
//   - hub-uret.mjs icin: test_hub_zam_pencere.mjs (uretici gercekten
//     kosturulup stdout'a bastigi pencere gozlemleniyor)
// Bu ayrim BILINCLI: fonksiyon dogru olsa bile cagiran yanlis pencere
// gecirirse (ay sinirini kaydirma, ayin son gununu atlama vb.) hicbir testle
// yakalanmaz -- cekirdek + her cagiran ayri ayri kanitlanmali.
import fs from 'fs';
import vm from 'vm';

const APP = fs.readFileSync('app.js', 'utf8');

let pass = 0, fail = 0;
const ok = (ad, k, d = '') => { if (k) { pass++; console.log('  PASS  ' + ad); } else { fail++; console.log('  FAIL  ' + ad + (d ? '  -> ' + d : '')); } };

function fnKaynak(ad) {
  let bas = APP.indexOf('function ' + ad + '(');
  if (bas < 0) return null;
  let dd = 0;
  for (let j = APP.indexOf('{', bas); j < APP.length; j++) {
    const c = APP[j];
    if (c === '{') dd++;
    else if (c === '}') { dd--; if (dd === 0) return APP.slice(bas, j + 1); }
  }
  return null;
}

console.log('=== 0. YAPI ===');
ok('function zamOlcutu var', !!fnKaynak('zamOlcutu'));
if (!fnKaynak('zamOlcutu')) { console.log('\nPASS=' + pass + '  FAIL=' + fail); process.exit(1); }

function kur(zamMinKayit) {
  const ctx = { console, Math, Array, Object, Number, String, isNaN };
  vm.createContext(ctx);
  const sabit = zamMinKayit == null
    ? APP.match(/const ZAM_MIN_KAYIT\s*=\s*[0-9.]+;/)[0]
    : `const ZAM_MIN_KAYIT = ${zamMinKayit};`;
  vm.runInContext([sabit, fnKaynak('zamOlcutu')].join('\n'), ctx);
  return ctx;
}
const calis = (ctx, kod) => vm.runInContext(kod, ctx);
const enj = (ctx, ad, deger) => { ctx['__' + ad] = deger; };

function zamOlcutuCagir(ctx, kayitlar, pencereBas, pencereSon) {
  enj(ctx, 'k', kayitlar); enj(ctx, 'b', pencereBas); enj(ctx, 's', pencereSon);
  return calis(ctx, 'zamOlcutu(__k, __b, __s)');
}

console.log('\n=== 1. TEMEL GIRDI DOGRULAMASI ===');
{
  const c = kur();
  ok('kayitlar dizi degilse null', zamOlcutuCagir(c, null, '2026-08-01', '2026-08-31') === null);
  ok('pencereBas yoksa null', zamOlcutuCagir(c, [{ t: '2026-07-01', f: 10 }], null, '2026-08-31') === null);
  ok('pencereSon yoksa null', zamOlcutuCagir(c, [{ t: '2026-07-01', f: 10 }], '2026-08-01', null) === null);
  ok('bos dizi -> null (pencere oncesi kayit yok)', zamOlcutuCagir(c, [], '2026-08-01', '2026-08-31') === null);
}

console.log('\n=== 2. ZAM_MIN_KAYIT ESIGI (capa kirilgan olmasin) ===');
{
  const c = kur(2);
  const tekKayit = [{ t: '2026-07-01', f: 100 }];
  ok('pencere oncesi kayit sayisi ZAM_MIN_KAYIT altinda -> null',
     zamOlcutuCagir(c, tekKayit, '2026-08-01', '2026-08-31') === null);
  const ikiKayit = [{ t: '2026-06-01', f: 100 }, { t: '2026-07-01', f: 120 }];
  const r = zamOlcutuCagir(c, ikiKayit, '2026-08-01', '2026-08-31');
  ok('ZAM_MIN_KAYIT karsilaniyorsa olculuyor', r !== null, JSON.stringify(r));
  ok('  kayit sayisi dogru raporlaniyor (2)', r && r.kayit === 2, JSON.stringify(r));
}

console.log('\n=== 3. ZIRVE YALNIZCA PENCERE ONCESINDEN ALINIYOR ===');
{
  const c = kur(2);
  // Pencere ICINDE bir sicrama var (300) ama sonra dusuyor (70) -- zirve BU
  // sicramadan degil, pencere ONCESI en yuksek kayittan (60) hesaplanmali.
  const kayitlar = [
    { t: '2026-06-01', f: 50 }, { t: '2026-06-15', f: 60 },  // pencere oncesi
    { t: '2026-08-03', f: 300 },                              // pencere ICI sicrama
    { t: '2026-08-10', f: 70 },                               // pencere ICI dusus
  ];
  const r = zamOlcutuCagir(c, kayitlar, '2026-08-01', '2026-08-31');
  ok('zirve pencere oncesi maksimum (60), pencere ici sicrama (300) DEGIL', r && r.zirve === 60, JSON.stringify(r));
  ok('sonDeger pencere sonuna kadar tasinan son deger (70)', r && r.sonDeger === 70, JSON.stringify(r));
  ok('artis 60 -> 70 uzerinden (%16,67)', r && Math.abs(r.artis - ((70 - 60) / 60) * 100) < 0.01, JSON.stringify(r));
  ok('  70 daha once HIC gorulmemis bir seviye oldugu icin bu GERCEK bir zam', r && r.artis > 0, JSON.stringify(r));
}

console.log('\n=== 4. CARRY-FORWARD: PENCERE ICINDE YENI KAYIT YOKSA SON ESKI DEGER TASINIR ===');
{
  const c = kur(2);
  const kayitlar = [{ t: '2026-05-01', f: 40 }, { t: '2026-06-01', f: 50 }];
  const r = zamOlcutuCagir(c, kayitlar, '2026-08-01', '2026-08-31');
  ok('pencere ICINDE hic kayit yoksa sonDeger son ESKI kayittan tasinir (50)', r && r.sonDeger === 50, JSON.stringify(r));
  ok('bu durumda artis 0 (fiyat degismedi)', r && Math.abs(r.artis) < 0.001, JSON.stringify(r));
}

console.log('\n=== 5. GECERSIZ KAYITLAR FILTRELENIYOR ===');
{
  const c = kur(2);
  const kayitlar = [
    { t: '2026-06-01', f: 40 }, { t: '2026-06-10', f: 50 },
    { t: null, f: 999 }, { t: '2026-06-20', f: 0 }, { m: 'x' }, null,
  ];
  const r = zamOlcutuCagir(c, kayitlar, '2026-08-01', '2026-08-31');
  ok('gecersiz kayitlar (t yok / f<=0 / null) sayilmiyor', r && r.kayit === 2, JSON.stringify(r));
}

console.log('\n=== 6. SIGNAL SENARYOSU (gercek veri, bug fixture) ===');
// gecmis_fiyatlar.json'daki GERCEK seri (temizlik_signal-white-now-3in1-white-boost-dis-macunu-75-ml, migros):
//   2026-05-25 139,95 / 2026-06-15 449,95 / 2026-07-14 499,95 / 2026-07-23 139,95 / 2026-08-07 499,95
// Eski (ay basi -> ay sonu) yontemi Agustos icin "139,95 -> 499,95 = +%257 zam" diyordu.
// YANLIS: 499,95 Temmuz'da ZATEN gorulmustu -- yeni bir seviye degil, eski bir seviyeye DONUS.
{
  const c = kur(2);
  const signalSerisi = [
    { t: '2026-05-25', f: 139.95 }, { t: '2026-06-15', f: 449.95 },
    { t: '2026-07-14', f: 499.95 }, { t: '2026-07-23', f: 139.95 },
    { t: '2026-08-07', f: 499.95 },
  ];
  const rAgustos = zamOlcutuCagir(c, signalSerisi, '2026-08-01', '2026-08-31');
  ok('Agustos zirvesi Temmuz sonu itibariyla ZATEN 499,95 (pencere oncesi max)',
     rAgustos && Math.abs(rAgustos.zirve - 499.95) < 0.001, JSON.stringify(rAgustos));
  ok('Agustos sonDeger de 499,95 (ayni seviyeye DONUS, yeni seviye DEGIL)',
     rAgustos && Math.abs(rAgustos.sonDeger - 499.95) < 0.001, JSON.stringify(rAgustos));
  ok('Agustos artis ~%0 -- ESKI "ay basi->ay sonu" yontemindeki +%257 iddiasi YOK',
     rAgustos && Math.abs(rAgustos.artis) < 0.001, JSON.stringify(rAgustos));
  ok('  ZAM_ESIK (%15) esigini GECMIYOR -> zam sayilmaz', rAgustos && rAgustos.artis < 15, JSON.stringify(rAgustos));

  const rTemmuz = zamOlcutuCagir(c, signalSerisi, '2026-07-01', '2026-07-31');
  ok('Temmuz zirvesi pencere oncesi max (449,95)', rTemmuz && Math.abs(rTemmuz.zirve - 449.95) < 0.001, JSON.stringify(rTemmuz));
  ok('Temmuz sonDeger ay sonundaki tasinan deger (139,95, 07-23 kaydi)', rTemmuz && Math.abs(rTemmuz.sonDeger - 139.95) < 0.001, JSON.stringify(rTemmuz));
  ok('Temmuz artis NEGATIF (fiyat dustu, zam degil)', rTemmuz && rTemmuz.artis < 0, JSON.stringify(rTemmuz));
}

console.log('\n=== 7. GERCEK ZAM: ONCEKI ZIRVEYI ASAN YENI SEVIYE ===');
{
  // gecmis_fiyatlar.json: icecek_sprite-gazoz-1-lt / a101
  const c = kur(2);
  const sprite = [
    { t: '2026-05-25', f: 60 }, { t: '2026-06-13', f: 48 },
    { t: '2026-06-22', f: 60 }, { t: '2026-07-14', f: 159 },
  ];
  const r = zamOlcutuCagir(c, sprite, '2026-07-01', '2026-07-31');
  ok('zirve pencere oncesi max (60)', r && r.zirve === 60, JSON.stringify(r));
  ok('sonDeger 159 (07-14 kaydi tasiniyor)', r && r.sonDeger === 159, JSON.stringify(r));
  ok('artis ~%165, GERCEK zam (daha once hic 159 gorulmedi)', r && Math.round(r.artis) === 165, JSON.stringify(r));
}

console.log('\nPASS=' + pass + '  FAIL=' + fail);
process.exit(fail ? 1 : 0);
