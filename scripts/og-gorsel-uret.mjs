// scripts/og-gorsel-uret.mjs
// static/og-image.svg  ->  static/og-image.png  (1200x630)
//
// KULLANIM:  node scripts/og-gorsel-uret.mjs
//
// DONUSTURME YOLU: Chrome headless --screenshot.
//   Bilerek boyle: makinede ImageMagick/rsvg/inkscape/sharp YOK ve paylasim
//   karti icin YENI bir npm bagimliligi eklemek istemiyoruz. Chrome zaten
//   kurulu ve sitenin kullandigi ayni motor — SVG'deki Inter webfont'u da
//   ayni sekilde cozuyor, yani kart sitedeki tipografiyle ayni cikiyor.
//
// SVG kaynak dosyadir, elle duzenlenir. Bu script SADECE PNG uretir; degistirmez.
// PNG'yi build tasimaz -> prepare-public.mjs static/ klasorunu komple kopyaladigi
// icin otomatik dist'e gider.
import { existsSync, statSync, readFileSync, rmSync, mkdtempSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const SVG = 'static/og-image.svg';
const PNG = 'static/og-image.png';

const CHROME_ADAYLARI = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
];

if (!existsSync(SVG)) {
  console.error('HATA: ' + SVG + ' yok.');
  process.exit(1);
}
const chrome = CHROME_ADAYLARI.find(p => existsSync(p));
if (!chrome) {
  console.error('HATA: Chrome/Edge bulunamadi. Adaylar:\n  ' + CHROME_ADAYLARI.join('\n  '));
  process.exit(1);
}

// Chrome --screenshot cikti yolunu kendi cwd'sine gore yazar; profil de gerekiyor.
const profil = mkdtempSync(join(tmpdir(), 'og-chrome-'));
try {
  execFileSync(chrome, [
    '--headless=new',
    '--disable-gpu',
    '--hide-scrollbars',
    '--force-device-scale-factor=1',
    '--default-background-color=00000000',
    '--user-data-dir=' + profil,
    // webfont indirilip yerlesene kadar bekle; yoksa yedek font PNG'ye gomulur
    '--virtual-time-budget=8000',
    '--window-size=1200,630',
    '--screenshot=' + resolve(PNG),
    'file:///' + resolve(SVG).replace(/\\/g, '/'),
  ], { stdio: ['ignore', 'ignore', 'pipe'] });
} finally {
  rmSync(profil, { recursive: true, force: true });
}

if (!existsSync(PNG)) {
  console.error('HATA: PNG uretilemedi.');
  process.exit(1);
}
const b = readFileSync(PNG);
const [w, h] = [b.readUInt32BE(16), b.readUInt32BE(20)];
if (w !== 1200 || h !== 630) {
  console.error('HATA: olcu ' + w + 'x' + h + ' — 1200x630 beklendi.');
  process.exit(1);
}
console.log('uretildi: ' + PNG + '  ' + w + 'x' + h + '  ' + Math.round(statSync(PNG).size / 1024) + ' KB');
