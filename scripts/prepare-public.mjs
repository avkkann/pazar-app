// scripts/prepare-public.mjs
// build oncesi calisir: public/ klasorunu static/, data/, manifest.json, robots.txt, sitemap.xml'den olusturur.
// Bu dosyalarin GERCEK kaynagi hala repo kokunde (static/, data/) - burada sadece build icin GECICI bir kopya cikariliyor.
import { cpSync, mkdirSync, existsSync, rmSync, copyFileSync, readFileSync, writeFileSync } from 'node:fs';
import { lastmodDamgasi, sitemapDoldur, sitemapEkle } from './sitemap.mjs';

const PUB = 'public';
if (existsSync(PUB)) rmSync(PUB, { recursive: true, force: true });
mkdirSync(PUB, { recursive: true });

cpSync('static', `${PUB}/static`, { recursive: true });
cpSync('data', `${PUB}/data`, { recursive: true });
copyFileSync('manifest.json', `${PUB}/manifest.json`);
copyFileSync('robots.txt', `${PUB}/robots.txt`);
copyFileSync('sw.js', `${PUB}/sw.js`);

// sitemap.xml duz kopyalanmiyor: <lastmod> burada dolduruluyor. Damga
// data/anasayfa.json'un "uretim" alanindan geliyor — her veri kosusunda
// yeniden yazilan tek icerik-ici zaman damgasi. Kaynak dosyada tarih YOK,
// yer tutucu var; elle yazilan tarih bayatliyor. Bkz. scripts/sitemap.mjs
let anasayfa = null;
try { anasayfa = JSON.parse(readFileSync('data/anasayfa.json', 'utf8')); }
catch (e) { console.warn('[sitemap] data/anasayfa.json okunamadi: ' + e.message); }
const damga = lastmodDamgasi(anasayfa);
let sitemapXml = sitemapDoldur(readFileSync('sitemap.xml', 'utf8'), damga);

// Hub sayfalari (.hub/manifest.json, Gorev 4: scripts/hub-uret.mjs) sitemap'e
// eklenir. Yalnizca durum === "uretildi" olanlar girer — "atlandi" olan bir
// sayfayi sitemap'e koymak Google'a 404 sunmak demek (bkz. gorev-5-brief.md).
// Doluluk/esik KARARI burada verilmiyor: o karar zaten hub-sayfa.mjs'teki
// sayfaKarari'nda alinmis, .hub/manifest.json'a "durum" olarak yazilmis.
// Burasi yalnizca o karari OKUYOR.
const HUB_MANIFEST = '.hub/manifest.json';
if (existsSync(HUB_MANIFEST)) {
  let hubManifest = [];
  try { hubManifest = JSON.parse(readFileSync(HUB_MANIFEST, 'utf8')); }
  catch (e) { console.warn('[sitemap] ' + HUB_MANIFEST + ' okunamadi/ayristirilamadi: ' + e.message); }
  const girisler = hubManifest
    .filter((g) => g && g.durum === 'uretildi')
    .map((g) => ({ loc: 'https://pazarapp.net' + g.yol, lastmod: g.son_veri }));
  sitemapXml = sitemapEkle(sitemapXml, girisler);
  console.log(`[sitemap] hub girdileri eklendi: ${girisler.length} / ${hubManifest.length} (durum=uretildi)`);
} else {
  // Manifest yok demek Gorev 4 (hub-uret.mjs) hic kosmamis olabilir — bu
  // build'i KIRMIYOR. Asil kapi Gorev 6'daki tazelik kontrolu; burasi
  // yalnizca kokle devam ediyor ve neden az sayfa cikacagini sesli
  // sikayet ediyor.
  console.warn('[sitemap] ' + HUB_MANIFEST + ' bulunamadi — hub sayfalari sitemap\'e eklenmiyor, yalnizca kokle devam ediliyor.');
}

writeFileSync(`${PUB}/sitemap.xml`, sitemapXml);

console.log('public/ hazir: static, data, manifest.json, robots.txt, sitemap.xml, sw.js');
console.log('sitemap lastmod: ' + damga);
