// test_veri_tazeleme.mjs — GUNLUK VERI EKRANA GERCEKTEN ULASIYOR MU?
//
// KUSUR (olculdu 2026-09-03, kullanici bildirdi: "veri 2 gun eski"):
// sw.js data dosyalarini staleWhileRevalidate ile servis ediyor: once ONBELLEK
// kopyasi veriliyor, arkadan taze kopya inip onbellege konuyor ve istemciye
// DATA_UPDATED mesaji atiliyordu. Istemci o mesajda loadData() cagiriyordu AMA
// hem halVeriGetir hem anasayfaVeriGetir sonucu HAFIZADA tutuyor
// (`if (_halCache) return ...` / `if (_anasayfaCache !== null) return ...`),
// yani loadData iki kaynagi da memo'dan donduruyordu -> mesaj NO-OP'tu.
// Sonuc: kullanici her ziyarette BIR ONCEKI ziyaretin verisini goruyordu.
// Belirti birebir uretildi: "Fiyatlar 1 Eylul 2026 verisi · 2 gun eski".
//
// IKINCI KUSUR (duzeltmenin ACTIGI): memo bosaltilinca
// mesaj -> loadData -> fetch -> revalidate -> mesaj ... SONSUZ DONGU olurdu.
// Eski kod bundan sadece "mesaj zaten hicbir sey yapmiyordu" diye korunuyordu.
// Bu yuzden DATA_UPDATED'in ANLAMI degistirildi: "istek tamamlandi" degil,
// "veri GERCEKTEN degisti".
//
// Bu test ikisini birden kilitler. sw.js GERCEK KAYNAGI node:vm'de kosuluyor
// (test_sw_origin.mjs deseni); mantik kopyalanmiyor.
import fs from 'node:fs';
import vm from 'node:vm';

const SW = fs.readFileSync('sw.js', 'utf8');
const APP = fs.readFileSync('app.js', 'utf8');
const ORIGIN = 'https://pazarapp.net';

let pass = 0, fail = 0;
const ok = (ad, k, d = '') => { if (k) { pass++; console.log('  PASS  ' + ad); } else { fail++; console.log('  FAIL  ' + ad + (d ? '  -> ' + d : '')); } };

// ── sahte Response: sadece testin ihtiyaci kadar ────────────────────────────
function yanit(govde, damga, ok_ = true) {
  return {
    ok: ok_,
    headers: { get: (h) => (h.toLowerCase() === 'etag' ? damga : null) },
    clone() { return yanit(govde, damga, ok_); },
    async text() { return govde; },
  };
}

// sw.js'i sahte SW global'inde kosturur; onbellek ve mesajlar gozlenebilir.
function swYukle({ onbellektekiGovde, onbellektekiDamga }) {
  const mesajlar = [];
  const depo = new Map();
  const DATA = ORIGIN + '/data/anasayfa.json';
  if (onbellektekiGovde !== undefined) depo.set(DATA, yanit(onbellektekiGovde, onbellektekiDamga));
  const self = {
    location: new URL(ORIGIN + '/'),
    addEventListener: (t, fn) => { (self.__h ||= {})[t] = fn; },
    skipWaiting: () => {}, registration: { showNotification: () => {} },
    clients: {
      claim: () => {}, openWindow: async () => ({}),
      matchAll: async () => [{ postMessage: (m) => mesajlar.push(m) }],
    },
    caches: {
      open: async () => ({
        addAll: async () => {},
        match: async (r) => depo.get(typeof r === 'string' ? r : r.url),
        put: async (r, v) => depo.set(typeof r === 'string' ? r : r.url, v),
      }),
      keys: async () => [], delete: async () => {},
    },
  };
  // sw.js `caches`i CIPLAK kullaniyor (self.caches degil) -> baglama ayrica konur.
  const ctx = { self, caches: self.caches, URL, console, setTimeout, Promise, fetch: async () => ({ ok: false }) };
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(SW, ctx);
  return { ctx, self, mesajlar, DATA };
}

// Bir revalidate turu kostur: onbellekte X varken sunucu Y donerse ne olur?
async function tur({ onbellektekiGovde, onbellektekiDamga, sunucuGovde, sunucuDamga }) {
  const { ctx, self, mesajlar, DATA } = swYukle({ onbellektekiGovde, onbellektekiDamga });
  ctx.fetch = async () => yanit(sunucuGovde, sunucuDamga);
  const istek = { url: DATA };
  let cevap;
  await self.__h.fetch({
    request: istek,
    respondWith: (p) => { cevap = p; },
  });
  await cevap;
  await new Promise((r) => setTimeout(r, 10));
  return { mesajSayisi: mesajlar.length, mesajlar };
}

console.log('\n=== 0. KONTROL GRUBU: alet gercekten mesaj gorebiliyor mu? ===');
{
  // Onbellek BOS -> ilk indirme. Bu durumda mesaj BEKLENIR (degisim sayilir);
  // eger burada da 0 gorseydik testin mesaj kanali kopuk demekti.
  const r = await tur({ onbellektekiGovde: undefined, sunucuGovde: '{"a":1}', sunucuDamga: '"v1"' });
  ok('mesaj kanali calisiyor (onbellek bosken haber veriliyor)', r.mesajSayisi === 1, 'mesaj=' + r.mesajSayisi);
}

console.log('\n=== 1. VERI DEGISTIGINDE HABER VERILIYOR ===');
{
  const r = await tur({ onbellektekiGovde: '{"veri_tarihi":"09-02"}', onbellektekiDamga: '"v1"',
                        sunucuGovde: '{"veri_tarihi":"09-03"}', sunucuDamga: '"v2"' });
  ok('ETag degisince DATA_UPDATED yollaniyor', r.mesajSayisi === 1, 'mesaj=' + r.mesajSayisi);
  ok('  mesajin tipi dogru', r.mesajlar[0] && r.mesajlar[0].type === 'DATA_UPDATED', JSON.stringify(r.mesajlar[0]));
}

console.log('\n=== 2. VERI DEGISMEDIYSE HABER YOK (sonsuz dongu kilidi) ===');
{
  const r = await tur({ onbellektekiGovde: '{"x":1}', onbellektekiDamga: '"ayni"',
                        sunucuGovde: '{"x":1}', sunucuDamga: '"ayni"' });
  ok('ayni ETag -> mesaj YOK', r.mesajSayisi === 0, 'mesaj=' + r.mesajSayisi);
}
{
  // Damga YOKSA govde karsilastirilmali. "damga yok -> hic haber verme" demek
  // ozelligi sessizce oldururdu (Cloudflare ETag veriyor ama her kurulum vermez).
  const ayni = await tur({ onbellektekiGovde: '{"x":1}', onbellektekiDamga: null,
                           sunucuGovde: '{"x":1}', sunucuDamga: null });
  const farkli = await tur({ onbellektekiGovde: '{"x":1}', onbellektekiDamga: null,
                             sunucuGovde: '{"x":2}', sunucuDamga: null });
  ok('damga yokken AYNI govde -> mesaj YOK', ayni.mesajSayisi === 0, 'mesaj=' + ayni.mesajSayisi);
  ok('damga yokken FARKLI govde -> mesaj VAR', farkli.mesajSayisi === 1, 'mesaj=' + farkli.mesajSayisi);
}

console.log('\n=== 3. ISTEMCI MEMO\'LARI BOSALTIYOR (yoksa mesaj NO-OP) ===');
{
  // Handler govdesini cikar (sabit ofset DEGIL: mesaj tipinden itibaren
  // parantez sayarak kapaniyor -- bu depoda sabit pencere defalarca kaydi).
  const i = APP.indexOf("'DATA_UPDATED'");
  ok('DATA_UPDATED handler bulundu', i > 0);
  const govde = APP.slice(i, i + 1400);
  for (const [ad, degisken] of [
    ['anasayfa memo', '_anasayfaCache'],
    ['anasayfa ucus', '_anasayfaYukleniyor'],
    ['hal memo', '_halCache'],
    ['hal ucus', '_halPromise'],
  ]) {
    ok(`  ${ad} (${degisken}) bosaltiliyor`,
       new RegExp(degisken + '\\s*=\\s*null').test(govde), govde.slice(0, 200));
  }
  ok('  ardindan loadData() cagriliyor', /loadData\(\)/.test(govde));
  // Sira onemli: memo bosaltilmadan loadData cagrilirsa yine NO-OP olur.
  // YORUM SATIRLARI AYIKLANIYOR: bu duzeltmeyi ANLATAN yorum "loadData()" ve
  // "_anasayfaCache" sozlerini iceriyor; ciplak indexOf yorumu bulup sirayi
  // YANLIS olcuyordu (ilk yazista tam bu oldu). Bu depoda belgelenmis,
  // tekrarlayan tuzak.
  const kod = govde.split('\n').filter(l => !l.trim().startsWith('//')).join('\n');
  const memoIdx = kod.indexOf('_anasayfaCache = null');
  const loadIdx = kod.indexOf('loadData()');
  ok('  memo bosaltma loadData\'DAN ONCE', memoIdx >= 0 && loadIdx > memoIdx,
     `memo@${memoIdx} load@${loadIdx}`);
  ok('  (kontrol) yorum ayiklama kodu yemedi', kod.includes('loadData()') && kod.includes('_anasayfaCache = null'));
}

console.log('\n=== 4. GETTER\'LAR HALA MEMO\'LU (kilit anlamli mi?) ===');
{
  // Bu iddia testin KENDI onkosulu: getter'lar memo'yu birakirsa yukaridaki
  // bosaltma gereksizlesir ve test yanlis yeri korumaya devam eder.
  ok('anasayfaVeriGetir memo kullaniyor', /_anasayfaCache !== null\)\s*return/.test(APP));
  ok('halVeriGetir memo kullaniyor', /if \(_halCache\) return/.test(APP));
}

console.log('\nPASS=' + pass + '  FAIL=' + fail);
process.exit(fail ? 1 : 0);
