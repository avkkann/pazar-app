// scripts/prepare-public.mjs
// build oncesi calisir: public/ klasorunu static/, data/, manifest.json, robots.txt, sitemap.xml'den olusturur.
// Bu dosyalarin GERCEK kaynagi hala repo kokunde (static/, data/) - burada sadece build icin GECICI bir kopya cikariliyor.
import { cpSync, mkdirSync, existsSync, rmSync, copyFileSync, readFileSync, writeFileSync } from 'node:fs';
import { lastmodDamgasi, sitemapDoldur } from './sitemap.mjs';

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
writeFileSync(`${PUB}/sitemap.xml`, sitemapDoldur(readFileSync('sitemap.xml', 'utf8'), damga));

console.log('public/ hazir: static, data, manifest.json, robots.txt, sitemap.xml, sw.js');
console.log('sitemap lastmod: ' + damga);
