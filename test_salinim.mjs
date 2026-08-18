// SALINIM ELEMESI — zam seridi.
// ILKE: zam iddiasi "hic gorulmemis bir seviyeye cikti" demektir. Fiyat 30
// gunluk pencerede bir seviyeye AYRILIP GERI DONUYORSA, cikilan yer yeni bir
// seviye degil IKINCI KEZ ziyaret edilen eski seviyedir. Bu basamak degil
// salinimdir ve zam sayilmaz.
// TOLERANS = 0, secilmedi OLCULDU: "ayrilip geri donen" 34.919 noktanin
// %59,4'u TAM AYNI fiyata donuyor, bir sonraki kutu %4,6 (13x ucurum) ve bu
// ucurum "ayrildi" esigine %0-%20 arasinda tamamen duyarsiz. Gecmis saf
// change-log (47.104 ardisik ciftin 0'i ayni fiyat), fiyatlarin %84'u
// ,95/,00/,90/,50 ile bitiyor — yuvarlanacak kurus gurultusu yok.
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
ok('function zamSalinimVar', !!fnKaynak('zamSalinimVar'));
if (!fnKaynak('zamSalinimVar')) { console.log('\nPASS=' + pass + '  FAIL=' + fail); process.exit(1); }

const gun = n => { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); };
// [gunOnce, fiyat] -> gecmis kaydi
const H = (market, ciftler) => ciftler.map(([n, f]) => ({ m: market, t: gun(n), f }));

function kur(gecmis, urunler = [], opts = {}) {
  const ctx = {
    console, Math, Date, JSON, Array, Object, Number, String, isNaN, Set, Map,
    _gecmisCache: gecmis, catCache: { test: urunler },
    MARKET_NAMES: { a101: 'A101', bim: 'BIM', migros: 'Migros', carrefour: 'CarrefourSA' },
    tl: v => Number(v).toFixed(2) + ' TL', lcIcon: () => '',
    fiyatlariTemizle: mf => ({ gecerli: (mf || []).filter(f => f && f.fiyat != null), gizlenen: [] }),
    marketVarMi: m => (opts.yokMarket ? m !== opts.yokMarket : true),
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
    fnKaynak('_yerelGunISO'), fnKaynak('_salinimVarSeri'), fnKaynak('_seriKur'), fnKaynak('otuzGunlukSeri'), fnKaynak('otuzGunlukSeriTemiz'), fnKaynak('otuzGunMinFiyatTemiz'), fnKaynak('_zamGunISO'),
    fnKaynak('zamOlcutu'), fnKaynak('zamMarketSerisi'), fnKaynak('zamMarketArtisi'), fnKaynak('zamSalinimVar'),
    fnKaynak('zamOncekiZirve'), fnKaynak('_zamMarka'), fnKaynak('zamHavuzu'), fnKaynak('zamSecHavuzdan'), fnKaynak('zamAdaylari'),
  ].join('\n'), ctx);
  return ctx;
}
const calis = (ctx, i) => vm.runInContext(i, ctx);
const U = (sid, ad, market, bugun, kat) => ({
  _sid: sid, _id: sid, ad, ana_kategori: kat || 'Bakliyat',
  en_dusuk_fiyat: bugun, market_fiyatlari: [{ market, fiyat: bugun }],
});

// ══════════════════════════════════════════════════════════
console.log('\n=== 1. SALINIM TESPITI — yapisal ===');

// Lux vakasi: 27 -> 85,90 -> 28 -> 85,90 (85,90 iki AYRI blokta)
let c = kur({ lux: H('carrefour', [[60, 38], [45, 27], [25, 85.9], [15, 28], [5, 85.9]]) });
ok('zikzak salinim sayiliyor', calis(c, 'zamSalinimVar("lux","carrefour")') === 85.9,
  calis(c, 'zamSalinimVar("lux","carrefour")'));

// Barilla vakasi: 89,99 -> 169,95 (tek yonlu basamak, geri donus yok)
c = kur({ bar: H('carrefour', [[60, 88.99], [40, 89.99], [25, 169.95]]) });
ok('tek yonlu basamak salinim DEGIL', calis(c, 'zamSalinimVar("bar","carrefour")') === null,
  calis(c, 'zamSalinimVar("bar","carrefour")'));

// Yumos vakasi: 175,99 -> 300 (iki kademeli ama hep yukari)
c = kur({ yum: H('carrefour', [[60, 149], [40, 160], [25, 175.99], [10, 300]]) });
ok('cok kademeli ama hep yukari salinim DEGIL', calis(c, 'zamSalinimVar("yum","carrefour")') === null);

// Sprite vakasi: pencerede 60 -> 159, Haziran'daki 60 tekrari PENCERE DISINDA
c = kur({ spr: H('a101', [[78, 60], [59, 48], [50, 60], [28, 159]]) });
ok('pencere DISINDAKI tekrar salinim yapmiyor', calis(c, 'zamSalinimVar("spr","a101")') === null,
  calis(c, 'zamSalinimVar("spr","a101")'));

// Sadece dusus — geri donus yok
c = kur({ dus: H('migros', [[60, 200], [40, 180], [20, 100]]) });
ok('sadece dusus salinim DEGIL', calis(c, 'zamSalinimVar("dus","migros")') === null);

// Duz seri — tek blok
c = kur({ duz: H('bim', [[60, 50], [40, 50.0]]) });
ok('hic degismeyen seri salinim DEGIL', calis(c, 'zamSalinimVar("duz","bim")') === null);

// Ucuncu ziyaret de salinim
c = kur({ uc: H('carrefour', [[60, 10], [25, 20], [20, 10], [15, 20], [5, 10]]) });
ok('cok kez gidip gelme salinim', calis(c, 'zamSalinimVar("uc","carrefour")') !== null);

// Asagi salinim da salinim (indirip geri kaldirma)
c = kur({ ind: H('migros', [[60, 100], [25, 169.95], [15, 127.46], [5, 169.95]]) });
ok('kampanya inip geri cikmasi salinim', calis(c, 'zamSalinimVar("ind","migros")') === 169.95,
  calis(c, 'zamSalinimVar("ind","migros")'));

console.log('\n=== 2. SINIR DURUMLARI ===');
c = kur({ yok: H('migros', [[60, 10]]) });
ok('baska markette kayit yoksa null', calis(c, 'zamSalinimVar("yok","carrefour")') === null);
ok('bilinmeyen sid null', calis(c, 'zamSalinimVar("hicyok","migros")') === null);
ok('sid bos null', calis(c, 'zamSalinimVar("","migros")') === null);
ok('market bos null', calis(c, 'zamSalinimVar("yok","")') === null);
// pencere basinda fiyat bilinmiyorsa zamMarketSerisi zaten null donuyor
c = kur({ gec: H('migros', [[10, 50], [5, 60], [2, 50]]) });
ok('pencere basi bilinmiyorsa null (olcum yapilmiyor)', calis(c, 'zamSalinimVar("gec","migros")') === null);

console.log('\n=== 3. TOLERANS SIFIR — kurus farki AYNI seviye DEGIL ===');
c = kur({ kur: H('carrefour', [[60, 100], [25, 119.95], [15, 90], [5, 119.94]]) });
ok('1 kurus farkli donus salinim SAYILMIYOR', calis(c, 'zamSalinimVar("kur","carrefour")') === null,
  calis(c, 'zamSalinimVar("kur","carrefour")'));
c = kur({ tam: H('carrefour', [[60, 100], [25, 119.95], [15, 90], [5, 119.95]]) });
ok('tam ayni fiyata donus salinim', calis(c, 'zamSalinimVar("tam","carrefour")') === 119.95);

console.log('\n=== 4. ZAM LISTESINE ETKISI ===');
// salinimli urun listeye GIRMEZ
const gz = { z1: H('carrefour', [[60, 38], [45, 27], [25, 85.9], [15, 28], [5, 85.9]]) };
c = kur(gz, [U('z1', 'Lux Zigzag Pamuk', 'carrefour', 85.9)]);
let liste = calis(c, 'zamAdaylari()');
ok('salinimli urun listeye girmiyor', liste.length === 0, JSON.stringify(liste.map(x => x.ad)));

// basamakli urun GIRER
const gb = { b1: H('carrefour', [[60, 88.99], [40, 89.99], [25, 169.95]]) };
c = kur(gb, [U('b1', 'Barilla Lasagne', 'carrefour', 169.95)]);
liste = calis(c, 'zamAdaylari()');
ok('basamakli urun listede kaliyor', liste.length === 1 && liste[0].market === 'carrefour',
  JSON.stringify(liste.map(x => x.ad + '/' + x.market)));

// AYNI urunun bir marketi salinimli, digeri basamakli -> TEMIZ market temsil etsin
const gi = {
  i1: [...H('carrefour', [[60, 20], [25, 100], [15, 30], [5, 100]]),
       ...H('migros', [[60, 40], [40, 41], [25, 60]])],
};
c = kur(gi, [{ _sid: 'i1', _id: 'i1', ad: 'Cift Market Urun', ana_kategori: 'Bakliyat',
  en_dusuk_fiyat: 60, market_fiyatlari: [{ market: 'carrefour', fiyat: 100 }, { market: 'migros', fiyat: 60 }] }]);
liste = calis(c, 'zamAdaylari()');
ok('salinimli market elenip temiz market temsil ediyor',
  liste.length === 1 && liste[0].market === 'migros',
  JSON.stringify(liste.map(x => x.market + ' +%' + Math.round(x.artis))));
ok('temsil eden artis TEMIZ marketinki',
  liste.length === 1 && Math.round(liste[0].artis) === Math.round((60 - 41) / 41 * 100),
  liste.length ? Math.round(liste[0].artis) : '-');

// esik DUSURULMUYOR: salinimlilar elenince liste kisaliyor, yerine zayif aday alinmiyor
const gk = {};
const urunler = [];
for (let i = 0; i < 6; i++) {                       // 6 salinimli guclu aday
  gk['s' + i] = H('carrefour', [[60, 20], [25, 100], [15, 30], [5, 100]]);
  urunler.push(U('s' + i, 'Marka' + i + ' Salinim', 'carrefour', 100));
}
gk['t0'] = H('migros', [[60, 40], [40, 41], [25, 60]]);   // 1 temiz aday
urunler.push(U('t0', 'Temiz Urun', 'migros', 60));
gk['z0'] = H('bim', [[60, 100], [40, 101], [25, 105]]);   // esigin ALTINDA (%4)
urunler.push(U('z0', 'Zayif Urun', 'bim', 105));
c = kur(gk, urunler);
liste = calis(c, 'zamAdaylari()');
ok('salinimlilar elenince esik DUSURULMUYOR', liste.length === 1 && liste[0].ad === 'Temiz Urun',
  JSON.stringify(liste.map(x => x.ad)));

console.log('\n=== 5. GELECEK NOTU (depot_id ile dogrulama) ===');
const kaynak = fnKaynak('zamSalinimVar') || '';
const cevre = APP.slice(Math.max(0, APP.indexOf('function zamSalinimVar(') - 1800),
  APP.indexOf('function zamSalinimVar(') + kaynak.length);
ok('kodda depot_id notu var', /depot_id/.test(cevre));
ok('notta bunun GECICI yapisal kural oldugu yaziyor', /geçici|gecici|yapısal|yapisal/i.test(cevre));
ok('tolerans 0 gerekcesi kodda yazili', /toleran/i.test(cevre));

console.log('\nPASS=' + pass + '  FAIL=' + fail);
process.exit(fail ? 1 : 0);
