// GORSEL YUVASI — "kutu ayrilmis ama BOS" hatasinin koruma testi.
//
// OLCUM (2026-08-24, CDP, 390px, soguk + yavas 4G):
//   splash kalktigi an gorus alanindaki 6 serit kartinin 6'si da BOS BEYAZ
//   kutuydu; 800ms sonra hala 5 bos; dolmasi ~9 saniye surdu.
//   CLS = 0 idi -- yani kutu DOGRU ayrilmis, sicrama YOK. Sorun sicrama
//   degil, kutunun ICINDEKI BOSLUKTU. "CLS 0" tek basina "iyi gorunuyor"
//   demek DEGIL; bu testin var olma sebebi tam olarak bu ayrim.
//   Ayni hata urun detayinda da vardi (resim 1,5-2,5 sn gec geliyor).
//
// DUZELTME: '-ph' yedek kutusu ARTIK HER ZAMAN ciziliyor (emoji icinde),
// resim CSS ile onun USTUNE biniyor. Resim gelince .yuklendi sinifi emojiyi
// gizliyor. Sinifi ekleyen dinleyici CAPTURE fazinda -- 'load' KABARCIKLANMAZ.
//
// LAYOUT DEGISMEDI (olculdu, once/sonra birebir ayni):
//   strip-card 164x255 · gorsel 138x90 · product-card 173x292 · gorsel 171x130
//   detay-img-wrap 390x228 · img 180x180 · altOgeY 296 · sayfaH 3179
import fs from 'fs';
import vm from 'node:vm';

const APP = fs.readFileSync('app.js', 'utf8');
const CSS = fs.readFileSync('style.css', 'utf8');
let pass = 0, fail = 0;
const ok = (ad, k, d = '') => { if (k) { pass++; console.log('  PASS  ' + ad); } else { fail++; console.log('  FAIL  ' + ad + (d ? '  -> ' + d : '')); } };

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

console.log('\n=== 1. YEDEK KUTUSU RESIMDEN BAGIMSIZ CIZILIYOR ===');
// Asil iddia: resim GELMEDEN once de kutuda bir sey var.
ok('serit: -ph kutusu img\'yi SARIYOR',
   /strip-card-img-ph gorsel-yuva[^`]*<img class="strip-card-img"/.test(APP), '');
ok('kategori: -ph kutusu img\'yi SARIYOR',
   /product-card-img-ph gorsel-yuva[^`]*<img class="product-card-img"/.test(APP), '');
// Detayda kap zaten vardi (.detay-img-wrap); emoji resimle BIRLIKTE basilmali.
const od = govde('openDetay');
ok('detay: emoji resimle BIRLIKTE basiliyor (once yalnizca img vardi)',
   /\$\{emoji\}<img src=/.test(od), (od.match(/const imgHtml[\s\S]{0,180}/) || [''])[0]);

console.log('\n=== 2. onerror ARTIK HTML URETMIYOR ===');
// Eski onerror satir ici HTML kuruyordu ve kacis hatasi 2026-08-19'da
// gorsel yedegini TAMAMEN kirmisti. Yeni yedek kutusu zaten yerinde
// oldugu icin onerror'in tek isi resmi kaldirmak.
for (const [ad, desen] of [['serit', /<img class="strip-card-img"[^`]*/], ['kategori', /<img class="product-card-img"[^`]*/]]) {
  const s = (APP.match(desen) || [''])[0];
  const oe = (/onerror="([^"]*)"/.exec(s) || [])[1] || '';
  ok(ad + ': onerror = this.remove()', /this\.remove\(\)/.test(oe), oe);
  ok('  ' + ad + ': onerror icinde HTML yok', !oe.includes('<') && !/outerHTML|innerHTML/.test(oe), oe);
}

console.log('\n=== 3. SATIR ICI onload EKLENMEDI (117 kilidi) ===');
// Yuklendi sinyali delegasyonla aliniyor; satir ici bir yukleme ozniteligi
// sayaci buyuturdu.
// YORUMLAR SOYULUYOR: bu depoda testin kendi ACIKLAMA YORUMUYLA eslesmesi
// UC KEZ yanlis alarm uretti (bkz. CLAUDE.md). Ilk yazisimda yine oldu --
// app.js'teki "satir ici onload= EKLENMEDI" yorumu iddiayi kirmiziya
// dusurmustu. Once soy, sonra ara.
// SIRA DUZELTILDI 2026-09-05 (iddia GEVSEMEDI, baktigi yer BUYUDU).
// Ters sirada app.js'in 870. satirindaki `// ... static/cat/*.png` yorumundaki
// "/*" SAHTE bir blok yorum aciyor ve 3533'e kadar 2663 satiri (124.971 bayt,
// dosyanin %38'i) taramadan siliyordu -- yani bu iddia app.js'in ucte birini
// HIC gormuyordu. Bugun o bolgede satir ici onload YOK (olculdu: her iki
// sirada da 0), yani gizlenmis bir kusur cikmadi; kor nokta LATENT idi.
// Ayni sinif hata bu depoda daha once de yasandi (CLAUDE.md, 2026-08-20).
const APP_KODU = APP.replace(/^\s*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
ok('app.js\'te satir ici yukleme oznitelig\'i YOK', !/\bonload\s*=/.test(APP_KODU),
   (APP_KODU.match(/.{0,40}onload\s*=.{0,40}/) || [''])[0]);

console.log('\n=== 4. DINLEYICI DAVRANISI (kontrol gruplu) ===');
const gy = govde('_gorselYuklendi');
ok('_gorselYuklendi tanimli', gy.length > 0);

const kutu = { console };
vm.createContext(kutu);
vm.runInContext(gy, kutu);
// Sahte DOM: classList'i gercekten tutan minik nesne
const sahteKap = (siniflar) => {
  const set = new Set(siniflar);
  return { _set: set, classList: { contains: (c) => set.has(c), add: (c) => set.add(c) } };
};
const calistir = (tag, kap) => {
  kutu.olay = { target: { tagName: tag, parentElement: kap } };
  vm.runInContext('_gorselYuklendi(olay)', kutu);
  return kap && kap._set ? kap._set.has('yuklendi') : false;
};
ok('gorsel-yuva kabina .yuklendi EKLENIYOR', calistir('IMG', sahteKap(['strip-card-img-ph', 'gorsel-yuva'])));
ok('detay-img-wrap kabina .yuklendi EKLENIYOR', calistir('IMG', sahteKap(['detay-img-wrap'])));
// KONTROL GRUBU: alakasiz kaplara ve IMG olmayan hedeflere DOKUNMAMALI
ok('KONTROL: alakasiz kaba EKLENMIYOR', !calistir('IMG', sahteKap(['baska-kutu'])));
ok('KONTROL: IMG olmayan hedefte EKLENMIYOR', !calistir('DIV', sahteKap(['gorsel-yuva'])));
// Cokmemeli
kutu.olay = { target: null };
let patladi = false;
try { vm.runInContext('_gorselYuklendi(olay)', kutu); } catch (e) { patladi = true; }
ok('KONTROL: hedefsiz olayda patlamiyor', !patladi);

console.log('\n=== 5. CAPTURE FAZI ZORUNLU ===');
// 'load' olayi KABARCIKLANMAZ. ucuncu argüman true olmadan document
// uzerindeki dinleyici bu olayi HIC gormez ve emoji hep gorunur kalir.
ok("document.addEventListener('load', _gorselYuklendi, true) kayitli",
   /document\.addEventListener\(\s*['"]load['"]\s*,\s*_gorselYuklendi\s*,\s*true\s*\)/.test(APP),
   (APP.match(/document\.addEventListener\([^)]*load[^)]*\)/) || [''])[0]);

console.log('\n=== 6. CSS SOZLESMESI ===');
const cssTemiz = CSS.replace(/\/\*[\s\S]*?\*\//g, '');   // yorumlari SOY (bu depoda iki kez yanlis alarm verdi)
ok('.gorsel-yuva konumlandirma kabi', /\.gorsel-yuva\s*\{[^}]*position:\s*relative/.test(cssTemiz));
ok('.gorsel-yuva > img akistan cikmis', /\.gorsel-yuva\s*>\s*img\s*\{[^}]*position:\s*absolute/.test(cssTemiz));
ok('  img arka plani SEFFAF (yoksa emojiyi orter)', /\.gorsel-yuva\s*>\s*img\s*\{[^}]*background:\s*transparent/.test(cssTemiz));
ok('.gorsel-yuva.yuklendi emojiyi gizliyor', /\.gorsel-yuva\.yuklendi\s*\{[^}]*font-size:\s*0/.test(cssTemiz));
ok('.detay-img-wrap.yuklendi emojiyi gizliyor', /\.detay-img-wrap\.yuklendi\s*\{[^}]*font-size:\s*0/.test(cssTemiz));
// Layout kilidi: resim akistan cikinca yuksekligi emoji belirlerdi (180->128)
// ve sayfa 48px KAYARDI. min-height olculen degere civilendi.
ok('.detay-img-wrap min-height 228px (olculen deger, layout kilidi)',
   /\.detay-img-wrap\s*\{[^}]*min-height:\s*228px/.test(cssTemiz),
   (cssTemiz.match(/\.detay-img-wrap\s*\{[^}]*\}/) || [''])[0].slice(0, 160));
ok('masaustu min-height 308px (260 + 48 padding)',
   /#detayContent\s+\.detay-img-wrap\s*\{[^}]*min-height:\s*308px/.test(cssTemiz));

console.log('\n=== 7. SEPET KARTI 2. SATIR: rozet gramajla YAN YANA + REZERVE ===');
// ONCE: rozet gramajin ALTINDA ayri satirdaydi -> rozet (tembel cache'lerle
// asenkron) gelince kart 70 -> 85 cikiyor, altindaki kartlar kayiyordu
// (olculdu: 4. kart 359 -> 382, CLS 0,0213).
// SIMDI: ayni satir. Gorselin 44px'i satir yuksegini belirledigi icin
// ad(17) + satir2(23) = 40 < 44 -> kart 70'te SABIT.
const rs = govde('renderSepet');
ok('renderSepet .cart-item-satir2 sarmalayicisini basiyor', /cart-item-satir2/.test(rs), '');
ok('  gramaj bu satirin ICINDE', /cart-item-satir2[\s\S]{0,200}cart-item-sub/.test(rs), '');
ok('  rozet de bu satirin ICINDE', /cart-item-satir2[\s\S]{0,320}cart-item-rozet/.test(rs), '');
// KRITIK: sub KOSULSUZ basilmali. Kosullu olursa gramajsiz uründe satir hic
// dogmaz, rozet gelince satir SIFIRDAN acilir ve kart ici kayar.
ok('  .cart-item-sub KOSULSUZ basiliyor (satir her zaman var)',
   /<div class="cart-item-sub">\$\{u\.agirlik_hacim \?/.test(rs),
   (rs.match(/cart-item-sub[^\n]{0,90}/) || [''])[0]);

// REZERVE: min-height olmadan satir 13px dogup rozet gelince 23px'e cikiyor
// ve URUN ADI y20 -> y15 KAYIYOR (olculdu, kontrol gruplu).
ok('.cart-item-satir2 min-height REZERVE edilmis (asenkron rozet kaymasin)',
   /\.cart-item-satir2\s*\{[^}]*min-height:\s*23px/.test(cssTemiz),
   (cssTemiz.match(/\.cart-item-satir2\s*\{[^}]*\}/) || [''])[0]);
ok('  satir flex (yan yana)', /\.cart-item-satir2\s*\{[^}]*display:\s*flex/.test(cssTemiz));
// NOT: bu iddia once "min-width:0" ariyordu. Dar ekran kararindan sonra
// gramaja TABAN verildi (sifira inmesin diye), dolayisiyla min-width artik 0
// DEGIL. Iddia gevsemedi: "gramaj esneyebilir + ellipsis'i var" ayni sey,
// tabanin varligi ise AYRI ve daha guclu bir iddia olarak asagida duruyor.
ok('  gramaj esneyebilir (flex 1 1 auto) + ellipsis',
   /\.cart-item-satir2\s+\.cart-item-sub\s*\{[^}]*flex:\s*1\s+1\s+auto/.test(cssTemiz) &&
   /\.cart-item-satir2\s+\.cart-item-sub\s*\{[^}]*text-overflow:\s*ellipsis/.test(cssTemiz),
   (cssTemiz.match(/\.cart-item-satir2\s+\.cart-item-sub\s*\{[^}]*\}/) || [''])[0]);
// DAR EKRAN KARARI (Mustafa): daralmayi ONCE rozet yer, gramaj yasar.
// Gerekce: fiyat karsilastirma uygulamasinda gramaj karsilastirmanin kendisi.
// Once rozet flex:0 0 auto + 120px sabitti; 320px'te gramaj SIFIRA iniyor ve
// rozet .cart-mkt-fiyat'in ustune biniyordu (ikisi de olculdu).
ok('  rozet KISALABILIR (flex: 0 1 auto)',
   /\.cart-item-satir2\s+\.cart-item-rozet\s*\{[^}]*flex:\s*0\s+1\s+auto/.test(cssTemiz),
   (cssTemiz.match(/\.cart-item-satir2\s+\.cart-item-rozet\s*\{[^}]*\}/) || [''])[0]);
ok('  rozet min-width:0 (kisalmaya izin)',
   /\.cart-item-satir2\s+\.cart-item-rozet\s*\{[^}]*min-width:\s*0/.test(cssTemiz));
ok('  GRAMAJ TABANI var (sifira inemez, min-width 0 DEGIL)',
   /\.cart-item-satir2\s+\.cart-item-sub\s*\{[^}]*min-width:\s*(?!0[^.\d])[\d.]+\s*(ch|px|rem|em)/.test(cssTemiz),
   (cssTemiz.match(/\.cart-item-satir2\s+\.cart-item-sub\s*\{[^}]*\}/) || [''])[0]);
// ELLIPSIS FLEX KAPSAYICIDA CALISMAZ: rozet span'i inline-flex; ciplak metin
// anonim flex ogesi oldugu icin ucnokta yerine DUZ kesiliyordu. Sepet
// satirinda inline-block'a cevrilmesi ellipsis'in ON KOSULU.
ok('  rozet ic ogesi inline-block (ellipsis ancak boyle calisir)',
   /\.cart-item-satir2\s+\.cart-item-rozet\s*>\s*\*\s*\{[^}]*display:\s*inline-block/.test(cssTemiz),
   (cssTemiz.match(/\.cart-item-satir2\s+\.cart-item-rozet\s*>\s*\*\s*\{[^}]*\}/) || [''])[0]);
ok('  rozet ic ogesinde text-overflow: ellipsis',
   /\.cart-item-satir2\s+\.cart-item-rozet\s*>\s*\*\s*\{[^}]*text-overflow:\s*ellipsis/.test(cssTemiz));

console.log('\n=== 8. DAR EKRAN (<=360px): ROZET IKONA INER ===');
// OLCULDU: 320px'te rozete kalan 64px; en kisa anlamli etiket ("Suphe") 71px.
// Sigmiyor -> ellipsis "S..." uretiyordu: yer kapliyor, bilgi vermiyor.
// Esik uzerinde metin GERI GELIR (361px kontrol grubu, canli olculdu).
// DIKKAT: dosyada BASKA bir "@media (max-width: 360px)" blogu daha var
// (.cmp-mkt-item-img). Ilk eslesmeyi almak yanlis bloga bakmak demek -- ilk
// yazisimda tam bunu yapip yanlis KIRMIZI aldim. Bu yuzden 360px bloklarinin
// HEPSI suslu parantez sayilarak cikariliyor ve icinde .cart-item-satir2
// gecen SECILIYOR.
function medyaBloklari(css, kosul) {
  const bloklar = [];
  const desen = new RegExp('@media\\s*\\(max-width:\\s*' + kosul + '\\)\\s*\\{', 'g');
  let m;
  while ((m = desen.exec(css)) !== null) {
    let d = 1;
    let j = m.index + m[0].length;
    for (; j < css.length && d > 0; j++) {
      if (css[j] === '{') d++;
      else if (css[j] === '}') d--;
    }
    bloklar.push(css.slice(m.index, j));
  }
  return bloklar;
}
const darBlok = medyaBloklari(cssTemiz, '360px').find((b) => b.includes('.cart-item-satir2')) || '';
ok('<=360px media query var', darBlok.length > 0, cssTemiz.slice(-400));
ok('  rozet metni gizleniyor (font-size: 0)', /\.cart-item-rozet\s*>\s*\*\s*\{[^}]*font-size:\s*0/.test(darBlok), darBlok);
// KRITIK: display:none OLMAMALI -- metin erisilebilirlik agacindan da duserdi.
ok('  display:none KULLANILMIYOR (metin a11y agacinda kalsin)', !/display:\s*none/.test(darBlok), darBlok);

console.log('\n=== 9. IKON-ONLY ROZETIN ERISIM YOLU ===');
// Ikon tek basina anlasilmaz -> kullanici dokunup TAM metni gorebilmeli.
// Yeni mekanizma EKLENMEDI: sepet karti zaten role="button" + openDetay
// tasiyor ve rozetin tam metni urun detayinda duruyor. Bu satir o yolun
// SESSIZCE kaldirilmasina karsi kilit.
ok('sepet karti role="button"', /class="cart-item"[^>]*role="button"/.test(rs), '');
ok('sepet karti tiklaninca DETAY aciliyor (ikonun erisim yolu)',
   /class="cart-item"[^>]*onclick="openDetay\(/.test(rs), '');
ok('sepet karti klavyeyle de acilabiliyor (tabindex + onkeydown)',
   /class="cart-item"[^>]*tabindex="0"/.test(rs) && /class="cart-item"[^>]*onkeydown="_kartTus\(/.test(rs), '');

console.log('\n=== 10. SERIT KARTI GORSELI: contain (cover KIRPIYORDU) ===');
// OLCULDU: cover ile 500x500 kaynak 122x74 kutuya doldurulunca cizilen 122x122
// oluyor, 48px tasiyor (USTTEN 24 + ALTTAN 24, object-position 50% 50%) ve
// urun fotografinin %39'u kayboluyordu -- ambalajin kapagi/tabani kadraj disi.
// Cozunurluk sorunu DEGILDI: efektif yogunluk 1,81x (DPR 2'de fazlasiyla keskin).
// Kategori (.product-card-img) ve firsat (.firsat-card-img) kartlari ZATEN contain.
const seritImg = (cssTemiz.match(/\.strip-card-img\s*\{[^}]*\}/) || [''])[0];
ok('.strip-card-img object-fit: contain', /object-fit:\s*contain/.test(seritImg), seritImg);
ok('  cover DEGIL (kirpma geri gelmesin)', !/object-fit:\s*cover/.test(seritImg), seritImg);
// Kutu olcusu degismemeli -- duzeltmenin sarti buydu.
ok('  kutu olcusu korunuyor (100% x 90px)', /width:\s*100%/.test(seritImg) && /height:\s*90px/.test(seritImg), seritImg);
// Envanter tutarliligi: ayni urun fotografini gosteren diger iki yuzey de contain.
const katImg = (cssTemiz.match(/\.product-card-img\s*\{[^}]*\}/) || [''])[0];
const firImg = (cssTemiz.match(/\.firsat-card-img\s*\{[^}]*\}/) || [''])[0];
ok('  kategori karti da contain (envanter tekil)', /object-fit:\s*contain/.test(katImg), katImg);
ok('  firsat karti da contain (envanter tekil)', /object-fit:\s*contain/.test(firImg), firImg);

console.log('\n=== 11. DETAY BIRIM FIYATI KOMSULARIYLA HIZALI ===');
// SIKAYET "kg basina bilgisi ekranin soluna sikisiyor" idi; OLCUM sikisma
// DEGIL HIZASIZLIK gosterdi. .detay-birim-fiyat, .detay-info'nun KARDESI ve
// yatay dolguyu .detay-info kendisi tasidigi icin bu ogeye hic uygulanmiyordu.
// Olculdu (320/360/390/430, dordunde de ayni): metin sol kenari 0 iken
// komsulari (.detay-name / .detay-unit / .detay-sec-label) 16'daydi.
// Kirpilma, tasma, kesisim YOKTU -- yalnizca 16px sola kacikti.
{
  const bf = (cssTemiz.match(/\.detay-birim-fiyat\s*\{[^}]*\}/) || [''])[0];
  ok('.detay-birim-fiyat kurali bulundu', bf.length > 0);
  ok('  yatay dolgu VAR (komsulariyla hizali)',
     /padding-left:\s*var\(--space-4\)/.test(bf) && /padding-right:\s*var\(--space-4\)/.test(bf), bf);
  // Deger komsulardan KOPYALANDI: .detay-info ve .detay-section da --space-4.
  const info = (cssTemiz.match(/\.detay-info\s*\{[^}]*\}/) || [''])[0];
  ok('  deger komsuyla AYNI token (--space-4)', /var\(--space-4\)/.test(info), info);
  // Yukseklik degismemeli: yalniz YATAY dolgu eklendi.
  ok('  dikey dolgu EKLENMEDI (blok yuksekligi sabit)',
     !/padding-top:/.test(bf) && !/padding-bottom:/.test(bf) && !/padding:\s*[^;]*\s+[^;]*\s+/.test(bf), bf);
}

console.log('\n=== KATEGORI IZGARASI ICIN YER AYRILDI (CLS) ===');
// `#home-cats` HTML'de BOS geliyor, renderCatGrid() 8 karti sonradan basiyor
// ve kutu 0 -> 450px buyuyup altindaki her seyi itiyordu. Olculdu
// (layout-shift kaynaklari): toplam kayma 1,14 -> rezervle 0,773.
{
  // Yorumlari soy: bu rezervi ANLATAN yorum "min-height" ve "450" yaziyor.
  // style.css saf CSS, blok-yorum soyma burada guvenli (app.js'te DEGIL).
  const CSS_TEMIZ = CSS.replace(/\/\*[\s\S]*?\*\//g, '');
  ok('kontrol grubu: soyucu kodu yemedi', CSS_TEMIZ.includes('#home-cats') && CSS_TEMIZ.length > 1000);

  const kural = (CSS_TEMIZ.match(/#home-cats\s*\{[^}]*\}/) || [''])[0];
  ok('#home-cats icin min-height rezervi VAR', /min-height/.test(kural), kural || '(kural yok)');
  ok('  rezerv 450px (olculen gercek izgara yuksekligi 450,4)',
     /min-height:\s*450px/.test(kural), kural);

  // MOBILE SINIRLI OLMALI: >=1024px'te izgara auto-fill, sutun sayisi
  // genislige gore degisiyor -> sabit rezerv ara genisliklerde izgaranin
  // ALTINDA KALICI BOSLUK birakirdi. Kural bir max-width medya sorgusunda
  // olmali; degilse "duzeltme" gorunur bir kusur uretir.
  // DIKKAT: indexOf('#home-cats') YANLIS yeri bulur -- dosyada once
  // `#screen-home.arama-aktif #home-cats` secici listesi geciyor. Kuralin
  // KENDI konumu alinmali. (Bu tuzaga bu iddiayi yazarken bir kez dusuldu.)
  const eslesme = CSS_TEMIZ.match(/#home-cats\s*\{[^}]*min-height[^}]*\}/);
  const i = eslesme ? eslesme.index : -1;
  ok('  rezerv kuralinin konumu bulundu', i >= 0);
  const oncesi = i < 0 ? '' : CSS_TEMIZ.slice(Math.max(0, i - 400), i);
  ok('  rezerv YALNIZ dar ekranda (max-width medya sorgusu icinde)',
     /@media[^{]*max-width:\s*1023px[^{]*\{[^@]*$/.test(oncesi),
     oncesi.slice(-120));

  // Rezerv sayisi kart tasarimindan turuyor: 4 satir x kart + 3 gap + ust dolgu.
  // Kart yuksekligi degisirse bu iddia hatirlatici olur (tarayicida olculur).
  ok('  izgara hala 2 sutun (4 satir varsayimi gecerli)',
     /\.cat-grid\s*\{[^}]*grid-template-columns:\s*1fr 1fr/.test(CSS_TEMIZ),
     'auto-fill dar ekrana kayarsa 4 satir varsayimi coker');
}

console.log('\nSONUC: PASS=' + pass + ' FAIL=' + fail);
process.exit(fail ? 1 : 0);
