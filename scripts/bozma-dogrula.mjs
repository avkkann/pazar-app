// PROVE-BY-BREAKING HARNESS — mutasyonun UYGULANDIGINI da kanitlar.
//
// NEDEN VAR: 2026-08-24 oturumunda ad-hoc bir bash dongusuyle yapilan
// prove-by-breaking IKI KEZ yanilttI. Her ikisinde de mutasyon deseni
// dosyada ESLESMEDI (biri CRLF yuzunden, biri sed BRE'sinde '?' ve '${}'
// literal oldugu icin), dosya HIC degismedi, test dogal olarak YESIL kaldi
// ve bu "guard kor" diye okundu. Guard saglamdi; ALET bozuktu.
//
// KURAL: "kirmiziya dondu" kadar "gercekten bozuldu" da kanit ister.
// Bu harness mutasyonu uygulamadan once desenin dosyada KAC KEZ gectigini
// sayar; 0 ise HARD-FAIL eder (exit 1) -- sessizce yesil gecmez.
//
// KULLANIM:
//   node scripts/bozma-dogrula.mjs <plan.json>
// plan.json bicimi:
//   { "test": "test_cls.mjs",
//     "bozmalar": [ { "ad": "...", "dosya": "style.css",
//                     "bul": "aranan tam metin", "koy": "yerine yazilacak" } ] }
// Her bozma icin: yedekle -> desen say (0 ise HARD-FAIL) -> uygula ->
// degisikligi DOGRULA -> testi kostur -> KIRMIZI bekle -> geri yukle.
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const planYolu = process.argv[2];
if (!planYolu) {
  console.error('[bozma] kullanim: node scripts/bozma-dogrula.mjs <plan.json>');
  process.exit(2);
}
const plan = JSON.parse(fs.readFileSync(planYolu, 'utf8'));
const testDosyasi = plan.test;
const bozmalar = plan.bozmalar || [];
if (!bozmalar.length) { console.error('[bozma] planda hic bozma yok'); process.exit(2); }

// Once testin YESIL oldugunu dogrula -- kirmizi bir testle bozma denemesi anlamsiz.
//
// KOSTURUCU UZANTIYA GORE SECILIYOR (2026-09-01'de duzeltildi). Onceki hali
// HER testi `process.execPath` (node) ile kosturuyordu; bir `.py` testi
// verildiginde node onu ayristiramiyor, cagri patliyor ve harness bunu
// "test zaten KIRMIZI" diye raporluyordu. Yani ALET, saglam bir testi bozuk
// gosteriyordu -- tam da bu harness'in var olma sebebi olan hata sinifi.
// (Olculdu: test_depot.py tek basina 22/0 YESIL iken harness KIRMIZI diyordu.)
// Windows'ta Python `py` launcher'i ile calisiyor; `python` bu makinede YOK.
function testKomutu() {
  if (testDosyasi.endsWith('.py')) return { cmd: 'py', args: [testDosyasi] };
  return { cmd: process.execPath, args: [testDosyasi] };
}
function testKosturVeSonuc() {
  const { cmd, args } = testKomutu();
  try { execFileSync(cmd, args, { stdio: 'pipe' }); return 'YESIL'; }
  catch { return 'KIRMIZI'; }
}
if (testKosturVeSonuc() !== 'YESIL') {
  console.error(`[bozma] HARD-FAIL: ${testDosyasi} bozma UYGULANMADAN once zaten KIRMIZI. Once onu duzelt.`);
  process.exit(1);
}
console.log(`[bozma] taban dogrulandi: ${testDosyasi} YESIL\n`);

let hata = 0;
for (const [i, b] of bozmalar.entries()) {
  const no = i + 1;
  const orijinal = fs.readFileSync(b.dosya, 'utf8');

  // 1) DESEN GERCEKTEN VAR MI -- harness'in kendi kor noktasi tam burasiydi.
  const parcalar = orijinal.split(b.bul);
  const eslesme = parcalar.length - 1;
  if (eslesme === 0) {
    console.error(`  ${no}) ${b.ad}`);
    console.error(`     HARD-FAIL: desen "${b.dosya}" icinde BULUNAMADI -> mutasyon uygulanamaz.`);
    console.error(`     aranan: ${JSON.stringify(b.bul.slice(0, 90))}`);
    hata++;
    continue;
  }

  // 2) UYGULA
  const bozuk = orijinal.replace(b.bul, b.koy);
  fs.writeFileSync(b.dosya, bozuk, 'utf8');

  // 3) DOSYA GERCEKTEN DEGISTI MI (yazma sonrasi diskten TEKRAR oku)
  const diskten = fs.readFileSync(b.dosya, 'utf8');
  const gercektenDegisti = diskten !== orijinal && diskten.includes(b.koy);
  if (!gercektenDegisti) {
    fs.writeFileSync(b.dosya, orijinal, 'utf8');
    console.error(`  ${no}) ${b.ad}`);
    console.error(`     HARD-FAIL: yazma sonrasi dosya beklenen halde DEGIL.`);
    hata++;
    continue;
  }

  // 4) TESTI KOSTUR -- KIRMIZI bekliyoruz
  const sonuc = testKosturVeSonuc();

  // 5) GERI YUKLE (her kosulda)
  fs.writeFileSync(b.dosya, orijinal, 'utf8');

  if (sonuc === 'KIRMIZI') {
    console.log(`  ${no}) KIRMIZI ✔  ${b.ad}   [${b.dosya}, ${eslesme} eslesme, mutasyon DOGRULANDI]`);
  } else {
    console.error(`  ${no}) YESIL ✘ GUARD KOR  ${b.ad}   [${b.dosya}, mutasyon uygulandi ama test yakalamadi]`);
    hata++;
  }
}

// Geri yukleme gercekten oldu mu
const sonDurum = testKosturVeSonuc();
if (sonDurum !== 'YESIL') {
  console.error(`\n[bozma] HARD-FAIL: tum bozmalardan sonra ${testDosyasi} KIRMIZI -- geri yukleme eksik kalmis olabilir.`);
  hata++;
} else {
  console.log(`\n[bozma] geri yukleme dogrulandi: ${testDosyasi} yine YESIL`);
}

console.log(`\n[bozma] SONUC: ${bozmalar.length - hata}/${bozmalar.length} bozma kirmiziya dondu`);
process.exit(hata ? 1 : 0);
