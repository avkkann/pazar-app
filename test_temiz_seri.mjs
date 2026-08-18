// HEDEFLI DUZELTME: salinimsiz ("temiz") seriden hesaplanan deger mevcuttan
// farkliysa temiz olan kullanilir. SUSTURMA YOK — uygunluk kapilari aynen
// kaliyor, yalnizca DEGER duzeliyor.
// Ayrica: gun siniri yerel takvime gore bulunuyor (toISOString UTC'ye cevirip
// UTC+3'te 00:00-03:00 arasi pencereyi bir gun geri kaydiriyordu).
import fs from 'fs';
import vm from 'vm';

const APP = fs.readFileSync('app.js', 'utf8');
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

console.log('\n=== 0. YAPI ===');
const GEREKEN = ['_yerelGunISO', '_seriKur', '_salinimVarSeri', 'otuzGunlukSeri',
  'otuzGunlukSeriTemiz', 'otuzGunMinFiyatTemiz'];
let eksik = 0;
for (const f of GEREKEN) { const v = !!fnKaynak(f); ok('function ' + f, v); if (!v) eksik++; }
if (eksik) { console.log('\nPASS=' + pass + '  FAIL=' + fail); process.exit(1); }

// yerel takvim gunu (test tarafinda bagimsiz uretiliyor)
const gun = n => {
  const d = new Date(); d.setDate(d.getDate() - n);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
};
const H = (market, ciftler) => ciftler.map(([n, f]) => ({ m: market, t: gun(n), f }));

function kur(gecmis, urunler = []) {
  const ctx = {
    console, Math, Date, JSON, Array, Object, Number, String, isNaN, Set, Map, parseFloat,
    _gecmisCache: gecmis, catCache: { test: urunler }, _puanCache: new Map(),
    MARKET_NAMES: { a101: 'A101', bim: 'BIM', migros: 'Migros', carrefour: 'CarrefourSA' },
    tl: v => Number(v).toFixed(2) + ' TL', lcIcon: () => '',
    fiyatlariTemizle: mf => ({ gecerli: (mf || []).filter(f => f && f.fiyat != null), gizlenen: [] }),
    marketVarMi: () => true,
    ustKategori: k => (k === 'Meyve' ? 'meyve' : k === 'Sebze' ? 'sebze' : 'gida'),
    navigator: {}, window: {},
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  const sabitler = ['ZAM_ESIK', 'ZAM_MAX', 'ZAM_MIN', 'ZAM_MIN_KAYIT', 'ZAM_MARKA_MAX',
    'ZAM_KAT_MAX', 'AL_ZAMANI_MIN_OYNAMA', 'AL_ZAMANI_TOLERANS']
    .map(s => { const m = APP.match(new RegExp('const ' + s + '\\s*=\\s*([0-9.]+)')); return m ? 'const ' + s + ' = ' + m[1] + ';' : ''; })
    .filter(Boolean).join('\n');
  const seriCache = APP.match(/let _seriCache[^\n]*\n/);
  vm.runInContext([
    sabitler, seriCache ? seriCache[0] : '',
    fnKaynak('_yerelGunISO'), fnKaynak('_salinimVarSeri'), fnKaynak('_seriKur'),
    fnKaynak('otuzGunlukSeri'), fnKaynak('otuzGunlukSeriTemiz'), fnKaynak('_hamDipMi'),
    fnKaynak('otuzGunMinFiyat'), fnKaynak('otuzGunMinFiyatTemiz'), fnKaynak('enDusukFiyat'),
    fnKaynak('supheliDurum'), fnKaynak('indirimRozetiHesapla'), fnKaynak('gercekIndirimRozetiHesapla'),
    fnKaynak('alarmOnerisi'), fnKaynak('_zamGunISO'), fnKaynak('zamMarketSerisi'),
    fnKaynak('zamOlcutu'), fnKaynak('zamMarketArtisi'), fnKaynak('zamSalinimVar'), fnKaynak('zamDurumu'),
    fnKaynak('alZamaniDurumu'), fnKaynak('_zamMarka'), fnKaynak('zamOncekiZirve'),
    fnKaynak('zamAdaylari'),
  ].filter(Boolean).join('\n'), ctx);
  return ctx;
}
const calis = (ctx, i) => vm.runInContext(i, ctx);

// ══════════════════════════════════════════════════════════
console.log('\n=== 1. GUN SINIRI YEREL TAKVIME GORE ===');
let c = kur({});
ok('_yerelGunISO(0) yerel bugun', calis(c, '_yerelGunISO(0)') === gun(0),
  calis(c, '_yerelGunISO(0)') + ' vs ' + gun(0));
ok('_yerelGunISO(29) yerel 29 gun once', calis(c, '_yerelGunISO(29)') === gun(29));
ok('_zamGunISO yerel gunle ayni', calis(c, '_zamGunISO(29)') === gun(29),
  calis(c, '_zamGunISO(29)') + ' vs ' + gun(29));
ok('_yerelGunISO YYYY-MM-DD bicimi', /^\d{4}-\d{2}-\d{2}$/.test(calis(c, '_yerelGunISO(5)')));
ok('_seriKur toISOString KULLANMIYOR', !/toISOString/.test(fnKaynak('_seriKur') || ''));
ok('_zamGunISO toISOString KULLANMIYOR', !/toISOString/.test(fnKaynak('_zamGunISO') || ''));
ok('_yerelGunISO toISOString KULLANMIYOR', !/toISOString/.test(fnKaynak('_yerelGunISO') || ''));
ok('zamOncekiZirve toISOString KULLANMIYOR', !/toISOString/.test(fnKaynak('zamOncekiZirve') || ''));
ok('_otuzGunOncekiEnUcuz toISOString KULLANMIYOR', !/toISOString/.test(fnKaynak('_otuzGunOncekiEnUcuz') || ''));
ok('fiyatGecmisiBlogu toISOString KULLANMIYOR', !/toISOString/.test(fnKaynak('fiyatGecmisiBlogu') || ''));

console.log('\n=== 2. TEMIZ SERI — salinimli market disarida ===');
// carrefour salinimli (20 -> 100 -> 30 -> 100), migros temiz (48 -> 45)
const G = {
  x1: [...H('carrefour', [[60, 20], [25, 100], [15, 30], [5, 100]]),
       ...H('migros', [[60, 50], [40, 48], [20, 45]])],
};
c = kur(G);
ok('tum seri 30 gun', calis(c, 'otuzGunlukSeri("x1")').length === 30,
  calis(c, 'otuzGunlukSeri("x1")').length);
ok('tum serinin dibi salinimli marketten (20)', calis(c, 'otuzGunMinFiyat("x1")') === 20,
  calis(c, 'otuzGunMinFiyat("x1")'));
ok('TEMIZ serinin dibi temiz marketten (45)', calis(c, 'otuzGunMinFiyatTemiz("x1")') === 45,
  calis(c, 'otuzGunMinFiyatTemiz("x1")'));
ok('temiz seri de 30 gun', calis(c, 'otuzGunlukSeriTemiz("x1")').length === 30,
  calis(c, 'otuzGunlukSeriTemiz("x1")').length);

console.log('\n=== 3. SUSTURMA YOK — geri cekilme davranisi ===');
// TUM marketler salinimli -> temiz seri TUM seriye dusuyor, null donmuyor
const G2 = { y1: H('carrefour', [[60, 20], [25, 100], [15, 30], [5, 100]]) };
c = kur(G2);
ok('tek market salinimliysa temiz = tum (bos donmuyor)',
  JSON.stringify(calis(c, 'otuzGunlukSeriTemiz("y1")')) === JSON.stringify(calis(c, 'otuzGunlukSeri("y1")')));
ok('temiz min null degil', calis(c, 'otuzGunMinFiyatTemiz("y1")') === 20,
  calis(c, 'otuzGunMinFiyatTemiz("y1")'));
// gecmisi olmayan urun
c = kur({});
ok('gecmissiz sid temiz seri bos dizi', JSON.stringify(calis(c, 'otuzGunlukSeriTemiz("yok")')) === '[]');
ok('gecmissiz sid temiz min null', calis(c, 'otuzGunMinFiyatTemiz("yok")') === null);

console.log('\n=== 4. ALARM ONERISI TEMIZ DEGERI KULLANIYOR ===');
const urun = {
  _sid: 'x1', _id: 'x1', ad: 'Test Urun', ana_kategori: 'Bakliyat', en_dusuk_fiyat: 60,
  market_fiyatlari: [{ market: 'carrefour', fiyat: 100 }, { market: 'migros', fiyat: 60 }],
};
c = kur(G, [urun]);
let o = calis(c, 'alarmOnerisi(' + JSON.stringify(urun) + ')');
ok('oneri TEMIZ dipten (45), salinimli 20 degil', o && o.deger === 45, JSON.stringify(o));
ok('guncel fiyat degismedi', o && o.guncel === 60, JSON.stringify(o));
// temiz dip guncelden dusuk degilse oneri yok (mevcut kural korunuyor)
const urun2 = { ...urun, en_dusuk_fiyat: 40, market_fiyatlari: [{ market: 'migros', fiyat: 40 }] };
o = calis(c, 'alarmOnerisi(' + JSON.stringify(urun2) + ')');
ok('temiz dip guncelin ustundeyse oneri yok', o === null, JSON.stringify(o));

console.log('\n=== 5. AL / BEKLE — uygunluk kapisi AYNI, deger temiz ===');
c = kur(G, [urun]);
const az = calis(c, 'alZamaniDurumu(' + JSON.stringify(urun) + ')');
ok('al/bekle hala cikiyor (susturulmadi)', !!az, JSON.stringify(az));
ok('min TEMIZ seriden (45)', az && az.min === 45, JSON.stringify(az));
ok('max TEMIZ seriden (48)', az && az.max === 48, JSON.stringify(az));
// 30 gunu doldurmayan urun hala eleniyor (uygunluk kapisi TUM seride)
const G3 = { k1: H('migros', [[10, 50], [5, 45]]) };
const urun3 = { _sid: 'k1', _id: 'k1', ad: 'Kisa Gecmis', ana_kategori: 'Bakliyat',
  en_dusuk_fiyat: 45, market_fiyatlari: [{ market: 'migros', fiyat: 45 }] };
c = kur(G3, [urun3]);
ok('30 gunu doldurmayan urunde yorum yok (kapi degismedi)',
  calis(c, 'alZamaniDurumu(' + JSON.stringify(urun3) + ')') === null);

console.log('\n=== 6. GERCEK INDIRIM ROZETI — dip temiz seriden ===');
// carrefour salinimli (dip 20 hayalet), migros temiz (90 -> 45)
// bugun 45 = TEMIZ dip -> rozet CIKMALI. Kirli dip 20'ye bakilsaydi cikmazdi.
const G4 = {
  z1: [...H('carrefour', [[60, 20], [25, 100], [15, 30], [5, 100]]),
       ...H('migros', [[60, 50], [40, 90], [20, 45]])],
};
const urun4 = { _sid: 'z1', _id: 'z1', ad: 'Test Urun', ana_kategori: 'Bakliyat',
  en_dusuk_fiyat: 45, market_fiyatlari: [{ market: 'migros', fiyat: 45 }] };
c = kur(G4, [urun4]);
ok('kirli dip gercekten hayalet (20)', calis(c, 'otuzGunMinFiyat("z1")') === 20,
  calis(c, 'otuzGunMinFiyat("z1")'));
ok('temiz dip bugunku fiyat (45)', calis(c, 'otuzGunMinFiyatTemiz("z1")') === 45,
  calis(c, 'otuzGunMinFiyatTemiz("z1")'));
const gi = calis(c, 'gercekIndirimRozetiHesapla(' + JSON.stringify(urun4) + ')');
// ESKI IDDIA: "temiz dipteki fiyat gercek indirim sayilir". 2026-08-11 denetimi
// bunu CURUTTU: rozetin metni "30 günün en düşüğü", yani HAM seriye ait bir iddia;
// temiz dipten olculunce 1492 rozetin 91'i (%6,1) YANLIS cikiyordu.
// YENI DEGISMEZ: temiz dipte ama HAM dipte degilse rozet CIKMAZ. Burada ham dip
// carrefour'un salinimli serisinden 20, bugunku fiyat 45 -> rozet olmamali.
ok('temiz dipte ama HAM dipte degilse rozet YOK', gi === null, JSON.stringify(gi));
const urun4b = { ...urun4, en_dusuk_fiyat: 20, market_fiyatlari: [{ market: 'carrefour', fiyat: 20 }] };
ok('HAM dipteki fiyata rozet VAR',
  !!calis(c, 'gercekIndirimRozetiHesapla(' + JSON.stringify(urun4b) + ')'));
// bugun 60 -> temiz dip 45'in ustunde -> rozet YOK
const urun5 = { ...urun4, en_dusuk_fiyat: 60, market_fiyatlari: [{ market: 'migros', fiyat: 60 }] };
ok('temiz dibin ustundeki fiyata rozet yok',
  calis(c, 'gercekIndirimRozetiHesapla(' + JSON.stringify(urun5) + ')') === null);

console.log('\n=== 7. ZAM SERIDI BU TURDA DEGISMEDI ===');
// zamSalinimVar davranisi aynen duruyor
c = kur({ lux: H('carrefour', [[60, 38], [45, 27], [25, 85.9], [15, 28], [5, 85.9]]) });
ok('zikzak hala salinim', calis(c, 'zamSalinimVar("lux","carrefour")') === 85.9,
  calis(c, 'zamSalinimVar("lux","carrefour")'));
c = kur({ bar: H('carrefour', [[60, 88.99], [40, 89.99], [25, 169.95]]) });
ok('basamak hala basamak', calis(c, 'zamSalinimVar("bar","carrefour")') === null);
c = kur({ spr: H('a101', [[78, 60], [59, 48], [50, 60], [28, 159]]) });
ok('pencere disi tekrar hala salinim yapmiyor', calis(c, 'zamSalinimVar("spr","a101")') === null);
// zamAdaylari TEMIZ seriye gecmedi: olcut hala market bazli TUM seriden
const TEMIZ_FN = /otuzGunlukSeriTemiz|otuzGunMinFiyatTemiz/;
ok('zamMarketArtisi temiz seri kullanmiyor', !TEMIZ_FN.test(fnKaynak('zamMarketArtisi') || ''));
ok('zamAdaylari temiz seri kullanmiyor', !TEMIZ_FN.test(fnKaynak('zamAdaylari') || ''));
ok('zamSalinimVar temiz seri kullanmiyor', !TEMIZ_FN.test(fnKaynak('zamSalinimVar') || ''));

console.log('\n=== 8. TEK GECIS — temiz varyant bedava ===');
ok('_seriKur ikisini birden donduruyor', /temiz/.test(fnKaynak('_seriKur') || ''));
ok('otuzGunlukSeri _seriKur uzerinden', /_seriKur/.test(fnKaynak('otuzGunlukSeri') || ''));
ok('otuzGunlukSeriTemiz _seriKur uzerinden', /_seriKur/.test(fnKaynak('otuzGunlukSeriTemiz'), fnKaynak('_hamDipMi') || ''));
ok('zamMarketSerisi de ayni cache\'ten', /_seriKur/.test(fnKaynak('zamMarketSerisi') || ''));

console.log('\n=== 9. GELECEK NOTU ===');
const bas = APP.indexOf('function _seriKur(');
const cevre = APP.slice(Math.max(0, bas - 2200), bas + (fnKaynak('_seriKur') || '').length);
ok('depot_id notu temiz-seri yakininda', /depot_id/.test(cevre));

console.log('\nPASS=' + pass + '  FAIL=' + fail);
process.exit(fail ? 1 : 0);
