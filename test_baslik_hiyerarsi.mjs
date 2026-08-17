// BASLIK HIYERARSISI. Denetim: 8 ayri <h1> vardi ve hepsi ayni anda DOM'da
// (SPA — her ekran icin bir tane). Arama motoru icin sayfada TEK h1 olmali.
//
// COZUM: ana sayfa basligi (.header-text h1 = "Pazar") h1 kalir; diger 7 ekran
// basligi (.hdr-left) h2 olur. GORSEL DEGISMEZ — CSS'te secici h1'den h2'ye
// tasinir, deger tek satir bile oynamaz (geometri parmak izi ile dogrulandi).
//
// ONBOARDING NOTU: .onboarding-slide h2 etiketleri DOM sirasinda h1'den ONCE
// geliyor. Kaldirilmadi: .onboarding-overlay varsayilan olarak display:none,
// yani ilk aciliş disinda erisilebilirlik agacinda hic yok. Seviye ATLAMASI
// da degil (h2, h1'den sonra gelmesi gereken seviye) — sadece siralama.
import fs from 'fs';

const HTML = fs.readFileSync('index.html', 'utf8');
const CSS = fs.readFileSync('style.css', 'utf8');
const APP = fs.readFileSync('app.js', 'utf8');
let pass = 0, fail = 0;
const ok = (ad, k, d = '') => { if (k) { pass++; console.log('  PASS  ' + ad); } else { fail++; console.log('  FAIL  ' + ad + (d ? '  -> ' + d : '')); } };

const basliklar = [...HTML.matchAll(/<h([1-6])([^>]*)>([\s\S]*?)<\/h\1>/g)].map(m => ({
  sev: +m[1], oz: m[2], metin: m[3].replace(/<[^>]+>/g, '').trim(), i: m.index,
}));

console.log('\n=== 1. SAYFADA TEK H1 ===');
const h1ler = basliklar.filter(b => b.sev === 1);
ok('h1 sayisi = 1', h1ler.length === 1, 'adet=' + h1ler.length + ' -> ' + h1ler.map(b => b.metin).join(' | '));
ok('  o h1 ana sayfa basligi ("Pazar")', h1ler.length === 1 && h1ler[0].metin === 'Pazar', h1ler.map(b => b.metin).join('|'));
{
  // h1 .header-text icinde mi (ana ekran basligi)
  const once = HTML.slice(0, h1ler[0]?.i ?? 0);
  ok('  h1 .header-text kapsayicisinda', /class="header-text"[^>]*>\s*$/.test(once), once.slice(-60));
}

console.log('\n=== 2. DIGER 7 EKRAN BASLIGI H2 ===');
{
  // .hdr-left icindeki basliklar
  const hdrBas = [...HTML.matchAll(/class="hdr-left"[\s\S]{0,400}?<h([1-6])([^>]*)>([\s\S]*?)<\/h\1>/g)]
    .map(m => ({ sev: +m[1], metin: m[3].replace(/<[^>]+>/g, '').trim() }));
  ok('.hdr-left icinde 7 baslik bulundu', hdrBas.length === 7, 'adet=' + hdrBas.length);
  ok('  hepsi h2', hdrBas.every(b => b.sev === 2), hdrBas.map(b => 'h' + b.sev + ':' + b.metin).join(' | '));
  const bekle = ['Kategori', 'Listem', 'Ürün Detayı', 'Hal Fiyatları', 'Fırsatlar', 'Favorilerim', 'Profil'];
  ok('  metinler aynen korundu', JSON.stringify(hdrBas.map(b => b.metin)) === JSON.stringify(bekle),
    hdrBas.map(b => b.metin).join('|'));
  ok('  #cat-title id\'si duruyor (app.js metni oradan yaziyor)', /<h2[^>]*id="cat-title"/.test(HTML),
    (HTML.match(/<h[1-6][^>]*id="cat-title"[^>]*>/) || ['YOK'])[0]);
  ok('app.js cat-title\'a hala id ile eriyor (etiketten bagimsiz)',
    /getElementById\(['"]cat-title['"]\)/.test(APP) || /#cat-title/.test(APP), '');
}

console.log('\n=== 3. SEVIYE ATLAMASI YOK ===');
{
  // Onboarding overlay'i disla: varsayilan display:none, erisilebilirlik
  // agacinda yok. Ic ice div'ler yuzunden blogu regex'le kesmek h1'i de
  // yutuyordu; bunun yerine SIRA kullaniyoruz: h1'den ONCE gelen basliklar.
  const obBaslik = new RegExp('id="onboarding-overlay"').test(HTML)
    ? basliklar.filter(b => b.i < (h1ler[0]?.i ?? 0)) : [];
  const obKok = HTML.indexOf('id="onboarding-overlay"');
  ok('h1\'den once gelen basliklar SADECE onboarding icinde',
    obBaslik.length > 0 && obBaslik.every(b => b.i > obKok), 'adet=' + obBaslik.length);
  const obBas = obBaslik.map(b => b.sev);
  const gorunur = basliklar.slice(obBaslik.length).map(b => b.sev);
  let enBuyuk = 0, atlama = [];
  for (const s of gorunur) { if (s > enBuyuk + 1) atlama.push('h' + enBuyuk + '->h' + s); enBuyuk = Math.max(enBuyuk, s); }
  ok('gorunur akista atlama YOK', atlama.length === 0, atlama.join(', '));
  console.log('    gorunur seviye dizisi: ' + gorunur.map(s => 'h' + s).join(' '));
  ok('  ilk gorunur baslik h1', gorunur[0] === 1, 'h' + gorunur[0]);
  console.log('    onboarding (display:none): ' + obBas.map(s => 'h' + s).join(' '));
  ok('onboarding overlay varsayilan GIZLI (o yuzden h1\'den once olmasi sorun degil)',
    /\.onboarding-overlay\s*\{[^}]*display:\s*none/.test(CSS), '');
  ok('  onboarding basliklari h2 kaldi (tasarim/CSS dokunulmadi)', obBas.every(s => s === 2), obBas.join(','));
  ok('  .onboarding-slide h2 CSS kurali duruyor', /\.onboarding-slide h2\s*\{/.test(CSS), '');
}

console.log('\n=== 4. CSS SECICILERI TASINDI — GORSEL AYNI ===');
{
  const kural = s => {
    const re = new RegExp('(^|[,{}])\\s*' + s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*(,|\\{)', 'm');
    return re.test(CSS);
  };
  ok('.hdr-left h2 kurali VAR', kural('.hdr-left h2'), '');
  ok('.app-header--sub .hdr-left h2 (Cabinet Grotesk) VAR', kural('.app-header--sub .hdr-left h2'), '');
  ok('.header-text h1 kurali DURUYOR (ana sayfa degismedi)', kural('.header-text h1'), '');
  // olu kural birakma
  ok('.hdr-left h1 secicisi KALMADI', !kural('.hdr-left h1'), '');
  // degerler bire bir ayni mi
  const blok = (CSS.match(/\.hdr-left h2\s*\{([^}]*)\}/) || [, ''])[1];
  ok('  font-size 20px', /font-size:\s*20px/.test(blok), blok.trim());
  ok('  font-weight 700', /font-weight:\s*700/.test(blok), blok.trim());
  ok('  color #fff', /color:\s*#fff/i.test(blok), blok.trim());
  const cab = (CSS.match(/\/\* ═+ Cabinet Grotesk[\s\S]*?\}/) || [''])[0];
  ok('  Cabinet Grotesk grubunda h2 var', /\.app-header--sub \.hdr-left h2/.test(cab), cab.slice(0, 200));
  const ag = (CSS.match(/\.header-text h1 \{ font-weight: 800 !important; \}[\s\S]{0,300}?\}/) || [''])[0];
  ok('  700 agirlik grubunda h2 var', /\.app-header--sub \.hdr-left h2/.test(ag), ag.slice(0, 200));
}

console.log('\n=== 5. YENI GORSEL KURAL EKLENMEDI ===');
{
  // h1->h2 gecisi SADECE secici degisikligi olmali: h2 icin yeni bildirim yok
  const h2Kurallari = [...CSS.matchAll(/([^{}]*\bh2\b[^{}]*)\{([^}]*)\}/g)]
    .filter(m => /hdr-left/.test(m[1]));
  ok('.hdr-left h2 icin 2 kural (tipografi grubu + kendi kurali)', h2Kurallari.length >= 2 && h2Kurallari.length <= 3,
    'adet=' + h2Kurallari.length);
  ok('yeni renk/olcu uydurulmadi', !h2Kurallari.some(m => /background|padding|margin|border/.test(m[2])),
    h2Kurallari.map(m => m[2].trim()).join(' || '));
}

console.log('\n=== 6. BASKA BASLIKLAR BOZULMADI ===');
ok('auth sheet h2 duruyor', /<h2[^>]*class="auth-sheet__title"/.test(HTML) || /auth-sheet__title[^>]*>/.test(HTML));
ok('msSheet h3 "Marketleri Karşılaştır" duruyor', /<h3>Marketleri Karşılaştır<\/h3>/.test(HTML));
ok('mfSheet h3 duruyor', /<h3 id="mfSheetTitle">/.test(HTML));
ok('toplam baslik sayisi 14 (3 onboarding + 1 h1 + 7 ekran + 1 auth + 2 sheet)',
  basliklar.length === 14, 'adet=' + basliklar.length);

console.log('\nPASS=' + pass + '  FAIL=' + fail);
process.exit(fail ? 1 : 0);
