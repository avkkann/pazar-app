// TEK KAYNAK: indirimRozetiHesapla ve gercekIndirimRozetiHesapla artik
// otuzGunlukSeri()'den besleniyor. Onceden ikisi de ham kayit listesini TARIHE
// gore suzuyordu; pencere basinda yururlukte olan eski tarihli kayit disarida
// kaliyordu ve rozet olculebilen urunlerin %21,5'inde YANLIS iddia ediyordu.
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

const gun = n => { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); };

function kur(gecmis, opts = {}) {
  const ctx = {
    console, Math, Date, JSON, Array, Object, Number, String, isNaN, Set, Map, parseFloat,
    _gecmisCache: gecmis,
    _puanCache: opts.puanCache === undefined ? new Map() : opts.puanCache,
    tl: v => Number(v).toFixed(2).replace('.', ',') + ' ₺',
    lcIcon: () => '<svg></svg>',
    fiyatlariTemizle: mf => ({ gecerli: (mf || []).filter(f => f && f.fiyat != null), gizlenen: [] }),
    supheliDurum: () => opts.supheli || null,
  };
  vm.createContext(ctx);
  const sabitler = ['AL_ZAMANI_MIN_OYNAMA', 'AL_ZAMANI_TOLERANS']
    .map(s => { const m = APP.match(new RegExp('const ' + s + '\\s*=\\s*([0-9.]+)')); return m ? 'const ' + s + ' = ' + m[1] + ';' : ''; })
    .filter(Boolean).join('\n');
  const seriCache = APP.match(/let _seriCache[^\n]*\n/);
  vm.runInContext([
    sabitler,
    seriCache ? seriCache[0] : '',
    fnKaynak('otuzGunlukSeri'),
    fnKaynak('indirimRozetiHesapla'),
    fnKaynak('gercekIndirimRozetiHesapla'),
    fnKaynak('alZamaniDurumu'),
  ].join('\n'), ctx);
  return ctx;
}
const calis = (ctx, i) => vm.runInContext(i, ctx);
const U = (sid, bugun) => ({ _sid: sid, ad: 'X', en_dusuk_fiyat: bugun, market_fiyatlari: [{ market: 'bim', fiyat: bugun }] });

console.log('\n=== 1. IKINCI HESAP KALMADI (kaynak taramasi) ===');
{
  const ir = fnKaynak('indirimRozetiHesapla') || '';
  const gi = fnKaynak('gercekIndirimRozetiHesapla') || '';
  ok('indirimRozetiHesapla otuzGunlukSeri kullaniyor', /otuzGunlukSeri\s*\(/.test(ir), '');
  ok('  kendi tarih suzgeci KALMADI', !/toISOString|otuzGunOnce|k\.t >= limit/.test(ir), ir.split('\n').filter(l => /toISOString|limit/.test(l)).join(' | '));
  ok('gercekIndirimRozetiHesapla otuzGunlukSeri kullaniyor', /otuzGunlukSeri\s*\(/.test(gi), '');
  ok('  kendi tarih suzgeci KALMADI', !/toISOString|otuzGunOnce|k\.t >= limit/.test(gi), gi.split('\n').filter(l => /toISOString|limit/.test(l)).join(' | '));
  ok('gercekIndirim hala indirimRozetine bagli (esik uydurulmadi)', /indirimRozetiHesapla\s*\(/.test(gi), '');
  const tumTarihSuzgeci = (APP.match(/setDate\(\s*\w+\.getDate\(\)\s*-\s*30\s*\)/g) || []).length;
  ok('30 gunluk pencere kurulumu tek yerde kaldi (fiyatGecmisiBlogu haric <=2)', tumTarihSuzgeci <= 2, 'adet=' + tumTarihSuzgeci);
}

console.log('\n=== 2. ZIRVE: PENCERE BASINDA YURURLUKTE OLAN FIYAT SAYILIYOR ===');
{
  // Kayit -60 gun: 200. Kayit -1 gun: 100. Pencere ICINDE tek kayit var.
  // ESKI: sonAy.length < 2 -> null (rozet YOK).  YENI: seri max 200 -> %50 dusus.
  const ctx = kur({ a: [{ t: gun(60), m: 'bim', f: 200 }, { t: gun(1), m: 'bim', f: 100 }] });
  const r = calis(ctx, 'indirimRozetiHesapla(' + JSON.stringify(U('a', 100)) + ')');
  ok('tasinan yuksek fiyat zirve sayiliyor -> rozet VAR', r !== null, JSON.stringify(r));
  ok('  tip=buyuk, yuzde=50', r && r.tip === 'buyuk' && r.yuzde === 50, JSON.stringify(r));
}
{
  const ctx = kur({ a: [{ t: gun(60), m: 'bim', f: 100 }] });
  ok('oynama yoksa rozet YOK', calis(ctx, 'indirimRozetiHesapla(' + JSON.stringify(U('a', 100)) + ')') === null);
}
ok('gecmis yok -> null', calis(kur({}), 'indirimRozetiHesapla(' + JSON.stringify(U('a', 100)) + ')') === null);

console.log('\n=== 3. "30 GUNUN EN DUSUGU" IDDIASI ARTIK DOGRU ===');
{
  // Santa Maria Armut deseni: BIM -60g 79 (tasindi), -5g 129, bugun 89.
  // ESKI: pencere ICI kayit min = 129 >= 89 -> rozet CIKIYORDU (YANLIS).
  // YENI: seri min = 79 < 89 -> rozet YOK.
  const ctx = kur({ a: [{ t: gun(60), m: 'bim', f: 79 }, { t: gun(5), m: 'bim', f: 129 }] });
  const seri = calis(ctx, 'otuzGunlukSeri("a")');
  ok('seri dibi 79 (tasinan kayit goruluyor)', Math.min.apply(null, seri) === 79, JSON.stringify([...new Set(seri)]));
  ok('bugun 89 iken "30 gunun en dusugu" rozeti CIKMIYOR',
     calis(ctx, 'gercekIndirimRozetiHesapla(' + JSON.stringify(U('a', 89)) + ')') === null);
  ok('  ama bugun 79 olsaydi CIKARDI',
     calis(ctx, 'gercekIndirimRozetiHesapla(' + JSON.stringify(U('a', 79)) + ')') !== null);
}
{
  // rozet cikan HER durumda iddia dogru olmali: bugun <= seri min
  const ctx = kur({ a: [{ t: gun(60), m: 'bim', f: 200 }, { t: gun(10), m: 'bim', f: 100 }] });
  const r = calis(ctx, 'gercekIndirimRozetiHesapla(' + JSON.stringify(U('a', 100)) + ')');
  const seri = calis(ctx, 'otuzGunlukSeri("a")');
  ok('rozet ciktiysa bugun gercekten seri dibinde', r === null || 100 <= Math.min.apply(null, seri) + 0.005, JSON.stringify(r));
  ok('  bu ornekte rozet var', r !== null, JSON.stringify(r));
}
{
  const ctx = kur({ a: [{ t: gun(60), m: 'bim', f: 200 }, { t: gun(10), m: 'bim', f: 100 }] }, { supheli: { seviye: 'rozet' } });
  ok('supheli ise gercek indirim rozeti YOK (kural korundu)',
     calis(ctx, 'gercekIndirimRozetiHesapla(' + JSON.stringify(U('a', 100)) + ')') === null);
}
{
  const ctx = kur({ a: [{ t: gun(60), m: 'bim', f: 200 }, { t: gun(10), m: 'bim', f: 100 }] }, { puanCache: null });
  ok('_puanCache yoksa hicbir iddia edilmez (kural korundu)',
     calis(ctx, 'gercekIndirimRozetiHesapla(' + JSON.stringify(U('a', 100)) + ')') === null);
}

console.log('\n=== 4. 4df772a KURALI KORUNDU: rozet konusuyorsa blok susar ===');
{
  const az = fnKaynak('alZamaniDurumu') || '';
  ok('alZamaniDurumu indirimRozetiHesapla ile susuyor', /if \(indirimRozetiHesapla\(u\)\) return null;/.test(az.replace(/\s+/g, ' ').replace(/if \( /g, 'if (')), az.split('\n').filter(l => /indirimRozeti/.test(l)).join(' | '));
  const ctx = kur({ a: [{ t: gun(60), m: 'bim', f: 200 }, { t: gun(10), m: 'bim', f: 100 }] });
  ok('rozet varken alZamaniDurumu null', calis(ctx, 'alZamaniDurumu(' + JSON.stringify(U('a', 100)) + ')') === null);
}
{
  // rozet YOKKEN blok calisiyor: oynama %5+, dusus %10 altinda
  const ctx = kur({ a: [{ t: gun(60), m: 'bim', f: 100 }, { t: gun(10), m: 'bim', f: 93 }] });
  const ir = calis(ctx, 'indirimRozetiHesapla(' + JSON.stringify(U('a', 93)) + ')');
  const d = calis(ctx, 'alZamaniDurumu(' + JSON.stringify(U('a', 93)) + ')');
  ok('dusus %10 altinda -> rozet YOK', ir === null, JSON.stringify(ir));
  ok('  blok devreye giriyor ("iyi")', d && d.tip === 'iyi', JSON.stringify(d));
}

console.log('\n=== 5. SERI ONBELLEGI ===');
{
  const ctx = kur({ a: [{ t: gun(60), m: 'bim', f: 200 }, { t: gun(10), m: 'bim', f: 100 }] });
  ok('ayni sid iki cagride ayni sonucu veriyor',
     calis(ctx, 'JSON.stringify(otuzGunlukSeri("a")) === JSON.stringify(otuzGunlukSeri("a"))'));
  ok('onbellek tanimli (_seriCache)', /_seriCache/.test(APP), '');
  ok('  onbellek otuzGunlukSeri icinde kullaniliyor', /_seriCache/.test(fnKaynak('otuzGunlukSeri') || ''), '');
}

console.log('\nPASS=' + pass + '  FAIL=' + fail);
process.exit(fail ? 1 : 0);
