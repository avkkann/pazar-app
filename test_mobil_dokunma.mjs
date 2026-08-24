// Mobil dokunma: cift-tik zoom kapali ama PINCH acik, + butonu kirpilmiyor.
// Kullanim: node test_mobil_dokunma.mjs
import fs from 'fs';

const APP = fs.readFileSync('app.js', 'utf8');
const CSS = fs.readFileSync('style.css', 'utf8');
const HTML = fs.readFileSync('index.html', 'utf8');

let pass = 0, fail = 0;
const ok = (ad, k, d = '') => { if (k) { pass++; console.log('  PASS  ' + ad); } else { fail++; console.log('  FAIL  ' + ad + (d ? '  -> ' + d : '')); } };

console.log('\n=== 1. ERISILEBILIRLIK: PINCH ZOOM KORUNUYOR ===');
{
  const vp = (/<meta name="viewport" content="([^"]*)"/.exec(HTML) || [])[1] || '';
  ok('viewport bulundu', !!vp, vp);
  // Denetimde maximum-scale=1.0 BILEREK kaldirildi; geri gelirse zoom kilitlenir.
  ok('  maximum-scale YOK (denetimde kaldirilmisti)', !/maximum-scale/.test(vp), vp);
  ok('  user-scalable=no YOK', !/user-scalable\s*=\s*(no|0)/.test(vp), vp);
  // PINCH'i olduren touch-action degerleri hicbir yerde olmamali
  const olduren = (CSS.match(/touch-action:\s*(none|pan-x|pan-y)\s*;/g) || []);
  ok('touch-action: none / pan-x / pan-y KULLANILMIYOR (pinch\'i oldururler)',
     olduren.length === 0, olduren.join(' '));
}

console.log('\n=== 2. CIFT-TIK ZOOM KAPALI (manipulation) ===');
{
  ok('html/body\'de touch-action: manipulation',
     /html,\s*body \{[^}]*touch-action:\s*manipulation/.test(CSS), '');
  // Etkilesimli ogelerde de ACIKCA yazili olmali (iOS'ta koke guvenmek yetmiyor)
  const blok = (CSS.match(/button, a, \[role="button"\][^{]*\{[^}]*\}/) || [''])[0];
  ok('etkilesimli ogelerde ACIKCA yazili', /touch-action:\s*manipulation/.test(blok), blok.slice(0, 140));
  for (const s of ['.product-card', '.cat-card', '.strip-card', '.add-btn', '.nav-btn']) {
    ok(`  ${s} kapsamda`, blok.includes(s), blok.slice(0, 180));
  }
  const say = (CSS.match(/touch-action:\s*manipulation/g) || []).length;
  ok('  en az iki yerde (kok + etkilesimli)', say >= 2, 'adet=' + say);
}

console.log('\n=== 3. + BUTONU: KONUM EZILMIYOR ===');
{
  // Kendi kuralinda absolute olmali
  const kendi = (CSS.match(/\.add-btn \{[^}]*\}/) || [''])[0];
  ok('.add-btn kurali bulundu', kendi.length > 20, kendi.slice(0, 90));
  ok('  position: absolute', /position:\s*absolute/.test(kendi), kendi.slice(0, 120));

  // 44px dokunma listesi .add-btn'i position:relative'e EZMEMELI.
  // Secici listesine demirlemek yerine "position:relative veren TUM kurallar"
  // taranıyor: aksi halde listeye .add-btn eklenince regex hic eslesmiyor ve
  // test "liste bulunamadi" gibi YANLIS bir sebeple kiriliyordu.
  // YORUMLARI SOY: aksi halde kuralin USTUNDEKI aciklama yorumu secicinin
  // parcasi gibi yakalaniyor ve o yorumda gecen ".add-btn" yanlis alarm
  // veriyor. (Bu tuzaga bu depoda ikinci kez dusuldu — bkz. test_splash.)
  const CSS_KODU = CSS.replace(/\/\*[\s\S]*?\*\//g, '');
  const relKurallar = (CSS_KODU.match(/[^{}]+\{\s*position:\s*relative;\s*\}/g) || []);
  ok('position:relative veren kural(lar) bulundu', relKurallar.length > 0, 'adet=' + relKurallar.length);
  const ezen = relKurallar.filter(k => /(^|,|\s)\.add-btn(,|\s|\{)/.test(k.split('{')[0]));
  ok('  .add-btn hicbirinde YOK (absolute\'unu ezerdi)', ezen.length === 0,
     ezen.map(k => k.split('{')[0].trim().slice(0, 90)).join(' | '));

  // Ama 44px KATMANI hala .add-btn'i kapsamali
  const afterListe = (CSS.match(/\.add-btn::after[^{]*\{[^}]*\}/) || [''])[0];
  ok('44px katmani .add-btn\'i HALA kapsiyor', /\.add-btn::after/.test(CSS), '');
  ok('  katman 44x44', /min-width:\s*44px/.test(afterListe) && /min-height:\s*44px/.test(afterListe),
     afterListe.slice(0, 160));
}

console.log('\n=== 4. URUN GORSELI YEDEGI: onerror ICINDE HTML URETILMIYOR ===');
{
  // TARIHCE: bu blok eskiden onerror ICINDEKI tirnak kacisini denetliyordu
  // (\\' olmali, \' olursa oznitelik kapanir ve yedek HIC cizilmez -- 2026-08-19'da
  // tam olarak bu bug yasandi). 2026-08-24'te yedek mekanizmasi degisti: yedek
  // kutusu artik HER ZAMAN ciziliyor ve resim ustune biniyor, dolayisiyla
  // onerror'in HTML uretmesine gerek kalmadi (this.remove() yetiyor).
  //
  // IDDIA GEVSETILMEDI, GUCLENDIRILDI: eskiden "kacis dogru yazilmis mi" diye
  // soruyordu; simdi "onerror ICINDE HIC HTML URETILMIYOR mu" diye soruyor.
  // Ikincisi bug SINIFINI komple ortadan kaldirir -- kacirilacak tirnak yoksa
  // yanlis kacirma da olamaz.
  const urun  = (APP.match(/<img class="product-card-img"[^`]*/) || [''])[0];
  const serit = (APP.match(/<img class="strip-card-img"[^`]*/) || [''])[0];
  ok('urun karti img satiri bulundu', urun.length > 40, urun.slice(0, 80));
  ok('serit karti img satiri bulundu', serit.length > 40, serit.slice(0, 80));

  for (const [ad, s] of [['urun', urun], ['serit', serit]]) {
    const oe = (/onerror="([^"]*)"/.exec(s) || [])[1] || '';
    ok(ad + ': onerror var', oe.length > 0, s.slice(0, 160));
    ok('  ' + ad + ': onerror ICINDE < yok (HTML uretmiyor)', !oe.includes('<'), oe);
    ok('  ' + ad + ': outerHTML/innerHTML yazmiyor', !/outerHTML|innerHTML/.test(oe), oe);
    ok('  ' + ad + ': kacirilmis tirnak yok', !oe.includes("\\'"), oe);
  }

  // Yedek kutusu resimden BAGIMSIZ olarak ciziliyor mu (asil duzeltme).
  ok('urun karti: img yedek kutusunun ICINDE', /product-card-img-ph gorsel-yuva[^`]*<img class="product-card-img"/.test(APP), '');
  ok('serit karti: img yedek kutusunun ICINDE', /strip-card-img-ph gorsel-yuva[^`]*<img class="strip-card-img"/.test(APP), '');
  ok('  ikisi AYNI deseni kullaniyor (gorsel-yuva)',
     /product-card-img-ph gorsel-yuva/.test(APP) && /strip-card-img-ph gorsel-yuva/.test(APP), '');
}

console.log('\n=== 5. iOS SEKME-GECIS ZOOM + ODAK ZOOM ===');
{
  const CSS_KODU = CSS.replace(/\/\*[\s\S]*?\*\//g, '');
  // (a) Sekme gecisi .screen'i translateX(100%) ile oteliyor (animSlideInRight).
  //     Kirpma yoksa gelen ekran viewport'un sagina tasip iOS'ta layout
  //     viewport'u genisletip daraltiyor -> "zoom" hissi + cift relayout.
  //     Olculdu (mobil emulasyon): kirpma YOK -> innerWidth 390->780->390;
  //     html,body overflow-x:clip -> 390 sabit. Yalniz body YETMIYOR (sag
  //     tasma koke sizip innerWidth'i buyutuyor), kok de kirpilmali.
  ok('html, body overflow-x: clip (sekme-gecis tasmasi kirpiliyor)',
     /html,\s*body\s*\{\s*overflow-x:\s*clip;?\s*\}/.test(CSS_KODU), 'clip kurali yok -> gecis zoom regresyonu geri gelir');
  ok('  kirpma KOKTE de var (html) — yalniz body yetmiyordu',
     /html,\s*body[^{]*\{[^}]*overflow-x:\s*clip/.test(CSS_KODU), '');
  ok('  Safari <16 yedegi: @supports not (overflow: clip) -> hidden',
     /@supports\s+not\s*\(overflow:\s*clip\)\s*\{[^}]*overflow-x:\s*hidden/.test(CSS_KODU), '');
  // clip KULLANILIYOR (hidden DEGIL) — hidden kaydirma baglami yaratip sticky'yi bozardi
  ok('  ana kural clip (hidden degil — sticky/dikey kaydirma korunur)',
     !/html,\s*body\s*\{\s*overflow-x:\s*hidden;?\s*\}/.test(CSS_KODU.replace(/@supports[^{]*\{[^}]*\{[^}]*\}[^}]*\}/g, '')), '');

  // (b) 16px alti input iOS'ta ODAKTA yakinlastirir ve zoom KALICI kalir.
  for (const sel of ['.cat-search-wrap input', '.firsat-arabar input', '.alarm-input']) {
    const re = new RegExp(sel.replace(/[.[\]]/g, '\\$&') + '\\s*\\{[^}]*\\}');
    const kural = (CSS_KODU.match(re) || [''])[0];
    const m = /font-size:\s*([\d.]+)(px|rem)/.exec(kural);
    const px = m ? (m[2] === 'rem' ? parseFloat(m[1]) * 16 : parseFloat(m[1])) : null;
    ok(`  ${sel} font-size >= 16px (odak zoom yok)`, px !== null && px >= 16,
       'font-size=' + (m ? m[0] : 'YOK') + (px !== null ? ' (' + px + 'px)' : ''));
  }

  // (c) Tarayici metin boyutunu kendiligiden olceklemesin
  ok('  text-size-adjust: 100%', /(-webkit-)?text-size-adjust:\s*100%/.test(CSS_KODU), '');
}

console.log('\n=== 6. ANA SAYFA ARAMA: sonuc ilk ekranda (aradaki bolumler gizli) ===');
{
  const CSS_KODU = CSS.replace(/\/\*[\s\S]*?\*\//g, '');
  // Sorun: #search en ustte ama sonuc #home-search en altta; aradaki seritler
  // + kategori grid + mevsim + hal duruyordu -> sonuc katlamanin altinda
  // (olculdu: y=2031, viewport 844). Cozum: arama aktifken aradaki bolumleri
  // CSS ile gizle (#screen-home.arama-aktif) -> sonuc kutunun hemen altina gelir.
  // (a) JS: #search handler'i q'ya gore arama-aktif sinifini ekliyor
  ok('arama: #search handler screen-home\'a arama-aktif sinifini q ile ekliyor',
     /getElementById\('screen-home'\)\.classList\.toggle\('arama-aktif',\s*!!q\)/.test(APP),
     'toggle yok -> sonuc yine katlamanin altinda kalir');
  // (b) CSS: arama-aktifken aradaki bolumler display:none !important
  const kural = (CSS_KODU.match(/#screen-home\.arama-aktif[\s\S]*?\{[^}]*\}/) || [''])[0];
  ok('CSS: #screen-home.arama-aktif kurali var', kural.length > 20, kural.slice(0, 80));
  ok('  display: none !important (satir-ici display\'i ezer)', /display:\s*none\s*!important/.test(kural), kural.slice(0, 120));
  for (const s of ['.home-strip', '#home-cats', '#home-hal', '#veri-tazelik']) {
    ok(`  ${s} arama sirasinda gizleniyor`, kural.includes(s), kural.slice(0, 180));
  }
  // (c) Sonuc kabi #home-search GIZLENMEMELI
  ok('  #home-search gizlenenler arasinda DEGIL (sonuc gorunur kalir)', !kural.includes('#home-search'), kural);
  // (d) Her tusa scrollIntoView YAPMA (ziplama tuzagi) — gizleme ile cozuldu
  const idx = APP.indexOf("classList.toggle('arama-aktif'");
  const civar = idx >= 0 ? APP.slice(idx, idx + 900) : '';
  ok('  arama handler\'inda scrollIntoView YOK (her tusta ziplama yok)', idx >= 0 && !/scrollIntoView/.test(civar), '');
}

console.log('\n=== 7. SABLON-CHIP: 44px dokunma hedefi + KLAVYE ERISIMI ===');
{
  // renderSablonBar kaynagini izole et (markup + keydown burada)
  const bi = APP.indexOf('function renderSablonBar(');
  const src = bi >= 0 ? APP.slice(bi, APP.indexOf('\n}', bi) + 2) : '';
  ok('renderSablonBar bulundu', !!src, '');

  // --- DOKUNMA HEDEFI (::after 44) — gorsel boyut degismeden ---
  ok('CSS .sablon-chip::after min-height 44px (chip 44 dikey)',
     /\.sablon-chip::after \{[^}]*min-height:\s*44px/.test(CSS), '');
  ok('CSS .sablon-chip-del::after min-height 44px (sil butonu 44)',
     /\.sablon-chip-del::after \{[^}]*min-height:\s*44px/.test(CSS), '');
  // del, chip ::after'in USTUNDE kalmali (yoksa chip ::after del'i yutar -> tik yukle olur)
  ok('CSS .sablon-chip-del z-index (chip ::after ustunde, del tiklanir kalir)',
     /\.sablon-chip-del \{[^}]*z-index:/.test(CSS), '');
  ok('CSS .sablon-chip:focus-visible odak halkasi kurali',
     /\.sablon-chip:focus-visible/.test(CSS), '');

  // --- KLAVYE ERISIMI ---
  // Chip span'i odaklanabilir + rol tasimali (markup birlestirilmis -> kaynakta izole string)
  ok('markup: sablon-chip span role="button" tabindex="0" tasiyor',
     /role="button" tabindex="0"/.test(src), '');
  ok('markup: sablon-chip aria-label var (SR icin ne yaptigi belli)',
     /aria-label="/.test(src), '');
  // Birincil eylem (yukle) Enter/Space ile calismali — addEventListener (satir-ici handler EKLENMEDI)
  ok('keydown dinleyicisi var (Enter/Space -> sablonYukleUI)',
     /addEventListener\('keydown'[\s\S]*?sablonYukleUI\(chip\.dataset\.id\)/.test(src), '');
  ok('  keydown Enter VE Space kapsiyor',
     /keydown[\s\S]*?e\.key === 'Enter'[\s\S]*?e\.key === ' '/.test(src), '');
  // sil butonu native <button> (Tab+Enter ile zaten erisilir)
  ok('sil butonu native <button> (klavye ile erisilir)',
     /<button class="sablon-chip-del"/.test(src), '');
}

console.log(`\nPASS=${pass}  FAIL=${fail}`);
process.exit(fail ? 1 : 0);
