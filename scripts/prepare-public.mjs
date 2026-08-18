// scripts/prepare-public.mjs
// build oncesi calisir: public/ klasorunu static/, data/, manifest.json, robots.txt, sitemap.xml'den olusturur.
// Bu dosyalarin GERCEK kaynagi hala repo kokunde (static/, data/) - burada sadece build icin GECICI bir kopya cikariliyor.
import { cpSync, mkdirSync, existsSync, rmSync, copyFileSync, readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { lastmodDamgasi, sitemapDoldur, sitemapEkle, manifestGirisleri } from './sitemap.mjs';

const PUB = 'public';
if (existsSync(PUB)) rmSync(PUB, { recursive: true, force: true });
mkdirSync(PUB, { recursive: true });

cpSync('static', `${PUB}/static`, { recursive: true });
cpSync('data', `${PUB}/data`, { recursive: true });
copyFileSync('manifest.json', `${PUB}/manifest.json`);
copyFileSync('robots.txt', `${PUB}/robots.txt`);
copyFileSync('sw.js', `${PUB}/sw.js`);

// Hub sayfalari (.hub/, Gorev 4: scripts/hub-uret.mjs) public/'e kopyalanir.
// Sayfa dizinleri (hal/, kategori/, market/, zam/) static/data/manifest.json
// ile AYNI SEVIYEDE, public/ kokune duzlenir -- boylece Vite publicDir'i
// oldugu gibi dist/'e tasiyinca sayfalar dist/zam/2026-08/index.html,
// dist/market/bim/index.html ... olarak cikar.
//
// .hub/manifest.json BILEREK KOPYALANMIYOR: yayina gitmesi gereken bir
// dosya degil, ic kayit (asagida sitemap icin OKUNUYOR ama public/'e
// YAZILMIYOR). Ayrica public/manifest.json birazcik yukarida zaten
// uygulamanin PWA manifest'i icin ayrildi -- ayni isimde iki farkli
// icerikli dosya CAKISIRDI, biri digerini sessizce ezerdi.
const HUB_DIR = '.hub';
if (existsSync(HUB_DIR)) {
  let hubKopyalanan = 0;
  for (const giris of readdirSync(HUB_DIR, { withFileTypes: true })) {
    if (giris.name === 'manifest.json' || !giris.isDirectory()) continue;
    cpSync(`${HUB_DIR}/${giris.name}`, `${PUB}/${giris.name}`, { recursive: true });
    hubKopyalanan++;
  }
  console.log(`[hub] ${hubKopyalanan} hub dizini public/'e kopyalandi (${HUB_DIR} -> ${PUB})`);
} else {
  // hub-uret.mjs hic kosmamis olabilir (Gorev 4). Mevcut sitemap uyarisiyla
  // tutarli: build KIRILMIYOR, sadece gorunur bir uyari basiliyor. Asil
  // kapi Gorev 6/7'deki veri_tazelik_kontrol.py --hub.
  console.warn('[hub] ' + HUB_DIR + ' bulunamadi — hub sayfalari public/\'e kopyalanmiyor (scripts/hub-uret.mjs kosmamis olabilir).');
}

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
//
// Taninmayan bir `durum` (ne "uretildi" ne "atlandi") ONCEDEN sessizce
// dusuyordu: ozet satiri "15 / 20 (durum=uretildi)" gibi payda TUM
// kayitlari sayiyordu, beklenen 18 hic gorunmuyordu, ve tek uyari yalnizca
// manifest dosyasinin kendisi eksikse basiliyordu. Kova sayimi ve uyari
// artik manifestGirisleri()'nde (bkz. scripts/sitemap.mjs): taninmayan
// durum VARSA console.warn ile GORUNUR olur. Bu, tazelik kapisini
// GUCLENDIRMIYOR — build hala KIRILMIYOR (asil kapi Gorev 6'daki
// veri_tazelik_kontrol.py --hub), sadece artik sessiz kalmiyor.
const HUB_MANIFEST = '.hub/manifest.json';
if (existsSync(HUB_MANIFEST)) {
  let hubManifest = [];
  try { hubManifest = JSON.parse(readFileSync(HUB_MANIFEST, 'utf8')); }
  catch (e) { console.warn('[sitemap] ' + HUB_MANIFEST + ' okunamadi/ayristirilamadi: ' + e.message); }
  const { girisler, uretildi, atlandi, taninmayan } = manifestGirisleri(hubManifest);
  sitemapXml = sitemapEkle(sitemapXml, girisler);
  console.log(`[sitemap] hub: ${uretildi} uretildi, ${atlandi} atlandi, ${taninmayan} taninmayan — ${girisler.length} girdi eklendi`);
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
