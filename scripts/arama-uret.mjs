// scripts/arama-uret.mjs
// data/urunler_*.json dosyalarindan HAFIF bir arama indeksi uretir.
//
// ═══ NEDEN VAR ═══════════════════════════════════════════════════════
// Arama kutusuna ILK HARFI yazan kullanici loadAllCats() ile sekiz kategori
// dosyasini birden indiriyordu: OLCULDU (2026-09-10) 1.317 KB gzip / 14,2 MB
// ham JSON. Mobil internette 3-8 saniye ve ardindan ayristirma.
// Oysa arama sonucu KARTININ okudugu alanlar sayili. cardHTML zinciri
// (214 fonksiyon tarandi) urunden yalnizca sunlari okuyor:
//   _sid, ad, resim, agirlik_hacim, ana_kategori, en_dusuk_fiyat,
//   market_fiyatlari, son_senkron
// son_senkron JSON'da degil, fetch yanitinin Last-Modified basligindan
// geliyor (loadCat ile ayni desen) -> dosyaya yazilmiyor.
//
// AGIR OLAN market_fiyatlari DEGIL, GECMIS DIZILERI: fiyat_gecmisi,
// agirlik_hacim_gecmisi, ilan_indirim_gecmisi ve market kayitlarindaki
// depot_id/depot_ad. Bunlar disarida kalinca fiyat BILGISI KAYBOLMUYOR --
// yani arama karti BIREBIR ayni ciziliyor.
// OLCULDU: 1.317 KB -> 632 KB gzip, %52 kazanc.
//
// ═══ NE URETILMIYOR ══════════════════════════════════════════════════
// Bu dosya URUN VERISININ IKINCI KAYNAGI DEGIL: her kosuda ayni
// urunler_*.json'lardan yeniden turetiliyor (anasayfa.json ile ayni desen).
// Kullanici bir sonuca dokununca TAM urun kendi kategorisinden iniyor.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const KOK = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const D = (p) => path.join(KOK, p);

// app.js'teki KATEGORILER ile ayni slug'lar. Dosya adindan turetiliyor,
// elle liste YAZILMIYOR -- yeni kategori eklenince kendiliginden giriyor.
const dosyalar = fs.readdirSync(D('data'))
  .filter((f) => /^urunler_.*\.json$/.test(f))
  .sort();

if (!dosyalar.length) {
  console.error('[arama] data/urunler_*.json bulunamadi');
  process.exit(1);
}

// Dizi bicimi: anahtar adlari 16 bin kez tekrarlanmasin.
// Sira SABIT ve app.js'teki _aramaCoz ile eslesmek ZORUNDA.
//   0 _sid  1 ad  2 resim  3 agirlik_hacim  4 ana_kategori
//   5 en_dusuk_fiyat  6 market_fiyatlari([[market,fiyat],...])  7 slug
const ALAN_SIRASI = ['_sid', 'ad', 'resim', 'agirlik_hacim', 'ana_kategori',
                     'en_dusuk_fiyat', 'market_fiyatlari', 'slug'];

const satirlar = [];
let atlanan = 0;

for (const dosya of dosyalar) {
  const slug = dosya.replace(/^urunler_|\.json$/g, '');
  let liste;
  try {
    liste = JSON.parse(fs.readFileSync(D('data/' + dosya), 'utf8'));
  } catch (e) {
    // SESSIZ YUTMA YOK: eksik kategori aramayi sessizce yarim birakirdi.
    console.error(`[arama] ${dosya} okunamadi: ${e.message}`);
    process.exit(1);
  }
  if (!Array.isArray(liste) || !liste.length) {
    console.error(`[arama] ${dosya} BOS ya da dizi degil -- arama yarim kalirdi`);
    process.exit(1);
  }
  for (const u of liste) {
    // _sid kimlik: yoksa urun aramada cozulemez, sessizce yanlis urun
    // gostermektense hic gostermemek dogru.
    if (!u || !u._sid || !u.ad) { atlanan++; continue; }
    satirlar.push([
      u._sid,
      u.ad,
      u.resim || '',
      u.agirlik_hacim || '',
      u.ana_kategori || '',
      u.en_dusuk_fiyat == null ? null : u.en_dusuk_fiyat,
      (u.market_fiyatlari || []).map((f) => [f.market, f.fiyat]),
      slug,
    ]);
  }
}

const cikti = { surum: 1, alanlar: ALAN_SIRASI, urunler: satirlar };
const yol = D('data/arama.json');
fs.writeFileSync(yol, JSON.stringify(cikti));

const kb = Math.round(fs.statSync(yol).size / 1024);
console.log(`[arama] data/arama.json yazildi: ${satirlar.length} urun, ${kb} KB ham` +
            (atlanan ? `  (_sid/ad eksik ${atlanan} kayit atlandi)` : ''));
