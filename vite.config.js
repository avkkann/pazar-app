import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { hubFooterEkle } from './scripts/hub-footer.mjs';
import { swSurumOku, surumEkle } from './scripts/surum.mjs';

// Ana ekranin altindaki hub ic link blogunu index.html'e enjekte eder.
// KAYNAK .hub/manifest.json -- hub-uret.mjs'in ciktisi, build zincirinde
// vite'tan ONCE kosuyor (package.json "build"). Yalnizca durum === "uretildi"
// kayitlari link oluyor; atlanan sayfalar (bugun /zam/2026-05/, /zam/2026-06/)
// blogun disinda kaliyor -- sabit liste yazilsaydi canlida iki 404 olurdu.
// Manifest yoksa blok BOS kaliyor ve build KIRILMIYOR: prepare-public.mjs'in
// "manifest yoksa uyarip yalnizca kokle devam et" davranisiyla ayni; asil kapi
// yayin oncesi kosan veri_tazelik_kontrol.py --hub.
function hubFooterEnjekte() {
  return {
    name: 'hub-footer-enjekte',
    apply: 'build',
    transformIndexHtml: {
      order: 'pre',
      handler(html) {
        const yol = '.hub/manifest.json';
        if (!existsSync(yol)) {
          console.warn('[hub-footer] .hub/manifest.json YOK — ic link blogu BOS uretiliyor');
          return hubFooterEkle(html, []);
        }
        const manifest = JSON.parse(readFileSync(yol, 'utf8'));
        const uretilen = manifest.filter((k) => k.durum === 'uretildi').length;
        console.log(`[hub-footer] ${uretilen} link enjekte edildi, ${manifest.length - uretilen} atlanan sayfa DISARIDA`);
        return hubFooterEkle(html, manifest);
      }
    }
  };
}

// Profil ekranindaki surum numarasini sw.js'teki CACHE_NAME'den enjekte eder.
// TEK KAYNAK: numara yalnizca sw.js'te yaziyor. Ayrinti: scripts/surum.mjs.
// sw.js okunamazsa ya da desen tutmazsa UYARIP gecer, build'i KIRMAZ
// (hub-footer'in "manifest yoksa blok bos" ilkesiyle ayni) -- ama sessiz de
// kalmaz, cunku sessiz gecmek tam da bu borcun dogmasina yol acan desen.
function surumEnjekte() {
  return {
    name: 'surum-enjekte',
    apply: 'build',
    transformIndexHtml: {
      order: 'pre',
      handler(html) {
        if (!existsSync('sw.js')) {
          console.warn('[surum] sw.js YOK — surum yer tutucusu oldugu gibi kaliyor');
          return html;
        }
        const surum = swSurumOku(readFileSync('sw.js', 'utf8'));
        if (!surum) {
          console.warn('[surum] sw.js icinde CACHE_NAME deseni bulunamadi — yer tutucu kaliyor');
          return html;
        }
        console.log(`[surum] profil surumu sw.js'ten alindi: v${surum}`);
        return surumEkle(html, surum);
      }
    }
  };
}

function hashClassicScript() {
  return {
    name: 'hash-classic-script',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler(html) {
        const content = readFileSync('app.js');
        const hash = createHash('sha256').update(content).digest('hex').slice(0, 8);
        const newName = `app.${hash}.js`;
        return html.replace('src="./app.js"', `src="./${newName}"`);
      }
    },
    generateBundle() {
      const content = readFileSync('app.js');
      const hash = createHash('sha256').update(content).digest('hex').slice(0, 8);
      const newName = `app.${hash}.js`;
      this.emitFile({ type: 'asset', fileName: newName, source: content });
    }
  };
}

export default {
  // VARSAYILAN '/' — hedef Cloudflare Workers, site kokte duruyor.
  // Onceki varsayilan '/pazar-app/' idi (GitHub Pages alt yolu) ve gecisten
  // sonra TUZAK oldu: DEPLOY_TARGET set edilmezse build sessizce /pazar-app/
  // onekli yollar uretir, Cloudflare'de tum varliklar 404 olur.
  // Eski Pages duzeni gerekirse DEPLOY_TARGET=ghpages ile alinabilir.
  base: process.env.DEPLOY_TARGET === 'ghpages' ? '/pazar-app/' : '/',
  publicDir: 'public',
  plugins: [hubFooterEnjekte(), surumEnjekte(), hashClassicScript()],
  build: {
    outDir: 'dist'
  }
};
