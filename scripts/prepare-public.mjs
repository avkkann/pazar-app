// scripts/prepare-public.mjs
// build oncesi calisir: public/ klasorunu static/, data/, manifest.json, robots.txt, sitemap.xml'den olusturur.
// Bu dosyalarin GERCEK kaynagi hala repo kokunde (static/, data/) - burada sadece build icin GECICI bir kopya cikariliyor.
import { cpSync, mkdirSync, existsSync, rmSync, copyFileSync, writeFileSync } from 'node:fs';

const PUB = 'public';
if (existsSync(PUB)) rmSync(PUB, { recursive: true, force: true });
mkdirSync(PUB, { recursive: true });

cpSync('static', `${PUB}/static`, { recursive: true });
cpSync('data', `${PUB}/data`, { recursive: true });
copyFileSync('manifest.json', `${PUB}/manifest.json`);
copyFileSync('robots.txt', `${PUB}/robots.txt`);
copyFileSync('sitemap.xml', `${PUB}/sitemap.xml`);
copyFileSync('sw.js', `${PUB}/sw.js`);

const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://gc.zgo.at",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://api.fontshare.com",
  "font-src https://fonts.gstatic.com https://api.fontshare.com",
  "img-src 'self' data: https://cdn.marketfiyati.org.tr",
  "connect-src 'self' https://gbgxxahhbfnulmyecxia.supabase.co https://api.marketfiyati.org.tr https://pazar-app.goatcounter.com",
  "manifest-src 'self'",
  "base-uri 'self'",
  "form-action 'self'"
].join('; ');

writeFileSync(`${PUB}/_headers`, `/*\n  Content-Security-Policy: ${CSP}\n`);

console.log('public/ hazir: static, data, manifest.json, robots.txt, sitemap.xml, sw.js');
