// ARAMA: eslesme + puanlama koruma testi.
//
// OLCULEN BOZUKLUK (2026-08-25, canli veriyle): ana arama UC DALLIYDI ve ILK
// DAL URUN ADINA HIC BAKMIYORDU. KART_GRUP tablosunda 'kola' -> 'icecek'
// yazdigi icin "kola" sorgusu TUM ICECEK kategorisini donduruyordu:
//   "kola" = "cay" = "su" = "kahve" = "icecek"  -> BESI DE ayni 1973 sonuc,
//   ayni sirayla. "kola" icin ilk sonuc "Lezzcafe Latte" [Kahve]; ilk GERCEK
//   kola 24. sirada; ekrana gelen ilk 96'da 3 kola'ya karsilik 22 KAHVE;
//   katalogdaki 44 kola urununun 41'i listeye HIC giremiyordu.
//
// BU TEST KAYNAK GREP'I DEGIL: gercek app.js fonksiyonlarini node:vm'de
// kosturup GERCEK katalogla (data/urunler_*.json, 16.696 urun) SONUC iddiasi
// kuruyor. "kola aramasi kola getirmeli" gibi.
import fs from 'fs';
import vm from 'node:vm';

const APP = fs.readFileSync('app.js', 'utf8');
let pass = 0, fail = 0;
const ok = (ad, k, d = '') => { if (k) { pass++; console.log('  PASS  ' + ad); } else { fail++; console.log('  FAIL  ' + ad + (d ? '  -> ' + d : '')); } };

// ── gercek katalogu yukle ───────────────────────────────────────────
const dosyalar = fs.readdirSync('data').filter((f) => /^urunler_.*\.json$/.test(f));
const KATALOG = [];
for (const f of dosyalar) {
  const ham = JSON.parse(fs.readFileSync('data/' + f, 'utf8'));
  const liste = Array.isArray(ham) ? ham : (ham.urunler || Object.values(ham).find(Array.isArray) || []);
  for (const u of liste) if (u && u.ad) KATALOG.push(u);
}
ok('gercek katalog yuklendi (>10.000 urun)', KATALOG.length > 10000, KATALOG.length + ' urun');

// ── app.js'ten GERCEK kaynagi cikar (mantik kopyalanmaz) ────────────
function govde(ad) {
  const b = APP.indexOf('function ' + ad + '(');
  if (b < 0) return '';
  let d = 0;
  for (let j = APP.indexOf('{', b); j < APP.length; j++) {
    const c = APP[j];
    if (c === '{') d++;
    else if (c === '}') { d--; if (d === 0) return APP.slice(b, j + 1); }
  }
  return '';
}
// SABIT CIKARMA: metin kalibi DEGIL, PARANTEZ SAYIMI.
// Iki kez yanildim ve ikisi de ayni sinif: kalip tabanli sonlandirici arama.
//   1) once '\n};' araniyordu -> KATEGORILER bir DIZI oldugu icin cok
//      ilerideki bir blogu yakaladi, vm'e localStorage'li kod sizdi.
//   2) sonra "yakin olani sec" denendi -> _ARAMA_GRUP_SLUG TEK SATIRLIK
//      oldugu icin yine ilerideki bir blogu yakaladi, document'li kod sizdi.
// Kod her seferinde dogruydu, CIKARMA ARACI bozuktu. Simdi ilk { veya [
// bulunup esi sayilarak kapatiliyor; satir sayisindan bagimsiz.
function sabit(ad) {
  const b = APP.indexOf('const ' + ad);
  if (b < 0) return '';
  const acKume = APP.indexOf('{', b), acKose = APP.indexOf('[', b);
  const bas = (acKume < 0) ? acKose : (acKose < 0 ? acKume : Math.min(acKume, acKose));
  if (bas < 0) return '';
  const ac = APP[bas], kapa = ac === '{' ? '}' : ']';
  let d = 0;
  for (let j = bas; j < APP.length; j++) {
    if (APP[j] === ac) d++;
    else if (APP[j] === kapa) { d--; if (d === 0) return APP.slice(b, j + 1) + ';'; }
  }
  return '';
}

const kutu = { console };
vm.createContext(kutu);
const kaynak = [
  sabit('KATEGORILER'), sabit('KART_GRUP'), sabit('_ARAMA_GRUP_SLUG'),
  govde('trNormalize'), govde('ustKategori'),
  govde('_aramaSkoru'), govde('urunAra'), govde('kategoriOnerisi'),
].join('\n');
for (const [ad, p] of [['KATEGORILER', sabit('KATEGORILER')], ['KART_GRUP', sabit('KART_GRUP')],
  ['_ARAMA_GRUP_SLUG', sabit('_ARAMA_GRUP_SLUG')], ['trNormalize', govde('trNormalize')],
  ['ustKategori', govde('ustKategori')], ['_aramaSkoru', govde('_aramaSkoru')],
  ['urunAra', govde('urunAra')], ['kategoriOnerisi', govde('kategoriOnerisi')]]) {
  ok('app.js\'ten cikarildi: ' + ad, p.length > 0);
}
vm.runInContext(kaynak, kutu);
kutu.KATALOG = KATALOG;
const ara = (q) => vm.runInContext(`urunAra(KATALOG, ${JSON.stringify(q)})`, kutu);
const skor = (ad, qn) => vm.runInContext(`_aramaSkoru(${JSON.stringify(ad)}, ${JSON.stringify(qn)})`, kutu);
const oneri = (q) => vm.runInContext(`kategoriOnerisi(${JSON.stringify(q)}, KATALOG)`, kutu);

console.log('\n=== 1. "kola" ARAMASI KOLA GETIRIYOR (asil sikayet) ===');
{
  const r = ara('kola');
  const ilk5 = r.slice(0, 5).map((u) => u.ad);
  const gercek = ilk5.filter((a) => /kola/i.test(a)).length;
  ok('sonuc var', r.length > 0, String(r.length));
  ok('ilk 5\'te EN AZ 3 gercek kola', gercek >= 3, gercek + '/5 -> ' + ilk5.join(' | '));
  ok('  ilk sonuc gercek kola', /kola/i.test(ilk5[0] || ''), ilk5[0]);
  // Kontrol grubu: kahve ilk 5'te OLMAMALI (eski davranista 22 kahve geliyordu)
  const kahve5 = ilk5.filter((a) => /kahve|nescaf|latte|espresso/i.test(a)).length;
  ok('  ilk 5\'te KAHVE yok', kahve5 === 0, ilk5.join(' | '));
}

console.log('\n=== 2. FARKLI SORGU FARKLI SONUC (kestirme geri gelmesin) ===');
{
  const imza = (q) => { const r = ara(q); return r.length + '|' + ((r[0] && r[0].ad) || '-'); };
  const a = imza('kola'), b = imza('cay'), c = imza('su'), d = imza('kahve');
  ok('kola / cay / su / kahve HEPSI FARKLI', new Set([a, b, c, d]).size === 4,
     JSON.stringify({ kola: a, cay: b, su: c, kahve: d }));
  // Eski bozuklugun imzasi: bes sorgu da tam olarak icecek kategorisi kadar sonuc
  ok('  hicbiri TUM icecek kategorisini dondurmuyor',
     ara('kola').length !== ara('kahve').length || ara('kola').length !== ara('cay').length, '');
}

console.log('\n=== 3. PUANLAMA SIRASI: tam kelime > kelime basi > alt dize ===');
ok('tam kelime = 3', skor('Pepsi Kola 1 Lt', 'kola') === 3);
ok('kelime basi = 2', skor('Kolali Icecek', 'kola') === 2, String(skor('Kolali Icecek', 'kola')));
ok('alt dize = 1', skor('Ulker Cikolata 60 Gr', 'kola') === 1, String(skor('Ulker Cikolata 60 Gr', 'kola')));
ok('eslesmeyen = 0', skor('Ayran 1 Lt', 'kola') === 0);
// Siralamanin GERCEKTEN uygulandigi: cikolata (alt dize) kola aramasinda EN ALTTA
{
  const r = ara('kola');
  const ilkCikolata = r.findIndex((u) => /çikolata|cikolata/i.test(u.ad || ''));
  const ilkTamKola = r.findIndex((u) => /(^|\s)kola(\s|$)/i.test(u.ad || ''));
  ok('cikolata, gercek koladan SONRA geliyor', ilkCikolata === -1 || ilkCikolata > ilkTamKola,
     'cikolata@' + ilkCikolata + ' kola@' + ilkTamKola);
}

console.log('\n=== 4. trNormalize TEK KAPI (Turkce asimetri yok) ===');
for (const [a, b] of [['süt', 'sut'], ['şeker', 'seker'], ['çay', 'cay'], ['KOLA', 'kola'], ['Ünlü', 'unlu']]) {
  const ra = ara(a), rb = ara(b);
  ok(`"${a}" ile "${b}" AYNI sonucu veriyor`, ra.length === rb.length && (ra[0] || {}).ad === (rb[0] || {}).ad,
     ra.length + ' vs ' + rb.length);
}

console.log('\n=== 5. KATEGORI ONERISI: sonucun YERINI ALMIYOR, yaninda duruyor ===');
{
  const o = oneri('kola');
  ok('"kola" icin oneri var', !!o && !!o.slug, JSON.stringify(o));
  ok('  oneri Icecek kategorisi', o && o.slug === 'icecek', JSON.stringify(o));
  ok('  AMA sonuc listesi hala urun eslesmesi', ara('kola').length > 0 && /kola/i.test(ara('kola')[0].ad), '');
  const o2 = oneri('tuz');
  ok('"tuz" icin de oneri uretiliyor (ana_kategori yolu)', !!o2 && !!o2.slug, JSON.stringify(o2));
  ok('  ama "tuz" sonuclarinin ilki GERCEK tuz', /tuz/i.test(ara('tuz')[0].ad), ara('tuz')[0].ad);
  ok('anlamsiz sorguda oneri YOK', oneri('zzzqqq') === null, JSON.stringify(oneri('zzzqqq')));
  // SESSIZ IKON KAYBI KILIDI: lcIcon tanimsiz isimde '' doner ve ikon
  // gorunmez olur. Ilk yazisimda lcIcon('kategori') kullanildi ve ikon BOS
  // cikti ('kategori' bir ROTA anahtari, _LUCIDE_PATHS'te yok). Onerinin
  // ikonu KATEGORININ KENDI ikonu olmali ve ikon sozlugunde BULUNMALI.
  const ikonlar = vm.runInContext('Object.keys(_LUCIDE_PATHS || {})',
    (() => { const kk = { console }; vm.createContext(kk); vm.runInContext(sabit('_LUCIDE_PATHS'), kk); return kk; })());
  ok('  onerinin ikonu ikon sozlugunde VAR (sessiz bos ikon yok)',
     !!o && !!o.ikon && ikonlar.includes(o.ikon), JSON.stringify({ ikon: o && o.ikon }));
}

console.log('\n=== 6. ANA ARAMA DINLEYICISI TEK KAPIYI KULLANIYOR ===');
// Bu bolum KAYNAK duzeyinde -- testin geri kalani davranissal. Sebep:
// dinleyici DOM'a bagli, vm'de kosturulamiyor. Prove-by-breaking'de
// "KART_GRUP kestirmesi SONUC listesine geri geldi" bozmasi YESIL kalmisti;
// guard'in kor noktasi tam buydu ve bu iddia onu kapatiyor.
{
  const i = APP.indexOf(`getElementById('search').addEventListener`);
  const dinleyici = i > 0 ? APP.slice(i, i + 2600) : '';
  ok('arama dinleyicisi bulundu', dinleyici.length > 0);
  ok('  sonuclar urunAra() ile uretiliyor', /results\s*=\s*urunAra\(/.test(dinleyici),
     (dinleyici.match(/results\s*=[^\n]*/) || [''])[0]);
  ok('  SONUC listesi ust kategoriye gore filtrelenmiyor (kestirme geri gelmesin)',
     !/results\s*=[^\n]*ustKategori\(/.test(dinleyici),
     (dinleyici.match(/results\s*=[^\n]*/) || [''])[0]);
  ok('  kategori onerisi ayri satirda ciziliyor', /_aramaOneriCiz\(kategoriOnerisi\(/.test(dinleyici), '');
}

console.log('\n=== 7. VEKIL OLCUM: en sik 30 kelimede ilk sonuc TAM KELIME ===');
{
  const say = Object.create(null);
  for (const u of KATALOG) {
    for (const w of vm.runInContext(`trNormalize(${JSON.stringify(u.ad)})`, kutu).split(/[^a-z0-9]+/)) {
      if (w.length < 3 || /^[0-9]/.test(w)) continue;
      if (['adet', 'paket', 'gram', 'litre'].includes(w)) continue;
      say[w] = (say[w] || 0) + 1;
    }
  }
  const top = Object.keys(say).sort((a, b) => say[b] - say[a]).slice(0, 30);
  let tam = 0; const kotu = [];
  for (const w of top) {
    const r = ara(w);
    if (r[0] && skor(r[0].ad, w) === 3) tam++; else kotu.push(w + '->' + ((r[0] || {}).ad || '-'));
  }
  // Eski mantikta bu oran 22/30 idi (olculdu). Esik 28: kucuk veri
  // dalgalanmasina dayansin ama gerilemeyi yakalasin.
  ok('30 kelimenin EN AZ 28\'inde ilk sonuc tam kelime', tam >= 28, tam + '/30 · kotuler: ' + kotu.join(', '));
}

console.log('\nSONUC: PASS=' + pass + ' FAIL=' + fail);
process.exit(fail ? 1 : 0);
