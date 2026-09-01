// test_ust_kategori.mjs — ustKategori() eslemesi
//
// NEDEN VAR: 2026-09-01'de olculdu ki veride bulunan 6 ana_kategori degeri
// app.js'in beyaz listesinde YOKTU ve 648 urun 'diger'e dusuyordu. CLAUDE.md
// bunu "Makyaj (70 urun)" diye tek kategori sanmisti; gercek dagilim alti
// kategori cikti. Bu test o eslemeleri kilitler.
//
// YONTEM: app.js'ten fonksiyon KAYNAGI cikarilip node:vm'de kosuluyor —
// mantik ikinci kez yazilmiyor. Govde SABIT OFSETLE degil PARANTEZ SAYARAK
// cikariliyor (depo dersi: fonksiyona yorum eklenince sabit pencere kayiyor).
import { readFileSync, readdirSync } from 'node:fs';
import vm from 'node:vm';

let pass = 0, fail = 0;
const ok = (ad, kosul, ek = '') => {
  if (kosul) { pass++; console.log('  PASS  ' + ad); }
  else { fail++; console.log('  FAIL  ' + ad + (ek ? '  -> ' + ek : '')); }
};

const APP = readFileSync('app.js', 'utf8');
function govde(isim) {
  const bas = APP.indexOf('function ' + isim);
  if (bas < 0) throw new Error(isim + ' bulunamadi');
  let d = 0, i = APP.indexOf('{', bas);
  for (; i < APP.length; i++) {
    if (APP[i] === '{') d++;
    else if (APP[i] === '}') { d--; if (d === 0) return APP.slice(bas, i + 1); }
  }
  throw new Error(isim + ' govdesi kapanmadi');
}
const ctx = {};
vm.createContext(ctx);
vm.runInContext(govde('ustKategori') + '; globalThis.uk = ustKategori;', ctx);
const uk = ctx.uk;

// ── 0. KONTROL GRUBU: alet kor mu? ───────────────────────────────────────────
// Bu blok gecmeden asagidaki hicbir iddia anlamli degil. Fonksiyon her seye
// 'temizlik' dese ya da her seye 'diger' dese buradan yakalanir.
console.log('\n=== 0. KONTROL GRUBU ===');
ok('bilinen deger dogru cozuluyor (Peynir -> sut)', uk('Peynir') === 'sut', uk('Peynir'));
ok('bilinen deger dogru cozuluyor (Meyve -> meyve)', uk('Meyve') === 'meyve', uk('Meyve'));
ok('UYDURMA deger diger e dusuyor', uk('Zirva Kategori 123') === 'diger', uk('Zirva Kategori 123'));
ok('bos deger diger e dusuyor', uk('') === 'diger', uk(''));
ok('undefined patlamiyor, diger donuyor', uk(undefined) === 'diger', String(uk(undefined)));

// ── 1. BU TURDA EKLENEN ALTI ESLEME (regresyon kilidi) ───────────────────────
console.log('\n=== 1. 2026-09-01 EKLEMELERI ===');
const YENI = {
  'Taze Deniz Ürünleri': 'et',
  'Diğer Süt Ürünleri': 'sut',
  'Hazır Yemekler': 'gida',
  'Hazır Gıda Karışımları': 'gida',
  'Makyaj': 'temizlik',
  'Hasta Bakım Ürünleri': 'temizlik'
};
for (const [k, beklenen] of Object.entries(YENI)) {
  ok(`"${k}" -> ${beklenen}`, uk(k) === beklenen, uk(k));
}

// ── 2. ESKI ESLEMELER BOZULMADI (ornekleme, her ust kategoriden) ─────────────
console.log('\n=== 2. MEVCUT ESLEMELER KORUNDU ===');
const ESKI = {
  'Meyve': 'meyve', 'Sebze': 'sebze', 'Kırmızı Et': 'et', 'Yoğurt': 'sut',
  'Bakliyat': 'gida', 'Kahve': 'icecek', 'Saç Bakım': 'temizlik',
  'Cips': 'atistirmalik', 'Dondurulmuş Ürünler': 'dondurulmus'
};
for (const [k, beklenen] of Object.entries(ESKI)) {
  ok(`"${k}" -> ${beklenen}`, uk(k) === beklenen, uk(k));
}

// ── 3. GERCEK VERI: alti kategori artik diger e DUSMUYOR ─────────────────────
// Davranissal: katalogdaki gercek ana_kategori degerleri uzerinden.
console.log('\n=== 3. GERCEK VERIDE OLCUM ===');
const sayac = {};
let toplam = 0;
for (const f of readdirSync('data').filter(x => /^urunler_.*\.json$/.test(x))) {
  for (const u of JSON.parse(readFileSync('data/' + f, 'utf8'))) {
    toplam++;
    const k = u.ana_kategori || '(bos)';
    if (uk(k) === 'diger') sayac[k] = (sayac[k] || 0) + 1;
  }
}
ok('katalog okundu (alet gercekten veri gordu)', toplam > 1000, 'urun=' + toplam);
for (const k of Object.keys(YENI)) {
  ok(`"${k}" veride artik diger de DEGIL`, !sayac[k], 'hala ' + (sayac[k] || 0) + ' urun');
}

// TANINMAYAN KATEGORI: kirmizi YAPMIYOR, UYARIYOR.
// Gerekce: kaynak site yeni bir ana_kategori uydurdugunda bu testi kirmizi
// yapmak butun deploy'u durdurur ve site eski FIYATLA donar -- kozmetik bir
// esleme eksigi icin fazla agir bedel. scraper.py'nin "[UYARI] taninmayan
// market kodu" deseni burada da dogru olan: sessiz kalma, ama kapiyi kapatma.
const taninmayan = Object.entries(sayac).sort((a, b) => b[1] - a[1]);
if (taninmayan.length) {
  console.log('\n  [UYARI] ustKategori listesinde OLMAYAN ana_kategori degerleri:');
  for (const [k, n] of taninmayan) console.log(`     ${String(n).padStart(5)}  ${k}`);
  console.log('  -> KIRMIZI DEGIL (bilincli). Eslemeyi app.js ustKategori()e ekle.');
} else {
  console.log('  Taninmayan ana_kategori YOK — 6/6 esleme tuttu.');
}

console.log('\nPASS=' + pass + '  FAIL=' + fail);
process.exit(fail ? 1 : 0);
