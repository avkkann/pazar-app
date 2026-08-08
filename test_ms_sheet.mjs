// msSheet (Marketleri Karsilastir) — durust toplam.
// Sorun: markette OLMAYAN urun icin 0 eklenip toplam "tam toplam" gibi gosteriliyordu;
// 2 urunu olan market, 4 urunu olan marketten ucuz gorunuyordu.
// app.js'ten fonksiyon KAYNAGINI cikarip vm'de calistirir — mantik kopyalanmaz.
import fs from 'fs';
import vm from 'vm';

const APP = fs.readFileSync('app.js', 'utf8');
const HTML = fs.readFileSync('index.html', 'utf8');
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

const GEREKEN = ['msMarketOzetleri', 'msMarketMetaHTML', 'msSecimKapsami'];
console.log('\n=== 0. YAPI ===');
const eksikFn = [];
for (const f of GEREKEN) { const v = !!fnKaynak(f); ok('function ' + f, v); if (!v) eksikFn.push(f); }
if (eksikFn.length) { console.log('\n  Eksik: ' + eksikFn.join(', ')); console.log('\nPASS=' + pass + '  FAIL=' + fail); process.exit(1); }

function kur(sepet) {
  const ctx = {
    console, Math, JSON, Array, Object, Number, String, isNaN, Set,
    sepet,
    MARKET_NAMES: { a101: 'A101', bim: 'BİM', migros: 'Migros', sok: 'ŞOK', carrefour: 'CarrefourSA' },
    MARKET_SIRALIYE: {},
    tl: v => Number(v).toFixed(2).replace('.', ',') + ' ₺',
  };
  vm.createContext(ctx);
  vm.runInContext(GEREKEN.map(fnKaynak).join('\n'), ctx);
  return ctx;
}
const calis = (ctx, i) => vm.runInContext(i, ctx);
const U = (id, fiyatlar) => ({ _id: id, _sid: id, ad: id, market_fiyatlari: Object.entries(fiyatlar).map(([m, f]) => ({ market: m, fiyat: f })) });

// 4 urunluk sepet. bim hepsini satiyor; migros SADECE 2 tanesini (ve ucuz).
const SEPET = [
  U('a', { bim: 100, migros: 40 }),
  U('b', { bim: 100, migros: 40 }),
  U('c', { bim: 100 }),
  U('d', { bim: 100 }),
];

console.log('\n=== 1. msMarketOzetleri: EKSIK URUN GORULUYOR ===');
{
  const r = calis(kur(SEPET), 'msMarketOzetleri(["bim","migros"])');
  const bim = r.find(x => x.key === 'bim'), mig = r.find(x => x.key === 'migros');
  ok('bim adet=4 eksik=0', bim.adet === 4 && bim.eksik === 0, JSON.stringify(bim));
  ok('bim minToplam=400', bim.minToplam === 400, JSON.stringify(bim));
  ok('migros adet=2', mig.adet === 2, JSON.stringify(mig));
  ok('migros EKSIK=2 (alan var, hesaplaniyor)', mig.eksik === 2, JSON.stringify(mig));
  ok('migros minToplam=80 (olmayan urun BASKA marketten DOLDURULMADI)', mig.minToplam === 80, JSON.stringify(mig));
  ok('  yani 80 + bim fiyatlari (280) DEGIL', mig.minToplam !== 280 && mig.minToplam !== 180, JSON.stringify(mig));
  ok('sepetToplam alani var (kac urunden)', mig.sepetToplam === 4, JSON.stringify(mig));
}
{
  const r = calis(kur([]), 'msMarketOzetleri(["bim"])');
  ok('bos sepet -> patlamiyor', Array.isArray(r) && r[0].adet === 0 && r[0].eksik === 0, JSON.stringify(r));
}

console.log('\n=== 2. msMarketMetaHTML: EKSIK ACIKCA YAZILIYOR ===');
{
  const ctx = kur(SEPET);
  const r = calis(ctx, 'msMarketOzetleri(["bim","migros"])');
  const hBim = calis(ctx, 'msMarketMetaHTML(' + JSON.stringify(r.find(x => x.key === 'bim')) + ')');
  const hMig = calis(ctx, 'msMarketMetaHTML(' + JSON.stringify(r.find(x => x.key === 'migros')) + ')');
  const dz = h => h.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  ok('eksigi olan markette "2 ürün yok" yaziyor', /2 ürün yok/.test(dz(hMig)), dz(hMig));
  ok('  tutarin eksik oldugu belirtiliyor', /eksik|olmadan|hariç/i.test(dz(hMig)), dz(hMig));
  ok('tam kapsayan markette "yok" UYARISI YOK', !/ürün yok/.test(dz(hBim)), dz(hBim));
  ok('tam kapsayanda tutar normal yaziliyor', /400,00 ₺/.test(dz(hBim)), dz(hBim));
  ok('mevcut tasarim dili: "N ürün · TUTAR" bicimi korundu', /^4 ürün · 400,00 ₺/.test(dz(hBim)), dz(hBim));
  ok('YENI bilesen prefixi uydurulmadi (ms- ailesinde kaldi)', !/class="(?!ms-)[a-z]/.test(hMig), hMig);
}

console.log('\n=== 3. msSecimKapsami: ALT TOPLAM DA DURUST ===');
{
  const ctx = kur(SEPET);
  const tek = calis(ctx, 'msSecimKapsami(["migros"])');
  ok('sadece migros secili -> kapsanan=2, eksik=2', tek.kapsanan === 2 && tek.eksik === 2, JSON.stringify(tek));
  ok('  tutar=80 (eksikler 0 ile SISIRILMEDI, ama tutar da uydurulmadi)', tek.tutar === 80, JSON.stringify(tek));
  const ikisi = calis(ctx, 'msSecimKapsami(["bim","migros"])');
  ok('ikisi secili -> kapsanan=4, eksik=0', ikisi.kapsanan === 4 && ikisi.eksik === 0, JSON.stringify(ikisi));
  ok('  tutar=280 (her urun secililerin EN UCUZU: 40+40+100+100)', ikisi.tutar === 280, JSON.stringify(ikisi));
  const hic = calis(ctx, 'msSecimKapsami([])');
  ok('hicbiri secili degil -> kapsanan=0 eksik=4', hic.kapsanan === 0 && hic.eksik === 4, JSON.stringify(hic));
  ok('bos sepet -> eksik=0, patlamiyor', (() => { const r = calis(kur([]), 'msSecimKapsami(["bim"])'); return r.eksik === 0 && r.kapsanan === 0; })());
}

console.log('\n=== 4. URETIM KODU BU FONKSIYONLARI KULLANIYOR ===');
{
  const ac = fnKaynak('msSheetAc') || '';
  ok('msSheetAc msMarketOzetleri kullaniyor', /msMarketOzetleri\s*\(/.test(ac), '');
  ok('msSheetAc icinde ESKI sessiz "0 ekle" kalmadi', !/\?\s*f\.fiyat\s*:\s*0/.test(ac), ac.split('\n').filter(l => /: 0/.test(l)).join(' | '));
  ok('satir metasi msMarketMetaHTML ile ciziliyor', /msMarketMetaHTML\s*\(/.test(ac), '');
  const g = fnKaynak('msSheetGuncelle') || '';
  ok('msSheetGuncelle msSecimKapsami kullaniyor', /msSecimKapsami\s*\(/.test(g), '');
  ok('msSheetGuncelle eksik uyarisini yaziyor', /msSheetEksik/.test(g), '');
}

console.log('\n=== 5. DOM + CSS: EKRANIN KENDI DILI ===');
{
  ok('#msSheetEksik footer\'da var', /id="msSheetEksik"/.test(HTML), '');
  const f = HTML.slice(HTML.indexOf('ms-sheet-footer'), HTML.indexOf('ms-sheet-footer') + 500);
  ok('  footer icinde (Hesapla butonunun cevresinde)', /msSheetEksik/.test(f), f.replace(/\s+/g, ' ').slice(0, 220));
  const k = (CSS.match(/[^\n{}]*\.ms-(meta-eksik|sheet-eksik)[^{}]*\{[^}]*\}/g) || []).join('\n');
  ok('CSS kurallari var', k.length > 30, 'uzunluk=' + k.length);
  ok('KIRMIZI kullanilmadi (uygulamanin dili amber)', !/#(DC2626|dc2626|EF4444|ef4444|B91C1C|FF0000)/i.test(k), k.slice(0, 200));
  ok('mevcut amber tonu (B45309/D97706/92400E)', /#(B45309|D97706|92400E)/i.test(k), k.slice(0, 200));
  ok('yeni palet getirilmedi', (k.match(/#[0-9A-Fa-f]{6}/g) || []).every(c => /^#(B45309|D97706|92400E|888888|1a1a1a)$/i.test(c)), (k.match(/#[0-9A-Fa-f]{6}/g) || []).join(','));
}

console.log('\nPASS=' + pass + '  FAIL=' + fail);
process.exit(fail ? 1 : 0);
