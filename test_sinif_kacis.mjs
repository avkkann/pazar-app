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
//   (c) asagidaki ISTISNALAR tablosunda (ham class deger METNIYLE, satir
//       numarasiyla DEGIL) KAYNAGI izlenmis gerekceyle kayitli olmali.
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

// ── ISTISNALAR (metin anahtarli) ────────────────────────────────────────
// Anahtar = ham class="..." DEGERININ TAM METNI (ör. 'profil-enflasyon
// ${r.yon}') -- SATIR NUMARASI DEGIL.
//
// NEDEN: bu tablo daha once satir numarasiyla anahtarliydi
// (SATIR_ISTISNALARI[2237], [2458], [2728]/[2728b], [4994]). Bu tur app.js'e
// zamOlcutu() eklenince ilgisiz bir duzenleme yuzunden istisnanin satiri
// 4967 -> 4994 kaydi ve tablo ELLE guncellenmek zorunda kaldi (bkz.
// gorev-4-report.md, YAPILACAK 1). Bu, koruma testlerinin OLME bicimidir:
// gercek bir ihlal olmadigi halde, sirf ondan onceki satir sayisi
// degistigi icin SATIR_ISTISNALARI[satir] eslesmesi kaybolup test
// kirmiziya donebiliyordu -- boyle bir "yalan soyleyen test" er ya da
// gec kapatilir, ve bu testin var olma sebebi (market verisinin class
// ozniteligine ham girmesini engellemek) o zaman kaybedilir.
//
// Ham deger metni, kod buyuyup satirlar kaysa bile DEGISMEDIGI icin
// anahtar olarak satir numarasindan daha guvenilir.
//
// NOT (ayni ifade, farkli yerler): rozet.tip degiskeni ayni SATIRDA iki
// FARKLI class metninde geciyor -- 'strip-card-rozet ${rozet.tip}' ve
// 'lc-dot ${rozet.tip}'. Deger METNI farkli oldugundan bunlar iki AYRI
// anahtar altinda tutuluyor (asagida), ama ikisinin de gerekcesi
// AYNIDIR (ayni ifade = ayni gerekce, kaynak ayni tuzakRozetiHesapla()).
// Metin-anahtarli tabloda bu artik DOGAL olarak kendi basina yeten birer
// kural: eskideki "satir numarasini bul, zaten gorulduyse '<satir>b'
// anahtarina bak" ozel-durum mantigina (gorulenSatirIkinci Set'i) hic
// gerek kalmadi.
const ISTISNALAR = {
  // lcIcon(name, klass): 25 cagri yeri tarandi (grep) -- her biri ya klass'i
  // hic vermiyor (varsayilan 'lc-icon' -- app.js kod SABITI) ya da sabit dize
  // literali geciyor ('lc-icon lc-icon-lg', 'lc-icon lc-icon-lg lc-amber' gibi).
  // Hicbir cagri market/urun/kullanici verisi gecirmiyor -- kaynagi TAMAMEN
  // kod icinde yazilmis sabitler, f.market/marketfiyati.org.tr veya baska
  // ucuncu taraf/kullanici girdisiyle hic temas etmiyor.
  '${c}': { gerekce: "lcIcon() klass parametresi: tum cagri yerlerinde sabit dize literali veya varsayilan 'lc-icon' -- veri gecmiyor" },
  // tazelikChipHTML: `sinif` degiskeni yalnizca if/else zincirinde 'taze' |
  // 'orta' | 'eski' SABIT dize literallerinden biri atanir (gun sayisina
  // gore secilir). u.son_senkron bir TARIH (Date uzerinden isleniyor), class
  // olarak DOGRUDAN kullanilan sey degil -- yalnizca hangi sabitin secilecegini
  // belirliyor. Kaynak kapali kume, veri gecisi yok.
  'tazelik-chip ${sinif}': { gerekce: "sinif degiskeni yalnizca 'taze'|'orta'|'eski' sabit dize literallerinden biri olabilir (if/else zinciri), veri gecmiyor" },
  // _stripKartHTML(u, rozet): rozet.tip TEK kaynaktan geliyor:
  // tuzakRozetiHesapla(u) -- ve bu fonksiyon SADECE {tip:'kirmizi',...} veya
  // {tip:'sari',...} donuyor (app.js icinde 2 return, ikisi de sabit dize
  // literali). scripts/anasayfa-uret.mjs de AYNI fonksiyonu cagirip ayni
  // kapali kumeyi uretiyor. Kaynak kapali kume, veri gecisi yok.
  'strip-card-rozet ${rozet.tip}': { gerekce: "rozet.tip SADECE tuzakRozetiHesapla()'nin dondugu 'kirmizi'|'sari' sabit literallerinden biri olabilir" },
  // ayni satirda ikinci kullanim (lc-dot), ayni kaynak/gerekce.
  'lc-dot ${rozet.tip}': { gerekce: "rozet.tip SADECE tuzakRozetiHesapla()'nin dondugu 'kirmizi'|'sari' sabit literallerinden biri olabilir (ayni satir, ikinci kullanim)" },
  // profilEnflasyonHTML: r.yon TEK kaynaktan geliyor: sepetEnflasyonuHesapla()
  // -- bu fonksiyon SADECE 'artis' | 'dusus' | 'sabit' sabit dize
  // literallerinden birini donuyor (ternary + erken return, hepsi literal).
  // Kaynak kapali kume, veri gecisi yok.
  'profil-enflasyon ${r.yon}': { gerekce: "r.yon SADECE sepetEnflasyonuHesapla()'nin dondugu 'artis'|'dusus'|'sabit' sabit literallerinden biri olabilir" },
};

console.log('\n=== 1. class="..." ICINDE ${...} INTERPOLASYONU TARANIYOR ===');
const tumu = tumClassDegerleri(APP);
console.log('  toplam class="..." + interpolasyon iceren yer: ' + tumu.length);

const ihlaller = [];
const kabulEdilenIstisnalar = [];
const kullanilanIstisnalar = new Set();

for (const { satir, deger } of tumu) {
  const parcalar = interpolasyonlariCikar(deger);
  for (const ifade of parcalar) {
    if (guvenliTernaryMi(ifade)) continue;
    if (marketSinifiCagrisiMi(ifade)) continue;
    // istisna tablosu artik ham deger METNIYLE anahtarli -- satir numarasi
    // rapor icin ayrica tasiniyor (asagida), eslesme icin kullanilmiyor.
    const ist = ISTISNALAR[deger];
    if (ist) {
      kabulEdilenIstisnalar.push({ satir, deger, gerekce: ist.gerekce });
      kullanilanIstisnalar.add(deger);
      continue;
    }
    ihlaller.push({ satir, fn: fnAdi(satir - 1), deger, ifade });
  }
}

console.log('\n=== 2. GUVENLI TERNARY / _marketSinifi() DISINDA IHLAL YOK ===');
ok('acik ihlal yok', ihlaller.length === 0,
  ihlaller.map(x => 'L' + x.satir + '  ' + x.fn + '  class="' + x.deger + '"  [ifade: ' + x.ifade + ']').join('\n        '));

console.log('\n=== 3. ISTISNALAR -- kaynagi izlenmis, metin anahtarli gerekceli ===');
ok('istisna sayisi beklenen (5 yer, 4 farkli degisken)', kabulEdilenIstisnalar.length === 5,
  'bulunan: ' + kabulEdilenIstisnalar.length + '\n        ' + kabulEdilenIstisnalar.map(x => 'L' + x.satir + ': ' + x.gerekce).join('\n        '));
for (const x of kabulEdilenIstisnalar) console.log('  ISTISNA  L' + x.satir + '  ' + x.deger + '\n           -> ' + x.gerekce);

// olu istisna kontrolu: tabloda tanimli ama kodda artik kullanilmayan bir
// kayit SESSIZCE durmasin -- zamanla coplugüe donen, kimsenin fark etmedigi
// bir tabloya donusmesin diye bu da FAIL sayilir.
const oluIstisnalar = Object.keys(ISTISNALAR).filter((k) => !kullanilanIstisnalar.has(k));
ok('olu istisna yok (tabloda var, kodda yok)', oluIstisnalar.length === 0,
  oluIstisnalar.map((k) => '"' + k + '" -> ' + ISTISNALAR[k].gerekce).join('\n        '));

console.log('\n=== 4. _marketSinifi TANIMLI VE TANINAN KODLARI BOZMUYOR ===');
{
  const b = APP.indexOf('function _marketSinifi(');
  ok('_marketSinifi tanimli', b >= 0);
  const b2 = APP.indexOf('function _marketEtiketiHTML(');
  ok('_marketEtiketiHTML tanimli', b2 >= 0);
}

console.log('\nPASS=' + pass + '  FAIL=' + fail);
process.exit(fail ? 1 : 0);
