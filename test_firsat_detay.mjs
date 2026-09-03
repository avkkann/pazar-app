// FIRSATLAR EKRANINDA URUN DETAYI ACILMIYORDU.
//
// KOK SEBEP (olculdu, tahmin degil): _firsatKartHtml'in urettigi
// '<div class="firsat-card">' hicbir dinleyici TASIMIYORDU -- data-id yok,
// onclick yok, tabindex/role yok. Yani tiklama "sessizce dusmuyor" ya da
// "yanlis sid ile openDetay cagirmiyor"; HIC YAKALANMIYOR.
// Karsilastirma (ayni dosyadaki diger uc kart uretici) bunu tek bakista
// gosteriyor: product-card (cardHTML), strip-card (_stripKartHTML) ve
// cart-item, ucu de data-id + openDetay tasiyor.
//
// IPUCU: firsat kartindaki sepet butonu ZATEN 'event.stopPropagation()'
// cagiriyordu -- yani bir ust dinleyici VARSAYILMIS ama hic yazilmamis.
//
// DUZELTMENIN SINIRI: satir ici olay ozniteligi EKLENMEZ (script-src gocu
// ertelendi, sayac test_satirici_kilit.mjs ile 117'ye kilitli). Cozum
// delegasyon: document uzerinde tek bir click + tek bir keydown dinleyicisi.
import fs from 'fs';
import vm from 'node:vm';

const APP = fs.readFileSync('app.js', 'utf8');
let pass = 0, fail = 0;
const ok = (ad, k, d = '') => { if (k) { pass++; console.log('  PASS  ' + ad); } else { fail++; console.log('  FAIL  ' + ad + (d ? '  -> ' + d : '')); } };

// Kaynaktan fonksiyon govdesi cikar (test_klavye.mjs ile ayni desen).
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

console.log('\n=== 1. FIRSAT KARTI KIMLIGINI TASIYOR ===');
// Davranissal: gercek _firsatKartHtml vm'de kosturulup URETTIGI HTML olculuyor.
// Kaynakta desen aramak yetmez -- bu depoda desen taramasi bir turda bes kez yaniltti.
const src = govde('_firsatKartHtml');
ok('_firsatKartHtml bulundu', src.length > 0);

const sandbox = {
  productMap: {},
  KAT_EMOJI: { gida: '🍎' },
  ustKategori: () => 'gida',
  tlHTML: (n) => '<span>' + n + '</span>',
  _kacir: (s) => String(s == null ? '' : s).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;'),
  _guvenliUrl: (u) => String(u || ''),
  supheliDurum: () => false,
  supheliRozetHTML: () => '',
  // `sepet` vm baglamina 2026-09-01'de EKLENDI. Oncesinde yalnizca
  // `window: { sepet: [] }` vardi ve bu YETIYORDU -- cunku kod `window.sepet &&`
  // ile kisa devre yapiyordu, yani `sepet` HIC degerlendirilmiyordu. Kod ciplak
  // `sepet`e cevrilince vm "sepet is not defined" ile patladi; bu, duzeltmenin
  // gercekten calisma yolunu degistirdiginin kaniti oldu.
  // IDDIA GEVSETILMEDI, calisma ortami tamamlandi (test_kacis / test_sepet_bol
  // icin `sehirOku` eklenirken uygulanan ayni desen).
  sepet: [],
  // `_firsatBirimFiyat` 2026-09-03'te EKLENDI (A6: birim fiyat firsat kartina
  // girdi). vm "is not defined" ile patladi -- yani yeni satirin gercekten
  // cizim yolunda oldugunun kaniti. IDDIA GEVSETILMEDI, calisma ortami
  // tamamlandi (yukaridaki `sepet` ve test_kacis'taki `sehirOku` ile ayni
  // desen) ve ASAGIYA yeni bir iddia eklendi: satir gercekten basiliyor mu.
  _firsatBirimFiyat: () => '34,90 ₺/L',
  window: {},
  btoa: (s) => Buffer.from(s, 'binary').toString('base64'),
  unescape, encodeURIComponent,
  console,
};
vm.createContext(sandbox);
vm.runInContext(src, sandbox);

const urun = { _id: 'sut_12', _sid: 'sut-sid', ad: 'Süt 1 L', ana_kategori: 'Süt', en_dusuk_fiyat: 34.9, market_fiyatlari: [] };
const html = vm.runInContext('_firsatKartHtml(' + JSON.stringify(urun) + ', "EN UCUZ", "firsat-badge-ucuz", "alt")', sandbox);

ok('kart birim fiyat satirini basiyor (A6)', /firsat-card-bf[^>]*>34,90 ₺\/L</.test(html),
   'firsat-card-bf bulunamadi -> birim fiyat firsat kartindan dusmus');
ok('kart data-id tasiyor', /class="firsat-card"[^>]*data-id="sut_12"/.test(html), html.slice(0, 200));
ok('kart role="button" tasiyor', /class="firsat-card"[^>]*role="button"/.test(html), html.slice(0, 200));
ok('kart tabindex="0" tasiyor', /class="firsat-card"[^>]*tabindex="0"/.test(html), html.slice(0, 200));
ok('kart aria-label tasiyor', /class="firsat-card"[^>]*aria-label="/.test(html), html.slice(0, 200));
ok('urun productMap\'e yazildi (openDetay onu okuyor)', sandbox.productMap['sut_12'] != null);

console.log('\n=== 2. SATIR ICI HANDLER EKLENMEDI (117 kilidi) ===');
// Kartin KENDISI onclick/onkeydown tasimamali. Sepet butonundaki mevcut
// onclick BILEREK hesap disi -- o zaten vardi, bu tur eklenmedi.
const kartAcilis = (html.match(/<div class="firsat-card"[^>]*>/) || [''])[0];
ok('kart aciligi onclick TASIMIYOR', !/onclick=/.test(kartAcilis), kartAcilis);
ok('kart aciligi onkeydown TASIMIYOR', !/onkeydown=/.test(kartAcilis), kartAcilis);

console.log('\n=== 3. DELEGASYON DINLEYICISI DAVRANISI ===');
const tikla = govde('_firsatKartTikla');
const tus = govde('_firsatKartTus');
ok('_firsatKartTikla tanimli', tikla.length > 0);
ok('_firsatKartTus tanimli', tus.length > 0);

// Sahte olay: target.closest gercek DOM'u taklit ediyor.
function sahteHedef(kartId, ekBtn) {
  return {
    closest(sec) {
      if (sec === '.firsat-card-add') return ekBtn ? {} : null;
      if (sec === '.firsat-card') return kartId ? { dataset: { id: kartId } } : null;
      return null;
    }
  };
}
const kutu = { productMap: {}, openDetay: null, console };
vm.createContext(kutu);
vm.runInContext(govde('_firsatKartId') + '\n' + tikla + '\n' + tus, kutu);

let acilan = [];
kutu.openDetay = (id) => acilan.push(id);

vm.runInContext('_firsatKartTikla(olay)', Object.assign(kutu, { olay: { target: sahteHedef('sut_12', false) } }));
ok('karta tiklayinca openDetay DOGRU id ile cagriliyor', acilan.length === 1 && acilan[0] === 'sut_12', JSON.stringify(acilan));

// KONTROL GRUBU 1: sepet butonu detayi ACMAMALI.
acilan = [];
vm.runInContext('_firsatKartTikla(olay)', Object.assign(kutu, { olay: { target: sahteHedef('sut_12', true) } }));
ok('sepet butonuna tiklayinca detay ACILMIYOR', acilan.length === 0, JSON.stringify(acilan));

// KONTROL GRUBU 2: kart disina tiklama hicbir sey yapmamali.
acilan = [];
vm.runInContext('_firsatKartTikla(olay)', Object.assign(kutu, { olay: { target: sahteHedef(null, false) } }));
ok('kart disina tiklayinca openDetay cagrilmiyor', acilan.length === 0, JSON.stringify(acilan));

console.log('\n=== 4. KLAVYE (Enter / Space) ===');
let engellendi = 0;
const tusOlay = (key, ekBtn) => ({ key, target: sahteHedef('sut_12', !!ekBtn), preventDefault: () => engellendi++ });

acilan = []; engellendi = 0;
vm.runInContext('_firsatKartTus(olay)', Object.assign(kutu, { olay: tusOlay('Enter') }));
ok('Enter detayi aciyor', acilan.length === 1 && acilan[0] === 'sut_12');
ok('  Enter preventDefault cagirdi', engellendi === 1);

acilan = []; engellendi = 0;
vm.runInContext('_firsatKartTus(olay)', Object.assign(kutu, { olay: tusOlay(' ') }));
ok('Space detayi aciyor', acilan.length === 1);

// KONTROL GRUBU: baska tuslar sayfayi kilitlememeli.
acilan = []; engellendi = 0;
vm.runInContext('_firsatKartTus(olay)', Object.assign(kutu, { olay: tusOlay('a') }));
ok('rastgele tus (a) detayi ACMIYOR', acilan.length === 0);
ok('  rastgele tusta preventDefault cagrilmadi (yazma bozulmasin)', engellendi === 0);

console.log('\n=== 5. DINLEYICILER GERCEKTEN BAGLANIYOR ===');
ok("document.addEventListener('click', _firsatKartTikla) var",
   /document\.addEventListener\(\s*['"]click['"]\s*,\s*_firsatKartTikla/.test(APP));
ok("document.addEventListener('keydown', _firsatKartTus) var",
   /document\.addEventListener\(\s*['"]keydown['"]\s*,\s*_firsatKartTus/.test(APP));

console.log('\n=== 6. GERI DONUS FIRSATLAR EKRANINA ===');
// openDetay'in _prevScreen listesinde screen-firsatlar YOKTU: detay acilinca
// geri tusu kullaniciyi ANA SAYFAYA atardi. Tiklama duzeltilmeden bu hic
// gorunmuyordu (detay zaten acilmiyordu).
const od = govde('openDetay');
const liste = (od.match(/const screens = \[[^\]]*\]/) || [''])[0];
ok('openDetay screens listesi bulundu', liste.length > 0);
ok("  'screen-firsatlar' listede", /screen-firsatlar/.test(liste), liste);
ok("  'screen-home' hala listede (regresyon yok)", /screen-home/.test(liste), liste);
ok("  'screen-cat' hala listede (regresyon yok)", /screen-cat/.test(liste), liste);
ok("  'screen-sepet' hala listede (regresyon yok)", /screen-sepet/.test(liste), liste);
// 2026-09-01: 'screen-favoriler' de eklendi. Ayni sinif kusurdu ve
// firsatlar duzeltilirken kapsam disi birakilmisti; olculdu (kontrol gruplu:
// diger DORT ekran dogru calisiyordu, yalniz bu 'screen-home'a dusuyordu).
ok("  'screen-favoriler' listede", /screen-favoriler/.test(liste), liste);
// Ekran envanteri KILIDI: uygulamada detay acilabilen bir ekran daha
// eklenirse bu iddia onu bu listeye eklemeyi hatirlatir. Sayi degil ISIM
// bazli — sayi pinlemek "yakin ama yanlis" listeyi kacirir.
{
  const beklenen = ['screen-home', 'screen-cat', 'screen-sepet', 'screen-firsatlar', 'screen-favoriler'];
  const bulunan = [...liste.matchAll(/'(screen-[a-z]+)'/g)].map(m => m[1]);
  ok('screens listesi TAM olarak beklenen bes ekran',
     bulunan.length === beklenen.length && beklenen.every(e => bulunan.includes(e)),
     'bulunan: ' + JSON.stringify(bulunan));
}

console.log('\n=== 7. _prevScreen TEMBEL YENIDEN CAGRIDA EZILMIYOR ===');
// OLCULDU (CDP zaman serisi): tiklamadan 60ms sonra _prevScreen
// 'screen-firsatlar', 660ms sonra 'screen-home'. Sebep: openDetay tembel veri
// gelince KENDINI yeniden cagiriyor; o ikinci cagrida listedeki hicbir ekran
// gorunur degil (ekranda screen-detay var), find() undefined donuyor ve
// '|| screen-home' fallback'i GERCEK onceki ekrani eziyor.
// Bu HER ekrani etkiliyordu (kategori, sepet dahil); Firsatlar'dan
// gorunmuyordu cunku detay zaten acilmiyordu.
// NOT: ilk yazdigim regex `[^)]*` kullaniyordu ve _ekranGorunur('screen-detay')
// icindeki KAPANIS PARANTEZINDE takilip yanlis KIRMIZI verdi -- kod dogruydu,
// olcum aletim bozuktu. Bu depoda tekrar eden sinif; desen artik parantez
// saymadan, atamanin bir if blogunun ICINDE oldugunu ariyor.
ok('_prevScreen atamasi kosula bagli (detay acikken yeniden hesaplanmiyor)',
   /if\s*\(\s*!\s*_ekranGorunur\(\s*['"]screen-detay['"]\s*\)\s*\)\s*\{[\s\S]{0,200}?_prevScreen\s*=/.test(od),
   od.slice(od.indexOf('const screens'), od.indexOf('const screens') + 300));
ok('  gorunurluk _ekranGorunur ile olculuyor (inline style ile DEGIL)',
   /_ekranGorunur/.test(od) && !/\.style\.display\s*!==\s*'none'/.test(od),
   'CLAUDE.md kurali: gorunurluk kontrolu getComputedStyle tabanli _ekranGorunur ile yapilir');

console.log('\n=== 8. SEPET DURUMU window.sepet DEN OKUNMUYOR ===');
// OLCULDU 2026-09-01: `_firsatKartHtml` inCart'i `window.sepet`ten hesapliyordu.
// `sepet` app.js'te ust duzey bir `let`; klasik script'te ust duzey let window'a
// OZELLIK OLARAK YAZILMAZ -> `window.sepet` HER ZAMAN undefined, `inCart` her
// zaman falsy, ✓ durumu HIC gorunmedi. Urun sepete giriyordu ama kullanici
// geri bildirim almiyordu. Calisma aninda dogrulandi: typeof window.sepet
// === 'undefined' iken sepet.length > 0.
{
  // Bu duzeltmeyi ANLATAN yorum "window.sepet" yaziyor; ciplak arama kendi
  // aciklamasiyla eslesirdi (bu depoda belgelenmis tuzak). Ama yorumlari
  // NAIF REGEX ile soymak DAHA KOTU: olculdu (2026-09-01), `/\*[\s\S]*?\*\//`
  // app.js'ten 124.591 BAYT siliyor -- cunku `/*` dize/regex literallerinin
  // icinde de geciyor ve non-greedy eslesme aradaki gercek kodu yutuyor.
  // Sonuc: 4 gercek eslesmenin 3'u kayboluyor ve test YANLIS YESIL veriyordu.
  // (Ayni sinif 2026-08-20'de de yasandi: soyucu 2287 satiri gizlemisti.)
  // Guvenli yol SATIR BAZLI: yorum satirlarini atla, kodu bozma.
  const kodSatirlari = APP.split(/\r?\n/).filter(l => {
    const t = l.trim();
    return !(t.startsWith('//') || t.startsWith('*') || t.startsWith('/*'));
  });
  const kacak = kodSatirlari.filter(l => l.includes('window.sepet')).length;
  ok('kodda window.sepet KULLANIMI yok (yorum satirlari haric)',
     kacak === 0, 'bulunan satir: ' + kacak);
  // Soyucunun kendi kontrol grubu: filtre gercekten is goruyor mu?
  ok('  satir filtresi calisiyor (yorumdaki window.sepet ayiklandi)',
     APP.includes('window.sepet') && kodSatirlari.join('\n').includes('const inCart = sepet.some('),
     'filtre ya hic ayiklamadi ya da kodu yedi');

  // DAVRANISSAL — kaynak grep'i degil: fonksiyon vm'de KOSULUYOR ve sepet
  // durumu iki yonlu degistirilip cikti okunuyor. Kontrol grubu sart:
  // "hep ekli sinifi basan" bir kod da tek yonlu testten gecerdi.
  const cagir = () => vm.runInContext(
    '_firsatKartHtml(' + JSON.stringify(urun) + ', "EN UCUZ", "firsat-badge-ucuz", "alt")', sandbox);
  sandbox.sepet.length = 0;
  const bos = cagir();
  sandbox.sepet.push({ _id: 'sut_12' });
  const dolu = cagir();
  sandbox.sepet.length = 0;
  const tekrarBos = cagir();

  ok('sepette DEGILKEN ekli sinifi YOK',
     !/firsat-card-add--ekli/.test(bos), (bos.match(/<button[^>]*firsat-card-add[^>]*>/) || [''])[0]);
  ok('sepetteYKEN ekli sinifi VAR',
     /firsat-card-add--ekli/.test(dolu), (dolu.match(/<button[^>]*firsat-card-add[^>]*>/) || [''])[0]);
  ok('sepetten cikinca ekli sinifi TEKRAR KALKIYOR (tek yonlu degil)',
     !/firsat-card-add--ekli/.test(tekrarBos));
  // Kontrol grubu: diger uc kart ureticisi de ayni referansi kullaniyor olmali.
  // Biri window.sepet e kayarsa ayni sinif kusur oradan geri doner.
  // Envanter: dort kart/buton ureticisi de ayni referansi kullanmali. Biri
  // window.sepet e kayarsa ayni sinif kusur oradan geri doner.
  const noktalar = [...APP.matchAll(/const inCart = sepet\.some\(/g)].length;
  ok('dort ureticinin dordu de ciplak `sepet` kullaniyor', noktalar === 4,
     'bulunan: ' + noktalar);
}

console.log('\nSONUC: PASS=' + pass + ' FAIL=' + fail);
process.exit(fail ? 1 : 0);
