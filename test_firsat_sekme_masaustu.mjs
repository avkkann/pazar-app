// test_firsat_sekme_masaustu.mjs — Firsatlar sekme cubugu MASAUSTUNDE okunuyor mu
//
// NEDEN VAR (2026-09-14, Mustafa ekran goruntusuyle bildirdi): masaustunde
// (>=1024px) toplu bir kural (.search-wrap, ..., .firsat-tabs) cubugu SAYDAM
// yapiyordu ve cubuk ekranin yesil bandinin ustune dusuyordu. Pasif sekme
// #6B7280, aktif #0E4938 -> yesil ustunde OKUNMUYORDU (kontrast ~1-2).
//
// KORUDUGU SEYLER
//  1) Masaustu acik temada sekme yazisi cubuk zemininde AA (>=4,5).
//  2) Cubuk zemini OPAK: cubuk sticky; kayinca arkasina acik liste zemini
//     geliyor. Saydam + beyaz yazi = kayinca beyaz ustune beyaz.
//  3) Klavye odak halkasi cubuk zemininden AYIRT EDILIYOR (genel halka
//     --primary, cubuk zemini de ayni yesil).
//  4) KONTROL GRUBU: mobil ve koyu tema DEGISMEDI.
//
// YONTEM: kaynak grep'i degil, BASAMAK COZUMU. style.css ayristiriliyor;
// her ozellik icin (medya sorgusu uyuyor mu) -> ozgulluk -> kaynak sirasi
// ile kazanan bildirim bulunuyor, token'lar cozuluyor, kontrast hesaplaniyor.
// Boylece "kural yazili mi" degil "ekranda hangi renk kazaniyor" soruluyor.
import { readFileSync } from 'node:fs';
import { tokenCoz } from './scripts/css-token.mjs';

let pass = 0, fail = 0;
const ok = (ad, kosul, ek = '') => {
  if (kosul) { pass++; console.log('  PASS  ' + ad); }
  else { fail++; console.log('  FAIL  ' + ad + (ek ? '  -> ' + ek : '')); }
};

const CSS_HAM = readFileSync('style.css', 'utf8');
const CSS = CSS_HAM.replace(/\/\*[\s\S]*?\*\//g, '');

// ── Ayristirici ──────────────────────────────────────────────────────────────
// Kurallar: { medya: '' | '(min-width: 1024px)' | '@diger', secici: [...], bildirim: Map, sira }
const KURALLAR = [];
function ayristir(metin, medya) {
  let i = 0;
  while (i < metin.length) {
    const ac = metin.indexOf('{', i);
    if (ac < 0) break;
    const onEk = metin.slice(i, ac).trim();
    // eslesen kapanis
    let d = 1, j = ac + 1;
    while (j < metin.length && d > 0) { if (metin[j] === '{') d++; else if (metin[j] === '}') d--; j++; }
    const govde = metin.slice(ac + 1, j - 1);
    // onEk icinde ';' ile biten at-kurallari (@import vb.) varsa at
    const temizOnEk = onEk.includes(';') ? onEk.slice(onEk.lastIndexOf(';') + 1).trim() : onEk;
    if (temizOnEk.startsWith('@media')) {
      const kosul = temizOnEk.slice(6).trim();
      ayristir(govde, medya ? medya + ' and ' + kosul : kosul);
    } else if (temizOnEk.startsWith('@')) {
      ayristir(govde, '@diger');
    } else if (temizOnEk) {
      const bildirim = new Map();
      for (const parca of govde.split(';')) {
        const k = parca.indexOf(':');
        if (k < 0) continue;
        bildirim.set(parca.slice(0, k).trim().toLowerCase(), parca.slice(k + 1).trim());
      }
      KURALLAR.push({ medya, secici: temizOnEk.split(',').map(s => s.trim().replace(/\s+/g, ' ')), bildirim, sira: KURALLAR.length });
    }
    i = j;
  }
}
ayristir(CSS, '');

const ozgulluk = (s) => {
  const id = (s.match(/#[\w-]+/g) || []).length;
  const sinif = (s.match(/\.[\w-]+|\[[^\]]+\]|:(?!:)[\w-]+/g) || []).length;
  return id * 100 + sinif;
};

// genislik: 'masaustu' | 'mobil'; tema: 'acik' | 'koyu'
function medyaUyar(medya, genislik) {
  if (medya === '') return true;
  if (medya === '@diger') return false;
  if (/prefers-contrast|prefers-reduced-motion|prefers-color-scheme|print/.test(medya)) return false;
  const min = medya.match(/min-width:\s*(\d+)px/);
  const max = medya.match(/max-width:\s*(\d+)px/);
  const w = genislik === 'masaustu' ? 1440 : 390;
  if (min && w < +min[1]) return false;
  if (max && w > +max[1]) return false;
  return !!(min || max);
}

// hedef: elemanin tasidigi durum -> uyan seciciler listesi
function coz(ozellikler, uyanSeciciler, genislik, tema) {
  let enIyi = null;
  for (const k of KURALLAR) {
    if (!medyaUyar(k.medya, genislik)) continue;
    for (const s of k.secici) {
      let s2 = s;
      if (s2.startsWith('[data-theme="dark"] ')) { if (tema !== 'koyu') continue; }
      else if (s2.startsWith('[data-theme="light"] ')) { if (tema !== 'acik') continue; }
      const cekirdek = s2.replace(/^\[data-theme="(dark|light)"\] /, '');
      if (!uyanSeciciler.includes(cekirdek)) continue;
      for (const oz of ozellikler) {
        if (!k.bildirim.has(oz)) continue;
        const aday = { deger: k.bildirim.get(oz), oz, spes: ozgulluk(s2), sira: k.sira, secici: s2, medya: k.medya };
        if (!enIyi || aday.spes > enIyi.spes || (aday.spes === enIyi.spes && aday.sira >= enIyi.sira)) enIyi = aday;
      }
    }
  }
  return enIyi;
}

// ── Renk yardimcilari ────────────────────────────────────────────────────────
const tokenKoyu = (metin) => {
  // Koyu tema token'lari [data-theme="dark"] blogunda; ilk tanim :root. Koyu icin blogu oku.
  const blok = (CSS.match(/\[data-theme="dark"\]\s*\{([^}]*)\}/) || [, ''])[1];
  let s = metin;
  for (const m of blok.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) s = s.split(`var(${m[1]})`).join(m[2].trim());
  return s;
};
const rengiCoz = (metin, tema) => tokenCoz(CSS, tema === 'koyu' ? tokenKoyu(metin) : metin).trim();
function rgba(c) {
  c = c.trim().toLowerCase();
  if (c === 'transparent') return [0, 0, 0, 0];
  if (c === 'none') return null;
  let m = c.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/);
  if (m) { let h = m[1]; if (h.length === 3) h = [...h].map(x => x + x).join(''); return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16)).concat(1); }
  m = c.match(/^rgba?\(([^)]+)\)$/);
  if (m) { const p = m[1].split(',').map(x => parseFloat(x)); return [p[0], p[1], p[2], p[3] ?? 1]; }
  return null;
}
const renkBul = (deger) => {
  // background / outline kisayolundan renk parcasini ayikla
  const p = deger.match(/#[0-9a-fA-F]{3,6}\b|rgba?\([^)]*\)|\btransparent\b/);
  return p ? p[0] : deger;
};
const lum = ([r, g, b]) => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
const komp = (on, arka) => [0, 1, 2].map(i => on[i] * on[3] + arka[i] * (1 - on[3]));
const kontrast = (on, arka) => { const a = lum(komp(on, arka)), b = lum(arka); return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05); };

const CUBUK = ['.firsat-tabs'];
const PASIF = ['.firsat-tab'];
const AKTIF = ['.firsat-tab', '.firsat-tab.active'];
const ODAK = [':focus-visible', '.firsat-tab', '.firsat-tab:focus-visible'];

function durum(genislik, tema) {
  const zemin = coz(['background', 'background-color'], CUBUK, genislik, tema);
  const pasif = coz(['color'], PASIF, genislik, tema);
  const aktif = coz(['color'], AKTIF, genislik, tema);
  const odak = coz(['outline-color', 'outline'], ODAK, genislik, tema);
  const z = zemin ? rgba(rengiCoz(renkBul(zemin.deger), tema)) : null;
  return {
    zemin, pasif, aktif, odak,
    z,
    p: pasif ? rgba(rengiCoz(pasif.deger, tema)) : null,
    a: aktif ? rgba(rengiCoz(aktif.deger, tema)) : null,
    o: odak ? rgba(rengiCoz(renkBul(odak.deger), tema)) : null,
  };
}

// ── 0. ALET KONTROLU ─────────────────────────────────────────────────────────
console.log('\n=== 0. ALET KONTROLU (ayristirici bilinen kurallari goruyor mu) ===');
ok('ayristirici yuzlerce kural buldu', KURALLAR.length > 500, 'bulunan=' + KURALLAR.length);
const tabanCubuk = KURALLAR.find(k => k.medya === '' && k.secici.includes('.firsat-tabs') && k.bildirim.get('background') === 'var(--card-bg)');
ok('  mobil taban kurali bulundu (.firsat-tabs { background: var(--card-bg) })', !!tabanCubuk);
const topluSaydam = KURALLAR.find(k => /min-width:\s*1024px/.test(k.medya) && k.secici.includes('.firsat-tabs') && k.secici.includes('.search-wrap') && k.bildirim.get('background') === 'transparent');
ok('  masaustu toplu saydam kural bulundu (kusurun kaynagi)', !!topluSaydam);
ok('  renk cozucu: #0E4938 / beyaz kontrasti ~10,35', Math.abs(kontrast([255, 255, 255, 1], rgba('#0E4938')) - 10.35) < 0.05);
if (!tabanCubuk || !topluSaydam) { console.log('\nALET KOR — sonuc guvenilmez, durduruluyor.'); process.exit(1); }

// ── 1. MASAUSTU, ACIK TEMA ───────────────────────────────────────────────────
console.log('\n=== 1. MASAUSTU ACIK TEMA: sekmeler okunuyor ===');
const MA = durum('masaustu', 'acik');
ok('cubuk zemini cozuldu', !!MA.z, MA.zemin && MA.zemin.deger);
ok('  cubuk zemini OPAK (sticky: kayinca arkasina acik liste gelir)', MA.z && MA.z[3] === 1, MA.zemin && `${MA.zemin.secici} -> ${MA.zemin.deger}`);
ok('  pasif sekme kontrasti >= 4,5', MA.p && MA.z && kontrast(MA.p, MA.z) >= 4.5, MA.p && MA.z && kontrast(MA.p, MA.z).toFixed(2));
ok('  aktif sekme kontrasti >= 4,5', MA.a && MA.z && kontrast(MA.a, MA.z) >= 4.5, MA.a && MA.z && kontrast(MA.a, MA.z).toFixed(2));
ok('  aktif pasiften AYIRT EDILIYOR (daha yuksek kontrast)', MA.a && MA.p && MA.z && kontrast(MA.a, MA.z) > kontrast(MA.p, MA.z));
const aktifAlt = coz(['border-bottom-color'], AKTIF, 'masaustu', 'acik');
const alt = aktifAlt ? rgba(rengiCoz(aktifAlt.deger, 'acik')) : null;
ok('  aktif alt cizgi cubuk zemininde gorunur (>= 3)', alt && MA.z && kontrast(alt, MA.z) >= 3, alt && MA.z && kontrast(alt, MA.z).toFixed(2));
ok('  odak halkasi cubuk zemininden ayirt ediliyor (>= 3)', MA.o && MA.z && kontrast(MA.o, MA.z) >= 3, MA.odak && `${MA.odak.secici} -> ${MA.odak.deger}`);
const odakKisayol = KURALLAR.some(k => k.secici.includes('.firsat-tab:focus-visible') && k.bildirim.has('outline'));
ok('  odak kurali kalinligi EZMIYOR (yuksek kontrastta 3px genel kuraldan)', !odakKisayol);

// ── 2. KONTROL GRUBU: MOBIL DEGISMEDI ────────────────────────────────────────
console.log('\n=== 2. KONTROL GRUBU: mobil degismedi ===');
const MO = durum('mobil', 'acik');
ok('mobil cubuk zemini hala var(--card-bg)', MO.zemin && MO.zemin.deger === 'var(--card-bg)', MO.zemin && MO.zemin.deger);
ok('  mobil aktif sekme hala #0E4938', MO.aktif && /#0E4938/i.test(MO.aktif.deger), MO.aktif && MO.aktif.deger);
ok('  mobil pasif sekme hala var(--text-muted)', MO.pasif && MO.pasif.deger === 'var(--text-muted)', MO.pasif && MO.pasif.deger);
ok('  mobil aktif kontrast >= 4,5', MO.a && MO.z && kontrast(MO.a, MO.z) >= 4.5);

// ── 3. KONTROL GRUBU: KOYU TEMA DEGISMEDI ────────────────────────────────────
console.log('\n=== 3. KONTROL GRUBU: koyu tema degismedi (masaustu) ===');
const MK = durum('masaustu', 'koyu');
ok('koyu cubuk zemini eskisi gibi SAYDAM', MK.zemin && MK.zemin.deger === 'transparent', MK.zemin && `${MK.zemin.secici} -> ${MK.zemin.deger}`);
ok('  koyu pasif sekme kendi kuralindan (var(--text))', MK.pasif && MK.pasif.secici.startsWith('[data-theme="dark"]'), MK.pasif && MK.pasif.secici);
ok('  koyu aktif sekme kendi kuralindan (#FFFFFF, --primary zemin)', MK.aktif && MK.aktif.secici.startsWith('[data-theme="dark"]') && /#FFFFFF/i.test(MK.aktif.deger), MK.aktif && `${MK.aktif.secici} -> ${MK.aktif.deger}`);

// ── 4. KAPSAM ────────────────────────────────────────────────────────────────
console.log('\n=== 4. KAPSAM ===');
const yeniKurallar = KURALLAR.filter(k => k.secici.some(s => /^\.firsat-tab(s)?(\.active|:hover|:focus-visible)?$/.test(s)) && (k.bildirim.get('background') === 'var(--zemin-a)' || /255,\s*255,\s*255/.test(k.bildirim.get('color') || '')));
ok('beyaz/yesil sekme kurallari YALNIZ masaustu medya sorgusunda', yeniKurallar.length > 0 && yeniKurallar.every(k => /min-width:\s*1024px/.test(k.medya)), yeniKurallar.map(k => k.medya || '(medyasiz)').join(' | '));
ok('  satir ici stil eklenmedi (index.html firsat-tabs blogu)', !/<div class="firsat-tabs"[^>]*style=/.test(readFileSync('index.html', 'utf8')));

console.log(`\nSONUC: PASS=${pass} FAIL=${fail}`);
process.exit(fail ? 1 : 0);
