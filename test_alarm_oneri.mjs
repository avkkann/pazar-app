// Ozellik B: akilli alarm — hedef fiyat son 30 gunun en dusuguyle onerilir.
// Onceden alan enDusuk*0.95 ile (keyfi %5) doluyordu; gecmisle hicbir bagi yoktu.
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

const GEREKEN = ['otuzGunMinFiyat', 'alarmOnerisi', 'alarmOneriHTML'];
console.log('\n=== 0. YAPI ===');
const eksik = [];
for (const f of GEREKEN) { const v = !!fnKaynak(f); ok('function ' + f, v); if (!v) eksik.push(f); }
ok('function alarmOneriUygula (tek dokunusla doldurma)', !!fnKaynak('alarmOneriUygula'));
if (eksik.length) { console.log('\n  Eksik: ' + eksik.join(', ')); console.log('\nPASS=' + pass + '  FAIL=' + fail); process.exit(1); }

const gun = n => { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); };

function kur(gecmis, alarmMap) {
  const ctx = {
    console, Math, Date, JSON, Array, Object, Number, String, isNaN, Set, parseFloat,
    _gecmisCache: gecmis,
    tl: v => Number(v).toFixed(2).replace('.', ',') + ' ₺',
    lcIcon: () => '<svg></svg>',
    fiyatlariTemizle: mf => ({ gecerli: (mf || []).filter(f => f && f.fiyat != null), gizlenen: [] }),
    enDusukFiyat: u => { const a = (u.market_fiyatlari || []).map(f => f.fiyat).filter(x => x > 0); return a.length ? Math.min.apply(null, a) : null; },
  };
  ctx.Map = Map;
  ctx.window = { pazarAlarmMap: alarmMap || new Map() };
  vm.createContext(ctx);
  const seriCache = APP.match(/let _seriCache[^\n]*\n/);
  vm.runInContext([
    seriCache ? seriCache[0] : '',
    fnKaynak('otuzGunlukSeri'),
    fnKaynak('otuzGunMinFiyat'), fnKaynak('alarmOnerisi'), fnKaynak('alarmOneriHTML'),
    fnKaynak('fiyatAlarmiBlogu'),
  ].join('\n'), ctx);
  return ctx;
}
const calis = (ctx, i) => vm.runInContext(i, ctx);
const U = (sid, bugun) => ({ _sid: sid, ad: 'X', market_fiyatlari: [{ market: 'bim', fiyat: bugun }] });

// seri: 10 gun 100, 20 gun 60  -> 30 gun min = 60
const GECMIS = { a: [{ t: gun(60), m: 'bim', f: 100 }, { t: gun(20), m: 'bim', f: 60 }] };

console.log('\n=== 1. otuzGunMinFiyat = GERCEK 30 GUN MINIMUMU ===');
{
  const ctx = kur(GECMIS);
  ok('min 60', calis(ctx, 'otuzGunMinFiyat("a")') === 60, String(calis(ctx, 'otuzGunMinFiyat("a")')));
  ok('  seri minimumuyla BIREBIR ayni',
     calis(ctx, 'otuzGunMinFiyat("a") === Math.min.apply(null, otuzGunlukSeri("a"))'), '');
  ok('gecmis yok -> null', calis(kur({}), 'otuzGunMinFiyat("a")') === null);
  ok('null sid -> null', calis(kur({}), 'otuzGunMinFiyat(null)') === null);
}

console.log('\n=== 2. alarmOnerisi ===');
{
  const ctx = kur(GECMIS);
  const r = calis(ctx, 'alarmOnerisi(' + JSON.stringify(U('a', 90)) + ')');
  ok('guncel 90, 30g min 60 -> oneri 60', r && r.deger === 60, JSON.stringify(r));
  ok('  keyfi %5 (85,50) DEGIL', !r || r.deger !== 85.5, JSON.stringify(r));
}
{
  const ctx = kur(GECMIS);
  ok('guncel zaten 30g minimumda -> oneri YOK', calis(ctx, 'alarmOnerisi(' + JSON.stringify(U('a', 60)) + ')') === null);
  ok('guncel minimumun ALTINDA -> oneri YOK', calis(ctx, 'alarmOnerisi(' + JSON.stringify(U('a', 55)) + ')') === null);
}
ok('gecmisi olmayan urun -> oneri YOK', calis(kur({}), 'alarmOnerisi(' + JSON.stringify(U('a', 90)) + ')') === null);
ok('bugunku fiyat yok -> oneri YOK', calis(kur(GECMIS), 'alarmOnerisi({"_sid":"a","market_fiyatlari":[]})') === null);

console.log('\n=== 3. fiyatAlarmiBlogu: ONERI + ELLE GIRIS ===');
{
  const ctx = kur(GECMIS);
  const h = calis(ctx, 'fiyatAlarmiBlogu(' + JSON.stringify(U('a', 90)) + ')');
  const dz = h.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  ok('oneri cumlesi var ("son ay ... indi")', /son ay/i.test(dz) && /indi/i.test(dz), dz.slice(0, 200));
  ok('  GERCEK rakam yaziliyor (60,00 ₺)', /60,00 ₺/.test(dz), dz.slice(0, 200));
  ok('input GERCEK 30g minimumla dolu geliyor', /value="60"/.test(h) || /value="60.00"/.test(h), (h.match(/value="[^"]*"/) || [''])[0]);
  ok('  eski keyfi %5 dolgusu (85.50) kalmadi', !/value="85\.5/.test(h), (h.match(/value="[^"]*"/) || [''])[0]);
  ok('tek dokunusla doldurma butonu var', /alarmOneriUygula/.test(h), '');
  ok('ELLE GIRIS hala mumkun (input readonly/disabled degil)', !/readonly/.test(h) && !/disabled/.test(h), '');
  ok('  input type=number duruyor', /type="number"/.test(h), '');
  ok('"Alarm Kur" butonu duruyor', /alarm-kur-btn/.test(h) && /fiyatAlarmKur/.test(h), '');
}
{
  // gecmisi olmayan urun: MEVCUT akis aynen kalir
  const ctx = kur({});
  const h = calis(ctx, 'fiyatAlarmiBlogu(' + JSON.stringify(U('a', 90)) + ')');
  ok('gecmis yoksa oneri cumlesi YOK', !/son ay/i.test(h.replace(/<[^>]+>/g, ' ')), h.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 160));
  ok('  mevcut alarm kutusu yine ciziliyor', /alarm-box/.test(h) && /alarm-input/.test(h), '');
}
{
  // aktif alarm varken oneri gosterilmez
  const ctx = kur(GECMIS, new Map([['a', 70]]));
  const h = calis(ctx, 'fiyatAlarmiBlogu(' + JSON.stringify(U('a', 90)) + ')');
  ok('aktif alarm varken oneri YOK', !/alarmOneriUygula/.test(h), '');
  ok('  "Kaldir" akisi bozulmadi', /fiyatAlarmKaldir/.test(h), '');
}

console.log('\n=== 4. PROFIL ALARM LISTESINDE HEDEFE UZAKLIK (zaten vardi — regresyon) ===');
{
  const p = fnKaynak('profilAlarmlarHTML') || '';
  ok('"uzakta" ifadesi duruyor', /uzakta/.test(p), '');
  ok('  fark tl() ile hesaplaniyor (guncel - hedef)', /guncel - hedef/.test(p), '');
  ok('  hedefe ulasan alarm ayri gosteriliyor', /Hedefe ulaştı/.test(p), '');
}

console.log('\n=== 5. TASARIM ===');
{
  const k = (CSS.match(/[^\n{}]*\.alarm-oneri[^{}]*\{[^}]*\}/g) || []).join('\n');
  ok('.alarm-oneri* kurallari var', k.length > 30, 'uzunluk=' + k.length);
  ok('AMBER yok', !/#(FFFBEB|FDE68A|D97706|92400E|B45309)/i.test(k), k.slice(0, 200));
  ok('KIRMIZI yok', !/#(DC2626|EF4444|B91C1C)/i.test(k), k.slice(0, 200));
  const yeni = (k.match(/#[0-9A-Fa-f]{6}/g) || []).filter(c => !/^#(DCFCE7|065F46|ECFDF5|D1FAE5|059669|6EE7B7)$/i.test(c));
  ok('yeni renk sabiti getirilmedi', yeni.length === 0, yeni.join(','));
  ok('urun adindan/fiyattan kucuk (<=13px)', /font-size:\s*(1[0-3])px|font-size:\s*\.[0-8]/.test(k), k.slice(0, 200));
}

console.log('\nPASS=' + pass + '  FAIL=' + fail);
process.exit(fail ? 1 : 0);
