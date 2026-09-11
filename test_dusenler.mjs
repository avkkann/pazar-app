// "BU HAFTA DUSENLER" SERIDININ OLCUTU (2026-09-11).
//
// KUSUR (olculdu 2026-09-10): serit get_fiyat_dusenler RPC'sinden geliyordu ve
// o fonksiyon indirimi urunun UZUN DONEM (en az 30 gun) en yuksek fiyatina gore
// olcuyordu -- zaman penceresi yoktu. 40 adayin 28'inde referans HATALI veriydi
// (12 Agustos'ta Hakmar'da tek gunluk hata: 35 g kek 149 TL -> 14 urun 28 gundur
// "-%83...-95"); gorunen 6 kartin yalniz 1'i o hafta gercekten dusmustu; listenin
// 40. sirasi -%58 oldugu icin gercek haftalik indirimlerin %94'u (%10-49)
// listeye HIC giremiyordu.
//
// YENI OLCUT (app.js: dusenOlcutu / dusenHavuzu / dusenSecHavuzdan):
//  1) indirim SON 7 GUNDE baslamis olmali (oncesinde indirimsiz gun GORULMUS)
//  2) referans marketin 60 gunluk NORMAL fiyati (gunluk serinin ust ortancasi)
//  3) gecmis kisaysa marketin ILAN ettigi eski fiyat, bizim gozlemimizle
//     uyusuyorsa kanit sayilir
//  4) indirim bittiyse ya da 7 gunden eskiyse seritten duser
//  5) cesitlilik: marka<=1, alt kategori<=2, market<=2 (zam seridiyle AYNI kod)
//
// Test DAVRANISSAL: app.js'in tamami node:vm'de, build'in kullandigi AYNI
// ortamda (scripts/app-vm.mjs) kosturuluyor; sentetik seriler + gercek katalog.

import fs from 'node:fs';
import { appOrtamiKur } from './scripts/app-vm.mjs';

let GECTI = 0, KALDI = 0;
const ok = (ad, kosul, ipucu = '') => {
  if (kosul) { GECTI++; console.log('  PASS  ' + ad); }
  else { KALDI++; console.log('  FAIL  ' + ad + (ipucu !== '' ? '  -> ' + String(ipucu).slice(0, 220) : '')); }
};
const bitir = () => { console.log('\nPASS=' + GECTI + '  FAIL=' + KALDI); process.exit(KALDI ? 1 : 0); };

const APP = fs.readFileSync(new URL('./app.js', import.meta.url), 'utf8');
const URET = fs.readFileSync(new URL('./scripts/anasayfa-uret.mjs', import.meta.url), 'utf8');

function govde(ad) {
  const m = new RegExp('(?:^|\\n)\\s*(?:async )?function ' + ad + '\\s*\\([^)]*\\)\\s*\\{').exec(APP);
  if (!m) return '';
  const bas = APP.indexOf('{', m.index);
  let d = 0;
  for (let i = bas; i < APP.length; i++) {
    if (APP[i] === '{') d++;
    else if (APP[i] === '}') { d--; if (d === 0) return APP.slice(m.index, i + 1); }
  }
  return '';
}

// GUVENLI YORUM SOYUCU (satir tabanli) -- bkz. test_turkce_ek.mjs.
function kodTemiz(src) {
  const cikti = [];
  let blokta = false;
  // CRLF GUVENLIGI: JS regexinde nokta satir sonlandiricilarini (CR dahil)
  // ESLEMEZ ve m bayragi yokken satir-sonu capasi DIZE sonunu bekler. CRLF
  // satirda geriye kalan CR yuzunden // deseni HIC eslesmezdi. Regex ile
  // degil KARAKTER KODUYLA kirpiliyor.
  for (let l of String(src).split(String.fromCharCode(10))) {
    if (l.charCodeAt(l.length - 1) === 13) l = l.slice(0, -1);
    if (blokta) { if (l.indexOf("*/") >= 0) blokta = false; cikti.push(""); continue; }
    if (/^\s*\/\*/.test(l)) { if (l.indexOf("*/") < 0) blokta = true; cikti.push(""); continue; }
    cikti.push(l.replace(/^\s*\/\/.*$/, ""));
  }
  return cikti.join(String.fromCharCode(10));
}
// ALET KONTROLU (soyucunun KENDI kontrol grubu).
{
  const CR = String.fromCharCode(13), LF = String.fromCharCode(10);
  const _crlf = kodTemiz("// SOYULMALI_YORUM" + CR + LF + "const _kod = 1;" + CR + LF);
  const _lf   = kodTemiz("// SOYULMALI_YORUM" + LF + "const _kod = 1;" + LF);
  ok("ALET: CRLF satirda yorum SOYULUYOR", !/SOYULMALI_YORUM/.test(_crlf), JSON.stringify(_crlf));
  ok("ALET:   LF satirda yorum SOYULUYOR", !/SOYULMALI_YORUM/.test(_lf), JSON.stringify(_lf));
  ok("ALET: kod satiri KORUNUYOR (asiri soyma yok)",
     /const _kod = 1;/.test(_crlf) && /const _kod = 1;/.test(_lf), JSON.stringify(_crlf));
}

const { ic, ctx } = appOrtamiKur();
// app.js yuklenirken kendi acilis isini baslatiyor (readyState 'complete');
// o zincir otursun ki testin kurdugu durumu sonradan ezmesin.
await new Promise(r => setTimeout(r, 300));
const cagir = (ifade, veri) => { ctx.__v = veri; return ic(ifade); };
const gunNo = s => Math.round(Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10)) / 864e5);

console.log('\n=== 0. ALET: yeni fonksiyonlar var mi ===');
for (const f of ['dusenOlcutu', 'dusenHavuzu', 'dusenSecHavuzdan', '_cesitliSec', '_isoGunKaydir'])
  ok(f + ' tanimli', ic('typeof ' + f) === 'function');
if (KALDI) bitir();

// ─────────────────────────────────────────────────────────────────────
console.log('\n=== 1. OLCUT (saf fonksiyon, sabit "bugun") ===');
const B0 = '2026-09-10';
const K = (...c) => c.map(([t, f]) => ({ t, f }));
const olc = (k, f, l) => cagir('dusenOlcutu(__v.k, __v.f, __v.l, "' + B0 + '")', { k, f, l });
{
  const r = olc(K(['2026-06-01', 100], ['2026-09-07', 80]), 80);
  ok('gercek haftalik dusus GIRIYOR (normal 100 -> 80)',
     r && r.yuzde === 20 && r.normal === 100 && r.baslangic === '2026-09-07' && r.kaynak === 'seri', JSON.stringify(r));
}
{
  const r = olc(K(['2026-06-01', 10], ['2026-08-12', 149], ['2026-08-13', 10]), 10);
  ok('tek gunluk HATALI zirve indirim sayilmiyor (12 Agustos Hakmar deseni)', r === null, JSON.stringify(r));
  const r2 = olc(K(['2026-06-01', 10], ['2026-08-12', 149], ['2026-08-13', 10], ['2026-09-08', 9]), 9);
  ok('  referans o zirve DEGIL, normal fiyat (149 degil 10)', r2 && r2.normal === 10 && r2.yuzde === 10, JSON.stringify(r2));
}
{
  ok('7 gunden ESKI indirim girmiyor (16 gun once basladi)', olc(K(['2026-06-01', 100], ['2026-08-25', 80]), 80) === null);
  ok('BITMIS indirim girmiyor (dustu, dun geri cikti)', olc(K(['2026-06-01', 100], ['2026-09-06', 80], ['2026-09-09', 100]), 100) === null);
  ok('%10 altindaki oynama girmiyor (100 -> 93)', olc(K(['2026-06-01', 100], ['2026-09-08', 93]), 93) === null);
  const r = olc(K(['2026-06-01', 100], ['2026-09-08', 90]), 90);
  ok('  sinir: tam %10 giriyor (100 -> 90)', r && r.yuzde === 10, JSON.stringify(r));
}
{
  const r = olc(K(['2026-06-01', 100], ['2026-09-04', 80]), 80);
  ok('pencere siniri: 6 gun once baslayan GIRIYOR', r && r.baslangic === '2026-09-04', JSON.stringify(r));
  ok('pencere siniri: 7 gun once baslayan GIRMIYOR', olc(K(['2026-06-01', 100], ['2026-09-03', 80]), 80) === null);
}
{
  const kisa = K(['2026-08-20', 100], ['2026-09-08', 80]);
  ok('gecmis kisa + ilan YOK -> girmiyor', olc(kisa, 80) === null);
  const r = olc(kisa, 80, 100);
  ok('gecmis kisa + ILAN var ve gozlemle uyusuyor -> giriyor (kaynak ilan)',
     r && r.kaynak === 'ilan' && r.normal === 100 && r.yuzde === 20 && r.baslangic === '2026-09-08', JSON.stringify(r));
  ok('ilan SISIRILMIS (200 diyor, biz 100 gorduk) -> girmiyor', olc(kisa, 80, 200) === null);
  // Yukaridaki vakayi 7 gun penceresi de eliyor (gorulen fiyat ilanin altinda
  // kaldigi icin "indirim kosusu" haftalar oncesine uzuyor). Uyusma kapisinin
  // TEK BASINA belirleyici oldugu yon bu: gorulen fiyat ilanin USTUNDE.
  // (Bozma testi yakaladi: ilk hali bu kapiyi hic olcmuyordu.)
  ok('ilan eski fiyati gordugumuzden cok DUSUK (120 gorduk, ilan 100) -> tutarsiz, girmiyor',
     olc(K(['2026-08-20', 120], ['2026-09-08', 80]), 80, 100) === null);
  ok('ilan var ama indirimden once 7 gunden az gozlem -> girmiyor', olc(K(['2026-09-04', 100], ['2026-09-08', 80]), 80, 100) === null);
  const uzun = olc(K(['2026-06-01', 100], ['2026-09-07', 80]), 80, 300);
  ok('gecmis YETERLIYSE ilan fiyati referansi EZMIYOR (300 degil 100)',
     uzun && uzun.normal === 100 && uzun.kaynak === 'seri', JSON.stringify(uzun));
}
{
  // Normal pencere B0-66..B0-7 = 07-06..09-03: 30 gun 80 + 30 gun 100.
  const r = olc(K(['2026-07-06', 80], ['2026-08-05', 100], ['2026-09-08', 70]), 70);
  ok('normal = gunluk serinin UST ortancasi (30 gun 80 + 30 gun 100 -> 100)', r && r.normal === 100 && r.yuzde === 30, JSON.stringify(r));
}
{
  ok('seri bugunku fiyatla uyusmuyorsa girmiyor', olc(K(['2026-06-01', 100], ['2026-09-07', 80]), 75) === null);
  ok('bos/bozuk girdi -> null', olc([], 80) === null && olc(null, 80) === null && olc(K(['2026-06-01', 100]), 0) === null);
}

// ─────────────────────────────────────────────────────────────────────
console.log('\n=== 2. HAVUZ (sentetik katalog, gercek saate gore) ===');
const G = n => ic('_yerelGunISO(' + n + ')');
function kur(urunler, gecmis, puan) {
  ctx.__u = urunler; ctx.__g = gecmis; ctx.__p = puan || [];
  ic(`(() => {
    for (const k of Object.keys(catCache)) delete catCache[k];
    catCache.test = __u;
    _gecmisCache = __g;
    _seriCache = new Map();
    _puanCache = new Map(__p.map(r => [r._sid, r]));
  })()`);
}
const U = (sid, ad, kat, mf) => ({ _id: sid, _sid: sid, ad, ana_kategori: kat, market_fiyatlari: mf,
  en_dusuk_fiyat: Math.min(...mf.map(f => f.fiyat)) });
const dus = (m, eski, yeni, gunOnce) => [{ t: G(90), m, f: eski }, { t: G(gunOnce), m, f: yeni }];
const sabit = (m, f) => [{ t: G(90), m, f }];
const SUPHE = sid => ({ _sid: sid, indirim_supheli_puan: 5, indirim_supheli_sebepler: ['kisa_zirve'] });
{
  kur([U('p1', 'Aaa Bisküvi', 'Bisküvi', [{ market: 'migros', fiyat: 80 }, { market: 'a101', fiyat: 75 }]),
       U('p2', 'Bbb Bisküvi', 'Bisküvi', [{ market: 'migros', fiyat: 80 }, { market: 'a101', fiyat: 85 }])],
      { p1: [...dus('migros', 100, 80, 3), ...sabit('a101', 75)],
        p2: [...dus('migros', 100, 80, 3), ...sabit('a101', 85)] });
  const sid = ic('dusenHavuzu()').map(x => x.u._sid);
  ok('baska market daha ucuzsa (kart o fiyati gosterir) GIRMIYOR', !sid.includes('p1'), sid.join(','));
  ok('  kontrol: indirimli market en ucuzsa GIRIYOR', sid.includes('p2'), sid.join(','));
}
{
  kur([U('p3', 'Ccc Deterjan', 'Deterjan', [{ market: 'migros', fiyat: 70 }, { market: 'carrefour', fiyat: 70 }])],
      { p3: [...dus('migros', 100, 70, 3), ...dus('carrefour', 90, 70, 2)] });
  const h = ic('dusenHavuzu()');
  ok('iki markette dusen urun TEK kayit', h.length === 1, h.length);
  ok('  en derin indirimli market secildi (migros %30, carrefour %22)', h[0] && h[0].market === 'migros' && h[0].yuzde === 30,
     h[0] && (h[0].market + ' %' + h[0].yuzde));
}
{
  kur([U('p4', 'Ddd Şampuan', 'Şampuan', [{ market: 'bim', fiyat: 80 }]),
       U('p5', 'Eee Şampuan', 'Şampuan', [{ market: 'bim', fiyat: 80 }])],
      { p4: dus('bim', 100, 80, 3), p5: dus('bim', 100, 80, 3) }, [SUPHE('p4')]);
  const sid = ic('dusenHavuzu()').map(x => x.u._sid);
  ok('sahte indirim SUPHESI olan urun GIRMIYOR ("dikkat" seridinde)', !sid.includes('p4'), sid.join(','));
  ok('  kontrol: ayni desen, suphesiz urun GIRIYOR', sid.includes('p5'), sid.join(','));
}
{
  kur([U('p6', 'Fff Kahve', 'Kahve', [{ market: 'sok', fiyat: 60 }]),
       U('p7', 'Ggg Çay', 'Çay', [{ market: 'sok', fiyat: 160 }]),
       U('p8', 'Hhh Süt', 'Süt', [{ market: 'sok', fiyat: 80 }])],
      { p6: dus('sok', 100, 60, 2), p7: dus('sok', 200, 160, 2), p8: dus('sok', 100, 80, 2) });
  const sid = ic('dusenHavuzu()').map(x => x.u._sid).join(',');
  ok('siralama: once indirim yuzdesi, esitlikte TL tasarrufu (p6 %40, p7 %20/40 TL, p8 %20/20 TL)', sid === 'p6,p7,p8', sid);
}
{
  kur([U('p9', 'Iii Makarna', 'Makarna', [{ market: 'bim', fiyat: 50 }])], {});
  let h = null, hata = null;
  try { h = ic('dusenHavuzu()'); } catch (e) { hata = e; }
  ok('gecmisi olmayan urun atlaniyor, hata yok', !hata && h && h.length === 0, hata && hata.message);
}
{
  const mk = ['migros', 'carrefour', 'a101', 'bim', 'sok', 'hakmar', 'tarim_kredi', 'migros', 'carrefour', 'a101'];
  const urun = [], g = {}, p = [];
  for (let i = 0; i < 10; i++) {
    const sid = 'q' + i, yeni = 50 + i;
    urun.push(U(sid, 'Marka' + i + ' Ürün', 'Kat' + i, [{ market: mk[i], fiyat: yeni }]));
    g[sid] = dus(mk[i], 100, yeni, 2);
    if (i < 4) p.push(SUPHE(sid));
  }
  kur(urun, g, p);
  const sec = ic('dusenSecHavuzdan(dusenHavuzu())').map(x => x.u._sid);
  ok('en ustteki 4 aday supheli olsa da serit 6 kartla DOLUYOR', sec.length === 6 && sec.every(s => +s.slice(1) >= 4), sec.join(','));
  kur(urun, g, urun.map(u => SUPHE(u._sid)));
  ok('hepsi supheliyse havuz BOS', ic('dusenHavuzu()').length === 0);
}

// ─────────────────────────────────────────────────────────────────────
console.log('\n=== 3. SECIM: cesitlilik (marka<=1, alt kategori<=2, market<=2) ===');
const A = (ad, kat, market, yuzde) => ({ u: { ad, ana_kategori: kat }, market, yuzde });
const sec = havuz => cagir('dusenSecHavuzdan(__v)', havuz).map(x => x.u.ad);
{
  const s = sec([A('Kent Jelibon A', 'Şeker', 'a101', 64), A('Kent Jelibon B', 'Şeker', 'a101', 64),
                 A('Kent Jelibon C', 'Şeker2', 'migros', 60), A('Ülker Çikolata', 'Çikolata', 'bim', 50)]);
  ok('ayni markadan EN FAZLA 1 (bugunku 3 Kent Jelibon vakasi)',
     s.filter(a => a.startsWith('Kent')).length === 1 && s.includes('Ülker Çikolata'), s.join(' | '));
}
{
  const h = ['Aa', 'Bb', 'Cc', 'Dd', 'Ee'].map((b, i) => A(b + ' Ürün', 'K' + i, 'carrefour', 60 - i))
    .concat([A('Ff Ürün', 'K9', 'migros', 40)]);
  const s = sec(h);
  ok('ayni marketten EN FAZLA 2 (olculdu: ilk 6nin 6si Carrefour cikiyordu)', s.length === 3 && s.includes('Ff Ürün'), s.join(' | '));
}
{
  const s = sec(['Aa', 'Bb', 'Cc'].map((b, i) => A(b + ' Süt', 'Süt', ['bim', 'sok', 'a101'][i], 50 - i)));
  ok('ayni alt kategoriden EN FAZLA 2', s.length === 2, s.join(' | '));
}
{
  const mk = ['migros', 'carrefour', 'a101', 'bim', 'sok', 'hakmar', 'tarim_kredi'];
  const s = sec(Array.from({ length: 20 }, (_, i) => A('M' + i + ' Ürün', 'K' + i, mk[i % 7], 90 - i)));
  ok('en fazla DUSENLER_KART (6) kart', s.length === 6, s.length);
  ok('  sira korunuyor (en yuksek indirimden basliyor)', s.join(',') === 'M0 Ürün,M1 Ürün,M2 Ürün,M3 Ürün,M4 Ürün,M5 Ürün', s.join(','));
}
{
  const s = sec(Array.from({ length: 6 }, (_, i) =>
    A('Aynı Marka ' + i, 'K' + i, ['bim', 'sok', 'a101', 'migros', 'carrefour', 'hakmar'][i], 50 - i)));
  ok('kural yuzunden dolmazsa ESIK DUSURULMUYOR (6 ayni marka -> 1 kart)', s.length === 1, s.length);
  ok('bos/bozuk havuz -> bos', cagir('dusenSecHavuzdan(__v)', []).length === 0 && ic('dusenSecHavuzdan(null)').length === 0);
}
{
  const zh = [0, 1, 2].map(i => ({ u: { _id: 'z' + i, ad: 'Kent Ürün ' + i, ana_kategori: 'K' + i },
    marketArtis: { migros: { artis: 30 - i, zirve: 10, sonHafta: 13, kayit: 3 } } }));
  ok('zam seridinin cesitliligi DEGISMEDI (ayni marka en fazla 2)', cagir('zamSecHavuzdan(__v)', zh).length === 2);
  ok('iki serit AYNI cesitlilik kodunu kullaniyor (_cesitliSec, tek kaynak)',
     /_cesitliSec\(/.test(govde('zamSecHavuzdan')) && /_cesitliSec\(/.test(govde('dusenSecHavuzdan')));
}

// ─────────────────────────────────────────────────────────────────────
console.log('\n=== 4. ESKI RPC YOLU EMEKLI ===');
{
  const APP_T = kodTemiz(APP), URET_T = kodTemiz(URET);
  ok('app.js get_fiyat_dusenler CAGIRMIYOR', !/get_fiyat_dusenler/.test(APP_T));
  ok('  olu sabit DUSENLER_RPC_LIMIT kalkti', !/DUSENLER_RPC_LIMIT/.test(APP_T));
  ok('build (anasayfa-uret) get_fiyat_dusenler CAGIRMIYOR', !/get_fiyat_dusenler/.test(URET_T));
  ok('build AYNI secim kodunu cagiriyor: dusenSecHavuzdan(dusenHavuzu())',
     /dusenSecHavuzdan\(\s*dusenHavuzu\(\s*\)\s*\)/.test(URET_T));
}

// ─────────────────────────────────────────────────────────────────────
console.log('\n=== 5. GERCEK VERI ("bugun" = verinin son gunu) ===');
{
  ic(`(() => {
    for (const k of Object.keys(catCache)) delete catCache[k];
    _allLoaded = false; _gecmisCache = null; _gecmisYukleniyor = null;
    _seriCache = new Map(); _puanCache = new Map();
  })()`);
  await ic('loadAllCats()');
  await ic('gecmisVeriGetir()');
  const D = ic('(() => { let m = ""; for (const k in _gecmisCache) for (const e of _gecmisCache[k]) if (e && e.t > m) m = e.t; return m; })()');
  const t0 = Date.now();
  const havuz = ic('dusenHavuzu("' + D + '")');
  const sure = Date.now() - t0;
  console.log(`  (veri gunu ${D}, havuz ${havuz.length} urun, ${sure} ms)`);
  ok('gercek veride havuz DOLU (olculen 693; alt sinir 20)', havuz.length >= 20, havuz.length);
  const Dg = gunNo(D);
  const hatali = [];
  let onceki = Infinity, sirali = true;
  for (const x of havuz) {
    const kartFiyat = Math.min(...x.u.market_fiyatlari.map(f => +f.fiyat).filter(f => f > 0));
    const b = gunNo(x.baslangic);
    if (!(b >= Dg - 6 && b <= Dg)) hatali.push('baslangic ' + x.baslangic + ' ' + x.u._sid);
    if (!(x.yuzde >= 10)) hatali.push('yuzde ' + x.yuzde + ' ' + x.u._sid);
    if (x.kaynak !== 'seri' && x.kaynak !== 'ilan') hatali.push('kaynak ' + x.kaynak);
    if (Math.abs(x.fiyat - kartFiyat) > 0.005) hatali.push('kart ' + x.fiyat + '!=' + kartFiyat + ' ' + x.u._sid);
    if (!(x.normal > x.fiyat)) hatali.push('normal ' + x.normal + '<=' + x.fiyat);
    if (x.yuzde > onceki) sirali = false;
    onceki = x.yuzde;
  }
  ok('her kayit: indirim son 7 gunde basladi, >=%10, kaynak belli, kart fiyati = indirimli fiyat',
     hatali.length === 0, hatali.slice(0, 4).join(' | '));
  ok('havuz indirim yuzdesine gore AZALAN sirali', sirali);
  const secim = cagir('dusenSecHavuzdan(__v)', havuz);
  const say = f => secim.reduce((m, x) => { const k = f(x); m[k] = (m[k] || 0) + 1; return m; }, {});
  ok('gercek veride serit 6 kartla doluyor', secim.length === 6, secim.length);
  ok('  marka tekrari yok', Object.values(say(x => x.u.ad.trim().split(/\s+/)[0].toLocaleLowerCase('tr'))).every(n => n <= 1));
  ok('  tek market en fazla 2 kart', Object.values(say(x => x.market)).every(n => n <= 2), JSON.stringify(say(x => x.market)));
  ok('  alt kategori en fazla 2 kart', Object.values(say(x => x.u.ana_kategori)).every(n => n <= 2));
  ok('tum katalog taramasi build icin makul surede (<20 sn)', sure < 20000, sure + ' ms');
}

// ─────────────────────────────────────────────────────────────────────
console.log('\n=== 6. CIZIM: renderDusenlerSeridi ===');
{
  const DOM = {};
  const yeniEl = () => { const s = new Set(); return { innerHTML: '', style: {}, _s: s,
    classList: { add: c => s.add(c), remove: c => s.delete(c), contains: c => s.has(c),
                 toggle: (c, z) => ((z === undefined ? !s.has(c) : z) ? s.add(c) : s.delete(c)) } }; };
  ctx.document.getElementById = id => (DOM[id] = DOM[id] || yeniEl());
  ctx.__rpc = 0; ctx.__yukle = 0;
  ic('supabaseClient.rpc = function () { __rpc++; return Promise.resolve({ data: [], error: null }); }');
  ic('loadAllCats = async function () { __yukle++; }');
  ic('gecmisVeriGetir = async function () { return _gecmisCache; }');
  ic('supheliPuanlariYukle = async function () { return _puanCache; }');
  const ciz = async (anasayfa) => {
    ctx.__rpc = 0; ctx.__yukle = 0;
    DOM['home-dusenler'] = yeniEl(); DOM['home-dusenler-list'] = yeniEl();
    DOM['home-dusenler'].classList.add('gizli');      // index.html'deki baslangic durumu
    ctx.__a = anasayfa;
    ic('_anasayfaCache = __a');
    await ic('renderDusenlerSeridi()');
    return { html: DOM['home-dusenler-list'].innerHTML, gizli: DOM['home-dusenler'].classList.contains('gizli') };
  };
  const kart = (sid, ad, market, fiyat, yuzde) => ({
    u: { _id: sid, _sid: sid, ad, ana_kategori: 'K-' + sid, resim: null, agirlik_hacim: null,
         en_dusuk_fiyat: fiyat, market_fiyatlari: [{ market, fiyat }] },
    dusus_yuzde: yuzde, market, normal: 100, baslangic: G(2), kaynak: 'seri' });
  {
    const r = await ciz({ surum: 1, dusenler: [kart('r1', 'Rrr Kek', 'migros', 70, 30),
      kart('r2', 'Sss Kek', 'bim', 85, 15), kart('r3', 'Ttt Kek', 'a101', 80, 20)] });
    const n = (r.html.match(/class="strip-card"/g) || []).length;
    ok('onceden hesaplanmis liste ciziliyor (3 kart)', n === 3, 'kart=' + n);
    ok('  rozet MARKETI soyluyor (indirim artik market bazli)', /Migros/.test(r.html) && /BİM/.test(r.html), r.html.slice(0, 200));
    ok('  %25 ve ustu buyuk rozet, alti normal rozet', /buyuk-kisa/.test(r.html) && /normal-kisa/.test(r.html));
    ok('  serit gorunur', !r.gizli);
    ok('  RPC CAGRILMADI', ctx.__rpc === 0, ctx.__rpc);
    ok('  istemcide yeniden hesaplama YOK (katalog inmedi)', ctx.__yukle === 0, ctx.__yukle);
  }
  {
    const r = await ciz({ surum: 1, dusenler: [] });
    ok('bu hafta hic dusen yoksa serit GIZLI ve katalog yine INMEDI', r.gizli && ctx.__yukle === 0,
       'gizli=' + r.gizli + ' yukle=' + ctx.__yukle);
  }
  {
    const r = await ciz({ surum: 1, dusenler: [kart('r4', 'Uuu Kek', '<img src=x>', 70, 30)] });
    ok('market adi KACISLI basiliyor', /&lt;img/.test(r.html) && !/<img src=x>/.test(r.html), r.html.slice(0, 160));
  }
  {
    // GERIYE DUSUS: anasayfa.json yok -> istemcide AYNI kodla hesapla (zam seridiyle ayni yol).
    kur([U('f1', 'Vvv Kek', 'Kek', [{ market: 'migros', fiyat: 70 }])], { f1: dus('migros', 100, 70, 2) });
    const r = await ciz(false);
    ok('anasayfa.json yoksa istemcide hesaplanip ciziliyor', /Vvv Kek/.test(r.html) && !r.gizli && ctx.__yukle === 1,
       'yukle=' + ctx.__yukle + ' ' + r.html.slice(0, 120));
    ok('  geriye dususte de RPC CAGRILMADI', ctx.__rpc === 0, ctx.__rpc);
  }
  {
    kur([U('f2', 'Www Kek', 'Kek', [{ market: 'migros', fiyat: 70 }])], { f2: dus('migros', 100, 70, 2) }, [SUPHE('f2')]);
    const r = await ciz(false);
    ok('geriye dususte hepsi supheliyse serit GIZLI', r.gizli && !/Www Kek/.test(r.html));
  }
}

bitir();
