// SITEMAP LASTMOD. Denetim: proje sitemap'inde lastmod HIC yoktu.
//
// TARIH KAYNAGI: data/anasayfa.json'daki "uretim" alani. Sebebi:
//   - her veri kosusunda anasayfa-uret.mjs tarafindan yeniden yaziliyor,
//     yani "site ne zaman guncellendi" sorusunun dogru cevabi.
//   - ICERIKTEN geliyor, dosya mtime'indan degil: CI'da git checkout tum
//     mtime'lari checkout anina cekiyor, mtime guvenilmez.
//   - Tam ISO damgasi AYNEN kullaniliyor (sadece milisaniye kirpiliyor).
//     Gun sinirina hic dokunulmuyor: bu projede toISOString().slice(0,10)
//     tipi kesme uc kez yerel-gun hatasina yol acti. W3C Datetime tam
//     damgayi kabul ediyor, boylece saat dilimi varsayimi da gerekmiyor.
//
// KAPSAM NOTU: burada duzeltilen SADECE bu deponun sitemap'i. Eski kokteki
// avkkann.github.io/sitemap.xml BASKA bir depoda ve pazarapp.net gecisinden
// sonra bu proje icin ANLAMSIZ — Google artik pazarapp.net/robots.txt'i
// okuyacak. O dosya bu depodan uretiliyor.
import fs from 'fs';
import { lastmodDamgasi, sitemapDoldur } from './scripts/sitemap.mjs';

let pass = 0, fail = 0;
const ok = (ad, k, d = '') => { if (k) { pass++; console.log('  PASS  ' + ad); } else { fail++; console.log('  FAIL  ' + ad + (d ? '  -> ' + d : '')); } };

const W3C = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2}))?$/;

console.log('\n=== 1. KAYNAKTA ELLE YAZILMIS TARIH YOK ===');
const KAYNAK = fs.readFileSync('sitemap.xml', 'utf8');
console.log(KAYNAK.trim().split('\n').map(l => '    ' + l).join('\n'));
ok('sitemap.xml\'de sabit tarih YOK', !/\d{4}-\d{2}-\d{2}/.test(KAYNAK),
  (KAYNAK.match(/\d{4}-\d{2}-\d{2}/g) || []).join(' '));
ok('  yer tutucu __LASTMOD__ var', KAYNAK.includes('__LASTMOD__'));
ok('  <lastmod> etiketi var', /<lastmod>/.test(KAYNAK));
ok('  tek <url> ve dogru adres', (KAYNAK.match(/<url>/g) || []).length === 1
  && KAYNAK.includes('https://pazarapp.net/'), '');
ok('  urlset ad alani dogru', KAYNAK.includes('http://www.sitemaps.org/schemas/sitemap/0.9'));

console.log('\n=== 2. lastmodDamgasi: ICERIKTEN okuyor ===');
{
  ok('uretim alanini kullaniyor', lastmodDamgasi({ uretim: '2026-08-17T04:16:49.878Z' }) === '2026-08-17T04:16:49Z',
    lastmodDamgasi({ uretim: '2026-08-17T04:16:49.878Z' }));
  ok('  milisaniye kirpildi, gun sinirina DOKUNULMADI',
    lastmodDamgasi({ uretim: '2026-08-17T23:59:59.999Z' }) === '2026-08-17T23:59:59Z',
    lastmodDamgasi({ uretim: '2026-08-17T23:59:59.999Z' }));
  ok('  milisaniyesiz damga da gecerli',
    lastmodDamgasi({ uretim: '2026-08-17T04:16:49Z' }) === '2026-08-17T04:16:49Z');
  ok('  W3C Datetime bicimine uyuyor', W3C.test(lastmodDamgasi({ uretim: '2026-08-17T04:16:49.878Z' })));
  // yedek yol: alan yoksa/bozuksa build KIRILMASIN
  for (const kotu of [null, undefined, {}, { uretim: '' }, { uretim: 'saçma' }, { uretim: 123 }]) {
    const r = lastmodDamgasi(kotu);
    if (!W3C.test(r)) { ok('  bozuk girdi yedege dusuyor: ' + JSON.stringify(kotu), false, r); break; }
  }
  ok('bozuk/eksik girdide gecerli yedek damga uretiyor',
    [null, undefined, {}, { uretim: '' }, { uretim: 'saçma' }, { uretim: 123 }].every(k => W3C.test(lastmodDamgasi(k))),
    JSON.stringify([null, {}, { uretim: 'saçma' }].map(lastmodDamgasi)));
}

console.log('\n=== 3. sitemapDoldur: yer tutucuyu degistiriyor ===');
{
  const c = sitemapDoldur(KAYNAK, '2026-08-17T04:16:49Z');
  ok('yer tutucu KALMADI', !c.includes('__LASTMOD__'));
  ok('  damga yerine gecti', c.includes('<lastmod>2026-08-17T04:16:49Z</lastmod>'),
    (c.match(/<lastmod>[^<]*<\/lastmod>/) || [''])[0]);
  ok('  geri kalan XML aynen duruyor',
    c.replace(/<lastmod>[^<]*<\/lastmod>/, '<lastmod>__LASTMOD__</lastmod>') === KAYNAK, '');
  ok('gecersiz damga reddediliyor (sessizce bozuk XML yazmiyor)',
    (() => { try { sitemapDoldur(KAYNAK, 'bugun'); return false; } catch (e) { return true; } })());
}

console.log('\n=== 4. GERCEK VERIYLE UCTAN UCA ===');
{
  const anasayfa = JSON.parse(fs.readFileSync('data/anasayfa.json', 'utf8'));
  const damga = lastmodDamgasi(anasayfa);
  console.log('    data/anasayfa.json uretim = ' + anasayfa.uretim);
  console.log('    uretilen lastmod          = ' + damga);
  ok('gercek uretim damgasindan gecerli lastmod cikiyor', W3C.test(damga), damga);
  ok('  anasayfa.json\'un damgasiyla ayni gun', damga.slice(0, 10) === String(anasayfa.uretim).slice(0, 10),
    damga + ' vs ' + anasayfa.uretim);
  const c = sitemapDoldur(KAYNAK, damga);
  ok('  cikan XML tam', /<\?xml/.test(c) && /<\/urlset>/.test(c) && !c.includes('__LASTMOD__'));
}

console.log('\n=== 5. BUILD BUNU KULLANIYOR ===');
{
  const pp = fs.readFileSync('scripts/prepare-public.mjs', 'utf8');
  ok('prepare-public sitemap.mjs\'i cagiriyor', /from '\.\/sitemap\.mjs'/.test(pp), '');
  ok('  lastmodDamgasi ve sitemapDoldur kullaniliyor',
    /lastmodDamgasi/.test(pp) && /sitemapDoldur/.test(pp), '');
  ok('  sitemap artik duz copyFileSync ile KOPYALANMIYOR', !/copyFileSync\('sitemap\.xml'/.test(pp), '');
  ok('  anasayfa.json okunuyor', /anasayfa\.json/.test(pp), '');
  ok('build zinciri prepare-public\'i cagiriyor',
    /prepare-public\.mjs/.test(JSON.parse(fs.readFileSync('package.json', 'utf8')).scripts.build), '');
}

console.log('\n=== 6. BUILD CIKTISI (varsa) ===');
if (fs.existsSync('public/sitemap.xml')) {
  const c = fs.readFileSync('public/sitemap.xml', 'utf8');
  const d = (c.match(/<lastmod>([^<]*)<\/lastmod>/) || [])[1];
  console.log('    public/sitemap.xml lastmod = ' + d);
  ok('public/sitemap.xml\'de yer tutucu yok', !c.includes('__LASTMOD__'), c);
  ok('  gecerli W3C damgasi', W3C.test(d || ''), String(d));
} else {
  console.log('    public/ yok (build kosulmamis) — atlaniyor');
}

console.log('\nPASS=' + pass + '  FAIL=' + fail);
process.exit(fail ? 1 : 0);
