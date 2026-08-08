// Ozellik 3: market bazinda gercek toplam + durust etiket + bolme onerisi.
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

const GEREKEN = ['marketToplamlari', 'sepetBolmeOnerisi', 'sepetMarketOzetiHTML'];
console.log('\n=== 0. YAPI ===');
const eksik = [];
for (const f of GEREKEN) { const v = !!fnKaynak(f); ok('function ' + f, v); if (!v) eksik.push(f); }
if (eksik.length) { console.log('\n  Eksik: ' + eksik.join(', ')); console.log('\nPASS=' + pass + '  FAIL=' + fail); process.exit(1); }

function kur(sepet) {
  const ctx = {
    console, Math, JSON, Array, Object, Number, String, isNaN, Set,
    sepet,
    MARKET_NAMES: { a101: 'A101', bim: 'BİM', migros: 'Migros', sok: 'ŞOK', carrefour: 'CarrefourSA' },
    tl: v => Number(v).toFixed(2).replace('.', ',') + ' ₺',
    tlHTML: v => '<span>' + Number(v).toFixed(2).replace('.', ',') + ' ₺</span>',
    lcIcon: () => '<svg></svg>',
    fiyatlariTemizle: mf => ({ gecerli: (mf || []).filter(f => f && f.fiyat != null), gizlenen: [] }),
  };
  vm.createContext(ctx);
  const esik = (APP.match(/const BOLME_MIN_KAZANC\s*=\s*(\d+)/) || [])[1] || '50';
  vm.runInContext([
    'const BOLME_MIN_KAZANC = ' + esik + ';',
    fnKaynak('_sepetMarketFiyati'),
    fnKaynak('marketToplamlari'), fnKaynak('sepetBolmeOnerisi'), fnKaynak('sepetMarketOzetiHTML'),
  ].join('\n'), ctx);
  return ctx;
}
const calis = (ctx, i) => vm.runInContext(i, ctx);

const U = (id, ad, fiyatlar) => ({ _id: id, ad, market_fiyatlari: Object.entries(fiyatlar).map(([m, f]) => ({ market: m, fiyat: f })) });

console.log('\n=== 1. marketToplamlari: GERCEK toplam + eksik urun ===');
{
  // bim 2 urun (100+200=300), 1 urun YOK ; a101 3 urun (110+210+50=370)
  const sepet = [U('x', 'X', { bim: 100, a101: 110 }), U('y', 'Y', { bim: 200, a101: 210 }), U('z', 'Z', { a101: 50 })];
  const r = calis(kur(sepet), 'marketToplamlari()');
  const bim = r.find(m => m.market === 'bim'), a101 = r.find(m => m.market === 'a101');
  ok('bim toplam 300 (eksik urun DAHIL EDILMEDI)', bim.toplam === 300, JSON.stringify(bim));
  ok('bim eksik=1', bim.eksik === 1, JSON.stringify(bim));
  ok('bim varOlan=2', bim.varOlan === 2, JSON.stringify(bim));
  ok('a101 toplam 370, eksik 0', a101.toplam === 370 && a101.eksik === 0, JSON.stringify(a101));
  ok('EKSIK urun baska marketin fiyatiyla DOLDURULMADI', bim.toplam !== 350 && bim.toplam !== 300 + 50, JSON.stringify(bim));
  ok('tam kapsayanlar once siralandi', r[0].eksik === 0, JSON.stringify(r.map(x => [x.market, x.eksik, x.toplam])));
}
{
  const sepet = [U('x', 'X', { bim: 100, a101: 110 }), U('y', 'Y', { bim: 200, a101: 210 })];
  const r = calis(kur(sepet), 'marketToplamlari()');
  ok('hepsi tam kapsiyorsa ucuzdan pahaliya', r[0].market === 'bim' && r[0].toplam === 300, JSON.stringify(r.map(x => [x.market, x.toplam])));
}
ok('bos sepet -> bos dizi', calis(kur([]), 'marketToplamlari()').length === 0);

console.log('\n=== 2. sepetBolmeOnerisi ===');
{
  // tek market en iyi: bim 300. iki market: bim(100)+a101(50)... kazanc kucuk
  const sepet = [U('x', 'X', { bim: 100, a101: 110 }), U('y', 'Y', { bim: 200, a101: 210 })];
  const r = calis(kur(sepet), 'sepetBolmeOnerisi()');
  ok('kazanc esik altinda -> oneri YOK', r.oner === false, JSON.stringify(r));
  ok('  tek market onerisi var (bim)', r.tekMarket && r.tekMarket.market === 'bim', JSON.stringify(r));
}
{
  // bim: 100 + 500 = 600 ; a101: 400 + 90 = 490 ; ikili: 100(bim)+90(a101)=190 -> kazanc 300
  const sepet = [U('x', 'X', { bim: 100, a101: 400 }), U('y', 'Y', { bim: 500, a101: 90 })];
  const r = calis(kur(sepet), 'sepetBolmeOnerisi()');
  ok('buyuk kazanc -> oneri VAR', r.oner === true, JSON.stringify(r));
  ok('  ikili toplam 190', r.ikili && r.ikili.toplam === 190, JSON.stringify(r.ikili));
  ok('  kazanc 300', Math.abs(r.kazanc - 300) < 0.01, JSON.stringify(r));
  ok('  ikili tam olarak 2 market', r.ikili && r.ikili.marketler.length === 2, JSON.stringify(r.ikili));
}
{
  const sepet = [U('x', 'X', { bim: 100, a101: 400, migros: 300 }), U('y', 'Y', { bim: 500, a101: 90, migros: 80 }), U('z', 'Z', { migros: 10, bim: 700 })];
  const r = calis(kur(sepet), 'sepetBolmeOnerisi()');
  ok('IKIDEN FAZLA markete bolme ONERILMEZ', !r.ikili || r.ikili.marketler.length <= 2, JSON.stringify(r.ikili));
}
ok('bos sepet -> oneri yok, patlamaz', (() => { const r = calis(kur([]), 'sepetBolmeOnerisi()'); return r && r.oner === false; })());

console.log('\n=== 3. HTML: durust etiket + eksik urun uyarisi ===');
{
  const sepet = [U('x', 'X', { bim: 100, a101: 110 }), U('y', 'Y', { bim: 200, a101: 210 }), U('z', 'Z', { a101: 50 })];
  const h = calis(kur(sepet), 'sepetMarketOzetiHTML()');
  const duz = h.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  ok('market toplamlari yaziliyor', /BİM/.test(duz) && /A101/.test(duz), duz.slice(0, 160));
  ok('eksik urun ACIKCA yaziliyor', /BİM.{0,40}1 ürün yok|1 ürün yok/.test(duz), duz.slice(0, 220));
  ok('eksik urun olan marketin toplaminin eksik oldugu belirtiliyor', /eksik|olmadan|hariç/i.test(duz), duz.slice(0, 260));
  ok('YENI ROZET/bilesen uydurulmadi', !/ms-market-row|cmp-mkt/.test(h), '');
}
{
  const sepet = [U('x', 'X', { bim: 100, a101: 400 }), U('y', 'Y', { bim: 500, a101: 90 })];
  const duz = calis(kur(sepet), 'sepetMarketOzetiHTML()').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  ok('kazanc buyukse bolme onerisi metni var', /iki market|bölersen|ayrı market/i.test(duz), duz.slice(0, 300));
  ok('  kazanc TL olarak yaziliyor', /₺/.test(duz), duz.slice(0, 300));
}
{
  const sepet = [U('x', 'X', { bim: 100, a101: 110 }), U('y', 'Y', { bim: 200, a101: 210 })];
  const duz = calis(kur(sepet), 'sepetMarketOzetiHTML()').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  ok('kazanc kucukse "tek markette almak mantikli" diyor', /tek market/i.test(duz), duz.slice(0, 300));
  ok('  ve market adi veriyor', /BİM/.test(duz), duz.slice(0, 300));
}
ok('bos sepet -> HTML bos', calis(kur([]), 'sepetMarketOzetiHTML()') === '');

console.log('\n=== 4. MEVCUT KARMA TOPLAM ETIKETI DURUSTLESTI ===');
{
  const rs = fnKaynak('renderSepet') || '';
  ok('"Toplam (en ucuz fiyatlar)" etiketi KALDIRILDI', !/Toplam \(en ucuz fiyatlar\)/.test(rs), '');
  ok('yeni etiket kac markete gidildigini soyluyor', /farklı markete giderek|markete giderek/.test(rs), rs.split('\n').filter(l => /listem-toplam-etiket/.test(l)).join(' | '));
  ok('renderSepet market ozetini ciziyor', /sepetMarketOzetiHTML\s*\(/.test(rs), '');
}

console.log('\n=== 5. CSS ===');
{
  const k = (CSS.match(/[^\n{}]*\.sepet-mkt[^{}]*\{[^}]*\}/g) || []).join('\n');
  ok('.sepet-mkt* kurallari var', k.length > 40, 'uzunluk=' + k.length);
  ok('KIRMIZI yok', !/#(DC2626|dc2626|EF4444|ef4444)/.test(k), k.slice(0, 200));
}

console.log('\nPASS=' + pass + '  FAIL=' + fail);
process.exit(fail ? 1 : 0);
