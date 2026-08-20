// Hakmar + gercek market filtresi testi.
// app.js'ten fonksiyon KAYNAGINI cikarip vm'de calistirir -- kopya mantik degil.
// Kullanim: node test_hakmar.mjs [veri.json]   (varsayilan data/urunler_meyve.json)
import fs from 'fs';
import vm from 'vm';

const APP  = fs.readFileSync('app.js', 'utf8');
const HTML = fs.readFileSync('index.html', 'utf8');
const CSS  = fs.readFileSync('style.css', 'utf8');
const VERI_YOL = process.argv[2] || 'data/urunler_meyve.json';

let pass = 0, fail = 0;
const ok = (ad, kosul, detay = '') => {
  if (kosul) { pass++; console.log('  PASS  ' + ad); }
  else { fail++; console.log('  FAIL  ' + ad + (detay ? '  -> ' + detay : '')); }
};

function fnKaynak(ad) {
  const bas = APP.indexOf('function ' + ad + '(');
  if (bas < 0) throw new Error('bulunamadi: ' + ad);
  let derinlik = 0;
  for (let j = APP.indexOf('{', bas); j < APP.length; j++) {
    const c = APP[j];
    if (c === '{') derinlik++;
    else if (c === '}') { derinlik--; if (derinlik === 0) return APP.slice(bas, j + 1); }
  }
  throw new Error('kapanmadi: ' + ad);
}
function objKaynak(ad) {
  const b = APP.indexOf('const ' + ad + ' = {');
  if (b < 0) throw new Error('bulunamadi: ' + ad);
  return APP.slice(b, APP.indexOf('};', b) + 2);
}

const pills = [...HTML.matchAll(/data-market="([^"]+)"/g)].map(m => m[1]);
const MARKET_NAMES = new Function('return ' + objKaynak('MARKET_NAMES').replace('const MARKET_NAMES = ', '').replace(/;$/, ''))();
const PAGE_SIZE = 48;

function domKur() {
  const el = {};
  const yap = (id) => (el[id] = el[id] || { textContent: '', innerHTML: '' });
  const pillNodes = pills.map(m => ({
    dataset: { market: m }, _cls: new Set(), style: {},
    classList: {
      toggle(c, v) { v ? this._o._cls.add(c) : this._o._cls.delete(c); },
      remove(c) { this._o._cls.delete(c); },
      contains(c) { return this._o._cls.has(c); }
    }
  }));
  pillNodes.forEach(n => { n.classList._o = n; });
  return { el, pillNodes, document: {
    getElementById: (id) => yap(id),
    querySelectorAll: (sel) => (sel === '[data-market]' ? pillNodes : []),
    querySelector: () => null } };
}

function calistir(urunlerVeri, aktifMarketler, altKat = 'tumu', arama = '') {
  const dom = domKur();
  const win = { yuklenenUrunler: urunlerVeri, aktifMarketler, _aktifAltKat: altKat,
                _catAramaTermi: arama, _catSiralama: 'populer' };
  const ctx = {
  _kacir: (s) => (s == null ? '' : String(s)), window: win, document: dom.document, console,
    sepet: [], currentKategori: 'meyve', currentSayfa: 1, toplamSayfa: 1, urunler: [], PAGE_SIZE,
    MARKET_NAMES,
    popScore: () => 0, birimFiyatHesapla: () => null, lcIcon: () => '',
    // renderUrunler birim-fiyat vurgusu icin bunu cagiriyor; bu testin konusu degil.
    enIyiBirimIdleri: () => new Set(),
    cardHTML: (u) => '<div class="product-card">' + u.ad + '</div>' };
  vm.createContext(ctx);
  vm.runInContext(fnKaynak('renderUrunler') + '\n' + fnKaynak('uygulaCatFiltre') + '\nuygulaCatFiltre();', ctx);
  return { pillNodes: dom.pillNodes, sayac: dom.el.countNum.textContent, listeHTML: dom.el.productList.innerHTML };
}

const veri = JSON.parse(fs.readFileSync(VERI_YOL, 'utf8'));
const sayVeri = (m) => veri.filter(u => (u.market_fiyatlari || []).some(f => f.market === m)).length;
const TUM_MKT = ['a101', 'bim', 'migros', 'carrefour', 'sok', 'tarim_kredi', 'hakmar'];
console.log('\nVERI: ' + VERI_YOL + '  (' + veri.length + ' urun)');
console.log('  veriden beklenen:', Object.fromEntries(TUM_MKT.map(m => [m, sayVeri(m)])));

console.log('\n=== IS 1: hakmar 5 eksik yerde ===');
ok('index.html filtre cubugunda data-market="hakmar" var', pills.includes('hakmar'), 'pills=' + JSON.stringify(pills));
ok('hakmar pill tarim_kredi den SONRA', pills.indexOf('hakmar') === pills.indexOf('tarim_kredi') + 1, 'pills=' + JSON.stringify(pills));
ok('filtre cubugunda 7 market + Tumu = 8 pill', pills.length === 8, 'adet=' + pills.length);
ok('MARKET_SIRALIYE hakmar iceriyor', /hakmar\s*:/.test(objKaynak('MARKET_SIRALIYE')), objKaynak('MARKET_SIRALIYE').replace(/\s+/g, ' '));
ok('_FG_MKT_AD hakmar iceriyor', /hakmar\s*:/.test(objKaynak('_FG_MKT_AD')), objKaynak('_FG_MKT_AD').replace(/\s+/g, ' '));
const mfrom = objKaynak('MFROM');
ok('MFROM hakmar iceriyor', /hakmar\s*:/.test(mfrom), mfrom.replace(/\s+/g, ' '));
ok('MFROM eki Hakmar-dan (Hakmar-den DEGIL)', /hakmar\s*:\s*"Hakmar'dan"/.test(mfrom), mfrom.replace(/\s+/g, ' '));
const metaDesc = (HTML.match(/<meta name="description" content="([^"]*)"/) || [])[1] || '';
const onboard  = (HTML.match(/<p>A101[^<]*<\/p>/) || [''])[0];
const MKT_AD_RE = /A101|BİM|Migros|CarrefourSA|ŞOK|Tarım Kredi|Hakmar/g;
// DEGISTI (2026-08-17): bu iki iddia eskiden meta description'in yedi market
// adini TEK TEK saymasini sart kosuyordu. Aciklama 196 karakterdi ve arama
// sonucunda kesiliyordu; liste cikarildi, yerine ne ise yaradigi yazildi.
// Korunmasi gereken degismez sey "Hakmar kullaniciya 7. zincir olarak
// gosteriliyor" — onu asagidaki onboarding iddialari zaten kanitliyor.
// Aciklamada listenin OLMAMASI artik kasitli, o yuzden tersi dogrulaniyor.
ok('meta description market adi LISTELEMIYOR (kasitli, 155 kr siniri)',
  (metaDesc.match(MKT_AD_RE) || []).length === 0,
  'sayilan=' + (metaDesc.match(MKT_AD_RE) || []).length + ' -> ' + metaDesc);
ok('  yerine "7 market" sayisiyla anlatiyor', /7 market/.test(metaDesc), metaDesc);
ok('onboarding metni Hakmar sayiyor', /Hakmar/.test(onboard), onboard);
ok('onboarding 7 market adi sayiyor', (onboard.match(MKT_AD_RE) || []).length === 7, 'sayilan=' + (onboard.match(MKT_AD_RE) || []).length);

console.log('\n=== IS 2: filtre gercekten daraltiyor ===');
for (const m of TUM_MKT) {
  const n = sayVeri(m);
  const r = calistir(veri, [m]);
  const kart = (r.listeHTML.match(/class="product-card"/g) || []).length;
  ok(m + ': sayac=' + n, r.sayac === n, 'sayac=' + r.sayac);
  ok(m + ': ' + Math.min(n, PAGE_SIZE) + ' kart cizildi (PAGE_SIZE=' + PAGE_SIZE + ')', kart === Math.min(n, PAGE_SIZE), 'kart=' + kart);
}
{
  const r = calistir(veri, []);
  ok('filtresiz sayac=' + veri.length, r.sayac === veri.length, 'sayac=' + r.sayac);
}
{
  const r = calistir(veri, ['hakmar', 'a101']);
  const bek = veri.filter(u => (u.market_fiyatlari || []).some(f => f.market === 'hakmar' || f.market === 'a101')).length;
  ok('hakmar+a101 birlesim=' + bek, r.sayac === bek, 'sayac=' + r.sayac);
}
{
  const r = calistir(veri, []);
  const hp = r.pillNodes.find(p => p.dataset.market === 'hakmar');
  ok('hakmar pill disabled DEGIL', !!hp && !hp._cls.has('disabled'), hp ? [...hp._cls].join(',') : 'pill yok');
  ok('hakmar pill pointerEvents engelli degil', !!hp && hp.style.pointerEvents !== 'none', hp && String(hp.style.pointerEvents));
}
{
  const r = calistir(veri, ['hakmar'], 'Meyve', 'karpuz');
  const bek = veri.filter(u => (u.ana_kategori || '').trim() === 'Meyve' &&
      (u.ad || '').toLowerCase().includes('karpuz') &&
      (u.market_fiyatlari || []).some(f => f.market === 'hakmar')).length;
  ok('hakmar + altKat=Meyve + arama=karpuz -> ' + bek, r.sayac === bek, 'sayac=' + r.sayac);
}
{
  const r = calistir(veri, ['hakmar'], 'tumu', 'zzzyokboyleurun');
  ok('sifir sonucta sayac 0', r.sayac === 0, 'sayac=' + r.sayac);
  ok('sifir sonucta MEVCUT .empty-state kullanildi', /class="empty-state"/.test(r.listeHTML));
  ok('bos durum metninde market adi Hakmar geciyor', /Hakmar/.test(r.listeHTML), r.listeHTML.replace(/\s+/g, ' ').slice(0, 300));
  ok('yeni bos ekran sinifi UYDURULMADI', !/empty-market|empty-state-market|no-market/.test(r.listeHTML));
}

console.log('\n=== ELDE TUTULAN DAVRANIS ===');
ok('cardHTML Secili-markette-yok dali DURUYOR (favori+arama cagiriyor)', /kart-market-yok">Seçili markette yok/.test(APP));
ok('.kart-market-yok CSS duruyor', /\.kart-market-yok \{/.test(CSS));

console.log('\n=== CSS: yatay tasma ===');
ok('.filter-wrap overflow-x:auto', /\.filter-wrap \{[^}]*overflow-x:\s*auto/s.test(CSS));
ok('.filter-pill flex-shrink:0', /\.filter-pill \{[^}]*flex-shrink:\s*0/s.test(CSS));
ok('.filter-pill white-space:nowrap', /\.filter-pill \{[^}]*white-space:\s*nowrap/s.test(CSS));

console.log('\nPASS=' + pass + '  FAIL=' + fail);
process.exit(fail ? 1 : 0);
