// ANA SAYFA ONCEDEN HESAPLAMA.
// Serit icerikleri build zamaninda uretilip data/anasayfa.json'a yaziliyor.
// KRITIK DEGISMEZ: onceden hesaplanmis havuzdan secilen liste, istemcide
// bastan hesaplananla BIREBIR AYNI olmali — sehir seciliyken de.
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
const GEREKEN = ['zamHavuzu', 'zamSecHavuzdan', 'zamAdaylari', 'zamMarketDurumu'];
let eksik = 0;
for (const f of GEREKEN) { const v = !!fnKaynak(f); ok('function ' + f, v); if (!v) eksik++; }
ok('scripts/anasayfa-uret.mjs var', fs.existsSync('scripts/anasayfa-uret.mjs'));
if (eksik) { console.log('\nPASS=' + pass + '  FAIL=' + fail); process.exit(1); }

const gun = n => { const d = new Date(); d.setDate(d.getDate() - n);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
const H = (market, ciftler) => ciftler.map(([n, f]) => ({ m: market, t: gun(n), f }));

function kur(gecmis, urunler = [], opts = {}) {
  const ctx = {
    console, Math, Date, JSON, Array, Object, Number, String, isNaN, Set, Map, parseFloat,
    _gecmisCache: gecmis, catCache: { test: urunler }, _puanCache: new Map(),
    MARKET_NAMES: { a101: 'A101', bim: 'BIM', migros: 'Migros', carrefour: 'CarrefourSA' },
    tl: v => Number(v).toFixed(2) + ' TL', lcIcon: () => '',
    fiyatlariTemizle: mf => ({ gecerli: (mf || []).filter(f => f && f.fiyat != null), gizlenen: [] }),
    marketVarMi: m => (opts.iller ? opts.iller.includes(m) : true),
    ustKategori: k => (k === 'Meyve' ? 'meyve' : k === 'Sebze' ? 'sebze' : 'gida'),
    navigator: {}, window: {},
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  const sabitler = ['ZAM_ESIK', 'ZAM_MAX', 'ZAM_MIN', 'ZAM_MIN_KAYIT', 'ZAM_MARKA_MAX', 'ZAM_KAT_MAX']
    .map(s => { const m = APP.match(new RegExp('const ' + s + '\\s*=\\s*([0-9.]+)')); return m ? 'const ' + s + ' = ' + m[1] + ';' : ''; })
    .filter(Boolean).join('\n');
  const seriCache = APP.match(/let _seriCache[^\n]*\n/);
  vm.runInContext([
    sabitler, seriCache ? seriCache[0] : '',
    fnKaynak('_yerelGunISO'), fnKaynak('_salinimVarSeri'), fnKaynak('_seriKur'),
    fnKaynak('otuzGunlukSeri'), fnKaynak('otuzGunlukSeriTemiz'), fnKaynak('_zamGunISO'),
    fnKaynak('zamOlcutu'), fnKaynak('zamMarketSerisi'), fnKaynak('zamMarketArtisi'), fnKaynak('zamSalinimVar'),
    fnKaynak('_zamMarka'), fnKaynak('zamHavuzu'), fnKaynak('zamSecHavuzdan'),
    fnKaynak('zamAdaylari'), fnKaynak('zamMarketDurumu'),
  ].filter(Boolean).join('\n'), ctx);
  return ctx;
}
const calis = (ctx, i) => vm.runInContext(i, ctx);
const ozet = l => l.map(x => x.u._sid + '|' + x.market + '|' + Math.round(x.artis)).join(' , ');

// ── Sahte veri: 14 urun, farkli marka/kategori (cesitlilik kurali tetiklenmesin)
const G = {}, URUNLER = [];
for (let i = 0; i < 14; i++) {
  const sid = 'u' + i;
  // carrefour basamakli zam, migros sabit
  G[sid] = [...H('carrefour', [[60, 100], [40, 100 + i], [20, 200 + i * 3]]),
            ...H('migros', [[60, 90], [40, 91], [20, 92]])];
  URUNLER.push({ _sid: sid, _id: sid, ad: 'Marka' + i + ' Urun ' + i, ana_kategori: 'Kat' + i,
    en_dusuk_fiyat: 92, market_fiyatlari: [{ market: 'carrefour', fiyat: 200 + i * 3 }, { market: 'migros', fiyat: 92 }] });
}
// salinimli bir urun (elenmeli)
G['s1'] = H('carrefour', [[60, 20], [25, 100], [15, 30], [5, 100]]);
URUNLER.push({ _sid: 's1', _id: 's1', ad: 'Salinim Urun', ana_kategori: 'KatS',
  en_dusuk_fiyat: 100, market_fiyatlari: [{ market: 'carrefour', fiyat: 100 }] });

console.log('\n=== 1. DEGISMEZ: zamAdaylari === zamSecHavuzdan(zamHavuzu()) ===');
let c = kur(G, URUNLER);
const canli = calis(c, 'zamAdaylari()');
const havuzdan = calis(c, 'zamSecHavuzdan(zamHavuzu())');
ok('liste uzunlugu ayni', canli.length === havuzdan.length, canli.length + ' vs ' + havuzdan.length);
ok('liste BIREBIR ayni', ozet(canli) === ozet(havuzdan), '\n      canli   : ' + ozet(canli) + '\n      havuzdan: ' + ozet(havuzdan));
ok('liste bos degil (test anlamli)', canli.length > 0, canli.length);

console.log('\n=== 2. HAVUZ SEHIRDEN BAGIMSIZ, SECIM SEHRE BAGLI ===');
const hepsi = kur(G, URUNLER);
const sadeceMigros = kur(G, URUNLER, { iller: ['migros'] });
const h1 = calis(hepsi, 'JSON.stringify(zamHavuzu().map(x=>x.u._sid).sort())');
const h2 = calis(sadeceMigros, 'JSON.stringify(zamHavuzu().map(x=>x.u._sid).sort())');
ok('havuz sehir filtresinden ETKILENMIYOR', h1 === h2, '\n      hepsi: ' + h1 + '\n      migros: ' + h2);
const s1 = calis(hepsi, 'zamAdaylari()');
const s2 = calis(sadeceMigros, 'zamAdaylari()');
ok('secim sehre gore DEGISIYOR (carrefour disarida)', s1.length !== s2.length || ozet(s1) !== ozet(s2),
  ozet(s1) + ' vs ' + ozet(s2));

console.log('\n=== 3. SEHIR SECILIYKEN havuzdan secim = canli hesap ===');
for (const il of [['migros'], ['carrefour'], ['carrefour', 'migros'], ['bim']]) {
  const ctx = kur(G, URUNLER, { iller: il });
  const a = calis(ctx, 'zamAdaylari()');
  const b = calis(ctx, 'zamSecHavuzdan(zamHavuzu())');
  ok('il=[' + il.join(',') + '] birebir ayni', ozet(a) === ozet(b),
    '\n      canli   : ' + ozet(a) + '\n      havuzdan: ' + ozet(b));
}

console.log('\n=== 4. HAVUZ SERILESTIRILEBILIR (JSON) ve ayni sonucu verir ===');
c = kur(G, URUNLER, { iller: ['carrefour'] });
const ham = calis(c, 'JSON.parse(JSON.stringify(zamHavuzu()))');
const jsonDan = calis(c, 'zamSecHavuzdan(' + JSON.stringify(calis(c, 'zamHavuzu()')) + ')');
ok('JSON turundan gecen havuz ayni listeyi veriyor',
  ozet(calis(c, 'zamAdaylari()')) === ozet(jsonDan),
  '\n      canli   : ' + ozet(calis(c, 'zamAdaylari()')) + '\n      json    : ' + ozet(jsonDan));
ok('havuz girdisi marketArtis tasiyor', ham.length > 0 && ham[0].marketArtis && typeof ham[0].marketArtis === 'object',
  JSON.stringify(ham[0] && Object.keys(ham[0])));
ok('havuz salinimliyi ICERMIYOR', !ham.some(x => x.u._sid === 's1'),
  JSON.stringify(ham.map(x => x.u._sid)));

console.log('\n=== 5. zamMarketDurumu havuzdan da calisiyor ===');
c = kur(G, URUNLER);
const u0 = URUNLER[0];
const d1 = calis(c, 'zamMarketDurumu(' + JSON.stringify(u0) + ')');
const hv = calis(c, 'zamHavuzu()').find(x => x.u._sid === u0._sid);
const d2 = calis(c, 'zamMarketDurumu(' + JSON.stringify(u0) + ',' + JSON.stringify(hv.marketArtis) + ')');
ok('gecmisten ve havuzdan AYNI durum', JSON.stringify(d1) === JSON.stringify(d2),
  '\n      gecmis: ' + JSON.stringify(d1) + '\n      havuz : ' + JSON.stringify(d2));
ok('zamli market tespit ediliyor', d1.zamli.length > 0, JSON.stringify(d1));

console.log('\n=== 6. GERIYE DUSUS ===');
ok('zamSecHavuzdan(null) bos dizi', JSON.stringify(calis(c, 'zamSecHavuzdan(null)')) === '[]');
ok('zamSecHavuzdan([]) bos dizi', JSON.stringify(calis(c, 'zamSecHavuzdan([])')) === '[]');
ok('bozuk girdi cokmuyor',
  JSON.stringify(calis(c, 'zamSecHavuzdan([{},{u:null},{u:{}, marketArtis:null}])')) === '[]');

console.log('\nPASS=' + pass + '  FAIL=' + fail);
process.exit(fail ? 1 : 0);
