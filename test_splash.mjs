// Splash: gercek hazir sinyali, tema-duyarli zemin, token bagi.
// Kullanim: node test_splash.mjs
import fs from 'fs';

const APP = fs.readFileSync('app.js', 'utf8');
const CSS = fs.readFileSync('style.css', 'utf8');
const HTML = fs.readFileSync('index.html', 'utf8');

let pass = 0, fail = 0;
const ok = (ad, k, d = '') => { if (k) { pass++; console.log('  PASS  ' + ad); } else { fail++; console.log('  FAIL  ' + ad + (d ? '  -> ' + d : '')); } };

// splash'i kaldiran IIFE'yi cikar
const splashBlok = (() => {
  const i = APP.indexOf('// ── SPLASH: sabit sure DEGIL');
  if (i < 0) return '';
  // Sabit uzunlukla kesme YOK: blok buyuyunce iddialar sessizce blok DISINDA
  // kalip yanlis FAIL veriyordu. IIFE'nin gercek sonuna kadar al.
  const j = APP.indexOf('})();', i);
  return j < 0 ? APP.slice(i) : APP.slice(i, j + 5);
})();

console.log('\n=== 1. BOSA BEKLEME: sabit sure YOK, gercek sinyal VAR ===');
{
  ok('splash blogu bulundu', splashBlok.length > 200, 'uzunluk=' + splashBlok.length);
  ok('`pazar:hazir` olayini dinliyor', /addEventListener\('pazar:hazir'/.test(splashBlok), '');
  ok('  olay TEK KEZ baglanmis (once:true)', /\{\s*once:\s*true\s*\}/.test(splashBlok), '');
  // Eski hâl: setTimeout(..., 600) TAVAN idi. Artik tek setTimeout'lar
  // TABAN (flas onleme) ve KILIT (kilitlenme korumasi) icin.
  ok('eski 600 ms sabit bekleme KALKTI', !/setTimeout\([^)]*,\s*600\s*\)/.test(splashBlok), '');
  ok('  eski 250 ms zinciri KALKTI', !/setTimeout\([^)]*,\s*250\s*\)/.test(splashBlok), '');
  ok('TABAN (flas onleme) tanimli', /TABAN_MS\s*=\s*\d+/.test(splashBlok), '');
  ok('  TABAN 150-300 ms araliginda', (() => { const m = /TABAN_MS\s*=\s*(\d+)/.exec(splashBlok); return m && +m[1] >= 150 && +m[1] <= 300; })(), '');
  ok('  TABAN ilk KAREden sayiliyor (navigasyondan degil)', /requestAnimationFrame/.test(splashBlok), '');
}

console.log('\n=== 2. KILITLENME KORUMASI (tavan degil) ===');
{
  ok('kilit korumasi var', /KILIT_MS\s*=\s*\d+/.test(splashBlok), '');
  const m = /KILIT_MS\s*=\s*(\d+)/.exec(splashBlok);
  ok('  kilit esigi HAZIR suresinden cok uzak (>=3000 ms)', m && +m[1] >= 3000, m ? m[1] : '');
  // SESSIZ YUTMA YOK: koruma devreye girerse konsola yazsin
  ok('  devreye girerse SESSIZ kalmiyor (console.warn)', /console\.warn\([^)]*\[splash\]/.test(splashBlok), '');
}

console.log('\n=== 3. HAZIR SINYALININ KAYNAGI ===');
{
  ok('_anaEkraniCiz tanimli', /function _anaEkraniCiz\(\)/.test(APP), '');
  const ciz = (APP.match(/function _anaEkraniCiz\(\)[\s\S]*?\n\}/) || [''])[0];
  ok('  seritleri allSettled ile bekliyor (asilma yok)', /Promise\.allSettled\(/.test(ciz), ciz.slice(0, 200));
  ok('  kategori izgarasi da ciziliyor', /renderCatGrid\(\)/.test(ciz), '');
  // Mevsim seridi AYRI dosya indiriyor ve ekranin altinda -- beklenmemeli
  ok('  mevsim seridi BEKLENMIYOR (allSettled disinda)',
     /renderMevsimSeridi\(\)/.test(ciz) && !/allSettled\(\[[^\]]*renderMevsimSeridi/.test(ciz.replace(/\s+/g, ' ')), '');
  ok('_hazirBildir TEK KEZ atesliyor', /_hazirBildirildi/.test(APP) && /dispatchEvent\(new Event\('pazar:hazir'\)\)/.test(APP), '');
  // loadData'nin HER iki dali da (basari + hata) sinyale varmali
  const ld = (APP.match(/function loadData\(\)[\s\S]*?\n\}/) || [''])[0];
  ok('loadData basari dalinda cizim var', /return _anaEkraniCiz\(\);\s*\}\)\.catch/.test(ld.replace(/\s+/g, ' ')) || /_anaEkraniCiz/.test(ld), '');
  ok('  hata dalinda DA cizim var (cevrimdisi kilitlenmesin)',
     (ld.match(/_anaEkraniCiz\(\)/g) || []).length >= 2, 'adet=' + (ld.match(/_anaEkraniCiz\(\)/g) || []).length);
  ok('  zincirin sonunda hazir bildirimi', /\.then\(_hazirBildir\)/.test(ld), '');
}

console.log('\n=== 4. KOYU TEMADA BEYAZ CAKMA YOK ===');
{
  const kural = (CSS.match(/#splash \{[^}]*\}/) || [''])[0];
  ok('#splash kurali bulundu', kural.length > 20, kural);
  ok('  zemin TEMA degiskeninden', /background:\s*var\(--bg\)/.test(kural), kural);
  ok('  sabit beyaz KALKTI', !/#fff/i.test(kural) && !/white/i.test(kural), kural);

  // BOOTSTRAP RENGI: CSS henuz yokken index.html ham hex yazmak ZORUNDA.
  // Iki deger --bg tokenlarinin AYNISI olmali; token degisip burasi
  // unutulursa koyu temada yine beyaz kare cakar.
  const acikBg = (/:root\s*\{[\s\S]*?--bg:\s*([^;]+);/.exec(CSS) || [])[1];
  const koyuBg = (/\[data-theme="dark"\]\s*\{[\s\S]*?--bg:\s*([^;]+);/.exec(CSS) || [])[1];
  ok('token --bg (acik) okundu', !!acikBg, String(acikBg));
  ok('token --bg (koyu) okundu', !!koyuBg, String(koyuBg));
  const boot = /backgroundColor\s*=\s*dark\s*\?\s*'([^']+)'\s*:\s*'([^']+)'/.exec(HTML);
  ok('index.html acilis zemini yaziyor', !!boot, HTML.slice(HTML.indexOf('backgroundColor'), HTML.indexOf('backgroundColor') + 90));
  if (boot && acikBg && koyuBg) {
    ok('  koyu bootstrap rengi --bg ile AYNI', boot[1].toLowerCase() === koyuBg.trim().toLowerCase(), boot[1] + ' vs ' + koyuBg.trim());
    ok('  acik bootstrap rengi --bg ile AYNI', boot[2].toLowerCase() === acikBg.trim().toLowerCase(), boot[2] + ' vs ' + acikBg.trim());
  }
  // Tema tespiti stylesheet'ten ONCE olmali
  const iTema = HTML.indexOf('dataset.theme');
  const iCss = HTML.indexOf('href="./style.css"');
  ok('tema tespiti stylesheet\'ten ONCE kosuyor', iTema > -1 && iCss > -1 && iTema < iCss, `tema@${iTema} css@${iCss}`);
}

console.log('\n=== 5. TOKEN BAGI (ham deger yok) ===');
{
  const kural = (CSS.match(/#splash \{[^}]*\}/) || [''])[0];
  const imgKural = (CSS.match(/#splash img \{[^}]*\}/) || [''])[0];
  ok('#splash kuralinda ham px/ms YOK', !/\b\d+(px|ms)\b/.test(kural), kural);
  ok('#splash img kuralinda ham px/ms YOK', !/\b\d+(px|ms)\b/.test(imgKural), imgKural);
  for (const t of ['--splash-logo', '--splash-giris', '--splash-cikis']) {
    ok(`  ${t} tanimli`, new RegExp(t + ':\\s*[^;]+;').test(CSS), '');
  }
  ok('  logo boyutu tokenden', /var\(--splash-logo\)/.test(imgKural), imgKural);
  ok('  sonme suresi tokenden', /var\(--splash-cikis\)/.test(kural), kural);
  ok('  giris suresi tokenden', /var\(--splash-giris\)/.test(imgKural), imgKural);
  // JS sonme suresini CSS'ten okumali, ikinci bir sayi tutmamali
  ok('JS sonme suresini CSS tokeninden okuyor', /getPropertyValue\('--splash-cikis'\)/.test(splashBlok), '');
}

console.log('\n=== 6. EASING: TEK KAYNAK, IKI ROL ===');
{
  ok('--ease-out tanimli (durum gecisi)', /--ease-out:\s*cubic-bezier/.test(CSS), '');
  ok('--ease-giris tanimli (giris animasyonu)', /--ease-giris:\s*cubic-bezier/.test(CSS), '');
  // Ham egri YALNIZCA token TANIMINDA kalmali; kullanim yerlerinde degil.
  // (Token tanimi zorunlu olarak ham degeri icerir — onu saymak yanlis olurdu.)
  const tanimsiz = CSS.replace(/--ease-[a-z]+:\s*cubic-bezier\([^)]*\);/g, '');
  ok('kullanim yerlerinde ham cubic-bezier(0.22...) YOK', !/cubic-bezier\(0\.22/.test(tanimsiz),
     (tanimsiz.match(/cubic-bezier\(0\.22[^)]*\)/g) || []).join(' '));
  const kalanHam = (tanimsiz.match(/cubic-bezier\([^)]*\)/g) || []);
  ok('  hicbir kuralda ham egri kalmadi', kalanHam.length === 0, kalanHam.join(' | '));
  ok('splash giris animasyonu --ease-giris kullaniyor',
     /animation:\s*splashIn[^;]*var\(--ease-giris\)/.test(CSS), '');
}

console.log('\n=== 7. HAREKET AZALTMA ===');
{
  const azalt = (CSS.match(/@media \(prefers-reduced-motion: reduce\) \{\s*#splash[\s\S]*?\n\s*\}/) || [''])[0];
  ok('splash icin reduced-motion kurali var', azalt.length > 20, azalt.slice(0, 160));
  ok('  logo animasyonu kapali', /#splash img \{[^}]*animation:\s*none/.test(azalt), azalt);
  ok('  sonme gecisi kapali (aninda)', /#splash \{[^}]*transition:\s*none/.test(azalt), azalt);
  ok('JS de reduced-motion\'da beklemiyor', /prefers-reduced-motion: reduce/.test(splashBlok), '');
}

console.log(`\nPASS=${pass}  FAIL=${fail}`);
process.exit(fail ? 1 : 0);
