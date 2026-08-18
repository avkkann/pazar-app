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

// ── GECICI OLCUM BLOGU — GOREV 0, OLCUMDEN SONRA GERI ALINACAK ─────────
// Soru: Cloudflare Workers statik varliklarinda /zam/test-olcum/ gibi bir
// DIZIN istegi zam/test-olcum/index.html'e dusuyor mu? wrangler.jsonc'ta
// html_handling YAZILI DEGIL (yalnizca not_found_handling: "none"), yani
// varsayilan gecerli ve varsayilanin ne oldugu HIC OLCULMEDI. Yanlissa
// planlanan 19 hub sayfasinin hepsi 404 olur. Dokumana degil olcume bakiliyor.
mkdirSync(`${PUB}/zam/test-olcum`, { recursive: true });
writeFileSync(`${PUB}/zam/test-olcum/index.html`,
  '<!doctype html><html lang="tr"><head><meta charset="utf-8">' +
  '<title>Olcum</title></head><body><h1>OLCUM-TAMAM</h1></body></html>');
// ── /GECICI OLCUM BLOGU ────────────────────────────────────────────────

console.log('public/ hazir: static, data, manifest.json, robots.txt, sitemap.xml, sw.js');
console.log('sitemap lastmod: ' + damga);
