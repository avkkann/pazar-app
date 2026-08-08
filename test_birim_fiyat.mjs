// Ozellik 1: birim fiyatta en iyiyi vurgulama.
// app.js'ten fonksiyon KAYNAGINI cikarip vm'de calistirir.
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

console.log('\n=== 0. MEVCUT DURUM (siralama zaten var) ===');
ok('siralama secenegi "birimfiyat" index.html\'de VAR', /data-value="birimfiyat"/.test(HTML));
ok('uygulaCatFiltre birimfiyat dalina sahip', /sir === 'birimfiyat'/.test(APP));
ok('hesaplanamayanlar sona atiliyor (grup 4)', /ga = ba \?[^;]*: 4/.test(APP.replace(/\s+/g, ' ')), '');

console.log('\n=== 1. enIyiBirimIdleri ===');
const varFn = !!fnKaynak('enIyiBirimIdleri');
ok('function enIyiBirimIdleri tanimli', varFn);

const U = (id, ad, agirlik, fiyat) => ({ _id: id, ad, agirlik_hacim: agirlik, market_fiyatlari: [{ market: 'bim', fiyat }] });

if (varFn) {
  const ctx = { console, Math, String, Number, parseFloat, parseInt, isNaN, Array, Object, Set };
  vm.createContext(ctx);
  vm.runInContext([fnKaynak('enDusukFiyat'), fnKaynak('birimFiyatHesapla'), fnKaynak('enIyiBirimIdleri')].join('\n'), ctx);
  const calis = i => vm.runInContext(i, ctx);
  const idler = liste => [...calis('enIyiBirimIdleri(' + JSON.stringify(liste) + ')')];

  // kg grubu: 3 urun, en dusuk birim fiyat kazanir
  const kgListe = [U('a', 'A', '1 KG', 100), U('b', 'B', '500 GR', 40), U('c', 'C', '2 KG', 300)];
  // a=100/kg, b=80/kg, c=150/kg -> b
  ok('kg grubunda en dusuk birim fiyat secildi (b)', JSON.stringify(idler(kgListe)) === '["b"]', JSON.stringify(idler(kgListe)));

  // iki farkli birim -> her gruptan bir kazanan
  const karma = [U('a', 'A', '1 KG', 100), U('b', 'B', '500 GR', 40),
                 U('c', 'C', '1 LT', 60), U('d', 'D', '500 ML', 20)];
  const r = idler(karma).sort();
  ok('kg ve L gruplarindan AYRI kazanan', JSON.stringify(r) === '["b","d"]', JSON.stringify(r));

  // tek elemanli grup -> kazanan YOK (birinin en iyisi olmak anlamsiz)
  ok('grupta tek urun varsa vurgulama YOK', idler([U('a', 'A', '1 KG', 100)]).length === 0, JSON.stringify(idler([U('a', 'A', '1 KG', 100)])));
  const tekli = [U('a', 'A', '1 KG', 100), U('c', 'C', '1 LT', 60)];
  ok('her grup tek elemanliysa hicbiri vurgulanmaz', idler(tekli).length === 0, JSON.stringify(idler(tekli)));

  // birim fiyati hesaplanamayan urunler hic girmez
  const bozuk = [U('a', 'A', '1 KG', 100), U('b', 'B', '500 GR', 40), { _id: 'z', ad: 'Z', agirlik_hacim: 'PAKET', market_fiyatlari: [{ market: 'bim', fiyat: 5 }] }];
  ok('hesaplanamayan urun kazanan olamaz', !idler(bozuk).includes('z'), JSON.stringify(idler(bozuk)));

  ok('bos liste -> bos set', idler([]).length === 0);
  ok('null liste -> patlamiyor', (() => { try { return [...calis('enIyiBirimIdleri(null)')].length === 0; } catch (e) { return false; } })());
}

console.log('\n=== 2. cardHTML VURGUYU CIZIYOR MU ===');
{
  const kart = fnKaynak('cardHTML') || '';
  ok('cardHTML _enIyiBirimSet okuyor', /_enIyiBirimSet/.test(kart), '');
  ok('vurgu mevcut .urun-birim-fiyat elemanina veriliyor', /urun-birim-fiyat[^`]*en-iyi/.test(kart), '');
  ok('YENI ROZET sinifi uydurulmadi', !/birim-rozet|en-iyi-rozet|badge-birim/.test(APP), '');
  ok('renk TEK gosterge degil, metin de var', /en ucuz/.test(kart), '');
}

console.log('\n=== 3. renderUrunler SETI KURUYOR MU ===');
{
  const rd = fnKaynak('renderUrunler') || '';
  ok('renderUrunler enIyiBirimIdleri cagiriyor', /enIyiBirimIdleri\s*\(/.test(rd), '');
  ok('  tum filtreli liste uzerinden (sayfa-1 degil)', /enIyiBirimIdleri\(liste\)/.test(rd.replace(/\s+/g, '')), rd.split('\n').filter(l => /enIyiBirim/.test(l)).join(' | '));
}

console.log('\n=== 4. DIGER EKRANLAR ETKILENMEDI ===');
{
  ok('_stripKartHTML birim vurgusu okumuyor', !/_enIyiBirimSet/.test(fnKaynak('_stripKartHTML') || ''));
  ok('_firsatKartHtml birim vurgusu okumuyor', !/_enIyiBirimSet/.test(fnKaynak('_firsatKartHtml') || ''));
}

console.log('\n=== 5. CSS ===');
{
  const k = (CSS.match(/[^\n{}]*\.urun-birim-fiyat[^{}]*\{[^}]*\}/g) || []).join('\n');
  ok('.urun-birim-fiyat.en-iyi kurali var', /en-iyi/.test(k), k.slice(0, 200));
  ok('mevcut yesil "best" dili (#059669) kullanildi', /#059669/i.test(k), k.slice(0, 300));
  ok('yeni palet getirilmedi', !/#(?!059669|86EFAC|0E4938)[0-9A-Fa-f]{6}/.test(k.replace(/\.urun-birim-fiyat[^{]*\{/g, '')), k.slice(0, 300));
}

console.log('\nPASS=' + pass + '  FAIL=' + fail);
process.exit(fail ? 1 : 0);
