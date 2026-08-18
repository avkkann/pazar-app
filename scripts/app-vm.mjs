// scripts/app-vm.mjs
// app.js'i node:vm icinde kosturan tarayici taklidi gövde. Yalnizca TASIMA
// katmani — is mantigi burada YOK, hepsi app.js'ten geliyor. Bu dosya birden
// fazla uretici script (anasayfa-uret.mjs, hub-uret.mjs, ...) tarafindan
// paylasilir; iki ayri tarayici taklidi = kacinilmaz sapma.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

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

export function appOrtamiKur(secenekler = {}) {
  const kok = secenekler.kok
    || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const D = (p) => path.join(kok, p);

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
    location: { href: 'https://pazarapp.net/', search: '', hash: '',
      pathname: '/', origin: 'https://pazarapp.net', replace() {}, assign() {}, reload() {} },
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

  return { ic, ctx };
}
