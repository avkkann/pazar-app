// SATIR ICI OLAY OZNITELIGI KILIDI — "borc buyumesin" testi.
//
// Neden: 2026-08-23'te style-src'den 'unsafe-inline' kaldirildi, ama script-src'de
// BILEREK birakildi (117 satir ici handler'in delegasyona gocu 4-6 turluk ayri is).
// Bu test o ERTELEMEYI kontrol altinda tutar: sayi bugunkunun USTUNE cikarsa KIRMIZI.
// Azalma serbest (goc ilerledikce TABAN dusurulur, asagidaki nota bak).
//
// NOT (nonce/hash neden cozmez): nonce ve hash yalnizca <script>/<style> BLOKLARINI
// kapsar; satir ici olay ozniteliklerini kapsamaz. Kapsatmak icin 'unsafe-hashes'
// gerekir, o da korumayi geri acar. Yani handler gocu yapilmadan hash'in kazanci sifir.
//
// Kullanim: node test_satirici_kilit.mjs
import fs from 'fs';

let pass = 0, fail = 0;
const ok = (ad, k, d = '') => { if (k) { pass++; console.log('  PASS  ' + ad); } else { fail++; console.log('  FAIL  ' + ad + (d ? '  -> ' + d : '')); } };

// ── SAYIM DESENI ─────────────────────────────────────────────────────────────
// Envanterde grep UC KEZ yaniltti; desen o tuzaklara dayanikli olacak sekilde kuruldu:
//   1) "content=" icindeki "ontent=" -> (?<![a-zA-Z.]) kelime siniri eler
//   2) Turkce degiskenler (oneri=, onceki=, onecikan=, onBoardingIdx=)
//      -> GERCEK DOM olay adlari BEYAZ LISTESI eler
//   3) el.onclick = fn (DOM ozellik atamasi, CSP'yi ILGILENDIRMEZ)
//      -> lookbehind'daki nokta (.) VE "= tirnak" sarti eler
const OLAYLAR = [
  'click', 'dblclick', 'change', 'input', 'submit', 'keydown', 'keyup', 'keypress',
  'load', 'error', 'focus', 'blur', 'mouseover', 'mouseout', 'mouseenter', 'mouseleave',
  'contextmenu', 'touchstart', 'touchend', 'touchmove', 'scroll', 'wheel', 'paste',
  'copy', 'cut', 'drop', 'dragover', 'reset', 'toggle', 'animationend', 'transitionend',
  'pointerdown', 'pointerup', 'pointerenter', 'pointermove',
];
// on<olay> = "..."  (oznitelik bicimi; tirnak SART -> ozellik atamasi elenir)
const DESEN = new RegExp('(?<![a-zA-Z.])on(' + OLAYLAR.join('|') + ')\\s*=\\s*["\'`]', 'gi');

function say(metin) {
  DESEN.lastIndex = 0;
  let m, n = 0;
  while ((m = DESEN.exec(metin))) n++;
  return n;
}

// ── KONTROL GRUBU: sayacin kendisi dogru mu? ─────────────────────────────────
// Sentetik ornekler. Sayac bunlari DOGRU siniflandirmazsa test daha kaynak
// dosyalara bakmadan KIRMIZI olur -- yani "sayi tuttu" demek anlamli olsun.
console.log('\n=== 0. KONTROL GRUBU: sayac kor mu? ===');
{
  const SAYILMALI = [
    ['duz onclick', '<b onclick="x()">a</b>'],
    ['tek tirnak', "<b onclick='x()'>a</b>"],
    ['bosluklu', '<b onclick = "x()">a</b>'],
    ['BUYUK harf', '<b ONCLICK="x()">a</b>'],
    ['sablon tirnagi', '<b onerror=`x()`>a</b>'],
    ['iki oznitelik ayni etikette', '<b onclick="x()" onkeydown="y()">a</b>'],
  ];
  const SAYILMAMALI = [
    ['content= (ontent tuzagi)', '<meta name="d" content="bir aciklama">'],
    ['Turkce degisken oneri', "const oneri = 'deger';"],
    ['Turkce degisken onceki', "let onceki = 'deger';"],
    ['DOM ozellik atamasi', 'el.onclick = duzenle;'],
    ['DOM ozellik null', 'okBtn.onclick = null;'],
    ['DOM ozellik ok fonksiyon', 'btn.onclick = () => kapat();'],
    ['ic ice this.onerror', 'onerror2="this.onerror=null"'.replace('onerror2', 'zzz')],
  ];
  let kg = 0;
  for (const [ad, ornek] of SAYILMALI) {
    const n = say(ornek);
    const bek = ad.includes('iki oznitelik') ? 2 : 1;
    ok('  SAYILMALI: ' + ad, n === bek, 'bulunan=' + n);
    if (n !== bek) kg++;
  }
  for (const [ad, ornek] of SAYILMAMALI) {
    const n = say(ornek);
    ok('  SAYILMAMALI: ' + ad, n === 0, 'bulunan=' + n);
    if (n !== 0) kg++;
  }
  ok('kontrol grubu tamamen gecti (sayim guvenilir)', kg === 0, kg + ' ornek yanlis siniflandirildi');
}

// ── TABAN ────────────────────────────────────────────────────────────────────
// 2026-08-23 olcumu. Goc ilerledikce bu sayilar DUSURULUR (asla yukseltilmez);
// yukseltmek gerekiyorsa once "neden yeni satir ici handler sart" sorusu cevaplanir.
const TABAN = { 'index.html': 66, 'app.js': 51 };

console.log('\n=== 1. SATIR ICI HANDLER SAYISI TABANI ASMASIN ===');
let toplam = 0, tabanToplam = 0;
for (const [dosya, taban] of Object.entries(TABAN)) {
  const n = say(fs.readFileSync(dosya, 'utf8'));
  toplam += n; tabanToplam += taban;
  ok(dosya + ': ' + n + ' <= taban ' + taban, n <= taban,
     n > taban ? (n - taban) + ' YENI satir ici handler eklenmis -- delegasyon/addEventListener kullan' : '');
  if (n < taban) console.log('        NOT: taban ' + taban + ', simdi ' + n + ' -> goc ilerlemis, TABANI bu dosyada ' + n + "'e dusur.");
}
ok('TOPLAM ' + toplam + ' <= ' + tabanToplam, toplam <= tabanToplam, '');

console.log('\n=== 2. script-src hala unsafe-inline (aksi halde bu kilit anlamsiz) ===');
{
  // Bu handler'lar CALISABILIYOR olmali; script-src'den 'unsafe-inline' kalkarsa
  // 117 handler sessizce olur. Iki dosya birbirini kilitliyor.
  const W = fs.readFileSync('src/worker.js', 'utf8');
  const ss = (W.match(/"script-src([^"]*)"/) || [])[1] || '';
  ok('script-src \'unsafe-inline\' iceriyor (handler\'lar calisiyor)',
     /'unsafe-inline'/.test(ss), ss.trim());
  const st = (W.match(/"style-src([^"]*)"/) || [])[1] || '';
  ok('style-src \'unsafe-inline\' ICERMIYOR (2026-08-23 gocu geri alinmasin)',
     !/'unsafe-inline'/.test(st), st.trim());
}

console.log(`\nPASS=${pass}  FAIL=${fail}`);
process.exit(fail ? 1 : 0);
