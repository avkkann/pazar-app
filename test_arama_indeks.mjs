// Arama indeksi: ilk harfte 1,3 MB indirmeyi bitiren hafif katalog.
//
// NEDEN VAR: arama kutusuna ILK HARFI yazan kullanici loadAllCats() ile
// sekiz kategori dosyasini birden indiriyordu -- OLCULDU (2026-09-10):
// 1.317 KB gzip / 14,2 MB ham JSON, mobilde 3-8 saniye. (Denetim, kritik.)
// data/arama.json kartin okudugu alanlari tasiyor: 632 KB gzip, %52 daha az.
//
// EN ONEMLI IDDIA: kart BIREBIR ayni ciziliyor. Indeks FIYATI da tasiyor
// (market_fiyatlari); disarida kalan yalnizca gecmis dizileri. Yani bu bir
// gorunum odunu DEGIL. Asagidaki bolum 2 bunu gercek veriyle kanitliyor.
//
// Test uretecin GERCEK ciktisini ve app.js'in GERCEK cozucusunu kullanir.

import fs from 'node:fs';
import vm from 'node:vm';
import zlib from 'node:zlib';
import { execFileSync } from 'node:child_process';

const APP = fs.readFileSync(new URL('./app.js', import.meta.url), 'utf8');

let GECTI = 0, KALDI = 0;
const ok = (ad, kosul, ipucu = '') => {
  if (kosul) { GECTI++; console.log('  PASS  ' + ad); }
  else { KALDI++; console.log('  FAIL  ' + ad + (ipucu ? '  -> ' + String(ipucu).slice(0, 220) : '')); }
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

console.log('\n=== 1. URETEC GERCEKTEN CALISIYOR ===');
execFileSync(process.execPath, ['scripts/arama-uret.mjs'], { stdio: 'pipe' });
const ham = fs.readFileSync('data/arama.json');
const idx = JSON.parse(ham);
ok('data/arama.json uretildi ve gecerli JSON', !!idx && Array.isArray(idx.urunler));
ok('  urun sayisi makul (>10.000)', idx.urunler.length > 10000, idx.urunler.length);
ok('  surum alani var', idx.surum === 1, idx.surum);

const gzKB = Math.round(zlib.gzipSync(ham, { level: 9 }).length / 1024);
// Tavan uydurulmadi: bugunku 8 kategori dosyasi 1.317 KB gzip. Indeks
// bunun YARISINDAN kucuk olmali, yoksa varlik sebebi kalmaz.
ok('  gzip boyutu tam katalogun YARISINDAN kucuk', gzKB < 658, gzKB + ' KB');
console.log('        (olculen: ' + gzKB + ' KB · tam katalog 1317 KB)');

console.log('\n=== 2. KART ALANLARI EKSIKSIZ (gorunum odunu YOK) ===');
// cardHTML zincirinin urunden okudugu alanlar. son_senkron JSON'da degil,
// Last-Modified basligindan geliyor (loadCat ile ayni desen) -> burada yok.
const GEREKEN = ['_sid', 'ad', 'resim', 'agirlik_hacim', 'ana_kategori',
                 'en_dusuk_fiyat', 'market_fiyatlari', 'slug'];
ok('uretecin yazdigi alan sirasi beklenen', idx.alanlar.join(',') === GEREKEN.join(','), idx.alanlar.join(','));

const ctx = { console, String, Array, Object, Number };
vm.createContext(ctx);
vm.runInContext(govde('_aramaCoz'), ctx);
ctx.__satir = idx.urunler[0];
const ilk = vm.runInContext('_aramaCoz(__satir, "2026-09-10T00:00:00.000Z")', ctx);
for (const a of ['_sid', 'ad', 'market_fiyatlari', 'en_dusuk_fiyat', '_kat', '_id', '_hafif']) {
  ok('  cozulen urunde ' + a + ' var', a in ilk, JSON.stringify(ilk).slice(0, 160));
}
ok('  _id kimlik olarak _sid kullaniyor (kararsiz slug_sira DEGIL)', ilk._id === ilk._sid, ilk._id);
ok('  _hafif isaretli (openDetay tam urunu indirsin)', ilk._hafif === true);
ok('  son_senkron damgasi enjekte ediliyor', !!ilk.son_senkron, ilk.son_senkron);

// FIYAT GERCEKTEN TASINIYOR MU -- gercek veriyle, kontrol gruplu
let fiyatli = 0, bosFiyat = 0;
for (const s of idx.urunler) { if ((s[6] || []).length) fiyatli++; else bosFiyat++; }
ok('  urunlerin buyuk cogunlugunda market fiyati VAR', fiyatli / idx.urunler.length > 0.95,
   fiyatli + '/' + idx.urunler.length);
console.log('        (fiyatsiz: ' + bosFiyat + ' -- kaynakta da fiyati olmayanlar)');

console.log('\n=== 3. INDEKS KAYNAKLA TUTARLI (ikinci kaynak degil) ===');
let katalog = [];
for (const d of fs.readdirSync('data').filter((f) => /^urunler_.*\.json$/.test(f))) {
  katalog = katalog.concat(JSON.parse(fs.readFileSync('data/' + d, 'utf8')));
}
const kaynakSid = new Map(katalog.filter((u) => u && u._sid).map((u) => [u._sid, u]));
ok('indeks urun sayisi kaynakla ayni', idx.urunler.length === kaynakSid.size,
   idx.urunler.length + ' vs ' + kaynakSid.size);

let adFark = 0, fiyatFark = 0;
const adim = Math.max(1, Math.floor(idx.urunler.length / 500));
for (let i = 0; i < idx.urunler.length; i += adim) {
  const s = idx.urunler[i];
  const k = kaynakSid.get(s[0]);
  if (!k) { adFark++; continue; }
  if (k.ad !== s[1]) adFark++;
  const kf = (k.market_fiyatlari || []).map((f) => f.market + ':' + f.fiyat).join('|');
  const sf = (s[6] || []).map((f) => f[0] + ':' + f[1]).join('|');
  if (kf !== sf) fiyatFark++;
}
ok('  ornekleme: ad kaynakla birebir', adFark === 0, adFark + ' fark');
ok('  ornekleme: market fiyatlari kaynakla birebir', fiyatFark === 0, fiyatFark + ' fark');

console.log('\n=== 4. BICIM KAPISI: sessizce yanlis alan okunamaz ===');
const yuk = govde('loadAramaIndeksi');
// IDDIA MESAJ METNINE DEGIL `throw`A BAKIYOR. Ilk yazimda "alan sirasi
// degismis" dizesini ariyordu ve prove-by-breaking bunu yakaladi: kapiyi
// console.log'a cevirmek AYNI metni tasidigi icin test yesil kaliyordu --
// yani sessizce yanlis alan okuma yolu acik kalabilirdi.
ok('alan sirasi uyusmazsa HATA FIRLATIYOR (log degil)',
   /throw new Error\([^)]*alan sirasi degismis/.test(yuk), yuk.slice(0, 500));
ok('  bicim taninmazsa HATA FIRLATIYOR', /throw new Error\([^)]*bicimi taninmiyor/.test(yuk));
ok('  basarisizlikta BOS DIZI onbellege YAZILMIYOR', /_aramaKatalog = null/.test(yuk), yuk.slice(-400));
ok('  sessiz yutma yok (console.warn var)', /console\.warn/.test(yuk));

console.log('\n=== 5. YEDEK YOL: indeks inmezse arama OLMEZ ===');
const yedek = govde('aramaKatalogu');
// IDDIA CAGRIYA DEGIL DONUSE BAKIYOR. Ilk yazimda yalnizca loadAllCats()
// cagrisini ariyordu; prove-by-breaking gosterdi ki `return` satirini bos
// diziye cevirmek testi yesil birakiyor -- yani indeks inince arama sessizce
// "sonuc yok" derdi, ki bu tam da kacinmak istedigimiz sey.
ok('indeks basarisiz olunca loadAllCats a dusuluyor', /await loadAllCats\(\)/.test(yedek), yedek);
ok('  ve tam katalogu GERCEKTEN donduruyor (bos dizi degil)',
   /return KATEGORILER\.flatMap\(/.test(yedek), yedek);

console.log('\n=== 6. ARAMA ARTIK TAM KATALOGU INDIRMIYOR ===');
const isleyici = APP.slice(APP.indexOf("getElementById('search').addEventListener"),
                           APP.indexOf("_mfLastQuery = q;"));
ok('arama isleyicisi aramaKatalogu() kullaniyor', /await aramaKatalogu\(\)/.test(isleyici), isleyici.slice(-400));
ok('  arama isleyicisinde loadAllCats KALMADI', !/await loadAllCats\(\)/.test(isleyici), isleyici.slice(-400));

// INDEKSIN VARLIK SEBEBI: sonuca dokunmak da tam katalogu indirmemeli.
// Indirseydi kazanc ilk tiklamada geri verilirdi -- yani ozellik yalnizca
// hic tiklamayan kullanici icin calisirdi. Bu iddia once test_tembel'e
// yazilmisti; prove-by-breaking BU testte bosluk oldugunu gosterdi
// (mutasyon uygulandi, test yakalamadi) ve iddia buraya da tasindi.
// KARTA TIKLAMA ZINCIRI. Bu iddia bir OLCUMDEN dogdu: ilk uygulamada hafif
// urunler yalnizca _aramaKatalog dizisindeydi ve openDetay onlari
// productMap/_sidIndeksi'nde ariyordu -> sonuca tiklayinca detay BOS
// aciliyordu (olculdu: metin uzunlugu 11, market satiri 0, hicbir istek yok).
// Zincirin ucu de kilitli, yoksa aradaki halka sessizce dusebilir.
const od = govde('openDetay');
ok('openDetay hafif urunleri de bulabiliyor (_aramaSid zincirde)',
   /_aramaSid\s*&&\s*_aramaSid\[urunId\]/.test(od), od.slice(0, 600));
ok('  indeks yuklenince _sid haritasi kuruluyor',
   /_aramaSid\s*=\s*\{\}/.test(yuk) && /_aramaSid\[u\._sid\]\s*=\s*u/.test(yuk), yuk.slice(-500));

const tamVeri = govde('_detayTamVeriGetir');
// YORUMLAR SOYULUYOR: iddia "loadAllCats gecmiyor" diyor, fonksiyonun
// basindaki aciklama ise o adi ANLATIYOR -- soyulmazsa test kendi
// aciklamasiyla eslesir (bu depoda BESINCI vaka). Soymak sertlestirir.
// GUVENLI YORUM SOYUCU (satir tabanli).
// Naif /\/\*[\s\S]*?\*\//g deseni BU DEPODA BOZUK: app.js'te 25 "/*" ama
// 23 "*/" var (bir kismi dize/regex icinde), esler kayiyor ve dosyanin %55'i
// siliniyor -- "desen kaynakta YOK" diyen iddialar bos yere yesil kalirdi.
// Yalnizca SATIR BASINDA baslayan blok yorumlar ve tam satirlik // yorumlar
// silinir; bu depoda aciklamalar zaten oyle yazili.
function kodTemiz(src) {
  const cikti = [];
  let blokta = false;
  // CRLF GUVENLIGI: JS regexinde nokta satir sonlandiricilarini (CR dahil)
  // ESLEMEZ ve m bayragi yokken satir-sonu capasi DIZE sonunu bekler. CRLF
  // bir satirda geriye kalan CR yuzunden asagidaki // deseni HIC eslesmez,
  // yorum SOYULMAZ ve "su desen kaynakta YOK" diyen iddia yorumla eslesip
  // YANLIS ALARM verir. SINSI: CI (Linux, LF checkout) YESIL kalir, hata
  // yalnizca Windows ta gorunur -- deponun kayitli tuzagi (2026-09-03,
  // test_sessiz_catch). Regex ile degil KARAKTER KODUYLA kirpiliyor.
  for (let l of String(src).split(String.fromCharCode(10))) {
    if (l.charCodeAt(l.length - 1) === 13) l = l.slice(0, -1);
    if (blokta) { if (l.indexOf("*/") >= 0) blokta = false; cikti.push(""); continue; }
    if (/^\s*\/\*/.test(l)) { if (l.indexOf("*/") < 0) blokta = true; cikti.push(""); continue; }
    cikti.push(l.replace(/^\s*\/\/.*$/, ""));
  }
  return cikti.join(String.fromCharCode(10));
}

// ALET KONTROLU (soyucunun KENDI kontrol grubu). Bu alet 2026-09-10 turunda
// SESSIZCE BOZUKTU: CRLF satirlarda yorumu hic soymuyordu ve bunu ancak
// baska bir testin YANLIS ALARMI acik etti. CI Linux ta LF checkout yaptigi
// icin orada yesil kaliyordu. Artik alet her kosuda kendini kanitliyor.
{
  const CR = String.fromCharCode(13), LF = String.fromCharCode(10);
  const _crlf = kodTemiz("// SOYULMALI_YORUM" + CR + LF + "const _kod = 1;" + CR + LF);
  const _lf   = kodTemiz("// SOYULMALI_YORUM" + LF + "const _kod = 1;" + LF);
  ok("ALET: CRLF satirda yorum SOYULUYOR", !/SOYULMALI_YORUM/.test(_crlf), JSON.stringify(_crlf));
  ok("ALET:   LF satirda yorum SOYULUYOR", !/SOYULMALI_YORUM/.test(_lf), JSON.stringify(_lf));
  ok("ALET: kod satiri KORUNUYOR (asiri soyma yok)",
     /const _kod = 1;/.test(_crlf) && /const _kod = 1;/.test(_lf), JSON.stringify(_crlf));
}
const tamVeriT = kodTemiz(tamVeri);
const hafifDal = tamVeriT.slice(0, tamVeriT.indexOf('_kisa') > 0 ? tamVeriT.indexOf('_kisa') : tamVeriT.length);
ok('  hafif urune dokununca YALNIZCA kendi kategorisi iniyor',
   /loadCat\(u\._kat\)/.test(hafifDal) && !/loadAllCats/.test(hafifDal), hafifDal.slice(0, 400));

console.log('\n=== 7. TAM URUN HAFIFIYLE EZILMEZ ===');
const si = govde('_sidIndeksi');
ok('_sidIndeksi tam urunu koruyor', /eski && !eski\._hafif && u\._hafif/.test(si), si);
// DAVRANIS: sira ne olursa olsun tam urun kazanmali
const ctx2 = { console, Object };
vm.createContext(ctx2);
vm.runInContext('let productMap = {};\nlet _productMapSayac = 0;\nlet _sidIndex = null;\nlet _sidIndexSayac = -1;\n'
  + govde('_pmEkle') + '\n' + govde('_sidIndeksi'), ctx2);
const calis = (i) => vm.runInContext(i, ctx2);
ctx2.__h = { _id: 'x1', _sid: 'x1', ad: 'Hafif', _hafif: true };
ctx2.__t = { _id: 'sut_5', _sid: 'x1', ad: 'Tam' };
calis('productMap = {}; _productMapSayac = 0; _sidIndex = null; _sidIndexSayac = -1; _pmEkle(__h); _pmEkle(__t);');
ok('  hafif ONCE eklendiginde tam kazaniyor', calis('_sidIndeksi()["x1"].ad') === 'Tam', calis('_sidIndeksi()["x1"].ad'));
calis('productMap = {}; _productMapSayac = 0; _sidIndex = null; _sidIndexSayac = -1; _pmEkle(__t); _pmEkle(__h);');
ok('  hafif SONRA eklendiginde de tam kazaniyor', calis('_sidIndeksi()["x1"].ad') === 'Tam', calis('_sidIndeksi()["x1"].ad'));
// KONTROL GRUBU: yalniz hafif varsa o donmeli (kural fazla siki degil)
calis('productMap = {}; _productMapSayac = 0; _sidIndex = null; _sidIndexSayac = -1; _pmEkle(__h);');
ok('  yalniz hafif varsa o doner (kural fazla siki degil)', calis('_sidIndeksi()["x1"].ad') === 'Hafif');

console.log('\nPASS=' + GECTI + '  FAIL=' + KALDI);
process.exit(KALDI ? 1 : 0);
