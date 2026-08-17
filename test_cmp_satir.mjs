// "Marketleri Karsilastir" SONUC ekrani urun satirlari.
// NOT: bu ekran .ms-* DEGIL .cmp-mkt-* ailesi. .ms-* market SECIM sayfasi
// (harf avatari + ad + meta + tik), orada urun satiri hic yok.
//
// Onceki hali: 30x30 gorsel, tek satir ad (nowrap+ellipsis ile KESILIYORDU),
// sagda fiyat. Gramaj ve birim fiyat sepette VARDI ama hesaplaSecili
// projeksiyonunda dusuruluyordu.
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
// CSS'te ayni secici birden cok kez tanimliysa SON tanim uygulanir.
// Ilk eslesmeyi okumak yanlis sonuc verir (bu testte bir kez oldu).
// Tum eslesmeleri birlestirip DOGRU olani, yani en sondaki degeri aliyoruz.
// CSS okuma yardimcisi. Uc tuzagin hepsine bu testte tek tek dusuldu:
//   1. Ayni secici birden cok tanimliysa SON tanim uygulanir -> hepsi
//      birlestiriliyor, sonraki oncekini eziyor.
//   2. @media bloklari KOSULLU -> tabana karistirilmiyor (360px'teki 48px,
//      tabandaki 56px'i eziyor gorunuyordu).
//   3. CSS yorumlari icindeki ':' bildirim ayristirmasini bozuyor
//      ("/* KESME YOK: ... */" yuzunden white-space hic okunmuyordu).
// Ayrica virgulle gruplanmis secicilerde (.a, .b { }) hedef ilk sirada
// olabilir; secici LISTESI tam token olarak aranmali.
const CSS_TEMIZ = CSS.replace(/\/\*[\s\S]*?\*\//g, '');
const CSS_TABAN = CSS_TEMIZ.replace(/@media[^{]*\{(?:[^{}]*\{[^}]*\})*[^{}]*\}/g, '');
function kural(s, kaynak) {
  const metin = kaynak || CSS_TABAN;
  const ozellik = {};
  for (const m of metin.matchAll(/([^{}]+)\{([^}]*)\}/g)) {
    const liste = m[1].split(',').map(x => x.trim().split('\n').pop().trim());
    if (!liste.includes(s)) continue;
    for (const b of m[2].split(';')) {
      const i = b.indexOf(':'); if (i < 0) continue;
      ozellik[b.slice(0, i).trim()] = b.slice(i + 1).trim();
    }
  }
  if (!Object.keys(ozellik).length) return '';
  return ' ' + s + ' { ' + Object.entries(ozellik).map(([k, v]) => k + ': ' + v).join('; ') + ' }';
}

console.log('\n=== 0. YAPI ===');
ok('function _birimFiyatHam', !!fnKaynak('_birimFiyatHam'));
ok('function birimFiyatHesapla duruyor', !!fnKaynak('birimFiyatHesapla'));
ok('hesaplaSecili duruyor', !!fnKaynak('hesaplaSecili'));
if (!fnKaynak('_birimFiyatHam')) { console.log('\nPASS=' + pass + '  FAIL=' + fail); process.exit(1); }

console.log('\n=== 1. BIRIM FIYAT: ATANAN fiyattan hesaplaniyor ===');
{
  const ctx = { console, Math, String, parseFloat, parseInt, Number, isNaN };
  vm.createContext(ctx);
  vm.runInContext([fnKaynak('_birimFiyatHam'), fnKaynak('_birimFiyatAyristir'), fnKaynak('birimFiyatYazi'),
    'const tl = v => Number(v).toFixed(2).replace(".", ",") + " TL";'].join('\n'), ctx);
  const c = (ah, f) => vm.runInContext('JSON.stringify(_birimFiyatHam(' + JSON.stringify(ah) + ',' + f + '))', ctx);
  ok('1 kg / 100 TL -> kg basina 100', JSON.parse(c('1 Kg', 100)).deger === 100);
  ok('500 gr / 50 TL -> kg basina 100', Math.round(JSON.parse(c('500 Gr', 50)).deger) === 100);
  ok('1 Lt / 30 TL -> L basina 30', JSON.parse(c('1 Lt', 30)).birim === 'L');
  ok('330 Ml / 10 TL -> L basina ~30', Math.round(JSON.parse(c('330 Ml', 10)).deger) === 30);
  // MEVCUT davranis: 'ml' deseni 'x N'den ONCE deneniyor, yani '6x250 Ml'
  // L basina donuyor. Bu birimFiyatHesapla'nin oteden beri yaptigi sey —
  // refactor bunu DEGISTIRMEDI, o yuzden burada da ayni bekleniyor.
  ok('6x250 Ml -> ml deseni once yakalanir (L)', JSON.parse(c('6x250 Ml', 60)).birim === 'L');
  ok('6lu -> adet basina', JSON.parse(c('6lu paket', 60)).birim === 'adet');
  ok('gramaj okunamazsa null', c('paket', 50) === 'null');
  ok('fiyat 0 ise null', c('1 Kg', 0) === 'null');
  ok('gramaj bos ise null', c('', 50) === 'null');
  // ATANAN fiyat kullaniliyor: ayni urun, farkli fiyat -> farkli birim fiyat
  ok('ATANAN fiyat degisince birim fiyat da degisiyor',
    JSON.parse(c('1 Kg', 100)).deger !== JSON.parse(c('1 Kg', 200)).deger);
}

console.log('\n=== 2. birimFiyatHesapla DAVRANISI DEGISMEDI ===');
{
  const b = fnKaynak('birimFiyatHesapla');
  ok('hala enDusukFiyat kullaniyor (global min)', /enDusukFiyat\s*\(/.test(b), b.slice(0, 120));
  ok('ayristirmayi ortak cekirdege devrediyor', /_birimFiyatAyristir\s*\(/.test(b), b.slice(0, 160));
}

console.log('\n=== 3. SATIR: gramaj + birim fiyat GOSTERILIYOR ===');
{
  const h = fnKaynak('hesaplaSecili') || '';
  ok('projeksiyon agirlik_hacim tasiyor', /agirlik_hacim/.test(h), '');
  ok('_cmpItemHTML birim fiyat hesapliyor', /_birimFiyatHam\s*\(/.test(h), '');
  ok('meta satiri sinifi var (.cmp-mkt-item-meta)', /cmp-mkt-item-meta/.test(h), '');
  ok('ad ve meta ortak sutunda (.cmp-mkt-item-main)', /cmp-mkt-item-main/.test(h), '');
}

console.log('\n=== 4. GORSEL 56-64 BANDINDA, AD IKI SATIRA SARIYOR ===');
{
  const img = kural('.cmp-mkt-item-img');
  const ph = kural('.cmp-mkt-item-img-ph');
  const boyut = (img.match(/width:\s*(\d+)px/) || [])[1];
  ok('gorsel 56-64 bandinda', boyut >= 56 && boyut <= 64, 'width=' + boyut);
  ok('placeholder ayni boyutta', (ph.match(/width:\s*(\d+)px/) || [])[1] === boyut, ph.slice(0, 80));
  const ad = kural('.cmp-mkt-item-name');
  ok('ad KESILMIYOR (nowrap kaldirildi)', !/white-space:\s*nowrap/.test(ad), ad.slice(0, 140));
  ok('ad iki satirla sinirli (line-clamp 2)', /line-clamp:\s*2/.test(ad), ad.slice(0, 160));
}

console.log('\n=== 5. HIYERARSI: baslik > fiyat > ad > meta ===');
{
  const say = s => { const m = kural(s).match(/font-size:\s*([\d.]+)rem/); return m ? parseFloat(m[1]) : null; };
  const agirlik = s => { const m = kural(s).match(/font-weight:\s*(\d+)/); return m ? +m[1] : null; };
  const baslik = say('.cmp-mkt-name'), fiyat = say('.cmp-mkt-item-price'), meta = say('.cmp-mkt-item-meta');
  ok('market basligi urun satirindan BUYUK', baslik > (say('.cmp-mkt-item') || 0.8),
    'baslik=' + baslik + ' satir=' + say('.cmp-mkt-item'));
  ok('meta en kucuk', meta && meta < (say('.cmp-mkt-item-name') || 0.82), 'meta=' + meta);
  ok('fiyat kalin ama basligi gecmiyor', agirlik('.cmp-mkt-item-price') >= 700 && fiyat <= baslik,
    'fiyat=' + fiyat + '/' + agirlik('.cmp-mkt-item-price') + ' baslik=' + baslik);
  ok('toplam satiri ayrisiyor (.cmp-mkt-subtotal)', /border-top/.test(kural('.cmp-mkt-subtotal')), '');
}

console.log('\n=== 6. KOYU TEMA: beyaz gorsel zemini EZILIYOR ===');
{
  ok('img koyu tema override VAR',
    /\[data-theme="dark"\][^{]*\.cmp-mkt-item-img\b/.test(CSS), '');
  ok('img-ph koyu tema override VAR',
    /\[data-theme="dark"\][^{]*\.cmp-mkt-item-img-ph\b/.test(CSS), '');
  ok('meta koyu tema override VAR',
    /\[data-theme="dark"\][^{]*\.cmp-mkt-item-meta\b/.test(CSS), '');
}

console.log('\n=== 7. DURUSTLUK BILGISI AYNEN DURUYOR ===');
{
  ok('"N urun yok (tutar eksik)" duruyor', /ürün yok \(tutar eksik\)/.test(APP), '');
  ok('footer uyarisi duruyor', /seçili marketlerde yok — tutar onlar olmadan/.test(APP), '');
  ok('market basina gercek toplam duruyor', /cmp-mkt-subtotal/.test(APP) && /Toplam:/.test(APP), '');
  ok('genel toplam duruyor', /cmp-grand/.test(APP) && /Genel Toplam/.test(APP), '');
  ok('bulunmayan urunler blogu duruyor', /Seçili marketlerde bulunmayan ürünler/.test(APP), '');
  ok('eksik fiyat tire ile gosteriliyor', /'—'|"—"|—/.test(fnKaynak('hesaplaSecili') || ''), '');
}

console.log('\n=== 8. DIGER EKRANLAR DEGISMEDI ===');
for (const s of ['.strip-card', '.product-card', '.cat-card', '.cart-item']) {
  const k = kural(s);
  ok(s + ' kurali duruyor', k.length > 20, 'uzunluk=' + k.length);
}
{
  // yeni kurallar YALNIZCA cmp-* ve sadece bu ekrani hedefliyor.
  // SINIR: blok "CMP SATIR YENIDEN TASARIM" ile baslar, SONRAKI ═══ bolum
  // basligina kadar surer. Once "isaretciden sonrasi tumu" diye alinmisti;
  // dosya sonuna baska bir is (JS KAPALI PANELI) eklendiginde bu koruma
  // yanlis yere ates etti. Koruma ayni sey icin duruyor, sinir kapatildi.
  const yeni = (CSS.split('CMP SATIR YENIDEN TASARIM')[1] || '').split(/\/\*\s*═+\s/)[0];
  ok('yeni CSS blogu var', yeni.length > 100, 'uzunluk=' + yeni.length);
  const secililer = [...yeni.matchAll(/^\s*([.\[][^{]*)\{/gm)].map(m => m[1].trim());
  const kacak = secililer.filter(s => !/cmp-/.test(s));
  ok('yeni blokta cmp-* DISINDA secici YOK', kacak.length === 0, kacak.join(' | '));
}

console.log('\n=== 9. 320px DAR EKRAN ===');
ok('dar ekran icin gorsel kuculuyor (media query)',
  /@media[^{]*max-width:\s*36[05]px[^{]*\{[^}]*cmp-mkt-item-img/.test(CSS.replace(/\n/g, ' ')), '');

console.log('\nPASS=' + pass + '  FAIL=' + fail);
process.exit(fail ? 1 : 0);
