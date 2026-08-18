// SINIF (class) OZNITELIGI KACIS KORUMASI.
// Bu, AYNI hatanin UCUNCU tekraridir:
//   1) m-tag'in METNI ham basiliyordu -> _kacir eklendi
//   2) _kacir eklenirken CLASS ozniteligi UNUTULDU -> class="m-tag m-<img ...>"
//   3) ikinci bir yer (_gizlenenFiyatHTML) hic dokunulmamisti, hem metin hem
//      class ham kaliyordu
// f.market marketfiyati.org.tr API -> scraper.py -> data/urunler_*.json
// uzerinden gelen UCUNCU TARAF dize. app.js'te artik TEK yardimci var:
// _marketSinifi (class icin beyaz liste) ve _marketEtiketiHTML (tam etiket).
// KURAL: class="..." icinde ${...} interpolasyonu geçen HER yer ya
//   (a) yalnizca dize LITERALLERI ureten bir ternary olmali (nested olabilir,
//       kosul kismi serbest -- sadece SONUCA veri sizmiyor mu diye bakiyoruz), ya da
//   (b) _marketSinifi(...) cagrisi olmali, ya da
//   (c) asagidaki ISTISNALAR listesinde (satir+ham deger eslesmesiyle) adiyla
//       ve KAYNAGI izlenmis gerekceyle kayitli olmali.
// Bunlarin disindaki HER interpolasyon ihlal sayilir.
import fs from 'fs';

const APP = fs.readFileSync('app.js', 'utf8');
const L = APP.split('\n');
let pass = 0, fail = 0;
const ok = (ad, k, d = '') => { if (k) { pass++; console.log('  PASS  ' + ad); } else { fail++; console.log('  FAIL  ' + ad + (d ? '\n        ' + d : '')); } };

function fnAdi(i) {
  for (let j = i; j >= 0; j--) { const m = L[j].match(/^\s*(?:async )?function (\w+)/); if (m) return m[1]; }
  return '(top)';
}

// class="..." degerlerini butun dosyadan cikar (offset -> satir no).
function tumClassDegerleri(kaynak) {
  const sonuc = [];
  const re = /class="/g;
  let m;
  while ((m = re.exec(kaynak))) {
    const bas = m.index + m[0].length;
    // basit deger: ic ice \" yok (template literal icinde class="..." hep
    // boyle -- proje genelinde onaylandi, bkz. arastirma notu asagida).
    const son = kaynak.indexOf('"', bas);
    if (son < 0) continue;
    const deger = kaynak.slice(bas, son);
    if (deger.includes('${')) {
      const satir = kaynak.slice(0, m.index).split('\n').length;
      sonuc.push({ satir, deger, ofset: m.index });
    }
  }
  return sonuc;
}

// deger icindeki ${...} bloklarini (balanced brace) cikarir.
function interpolasyonlariCikar(deger) {
  const sonuc = [];
  for (let i = 0; i < deger.length; i++) {
    if (deger[i] === '$' && deger[i + 1] === '{') {
      let derinlik = 1, j = i + 2;
      for (; j < deger.length && derinlik > 0; j++) {
        if (deger[j] === '{') derinlik++;
        else if (deger[j] === '}') derinlik--;
      }
      sonuc.push(deger.slice(i + 2, j - 1));
      i = j - 1;
    }
  }
  return sonuc;
}

// "cond ? 'literal' : (baska bir guvenli ternary | 'literal')" -- nested
// olabilir. Kosul kismi serbest (sonuca sizmiyor); yalnizca SONUC dallari
// dize literali olmak ZORUNDA. Kosulda ust duzey ':' veya '?' varsa (ör.
// nesne literali) once tirnaklari/paranlari atlayarak ust duzey '?' bulunur.
function guvenliTernaryMi(ifade) {
  const s = ifade.trim();
  const q = ustDuzeyBul(s, '?');
  if (q < 0) return false; // ternary degil -> bu fonksiyonun kapsaminda degil
  let i = q + 1;
  while (s[i] === ' ') i++;
  const tirnak = s[i];
  if (tirnak !== "'" && tirnak !== '"' && tirnak !== '`') return false;
  let j = i + 1;
  while (j < s.length && s[j] !== tirnak) { if (s[j] === '\\') j++; j++; }
  if (s[j] !== tirnak) return false;
  const thenSon = j + 1;
  let k = thenSon;
  while (s[k] === ' ') k++;
  if (s[k] !== ':') return false;
  const elseIfade = s.slice(k + 1).trim();
  // else dali: ya duz bir dize literali ya da baska guvenli bir ternary
  if (/^(['"`])(?:\\.|(?!\1).)*\1$/.test(elseIfade)) return true;
  return guvenliTernaryMi(elseIfade);
}

// tirnak/paren/koseli parantez icini atlayarak ust duzeyde ilk `ch` konumu.
function ustDuzeyBul(s, ch) {
  let derinlik = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === "'" || c === '"' || c === '`') {
      i++;
      while (i < s.length && s[i] !== c) { if (s[i] === '\\') i++; i++; }
      continue;
    }
    if (c === '(' || c === '[' || c === '{') derinlik++;
    else if (c === ')' || c === ']' || c === '}') derinlik--;
    else if (c === ch && derinlik === 0) return i;
  }
  return -1;
}

function marketSinifiCagrisiMi(ifade) {
  return /^_marketSinifi\(.*\)$/.test(ifade.trim());
}

// ── ISTISNALAR ────────────────────────────────────────────────────────
// Her biri (satir, ham class degeri) eslesmesiyle kilitli -- baska bir
// satirda ayni degisken adiyla YENI bir data-kaynakli kullanim gelirse
// eslesmez ve ihlal olarak yakalanir. Gerekce: kaynagin NEREDEN geldigi.
const ISTISNALAR = [
  {
    satir: null, degerIcerir: 'svg class="${c}"',
    // asagida gercek arama satir bazli yapiliyor, bu obje sadece dokuman.
  },
];

// Satir bazli, ozel gerekceli istisna tablosu: anahtar = satir numarasi,
// deger = { deger: ham class degeri (dogrulama), gerekce: string }
const SATIR_ISTISNALARI = {
  // lcIcon(name, klass): 25 cagri yeri tarandi (grep) -- her biri ya klass'i
  // hic vermiyor (varsayilan 'lc-icon' -- app.js kod SABITI) ya da sabit dize
  // literali geciyor ('lc-icon lc-icon-lg', 'lc-icon lc-icon-lg lc-amber' gibi).
  // Hicbir cagri market/urun/kullanici verisi gecirmiyor -- kaynagi TAMAMEN
  // kod icinde yazilmis sabitler, f.market/marketfiyati.org.tr veya baska
  // ucuncu taraf/kullanici girdisiyle hic temas etmiyor.
  2237: { deger: '${c}', gerekce: "lcIcon() klass parametresi: tum cagri yerlerinde sabit dize literali veya varsayilan 'lc-icon' -- veri gecmiyor" },
  // tazelikChipHTML: `sinif` degiskeni yalnizca if/else zincirinde 'taze' |
  // 'orta' | 'eski' SABIT dize literallerinden biri atanir (gun sayisina
  // gore secilir). u.son_senkron bir TARIH (Date uzerinden isleniyor), class
  // olarak DOGRUDAN kullanilan sey degil -- yalnizca hangi sabitin secilecegini
  // belirliyor. Kaynak kapali kume, veri gecisi yok.
  2458: { deger: 'tazelik-chip ${sinif}', gerekce: "sinif degiskeni yalnizca 'taze'|'orta'|'eski' sabit dize literallerinden biri olabilir (if/else zinciri), veri gecmiyor" },
  // _stripKartHTML(u, rozet): rozet.tip TEK kaynaktan geliyor:
  // tuzakRozetiHesapla(u) -- ve bu fonksiyon SADECE {tip:'kirmizi',...} veya
  // {tip:'sari',...} donuyor (app.js icinde 2 return, ikisi de sabit dize
  // literali). scripts/anasayfa-uret.mjs de AYNI fonksiyonu cagirip ayni
  // kapali kumeyi uretiyor. Kaynak kapali kume, veri gecisi yok.
  2728: { deger: 'strip-card-rozet ${rozet.tip}', gerekce: "rozet.tip SADECE tuzakRozetiHesapla()'nin dondugu 'kirmizi'|'sari' sabit literallerinden biri olabilir" },
  // ayni satirda ikinci kullanim (lc-dot), ayni kaynak/gerekce.
  '2728b': { deger: 'lc-dot ${rozet.tip}', gerekce: "rozet.tip SADECE tuzakRozetiHesapla()'nin dondugu 'kirmizi'|'sari' sabit literallerinden biri olabilir (ayni satir, ikinci kullanim)" },
  // profilEnflasyonHTML: r.yon TEK kaynaktan geliyor: sepetEnflasyonuHesapla()
  // -- bu fonksiyon SADECE 'artis' | 'dusus' | 'sabit' sabit dize
  // literallerinden birini donuyor (ternary + erken return, hepsi literal).
  // Kaynak kapali kume, veri gecisi yok.
  4967: { deger: 'profil-enflasyon ${r.yon}', gerekce: "r.yon SADECE sepetEnflasyonuHesapla()'nin dondugu 'artis'|'dusus'|'sabit' sabit literallerinden biri olabilir" },
};

console.log('\n=== 1. class="..." ICINDE ${...} INTERPOLASYONU TARANIYOR ===');
const tumu = tumClassDegerleri(APP);
console.log('  toplam class="..." + interpolasyon iceren yer: ' + tumu.length);

const ihlaller = [];
const kabulEdilenIstisnalar = [];
const gorulenSatirIkinci = new Set();

for (const { satir, deger } of tumu) {
  const parcalar = interpolasyonlariCikar(deger);
  for (const ifade of parcalar) {
    if (guvenliTernaryMi(ifade)) continue;
    if (marketSinifiCagrisiMi(ifade)) continue;
    // istisna tablosu: aynı satirda birden fazla ${} varsa (2728 gibi) ikinci
    // kaydi '<satir>b' anahtariyla ariyoruz.
    let anahtar = satir;
    if (SATIR_ISTISNALARI[anahtar] && gorulenSatirIkinci.has(anahtar)) anahtar = satir + 'b';
    const ist = SATIR_ISTISNALARI[anahtar];
    if (ist && ist.deger === deger) {
      kabulEdilenIstisnalar.push({ satir, deger, gerekce: ist.gerekce });
      gorulenSatirIkinci.add(satir);
      continue;
    }
    ihlaller.push({ satir, fn: fnAdi(satir - 1), deger, ifade });
  }
}

console.log('\n=== 2. GUVENLI TERNARY / _marketSinifi() DISINDA IHLAL YOK ===');
ok('acik ihlal yok', ihlaller.length === 0,
  ihlaller.map(x => 'L' + x.satir + '  ' + x.fn + '  class="' + x.deger + '"  [ifade: ' + x.ifade + ']').join('\n        '));

console.log('\n=== 3. ISTISNALAR -- kaynagi izlenmis, tek satir gerekceli ===');
ok('istisna sayisi beklenen (5 yer, 4 farkli degisken)', kabulEdilenIstisnalar.length === 5,
  'bulunan: ' + kabulEdilenIstisnalar.length + '\n        ' + kabulEdilenIstisnalar.map(x => 'L' + x.satir + ': ' + x.gerekce).join('\n        '));
for (const x of kabulEdilenIstisnalar) console.log('  ISTISNA  L' + x.satir + '  ' + x.deger + '\n           -> ' + x.gerekce);

console.log('\n=== 4. _marketSinifi TANIMLI VE TANINAN KODLARI BOZMUYOR ===');
{
  const b = APP.indexOf('function _marketSinifi(');
  ok('_marketSinifi tanimli', b >= 0);
  const b2 = APP.indexOf('function _marketEtiketiHTML(');
  ok('_marketEtiketiHTML tanimli', b2 >= 0);
}

console.log('\nPASS=' + pass + '  FAIL=' + fail);
process.exit(fail ? 1 : 0);
