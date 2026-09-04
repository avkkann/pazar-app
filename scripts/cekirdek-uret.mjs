// scripts/cekirdek-uret.mjs
// app.js'teki SAF IS MANTIGINI cikarip core/pazar-cekirdek.cjs'e yazar.
// Amac: React Native istemcisi ayni kurallari KOPYALAMADAN kullanabilsin.
//
// ═══ NEDEN URETILIYOR, ELLE TASINMIYOR ═══════════════════════════════
// Olculdu (2026-09-04): 57 testin 40'i fonksiyon KAYNAK METNINI app.js'ten
// cekip vm'de kosturuyor (govde()/fnKaynak() yardimcilari). Fonksiyonlari
// app.js'ten cikarmak o 40 dosyanin hepsini degistirmek demekti -- canli
// uygulamada gereksiz buyuk bir yaricap.
// Bu yuzden: app.js TEK YETKILI KAYNAK olarak kaliyor, cekirdek ondan
// URETILIYOR. Kopya yok; ureteci kosmadan cekirdek degismiyor ve
// test_cekirdek.mjs ikisinin ayrismadigini dogruluyor.
//
// ═══ NE TASINIYOR, NE TASINMIYOR ═════════════════════════════════════
// TASINAN   : 38 fonksiyon + 21 ust duzey sabit, app.js'ten BIREBIR metin.
// TASINMAYAN: sehirOku -- localStorage'a dokunuyor. Kopyalayip RN'e gore
//             degistirseydim IKI KAYNAK olurdu; bunun yerine cagiran taraf
//             enjekte ediyor (web: localStorage, RN: AsyncStorage).
// Modul seviyesindeki onbellekler (_gecmisCache, catCache, productMap,
// _puanCache, _ilMarketCache) cekirdek icinde tanimli ve durumAyarla() ile
// disaridan doldruluyor -- app.js'te de ayni adla ayni islevdeler.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const KOK = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const D = (p) => path.join(KOK, p);

// ── Cekirdege girecek adlar. ACIKCA yazili: otomatik kapanis sessizce
//    buyuyup DOM kodunu iceri almasin. Liste degisirse bilerek degisir.
const FONKSIYONLAR = [
  // metin / bicim
  'trNormalize', 'norm', 'tl', 'ustKategori', 'markaBul', '_zamMarka',
  // birim fiyat
  '_birimFiyatHam', '_birimFiyatAyristir', 'birimFiyatHesapla', 'birimFiyatYazi',
  // fiyat serisi
  '_yerelGunISO', '_zamGunISO', '_salinimVarSeri', '_seriKur',
  'otuzGunlukSeri', 'otuzGunlukSeriTemiz', 'otuzGunMinFiyat', 'otuzGunMinFiyatTemiz',
  'enDusukFiyat', 'fiyatlariTemizle',
  // rozet / durum
  'indirimRozetiHesapla', 'supheliDurum', 'alZamaniDurumu',
  // zam
  'zamOlcutu', 'zamSalinimVar', 'zamMarketSerisi', 'zamMarketArtisi',
  'zamDurumu', 'zamAdaylari', 'zamHavuzu', 'zamSecHavuzdan',
  // arama
  '_aramaSkoru', 'urunAra', '_ahIndexRebuildIfNeeded',
  // urun iliskileri
  'ayniUrunMu', 'digerPaketleriBul',
  // sehir
  'ilMarketleri', 'marketVarMi',
];

// sehirOku BILEREK YOK -- enjekte ediliyor (yukaridaki bas yoruma bak).
const ENJEKTE = ['sehirOku'];

const SABITLER = [
  'AL_ZAMANI_MIN_OYNAMA', 'AL_ZAMANI_TOLERANS', 'KART_GRUP', 'SEHIR_KEY',
  'SUPHELI_KUTU_ESIK', 'SUPHELI_SEBEP_CUMLE', 'SUPHELI_ZAMANSAL_SEBEPLER',
  'TUZAK_WHITELIST', 'ZAM_ESIK', 'ZAM_KAT_MAX', 'ZAM_MARKA_MAX', 'ZAM_MAX',
  'ZAM_MIN_KAYIT', '_ARAMA_GRUP_SLUG',
];

// Cekirdek icinde tanimlanip disaridan doldurulan durum.
const DURUM = ['_ahIndex', '_ahIndexSize', '_gecmisCache', '_ilMarketCache',
               '_puanCache', '_seriCache'];

const KAYNAK = fs.readFileSync(D('app.js'), 'utf8');
const L = KAYNAK.split(/\r?\n/);

/** Ust duzey `function ad(` blogunu, bir sonraki ust duzey bildirime kadar alir. */
function fonksiyonGovdesi(ad) {
  const bas = L.findIndex((l) => new RegExp(`^(async )?function ${ad.replace(/\$/g, '\\$')}\\s*\\(`).test(l));
  if (bas < 0) return null;
  for (let i = bas + 1; i < L.length; i++) {
    if (/^(async )?function [A-Za-z_$]/.test(L[i]) || /^(const|let|var) /.test(L[i])
        || /^document\./.test(L[i]) || /^\/\/ ═/.test(L[i])) {
      return L.slice(bas, i).join('\n').replace(/\s+$/, '');
    }
  }
  return L.slice(bas).join('\n');
}

/** Ust duzey `const AD = ...;` bildirimini, dengeli parantez sayarak alir. */
function sabitGovdesi(ad) {
  const bas = L.findIndex((l) => new RegExp(`^(const|let) ${ad.replace(/\$/g, '\\$')}\\s*=`).test(l));
  if (bas < 0) return null;
  let derinlik = 0;
  for (let i = bas; i < L.length; i++) {
    for (const ch of L[i]) {
      if ('([{'.includes(ch)) derinlik++;
      else if (')]}'.includes(ch)) derinlik--;
    }
    if (derinlik <= 0 && /;\s*(\/\/.*)?$/.test(L[i])) return L.slice(bas, i + 1).join('\n');
  }
  return null;
}

const parcalar = [];
const eksik = [];

for (const ad of SABITLER) {
  const g = sabitGovdesi(ad);
  if (g) parcalar.push(g); else eksik.push('sabit:' + ad);
}
// Durum degiskenleri: app.js'teki bildirimin AYNISI (deger dahil)
for (const ad of DURUM) {
  const g = sabitGovdesi(ad);
  if (g) parcalar.push(g); else eksik.push('durum:' + ad);
}
for (const ad of FONKSIYONLAR) {
  const g = fonksiyonGovdesi(ad);
  if (g) parcalar.push(g); else eksik.push('fonksiyon:' + ad);
}

if (eksik.length) {
  console.error('[cekirdek] BULUNAMADI: ' + eksik.join(', '));
  process.exit(1);
}

const disaVerilen = [...FONKSIYONLAR, ...SABITLER].sort();

const cikti = `// ╔══════════════════════════════════════════════════════════════════╗
// ║  URETILMIS DOSYA — ELLE DUZENLEME.                                ║
// ║  Kaynak: app.js   Ureten: scripts/cekirdek-uret.mjs               ║
// ║  Yeniden uret: node scripts/cekirdek-uret.mjs                     ║
// ║  Ayrisma testi: node test_cekirdek.mjs                            ║
// ╚══════════════════════════════════════════════════════════════════╝
//
// Pazar cekirdegi — is mantiginin TEK kaynagi. Web (app.js) ve React Native
// istemcisi ayni kurallari buradan alir; kural iki yerde yazilmaz.
//
// KULLANIM:
//   const C = require('./pazar-cekirdek.cjs');       // veya <script src=...>
//   C.baglaAyarla({ sehirOku: () => 'İstanbul' });   // zorunlu enjeksiyon
//   C.durumAyarla({ gecmis: gecmisJson, puanlar: puanMap, ilMarketleri: harita });
//   C.urunAra('domates', katalog);
//
// NEDEN ENJEKSIYON: sehirOku() localStorage okuyor. Cekirdege kopyalanip
// RN'e gore degistirilseydi IKI KAYNAK olurdu. Cagiran taraf veriyor.
(function (kok, fabrika) {
  if (typeof module === 'object' && module.exports) module.exports = fabrika();
  else kok.PazarCekirdek = fabrika();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  // ── Enjekte edilen baglar ───────────────────────────────────────────
  let _bag = {
    sehirOku: function () { return null; },   // sehir secilmemis = filtre yok
  };
  function baglaAyarla(b) { _bag = Object.assign({}, _bag, b || {}); }
  function sehirOku() { return _bag.sehirOku(); }

  // ── app.js'in modul seviyesindeki onbellekleri ──────────────────────
  // Adlar app.js ile AYNI; asagidaki fonksiyon govdeleri birebir kopya
  // oldugu icin ayni adlari gormek ZORUNDALAR.
  let catCache = {};
  let productMap = {};

  /** Cekirdege veri verir. Hicbiri zorunlu degil; verilmeyen dokunulmaz. */
  function durumAyarla(d) {
    if (!d) return;
    if (d.katalog) {
      catCache = d.katalog;
      productMap = {};
      for (const slug of Object.keys(catCache)) {
        for (const u of catCache[slug] || []) {
          if (!u._id) u._id = u.ad + '_' + (u.agirlik_hacim || '');
          productMap[u._id] = u;
        }
      }
      _ahIndex = null; _ahIndexSize = 0;   // katalog degisti -> indeks bayat
    }
    if (d.gecmis) { _gecmisCache = d.gecmis; _seriCache = new Map(); }
    if (d.puanlar) _puanCache = d.puanlar;
    if (d.ilMarketleri) _ilMarketCache = d.ilMarketleri;
  }

  function durumOku() {
    return { katalogSlug: Object.keys(catCache), urunSayisi: Object.keys(productMap).length,
             gecmisVar: !!_gecmisCache, puanVar: !!_puanCache, ilVar: !!_ilMarketCache };
  }

  // ══ BURADAN ASAGISI app.js'TEN BIREBIR ═══════════════════════════════
${parcalar.join('\n\n')}
// ══ BIREBIR KOPYA SONU ═════════════════════════════════════════════════

  return {
    baglaAyarla: baglaAyarla,
    durumAyarla: durumAyarla,
    durumOku: durumOku,
${disaVerilen.map((a) => `    ${a}: ${a},`).join('\n')}
  };
});
`;

fs.mkdirSync(D('core'), { recursive: true });
fs.writeFileSync(D('core/pazar-cekirdek.cjs'), cikti, 'utf8');
const kb = fs.statSync(D('core/pazar-cekirdek.cjs')).size / 1024;
console.log(`[cekirdek] core/pazar-cekirdek.cjs yazildi: ${kb.toFixed(1)} KB`);
console.log(`[cekirdek] ${FONKSIYONLAR.length} fonksiyon + ${SABITLER.length} sabit + ${DURUM.length} durum`);
console.log(`[cekirdek] enjekte edilen (kopyalanmayan): ${ENJEKTE.join(', ')}`);
