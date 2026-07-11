// scripts/prepare-public.mjs
// build oncesi calisir: public/ klasorunu static/, data/, manifest.json, robots.txt, sitemap.xml'den olusturur.
// Bu dosyalarin GERCEK kaynagi hala repo kokunde (static/, data/) - burada sadece build icin GECICI bir kopya cikariliyor.
import { cpSync, mkdirSync, existsSync, rmSync, copyFileSync } from 'node:fs';

const PUB = 'public';
if (existsSync(PUB)) rmSync(PUB, { recursive: true, force: true });
mkdirSync(PUB, { recursive: true });

cpSync('static', `${PUB}/static`, { recursive: true });
cpSync('data', `${PUB}/data`, { recursive: true });
copyFileSync('manifest.json', `${PUB}/manifest.json`);
copyFileSync('robots.txt', `${PUB}/robots.txt`);
copyFileSync('sitemap.xml', `${PUB}/sitemap.xml`);
copyFileSync('sw.js', `${PUB}/sw.js`);

console.log('public/ hazir: static, data, manifest.json, robots.txt, sitemap.xml, sw.js');
