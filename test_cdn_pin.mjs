// B5 (CDN tedarik zinciri) koruma testi — 1. asama: surum pinleme + butunluk.
// CDN'den <script src> ile yuklenen SDK KAYAN surume (@2, @latest, @next)
// donerse ya da integrity dusserse KIRMIZIYA doner. Boylece bir sonraki
// bagimlilik yukseltmesi/geri-alma sessizce tedarik zinciri riskini geri
// getiremez. Kullanim: node test_cdn_pin.mjs
import fs from 'fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const HTML = fs.readFileSync('index.html', 'utf8');
const CSS = fs.readFileSync('style.css', 'utf8');
const WORKER = fs.readFileSync('src/worker.js', 'utf8');
let pass = 0, fail = 0;
const ok = (ad, k, d = '') => { if (k) { pass++; console.log('  PASS  ' + ad); } else { fail++; console.log('  FAIL  ' + ad + (d ? '  -> ' + d : '')); } };

console.log('\n=== SUPABASE SDK: tam surume pinli + SRI ===');
{
  // Supabase SDK'yi yukleyen <script> etiketini bul
  const tag = (HTML.match(/<script\b[^>]*supabase-js@[^>]*><\/script>/) || [])[0] || '';
  ok('supabase-js <script> etiketi bulundu', !!tag, HTML.slice(0, 120));

  // src icindeki surum ifadesi: supabase-js@<SURUM> ... " ' ya da bosluga kadar
  const surum = (tag.match(/supabase-js@([^"'\s]+)/) || [])[1] || '';
  // TAM semver (X.Y.Z) sart. @2, @2.x, @latest, @next -> KIRMIZI.
  ok(`  surum TAM pinli (X.Y.Z), kayan degil  [gelen: "${surum}"]`,
     /^\d+\.\d+\.\d+$/.test(surum), surum);

  // integrity=sha384-... ve crossorigin ayni etikette
  ok('  integrity="sha384-..." mevcut',
     /integrity="sha384-[A-Za-z0-9+/=]+"/.test(tag), tag.slice(0, 200));
  ok('  crossorigin mevcut (SRI icin sart)',
     /\bcrossorigin\b/.test(tag), tag.slice(0, 200));
}

console.log('\n=== GENEL: jsdelivr npm <script> KAYAN surum tasimasin ===');
{
  // Tum <script src=...jsdelivr.net/npm/...> etiketlerini topla; her birinde
  // paket adindan sonraki surum ifadesi TAM semver olmali.
  const betikler = HTML.match(/<script\b[^>]*src="[^"]*cdn\.jsdelivr\.net\/npm\/[^"]*"[^>]*>/g) || [];
  ok('jsdelivr npm <script> sayisi >= 1 (kapsam var)', betikler.length >= 1, String(betikler.length));
  for (const b of betikler) {
    const src = (b.match(/src="([^"]+)"/) || [])[1] || '';
    // .../npm/<paket>@<surum>/...  — surum X.Y.Z olmali; @latest/@next/@<major> KIRMIZI
    const s = (src.match(/\/npm\/(?:@[^/]+\/)?[^@/]+@([^/"']+)/) || [])[1] || '';
    ok(`  pinli: ${src.slice(0, 70)}  [surum: "${s}"]`,
       /^\d+\.\d+\.\d+$/.test(s), src);
  }
}

console.log('\n=== GOATCOUNTER: ucuncu-taraf JS surumlu + SRI ===');
{
  // GoatCounter script'ini bul (gc.zgo.at)
  const tag = (HTML.match(/<script\b[^>]*gc\.zgo\.at[^>]*><\/script>/) || [])[0] || '';
  ok('GoatCounter <script> bulundu', !!tag, '');
  // Kayan count.js DEGIL, surumlu count.vN.js olmali (frozen -> SRI stabil)
  const src = (tag.match(/src="([^"]+)"/) || [])[1] || '';
  ok(`  surumlu count.vN.js (kayan count.js degil)  [src: ${src.slice(0, 60)}]`,
     /gc\.zgo\.at\/count\.v\d+\.js/.test(src) && !/\/count\.js/.test(src), src);
  ok('  integrity="sha384-..." mevcut',
     /integrity="sha384-[A-Za-z0-9+/=]+"/.test(tag), tag.slice(0, 160));
  ok('  crossorigin mevcut (SRI icin sart)',
     /\bcrossorigin\b/.test(tag), tag.slice(0, 160));
  // protokol-goreli // birakilmamis (https:// acik)
  ok('  https:// acik (protokol-goreli // degil)',
     /src="https:\/\/gc\.zgo\.at/.test(tag), src);
}

console.log('\n=== FONTLAR SELF-HOST: dis font host referansi OLMAMALI ===');
{
  // Google Fonts + Fontshare kaldirildi (2026-08-21). Biri geri eklerse (link,
  // preconnect, dns-prefetch, @import, preload) bu test KIRMIZI olur.
  for (const host of ['fonts.googleapis.com', 'fonts.gstatic.com', 'api.fontshare.com', 'cdn.fontshare.com']) {
    const hit = HTML.includes(host);
    ok(`index.html'de ${host} YOK`, !hit, hit ? `hala referans var: ${host}` : '');
  }
  // Self-host font en az bir @font-face ile style.css'te tanimli olmali (yerine kondu mu)
  ok('style.css self-host @font-face (static/fonts) iceriyor',
     /@font-face[\s\S]*?url\(['"]?\/static\/fonts\//.test(CSS), '');
  // inter-latin preload var (olculmus fayda)
  ok('inter-latin.woff2 preload edilmis (crossorigin ile)',
     /<link[^>]*rel="preload"[^>]*inter-latin\.woff2[^>]*crossorigin/.test(HTML) ||
     /<link[^>]*inter-latin\.woff2[^>]*rel="preload"/.test(HTML), '');
}

console.log('\n=== HSTS: kademeli rollout 2. basamak (max-age=86400 = 1 gun, baska HICBIR SEY) ===');
{
  // worker.js'te Strict-Transport-Security baslik degerini cek.
  const hsts = (WORKER.match(/Strict-Transport-Security['"]\s*,\s*['"]([^'"]*)['"]/) || [])[1];
  ok('HSTS basligi worker.js\'te set ediliyor', hsts !== undefined, 'set satiri yok');
  // 2. BASAMAK: 300 (5 dk) -> 86400 (1 gun). Basamak degeri BU SATIRDA tek yerde;
  // bir sonraki basamakta (1 hafta) yalniz burasi ve worker.js degisir.
  ok(`  max-age=86400  [gelen: "${hsts}"]`, /(^|[;\s])max-age=86400\b/.test(hsts || ''), String(hsts));
  // ERKEN KILITLENME EMNIYETI: bu iki deger su asamada OLMAMALI. Biri (ileride
  // yanlislikla) eklenirse test KIRMIZI -> subdomain/preload kaynakli kalici
  // erisim kaybi yayina gitmeden yakalanir. Kademeli plan bilincli.
  ok('  includeSubDomains YOK (kademeli — henuz degil)',
     !/includeSubDomains/i.test(hsts || ''), String(hsts));
  ok('  preload YOK (asla acele — preload listesi aylarca geri alinamaz)',
     !/preload/i.test(hsts || ''), String(hsts));
}

console.log('\n=== CSP DAVRANISI: worker GERCEKTEN kosturulup URETTIGI baslik olculuyor ===');
{
  // KAYNAK GREP DEGIL. worker'in default.fetch'i sahte bir ASSETS ile CALISTIRILIP
  // gonderdigi Content-Security-Policy basligi okunuyor. CSP nasil kurulursa
  // kurulsun (dizi, birlestirme, kosul) iddia SON CIKTIYA bakar.
  // (Onceki turda tam bu kor noktaya dusmustuk: kaynakta desen aramak, dallardan
  //  biri degisince yesil kalabiliyor.)
  const mod = await import(pathToFileURL(path.resolve('src/worker.js')).href);
  const res = await mod.default.fetch(new Request('https://pazarapp.net/'), {
    ASSETS: { fetch: async () => new Response('ok', { status: 200, headers: { 'content-type': 'text/html' } }) },
  });
  const csp = res.headers.get('content-security-policy') || '';
  ok('worker gercek bir CSP basligi uretiyor', csp.length > 0, '(baslik bos)');

  // Direktif -> kaynak listesi
  const dir = {};
  for (const parca of csp.split(';')) {
    const t = parca.trim().split(/\s+/).filter(Boolean);
    if (t[0]) dir[t[0]] = t.slice(1);
  }
  const ORIGIN = 'https://pazarapp.net';
  // "Bu URL bu direktifce izinli mi": 'self' ayni origin, https://host tam eslesme,
  // data: sema eslesmesi. Joker kullanilmiyor -> bilerek desteklenmiyor.
  const izinli = (direktif, url) => {
    const kaynaklar = dir[direktif] || dir['default-src'] || [];
    if (url.startsWith('data:')) return kaynaklar.includes('data:');
    const u = new URL(url);
    return kaynaklar.some(k => (k === "'self'" && u.origin === ORIGIN) || k === u.origin);
  };
  // Host HERHANGI bir direktifte gecmemeli (geri gelirse nereye eklenirse eklensin yakalanir).
  const hicbirDirektifte = (host) => !Object.values(dir).some(ks => ks.some(k => k.includes(host)));
  // Kirmizida tum CSP'yi basmak yerine SUCLU direktifi goster.
  const nerelerde = (host) => Object.entries(dir).filter(([, ks]) => ks.some(k => k.includes(host))).map(([d]) => d).join(',');

  // --- 'unsafe-inline' DIREKTIF BAZINDA (2026-08-23) ---
  // style-src: satir ici stiller CSS siniflarina tasindi -> 'unsafe-inline' KALKTI.
  //   Geri gelirse KIRMIZI: gocun sessizce geri alinmasini engeller.
  // script-src: 'unsafe-inline' BILEREK DURUYOR (satir ici olay ozniteligi gocu
  //   ertelendi). Buradaki iddia "duruyor mu" diye bakar -> biri onu habersiz
  //   kaldirirsa (117 handler olur) yine KIRMIZI olur. Iki yonlu kilit.
  ok('  style-src: \'unsafe-inline\' YOK (satir ici stiller tasindi)',
     !(dir['style-src'] || []).includes("'unsafe-inline'"), (dir['style-src'] || []).join(' '));
  ok('  script-src: \'unsafe-inline\' HALA VAR (handler gocu bilincli ertelendi)',
     (dir['script-src'] || []).includes("'unsafe-inline'"), (dir['script-src'] || []).join(' '));

  // --- SILINEN HOST'LAR: self-host sonrasi hicbir isteğe cikilmiyor (2026-08-22
  //     canli olcumu: dis font host'una 0 istek, 4 woff2 de pazarapp.net'ten).
  //     Biri CSP'ye GERI GELIRSE bu blok KIRMIZI olur.
  const SILINEN = [
    ['https://fonts.googleapis.com/css2?family=Inter', 'fonts.googleapis.com'],
    ['https://fonts.gstatic.com/s/inter/x.woff2',      'fonts.gstatic.com'],
    ['https://api.fontshare.com/v2/css?f[]=cabinet',   'api.fontshare.com'],
    ['https://cdn.fontshare.com/wf/x.woff2',           'cdn.fontshare.com'],
  ];
  for (const [ornekUrl, host] of SILINEN) {
    ok(`  SILINDI: ${host} hicbir direktifte YOK`, hicbirDirektifte(host), `hala su direktifte: ${nerelerde(host)}`);
    // Davranissal: o host'a giden ornek bir URL style-src/font-src/script-src'nin
    // HICBIRINDE izinli olmamali.
    const nerede = ['style-src', 'font-src', 'script-src', 'img-src', 'connect-src'].filter(d => izinli(d, ornekUrl));
    ok(`    ...ve ornek URL hicbir direktifce IZINLI degil  [${host}]`, nerede.length === 0, nerede.join(','));
  }

  // --- KALAN HOST'LAR: her biri GERCEKTEN kullaniliyor (2026-08-22'de calisma
  //     aninda olculdu). Yanlislikla silinirse bu blok KIRMIZI olur.
  const KALAN = [
    ['script-src',  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.112.3', 'Supabase SDK (1 istek olculdu)'],
    ['script-src',  'https://gc.zgo.at/count.v5.js',                              'GoatCounter (1 istek olculdu)'],
    ['connect-src', 'https://gbgxxahhbfnulmyecxia.supabase.co/rest/v1/urunler',   'Supabase (15 istek olculdu)'],
    ['connect-src', 'https://api.marketfiyati.org.tr/api/v2/search',              'canli arama butonu (tiklanip olculdu)'],
    ['connect-src', 'https://pazar-app.goatcounter.com/count',                    'GoatCounter beacon'],
    ['img-src',     'https://cdn.marketfiyati.org.tr/a101/19000886.jpg',          'urun gorselleri (olculdu)'],
    ['img-src',     'https://lh3.googleusercontent.com/a/x',                      'Google avatar (kosullu: girisli kullanici)'],
    ['img-src',     'https://pazar-app.goatcounter.com/count',                    'GoatCounter img fallback'],
    ['font-src',    'https://pazarapp.net/static/fonts/inter-latin.woff2',        'self-host font'],
    ['img-src',     'data:image/png;base64,AA',                                   'data: gorseller'],
  ];
  for (const [direktif, url, neden] of KALAN) {
    ok(`  KALDI: ${direktif} izin veriyor  [${neden}]`, izinli(direktif, url), `${direktif}: ${(dir[direktif]||[]).join(' ')}`);
  }

  // Kilit direktifler yerinde mi (daraltma sirasinda kazara dusmesin)
  for (const d of ['default-src', 'base-uri', 'form-action', 'frame-ancestors', 'manifest-src'])
    ok(`  ${d} hala tanimli`, Array.isArray(dir[d]), Object.keys(dir).join(','));
}

console.log('\n=== ONBELLEK BASLIGI: damgali varliklar IMMUTABLE, degisenler DEGIL ===');
{
  // KUSUR (denetim, yuksek): Cloudflare varlik katmani HER dosyaya
  // "public, max-age=0, must-revalidate" veriyordu. OLCULDU (canli, sunucu
  // tarafli): /app.0ed6c6ce.js ve /assets/index-DxpkFUHq.css ikisi de o basligi
  // aliyordu -- adi ICERIGIN hash'i olan, tanimi geregi degismeyecek iki dosya
  // icin her acilista ag turu. CSS render'i bloklayan bir kaynak oldugundan
  // tur dogrudan ilk boyamayi geciktiriyor.
  //
  // KAYNAK GREP DEGIL: worker gercekten kosturulup URETTIGI baslik okunuyor.
  const mod = await import(pathToFileURL(path.resolve('src/worker.js')).href);
  const cc = async (yol, durum = 200) => {
    const res = await mod.default.fetch(new Request('https://pazarapp.net' + yol), {
      ASSETS: { fetch: async () => new Response(durum === 304 ? null : 'ok', {
        status: durum,
        headers: { 'cache-control': 'public, max-age=0, must-revalidate' } }) }
    });
    return res.headers.get('cache-control') || '';
  };

  // ALET KONTROLU: worker dokunmadiginda ORIJIN basligi gercekten geciyor mu?
  // Bu gecmezse asagidaki "immutable DEGIL" iddialari bos yere yesil kalirdi.
  ok('KONTROL: dokunulmayan yolda orijin basligi goruluyor',
     (await cc('/index.html')).includes('must-revalidate'), await cc('/index.html'));

  const DAMGALI = [
    ['/app.0ed6c6ce.js',              'vite.config.js hashClassicScript -> app.<sha256[0:8]>.js'],
    ['/assets/index-B01cmNb3.css',    'Vite assets/<ad>-<hash>.css'],
    ['/assets/index-DxpkFUHq.css',    'canlidaki gercek ad'],
  ];
  for (const [yol, neden] of DAMGALI) {
    const v = await cc(yol);
    ok(`damgali IMMUTABLE: ${yol}  [${neden}]`, /immutable/.test(v) && /max-age=31536000/.test(v), v);
  }

  // Bunlar AYNI AD altinda icerik degistiriyor -> uzun omur BAYAT VERI demek.
  // data/*.json her gece degisiyor; sw.js sürüm atlayinca kullaniciya hic
  // ulasmaz; index.html damgali dosyalara giden tek yol.
  const DEGISEN = [
    ['/',                             'giris sayfasi'],
    ['/index.html',                   'giris sayfasi'],
    ['/sw.js',                        'service worker (surum atlar)'],
    ['/manifest.json',                'PWA manifesti'],
    ['/data/anasayfa.json',           'her gece degisiyor'],
    ['/data/hal.json',                'her gece degisiyor'],
    ['/static/fonts/inter-latin.woff2', 'adinda damga YOK; sw.js cacheFirst tutuyor'],
    ['/static/og-image.png',          'adinda damga YOK'],
    ['/robots.txt',                   'adinda damga YOK'],
    ['/app.js',                       'damgasiz kaynak adi'],
  ];
  for (const [yol, neden] of DEGISEN) {
    const v = await cc(yol);
    ok(`  degisen dosya IMMUTABLE DEGIL: ${yol}  [${neden}]`, !/immutable/.test(v), v);
  }

  // 304 SART: gecisten once onbelleklenmis kopyalar "must-revalidate" tasiyor.
  // 304'e yazilmazsa o tarayicilar sonsuza kadar revalidate etmeye devam eder
  // ve kazanc onlara HIC ulasmaz.
  ok('304 yanitinda da damgali dosya IMMUTABLE',
     /immutable/.test(await cc('/app.0ed6c6ce.js', 304)), await cc('/app.0ed6c6ce.js', 304));
  ok('  404 damgalanmiyor (var olmayan varlik yil boyu onbelleklenmesin)',
     !/immutable/.test(await cc('/app.deadbeef.js', 404)), await cc('/app.deadbeef.js', 404));

  // CSP ve HSTS bu yolda da uygulanmali -- yeni dal onlari atlamasin.
  const res = await mod.default.fetch(new Request('https://pazarapp.net/app.0ed6c6ce.js'), {
    ASSETS: { fetch: async () => new Response('ok', { status: 200 }) }
  });
  ok('  damgali yolda CSP hala uygulaniyor', (res.headers.get('content-security-policy') || '').length > 0);
  ok('  damgali yolda HSTS hala uygulaniyor', (res.headers.get('strict-transport-security') || '').includes('max-age'));
}

console.log(`\nPASS=${pass}  FAIL=${fail}`);
process.exit(fail ? 1 : 0);
