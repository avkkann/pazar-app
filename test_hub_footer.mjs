// HUB FOOTER: uygulamanin ana ekranindan hub sayfalarina giden IC LINK blogu.
//
// NEDEN VAR: 18 hub sayfasi canliya cikti ama uygulamadan onlara giden hicbir
// link yoktu -- Google onlari yalnizca sitemap'ten gorebiliyordu, tarama
// grafiginde hicbir baglantisi olmayan sayfalar en sona dusuyor.
//
// EN KRITIK IDDIA (Gorev 8'in tek gercek riski): linkler .hub/manifest.json'daki
// durum === "uretildi" kayitlarindan TURETILIYOR, elle yazilmis SABIT LISTE
// DEGIL. Bugun 2 ay (2026-05, 2026-06) gerekce ile ATLANDI; sabit liste
// yazilsaydi footer canlida iki adet 404 uretirdi. Yarin Eylul sayfasi
// uretildiginde de kimsenin elle guncellemesi gerekmemeli.
// Bu yuzden asagida manifest'e SAHTE bir atlanan ve SAHTE bir uretilen sayfa
// enjekte edilip footer'in ikisine verdigi tepki ayri ayri olculuyor.
import fs from 'fs';
import path from 'path';
import { hubFooterModeli, hubFooterHTML, hubFooterEkle, HUB_YER_TUTUCU } from './scripts/hub-footer.mjs';

let pass = 0, fail = 0;
const ok = (ad, k, d = '') => { if (k) { pass++; console.log('  PASS  ' + ad); } else { fail++; console.log('  FAIL  ' + ad + (d ? '  -> ' + d : '')); } };
const atar = (ad, fn, desen) => {
  let hata = null;
  try { fn(); } catch (e) { hata = String(e.message); }
  ok(ad, hata !== null && desen.test(hata), hata === null ? '(hic atmadi)' : hata);
};

// Elle kurulmus kucuk manifest -- gercek 17 MB veri okunmuyor.
const kayit = (yol, tip, durum, kisa_ad, ek = {}) => ({
  yol, tip, durum, kisa_ad,
  sebep: durum === 'atlandi' ? 'test gerekcesi' : '',
  satir: durum === 'uretildi' ? 40 : 0, kelime: durum === 'uretildi' ? 600 : 0,
  son_veri: durum === 'uretildi' ? '2026-08-18T00:00:00+03:00' : null,
  veri_damgasi: '2026-08-18T00:00:00+03:00', atlanan_bolumler: [], ...ek,
});
const SAHTE = [
  kayit('/zam/2026-05/', 'zam', 'atlandi', 'Mayıs 2026 zamları'),
  kayit('/zam/2026-07/', 'zam', 'uretildi', 'Temmuz 2026 zamları'),
  kayit('/zam/2026-08/', 'zam', 'uretildi', 'Ağustos 2026 zamları'),
  kayit('/market/a101/', 'market', 'uretildi', 'A101'),
  kayit('/market/tarim-kredi/', 'market', 'uretildi', 'T.Kredi'),
  kayit('/kategori/meyve-sebze/', 'kategori', 'uretildi', 'Meyve & Sebze'),
  kayit('/kategori/sut/', 'kategori', 'uretildi', 'Süt & Kahvaltı'),
  kayit('/hal/', 'hal', 'uretildi', 'Hal fiyatları'),
];
const hrefleri = (html) => [...html.matchAll(/href="([^"]*)"/g)].map((m) => m[1]);

console.log('\n=== 1. LINKLER MANIFESTTEN TURETILIYOR (SABIT LISTE DEGIL) ===');
{
  const html = hubFooterHTML(SAHTE);
  const uretilen = SAHTE.filter((k) => k.durum === 'uretildi');
  const h = hrefleri(html);
  ok('link sayisi = manifestteki uretildi sayisi', h.length === uretilen.length,
     h.length + ' link, ' + uretilen.length + ' uretildi -> ' + h.join(' '));
  ok('  href kumesi manifest yollariyla BIREBIR ayni',
     JSON.stringify([...h].sort()) === JSON.stringify(uretilen.map((k) => k.yol).sort()), h.join(' '));

  console.log('  --- ATLANAN sayfa footer\'da GORUNMEMELI (yoksa canlida 404) ---');
  ok('atlanan /zam/2026-05/ HTML\'de hic gecmiyor', !html.includes('/zam/2026-05/'),
     html.slice(Math.max(0, html.indexOf('2026-05') - 60), html.indexOf('2026-05') + 40));
  ok('  atlanan sayfanin ETIKETI de gecmiyor', !html.includes('Mayıs 2026 zamları'), '');

  console.log('  --- manifeste SAHTE ATLANAN sayfa eklenince ---');
  const artiAtlanan = [...SAHTE, kayit('/zam/2026-06/', 'zam', 'atlandi', 'Haziran 2026 zamları')];
  const h2 = hrefleri(hubFooterHTML(artiAtlanan));
  ok('link sayisi ARTMIYOR', h2.length === h.length, h2.length + ' vs ' + h.length);
  ok('  yeni atlanan yol HTML\'de yok', !h2.includes('/zam/2026-06/'), h2.join(' '));

  console.log('  --- manifeste SAHTE URETILEN sayfa eklenince ---');
  const artiUretilen = [...SAHTE, kayit('/zam/2099-01/', 'zam', 'uretildi', 'Ocak 2099 zamları')];
  const h3html = hubFooterHTML(artiUretilen);
  const h3 = hrefleri(h3html);
  ok('link sayisi BIR ARTIYOR (elle guncelleme gerekmiyor)', h3.length === h.length + 1,
     h3.length + ' vs ' + h.length);
  ok('  yeni yol linklendi', h3.includes('/zam/2099-01/'), h3.join(' '));
  ok('  etiketi de basildi', h3html.includes('Ocak 2099 zamları'), '');
}

console.log('\n=== 2. URETICIDE SABIT HUB YOLU YOK (kaynak denetimi) ===');
{
  // "Manifestten besleniyor" iddiasini kaynak duzeyinde de kanitla: modul
  // govdesinde hicbir somut hub yolu (/kategori/sut/ gibi) yazili olmamali.
  const KAYNAK = fs.readFileSync('scripts/hub-footer.mjs', 'utf8');
  const govde = KAYNAK.split('\n').filter((s) => !/^\s*(\/\/|\*|\/\*)/.test(s)).join('\n');
  const somutYol = govde.match(/["'`]\/(zam|market|kategori|hal)\/[^"'`]*["'`]/g) || [];
  ok('modul govdesinde somut hub yolu YOK', somutYol.length === 0, somutYol.join(' '));
  const marketAdi = ['A101', 'BİM', 'CarrefourSA', 'Migros', 'ŞOK', 'Hakmar'].filter((m) => govde.includes(m));
  ok('  market adi listesi de gomulu DEGIL (etiket manifestten)', marketAdi.length === 0, marketAdi.join(' '));
}

console.log('\n=== 3. KIRIK LINK URETILEMEZ (bicim dogrulamasi) ===');
{
  const html = hubFooterHTML(SAHTE);
  const h = hrefleri(html);
  ok('tum href\'ler "/" ile BASLIYOR (hub derin yolda, goreli yol yanlis cozulur)',
     h.every((x) => x.startsWith('/')), h.filter((x) => !x.startsWith('/')).join(' '));
  ok('tum href\'ler "/" ile BITIYOR (canonical ile ayni bicim)',
     h.every((x) => x.endsWith('/')), h.filter((x) => !x.endsWith('/')).join(' '));
  atar('yol "/" ile baslamiyorsa ATIYOR (sessiz kirik link yok)',
       () => hubFooterHTML([kayit('zam/2026-08/', 'zam', 'uretildi', 'X')]), /yol/i);
  atar('  yol "/" ile bitmiyorsa ATIYOR',
       () => hubFooterHTML([kayit('/zam/2026-08', 'zam', 'uretildi', 'X')]), /yol/i);
  atar('uretilen kayitta kisa_ad yoksa ATIYOR (metinsiz link yayinlanmaz)',
       () => hubFooterHTML([kayit('/zam/2026-08/', 'zam', 'uretildi', '')]), /kisa_ad|etiket/i);
  atar('ayni yol iki kez gecerse ATIYOR',
       () => hubFooterHTML([kayit('/hal/', 'hal', 'uretildi', 'Hal'), kayit('/hal/', 'hal', 'uretildi', 'Hal')]),
       /iki kez|tekrar|yinelen/i);
}

console.log('\n=== 4. KACIS (etiket ucuncu taraf metin degil ama kapi acik kalmasin) ===');
{
  const html = hubFooterHTML([kayit('/hal/', 'hal', 'uretildi', 'Hal <img src=x onerror=alert(1)> & "tirnak"')]);
  ok('etiketteki < kaciriliyor', !/<img/i.test(html), html);
  ok('  & kaciriliyor', html.includes('&amp;'), html);
  ok('  " kaciriliyor', !/>[^<]*"tirnak"/.test(html), html);
}

console.log('\n=== 5. ERISILEBILIRLIK ===');
{
  const html = hubFooterHTML(SAHTE);
  ok('<nav> aria-label tasiyor', /<nav[^>]+aria-label="[^"]+"/.test(html),
     (html.match(/<nav[^>]*>/) || ['YOK'])[0]);
  const linkler = [...html.matchAll(/<a\b[^>]*>/g)].map((m) => m[0]);
  ok('her link tabindex="0" tasiyor (klavye ikilisinin ikinci yarisi)',
     linkler.length > 0 && linkler.every((a) => /tabindex="0"/.test(a)),
     linkler.filter((a) => !/tabindex="0"/.test(a)).join(' '));
  ok('  hicbir link bos metinli degil',
     !/<a\b[^>]*>\s*<\/a>/.test(html), '');
  const gruplar = [...html.matchAll(/role="group"[^>]*aria-labelledby="([^"]+)"/g)].map((m) => m[1]);
  ok('grup basliklari aria-labelledby ile bagli', gruplar.length >= 3, 'grup=' + gruplar.length);
  ok('  her aria-labelledby hedefi HTML\'de var',
     gruplar.every((id) => html.includes('id="' + id + '"')), gruplar.join(' '));
  ok('grup baslikliginda <h1>-<h6> KULLANILMIYOR (index.html tek-h1 kurali)',
     !/<h[1-6][\s>]/.test(html), (html.match(/<h[1-6][^>]*>/) || []).join(' '));
}

console.log('\n=== 6. YER TUTUCU DEGISIMI (hubFooterEkle) ===');
{
  const sayfa = '<div id="screen-home">' + HUB_YER_TUTUCU + '</div>';
  const cikti = hubFooterEkle(sayfa, SAHTE);
  ok('yer tutucu HTML ile degisti', !cikti.includes(HUB_YER_TUTUCU) && cikti.includes('href="/hal/"'), cikti.slice(0, 120));
  ok('  cevresindeki isaretleme korundu', cikti.startsWith('<div id="screen-home">') && cikti.endsWith('</div>'), '');
  ok('  manifest bos oldugunda bos <nav> iskeleti de kalmiyor',
     !hubFooterEkle(sayfa, []).includes('<nav'), hubFooterEkle(sayfa, []));
  atar('yer tutucu YOKSA ATIYOR (sessizce linksiz yayinlanmaz)',
       () => hubFooterEkle('<div id="screen-home"></div>', SAHTE), /yer tutucu|HUB-LINKLERI/i);

  console.log('  --- manifest yoksa/bossa: build KIRILMAZ, blok bos kalir ---');
  for (const [ad, m] of [['bos dizi', []], ['null', null], ['tanimsiz', undefined]]) {
    let c = null, e = null;
    try { c = hubFooterEkle(sayfa, m); } catch (x) { e = String(x.message); }
    ok('manifest ' + ad + ' -> atmiyor, link uretmiyor',
       e === null && c !== null && hrefleri(c).length === 0, e || c);
  }
}

console.log('\n=== 7. GRUPLAMA VE SIRA ===');
{
  const model = hubFooterModeli(SAHTE);
  ok('gruplar manifest tiplerinden turedi', model.every((g) => SAHTE.some((k) => k.tip === g.tip)),
     model.map((g) => g.tip).join(' '));
  ok('  bos grup uretilmiyor', model.every((g) => g.linkler.length > 0), model.map((g) => g.tip + ':' + g.linkler.length).join(' '));
  const zam = model.find((g) => g.tip === 'zam');
  ok('ay listesi YENIDEN ESKIYE (en guncel ay basta)',
     zam.linkler[0].yol === '/zam/2026-08/', zam.linkler.map((l) => l.yol).join(' '));
  const kat = model.find((g) => g.tip === 'kategori');
  ok('kategori sirasi manifest sirasini KORUYOR (app.js KATEGORILER sirasi)',
     JSON.stringify(kat.linkler.map((l) => l.yol)) === JSON.stringify(['/kategori/meyve-sebze/', '/kategori/sut/']),
     kat.linkler.map((l) => l.yol).join(' '));
  ok('bilinmeyen tip sessizce DUSMUYOR (gorunur grup aliyor)',
     hubFooterModeli([kayit('/yeni/x/', 'yenitip', 'uretildi', 'Yeni')]).length === 1, '');
}

console.log('\n=== 8. GERCEK MANIFEST (varsa) — 18 SAYFA, 0 KIRIK LINK ===');
{
  const MYOL = '.hub/manifest.json';
  if (!fs.existsSync(MYOL)) {
    console.log('  ATLANDI: .hub/manifest.json yok (turetilmis dosya, repoda durmuyor). "npm run build" sonrasi kosulur.');
  } else {
    const gercek = JSON.parse(fs.readFileSync(MYOL, 'utf8'));
    const uretilen = gercek.filter((k) => k.durum === 'uretildi');
    const h = hrefleri(hubFooterHTML(gercek));
    ok('footer linki sayisi = uretildi sayisi', h.length === uretilen.length, h.length + ' vs ' + uretilen.length);
    const atlanan = gercek.filter((k) => k.durum === 'atlandi');
    console.log('    atlanan: ' + (atlanan.map((k) => k.yol).join(', ') || '(yok)'));
    ok('  atlanan sayfalarin HICBIRI footer\'da yok',
       atlanan.every((k) => !h.includes(k.yol)), atlanan.map((k) => k.yol).filter((y) => h.includes(y)).join(' '));
    // KIRIK LINK OLCUMU: her href .hub/ altinda gercek bir index.html'e karsilik geliyor mu
    const kirik = h.filter((y) => !fs.existsSync(path.join('.hub', y.replace(/^\//, ''), 'index.html')));
    ok('kirik link = 0 (her href .hub/ altinda gercek bir sayfaya karsilik geliyor)',
       kirik.length === 0, kirik.join(' '));
    console.log('    linkler: ' + h.join(' '));
  }
}

console.log('\n=== 9. index.html YER TUTUCUSU + ELLE LINK YOK ===');
{
  const HTML = fs.readFileSync('index.html', 'utf8');
  ok('index.html yer tutucuyu iceriyor', HTML.includes(HUB_YER_TUTUCU), '');
  const home = HTML.slice(HTML.indexOf('id="screen-home"'), HTML.indexOf('id="screen-cat"'));
  ok('  yer tutucu ANA EKRAN icinde', home.includes(HUB_YER_TUTUCU), '');
  const elle = (HTML.match(/href="\/(zam|market|kategori|hal)\/[^"]*"/g) || []);
  ok('index.html\'de ELLE yazilmis hub linki YOK (hepsi build\'de uretiliyor)',
     elle.length === 0, elle.join(' '));
}

console.log('\n=== 10. STIL: 44x44 DOKUNMA HEDEFI + :focus-visible ===');
{
  const CSS = fs.readFileSync('style.css', 'utf8');
  const blok = (sec) => {
    const i = CSS.indexOf(sec);
    return i < 0 ? '' : CSS.slice(i, CSS.indexOf('}', i) + 1);
  };
  const link = blok('.hub-link {');
  ok('.hub-link kurali var', link.length > 0, '');
  const px = (ad) => { const m = link.match(new RegExp(ad + ':\\s*(\\d+)px')); return m ? +m[1] : 0; };
  ok('  min-height >= 44px', px('min-height') >= 44, 'min-height=' + px('min-height'));
  ok('  dokunma hedefi genisligi >= 44px (min-width)', px('min-width') >= 44, 'min-width=' + px('min-width'));
  ok('.hub-link:focus-visible kurali var (klavye ikilisinin ilk yarisi)',
     /\.hub-link:focus-visible\s*\{[^}]*outline:/.test(CSS),
     (CSS.match(/\.hub-link:focus-visible[^}]*\}/) || ['YOK'])[0]);
  ok('renkler tema degiskenlerinden (koyu tema kendiliginden calisir)',
     /var\(--/.test(link), link);
  ok('  sabit #ffffff/#000 gomulu degil', !/#(fff|000)\b/i.test(link), link);
  const nav = blok('.hub-nav {');
  ok('.hub-nav kurali var', nav.length > 0, '');
}

console.log('\n=== 11. SW SURUMU (app.js + index.html + style.css degisti) ===');
{
  const SW = fs.readFileSync('sw.js', 'utf8');
  const m = SW.match(/pazar-cache-v(\d+)/);
  ok('sw.js surumu okunabiliyor', !!m, SW.slice(0, 60));
  ok('  surum >= 210', m && +m[1] >= 210, m ? 'v' + m[1] : 'YOK');
}

console.log('\n' + '='.repeat(52));
console.log(`SONUC: ${pass} PASS, ${fail} FAIL`);
process.exit(fail === 0 ? 0 : 1);
