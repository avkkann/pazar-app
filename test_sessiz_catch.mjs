// SESSIZ CATCH KORUMASI.
// Bu desen projeye UC KEZ pahaliya mal oldu:
//   temizlik kategorisi bolunmesi  -> 3 hafta bayat veri
//   Searlo kredisi bitmesi         -> 74 gun bosa istek (gecede 950)
//   loadData / #halDate TypeError  -> 1 ay boyunca .then govdesi hic kosmadi
// KURAL: her catch ya console.warn/error ile GORUNUR olacak, ya da NEDEN
// sessiz oldugunu aciklayan bir yorum tasiyacak. Ciplak `catch(e){}` YASAK.
import fs from 'fs';

const APP = fs.readFileSync('app.js', 'utf8');
const L = APP.split('\n');
let pass = 0, fail = 0;
const ok = (ad, k, d = '') => { if (k) { pass++; console.log('  PASS  ' + ad); } else { fail++; console.log('  FAIL  ' + ad + (d ? '\n        ' + d : '')); } };

function fnAdi(i) {
  for (let j = i; j >= 0; j--) { const m = L[j].match(/^\s*(?:async )?function (\w+)/); if (m) return m[1]; }
  return '(top)';
}
// catch govdesini kabaca cikar (ayni satir + sonraki 5 satir yeterli)
function govde(i) { return L.slice(i, i + 6).join('\n'); }

const ciplak = [], aciklamasiz = [];
L.forEach((l, i) => {
  if (!/catch\s*[\(\{]/.test(l)) return;
  const g = govde(i);
  const konsol = /console\.(warn|error|log)/.test(g);
  // ciplak: catch(e){} veya catch{} — ayni satirda, icinde hicbir sey yok
  if (/catch\s*\(\s*\w*\s*\)\s*\{\s*\}|catch\s*\{\s*\}/.test(l)) { ciplak.push({ n: i + 1, fn: fnAdi(i), kod: l.trim().slice(0, 78) }); return; }
  if (konsol) return;
  // konsol yoksa ACIKLAYICI yorum sart: ayni satirda /* ... */ veya ustunde //
  const ayniSatir = (l.match(/\/\*([^*]*)\*\//) || [])[1] || '';
  // 2026-09-03: desenlere \r EKLENDI. app.js CRLF satir sonu kullaniyor ve
  // JS'te `.` satir sonlandiricisini (\r dahil) ESLEMEZ; `(.*)$` \r'nin
  // onunde duruyor, `$` ise dize sonunu bekliyordu -> IKI DAL DA HIC
  // ESLESMIYORDU. Yani bu bekcinin "ustteki yorum" ve "alttaki yorum"
  // yollari bu depoda BASTAN BERI OLUYDU; kimse fark etmedi cunku o gune
  // kadar hicbir catch o yolu kullanmamisti (gecenlerin hepsi ya
  // console.warn tasiyor ya ayni satirda /* */ yorumu). Bekci GEVSEMEDI,
  // aksine iki tespit yolu ilk kez gercekten calisiyor.
  const ustSatir = (L[i - 1] || '').match(/^\s*\/\/(.*?)\r?$/);
  const sonraki = (L[i + 1] || '').match(/^\s*\/\/(.*?)\r?$/) || (L[i + 1] || '').match(/\/\*([^*]*)\*\//);
  const aciklama = (ayniSatir + ' ' + (ustSatir ? ustSatir[1] : '') + ' ' + (sonraki ? sonraki[1] : '')).trim();
  // "sessiz" / "yoksay" tek basina aciklama DEGIL — NEDEN yazilmali
  const yeterli = aciklama.length >= 18 && !/^(sessiz|yoksay|sessiz düş|yok say)\.?$/i.test(aciklama);
  if (!yeterli) aciklamasiz.push({ n: i + 1, fn: fnAdi(i), kod: l.trim().slice(0, 70), acik: aciklama.slice(0, 40) });
});

console.log('\n=== 1. CIPLAK catch(e){} YASAK ===');
ok('ciplak catch yok', ciplak.length === 0,
  ciplak.map(x => 'L' + x.n + '  ' + x.fn + '  ' + x.kod).join('\n        '));

console.log('\n=== 2. SESSIZ catch NEDENINI YAZMALI ===');
ok('aciklamasiz sessiz catch yok', aciklamasiz.length === 0,
  aciklamasiz.map(x => 'L' + x.n + '  ' + x.fn + '  ' + x.kod + '   [aciklama: "' + x.acik + '"]').join('\n        '));

console.log('\n=== 3. KULLANICI VERISI KAYBEDEN YERLER GORUNUR OLMALI ===');
// Bu fonksiyonlarda hata olursa kullanici bir sey KAYBEDER -> console sart
const KRITIK = ['loadPazarProfile', 'loadPazarFavoriler', 'fiyatBildirimleriYukle',
  'profilVerileriniYukle', 'gecmisVeriGetir', 'supheliPuanlariYukle'];
for (const fn of KRITIK) {
  const b = APP.indexOf('function ' + fn + '(');
  if (b < 0) { ok(fn + ' bulundu', false); continue; }
  let d = 0, son = b;
  for (let j = APP.indexOf('{', b); j < APP.length; j++) {
    const c = APP[j]; if (c === '{') d++; else if (c === '}') { d--; if (d === 0) { son = j + 1; break; } }
  }
  const src = APP.slice(b, son);
  if (!/catch/.test(src)) { ok(fn + ' (catch yok, gecerli)', true); continue; }
  ok(fn + ' hatayi GORUNUR yapiyor', /console\.(warn|error)/.test(src), '');
}

console.log('\n=== 4. MESAJ KALITESI: anlamsiz sayac YOK ===');
// "950 hata" gibi tek sayi basan degil, NE oldugunu soyleyen mesaj
const konsolCagri = APP.match(/console\.(warn|error)\([^)]{0,140}/g) || [];
const zayif = konsolCagri.filter(c => {
  const icerik = c.replace(/console\.(warn|error)\(/, '');
  // yalnizca degisken basan veya 12 karakterden kisa sabit metinli
  const metin = (icerik.match(/'([^']*)'|"([^"]*)"|`([^`]*)`/) || [])[0] || '';
  return metin.replace(/['"`]/g, '').trim().length < 12;
});
ok('her console.warn/error anlamli metin tasiyor', zayif.length === 0,
  zayif.slice(0, 6).join('\n        '));
console.log('    toplam console.warn/error: ' + konsolCagri.length);

console.log('\nPASS=' + pass + '  FAIL=' + fail);
process.exit(fail ? 1 : 0);
