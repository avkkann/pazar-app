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

// YORUM SOYUCU: bu depoda bir testin KENDI ACIKLAMA YORUMUYLA eslesip yanlis
// KIRMIZI vermesi DORDUNCU kez yasandi (bkz. CLAUDE.md). Kaynakta "su desen
// YOK" turu iddia kurmadan once yorumlar SOYULUR.
const kodu = (src) => String(src || '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

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

console.log('\n=== 7. DIGER UC ARAMA KUTUSU DA TEK KAPIDAN GECIYOR ===');
// Bu bolum KAYNAK duzeyinde ve bu BILINCLI: uc kutunun dinleyicisi de DOM'a
// bagli, vm'de kosturulamiyor. Bu turun dersi: davranissal test yanlis
// KATMANDA cagrilirsa kordur -- o yuzden saf fonksiyonun yaninda CAGRI
// YERLERI de ayrica kilitleniyor.
// OLCULEN TABAN (duzeltmeden once, canli): kategori ekraninda
//   "sut" 0 / "sut" 339 · "seker" 0 / "seker" 40 · "icim" 0 / "Icim" 110
//   firsatlarda "sut" 0 / "sut" 2 · "seker" 0 / "seker" 2
{
  const cat = govde('catAra');
  ok('catAra sorguyu HAM sakliyor (normalize tek kapida)',
     cat.length > 0 && !/toLowerCase/.test(kodu(cat)), kodu(cat));

  const ucf = govde('uygulaCatFiltre');
  ok('uygulaCatFiltre arama icin urunAra kullaniyor', /filtreliler\s*=\s*urunAra\(/.test(ucf),
     (ucf.match(/aramaTermi\.length[\s\S]{0,160}/) || [''])[0]);
  ok('  duz toLowerCase().includes() KALMADI',
     !/\(u\.ad \|\| ''\)\.toLowerCase\(\)\.includes/.test(ucf), '');
  // DIKKAT: sadece /_alaka/ aramak KOR -- o dize asagidaki
  // "if (sir === '_alaka')" dalinda da geciyor, dolayisiyla SECIM satiri eski
  // haline dondurulse bile iddia yesil kalirdi (harness yakaladi). Iddia
  // SECIM SATIRININ KENDISINE bakiyor: alaka, arama aktifken ve kullanici
  // acikca siralama secmemisken devreye girmeli.
  const sirSatiri = (kodu(ucf).match(/const sir =[^\n]*/) || [''])[0];
  ok('  arama aktifken ALAKA sirasi korunuyor (varsayilan siralama ezmiyor)',
     /_alaka/.test(sirSatiri) && /aramaTermi\.length/.test(sirSatiri) && /!window\._catSiralama/.test(sirSatiri),
     sirSatiri);

  const fa = govde('firsatAra');
  ok('firsatAra trNormalize + _aramaSkoru kullaniyor',
     /trNormalize\(/.test(fa) && /_aramaSkoru\(/.test(fa), fa.slice(0, 200));
  ok('  VERIDEN okuyor (productMap), DOM metni yalniz YEDEK',
     /productMap\[/.test(fa), fa.slice(0, 300));
  ok('  skora gore YENIDEN SIRALIYOR', /sort\(/.test(fa) && /appendChild\(/.test(fa), '');
  ok('  duz toLowerCase().includes() KALMADI', !/toLowerCase\(\)\.includes/.test(fa), '');

  const ha = govde('halArama');
  ok('halArama trNormalize + _aramaSkoru kullaniyor',
     /trNormalize\(/.test(ha) && /_aramaSkoru\(/.test(ha), ha.slice(0, 200));
  ok('  VERIDEN okuyor (data-ad), nth-child METIN okuma KALMADI',
     /dataset\.ad/.test(ha) && !/nth-child/.test(kodu(ha)), kodu(ha).slice(0, 300));
  // Kutu DOM'da YOK (olculdu: #halSearch hicbir yerde uretilmiyor). Eski kod
  // null uzerinde .value okuyup PATLIYORDU; yenisi patlamamali.
  ok('  arama kutusu YOKKEN patlamiyor (null guvenli)',
     /const el = document\.getElementById\('halSearch'\);[\s\S]{0,120}el \? el\.value/.test(ha), ha.slice(0, 260));

  ok('hal karti data-ad tasiyor (arama VERIDEN okusun)',
     /hal-grid-card"[^`]*data-ad="\$\{_kacir\(u\.ad\)\}"/.test(APP), '');
}

console.log('\n=== 7b. HAL: arama kutusu VAR ve birlesik nokta soyuluyor ===');
{
  // BULGU (2026-08-25): halArama() ve dinleyici kaydi BASTAN BERI vardi ama
  // #halSearch HICBIR YERDE URETILMIYORDU -> arama kullaniciya hic ulasmamis.
  // Olculdu: hal ekraninda sifir <input>, getElementById null donuyordu.
  const rhs = kodu(govde('renderHalScreen'));
  ok('renderHalScreen arama kutusunu basiyor', /halSearch/.test(rhs), rhs.slice(0, 200));
  // DIKKAT: sadece /aramaHtml/ aramak KOR -- degiskenin TANIMI kalir ve
  // innerHTML'den cikarilsa bile iddia yesil kalirdi (harness yakaladi,
  // bu turda IKINCI kez ayni sinif). Iddia YAZMA SATIRINA bakiyor.
  // Ilk eslesme YANLIS satiri yakaliyordu: renderHalScreen'de "Hal verisi
  // bulunamadi" ERKEN DONUS dalinda da 'container.innerHTML = tarihDisplay'
  // var. Dogru satir hal-grid'i basan satir.
  const yazmaSatiri = (rhs.match(/container\.innerHTML = tarihDisplay[^\n]*hal-grid[^\n]*/) || [''])[0];
  ok('  kutu innerHTML\'e GERCEKTEN giriyor', /aramaHtml/.test(yazmaSatiri), yazmaSatiri);
  ok('  SATIR ICI handler YOK (117 kilidi)', !/oninput=/.test(rhs), '');
  ok('  dinleyici addEventListener ile baglaniyor',
     /getElementById\('halSearch'\)\?\.addEventListener\('input', halArama\)/.test(kodu(APP)), '');

  // BIRLESIK NOKTA (U+0307): hal.json'daki 139 urunun 56'sinda ad 'i' + U+0307
  // iceriyor (kaynaktaki bozuk buyuk/kucuk harf donusumu). Soyulmazsa "cilek"
  // yazan kullanici o 56 urunun HICBIRINI bulamaz. Ana katalogda 0 tane var,
  // yani bu soyma orayi etkilemiyor (olculdu).
  const CILEK = 'Çi̇lek';
  const tn = (x) => vm.runInContext('trNormalize(' + JSON.stringify(x) + ')', kutu);
  ok('trNormalize birlesik noktayi (U+0307) soyuyor', tn(CILEK) === 'cilek', JSON.stringify(tn(CILEK)));
  ok('  bozuk yazimli ad duz yazimla TAM KELIME esliyor',
     skor(CILEK, 'cilek') === 3, String(skor(CILEK, 'cilek')));
  // KONTROL GRUBU: soyma, normal Turkce isaretleri BOZMAMALI
  ok('  KONTROL: normal Turkce harfler bozulmadi',
     tn('Şeker Çay Üzüm') === 'seker cay uzum', JSON.stringify(tn('Şeker Çay Üzüm')));
}

console.log('\n=== 8. VEKIL OLCUM: en sik 30 kelimede ilk sonuc TAM KELIME ===');
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
