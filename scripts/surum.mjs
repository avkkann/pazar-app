// scripts/surum.mjs — uygulama surum numarasini TEK KAYNAKTAN turetir.
//
// SORUN (CLAUDE.md teknik borcu): Profil ekranindaki surum `index.html`'e
// ELLE `v1.0` diye yazilmisti ve `sw.js`'teki `CACHE_NAME` (`pazar-cache-v232`)
// ile hicbir bagi yoktu. Iki numara bagimsiz surukleniyordu; kullanici "v1.0"
// gorurken yayindaki gercek surum 232'ydi.
//
// COZUM: numara `sw.js`'ten BUILD ZAMANINDA okunup enjekte ediliyor. Ikinci bir
// kaynak yazilmiyor -- bu depoda "ayni turetilmis degerin iki kaynagi" tuzagi
// (urunler.json, marketfiyati.json, anasayfa.json) defalarca yasandi.
//
// NEDEN CALISMA ANI DEGIL BUILD ZAMANI: surumu tarayicida `caches.keys()` ile
// de okuyabilirdik ama o (a) guvenli baglam + SW kaydi gerektirir, (b) ilk
// acilista henuz hazir olmayabilir, (c) her kullanicida bir async is demek.
// Build zamani enjeksiyon `hub-footer.mjs` ile AYNI desen ve maliyeti sifir.

/** `sw.js` kaynagindan cache surum numarasini cikarir. Bulamazsa null. */
export function swSurumOku(swKaynak) {
  if (typeof swKaynak !== 'string') return null;
  // Yorumlari soy: bu depoda yorumlar uzun ve "pazar-cache-v232" gibi ornek
  // degerleri ANLATIYOR olabilir -- testin/enjektorun yorumla eslesmesi bu
  // depoda belgelenmis tekrarlayan tuzak (bkz. test_splash, test_cmp_satir).
  const temiz = swKaynak
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1');
  const m = temiz.match(/CACHE_NAME\s*=\s*['"`]pazar-cache-v(\d+)['"`]/);
  return m ? m[1] : null;
}

/**
 * `index.html` icindeki surum yuvasini doldurur.
 * Yuva: <span id="surumNo">…</span>
 * Surum null ise HTML'e DOKUNULMAZ — build kirilmaz, yer tutucu ne diyorsa
 * o kalir (hub-footer'in "manifest yoksa blok bos" davranisiyla ayni ilke).
 */
export function surumEkle(html, surum) {
  if (typeof html !== 'string') return html;
  if (!surum) return html;
  return html.replace(
    /(<span id="surumNo">)[^<]*(<\/span>)/,
    `$1v${surum}$2`
  );
}
