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
import { lastmodDamgasi, sitemapDoldur, sitemapEkle, manifestGirisleri } from './scripts/sitemap.mjs';

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

console.log('\n=== 5. HUB GIRDILERI (sitemapEkle) ===');
{
  // Fixture'lar elle kuruluyor — .hub/manifest.json OKUNMUYOR, boylece bu
  // test uretim kosusuna bagli olmuyor (hub-uret.mjs hic calismamis olsa
  // da bu bolum kirmizi/yesil calisir).
  const KOK_DAMGA = '2026-08-18T04:16:49Z';
  const KOK_DOLU = sitemapDoldur(KAYNAK, KOK_DAMGA);

  const GECMIS_AY_LASTMOD = '2026-07-31T00:00:00+03:00';
  const manifestOrnek = [
    { yol: '/zam/2026-05/', durum: 'atlandi', son_veri: null },
    { yol: '/zam/2026-06/', durum: 'atlandi', son_veri: null },
    { yol: '/zam/2026-07/', durum: 'uretildi', son_veri: GECMIS_AY_LASTMOD },
    { yol: '/zam/2026-08/', durum: 'uretildi', son_veri: '2026-08-18T00:00:00+03:00' },
    { yol: '/market/a101/', durum: 'uretildi', son_veri: '2026-08-18T00:00:00+03:00' },
    { yol: '/hal/', durum: 'uretildi', son_veri: '2026-08-17T00:00:00+03:00' },
  ];
  const uretilenler = manifestOrnek.filter((g) => g.durum === 'uretildi');
  const girisler = uretilenler.map((g) => ({ loc: 'https://pazarapp.net' + g.yol, lastmod: g.son_veri }));

  // -- saflik --
  const oncekiKok = KOK_DOLU;
  const c = sitemapEkle(KOK_DOLU, girisler);
  ok('sitemapEkle girdi xml\'i degistirmiyor (saf)', KOK_DOLU === oncekiKok, '');
  ok('  kok girdi (/) yerinde kaliyor', c.includes('<loc>https://pazarapp.net/</loc>'), '');
  ok('  kok girdinin lastmod\'u aynen duruyor',
    c.includes(`<url><loc>https://pazarapp.net/</loc><lastmod>${KOK_DAMGA}</lastmod><priority>1.0</priority></url>`), '');

  // -- sayim: 1 (kok) + uretildi sayisi; atlandi YOK --
  const urlSayisi = (c.match(/<url>/g) || []).length;
  ok('<url> sayisi = 1 (kok) + uretildi sayisi', urlSayisi === 1 + uretilenler.length,
    `urlSayisi=${urlSayisi} beklenen=${1 + uretilenler.length}`);
  ok('  atlandi olan /zam/2026-05/ sitemap\'te YOK', !c.includes('/zam/2026-05/'), '');
  ok('  atlandi olan /zam/2026-06/ sitemap\'te YOK', !c.includes('/zam/2026-06/'), '');
  ok('  uretildi olan /zam/2026-07/ sitemap\'te VAR', c.includes('/zam/2026-07/'), '');
  ok('  uretildi olan /hal/ sitemap\'te VAR', c.includes('/hal/'), '');

  // -- gecmis ay dondu kaniti --
  ok('gecmis ay sayfasinin lastmod\'u kok damgasindan FARKLI',
    GECMIS_AY_LASTMOD !== KOK_DAMGA, GECMIS_AY_LASTMOD + ' vs ' + KOK_DAMGA);
  ok('  gecmis ay lastmod\'u XML\'de aynen goruluyor',
    c.includes(`<loc>https://pazarapp.net/zam/2026-07/</loc><lastmod>${GECMIS_AY_LASTMOD}</lastmod>`), '');

  // -- iyi bicimli XML --
  const acilis = (c.match(/<url>/g) || []).length;
  const kapanis = (c.match(/<\/url>/g) || []).length;
  ok('<url> ve </url> sayilari esit', acilis === kapanis, `${acilis} vs ${kapanis}`);
  const locSayisi = (c.match(/<loc>/g) || []).length;
  const lastmodSayisi = (c.match(/<lastmod>/g) || []).length;
  ok('her blokta bir <loc>', locSayisi === urlSayisi, `${locSayisi} vs ${urlSayisi}`);
  ok('her blokta bir <lastmod>', lastmodSayisi === urlSayisi, `${lastmodSayisi} vs ${urlSayisi}`);
  ok('  urlset kapaniyor', c.trim().endsWith('</urlset>'), '');

  // -- dogrulama: throw senaryolari --
  ok('yinelenen loc -> throw', (() => {
    try { sitemapEkle(KOK_DOLU, [...girisler, girisler[0]]); return false; }
    catch (e) { return true; }
  })());
  ok('"/" ile bitmeyen loc -> throw', (() => {
    try { sitemapEkle(KOK_DOLU, [{ loc: 'https://pazarapp.net/zam/2026-07', lastmod: GECMIS_AY_LASTMOD }]); return false; }
    catch (e) { return true; }
  })());
  ok('mutlak olmayan loc -> throw', (() => {
    try { sitemapEkle(KOK_DOLU, [{ loc: '/zam/2026-07/', lastmod: GECMIS_AY_LASTMOD }]); return false; }
    catch (e) { return true; }
  })());
  ok('gecersiz lastmod -> throw', (() => {
    try { sitemapEkle(KOK_DOLU, [{ loc: 'https://pazarapp.net/zam/2026-07/', lastmod: 'yarin' }]); return false; }
    catch (e) { return true; }
  })());
  ok('</urlset> olmayan xml -> throw', (() => {
    try { sitemapEkle('<urlset><url><loc>https://pazarapp.net/</loc></url>', girisler); return false; }
    catch (e) { return true; }
  })());
  ok('  bos girisler xml\'i aynen birakir', sitemapEkle(KOK_DOLU, []) === KOK_DOLU, '');
}

console.log('\n=== 6. MANIFESTGIRISLERI: taninmayan durum sessizce dusmuyor ===');
{
  // KUSUR (dusen kayit yakalandi): bir manifest kaydinin `durum`'u
  // "uretildi"/"atlandi" DISINDA bir deger tasirsa (yazim hatasi, yeni
  // eklenmis ama burada henuz taninmayan bir durum degeri, vb.) eskiden
  // sessizce sitemapEkle'nin filtresinden dusuyordu; ozet satiri
  // "15 / 20" gibi payda TUM kayitlari saydigi icin bu hic gorunmuyordu.
  const KOTU_MANIFEST = [
    { yol: '/zam/2026-05/', durum: 'atlandi', son_veri: null },
    { yol: '/zam/2026-06/', durum: 'atlandi', son_veri: null },
    { yol: '/zam/2026-07/', durum: 'uretild', son_veri: '2026-07-31T00:00:00+03:00' }, // yazim hatasi
    { yol: '/zam/2026-08/', durum: 'uretildi', son_veri: '2026-08-18T00:00:00+03:00' },
    { yol: '/market/a101/', durum: 'uretildi', son_veri: '2026-08-18T00:00:00+03:00' },
    { yol: '/market/bim/', durum: 'beklemede', son_veri: null }, // taninmayan, farkli deger
  ];

  // -- console.warn'i gecici yakala --
  const eskiWarn = console.warn;
  const yakalanan = [];
  console.warn = (...args) => yakalanan.push(args.join(' '));
  let sonuc;
  try { sonuc = manifestGirisleri(KOTU_MANIFEST); }
  finally { console.warn = eskiWarn; }

  ok('taninmayan durum tasiyan kayit girisler\'e GIRMEDI',
    !sonuc.girisler.some((g) => g.loc.includes('/zam/2026-07/') || g.loc.includes('/market/bim/')), '');
  ok('  taninmayan sayaci dogru (2)', sonuc.taninmayan === 2, String(sonuc.taninmayan));
  ok('  uretildi sayaci dogru (2)', sonuc.uretildi === 2, String(sonuc.uretildi));
  ok('  atlandi sayaci dogru (2)', sonuc.atlandi === 2, String(sonuc.atlandi));
  ok('  gecerli uretildi kayitlar girislerde VAR',
    sonuc.girisler.some((g) => g.loc.includes('/zam/2026-08/')) &&
    sonuc.girisler.some((g) => g.loc.includes('/market/a101/')), '');

  ok('taninmayan durum GORUNUR UYARI ureriyor (console.warn cagrildi)', yakalanan.length === 1,
    'yakalanan=' + JSON.stringify(yakalanan));
  ok('  uyari mesaji kayit sayisini ve taninmayan deger(ler)i iceriyor',
    yakalanan.length === 1 && /2 kayitta/.test(yakalanan[0]) &&
    yakalanan[0].includes('"uretild"') && yakalanan[0].includes('"beklemede"'), yakalanan[0] || '');
  ok('  uyari sitemap\'e ALINMADI diyor', yakalanan.length === 1 && /ALINMADI/.test(yakalanan[0]), yakalanan[0] || '');

  console.log('\n=== 6b. MANIFESTGIRISLERI: atlandi kayitlar UYARI URETMIYOR (yanlis alarm yok) ===');
  const eskiWarn2 = console.warn;
  const yakalanan2 = [];
  console.warn = (...args) => yakalanan2.push(args.join(' '));
  let sonuc2;
  try {
    sonuc2 = manifestGirisleri([
      { yol: '/zam/2026-05/', durum: 'atlandi', son_veri: null },
      { yol: '/zam/2026-06/', durum: 'atlandi', son_veri: null },
    ]);
  } finally { console.warn = eskiWarn2; }
  ok('sadece atlandi kayitlarda uyari YOK', yakalanan2.length === 0, JSON.stringify(yakalanan2));
  ok('  girisler bos', sonuc2.girisler.length === 0, '');
  ok('  atlandi sayaci dogru (2)', sonuc2.atlandi === 2, '');
  ok('  taninmayan sayaci 0', sonuc2.taninmayan === 0, '');

  console.log('\n=== 6c. MANIFESTGIRISLERI: saglam manifestte uc kova dogru sayiliyor ===');
  const eskiWarn3 = console.warn;
  const yakalanan3 = [];
  console.warn = (...args) => yakalanan3.push(args.join(' '));
  let sonuc3;
  try {
    sonuc3 = manifestGirisleri([
      { yol: '/zam/2026-05/', durum: 'atlandi', son_veri: null },
      { yol: '/zam/2026-06/', durum: 'atlandi', son_veri: null },
      { yol: '/zam/2026-07/', durum: 'uretildi', son_veri: '2026-07-31T00:00:00+03:00' },
      { yol: '/zam/2026-08/', durum: 'uretildi', son_veri: '2026-08-18T00:00:00+03:00' },
      { yol: '/hal/', durum: 'uretildi', son_veri: '2026-08-17T00:00:00+03:00' },
    ]);
  } finally { console.warn = eskiWarn3; }
  ok('saglam manifette taninmayan uretmiyor', yakalanan3.length === 0, JSON.stringify(yakalanan3));
  ok('  uretildi=3, atlandi=2, taninmayan=0',
    sonuc3.uretildi === 3 && sonuc3.atlandi === 2 && sonuc3.taninmayan === 0,
    JSON.stringify(sonuc3));
  ok('  girisler.length === uretildi', sonuc3.girisler.length === sonuc3.uretildi, '');
}

console.log('\n=== 7. BUILD BUNU KULLANIYOR ===');
{
  const pp = fs.readFileSync('scripts/prepare-public.mjs', 'utf8');
  ok('prepare-public sitemap.mjs\'i cagiriyor', /from '\.\/sitemap\.mjs'/.test(pp), '');
  ok('  lastmodDamgasi ve sitemapDoldur kullaniliyor',
    /lastmodDamgasi/.test(pp) && /sitemapDoldur/.test(pp), '');
  ok('  sitemap artik duz copyFileSync ile KOPYALANMIYOR', !/copyFileSync\('sitemap\.xml'/.test(pp), '');
  ok('  anasayfa.json okunuyor', /anasayfa\.json/.test(pp), '');
  ok('  sitemapEkle .hub/manifest.json ile baglaniyor',
    /sitemapEkle/.test(pp) && /\.hub\/manifest\.json/.test(pp), '');
  ok('  manifestGirisleri kullaniliyor (kova sayimi + taninmayan uyarisi)',
    /manifestGirisleri/.test(pp), '');
  ok('  ozet satiri kirilimli (uretildi/atlandi/taninmayan)',
    /uretildi.*atlandi.*taninmayan/.test(pp), '');
  ok('build zinciri prepare-public\'i cagiriyor',
    /prepare-public\.mjs/.test(JSON.parse(fs.readFileSync('package.json', 'utf8')).scripts.build), '');
}

console.log('\n=== 8. BUILD CIKTISI (varsa) ===');
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
