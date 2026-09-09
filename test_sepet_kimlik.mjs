// Sepet kimligi: listeye eklenen urun veri guncellenince BASKA bir urune
// donusmemeli.
//
// NEDEN VAR: productMap `_id` ile anahtarli ve `_id` KARARSIZ --
// assignIds onu `slug + '_' + dizideki_sira` diye uretiyor. Veri her gece
// yeniden yazildigi icin ayni sira ertesi gun baska bir urune denk geliyor;
// sepet localStorage'da kalici oldugu icin kullanicinin listesindeki urun
// sessizce degisiyordu. (Denetim, 2026-09-08, kritik.)
//
// Test DAVRANISSAL: app.js'in gercek fonksiyonlari node:vm'de kosturuluyor,
// mantik kopyalanmiyor. Kontrol grubu gomulu -- once ESKI davranis uretilip
// kusurun gercekten dogdugu gosteriliyor, yoksa "gecti" bir sey kanitlamaz.

import fs from 'node:fs';
import vm from 'node:vm';

const APP = fs.readFileSync(new URL('./app.js', import.meta.url), 'utf8');

let GECTI = 0, KALDI = 0;
const ok = (ad, kosul, ipucu = '') => {
  if (kosul) { GECTI++; console.log('  PASS  ' + ad); }
  else { KALDI++; console.log('  FAIL  ' + ad + (ipucu ? '  -> ' + ipucu : '')); }
};

function govde(ad) {
  const re = new RegExp('(?:^|\\n)\\s*function ' + ad + '\\s*\\([^)]*\\)\\s*\\{');
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

// ── vm ortami ────────────────────────────────────────────────────────
const ctx = { console, Object, Array, JSON, String };
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
  govde('_sepetEslesir'),
].join('\n'), ctx);

// NOT: `let` ile tanimlanan vm degiskenleri context OZELLIGI DEGIL -- `ctx.x`
// ile okunmaz (ilk yazimda bu tuzaga dusuldu ve iki iddia yanlis kirmizi verdi).
// Okuma da yazma da runInContext uzerinden yapilir.
const oku = (ifade) => vm.runInContext(ifade, ctx);
const kur = (urunler) => {
  oku('productMap = {}; _productMapSayac = 0; _sidIndex = null; _sidIndexSayac = -1;');
  ctx.__gelen = urunler;
  oku('__gelen.forEach(function(u){ _pmEkle(u); });');
};

// GUN 1: uc urun, sira 0/1/2
const gun1 = [
  { _id: 'sut_0', _sid: 'sut_pinar-tam-yagli-1l', ad: 'Pınar Tam Yağlı Süt 1 L' },
  { _id: 'sut_1', _sid: 'sut_sek-laktozsuz-500ml', ad: 'Sek Laktozsuz Süt 500 Ml' },
  { _id: 'sut_2', _sid: 'sut_icim-yarim-yagli-1l', ad: 'İçim Yarım Yağlı Süt 1 L' },
];
// GUN 2: ayni urunler ama SIRA DEGISTI (yeni urun basa girdi).
// Ayni `_id` artik BASKA urune denk geliyor -- kusurun kaynagi tam bu.
const gun2 = [
  { _id: 'sut_0', _sid: 'sut_yeni-marka-ayran-1l', ad: 'Yeni Marka Ayran 1 L' },
  { _id: 'sut_1', _sid: 'sut_pinar-tam-yagli-1l', ad: 'Pınar Tam Yağlı Süt 1 L' },
  { _id: 'sut_2', _sid: 'sut_sek-laktozsuz-500ml', ad: 'Sek Laktozsuz Süt 500 Ml' },
  { _id: 'sut_3', _sid: 'sut_icim-yarim-yagli-1l', ad: 'İçim Yarım Yağlı Süt 1 L' },
];

console.log('\n=== 1. KONTROL GRUBU: eski davranis kusuru GERCEKTEN uretiyor mu ===');
kur(gun2);
const eskiCozum = oku('productMap["sut_0"]');
ok('sira degisince ayni _id BASKA urune denk geliyor',
   eskiCozum && eskiCozum.ad === 'Yeni Marka Ayran 1 L',
   eskiCozum && eskiCozum.ad);
console.log('        (yani sadece _id ile arayan kod Pınar yerine Ayran gosterirdi)');

console.log('\n=== 2. _sid ile cozum: DOGRU urun geliyor ===');
const sepetOgesi = { _id: 'sut_0', _sid: 'sut_pinar-tam-yagli-1l', ad: 'Pınar Tam Yağlı Süt 1 L' };
ctx.__oge = sepetOgesi;
const canli = vm.runInContext('_sepetCanli(__oge)', ctx);
ok('gun 2 katalogunda dogru urun bulunuyor', canli && canli.ad === 'Pınar Tam Yağlı Süt 1 L',
   canli && canli.ad);
ok('  bulunan urunun yeni _id si dogru', canli && canli._id === 'sut_1', canli && canli._id);

console.log('\n=== 3. Urun katalogdan KALKARSA baska urun gosterilmemeli ===');
ctx.__yok = { _id: 'sut_0', _sid: 'sut_artik-yok', ad: 'Kalkmış Ürün' };
const yok = vm.runInContext('_sepetCanli(__yok)', ctx);
ok('_sid bulunamayinca null doner (_id ye DUSMEZ)', yok === null,
   yok ? 'baska urun dondu: ' + yok.ad : '');

console.log('\n=== 4. Eski (_sid siz) sepet kayitlari calismaya devam etmeli ===');
ctx.__eski = { _id: 'sut_2', ad: 'Eski Kayıt' };
const eski = vm.runInContext('_sepetCanli(__eski)', ctx);
ok('_sid yoksa _id ile cozuluyor (geri uyum)', eski && eski._id === 'sut_2', eski && eski.ad);

console.log('\n=== 5. Eslestirme: _sid uzerinden ===');
kur(gun1);
ctx.__oge = sepetOgesi;
ok('gun 1 de _id ile eslesiyor', vm.runInContext('_sepetEslesir(__oge, "sut_0")', ctx) === true);
kur(gun2);
ok('gun 2 de ESKI _id ile ESLESMIYOR (yanlis urun silinmez)',
   vm.runInContext('_sepetEslesir(__oge, "sut_0")', ctx) === false);
ok('gun 2 de YENI _id ile eslesiyor',
   vm.runInContext('_sepetEslesir(__oge, "sut_1")', ctx) === true);
ok('dogrudan _sid ile de eslesiyor (kartlar artik onu gonderiyor)',
   vm.runInContext('_sepetEslesir(__oge, "sut_pinar-tam-yagli-1l")', ctx) === true);
ok('alakasiz _sid ile eslesmiyor',
   vm.runInContext('_sepetEslesir(__oge, "sut_artik-yok")', ctx) === false);
ok('oge null ise false (patlamiyor)',
   vm.runInContext('_sepetEslesir(null, "sut_0")', ctx) === false);

console.log('\n=== 6. Index sayaca bagli: katalog degisince tazeleniyor ===');
kur(gun1);
oku('_sidIndeksi()');
const s1 = oku('_sidIndexSayac');
kur(gun2);
const bulunan = oku('_sidIndeksi()["sut_yeni-marka-ayran-1l"]');
ok('yeni katalogdaki urun indexte gorunuyor (bayat kalmiyor)', bulunan != null);
ok('  sayac katalogla ayni degere kilitli', oku('_sidIndexSayac') === oku('_productMapSayac'),
   oku('_sidIndexSayac') + ' vs ' + oku('_productMapSayac'));

// GERCEK UYGULAMA KOSULU: orada _sidIndex ELLE SIFIRLANMAZ -- productMap
// tembel yuklemeyle buyur ve index'in kendini yenilemesi YALNIZCA sayaca
// bagli. Yukaridaki senaryo kur() ile index'i sifirladigi icin bayatlamayi
// hic uretemiyordu; prove-by-breaking bunu yakaladi ("sayac gormezden
// geliniyor" mutasyonu YESIL kalmisti). Iddia gevsetilmedi, senaryo
// gercekcilestirildi.
kur(gun1);
oku('_sidIndeksi()');                       // index kuruldu
ctx.__yeni = { _id: 'sut_9', _sid: 'sut_sonradan-gelen', ad: 'Sonradan Gelen' };
oku('_pmEkle(__yeni);');                    // katalog buyudu, index SIFIRLANMADI
ok('index sifirlanmadan katalog buyuyunce yeni urunu goruyor',
   oku('_sidIndeksi()["sut_sonradan-gelen"]') != null,
   'index bayat kaldi -- sepet ogesi cozulemez');

console.log('\n=== 7. KAYNAK KILIDI: sepet aramalari ham _id ye geri donmemeli ===');
const hamKarsilastirma = [...APP.matchAll(/sepet\.(find|filter|some|findIndex)\([^)]*_id\s*[!=]==/g)];
ok('sepet aramalarinda ham _id karsilastirmasi kalmadi', hamKarsilastirma.length === 0,
   hamKarsilastirma.map((m) => m[0]).join(' | '));
ok('sepet kartlari _sid gonderiyor',
   /class="cart-item"[^`]*data-id="\$\{_kacir\(u\._sid \|\| u\._id\)\}"/.test(APP));
ok('sil butonu da _sid gonderiyor',
   /class="cart-del" data-id="\$\{_kacir\(u\._sid \|\| u\._id\)\}"/.test(APP));
ok('openDetay once _sid indeksine bakiyor',
   /let u = _sidIndeksi\(\)\[urunId\] \|\| productMap\[urunId\]/.test(APP));

console.log('\nPASS=' + GECTI + '  FAIL=' + KALDI);
process.exit(KALDI ? 1 : 0);
