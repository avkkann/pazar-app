// Sepetteki fiyatlar DONMUYOR.
//
// KUSUR (denetim 2026-09-08, yuksek): sepete eklerken market_fiyatlari
// KOPYALANIYOR ve o kopya bir daha guncellenmiyordu. Fiyatlar her gece
// degisiyor; kullanici haftalar once ekledigi urunun ESKI fiyatini goruyor,
// "Marketleri Karsilastir" o eski fiyatla hesap yapip YANLIS MARKETE
// yonlendiriyordu -- uygulamanin tek vaadi "guncel fiyati goster" iken.
//
// Test DAVRANISSAL: app.js'in gercek fonksiyonlari node:vm'de kosturulur.
// Kontrol grubu gomulu -- once ESKI davranis uretilip kusurun gercekten
// dogdugu gosteriliyor, yoksa "gecti" hicbir sey kanitlamaz.

import fs from 'node:fs';
import vm from 'node:vm';

const APP = fs.readFileSync(new URL('./app.js', import.meta.url), 'utf8');

let GECTI = 0, KALDI = 0;
const ok = (ad, kosul, ipucu = '') => {
  if (kosul) { GECTI++; console.log('  PASS  ' + ad); }
  else { KALDI++; console.log('  FAIL  ' + ad + (ipucu ? '  -> ' + String(ipucu).slice(0, 200) : '')); }
};

function govde(ad) {
  const re = new RegExp('(?:^|\\n)\\s*(?:async )?function ' + ad + '\\s*\\([^)]*\\)\\s*\\{');
  const m = re.exec(APP);
  if (!m) throw new Error('bulunamadi: ' + ad);
  const bas = APP.indexOf('{', m.index);
  let d = 0;
  for (let i = bas; i < APP.length; i++) {
    if (APP[i] === '{') d++;
    else if (APP[i] === '}') { d--; if (d === 0) return APP.slice(m.index, i + 1); }
  }
  throw new Error('kapanmadi: ' + ad);
}

// ── vm ortami: GERCEK kaynak, sahte yok ──────────────────────────────
let kaydedildi = 0;
const ctx = {
  console, Object, Array, JSON, String, Number, Promise, isNaN, Math,
  saveSepet: () => { kaydedildi++; },
  KATEGORILER: [{ slug: 'sut', file: 'urunler_sut' }, { slug: 'gida', file: 'urunler_gida' }],
  ustKategori: (x) => x,
};
vm.createContext(ctx);
vm.runInContext([
  'let productMap = {};',
  'let _productMapSayac = 0;',
  'let sepet = [];',
  'let _sidIndex = null;',
  'let _sidIndexSayac = -1;',
  govde('_pmEkle'),
  govde('_sidIndeksi'),
  govde('_sepetCanli'),
  govde('urunKategoriSlugu'),
  govde('sepetFiyatlariTazele'),
].join('\n'), ctx);
const calis = (i) => vm.runInContext(i, ctx);

const URUN = (sid, ad, fiyat) => ({
  _sid: sid, _id: sid, ad, agirlik_hacim: '1 LT', resim: 'r.png',
  en_dusuk_fiyat: fiyat,
  market_fiyatlari: [{ market: 'bim', fiyat }, { market: 'a101', fiyat: fiyat + 5 }],
});

console.log('\n=== 1. KONTROL GRUBU: kopya GERCEKTEN bayatliyor mu ===');
ctx.__k = [URUN('sut_pinar-1l', 'Pınar Süt 1 L', 30)];
calis('productMap = {}; _productMapSayac = 0; _sidIndex = null; _sidIndexSayac = -1;');
calis('__k.forEach(u => _pmEkle(u));');
// Sepete EKLENDIGI ANIN kopyasi (toggleSepet ne yapiyorsa o)
calis('sepet = [{ _id: "sut_pinar-1l", _sid: "sut_pinar-1l", ad: "Pınar Süt 1 L", ' +
      'market_fiyatlari: [{market:"bim",fiyat:30},{market:"a101",fiyat:35}], en_dusuk_fiyat: 30 }];');
// Gece gecti: katalog fiyati degisti, sepetteki kopya AYNI kaldi
ctx.__yeni = [URUN('sut_pinar-1l', 'Pınar Süt 1 L', 42)];
calis('productMap = {}; _productMapSayac = 0; _sidIndex = null; _sidIndexSayac = -1;');
calis('__yeni.forEach(u => _pmEkle(u));');
ok('sepetteki kopya ESKI fiyati tasiyor (kusurun kaniti)',
   calis('sepet[0].market_fiyatlari[0].fiyat') === 30, calis('sepet[0].market_fiyatlari[0].fiyat'));
ok('  katalogdaki CANLI fiyat farkli', calis('_sepetCanli(sepet[0]).market_fiyatlari[0].fiyat') === 42);

console.log('\n=== 2. TAZELEME: kopya canliyla esitleniyor ===');
kaydedildi = 0;
const n1 = calis('sepetFiyatlariTazele()');
ok('bir urun tazelendi', n1 === 1, String(n1));
ok('  sepetteki fiyat artik CANLI', calis('sepet[0].market_fiyatlari[0].fiyat') === 42,
   calis('sepet[0].market_fiyatlari[0].fiyat'));
ok('  en_dusuk_fiyat da tazelendi', calis('sepet[0].en_dusuk_fiyat') === 42, calis('sepet[0].en_dusuk_fiyat'));
ok('  degisiklik KAYDEDILDI (saveSepet cagrildi)', kaydedildi === 1, String(kaydedildi));

console.log('\n=== 3. GEREKSIZ YAZMA YOK ===');
kaydedildi = 0;
const n2 = calis('sepetFiyatlariTazele()');
ok('ikinci cagride degisen yok', n2 === 0, String(n2));
ok('  bosuna saveSepet cagrilmiyor', kaydedildi === 0, String(kaydedildi));

console.log('\n=== 4. URUN KATALOGDAN KALKTIYSA kopya KORUNUYOR ===');
calis('productMap = {}; _productMapSayac = 0; _sidIndex = null; _sidIndexSayac = -1;');   // katalog bos
kaydedildi = 0;
const n3 = calis('sepetFiyatlariTazele()');
ok('katalogda yokken tazeleme yapilmiyor', n3 === 0, String(n3));
ok('  fiyat SILINMEDI (kullanicinin listesi bozulmuyor)',
   calis('sepet[0].market_fiyatlari.length') === 2, calis('sepet[0].market_fiyatlari.length'));

console.log('\n=== 5. YALNIZCA SEPETTEKI KATEGORILER INIYOR (tam katalog degil) ===');
{
  const g = govde('sepetFiyatlariGuncelle');
  ok('urunKategoriSlugu ile slug turetiliyor', /urunKategoriSlugu\(/.test(g), g.slice(0, 300));
  ok('  loadAllCats CAGRILMIYOR (1,3 MB geri gelmesin)', !/loadAllCats/.test(g), g);
  ok('  allSettled kullaniliyor (bir kategori inmezse digerleri tazelensin)',
     /Promise\.allSettled\(/.test(g), g);
}

console.log('\n=== 6. SONSUZ DONGU KAPISI ===');
{
  const r = govde('renderSepet');
  ok('renderSepet tazelemeyi tetikliyor', /sepetFiyatlariGuncelle\(\)/.test(r), r.slice(0, 400));
  // IDDIA KAPIYA BAKIYOR, ADIN VARLIGINA DEGIL. Ilk yazimda yalnizca
  // "_sepetTazeleBasladi gecıyor mu" diye soruyordu; prove-by-breaking bunu
  // yakaladi -- kosuldan `!_sepetTazeleBasladi &&` silinse bile govdedeki
  // atama satiri deseni tutturuyor ve test YESIL kaliyordu, yani sonsuz
  // dongu yolu acik kalabilirdi. (Ayni sinif kor nokta bu oturumda ucuncu kez.)
  ok('  bayrakla korunuyor (yenile -> render -> yenile dongusu yok)',
     /if \(!_sepetTazeleBasladi\s*&&/.test(r), r.slice(0, 400));
  ok('  bayrak her durumda birakiliyor (finally)',
     /\.finally\(\s*\(\)\s*=>\s*\{\s*_sepetTazeleBasladi = false/.test(r), r.slice(0, 600));
  ok('  yalnizca GERCEKTEN degistiyse yeniden ciziyor', /if \(n && _ekranGorunur/.test(r), r.slice(0, 500));
  ok('  sessiz yutma yok', /console\.warn/.test(r), r.slice(0, 500));
}

console.log('\n=== 7. KAYNAK KILIDI: toplamlar canli fiyattan ===');
{
  // Tazeleme kaynagi duzelttigi icin tuketen fonksiyonlar degismedi;
  // kilit, tazelemenin sepet ekraninda GERCEKTEN cagrildigini korur.
  const t = govde('sepetFiyatlariTazele');
  ok('tazeleme _sepetCanli ile cozuyor (kararsiz _id degil)', /_sepetCanli\(oge\)/.test(t), t.slice(0, 300));
  ok('  katalogda yoksa kopya korunuyor (continue)', /if \(!canli \|\| !Array\.isArray/.test(t), t.slice(0, 400));
}

console.log('\nPASS=' + GECTI + '  FAIL=' + KALDI);
process.exit(KALDI ? 1 : 0);
