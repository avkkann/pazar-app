// TURKCE EK UYUMU.
//
// KUSUR (denetim, yuksek): ekler metne SABIT yazilmisti:
//   "Bugün 14:30'te güncellendi"    -> dogrusu "14:30'da"  ("otuz" kalin)
//   "3 üründen 3'i hesaba katıldı"  -> dogrusu "3'ü"       ("üç" ince-yuvarlak)
//   "Kayseri'da bulunan marketler"  -> dogrusu "Kayseri'de"
// Uygulamanin tamami Turkce ve tek vaadi guven; ek uyumu bozuk metin
// dogrudan "bunu makine yazmis" izlenimi veriyor.
//
// Test DAVRANISSAL: app.js'in GERCEK _ek fonksiyonu node:vm'de kosturulur.
// Kontrol grubu gomulu -- once aletin YANLIS eki de gorebildigi gosteriliyor.

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
// `const AD = ...;` ya da `const AD = { ... };` govdesini cikar.
function sabit(ad) {
  // Hizalama icin fazladan bosluk kullanilabiliyor (`const _EK_INCE  = ...`),
  // bu yuzden tek boslukla arama YETMEZ.
  const m = new RegExp('const\\s+' + ad + '\\s*=').exec(APP);
  if (!m) throw new Error('sabit yok: ' + ad);
  const i = m.index;
  const suslu = APP.indexOf('{', i);
  const noktali = APP.indexOf(';', i);
  if (suslu > 0 && suslu < noktali) {
    let d = 0;
    for (let j = suslu; j < APP.length; j++) {
      if (APP[j] === '{') d++;
      else if (APP[j] === '}') { d--; if (d === 0) return APP.slice(i, j + 2); }
    }
  }
  return APP.slice(i, noktali + 1);
}

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

const ctx = { Math, Number, String, console };
vm.createContext(ctx);
vm.runInContext([
  sabit('_EK_KALIN'), sabit('_EK_INCE'), sabit('_EK_SESLI'), sabit('_EK_SERT'), sabit('_EK_SAYI'),
  govde('_ekSayiSes'), govde('_ekSes'), govde('_ek')
].join('\n'), ctx);
ctx.__ek = (m, t) => vm.runInContext('_ek(__m, __t)', Object.assign(ctx, { __m: m, __t: t }));
const ek = (m, t) => ctx.__ek(m, t);

function tablo(baslik, tur, cift) {
  console.log('\n=== ' + baslik + ' ===');
  const yanlis = [];
  for (const [girdi, beklenen] of cift) {
    const c = ek(girdi, tur);
    if (c !== beklenen) yanlis.push(`${girdi}'${c} (beklenen '${beklenen})`);
  }
  ok(`${cift.length} ornegin hepsi dogru`, yanlis.length === 0, yanlis.join(' | '));
  return yanlis.length === 0;
}

// ─────────────────────────────────────────────────────────────────────
console.log('\n=== 0. ALET KONTROLU ===');
{
  // Alet YANLIS eki de gorebilmeli; her seye "dogru" diyen bir kontrol
  // asagidaki tablolari anlamsizlastirirdi.
  ok('alet yanlis eki AYIRT EDIYOR', ek('14:30', 'de') !== 'te', ek('14:30', 'de'));
  ok('  bilinmeyen ek turu bos donuyor', ek('3', 'yok') === '');
  ok('  bos girdi patlatmiyor', typeof ek('', 'de') === 'string' && typeof ek(null, 'i') === 'string');
}

// BULUNMA: -de / -da / -te / -ta
tablo('1. SAAT (bulunma)', 'de', [
  ['14:30', 'da'],   // "otuz" kalin, z yumusak
  ['09:05', 'te'],   // "bes" ince, s sert
  ['12:40', 'ta'],   // "kirk" kalin, k SERT
  ['10:03', 'te'],   // "uc" ince, c sert
  ['08:09', 'da'],   // "dokuz" kalin, z yumusak
  ['23:07', 'de'],   // "yedi" ince, sesli bitis
  ['06:20', 'de'],   // "yirmi" ince
  ['18:50', 'de'],   // "elli" ince
  ['21:60', 'ta'],   // "altmis" kalin + sert
  ['00:70', 'te'],   // "yetmis" ince + sert
  ['11:80', 'de'],   // "seksen" ince
  ['15:90', 'da'],   // "doksan" kalin
]);

console.log('\n=== 1b. TAM SAAT: dakika okunmaz ===');
{
  // "14:00" -> "saat on dortTE"; dakikaya bakan bir kural "sifir" okuyup
  // 'da derdi. Bu ozel durum bilerek var.
  ok("14:00 -> 'te (saate gore)", ek('14:00', 'de') === 'te', ek('14:00', 'de'));
  ok("  10:00 -> 'da (on)", ek('10:00', 'de') === 'da', ek('10:00', 'de'));
  ok("  07:00 -> 'de (yedi)", ek('07:00', 'de') === 'de', ek('07:00', 'de'));
  // KONTROL: dakika sifir DEGILSE yine dakikaya bakiyor
  ok('  KONTROL: 14:30 dakikaya gore', ek('14:30', 'de') === 'da', ek('14:30', 'de'));
}

tablo('2. SEHIR ADI (bulunma)', 'de', [
  ['İstanbul', 'da'], ['Kayseri', 'de'], ['Sinop', 'ta'], ['İzmir', 'de'],
  ['Bursa', 'da'],    ['Erzurum', 'da'], ['Uşak', 'ta'],  ['Muğla', 'da'],
  ['Düzce', 'de'],    ['Tokat', 'ta'],   ['Ankara', 'da'], ['Trabzon', 'da'],
  ['Eskişehir', 'de'], ['Gaziantep', 'te'], ['Şırnak', 'ta'], ['Nevşehir', 'de'],
]);

tablo('3. SAYI (belirtme)', 'i', [
  ['3', 'ü'],   // uc
  ['1', 'i'],   // bir
  ['5', 'i'],   // bes
  ['6', 'yı'],  // alti (sesli bitis -> kaynastirma y)
  ['7', 'yi'],  // yedi
  ['9', 'u'],   // dokuz
  ['10', 'u'],  // on
  ['40', 'ı'],  // kirk
  ['100', 'ü'], // yuz
  ['1000', 'i'],// bin
  ['2', 'yi'],  // iki
  ['0', 'ı'],   // sifir
  ['4', 'ü'],   // dort
  ['8', 'i'],   // sekiz
  ['20', 'yi'], // yirmi
  ['1230', 'u'],// "... otuz"
]);

tablo('4. SAYI (tamlayan)', 'in', [
  ['3', 'ün'], ['6', 'nın'], ['10', 'un'], ['100', 'ün'], ['40', 'ın'], ['2', 'nin'],
]);

console.log('\n=== 5. CAGRI YERLERI: sabit ek KALMADI ===');
{
  const T = kodTemiz(APP);
  ok("saat metni _ek kullaniyor", /\$\{ss\}'\$\{_ek\(ss, 'de'\)\}/.test(T), 'sabit ek kalmis');
  ok('  enflasyon sayisi _ek kullaniyor',
     /\$\{r\.katilan\}'\$\{_ek\(r\.katilan, 'i'\)\}/.test(T), 'sabit ek kalmis');
  ok('  sehir notu _ek kullaniyor',
     /\$\{_kacir\(_sehir\)\}'\$\{_ek\(_sehir, 'de'\)\}/.test(T), 'sabit ek kalmis');
  // Ek HAM degerden turetilmeli: _kacir ciktisi `&#39;` gibi biterse son ses
  // yanlis okunur ve ek bozulur.
  ok('  sehir ekinde HAM deger kullaniliyor (_kacir DEGIL)',
     !/_ek\(_kacir\(/.test(T), '_kacir edilmis deger _ek e veriliyor');
}

console.log('\n=== 6. KONTROL GRUBU: eski sabit ekler geri gelmedi ===');
{
  const T = kodTemiz(APP);
  for (const [desen, ad] of [
    [/\$\{ss\}'te/, "saat: sabit 'te"],
    [/\$\{r\.katilan\}'i\b/, "enflasyon: sabit 'i"],
    [/\$\{_kacir\(_sehir\)\}'da/, "sehir: sabit 'da"]])
    ok('  ' + ad + ' YOK', !desen.test(T), 'geri gelmis');
}

console.log('\nPASS=' + GECTI + '  FAIL=' + KALDI);
process.exit(KALDI ? 1 : 0);
