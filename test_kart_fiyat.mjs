// Serit kartinin HIYERARSISI ve FIYAT satiri (Faz 2).
// app.js'ten fonksiyon KAYNAGINI cikarip vm'de calistirir -- kopya mantik degil.
// Kullanim: node test_kart_fiyat.mjs
import fs from 'fs';
import vm from 'vm';
import { tokenCoz } from './scripts/css-token.mjs';
import { enYeniGozlemTarihi } from './scripts/veri-tarihi.mjs';

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

// ── ortam ──────────────────────────────────────────────────────────────
const ctx = {
  _kacir: (s) => (s == null ? '' : String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;')),
  console, Math, String, Number, parseFloat, parseInt, isNaN, Array, Object, Set, Map, JSON,
  placeholderRenk: () => ({ emoji: '🥤' }),
  ustKategori: (x) => x,
};
vm.createContext(ctx);
vm.runInContext([
  fnKaynak('tl'), fnKaynak('enDusukFiyat'), fnKaynak('_birimFiyatAyristir'),
  fnKaynak('birimFiyatHesapla'), fnKaynak('birimFiyatYazi'),
  fnKaynak('_stripKartHTML'), fnKaynak('_kartaRozetEkle'),
].filter(Boolean).join('\n'), ctx);
const calis = (i) => vm.runInContext(i, ctx);

const U = (ad, gramaj, fiyat) => ({
  _id: 'x1', ad, agirlik_hacim: gramaj,
  market_fiyatlari: [{ market: 'bim', fiyat }],
  en_dusuk_fiyat: fiyat,
});

console.log('\n=== 1. FIYAT KARTTA (2b) ===');
{
  const h = calis(`_stripKartHTML(${JSON.stringify(U('Test Urun 500 Gr', '500 GR', 76.5))}, null)`);
  ok('kartta .strip-card-fiyat var', /class="strip-card-fiyat"/.test(h), h.slice(0, 160));
  ok('  fiyat TL bicimli yaziliyor', /strip-card-fiyat">[^<]*76,50/.test(h), h);
  ok('  birim fiyat satiri da duruyor (fiyattan farkli)', /strip-card-sub/.test(h) && /kg başına/.test(h), h);
}

console.log('\n=== 2. HIYERARSI SIRASI: gorsel → FIYAT → rozet → ad → birim fiyat ===');
{
  const h = calis(`_stripKartHTML(${JSON.stringify(U('Test Urun 500 Gr', '500 GR', 76.5))}, {tip:'kirmizi', yuzde:100})`);
  const iFiyat = h.indexOf('strip-card-fiyat');
  const iRozet = h.indexOf('strip-card-rozet');
  const iAd = h.indexOf('strip-card-name');
  const iSub = h.indexOf('strip-card-sub');
  ok('fiyat, rozetten ONCE', iFiyat > -1 && iRozet > iFiyat, `fiyat=${iFiyat} rozet=${iRozet}`);
  ok('rozet, urun adindan ONCE', iRozet > -1 && iAd > iRozet, `rozet=${iRozet} ad=${iAd}`);
  ok('urun adi, birim fiyattan ONCE', iAd > -1 && iSub > iAd, `ad=${iAd} sub=${iSub}`);
}

console.log('\n=== 3. BIRIM FIYAT TEKRARI (1 kg/L urunler) ===');
{
  // 1 Lt urun: birim fiyat = fiyat. Rozet YOKKEN satir gizlenir.
  const h1 = calis(`_stripKartHTML(${JSON.stringify(U('Yag 1 Lt', '1 LT', 199.95))}, null)`);
  ok('rozet yokken tekrar eden birim fiyat satiri YAZILMIYOR', !/strip-card-sub/.test(h1), h1);
  // TUZAK rozeti varken ASLA gizlenmez: rozet ("%100 pahali") aynı ürünün başka
  // paket boyuna göre BIRIM FIYAT farkını söylüyor; "L başına" etiketi olmadan
  // kullanıcı neyin pahalı olduğunu anlayamaz.
  const h2 = calis(`_stripKartHTML(${JSON.stringify(U('Yag 1 Lt', '1 LT', 199.95))}, {tip:'kirmizi', yuzde:100})`);
  ok('tuzak rozeti VARKEN birim fiyat satiri KORUNUYOR', /strip-card-sub/.test(h2) && /L başına/.test(h2), h2);
}

console.log('\n=== 4. ROZET YUVASI ===');
{
  const ham = calis(`_stripKartHTML(${JSON.stringify(U('Test 500 Gr', '500 GR', 76.5))}, null)`);
  ok('kart bos halde <!--ROZET--> yuvasi tasiyor', ham.includes('<!--ROZET-->'), ham.slice(0, 120));
  const dolu = calis(`_kartaRozetEkle(${JSON.stringify(ham)}, '<span class="zam-rozet">+%137</span>', '<div class="zam-yayginlik">Yalnizca X</div>')`);
  ok('  yuva tuketiliyor (isaretci kalmiyor)', !dolu.includes('<!--ROZET-->'), dolu);
  ok('  rozet FIYATIN altina giriyor', dolu.indexOf('zam-rozet') > dolu.indexOf('strip-card-fiyat'), dolu);
  ok('  rozet urun adindan ONCE', dolu.indexOf('zam-rozet') < dolu.indexOf('strip-card-name'), dolu);
  ok('  yayginlik satiri kartin EN ALTINDA', dolu.indexOf('zam-yayginlik') > dolu.indexOf('strip-card-sub'), dolu);
  // Isaretci yoksa eski davranis (kart sonuna ekle) korunmali
  const eski = calis(`_kartaRozetEkle('<div class="k"><div class="a"></div></div>', '<span class="r"></span>')`);
  ok('  isaretcisiz kartta eski davranis korunuyor', /<span class="r"><\/span><\/div>$/.test(eski), eski);
}

console.log('\n=== 5. TASARIM TOKENLARI ===');
{
  // Satir basina demirle: aksi halde `.detay-bolum-liste-strip .strip-card`
  // kurali once eslesiyor ve yanlis kurali sinamis oluyoruz.
  const kartKural = (CSS.match(/^\.strip-card \{[^}]*\}/m) || [''])[0];
  ok('kart genisligi token uzerinden (--kart-genislik)', /var\(--kart-genislik\)/.test(kartKural), kartKural.slice(0, 120));
  ok('  token 164px olarak tanimli', /--kart-genislik:\s*164px/.test(CSS));
  ok('  min-width:0 duruyor (flex-basis ezilmesin)', /min-width:\s*0/.test(kartKural), kartKural.slice(0, 120));
  // Kart genisligi TEK YERDEN: hicbir kural ham px ile ezmemeli.
  const ezenler = (CSS.match(/\.strip-card \{[^}]*flex:[^;}]*\d+px/g) || []);
  ok('  hicbir kural genisligi ham px ile ezmiyor', ezenler.length === 0, ezenler.join(' | '));

  const fiyatKural = tokenCoz(CSS, (CSS.match(/\.strip-card-fiyat \{[^}]*\}/) || [''])[0]);
  ok('fiyat olcegin 5. adimindan (24px)', /font-size:\s*24px/.test(fiyatKural), fiyatKural);
  ok('  marka yazi tipi Cabinet Grotesk', /Cabinet Grotesk/.test(fiyatKural), fiyatKural);

  const adKural = tokenCoz(CSS, (CSS.match(/\.strip-card-name \{[^}]*\}/) || [''])[0]);
  ok('ad govde adiminda kaliyor (16px) — Faz 1 kazanimi bozulmadi', /font-size:\s*16px/.test(adKural), adKural);
  ok('  ad ikincil agirlikta (500), fiyat 800', /font-weight:\s*500/.test(adKural), adKural);
}

console.log('\n=== 6. SERIT ONCELIGI (2c) ===');
{
  // 2026-08-23: sinif listesine .gizli eklendi (CSP style-src gocu), yani oncelik
  // sinifindan SONRA baska sinif gelebilir. Iddia yine "oncelik sinifi VAR" diyor,
  // tam-dize esitligi degil.
  const oncelikli = (HTML.match(/class="home-strip home-strip--oncelik(?:\s[^"]*)?"/g) || []).length;
  ok('iki serit oncelikli isaretli', oncelikli === 2, 'adet=' + oncelikli);
  ok('  tuzaklar oncelikli', /id="home-tuzaklar" class="home-strip home-strip--oncelik(?:\s[^"]*)?"/.test(HTML));
  ok('  zam oncelikli', /id="home-zam" class="home-strip home-strip--oncelik(?:\s[^"]*)?"/.test(HTML));
  const oncelikKural = tokenCoz(CSS, (CSS.match(/\.home-strip--oncelik \.home-strip-title \{[^}]*\}/) || [''])[0]);
  ok('oncelikli baslik bir olcek adimi buyuk (24px)', /font-size:\s*24px/.test(oncelikKural), oncelikKural);
  ok('  agirlik 800 (fontshare yalnizca 700/800 indiriyor)', /\.home-strip--oncelik \.home-strip-title,?\s*\n?\s*\.profil-istat-sayi \{ font-weight: 800/.test(CSS) || /home-strip--oncelik[^}]*font-weight: 800/.test(CSS.replace(/\n/g, ' ')), '');
  ok('serit ayrimi CIZGIYLE degil BOSLUKLA', !/\.home-strip \{[^}]*border-(top|bottom)\s*:/.test(CSS), '');
}

console.log('\n=== 7. VERI TAZELIGI (2d) ===');
{
  ok('ana sayfada gosterge kabi var', /id="veri-tazelik"/.test(HTML));
  ok('  varsayilan gizli (bos kabuk yok)', /id="veri-tazelik"[^>]*hidden/.test(HTML));
  ok('veriTazelikCiz tanimli', !!fnKaynak('veriTazelikCiz'));
  // Yorumlar cikarilmadan aranirsa fonksiyonun KENDI uyari yorumu
  // ("toISOString().slice() YASAK") esleşip yanlis alarm veriyor.
  const src = fnKaynak('veriTazelikCiz') || '';
  const kod = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
  ok('  BUILD ANINI (uretim) KULLANMIYOR', !/\buretim\b/.test(kod), kod.slice(0, 200));
  ok('  veri_tarihi alanindan besleniyor', /veri_tarihi/.test(APP));
  // Yerel gun hatasi bu depoda 3 kez yasandi: toISOString().slice() YASAK.
  ok('  toISOString ile tarih KESILMIYOR', !/toISOString\(\)\s*\.slice/.test(kod), kod);
  ok('  <time datetime> ile makineye de yaziliyor', /<time datetime=/.test(src), src.slice(0, 200));
}

console.log('\n=== 8. VERI TARIHI TEK KAYNAK ===');
{
  const hub = fs.readFileSync('scripts/hub-uret.mjs', 'utf8');
  const ana = fs.readFileSync('scripts/anasayfa-uret.mjs', 'utf8');
  ok('hub-uret ortak modulu kullaniyor', /from '\.\/veri-tarihi\.mjs'/.test(hub));
  ok('anasayfa-uret ortak modulu kullaniyor', /from '\.\/veri-tarihi\.mjs'/.test(ana));
  // "gecmisFiyatlar uzerinde dongu var mi" cok genis bir olcut: hub-uret o
  // veriyi baska islerde de geziyor. Aranan sey EN YENI TARIH hesabinin
  // ikinci kopyasi — onun imzasi `k.t > <birikirici>` karsilastirmasi.
  ok('  en yeni tarih hesabi ikinci kez yazilmamis',
     !/k\.t\s*>\s*enYeni/.test(hub) && !/k\.t\s*>\s*enYeni/.test(ana), '');
  ok('  ikisi de AYNI fonksiyonu cagiriyor',
     /enYeniGozlemTarihi\(/.test(hub) && /enYeniGozlemTarihi\(/.test(ana), '');

  // Fonksiyon davranisi: iki kaynagin MAKSIMUMU
  const g = { s1: [{ t: '2026-08-10' }, { t: '2026-08-14' }] };
  const urunler = [{ fiyat_gecmisi: [['2026-08-12', 10], ['2026-08-17', 11]] }];
  ok('iki kaynagin buyugu seciliyor', enYeniGozlemTarihi(g, urunler) === '2026-08-17', enYeniGozlemTarihi(g, urunler));
  ok('  yalnizca gecmis_fiyatlar varken de calisiyor', enYeniGozlemTarihi(g, []) === '2026-08-14');
  ok('  yalnizca urunler varken de calisiyor', enYeniGozlemTarihi({}, urunler) === '2026-08-17');
  let atti = false;
  try { enYeniGozlemTarihi({}, []); } catch { atti = true; }
  ok('  gozlem yoksa SESSIZCE bozuk damga uretmiyor, hata atiyor', atti);
}


// Bir seciciyi ve govdesini cikarir (yorumlar SOYULMUS metinden).
function kuralGovdesi(sec) {
  // Yorumlar ONCE soyuluyor: bu depoda testler kendi aciklama yorumuyla
  // UC kez eslesti (test_splash, position:relative taramasi, ...).
  const t = CSS.replace(/\/\*[\s\S]*?\*\//g, '');
  // TUM eslesen kurallari topluyor, ILKINI degil. Ilk hali .strip-card'i
  // cok secicili bir `touch-action` listesinde bulup orada duruyordu ve
  // "zemin tokeni yok" diye YANLIS ALARM verdi. CSS zaten kaskad; dogru
  // soru "bu seciciye uyan kurallarin TOPLAMINDA ne yaziyor".
  const kacir = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, (m) => '\\' + m);
  const re = new RegExp('(^|[},])\\s*' + kacir(sec) + '\\s*[,{]', 'gm');
  const parcalar = [];
  let m;
  while ((m = re.exec(t)) !== null) {
    const a = t.indexOf('{', m.index), b = t.indexOf('}', a);
    if (a >= 0 && b >= 0) parcalar.push(t.slice(a + 1, b).replace(/\s+/g, ' ').trim());
    re.lastIndex = b > 0 ? b : re.lastIndex;
  }
  return parcalar.join(' ; ');
}


console.log('\n=== 9. UST ISIK SERIDI + ZEMIN TOKENLARI (2026-09-05) ===');
// NEDEN: acik temada kart<->sayfa kontrasti OLCULDU, 1,054 -- karti pratikte
// yalnizca golge tutuyordu. Serit, yuzey rengine DOKUNMADAN ayrim getiriyor.
// Yuzeyi tonlamak SECILMEDI cunku urun fotograflari opak (286 gorselin 115'i
// JPEG, orneklenen 25 PNG'nin 25'i alfasiz) ve tonlu zemin fotografin
// arkasinda kirli bir bant birakirdi.
{
  const seritKural = kuralGovdesi('.strip-card::before');
  ok('ust serit kurali tanimli', !!seritKural, 'bulunamadi');
  ok('serit yuksekligi tokenden (--kart-serit)', /var\(--kart-serit\)/.test(seritKural), seritKural);
  ok('serit ham px yuksekligi TASIMIYOR', !/height:\s*\d+px/.test(seritKural), seritKural);
  ok('serit markanin KENDI degrade cifti (--primary -> --primary-light)',
     /var\(--primary\)/.test(seritKural) && /var\(--primary-light\)/.test(seritKural), seritKural);
  ok('seritte ham hex YOK', !/#[0-9A-Fa-f]{3,6}/.test(seritKural), seritKural);
  // "none VAR MI" diye sormak YETMEZ: ayni blokta sonra gelen bir
  // `pointer-events: auto` onu ezer ve iddia yine yesil kalir. Harness bunu
  // KOR NOKTA olarak yakaladi (2026-09-05). Iddia gevsetilmedi, daraltildi:
  // son soz sahibi bildirim `none` olmali.
  const peHepsi = [...seritKural.matchAll(/pointer-events:\s*([a-z-]+)/g)].map((m) => m[1]);
  ok('serit tiklamayi engellemiyor (SON pointer-events none)',
     peHepsi.length > 0 && peHepsi[peHepsi.length - 1] === 'none',
     peHepsi.join(' -> ') || '(hic yok)');
  // overflow:hidden BILEREK kullanilmadi -- .add-btn 2026-08-19'da tam oyle
  // kirpilmisti. Serit kosede kartin kendi radius'unu miras aliyor.
  ok('serit radius MIRAS aliyor (overflow:hidden yerine)',
     /border-radius:\s*inherit/.test(seritKural), seritKural);
  const stripKural = kuralGovdesi('.strip-card');
  ok('.strip-card overflow:hidden EKLENMEDI (add-btn kirpma tuzagi)',
     !/overflow:\s*hidden/.test(stripKural), stripKural.slice(0, 110));
  ok('.strip-card konumlanmis (serit icin gerekli)',
     /position:\s*relative/.test(stripKural), stripKural.slice(0, 110));

  // Kart ve gorsel kutulari TOKEN kullanmali. Once elle #fff yaziliydi ve
  // koyu tema ayri bir override'la kurtariyordu -- iki kaynak.
  const tokenli = ['.strip-card', '.strip-card-img-ph', '.product-card',
                   '.product-card-img', '.product-card-img-ph'];
  for (const s of tokenli) {
    const g = kuralGovdesi(s);
    const bg = (/background:\s*([^;]+)/.exec(g) || [, ''])[1].trim();
    ok(s + ' zemini TOKEN (elle beyaz degil)',
       /var\(--/.test(bg), bg || '(background yok)');
  }
  // GERCEK KUSUR (olculdu, 50 oge): firsat gorsel kutusu koyu temada
  // #F9FAFB kaliyordu -- koyu kartin ustunde parlak gri kare.
  for (const s of ['.firsat-card-img', '.firsat-card-img-ph']) {
    const g = kuralGovdesi(s);
    const bg = (/background:\s*([^;]+)/.exec(g) || [, ''])[1].trim();
    ok(s + ' zemini TOKEN (koyu temada parlak gri kalmasin)',
       /var\(--/.test(bg), bg || '(background yok)');
  }
}

console.log(`\nPASS=${pass}  FAIL=${fail}`);
process.exit(fail ? 1 : 0);
