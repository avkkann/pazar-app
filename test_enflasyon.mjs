// Ozellik 2: "Senin enflasyonun" karti.
import fs from 'fs';
import vm from 'vm';

const APP = fs.readFileSync('app.js', 'utf8');
const HTML = fs.readFileSync('index.html', 'utf8');
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

const GEREKEN = ['sepetEnflasyonuHesapla', 'profilEnflasyonHTML', 'paylasEnflasyon'];
console.log('\n=== 0. YAPI ===');
const eksik = [];
for (const f of GEREKEN) { const v = !!fnKaynak(f); ok('function ' + f, v); if (!v) eksik.push(f); }
if (eksik.length) { console.log('\n  Eksik: ' + eksik.join(', ')); console.log('\nPASS=' + pass + '  FAIL=' + fail); process.exit(1); }

const gun = n => { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); };

function kur(sepet, gecmis) {
  const ctx = {
    console, Math, Date, JSON, Array, Object, Number, String, isNaN, parseFloat, Set,
    sepet, _gecmisCache: gecmis,
    tl: v => Number(v).toFixed(2).replace('.', ',') + ' ₺',
    lcIcon: () => '<svg></svg>',
    fiyatlariTemizle: mf => ({ gecerli: (mf || []).filter(f => f && f.fiyat != null), gizlenen: [] }),
    navigator: {}, window: {},
  };
  vm.createContext(ctx);
  // Yardimci fonksiyon ve esik sabiti de app.js'ten gelmeli.
  const esik = (APP.match(/const ENFLASYON_MIN_URUN\s*=\s*(\d+)/) || [])[1] || '3';
  vm.runInContext([
    'const ENFLASYON_MIN_URUN = ' + esik + ';',
    fnKaynak('_yerelGunISO'),
    fnKaynak('_otuzGunOncekiEnUcuz'),
    fnKaynak('sepetEnflasyonuHesapla'),
    fnKaynak('profilEnflasyonHTML'),
  ].join('\n'), ctx);
  return ctx;
}
const calis = (ctx, i) => vm.runInContext(i, ctx);

// urun: bugun en ucuz = min(market_fiyatlari)
const U = (sid, ad, bugun) => ({ _sid: sid, ad, market_fiyatlari: [{ market: 'bim', fiyat: bugun }] });
// gecmis: 30 gun ONCESINE ait kayit (carry-forward icin <=30 gun)
const G = (eski) => [{ t: gun(45), m: 'bim', f: eski }];

console.log('\n=== 1. HESAP ===');
{
  // 3 urun: 100->110 (+10), 50->40 (-10), 50->55 (+5)  => eski 200, yeni 205 => +%2.5
  const sepet = [U('a', 'A', 110), U('b', 'B', 40), U('c', 'C', 55)];
  const gec = { a: G(100), b: G(50), c: G(50) };
  const r = calis(kur(sepet, gec), 'sepetEnflasyonuHesapla()');
  ok('eski toplam 200', r.eskiToplam === 200, JSON.stringify(r));
  ok('yeni toplam 205', r.yeniToplam === 205, JSON.stringify(r));
  ok('yuzde +2.5', Math.abs(r.yuzde - 2.5) < 0.01, JSON.stringify(r));
  ok('katilan 3 / toplam 3', r.katilan === 3 && r.toplam === 3, JSON.stringify(r));
  ok('yon = artis', r.yon === 'artis', JSON.stringify(r));
}
{
  // dusus
  const sepet = [U('a', 'A', 90), U('b', 'B', 45), U('c', 'C', 45)];
  const gec = { a: G(100), b: G(50), c: G(50) };
  const r = calis(kur(sepet, gec), 'sepetEnflasyonuHesapla()');
  ok('dusus -> yon = dusus', r.yon === 'dusus', JSON.stringify(r));
  ok('  yuzde negatif', r.yuzde < 0, JSON.stringify(r));
}

console.log('\n=== 2. 30 GUNLUK GECMISI OLMAYANLAR HESABA KATILMIYOR ===');
{
  const sepet = [U('a', 'A', 110), U('b', 'B', 40), U('c', 'C', 55), U('d', 'D', 99), U('e', 'E', 99)];
  const gec = { a: G(100), b: G(50), c: G(50) };   // d,e gecmissiz
  const r = calis(kur(sepet, gec), 'sepetEnflasyonuHesapla()');
  ok('katilan 3, toplam 5', r.katilan === 3 && r.toplam === 5, JSON.stringify(r));
  ok('  gecmissiz urun toplama girmedi (eski=200)', r.eskiToplam === 200, JSON.stringify(r));
  const h = calis(kur(sepet, gec), 'profilEnflasyonHTML()');
  ok('  kartta "5 üründen 3\'ü hesaba katıldı" yaziyor', /5 ürün/.test(h) && /3/.test(h), h.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' '));
}
{
  // sadece 30 GUNDEN YENI kaydi olan urun katilmamali
  const sepet = [U('a', 'A', 110), U('b', 'B', 40), U('c', 'C', 55), U('y', 'Y', 10)];
  const gec = { a: G(100), b: G(50), c: G(50), y: [{ t: gun(3), m: 'bim', f: 8 }] };
  const r = calis(kur(sepet, gec), 'sepetEnflasyonuHesapla()');
  ok('sadece son 3 gunluk kaydi olan urun KATILMADI', r.katilan === 3, JSON.stringify(r));
}

console.log('\n=== 3. 3\'TEN AZ URUN -> KART HIC YOK ===');
for (const n of [0, 1, 2]) {
  const sepet = [U('a', 'A', 110), U('b', 'B', 40), U('c', 'C', 55)];
  const gec = {};
  ['a', 'b', 'c'].slice(0, n).forEach(s => { gec[s] = G(100); });
  const h = calis(kur(sepet, gec), 'profilEnflasyonHTML()');
  ok('katilan=' + n + ' -> kart bos string', h === '', JSON.stringify(h).slice(0, 80));
}
{
  const sepet = [U('a', 'A', 110), U('b', 'B', 40), U('c', 'C', 55)];
  const h = calis(kur(sepet, { a: G(100), b: G(50), c: G(50) }), 'profilEnflasyonHTML()');
  ok('katilan=3 -> kart VAR', h !== '' && /enflasyon/i.test(h), h.slice(0, 120));
}

console.log('\n=== 4. SEPET BOSSA KART YOK ===');
ok('sepet bos -> kart bos', calis(kur([], {}), 'profilEnflasyonHTML()') === '');
ok('sepet bos -> hesap null/0 katilan', (() => { const r = calis(kur([], {}), 'sepetEnflasyonuHesapla()'); return !r || r.katilan === 0; })());

console.log('\n=== 5. RENK YONU (dusus yesil / artis amber), KIRMIZI YOK ===');
{
  const artis = calis(kur([U('a', 'A', 110), U('b', 'B', 60), U('c', 'C', 60)], { a: G(100), b: G(50), c: G(50) }), 'profilEnflasyonHTML()');
  const dusus = calis(kur([U('a', 'A', 90), U('b', 'B', 45), U('c', 'C', 45)], { a: G(100), b: G(50), c: G(50) }), 'profilEnflasyonHTML()');
  ok('artis kartinda "artis" sinifi', /artis/.test(artis), artis.slice(0, 120));
  ok('dusus kartinda "dusus" sinifi', /dusus/.test(dusus), dusus.slice(0, 120));
  const k = (CSS.match(/[^\n{}]*\.profil-enflasyon[^{}]*\{[^}]*\}/g) || []).join('\n');
  ok('CSS kurallari var', k.length > 40, 'uzunluk=' + k.length);
  ok('KIRMIZI kullanilmadi', !/#(DC2626|dc2626|EF4444|ef4444|B91C1C)/.test(k), k.slice(0, 200));
  ok('dusus yesil (#059669)', /#059669/i.test(k), '');
  ok('artis amber (D97706/92400E/B45309)', /#(D97706|92400E|B45309|d97706|92400e|b45309)/.test(k), '');
}

console.log('\n=== 6. PAYLAS: MEVCUT DESEN ===');
{
  const p = fnKaynak('paylasEnflasyon') || '';
  ok('navigator.share kullaniyor', /navigator\.share/.test(p), '');
  ok('yeni paylasim altyapisi kurulmadi (paylasSepet deseni)', /navigator\.share/.test(fnKaynak('paylasSepet') || ''), '');
  ok('metin rakam odakli (%) iceriyor', /%/.test(p), '');
  ok('kartta paylas butonu var', /paylasEnflasyon/.test(APP.slice(APP.indexOf('function profilEnflasyonHTML'), APP.indexOf('function profilEnflasyonHTML') + 1800)), '');
}

console.log('\n=== 7. YER: TASARRUF KARTININ HEMEN ALTI ===');
{
  const p = HTML.slice(HTML.indexOf('id="screen-profil"'), HTML.indexOf('id="install-banner"'));
  const iT = p.indexOf('id="profil-tasarruf"');
  const iE = p.indexOf('id="profil-enflasyon"');
  const iK = p.indexOf('profil-kartlar');
  ok('#profil-enflasyon var', iE > -1);
  ok('tasarruf kartinin ALTINDA', iE > iT, 'tasarruf=' + iT + ' enflasyon=' + iE);
  ok('profil-kartlar grid\'inin USTUNDE (tam genislik)', iE < iK, 'enflasyon=' + iE + ' kartlar=' + iK);
  ok('profilBolumleriCiz enflasyonu ciziyor', /profil-enflasyon/.test(fnKaynak('profilBolumleriCiz') || ''), '');
}

console.log('\nPASS=' + pass + '  FAIL=' + fail);
process.exit(fail ? 1 : 0);
