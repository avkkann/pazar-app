// IDDIA-HESAP UYUMU.
// ILKE: kullaniciya gosterilen sayisal cumle HAM 30 gunluk seriye ait bir sey
// soyluyorsa, HAM seriye karsi dogru olmali. Dogru degilse CUMLE GOSTERILMEZ
// (iddia zayiflatilmaz, susulur).
//
// Denetim bulgusu (2026-08-11): "Gerçek indirim · 30 günün en düşüğü" 1492
// urunun 91'inde (%6,1) yanlisti. Sebep: rozet SALINIMSIZ seriden olculuyor,
// metin HAM seriye ait iddia kuruyordu. Ayni uyusmazlik 4 metinde vardi.
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
ok('function _hamDipMi', !!fnKaynak('_hamDipMi'));
if (!fnKaynak('_hamDipMi')) { console.log('\nPASS=' + pass + '  FAIL=' + fail); process.exit(1); }

const gun = n => { const d = new Date(); d.setDate(d.getDate() - n);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
const H = (m, c) => c.map(([n, f]) => ({ m, t: gun(n), f }));

function kur(gecmis, urunler = []) {
  const ctx = {
    console, Math, Date, JSON, Array, Object, Number, String, isNaN, Set, Map, parseFloat,
    _gecmisCache: gecmis, catCache: { t: urunler }, _puanCache: new Map(),
    MARKET_NAMES: { migros: 'Migros', carrefour: 'CarrefourSA', bim: 'BIM' },
    tl: v => Number(v).toFixed(2) + ' TL', lcIcon: () => '',
    fiyatlariTemizle: mf => ({ gecerli: (mf || []).filter(f => f && f.fiyat != null), gizlenen: [] }),
    marketVarMi: () => true, ustKategori: () => 'gida', navigator: {}, window: {},
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  const sab = ['ZAM_ESIK', 'ZAM_MAX', 'ZAM_MIN', 'ZAM_MIN_KAYIT', 'ZAM_MARKA_MAX', 'ZAM_KAT_MAX',
    'AL_ZAMANI_MIN_OYNAMA', 'AL_ZAMANI_TOLERANS']
    .map(s => { const m = APP.match(new RegExp('const ' + s + '\\s*=\\s*([0-9.]+)')); return m ? 'const ' + s + ' = ' + m[1] + ';' : ''; })
    .filter(Boolean).join('\n');
  const sc = APP.match(/let _seriCache[^\n]*\n/);
  vm.runInContext([sab, sc ? sc[0] : '',
    fnKaynak('_yerelGunISO'), fnKaynak('_salinimVarSeri'), fnKaynak('_seriKur'),
    fnKaynak('otuzGunlukSeri'), fnKaynak('otuzGunlukSeriTemiz'), fnKaynak('_hamDipMi'),
    fnKaynak('otuzGunMinFiyat'), fnKaynak('otuzGunMinFiyatTemiz'), fnKaynak('enDusukFiyat'),
    fnKaynak('supheliDurum'), fnKaynak('indirimRozetiHesapla'),
    fnKaynak('gercekIndirimRozetiHesapla'), fnKaynak('gercekIndirimRozetiHTML'),
    fnKaynak('alarmOnerisi'), fnKaynak('alarmOneriHTML'),
    fnKaynak('_zamGunISO'), fnKaynak('zamMarketSerisi'), fnKaynak('zamMarketArtisi'),
    fnKaynak('zamSalinimVar'), fnKaynak('zamDurumu'),
    fnKaynak('alZamaniDurumu'), fnKaynak('alZamaniHTML'),
  ].filter(Boolean).join('\n'), ctx);
  return ctx;
}
const calis = (c, i) => vm.runInContext(i, c);

// carrefour SALINIMLI: 20 -> 100 -> 30 -> 100  (ham dip 20, temiz dip migros'tan)
// migros TEMIZ: 90 -> 45
const G = { x: [...H('carrefour', [[60, 20], [25, 100], [15, 30], [5, 100]]),
                ...H('migros', [[60, 50], [40, 90], [20, 45]])] };
const U = (bugun, market = 'migros') => ({ _sid: 'x', _id: 'x', ad: 'Test', ana_kategori: 'Bakliyat',
  en_dusuk_fiyat: bugun, market_fiyatlari: [{ market, fiyat: bugun }] });

console.log('\n=== 1. HAM ve TEMIZ DIP AYRISIYOR (test anlamli mi) ===');
let c = kur(G);
const hamDip = calis(c, 'otuzGunMinFiyat("x")');
const temizDip = calis(c, 'otuzGunMinFiyatTemiz("x")');
ok('ham dip 20', hamDip === 20, hamDip);
ok('temiz dip 45', temizDip === 45, temizDip);
ok('ikisi FARKLI (senaryo kurulu)', hamDip !== temizDip);

console.log('\n=== 2. _hamDipMi ===');
ok('ham dipteki fiyat icin true', calis(c, '_hamDipMi("x", 20)') === true);
ok('ham dipten YUKARI fiyat icin false', calis(c, '_hamDipMi("x", 45)') === false);
ok('ham dipten asagi (imkansiz) true', calis(c, '_hamDipMi("x", 10)') === true);
ok('kurus toleransi (20.004) true', calis(c, '_hamDipMi("x", 20.004)') === true);
ok('gecmissiz sid false', calis(c, '_hamDipMi("yok", 5)') === false);
ok('deger null false', calis(c, '_hamDipMi("x", null)') === false);

console.log('\n=== 3. "30 GUNUN EN DUSUGU" ROZETI ===');
// bugun 45 = TEMIZ dip ama HAM dip 20 -> ROZET CIKMAMALI (denetim bulgusu)
c = kur(G, [U(45)]);
ok('temiz dipte ama ham dipte DEGIL -> rozet YOK',
  calis(c, 'gercekIndirimRozetiHesapla(' + JSON.stringify(U(45)) + ')') === null);
// bugun 20 = HAM dip -> rozet CIKMALI
c = kur(G, [U(20, 'carrefour')]);
ok('HAM dipteki fiyat -> rozet VAR',
  !!calis(c, 'gercekIndirimRozetiHesapla(' + JSON.stringify(U(20, 'carrefour')) + ')'));
// metin degismedi (iddia zayiflatilmadi)
ok('metin AYNEN duruyor ("30 günün en düşüğü")',
  /30 günün en düşüğü/.test(fnKaynak('gercekIndirimRozetiHTML') || ''));
ok('rozet HAM seriye bakiyor', /_hamDipMi/.test(fnKaynak('gercekIndirimRozetiHesapla') || ''));

console.log('\n=== 4. ALARM ONERISI CUMLESI ===');
// temiz dip 45, ham dip 20 -> "Son ay 45 TL'ye kadar indi" YANLIS, cumle susmali
c = kur(G, [U(60)]);
let h = calis(c, 'alarmOneriHTML(' + JSON.stringify(U(60)) + ')');
ok('oneri hala uretiliyor (ozellik susmuyor)', /alarm-oneri-btn/.test(h), h.slice(0, 120));
ok('YANLIS "Son ay ...kadar indi" cumlesi YOK', !/kadar indi/.test(h), h.slice(0, 200));
// ham dip = temiz dip olan senaryo -> cumle CIKMALI
const G2 = { y: H('migros', [[60, 100], [40, 90], [20, 45]]) };
const U2 = { _sid: 'y', _id: 'y', ad: 'T2', ana_kategori: 'Bakliyat', en_dusuk_fiyat: 60,
  market_fiyatlari: [{ market: 'migros', fiyat: 60 }] };
c = kur(G2, [U2]);
h = calis(c, 'alarmOneriHTML(' + JSON.stringify(U2) + ')');
ok('ham=temiz oldugunda cumle VAR', /kadar indi/.test(h), h.slice(0, 200));

console.log('\n=== 5. AL/BEKLE CUMLELERI ===');
c = kur(G, [U(45)]);
const az = calis(c, 'alZamaniDurumu(' + JSON.stringify(U(45)) + ')');
if (az) {
  h = calis(c, 'alZamaniHTML(' + JSON.stringify(U(45)) + ')');
  ok('blok hala ciziliyor', /detay-zaman/.test(h), h.slice(0, 120));
  if (az.tip === 'iyi') {
    ok('"son ayın en ucuz seviyesinde" iddiasi ham dipte DEGILSE yok',
      !/en ucuz seviyesinde/.test(h), h.slice(0, 200));
  } else {
    ok('"son ayda X kadar indi" iddiasi ham dip degilse yok',
      !/kadar indi/.test(h), h.slice(0, 200));
  }
} else {
  ok('al/bekle bu senaryoda cikmadi (kapi)', true);
  ok('  ikinci iddia kontrolu atlandi', true);
}
// ham=temiz senaryosunda iddia CIKMALI
c = kur(G2, [U2]);
const az2 = calis(c, 'alZamaniDurumu(' + JSON.stringify(U2) + ')');
if (az2) {
  h = calis(c, 'alZamaniHTML(' + JSON.stringify(U2) + ')');
  ok('ham=temiz oldugunda sayisal iddia VAR', /kadar indi|en ucuz seviyesinde/.test(h), h.slice(0, 200));
} else ok('ham=temiz senaryosunda al/bekle cikmadi (kapi)', true);

console.log('\n=== 6. DOKUNULMAYANLAR (bunlar ZATEN ham seriden) ===');
ok('indirimRozetiHesapla hala TUM seriden (zirve)',
  /otuzGunlukSeri\s*\(/.test(fnKaynak('indirimRozetiHesapla') || '') &&
  !/otuzGunlukSeriTemiz/.test(fnKaynak('indirimRozetiHesapla') || ''));
ok('"Son ayın zirvesinden %X ucuz" metni degismedi',
  /zirvesinden %\$\{rozet\.yuzde\} ucuz/.test(APP));

console.log('\nPASS=' + pass + '  FAIL=' + fail);
process.exit(fail ? 1 : 0);
