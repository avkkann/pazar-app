// test_zam_aylik.mjs — Firsatlar > Zamlananlar sekmesi (aylik zam listeleri)
//
// KORUDUGU SEYLER
//  1) TEK TANIM: aylik zam hesabi hem hub sayfalarinda (/zam/2026-08/) hem
//     uygulamada kullaniliyor. Iki kopya olsaydi kullanici AYNI AY icin iki
//     farkli liste gorurdu -- bu depoda "ayni turetilmis degerin iki kaynagi"
//     defalarca tuzak diye isaretlenmis.
//  2) SATIR ICI HANDLER EKLENMEDI: ucuncu sekme delegasyonla bagli.
//  3) AY LISTESI VERIDEN TURUYOR: index.html'de sabit ay adi YOK.
//  4) BOS AY CIZILMIYOR.
import { readFileSync, existsSync } from 'node:fs';

let pass = 0, fail = 0;
const ok = (ad, kosul, ek = '') => {
  if (kosul) { pass++; console.log('  PASS  ' + ad); }
  else { fail++; console.log('  FAIL  ' + ad + (ek ? '  -> ' + ek : '')); }
};

const APP = readFileSync('app.js', 'utf8');
const HTML = readFileSync('index.html', 'utf8');
const CSS = readFileSync('style.css', 'utf8');
const URET = readFileSync('scripts/anasayfa-uret.mjs', 'utf8');
const HUB = readFileSync('scripts/hub-uret.mjs', 'utf8');

// ── 1. TEK TANIM ─────────────────────────────────────────────────────────────
console.log('\n=== 1. AYLIK ZAM HESABI TEK YERDE ===');
ok('paylasilan modul var', existsSync('scripts/zam-aylik.mjs'));
const MOD = existsSync('scripts/zam-aylik.mjs') ? readFileSync('scripts/zam-aylik.mjs', 'utf8') : '';
ok('  ayZamCiftleri disa aktariliyor', /export function ayZamCiftleri/.test(MOD));
ok('  hub-uret paylasilan modulu kullaniyor',
   /import\s*\{[^}]*ayZamCiftleri[^}]*\}\s*from\s*'\.\/zam-aylik\.mjs'/.test(HUB));
ok('  anasayfa-uret paylasilan modulu kullaniyor',
   /import\s*\{[^}]*ayZamCiftleri[^}]*\}\s*from\s*'\.\/zam-aylik\.mjs'/.test(URET));
// Kopya kalmadi: hesap govdesi (mevsim tuzagi filtresi) yalniz MODULDE olmali.
const kopyaSayisi = [HUB, URET].filter(s => /kategoriSlug === 'meyve-sebze'/.test(s)).length;
ok('  hesap govdesi uretecilere KOPYALANMAMIS', kopyaSayisi === 0, 'kopya sayisi=' + kopyaSayisi);
// Zam olcutu app.js'in kendi fonksiyonu olmali -- modul kendi esigini uydurmamali.
ok('  modul kendi zam esigini UYDURMUYOR (disaridan aliyor)',
   /ZAM_ESIK/.test(MOD) && !/ZAM_ESIK\s*=\s*\d/.test(MOD));

// ── 2. UCUNCU SEKME, SATIR ICI HANDLER YOK ──────────────────────────────────
console.log('\n=== 2. SEKME DELEGASYONLA BAGLI ===');
const sekmeBlogu = (HTML.match(/<div class="firsat-tabs">[\s\S]*?<\/div>/) || [''])[0];
ok('zam sekmesi var', /data-tab="zam"/.test(sekmeBlogu), sekmeBlogu.slice(0, 200));
ok('  uc sekmenin UCU de data-tab tasiyor',
   (sekmeBlogu.match(/data-tab="/g) || []).length === 3,
   'bulunan=' + (sekmeBlogu.match(/data-tab="/g) || []).length);
// En onemlisi: sekme blogunda satir ici olay ozniteligi KALMADI.
ok('  sekme blogunda satir ici olay ozniteligi YOK',
   !/\son[a-z]+=/i.test(sekmeBlogu), sekmeBlogu.slice(0, 200));
ok('  delegasyon dinleyicisi kayitli',
   /document\.addEventListener\('click',\s*_firsatSekmeTikla\)/.test(APP));
ok('  dinleyici hem sekmeyi hem ay cipini ele aliyor',
   /_firsatSekmeTikla[\s\S]{0,600}\.firsat-tab\[data-tab\][\s\S]{0,600}\.firsat-ay\[data-ay\]/.test(APP));

// ── 3. AY LISTESI VERIDEN TURUYOR ───────────────────────────────────────────
console.log('\n=== 3. SABIT AY YAZILMAMIS ===');
const AYLAR = ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'];
const htmlYorumsuz = HTML.replace(/<!--[\s\S]*?-->/g, '');
const sabitAy = AYLAR.filter(a => htmlYorumsuz.includes(a + ' 20'));
ok('index.html\'de sabit ay adi YOK (yeni ay kendiliginden gelmeli)',
   sabitAy.length === 0, sabitAy.join(','));
ok('ay cipleri JS ile uretiliyor', /data-ay="\$\{_kacir\(a\.ay\)\}"/.test(APP));
ok('  cip etiketi KACIRILIYOR (veriden geliyor)', /_kacir\(a\.etiket\)/.test(APP));

// ── 4. VERI: anasayfa.json'daki zamAylik ────────────────────────────────────
console.log('\n=== 4. URETILEN VERI ===');
if (!existsSync('data/anasayfa.json')) {
  ok('data/anasayfa.json var', false, 'once `npm run build`');
} else {
  const d = JSON.parse(readFileSync('data/anasayfa.json', 'utf8'));
  const aylar = d.zamAylik;
  ok('zamAylik alani var', Array.isArray(aylar), typeof aylar);
  if (Array.isArray(aylar)) {
    ok('  en az bir ay uretilmis', aylar.length > 0, 'ay=' + aylar.length);
    ok('  en fazla 3 ay (kayan pencere)', aylar.length <= 3, 'ay=' + aylar.length);
    ok('  aylar YENIDEN ESKIYE sirali',
       aylar.every((a, i) => i === 0 || aylar[i - 1].ay > a.ay), aylar.map(a => a.ay).join(','));
    // BOS AY CIZILMEZ: uretilen her ayin urunu olmali.
    ok('  BOS ay yok', aylar.every(a => (a.urunler || []).length > 0),
       aylar.map(a => a.ay + '=' + (a.urunler || []).length).join(' '));
    ok('  ay basina en fazla 50 urun (hub ile ayni ust sinir)',
       aylar.every(a => a.urunler.length <= 50));
    const ilk = aylar[0].urunler[0];
    ok('  kayit kart cizimi icin gereken alanlari tasiyor',
       ilk && ilk.u && ilk.u.ad && ilk.market && typeof ilk.artis === 'number' && typeof ilk.zirve === 'number',
       JSON.stringify(ilk && Object.keys(ilk)));
    ok('  artis esigi ZAM_ESIK ustunde (uydurma kayit yok)',
       aylar.every(a => a.urunler.every(x => x.artis >= 15)));
    // Ayni urun bir ayda IKI KEZ gorunmemeli (hub cift bazinda, uygulama urun bazinda).
    const cift = aylar.map(a => {
      const s = new Set(a.urunler.map(x => x.u._sid));
      return s.size === a.urunler.length;
    });
    ok('  ayni urun bir ayda tekrarlanmiyor', cift.every(Boolean));
  }
}

// ── 5. GORUNUM: yeni renk tanimlanmadi ──────────────────────────────────────
console.log('\n=== 5. MEVCUT TASARIM DILI ===');
const CSS_TEMIZ = CSS.replace(/\/\*[\s\S]*?\*\//g, '');
ok('zam rozeti MEVCUT --rozet-zam tokenlarini kullaniyor',
   /\.firsat-badge-zam\s*\{[^}]*var\(--rozet-zam-bg\)/.test(CSS_TEMIZ));
ok('  koyu tema karsiligi tanimli',
   /\[data-theme="dark"\]\s*\.firsat-badge-zam/.test(CSS_TEMIZ));
ok('ay cipi 44px dokunma hedefi tasiyor',
   /\.firsat-ay::after\s*\{[^}]*min-height:\s*44px/.test(CSS_TEMIZ));

console.log('\nPASS=' + pass + '  FAIL=' + fail);
process.exit(fail ? 1 : 0);
