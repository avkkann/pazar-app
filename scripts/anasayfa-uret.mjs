// scripts/anasayfa-uret.mjs
// Ana sayfa seritlerini BUILD zamaninda hesaplayip data/anasayfa.json'a yazar.
//
// KRITIK KURAL: MANTIK YENIDEN YAZILMIYOR. app.js oldugu gibi node:vm icinde
// kosturuluyor ve KENDI fonksiyonlari (zamHavuzu, tuzakRozetiHesapla,
// supheliDurum, indirimRozetiHesapla, _seriKur ...) cagriliyor. Iki ayri
// uygulama = kacinilmaz sapma; bu dosyada hicbir esik, filtre veya siralama
// kuralı YOKTUR — hepsi app.js'ten geliyor.
//
// NEDEN: olculdu (2026-08-11, canli, soguk onbellek)
//   8 kategori JSON paralel     850 ms   (12,63 MB ham / 1,36 MB gzip)
//   gecmis_fiyatlar.json       1177 ms   ( 4,15 MB ham / 0,64 MB gzip)
//   tuzak taramasi (hesap)    14701 ms   <- asil darbogaz, ag degil HESAP
//   zamAdaylari (hesap)         976 ms
// Bu veri gunde bir kez degisiyor; her kullanicinin 17 MB indirip 16.790
// urun taramasi gereksiz.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const KOK = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const D = (p) => path.join(KOK, p);

// ── tarayici govdesi (yalnizca app.js kosabilsin diye; is mantigi YOK)
function el() {
  const e = {
    style: {}, dataset: {}, classList: { add(){}, remove(){}, toggle(){}, contains(){ return false; } },
    innerHTML: '', textContent: '', value: '', checked: false, offsetHeight: 0, children: [],
    appendChild(){}, removeChild(){}, setAttribute(){}, getAttribute(){ return null; },
    removeAttribute(){}, addEventListener(){}, removeEventListener(){}, remove(){},
    querySelector(){ return el(); }, querySelectorAll(){ return []; }, closest(){ return null; },
    focus(){}, blur(){}, click(){}, scrollIntoView(){}, insertAdjacentHTML(){},
    getBoundingClientRect(){ return { top: 0, left: 0, width: 0, height: 0 }; },
  };
  return e;
}
const depo = () => ({ _d: {}, getItem(k) { return this._d[k] ?? null; },
  setItem(k, v) { this._d[k] = String(v); }, removeItem(k) { delete this._d[k]; },
  clear() { this._d = {}; }, key() { return null; }, get length() { return 0; } });

// Supabase: yalnizca TASIMA katmani. PostgREST'e HTTP atiyor, hicbir is
// kuralı burada degil — filtreleme/siralama app.js'te kaliyor.
function supabaseIstemci(url, anahtar) {
  const bas = { apikey: anahtar, Authorization: 'Bearer ' + anahtar };
  const from = (tablo) => {
    const p = new URLSearchParams();
    const q = {
      select(s) { p.set('select', String(s).replace(/\s+/g, '')); return q; },
      gte(k, v) { p.append(k, 'gte.' + v); return q; },
      lte(k, v) { p.append(k, 'lte.' + v); return q; },
      eq(k, v) { p.append(k, 'eq.' + v); return q; },
      order(k, o) { p.set('order', k + '.' + (o && o.ascending === false ? 'desc' : 'asc')); return q; },
      limit(n) { p.set('limit', String(n)); return q; },
      async _cek() {
        if (!p.has('select')) p.set('select', '*');
        const hepsi = [];
        const sayfa = 1000;
        // PostgREST varsayilan 1000 satirda kesiyor; limit yoksa sayfalayarak al.
        if (p.has('limit')) {
          const r = await fetch(`${url}/rest/v1/${tablo}?${p}`, { headers: bas });
          if (!r.ok) return { data: null, error: new Error(await r.text()) };
          return { data: await r.json(), error: null };
        }
        for (let off = 0; ; off += sayfa) {
          const r = await fetch(`${url}/rest/v1/${tablo}?${p}`, {
            headers: { ...bas, Range: `${off}-${off + sayfa - 1}` } });
          if (!r.ok) return { data: null, error: new Error(await r.text()) };
          const d = await r.json();
          hepsi.push(...d);
          if (d.length < sayfa) break;
        }
        return { data: hepsi, error: null };
      },
      then(res, rej) { return q._cek().then(res, rej); },
    };
    return q;
  };
  return {
    auth: { getSession: async () => ({ data: { session: null } }), onAuthStateChange() {}, signOut: async () => ({}) },
    from,
    async rpc(ad, govde) {
      const r = await fetch(`${url}/rest/v1/rpc/${ad}`, {
        method: 'POST', headers: { ...bas, 'Content-Type': 'application/json' },
        body: JSON.stringify(govde || {}) });
      if (!r.ok) return { data: null, error: new Error(await r.text()) };
      return { data: await r.json(), error: null };
    },
    channel: () => ({ on() { return this; }, subscribe() {} }),
  };
}

const APP = fs.readFileSync(D('app.js'), 'utf8');
const SB_URL = (APP.match(/const SUPABASE_URL\s*=\s*'([^']+)'/) || [])[1];
const SB_KEY = (APP.match(/const SUPABASE_ANON_KEY\s*=\s*'([^']+)'/) || [])[1];

const ctx = {
  console,
  document: {
    getElementById: () => el(), querySelector: () => el(), querySelectorAll: () => [],
    createElement: () => el(), addEventListener() {}, removeEventListener() {}, dispatchEvent() {},
    body: el(), documentElement: el(), head: el(), readyState: 'complete',
    createTextNode: () => el(), createDocumentFragment: () => el(),
  },
  navigator: { userAgent: 'node', clipboard: { writeText() {} }, onLine: true,
    serviceWorker: { register() { return Promise.resolve({ addEventListener() {} }); },
      addEventListener() {}, removeEventListener() {}, controller: null,
      ready: new Promise(() => {}), getRegistrations: async () => [] } },
  location: { href: 'https://avkkann.github.io/pazar-app/', search: '', hash: '',
    pathname: '/pazar-app/', origin: 'https://avkkann.github.io', replace() {}, assign() {}, reload() {} },
  history: { pushState() {}, replaceState() {}, back() {} },
  localStorage: depo(), sessionStorage: depo(),
  CustomEvent: class { constructor(t, o) { this.type = t; this.detail = o && o.detail; } },
  // ./data/*.json disk'ten okunuyor (build sirasinda ag'a cikmaya gerek yok)
  fetch: async (u, o) => {
    const s = String(u);
    if (/^https?:/.test(s)) return fetch(s, o);
    const yol = s.replace(/^\.\//, '').split('?')[0];
    const tam = D(yol);
    if (!fs.existsSync(tam)) {
      return { ok: false, status: 404, headers: { get: () => null }, json: async () => ({}), text: async () => '' };
    }
    const m = fs.readFileSync(tam, 'utf8');
    return { ok: true, status: 200, headers: { get: () => null },
             json: async () => JSON.parse(m), text: async () => m };
  },
  setTimeout, clearTimeout, setInterval, clearInterval, queueMicrotask,
  requestAnimationFrame: (f) => setTimeout(f, 0),
  requestIdleCallback: (f) => setTimeout(() => f({ timeRemaining: () => 50 }), 0),
  matchMedia: () => ({ matches: false, addEventListener() {}, addListener() {} }),
  IntersectionObserver: class { observe() {} unobserve() {} disconnect() {} },
  MutationObserver: class { observe() {} disconnect() {} },
  URL, URLSearchParams, TextEncoder, TextDecoder, performance, structuredClone, Intl,
  alert() {}, confirm() { return false; }, prompt() { return null; },
  addEventListener() {}, removeEventListener() {}, scrollTo() {}, open() { return null; },
  innerWidth: 1440, innerHeight: 900, devicePixelRatio: 1,
  supabase: { createClient: (u, k) => supabaseIstemci(u, k) },
};
ctx.window = ctx; ctx.globalThis = ctx; ctx.self = ctx;
vm.createContext(ctx);
vm.runInContext(APP, ctx, { filename: 'app.js' });
const ic = (kod) => vm.runInContext(kod, ctx);

const t0 = Date.now();
await ic('loadAllCats()');
await ic('gecmisVeriGetir()');
const urunSayisi = ic('Object.values(catCache).reduce((a,b)=>a+(b?b.length:0),0)');
console.log(`[anasayfa] veri hazir: ${urunSayisi} urun, ${Date.now() - t0} ms`);

// Kart cizimi icin gereken ALANLAR (bkz. _stripKartHTML + birimFiyatHesapla).
// market_fiyatlari yalnizca market+fiyat ile tasiniyor: sehir filtresi ve
// birim fiyat bunu kullaniyor, gerisi ana sayfada gereksiz.
ic(`function _asKart(u) {
  return {
    _id: u._id, _sid: u._sid, ad: u.ad, resim: u.resim || null,
    ana_kategori: u.ana_kategori || '', agirlik_hacim: u.agirlik_hacim || null,
    en_dusuk_fiyat: u.en_dusuk_fiyat != null ? u.en_dusuk_fiyat : null,
    market_fiyatlari: (u.market_fiyatlari || [])
      .filter(f => f && f.market && f.fiyat != null)
      .map(f => ({ market: f.market, fiyat: f.fiyat })),
  };
}`);

// ── ZAM: sehirden BAGIMSIZ havuz. Secim (sehir + cesitlilik + ZAM_MAX)
//    istemcide zamSecHavuzdan ile ayni kodla yapiliyor.
const tZam = Date.now();
const zam = ic('zamHavuzu().map(x => ({ u: _asKart(x.u), marketArtis: x.marketArtis }))');
console.log(`[anasayfa] zam havuzu: ${zam.length} urun, ${Date.now() - tZam} ms`);

// ── TUZAKLAR: renderTuzaklarSeridi'nin AYNI tarama dongusu.
//    Secim (karistir + 6) istemcide kaliyor — bugunku davranis rastgele.
const tTuz = Date.now();
const tuzaklar = ic(`(() => {
  const kirmizi = [], sari = [];
  const ids = Object.keys(productMap);
  for (let j = 0; j < ids.length; j++) {
    const u = productMap[ids[j]];
    if (!u || !u._id) continue;
    if (!u.resim) continue;
    const adL = String(u.ad || '').toLowerCase();
    if (/\\b(bebelac|aptamil|hipp|nestle baby|organik|bio|gluten|konserve|hazır|superfresh|hellmann|heinz|bebek)\\b/.test(adL)) continue;
    const r = tuzakRozetiHesapla(u);
    if (!r) continue;
    if (r.tip === 'kirmizi') kirmizi.push({ u: _asKart(u), r: r });
    else sari.push({ u: _asKart(u), r: r });
    if (kirmizi.length >= 30) break;
  }
  return { kirmizi: kirmizi, sari: sari.slice(0, 30) };
})()`);
console.log(`[anasayfa] tuzaklar: ${tuzaklar.kirmizi.length} kirmizi + ${tuzaklar.sari.length} sari, ${Date.now() - tTuz} ms`);

// ── SUPABASE'E DAYALI IKI SERIT
await ic('supheliPuanlariYukle()');
const tDus = Date.now();
const dusenler = await (async () => {
  const { data, error } = await ic('supabaseClient').rpc('get_fiyat_dusenler',
    { p_limit: ic('DUSENLER_RPC_LIMIT') });
  if (error || !data) { console.warn('[anasayfa] dusenler RPC hatasi: ' + (error && error.message)); return []; }
  ic('window.__ham = null');
  ctx.__ham = data;
  return ic(`(() => {
    __ham.forEach(u => { if (!u._id) u._id = u.ad + '_' + (u.agirlik_hacim || ''); });
    return __ham.filter(u => !supheliDurum(u))
      .map(u => ({ u: _asKart(u), dusus_yuzde: u.dusus_yuzde }));
  })()`);
})();
console.log(`[anasayfa] dusenler: ${dusenler.length} aday, ${Date.now() - tDus} ms`);

const tSup = Date.now();
const supheli = await (async () => {
  const { data, error } = await ic('supabaseClient').from('urunler').select('*')
    .gte('indirim_supheli_puan', 4)
    .order('indirim_supheli_puan', { ascending: false })
    .limit(ic('SUPHELI_SERIT_SORGU_LIMIT'));
  if (error || !data) { console.warn('[anasayfa] supheli sorgu hatasi: ' + (error && error.message)); return []; }
  ctx.__ham2 = data;
  return ic(`(() => {
    const out = [];
    __ham2.forEach(u => {
      if (!u._id) u._id = u.ad + '_' + (u.agirlik_hacim || '');
      if (!supheliDurum(u)) return;
      const ir = indirimRozetiHesapla(u);
      out.push({ u: _asKart(u), puan: u.indirim_supheli_puan, yuzde: ir ? ir.yuzde : 0,
                 durum: supheliDurum(u) });
    });
    return out;
  })()`);
})();
console.log(`[anasayfa] supheli: ${supheli.length} aday, ${Date.now() - tSup} ms`);

const cikti = {
  surum: 1,
  uretim: new Date().toISOString(),
  urun_sayisi: urunSayisi,
  zam: zam,
  tuzaklar: tuzaklar,
  dusenler: dusenler,
  supheli: supheli,
};
const hedef = D('data/anasayfa.json');
fs.writeFileSync(hedef, JSON.stringify(cikti), 'utf8');
const kb = fs.statSync(hedef).size / 1024;
console.log(`[anasayfa] data/anasayfa.json yazildi: ${kb.toFixed(1)} KB ham  (toplam ${Date.now() - t0} ms)`);
if (!zam.length && !tuzaklar.kirmizi.length && !dusenler.length && !supheli.length) {
  console.error('[anasayfa] UYARI: dort serit de bos — dosya yazildi ama istemci geriye dusecek');
  process.exit(1);
}
