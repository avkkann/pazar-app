// scripts/splash-uret.mjs
// iOS "ana ekrana ekle" acilis gorselleri (apple-touch-startup-image).
//   static/splash/apple-splash-<enxboy>.png  (cihaz pikseli)
//
// KULLANIM:  node scripts/splash-uret.mjs
//
// DONUSTURME YOLU: og-gorsel-uret.mjs ile AYNI — Chrome headless --screenshot.
// Yeni npm bagimliligi yok; Chrome zaten kurulu ve self-host Cabinet Grotesk
// woff2'sini file:// ile cozuyor, boylece wordmark sitedeki tipografiyle ayni.
//
// Cikti static/splash/ altina yazilir; prepare-public.mjs static/'i komple
// kopyaladigi icin build otomatik dist'e tasir. SW precache'inde DEGIL (iOS
// bu gorselleri natif yukler), o yuzden CACHE_NAME bump gerekmez.
import { existsSync, mkdirSync, rmSync, mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

// CSS px + dpr; cihaz pikseli = w*dpr x h*dpr. Portre. 2018+ iPhone yelpazesi.
// index.html'deki apple-touch-startup-image media sorgulariyla BIREBIR ayni
// olmali (device-width/height/-webkit-device-pixel-ratio).
const DEVICES = [
  { w: 375, h: 667, dpr: 2, not: 'SE 2/3, 8, 7, 6s' },
  { w: 414, h: 896, dpr: 2, not: '11, XR' },
  { w: 375, h: 812, dpr: 3, not: 'X, XS, 11 Pro' },
  { w: 414, h: 896, dpr: 3, not: 'XS Max, 11 Pro Max' },
  { w: 360, h: 780, dpr: 3, not: '12/13 mini' },
  { w: 390, h: 844, dpr: 3, not: '12, 13, 14, 12/13 Pro' },
  { w: 428, h: 926, dpr: 3, not: '12/13 Pro Max, 14 Plus' },
  { w: 393, h: 852, dpr: 3, not: '14 Pro, 15, 15 Pro, 16' },
  { w: 430, h: 932, dpr: 3, not: '14 Pro Max, 15 Plus/Pro Max, 16 Plus' },
  { w: 402, h: 874, dpr: 3, not: '16 Pro' },
  { w: 440, h: 956, dpr: 3, not: '16 Pro Max' },
];

const CHROME_ADAYLARI = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
];
const chrome = CHROME_ADAYLARI.find(p => existsSync(p));
if (!chrome) { console.error('HATA: Chrome/Edge bulunamadi.'); process.exit(1); }

const OUT_DIR = 'static/splash';
mkdirSync(OUT_DIR, { recursive: true });

// Marka: og-image ile ayni koyu yesil zemin + krem "Pazar" wordmark.
const FONT = resolve('static/fonts/cabinet-grotesk-800.woff2').replace(/\\/g, '/');
function html(w, h) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face{font-family:'Cabinet Grotesk';src:url('file:///${FONT}') format('woff2');font-weight:800;font-display:block}
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:${w}px;height:${h}px;overflow:hidden}
body{background:#0E4938;display:flex;align-items:center;justify-content:center}
.mark{font-family:'Cabinet Grotesk','Segoe UI',system-ui,sans-serif;font-weight:800;
  font-size:${Math.round(w * 0.16)}px;letter-spacing:-0.02em;color:#E8DCC4;line-height:1}
</style></head><body><div class="mark">Pazar</div></body></html>`;
}

const tmpHtml = join(tmpdir(), 'pazar-splash.html');
let uretilen = [];
for (const d of DEVICES) {
  const pw = d.w * d.dpr, ph = d.h * d.dpr;
  const out = resolve(join(OUT_DIR, `apple-splash-${pw}x${ph}.png`));
  writeFileSync(tmpHtml, html(d.w, d.h), 'utf8');
  const profil = mkdtempSync(join(tmpdir(), 'splash-chrome-'));
  try {
    execFileSync(chrome, [
      '--headless=new', '--disable-gpu', '--hide-scrollbars',
      '--force-device-scale-factor=' + d.dpr,
      '--user-data-dir=' + profil,
      '--virtual-time-budget=4000',
      '--window-size=' + d.w + ',' + d.h,
      '--screenshot=' + out,
      'file:///' + tmpHtml.replace(/\\/g, '/'),
    ], { stdio: ['ignore', 'ignore', 'pipe'] });
  } finally { rmSync(profil, { recursive: true, force: true }); }
  const b = readFileSync(out);
  const okPng = b.slice(0, 8).toString('hex') === '89504e470d0a1a0a';
  const gw = b.readUInt32BE(16), gh = b.readUInt32BE(20);
  console.log(`  apple-splash-${pw}x${ph}.png  ${gw}x${gh}  ${okPng && gw === pw && gh === ph ? 'OK' : 'HATA!'}  (${d.not})`);
  uretilen.push({ pw, ph, ...d });
}
rmSync(tmpHtml, { force: true });

// index.html'e yapistirilacak <link> bloklarini da bas (elle senkron kolaylasir)
console.log('\n--- index.html icin <link> bloklari ---');
for (const d of uretilen) {
  console.log(`  <link rel="apple-touch-startup-image" media="(device-width: ${d.w}px) and (device-height: ${d.h}px) and (-webkit-device-pixel-ratio: ${d.dpr}) and (orientation: portrait)" href="/static/splash/apple-splash-${d.pw}x${d.ph}.png">`);
}
console.log(`\n${uretilen.length} splash uretildi -> ${OUT_DIR}/`);
