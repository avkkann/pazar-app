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
// BIRINCI INCELEME DUZELTMELERI (2026-09-11; iki salt-okunur ajan, olculdu):
//  a) supheli puanlari ALINAMAZSA havuz BOS (321 -> 568 supheli sizmasi)
//  b) supheli eleme HAM puana bakar (supheliDurum baska tanima bagliydi)
//  c) rozet URUNUN olagan en ucuzuna gore de olculur, KUCUK olan basilir
//     (Dalin "-%51" -> gercek %11); yalniz BUGUN satan marketler sayilir
//  d) pencere VERININ son gunune bagli (73 urun bir gun erken dusuyordu)
//  e) %50 ve ustu indirim teyit ister (tek gunluk derin dususler kumeleniyor)
//  f) build ve istemci AYNI kayit bicimi (dusenKayit)
//
// IKINCI INCELEME DUZELTMELERI (2026-09-11; 3 bakis + her bulguya curutme
// denemesi, 12 bulgu dogrulandi, 0 curutuldu):
//  g) 1-3 gunluk KESINTI koprulenir: haftalardir suren indirim tek gunluk bir
//     "normal" fiyat (magaza degisimi hayaleti) yuzunden "bu hafta basladi"
//     gorunuyordu (Mowi somon burger 26 gundur indirimdeydi)
//  h) teyit DERIN FIYATIN kac gundur goruldugune ve MARKETIN KENDI dususune
//     bakar (dun %4'luk adim, bugun %60 teyitsiz geciyordu)
//  i) urunun referansi BASKA marketlerin indirimden onceki son 7 gundeki en
//     ucuzunu da gorur (haftalardir 60 TL satan market varken "-%40")
//  j) aykiri fiyat filtresi urun referansini ETKILEMEZ (normal fiyatla satan
//     market "aykiri" sayilip hesaptan dusuyor, rozet buyuyordu)
//  k) tarayicida supheli puanlari SAYFALI (sunucu 1000'de kesiyor, 1431 var)
//  l) build'de puanlar alinamazsa GORUNUR uyari (::warning) ve iki kez daha deneme
//  m) bozuk tarihli tek kayit seridi bosaltmaz; n) dize fiyat sayiya cevrilir
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
const PY = fs.readFileSync(new URL('./indirim_analiz.py', import.meta.url), 'utf8');

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
const sabitDeger = ad => ic('typeof ' + ad + ' === "number" ? ' + ad + ' : null');

// vm host'un console nesnesini kullaniyor (scripts/app-vm.mjs); warn gecici
// olarak degistirilip HER kosulda geri konuyor.
function uyariYakala(fn) {
  const uyari = [];
  const eski = console.warn;
  console.warn = (...a) => { uyari.push(a.map(String).join(' ')); };
  let sonuc;
  try { sonuc = fn(); } finally { console.warn = eski; }
  return { sonuc, uyari };
}
async function uyariYakalaAsync(fn) {
  const uyari = [];
  const eski = console.warn;
  console.warn = (...a) => { uyari.push(a.map(String).join(' ')); };
  let sonuc;
  try { sonuc = await fn(); } finally { console.warn = eski; }
  return { sonuc, uyari };
}

console.log('\n=== 0. ALET: fonksiyonlar var mi ===');
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
// SINIRLAR SABITLENIYOR (inceleme: 60/30/+-5/7 degisse test yesil kaliyordu).
{
  // 07-06..08-04 = 30 gun 100, 08-05..09-03 = 30 gun 97 (97 "indirimde" sayilmaz),
  // 06-01'deki 50 pencerenin DISINDA. Dogru pencere -> normal 100 -> %15.
  // Pencere 30 gun olsaydi (hepsi 97), 90 gun olsaydi (50'ler girer) ya da bu
  // haftayi da kapsasaydi normal 97 cikar -> %12.
  const r = olc(K(['2026-06-01', 50], ['2026-07-06', 100], ['2026-08-05', 97], ['2026-09-08', 85]), 85);
  ok('normal penceresi TAM 60 gun ve bu haftayi KAPSAMIYOR (%15; 30/90 gun ya da hafta dahil %12)',
     r && r.normal === 100 && r.yuzde === 15, JSON.stringify(r));
}
{
  // 08-05..09-03 = TAM 30 bilinen gun; 08-06 -> 29.
  const r = olc(K(['2026-08-05', 100], ['2026-09-08', 80]), 80);
  ok('normal icin TAM 30 bilinen gun yetiyor (seri yolu)', r && r.kaynak === 'seri' && r.yuzde === 20, JSON.stringify(r));
  ok('  29 bilinen gun YETMIYOR (ilan yoksa girmiyor)', olc(K(['2026-08-06', 100], ['2026-09-08', 80]), 80) === null);
}
{
  // Ilan uyusmasi: gorulen fiyat ilanin en fazla %5 USTUNDE olabilir; ALTINDA
  // %3'ten fazlaysa zaten "indirimde" sayilir ve kosu 7 gunden eskiye uzar.
  const i = gor => olc(K(['2026-08-20', gor], ['2026-09-08', 80]), 80, 100);
  const i105 = i(105), i106 = i(106), i97 = i(97), i96 = i(96);
  ok('ilan: gorulen 105 / ilan 100 -> giriyor (+%5 siniri)', i105 && i105.kaynak === 'ilan', JSON.stringify(i105));
  ok('  gorulen 106 -> girmiyor', i106 === null, JSON.stringify(i106));
  ok('  gorulen 97 -> giriyor (-%3 siniri)', i97 && i97.kaynak === 'ilan', JSON.stringify(i97));
  ok('  gorulen 96 -> girmiyor (zaten "indirimde")', i96 === null, JSON.stringify(i96));
}
{
  ok('ilan: indirimden once TAM 7 gun gozlem yetiyor', !!olc(K(['2026-09-01', 100], ['2026-09-08', 80]), 80, 100));
  ok('  6 gun yetmiyor', olc(K(['2026-09-02', 100], ['2026-09-08', 80]), 80, 100) === null);
}
{
  const a = olc(K(['2026-06-01', 100], ['2026-09-07', 80]), 80);
  const b = olc(K(['2026-09-07', 80], ['2026-06-01', 100]), 80);
  ok('kayit SIRASI onemsiz (ters sirali girdi ayni sonuc)', a !== null && JSON.stringify(a) === JSON.stringify(b), JSON.stringify(b));
}
{
  // (g) KISA KESINTI KOPRUSU: 08-21'den beri 80, 09-05'te TEK GUN 99 (99 >= 97,
  // "indirimde" degil), sonra yine 80. Indirim 20 gundur suruyor -> girmemeli.
  ok('1 gunluk kesinti koprulenir: 20 gundur suren indirim "bu hafta" SAYILMIYOR',
     olc(K(['2026-06-01', 100], ['2026-08-21', 80], ['2026-09-05', 99], ['2026-09-06', 80]), 80) === null);
  ok('  3 gunluk kesinti de koprulenir',
     olc(K(['2026-06-01', 100], ['2026-08-21', 80], ['2026-09-03', 100], ['2026-09-06', 80]), 80) === null);
  const r = olc(K(['2026-06-01', 100], ['2026-08-21', 80], ['2026-09-02', 100], ['2026-09-06', 80]), 80);
  ok('  kontrol: 4 gunluk ara GERCEK mola -> yeni indirim bu hafta basladi (09-06)',
     r && r.baslangic === '2026-09-06' && r.yuzde === 20, JSON.stringify(r));
}
{
  // (h) seviyeGun: bugunku fiyat (ya da daha ucuzu) kac gundur goruluyor.
  const r1 = olc(K(['2026-06-01', 100], ['2026-09-09', 96], ['2026-09-10', 40]), 40);
  ok('seviyeGun: dun hafif indirim (96), bugun 40 -> derin fiyat 1 gundur', r1 && r1.seviyeGun === 1 && r1.baslangic === '2026-09-09',
     JSON.stringify(r1));
  const r2 = olc(K(['2026-06-01', 100], ['2026-09-09', 40]), 40);
  ok('  40 iki gundur goruluyor -> 2', r2 && r2.seviyeGun === 2, JSON.stringify(r2));
}
{
  // (n) dize fiyat sayiya cevrilir.
  const r = olc(K(['2026-06-01', '100'], ['2026-09-07', '80']), 80);
  ok('gecmiste DIZE fiyat sayiya cevriliyor (normal sayi, sonuc ayni)',
     r && r.normal === 100 && typeof r.normal === 'number' && r.yuzde === 20, JSON.stringify(r));
}

// ─────────────────────────────────────────────────────────────────────
console.log('\n=== 2. HAVUZ (sentetik katalog) ===');
const G = n => ic('_yerelGunISO(' + n + ')');
function kur(urunler, gecmis, puan) {
  ctx.__u = urunler; ctx.__g = gecmis; ctx.__p = puan === null ? null : (puan || []);
  ic(`(() => {
    for (const k of Object.keys(catCache)) delete catCache[k];
    catCache.test = __u;
    _gecmisCache = __g;
    _seriCache = new Map();
    _puanCache = __p === null ? null : new Map(__p.map(r => [r._sid, r]));
  })()`);
}
const U = (sid, ad, kat, mf) => ({ _id: sid, _sid: sid, ad, ana_kategori: kat, market_fiyatlari: mf,
  en_dusuk_fiyat: Math.min(...mf.map(f => f.fiyat)) });
const dus = (m, eski, yeni, gunOnce) => [{ t: G(90), m, f: eski }, { t: G(gunOnce), m, f: yeni }];
const sabit = (m, f) => [{ t: G(90), m, f }];
const SUPHE = sid => ({ _sid: sid, indirim_supheli_puan: 5, indirim_supheli_sebepler: ['kisa_zirve'] });
const havuz = () => ic('dusenHavuzu()');
const ozet = h => JSON.stringify(h.map(x => ({ s: x.u._sid, y: x.yuzde, n: x.normal, m: x.market })));
{
  kur([U('p1', 'Aaa Bisküvi', 'Bisküvi', [{ market: 'migros', fiyat: 80 }, { market: 'a101', fiyat: 75 }]),
       U('p2', 'Bbb Bisküvi', 'Bisküvi', [{ market: 'migros', fiyat: 80 }, { market: 'a101', fiyat: 100 }])],
      { p1: [...dus('migros', 100, 80, 3), ...sabit('a101', 75)],
        p2: [...dus('migros', 100, 80, 3), ...sabit('a101', 100)] });
  const sid = havuz().map(x => x.u._sid);
  ok('baska market daha ucuzsa (kart o fiyati gosterir) GIRMIYOR', !sid.includes('p1'), sid.join(','));
  ok('  kontrol: indirimli market en ucuzsa GIRIYOR', sid.includes('p2'), sid.join(','));
}
{
  kur([U('p3', 'Ccc Deterjan', 'Deterjan', [{ market: 'migros', fiyat: 70 }, { market: 'carrefour', fiyat: 70 }])],
      { p3: [...dus('migros', 100, 70, 3), ...dus('carrefour', 90, 70, 2)] });
  const h = havuz();
  ok('iki markette dusen urun TEK kayit', h.length === 1, h.length);
  ok('  market: kendi normaline gore en derin dusen (migros %30 > carrefour %22); rozet URUN duzeyi (olagan en ucuz 90 -> 70 = %22)',
     h[0] && h[0].market === 'migros' && h[0].yuzde === 22, h[0] && (h[0].market + ' %' + h[0].yuzde));
}
{
  kur([U('t1', 'Ttt Çay', 'Çay', [{ market: 'sok', fiyat: 80 }])], { t1: dus('sok', 100, 80, 2) });
  ic('catCache.test2 = [catCache.test[0]]');
  ok('ayni urun iki kategoride olsa da havuzda TEK kayit', havuz().length === 1);
}
{
  // DALIN VAKASI: Migros 160 -> 80 (kendi normaline gore %50) ama bugun de
  // satan Carrefour hep 90'di: urunun olagan en ucuzu 90 -> gercek dusus %11.
  // Indirim 2 GUNDUR goruluyor: marketin kendi dususu %50 oldugu icin (h)
  // teyidi ilk gunku karti zaten eler; bu vaka URUN duzeyini olcuyor.
  kur([U('d1', 'Dalin Kolonya', 'Kolonya', [{ market: 'migros', fiyat: 80 }, { market: 'carrefour', fiyat: 90 }])],
      { d1: [...dus('migros', 160, 80, 3), ...sabit('carrefour', 90)], vz: [{ t: G(2), m: 'bim', f: 1 }] });
  const h = havuz();
  ok('rozet URUNUN olagan en ucuzuna gore (Migros kendine gore %50; urun 90 -> 80 = %11)',
     h.length === 1 && h[0].yuzde === 11 && h[0].normal === 90 && h[0].market === 'migros', ozet(h));
}
{
  // (n) ayni Dalin vakasi, gecmis fiyatlari DIZE.
  kur([U('d2', 'Dalin Kolonya', 'Kolonya', [{ market: 'migros', fiyat: 80 }, { market: 'carrefour', fiyat: 90 }])],
      { d2: [{ t: G(90), m: 'migros', f: '160' }, { t: G(3), m: 'migros', f: '80' }, { t: G(90), m: 'carrefour', f: '90' }],
        vz: [{ t: G(2), m: 'bim', f: 1 }] });
  const h = havuz();
  ok('gecmis fiyatlari DIZE olsa da urunun en ucuzu dogru (%11, normal SAYI)',
     h.length === 1 && h[0].yuzde === 11 && h[0].normal === 90 && typeof h[0].normal === 'number', ozet(h));
}
{
  // Yakin alternatif yalniz BASKA marketler: ayni marketin 5 gun once biten
  // eski indirimi (80, sonra 5 gun 100 -- kopru esiginin ustu, gercek mola)
  // bu haftaki yeni indirimi silmemeli.
  kur([U('o2', 'Ooo Makarna', 'Makarna', [{ market: 'migros', fiyat: 80 }])],
      { o2: [{ t: G(90), m: 'migros', f: 100 }, { t: G(12), m: 'migros', f: 80 },
             { t: G(7), m: 'migros', f: 100 }, { t: G(2), m: 'migros', f: 80 }] });
  const h = havuz();
  ok('ayni marketin 5 gun once biten eski indirimi yeni indirimi SILMIYOR (yakin alternatif yalniz baska marketler)',
     h.length === 1 && h[0].yuzde === 20 && h[0].baslangic === G(2), ozet(h));
}
{
  // COLGATE DESENI: Migros 250 -> 130 ama bugun de satan BIM hep 135.
  kur([U('c1', 'Colgate Macun', 'Diş', [{ market: 'migros', fiyat: 130 }, { market: 'bim', fiyat: 135 }])],
      { c1: [...dus('migros', 250, 130, 2), ...sabit('bim', 135)] });
  ok('urunun en ucuz fiyati %10 dusmediyse GIRMIYOR (Migros kendine gore %48 olsa da)', havuz().length === 0);
}
{
  // CIKMIS MARKET: Carrefour gecmiste 60'a satiyordu, BUGUN satmiyor. Gecmiste
  // "cikis" kaydi olmadigi icin carry-forward onu sonsuza tasirdi.
  kur([U('e1', 'Eee Kahve', 'Kahve', [{ market: 'migros', fiyat: 80 }])],
      { e1: [...dus('migros', 100, 80, 2), ...sabit('carrefour', 60)] });
  const h = havuz();
  ok('artik SATMAYAN marketin eski fiyati olagan en ucuza SAYILMIYOR', h.length === 1 && h[0].yuzde === 20, ozet(h));
}
{
  // OMO DESENI + ilan yolu HAVUZ duzeyinde: Migros'un gecmisi kisa, ilan 100 -> 60
  // (%40); bugun de satan Carrefour hep 120 -> urun duzeyinde %50. Rozet KUCUGU.
  kur([U('o1', 'Omo Deterjan', 'Deterjan', [{ market: 'migros', fiyat: 60, liste_fiyat: 100 }, { market: 'carrefour', fiyat: 120 }])],
      { o1: [{ t: G(10), m: 'migros', f: 100 }, { t: G(2), m: 'migros', f: 60 }, ...sabit('carrefour', 120)] });
  const h = havuz();
  ok('ilan yolu HAVUZDA calisiyor ve rozet iki olcunun KUCUGU (%40; urun duzeyi %50 abartirdi)',
     h.length === 1 && h[0].kaynak === 'ilan' && h[0].yuzde === 40 && h[0].normal === 100,
     JSON.stringify(h[0] && { k: h[0].kaynak, y: h[0].yuzde, n: h[0].normal }));
}
{
  // Tek marketli, 18 gunluk gecmisli yeni urun, ilanla: urun referansi icin
  // 30 gun beklenseydi bu urunler seritten duserdi.
  kur([U('i1', 'Iii Kahve', 'Kahve', [{ market: 'migros', fiyat: 60, liste_fiyat: 100 }])],
      { i1: [{ t: G(20), m: 'migros', f: 100 }, { t: G(2), m: 'migros', f: 60 }] });
  const h = havuz();
  ok('tek marketli, 18 gun gecmisli ilan urunu GIRIYOR (%40)', h.length === 1 && h[0].yuzde === 40 && h[0].kaynak === 'ilan', ozet(h));
}
{
  // (i) YAKIN ALTERNATIF: BIM 20 gundur 60 TL; Migros 2 gun once 100 -> 60.
  // Alisverisci o fiyati haftalardir BIM'de odeyebiliyordu -> "bu hafta dustu" DEGIL.
  kur([U('a1', 'Aaa Makarna', 'Makarna', [{ market: 'migros', fiyat: 60 }, { market: 'bim', fiyat: 60 }])],
      { a1: [...dus('migros', 100, 60, 2), ...dus('bim', 100, 60, 22)] });
  ok('baska markette HAFTALARDIR ayni ucuz fiyat varsa GIRMIYOR', havuz().length === 0, ozet(havuz()));
  kur([U('a2', 'Bbb Makarna', 'Makarna', [{ market: 'migros', fiyat: 60 }, { market: 'bim', fiyat: 60 }])],
      { a2: [...dus('migros', 100, 60, 2), ...dus('bim', 100, 60, 1)] });
  const h = havuz();
  ok('  kontrol: BIM ancak Migros dustukten SONRA indi -> GIRIYOR (%40, daha uzun suren Migros)',
     h.length === 1 && h[0].yuzde === 40 && h[0].market === 'migros', ozet(h));
}
{
  // (j) AYKIRI FILTRE: Migros 100 -> 11; BIM hep 56. Iki markette 5 kat kurali
  // BIM'i "aykiri yuksek" sayip gizliyor, ama BIM urunun olagan fiyatinin KANITI.
  kur([U('x1', 'Xxx Deterjan', 'Deterjan', [{ market: 'migros', fiyat: 11 }, { market: 'bim', fiyat: 56 }])],
      { x1: [...dus('migros', 100, 11, 3), ...sabit('bim', 56)], vz: [{ t: G(2), m: 'bim', f: 1 }] });
  const h = havuz();
  ok('aykiri fiyat filtresi urunun referansini ETKILEMIYOR (%80, normal 56; filtreyle %89 cikiyordu)',
     h.length === 1 && h[0].yuzde === 80 && h[0].normal === 56, ozet(h));
}
{
  // Marketler arasi EN UCUZ (siraya bagli degil): Carrefour'un kayitlari ONCE;
  // eski gunlerde 110, son 20 gunde 200. Migros 150 -> 100. Olagan en ucuz 110
  // -> gercek dusus %9 -> girmemeli. "Son islenen market kazanir" hatasi 150 alirdi.
  kur([U('k1', 'Kkk Şampuan', 'Şampuan', [{ market: 'migros', fiyat: 100 }, { market: 'carrefour', fiyat: 200 }])],
      { k1: [{ t: G(90), m: 'carrefour', f: 110 }, { t: G(22), m: 'carrefour', f: 200 },
             { t: G(90), m: 'migros', f: 150 }, { t: G(2), m: 'migros', f: 100 }] });
  ok('urunun olagan en ucuzu marketlerin gunluk EN UCUZU (kayit sirasina bagli degil)', havuz().length === 0, ozet(havuz()));
}
{
  // UST ORTANCA (cift sayi, iki seviye): gunluk en ucuz 33 gun 90 + 33 gun 100.
  kur([U('m1', 'Mmm Süt', 'Süt', [{ market: 'migros', fiyat: 80 }, { market: 'bim', fiyat: 100 }])],
      { m1: [...dus('migros', 100, 80, 2), { t: G(90), m: 'bim', f: 90 }, { t: G(35), m: 'bim', f: 100 }] });
  const h = havuz();
  ok('urun referansi UST ortanca (33 gun 90 + 33 gun 100 -> 100, %20)', h.length === 1 && h[0].yuzde === 20, ozet(h));
}
{
  kur([U('p4', 'Ddd Şampuan', 'Şampuan', [{ market: 'bim', fiyat: 80 }]),
       U('p5', 'Eee Şampuan', 'Şampuan', [{ market: 'bim', fiyat: 80 }])],
      { p4: dus('bim', 100, 80, 3), p5: dus('bim', 100, 80, 3) }, [SUPHE('p4')]);
  const sid = havuz().map(x => x.u._sid);
  ok('sahte indirim SUPHESI olan urun GIRMIYOR ("dikkat" seridinde)', !sid.includes('p4'), sid.join(','));
  ok('  kontrol: ayni desen, suphesiz urun GIRIYOR', sid.includes('p5'), sid.join(','));
}
{
  // (b) HAM PUAN: supheliDurum yalniz 30 gunluk "en ucuz" seride (TUM
  // marketler, cikmislar dahil) indirim gorurse devreye giriyor. Artik satmayan
  // Carrefour'un eski 75'i o seride kaliyor -> dusus %2,7 -> supheliDurum null.
  const urun = U('s1', 'Sss Şampuan', 'Şampuan', [{ market: 'migros', fiyat: 73 }]);
  const g = { s1: [...dus('migros', 100, 73, 3), ...sabit('carrefour', 75)] };
  kur([urun], g, [{ _sid: 's1', indirim_supheli_puan: 6, indirim_supheli_sebepler: ['tekrarli_dongu'] }]);
  ok('  (vaka supheliDurum kapisindan GERCEKTEN kaciyor)', cagir('supheliDurum(__v)', urun) === null);
  ok('supheli PUANI olan urun, supheliDurum rozet cizmese de GIRMIYOR', havuz().length === 0);
  kur([urun], g);
  ok('  kontrol: ayni vaka puansiz GIRIYOR', havuz().length === 1);
}
{
  const u = [U('z1', 'Zzz Kek', 'Kek', [{ market: 'bim', fiyat: 80 }])], g = { z1: dus('bim', 100, 80, 2) };
  kur(u, g, [{ _sid: 'z1', indirim_supheli_puan: 2, indirim_supheli_sebepler: [] }]);
  ok('supheli puani TAM 2 olan urun GIRMIYOR (en kalabalik grup: 598 urun)', havuz().length === 0);
  kur(u, g, [{ _sid: 'z1', indirim_supheli_puan: 1, indirim_supheli_sebepler: [] }]);
  ok('  puani 1 olan GIRIYOR', havuz().length === 1);
}
{
  const urun = [U('n1', 'Nnn Kek', 'Kek', [{ market: 'bim', fiyat: 80 }])], g = { n1: dus('bim', 100, 80, 2) };
  kur(urun, g, null);
  const y = uyariYakala(() => ic('dusenHavuzu()'));
  ok('supheli puanlari ALINAMAZSA havuz BOS (supheliler sessizce giremez)', y.sonuc.length === 0, y.sonuc.length);
  ok('  ve konsola UYARI dusuyor', y.uyari.some(s => /dusenler/.test(s)), y.uyari.join(' | '));
  kur(urun, g, []);
  ok('  kontrol: puanlar yuklendiyse (bos da olsa) ayni urun GIRIYOR', havuz().length === 1);
}
{
  kur([U('p9', 'Iii Makarna', 'Makarna', [{ market: 'bim', fiyat: 50 }])], {});
  let y = null, hata = null;
  try { y = uyariYakala(() => ic('dusenHavuzu()')); } catch (e) { hata = e; }
  ok('fiyat gecmisi BOS yuklendiyse hata yok, havuz bos', !hata && y && y.sonuc.length === 0, hata && hata.message);
  ok('  ve bu durum konsola UYARI olarak dusuyor', !!y && y.uyari.some(s => /dusenler/.test(s)), y && y.uyari.join(' | '));
}
{
  // (m) BOZUK TARIH: baska bir urunde saatli tek bir kayit "veri gunu" olmamali.
  kur([U('b1', 'Bbb Un', 'Un', [{ market: 'bim', fiyat: 80 }])],
      { b1: dus('bim', 100, 80, 2), bozuk: [{ t: G(1) + 'T08:00:00', m: 'bim', f: 5 }] });
  ok('bozuk tarihli TEK kayit seridi BOSALTMIYOR', havuz().length === 1, ozet(havuz()));
}
{
  // Katalog sirasi TERS (p8 once): esitlik bozma kaldirilirsa p8 p7'nin onune gecer.
  kur([U('p8', 'Hhh Süt', 'Süt', [{ market: 'sok', fiyat: 80 }]),
       U('p6', 'Fff Kahve', 'Kahve', [{ market: 'sok', fiyat: 60 }]),
       U('p7', 'Ggg Çay', 'Çay', [{ market: 'sok', fiyat: 160 }])],
      { p6: dus('sok', 100, 60, 2), p7: dus('sok', 200, 160, 2), p8: dus('sok', 100, 80, 2) });
  const sid = havuz().map(x => x.u._sid).join(',');
  ok('siralama: once yuzde, esitlikte TL tasarrufu (katalog sirasi ters olsa da)', sid === 'p6,p7,p8', sid);
}
{
  // Esitlikte TL tasarrufu GOSTERILEN referansa gore: u2 Migros'ta 200 -> 80
  // ama Carrefour hep 100 (gercek tasarruf 20 TL); u1 150 -> 120 (30 TL).
  kur([U('u2', 'Uuu Deterjan', 'Deterjan', [{ market: 'migros', fiyat: 80 }, { market: 'carrefour', fiyat: 100 }]),
       U('u1', 'Vvv Deterjan', 'Deterjan2', [{ market: 'sok', fiyat: 120 }])],
      { u2: [...dus('migros', 200, 80, 3), ...sabit('carrefour', 100)], u1: dus('sok', 150, 120, 2) });
  const sid = havuz().map(x => x.u._sid).join(',');
  ok('esitlikte TL tasarrufu marketin sisik normaline degil GOSTERILEN referansa gore (u1 30 TL > u2 20 TL)', sid === 'u1,u2', sid);
}
{
  kur([U('y1', 'Yyy Un', 'Un', [{ market: 'a101', fiyat: 84.5 }])], { y1: dus('a101', 100, 84.5, 2) });
  const h = havuz();
  ok('yuzde YUVARLANIYOR (100 -> 84,5 = %15,5 -> 16)', h.length === 1 && h[0].yuzde === 16, h[0] && h[0].yuzde);
}
{
  // YUVARLAMA SINIRLARI: %10 esigi yuvarlamadan ONCE, kayan nokta payiyla.
  kur([U('r1', 'Rrr Un', 'Un', [{ market: 'migros', fiyat: 81 }, { market: 'carrefour', fiyat: 89.9 }])],
      { r1: [...dus('migros', 100, 81, 2), ...sabit('carrefour', 89.9)] });
  ok('gercek dusus %9,9 -> GIRMIYOR (yuvarlanip %10 sayilmiyor)', havuz().length === 0, ozet(havuz()));
  kur([U('r2', 'Sss Un', 'Un', [{ market: 'migros', fiyat: 9.09 }, { market: 'carrefour', fiyat: 10.10 }])],
      { r2: [...dus('migros', 13.13, 9.09, 2), ...sabit('carrefour', 10.10)] });
  const h = havuz();
  ok('  tam %10 (kayan noktada 9,999...) -> GIRIYOR', h.length === 1 && h[0].yuzde === 10, ozet(h));
}
{
  // PENCERE VERININ SON GUNUNE BAGLI: veri 2 gun once bitiyor, indirim 8 gun
  // once basladi -> verinin gunune gore 6 gun: "bu hafta".
  kur([U('v1', 'Vvv Makarna', 'Makarna', [{ market: 'bim', fiyat: 80 }])],
      { v1: dus('bim', 100, 80, 8), vz: [{ t: G(2), m: 'bim', f: 5 }] });
  ok('varsayilan "bugun" = VERININ son gunu (indirim 8 gun once, veri 2 gun once bitiyor -> GIRIYOR)', havuz().length === 1);
  ok('  kontrol: duvar saatiyle verilince 7 gunu asiyor -> girmiyor', ic('dusenHavuzu("' + G(0) + '")').length === 0);
  kur([U('v2', 'Www Makarna', 'Makarna', [{ market: 'bim', fiyat: 80 }])],
      { v2: dus('bim', 100, 80, 6), vz: [{ t: G(-5), m: 'bim', f: 5 }] });
  ok('gelecek tarihli BOZUK kayit pencereyi ileri itmiyor (bugunle sinirli)', havuz().length === 1);
}
{
  // TEYIT: marketin KENDI dususu %50 ve ustuyse (indirim_analiz.py'nin "asiri
  // yuksek oran" siniri) DERIN fiyat en az 2 gundur gorulmeli.
  const T = (sid, yeni, veriGunu) => {
    const g = { [sid]: dus('migros', 100, yeni, 2) };
    if (veriGunu != null) g.vz = [{ t: G(veriGunu), m: 'bim', f: 1 }];
    kur([U(sid, 'T' + sid + ' Deterjan', 'Deterjan', [{ market: 'migros', fiyat: yeni }])], g);
    return havuz().map(x => x.yuzde).join(',');
  };
  ok('%60 indirim YALNIZ son gun goruldu -> girmiyor (teyit bekliyor)', T('w1', 40) === '');
  ok('  ayni indirim IKINCI gununde -> giriyor', T('w2', 40, 1) === '60');
  ok('  sinir: tam %50 de teyit istiyor', T('w3', 50) === '');
  ok('  %40 teyit istemiyor (ilk gun giriyor)', T('w4', 60) === '40');
  ok('  %49,6 yuvarlaninca %50 -> teyit istiyor', T('w5', 50.4) === '');
  ok('  %49,4 yuvarlaninca %49 -> ilk gun giriyor', T('w6', 50.6) === '49');
}
{
  // (h) dun %4'luk adim (96), bugun 40: kosu dun basladi ama DERIN fiyat 1 gunluk.
  kur([U('h1', 'Hhh Deterjan', 'Deterjan', [{ market: 'migros', fiyat: 40 }])],
      { h1: [{ t: G(90), m: 'migros', f: 100 }, { t: G(3), m: 'migros', f: 96 }, { t: G(2), m: 'migros', f: 40 }] });
  ok('teyit DERIN fiyatin kac gundur goruldugune bakiyor (dun hafif indirim, bugun %60 -> girmiyor)', havuz().length === 0, ozet(havuz()));
}
{
  // (h) Migros bugun 100 -> 20 (kendi dususu %80), BIM hep 36 -> gosterilen %44.
  // Hata olabilecek tek gunluk fiyat teyitsiz kartta basilmamali.
  const u = [U('h2', 'Hhh Kahve', 'Kahve', [{ market: 'migros', fiyat: 20 }, { market: 'bim', fiyat: 36 }])];
  kur(u, { h2: [...dus('migros', 100, 20, 2), ...sabit('bim', 36)] });
  ok('teyit MARKETIN KENDI dususune bakiyor (%80 ilk gun; gosterilen %44 olsa da girmiyor)', havuz().length === 0, ozet(havuz()));
  kur(u, { h2: [...dus('migros', 100, 20, 2), ...sabit('bim', 36)], vz: [{ t: G(1), m: 'bim', f: 1 }] });
  const h = havuz();
  ok('  ikinci gunde giriyor (%44)', h.length === 1 && h[0].yuzde === 44, ozet(h));
}
{
  // Esit yuzdede market secimi SIRAYA BAGLI DEGIL: ikisi de 100 -> 40; Migros
  // bugun indi (1 gun), Carrefour 4 gundur. Daha uzun gorulen secilir (teyitli).
  const g = { e2: [...dus('migros', 100, 40, 1), ...dus('carrefour', 100, 40, 4)] };
  for (const sira of [['migros', 'carrefour'], ['carrefour', 'migros']]) {
    kur([U('e2', 'Eee Deterjan', 'Deterjan', sira.map(m => ({ market: m, fiyat: 40 })))], g);
    const h = havuz();
    ok('esit yuzdede daha uzun suren market secilir (sira ' + sira.join('>') + ')',
       h.length === 1 && h[0].market === 'carrefour' && h[0].yuzde === 60, ozet(h));
  }
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
  ok('hepsi supheliyse havuz BOS', havuz().length === 0);
}

// ─────────────────────────────────────────────────────────────────────
console.log('\n=== 3. SECIM: cesitlilik (marka<=1, alt kategori<=2, market<=3), 12 kart ===');
const A = (ad, kat, market, yuzde) => ({ u: { ad, ana_kategori: kat }, market, yuzde });
const sec = h => cagir('dusenSecHavuzdan(__v)', h).map(x => x.u.ad);
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
  // 6 kartta sinir 2'ydi (ilk 6'nin 6'si Carrefour cikiyordu). 12 kartta 3:
  // 2'de kalsa 12. kart havuzun dibinden gelirdi (olcum app.js yorumunda).
  ok('ayni marketten EN FAZLA 3 (12 kart)', s.length === 4 && s.includes('Ff Ürün')
     && s.filter(a => a !== 'Ff Ürün').join(',') === 'Aa Ürün,Bb Ürün,Cc Ürün', s.join(' | '));
}
{
  const s = sec(['Aa', 'Bb', 'Cc'].map((b, i) => A(b + ' Süt', 'Süt', ['bim', 'sok', 'a101'][i], 50 - i)));
  ok('ayni alt kategoriden EN FAZLA 2', s.length === 2, s.join(' | '));
}
{
  const mk = ['migros', 'carrefour', 'a101', 'bim', 'sok', 'hakmar', 'tarim_kredi'];
  const s = sec(Array.from({ length: 20 }, (_, i) => A('M' + i + ' Ürün', 'K' + i, mk[i % 7], 90 - i)));
  ok('en fazla DUSENLER_KART (12) kart', s.length === 12, s.length);
  ok('  sira korunuyor (en yuksek indirimden basliyor)',
     s.join(',') === Array.from({ length: 12 }, (_, i) => 'M' + i + ' Ürün').join(','), s.join(','));
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
console.log('\n=== 4. ESKI RPC YOLU EMEKLI + TEK KAYNAK SOZLESMELERI ===');
{
  const APP_T = kodTemiz(APP), URET_T = kodTemiz(URET);
  ok('app.js get_fiyat_dusenler CAGIRMIYOR', !/get_fiyat_dusenler/.test(APP_T));
  ok('  olu sabit DUSENLER_RPC_LIMIT kalkti', !/DUSENLER_RPC_LIMIT/.test(APP_T));
  ok('build (anasayfa-uret) get_fiyat_dusenler CAGIRMIYOR', !/get_fiyat_dusenler/.test(URET_T));
  // Havuz BIR KEZ hesaplaniyor: serit (secim) ve Firsatlar > "Bu hafta dusenler"
  // sekmesinin tam listesi AYNI havuzdan. Iki ayri cagri iki ayri sonuc
  // verebilirdi (bkz. "iki kaynak = kacinilmaz sapma").
  ok('build havuzu BIR KEZ hesapliyor (serit ve tam liste AYNI havuzdan)',
     (URET_T.match(/dusenHavuzu\(/g) || []).length === 1 && /__dusenHavuz\s*=\s*dusenHavuzu\(\s*\)/.test(URET_T),
     'dusenHavuzu( sayisi=' + (URET_T.match(/dusenHavuzu\(/g) || []).length);
  ok('  serit: AYNI secim kodu dusenSecHavuzdan(havuz)', /dusenSecHavuzdan\(\s*__dusenHavuz\s*\)/.test(URET_T));
  // Iddia DIZEYE degil YAZMA HEDEFINE bagli: onceki hali kaynakta
  // "data/dusenler.json" dizesini ariyordu ve console.log satiri da o dizeyi
  // tasidigi icin dosya adi degistirilse bile YESIL kaliyordu (prove-by-breaking
  // 2026-09-12'de yakaladi -- guard kor).
  // "OLCULEMEDI" ile "OLCULDU, SIFIR" ayrimi VERIDE tasiniyor: bayrak build'de
  // _puanCache'ten turuyor. Sabit true yazilirsa istemci altyapi arizasini
  // "bu hafta hic dusen yok" diye OLCULMUS bir iddiaya cevirir.
  ok('  build "olculdu" bayragini _puanCache\'ten yaziyor',
     /const dusenOlculdu = ic\('!!_puanCache'\)/.test(URET_T) && /olculdu:\s*dusenOlculdu/.test(URET_T));
  ok('  tam liste: havuzun TAMAMI, data/dusenler.json\'a yaziliyor',
     /__dusenHavuz\.map\(/.test(URET_T)
     && /const dusenHedef = D\('data\/dusenler\.json'\)/.test(URET_T)
     && /writeFileSync\(\s*dusenHedef,[\s\S]{0,220}dusenler:\s*dusenTum/.test(URET_T));
  // Build'in yazdigi alan adi degisse rozet "-%undefined" olurdu; cizim testi
  // kendi verisini kurdugu icin gormezdi. Bicim tek fonksiyonda.
  ok('build ve istemci AYNI kayit bicimi: dusenKayit (alan adi tek yerde)',
     /dusenKayit\(/.test(URET_T) && /dusenKayit\(/.test(kodTemiz(govde('renderDusenlerSeridi'))));
  const kk = ic('typeof dusenKayit') === 'function'
    ? cagir('dusenKayit(__v)', { u: {}, yuzde: 30, market: 'migros', normal: 100, baslangic: '2026-09-09', kaynak: 'seri' }) : null;
  ok('  dusenKayit cizimin okudugu alanlari veriyor (dusus_yuzde, market), karti tasimiyor',
     !!kk && kk.dusus_yuzde === 30 && kk.market === 'migros' && kk.normal === 100 && !('u' in kk), JSON.stringify(kk));
  const esik = /indirim_supheli_puan\s*<\s*(\d+)/.exec(govde('supheliDurum'));
  ok('supheli puan esigi supheliDurum ile AYNI (DUSEN_SUPHE_PUAN)',
     !!esik && +esik[1] === sabitDeger('DUSEN_SUPHE_PUAN'), (esik && esik[1]) + ' vs ' + sabitDeger('DUSEN_SUPHE_PUAN'));
  const iA = PY.indexOf('"asiri_yuksek_oran"');
  const pyEsik = /dusus_yuzde\s*>=\s*(\d+)/.exec(PY.slice(Math.max(0, iA - 200), iA));
  ok('teyit esigi indirim_analiz.py "asiri yuksek oran" siniriyla AYNI (DUSEN_TEYIT_YUZDE)',
     !!pyEsik && +pyEsik[1] === sabitDeger('DUSEN_TEYIT_YUZDE'), (pyEsik && pyEsik[1]) + ' vs ' + sabitDeger('DUSEN_TEYIT_YUZDE'));
  // (l) Build puanlari BEKLEYEREK ve dusenler'den ONCE yuklemeli: yoksa
  // (a) kurali geregi serit her gun bos cikardi.
  const iPuan = URET_T.search(/await\s+ic\(\s*'supheliPuanlariYukle\(\)'\s*\)/);
  const iDus = URET_T.search(/dusenHavuzu\(\s*\)/);
  ok('build supheli puanlarini BEKLEYEREK ve dusenler hesabindan ONCE yukluyor', iPuan >= 0 && iPuan < iDus, iPuan + ' / ' + iDus);
  ok('build puanlari alamazsa CI\'da GORUNUR uyari basiyor (::warning), sessiz degil',
     /::warning/.test(URET_T) && /_puanCache/.test(URET_T.slice(Math.max(0, URET_T.indexOf('::warning') - 400), URET_T.indexOf('::warning') + 50)));
}

// ─────────────────────────────────────────────────────────────────────
console.log('\n=== 4b. SUPHE PUANLARI YUKLEYICI (gercek fonksiyon, sahte sunucu) ===');
{
  // Sahte sunucu gercegi gibi: Range yoksa ilk 1000 satiri, varsa istenen
  // dilimi (en fazla 1000) veriyor. araligiYoksay: sunucu range'i dinlemezse.
  const sahteFrom = (toplam, hata, araligiYoksay) => function () {
    const q = { _bas: null, _son: null,
      select() { return q; }, gte() { return q; }, order() { return q; }, limit() { return q; },
      range(a, b) { if (!araligiYoksay) { q._bas = a; q._son = b; } return q; },
      then(res, rej) {
        if (hata) return Promise.resolve({ data: null, error: { message: hata } }).then(res, rej);
        const bas = q._bas == null ? 0 : q._bas;
        const son = Math.min(q._son == null ? bas + 999 : q._son, bas + 999, toplam - 1);
        const data = [];
        for (let i = bas; i <= son; i++) data.push({ _sid: 'x' + i, indirim_supheli_puan: 2, indirim_supheli_sebepler: [], indirim_supheli_dusus_yuzde: 10 });
        return Promise.resolve({ data, error: null }).then(res, rej);
      } };
    return q;
  };
  ctx.__eskiFrom = ic('window.supabaseClient.from');
  const dene = async (toplam, hata, araligiYoksay) => {
    ctx.__sahteFrom = sahteFrom(toplam, hata, araligiYoksay);
    ic('window.supabaseClient.from = __sahteFrom; _puanCache = null');
    return uyariYakalaAsync(() => ic('supheliPuanlariYukle()'));
  };
  try {
    let y = await dene(1431);
    ok('puanlar SAYFALI iniyor: 1431 satirin HEPSI (sunucu tek istekte 1000 veriyor)', ic('_puanCache ? _puanCache.size : -1') === 1431,
       ic('_puanCache ? _puanCache.size : -1'));
    y = await dene(0, 'sahte 503');
    ok('sunucu hata donerse null ve konsola UYARI', y.sonuc === null && y.uyari.some(s => /\[supheli\]/.test(s)), y.uyari.join(' | '));
    y = await dene(5000, null, true);
    ok('sunucu araligi DINLEMEZSE sonsuz dongu yok: null + UYARI (yarim liste kullanilmiyor)',
       y.sonuc === null && ic('_puanCache') === null && y.uyari.some(s => /\[supheli\]/.test(s)), y.uyari.join(' | '));
  } finally {
    ic('window.supabaseClient.from = __eskiFrom; _puanCache = null');
  }
}

// ─────────────────────────────────────────────────────────────────────
console.log('\n=== 5. GERCEK VERI ===');
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
  const hv = ic('dusenHavuzu("' + D + '")');
  const sure = Date.now() - t0;
  console.log(`  (veri gunu ${D}, havuz ${hv.length} urun, ${sure} ms)`);
  ok('gercek veride havuz DOLU (alt sinir 20)', hv.length >= 20, hv.length);
  ok('varsayilan yol (build ve istemci) VERI GUNUYLE birebir ayni',
     ic('dusenHavuzu()').map(x => x.u._sid).join() === hv.map(x => x.u._sid).join());
  const Dg = gunNo(D);
  const hatali = [];
  let onceki = Infinity, sirali = true;
  for (const x of hv) {
    const kartFiyat = Math.min(...x.u.market_fiyatlari.map(f => +f.fiyat).filter(f => f > 0));
    const b = gunNo(x.baslangic);
    if (!(b >= Dg - 6 && b <= Dg)) hatali.push('baslangic ' + x.baslangic + ' ' + x.u._sid);
    if (!(x.yuzde >= 10)) hatali.push('yuzde ' + x.yuzde + ' ' + x.u._sid);
    if (x.kaynak !== 'seri' && x.kaynak !== 'ilan') hatali.push('kaynak ' + x.kaynak);
    if (Math.abs(x.fiyat - kartFiyat) > 0.005) hatali.push('kart ' + x.fiyat + '!=' + kartFiyat + ' ' + x.u._sid);
    if (!(x.normal > x.fiyat)) hatali.push('normal ' + x.normal + '<=' + x.fiyat);
    if (typeof x.normal !== 'number') hatali.push('normal sayi degil ' + x.u._sid);
    const beklenen = Math.round(Math.min((x.pazarNormal - x.fiyat) / x.pazarNormal, (x.urunNormal - x.fiyat) / x.urunNormal) * 100);
    if (x.yuzde !== beklenen) hatali.push('yuzde ' + x.yuzde + ' != iki olcunun kucugu ' + beklenen + ' ' + x.u._sid);
    if (typeof x.pazarYuzde !== 'number' || typeof x.seviyeGun !== 'number') hatali.push('pazarYuzde/seviyeGun eksik ' + x.u._sid);
    else if (x.pazarYuzde >= 50 && x.seviyeGun < 2) hatali.push('teyitsiz %' + x.pazarYuzde + ' ' + x.u._sid);
    if (x.yuzde > onceki) sirali = false;
    onceki = x.yuzde;
  }
  ok('her kayit: son 7 gunde basladi, >=%10, kart fiyati = indirimli fiyat, rozet iki olcunun KUCUGU, %50+ teyitli',
     hatali.length === 0, hatali.slice(0, 4).join(' | '));
  ok('havuz indirim yuzdesine gore AZALAN sirali', sirali);
  const secim = cagir('dusenSecHavuzdan(__v)', hv);
  // Bagimsiz hesap: ayni kurallar elle. "Tam 6 kart" beklemek YANLIS KIRMIZI
  // verebilirdi (indirimler 2 markette toplanirsa kural geregi daha az kart).
  const lim = { kart: sabitDeger('DUSENLER_KART'), marka: sabitDeger('DUSEN_MARKA_MAX'),
                kat: sabitDeger('DUSEN_KAT_MAX'), market: sabitDeger('DUSEN_MARKET_MAX') };
  const beklenenSecim = [], sM = {}, sK = {}, sP = {};
  for (const x of hv) {
    if (beklenenSecim.length >= lim.kart) break;
    const m = String(x.u.ad).trim().split(/\s+/)[0].toLocaleLowerCase('tr'), k = x.u.ana_kategori || '', p = x.market || '';
    if ((sM[m] || 0) >= lim.marka || (sK[k] || 0) >= lim.kat || (sP[p] || 0) >= lim.market) continue;
    sM[m] = (sM[m] || 0) + 1; sK[k] = (sK[k] || 0) + 1; sP[p] = (sP[p] || 0) + 1;
    beklenenSecim.push(x.u._sid);
  }
  ok('secim BAGIMSIZ bir hesapla birebir ayni', secim.map(x => x.u._sid).join() === beklenenSecim.join(),
     secim.map(x => x.u._sid).join() + ' vs ' + beklenenSecim.join());
  ok('  gercek veride en az 1 kart var', secim.length >= 1, secim.length);
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
  ctx.__rpc = 0; ctx.__yukle = 0; ctx.__puanHazir = [];
  ic('supabaseClient.rpc = function () { __rpc++; return Promise.resolve({ data: [], error: null }); }');
  ic('loadAllCats = async function () { __yukle++; }');
  ic('gecmisVeriGetir = async function () { return _gecmisCache; }');
  // Puanlar GERCEKTEN yuklenmeli: cizim once null baslatiliyor, bu sahte
  // yukleyici cagrilmazsa _puanCache null kalir ve (a) geregi havuz bos cikar.
  ic('supheliPuanlariYukle = async function () { if (!_puanCache) _puanCache = new Map(__puanHazir); return _puanCache; }');
  // gizliBasla: gorunurluk degisiminin GERCEKTEN yapildigini olcmek icin olumlu
  // vakalar gizli, olumsuz vakalar gorunur ve ESKI kartla basliyor.
  const ciz = async (anasayfa, gizliBasla) => {
    ctx.__rpc = 0; ctx.__yukle = 0;
    DOM['home-dusenler'] = yeniEl(); DOM['home-dusenler-list'] = yeniEl();
    if (gizliBasla) DOM['home-dusenler'].classList.add('gizli');
    DOM['home-dusenler-list'].innerHTML = 'ESKI_KART';
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
    ic('delete productMap["r1"]; delete productMap["r3"]');
    const r = await ciz({ surum: 1, dusenler: [kart('r1', 'Rrr Kek', 'migros', 70, 30),
      kart('r2', 'Sss Kek', 'bim', 85, 15), kart('r3', 'Ttt Kek', 'a101', 80, 20)] }, true);
    const n = (r.html.match(/class="strip-card"/g) || []).length;
    ok('onceden hesaplanmis liste ciziliyor (3 kart, eski kart gitti)', n === 3 && !/ESKI_KART/.test(r.html), 'kart=' + n);
    ok('  rozet MARKETI soyluyor', /Migros/.test(r.html) && /BİM/.test(r.html), r.html.slice(0, 200));
    ok('  serit GIZLI basladi, gorunur oldu', !r.gizli);
    ok('  kartlar productMap\'e KAYITLI (dokununca detay acilsin)', ic('!!productMap["r1"] && !!productMap["r3"]'));
    ok('  RPC CAGRILMADI', ctx.__rpc === 0, ctx.__rpc);
    ok('  istemcide yeniden hesaplama YOK (katalog inmedi)', ctx.__yukle === 0, ctx.__yukle);
  }
  {
    const r25 = await ciz({ surum: 1, dusenler: [kart('r5', 'Xxx Kek', 'bim', 75, 25)] }, true);
    const r24 = await ciz({ surum: 1, dusenler: [kart('r6', 'Yyy Kek', 'bim', 76, 24)] }, true);
    ok('rozet siniri: tam %25 BUYUK, %24 normal',
       /buyuk-kisa/.test(r25.html) && !/normal-kisa/.test(r25.html) && /normal-kisa/.test(r24.html) && !/buyuk-kisa/.test(r24.html));
  }
  {
    const r = await ciz({ surum: 1, dusenler: [] }, false);
    ok('bu hafta hic dusen yoksa serit GIZLENIYOR (gorunur basladi) ve katalog INMEDI', r.gizli && ctx.__yukle === 0,
       'gizli=' + r.gizli + ' yukle=' + ctx.__yukle);
  }
  {
    const r = await ciz({ surum: 1, dusenler: [kart('r4', 'Uuu Kek', '<img src=x>', 70, 30)] }, true);
    ok('market adi KACISLI basiliyor', /&lt;img/.test(r.html) && !/<img src=x>/.test(r.html), r.html.slice(0, 160));
  }
  {
    // GERIYE DUSUS: anasayfa.json yok -> istemcide AYNI kodla hesapla (zam seridiyle ayni yol).
    kur([U('f1', 'Vvv Kek', 'Kek', [{ market: 'migros', fiyat: 70 }])], { f1: dus('migros', 100, 70, 2) });
    ic('_puanCache = null; delete productMap["f1"]');
    ctx.__puanHazir = [];
    const r = await ciz(false, true);
    ok('anasayfa.json yoksa istemcide hesaplanip ciziliyor (puanlar ONCE yukleniyor)',
       /Vvv Kek/.test(r.html) && !r.gizli && ctx.__yukle === 1, 'yukle=' + ctx.__yukle + ' ' + r.html.slice(0, 120));
    ok('  rozet dusenKayit alanlarindan (-%30 Migros)', /-%30/.test(r.html) && /Migros/.test(r.html), r.html.slice(0, 200));
    ok('  geriye dususte de kart productMap\'e KAYITLI', ic('!!productMap["f1"]'));
    ok('  geriye dususte de RPC CAGRILMADI', ctx.__rpc === 0, ctx.__rpc);
  }
  {
    kur([U('f2', 'Www Kek', 'Kek', [{ market: 'migros', fiyat: 70 }])], { f2: dus('migros', 100, 70, 2) });
    ic('_puanCache = null');
    ctx.__puanHazir = [['f2', SUPHE('f2')]];
    const r = await ciz(false, false);
    ok('geriye dususte hepsi supheliyse serit GIZLENIYOR', r.gizli && !/Www Kek/.test(r.html));
  }
}

// ─────────────────────────────────────────────────────────────────────
console.log('\n=== 7. SERIT 12 KART + "TUMUNU GOR" + FIRSATLAR > BU HAFTA DUSENLER ===');
{
  const HTML = fs.readFileSync(new URL('./index.html', import.meta.url), 'utf8');
  const SW = fs.readFileSync(new URL('./sw.js', import.meta.url), 'utf8');
  const GI = fs.readFileSync(new URL('./.gitignore', import.meta.url), 'utf8');
  const APP_T = kodTemiz(APP);
  const HTML_Y = HTML.replace(/<!--[\s\S]*?-->/g, '');

  ok('serit 12 kart (DUSENLER_KART)', sabitDeger('DUSENLER_KART') === 12, sabitDeger('DUSENLER_KART'));
  ok('  12 kartta market siniri 3 (DUSEN_MARKET_MAX)', sabitDeger('DUSEN_MARKET_MAX') === 3, sabitDeger('DUSEN_MARKET_MAX'));

  // (a) MARKUP: dugme seridin BASLIGINDA, sekme Firsatlar'in sekme cubugunda.
  const serit = (HTML_Y.match(/<div id="home-dusenler"[\s\S]*?id="home-dusenler-list"/) || [''])[0];
  const tumu = (serit.match(/<button[^>]*data-firsat-sekme="dusen"[^>]*>[^<]*<\/button>/) || [''])[0];
  ok('seritte "Tumunu gor" dugmesi var, Firsatlar > dusen sekmesine bagli', /Tümünü gör/.test(tumu), serit.slice(0, 300));
  ok('  <button type="button">', /type="button"/.test(tumu), tumu);
  ok('  satir ici olay ozniteligi YOK (sayac kilidi)', tumu !== '' && !/\son[a-z]+=/i.test(tumu), tumu);
  ok('  44px dokunma hedefi olan mevcut sinif (.home-strip-paylas)', /class="home-strip-paylas"/.test(tumu), tumu);
  const sekmeler = (HTML_Y.match(/<div class="firsat-tabs">[\s\S]*?<\/div>/) || [''])[0];
  ok('Firsatlar\'da "Bu hafta dusenler" sekmesi var (data-tab, delegasyon)',
     /<button class="firsat-tab" data-tab="dusen">[^<]*Bu hafta düşenler<\/button>/.test(sekmeler), sekmeler.slice(0, 400));
  ok('  "Tumunu gor" dinleyicisi kayitli (document, tek)', /document\.addEventListener\('click',\s*_firsatSekmesineGit\)/.test(APP_T));

  // (b) VERI SOZLESMESI: tam liste tembel, onbellege ve depoya girmiyor.
  ok('data/dusenler.json sw.js onbellegine ALINMIYOR (tembel)', !/dusenler/.test(SW));
  ok('  saf build ciktisi, depoya alinmiyor (.gitignore)', /^data\/dusenler\.json\s*$/m.test(GI));
  const iDU = APP_T.indexOf("'DATA_UPDATED'");
  const du = iDU >= 0 ? APP_T.slice(iDU, APP_T.indexOf('loadData()', iDU)) : '';
  ok('  veri degisince (DATA_UPDATED) tam liste bellegi bosaltiliyor', /_dusenTumCache\s*=\s*null/.test(du), du.slice(0, 160));

  // DOM taklidi: sekme dugmeleri + kaplar.
  const DOM = {};
  const yeniEl = ek => { const s = new Set(); return Object.assign({ innerHTML: '', value: 'eski', style: {}, dataset: {}, _s: s,
    classList: { add: c => s.add(c), remove: c => s.delete(c), contains: c => s.has(c),
                 toggle: (c, z) => ((z === undefined ? !s.has(c) : z) ? s.add(c) : s.delete(c)) } }, ek || {}); };
  const TABS = ['ucuz', 'tasarruf', 'zam', 'dusen'].map(t => yeniEl({ dataset: { tab: t } }));
  const aktifler = () => TABS.filter(t => t.classList.contains('active')).map(t => t.dataset.tab).join();
  ctx.document.getElementById = id => (DOM[id] = DOM[id] || yeniEl());
  ctx.document.querySelectorAll = sel => (String(sel).indexOf('.firsat-tab') === 0 ? TABS : []);
  ctx.btoa = globalThis.btoa;   // _firsatKartHtml'in sepet dugmesi (tarayicida zaten var)
  // ZAMANA DEGIL KOSULA BAGLI BEKLEME. Sabit 20 ms, makine mesgulken (tarayici
  // olcumu ayni anda kosarken) YANLIS KIRMIZI verebiliyordu -- bu depoda
  // "alet artefakti" diye kayitli sinif. Olumlu vakalar KOSULU bekliyor;
  // "hicbir sey olmamali" diyen olumsuz vakalar sabit ama GENIS bekliyor.
  const tik = (ms = 250) => new Promise(r => setTimeout(r, ms));
  const bekle = async (kosul, ms = 4000) => {
    const t0 = Date.now();
    while (Date.now() - t0 < ms) { if (kosul()) return true; await new Promise(r => setTimeout(r, 5)); }
    return false;
  };

  // (c) DAVRANIS: dokunus sekmeyi ISARETLEYIP Firsatlar'i BIR KEZ ciziyor.
  const varGit = ic('typeof _firsatSekmesineGit') === 'function';
  ok('_firsatSekmesineGit tanimli', varGit);
  if (varGit) {
    ctx.__gs = ic('showScreen'); ctx.__gr = ic('renderFirsatlar');
    ctx.__ekran = []; ctx.__cizim = [];
    ic('showScreen = function (id) { __ekran.push(id); }');
    ic('renderFirsatlar = function (t) { __cizim.push(t); }');
    const olay = hedef => ({ target: { closest: s => (s === '[data-firsat-sekme]' ? hedef : null) } });
    TABS[0].classList.add('active');
    ic('_firsatAktifTab = "ucuz"');
    ctx.__o = olay(null); ic('_firsatSekmesineGit(__o)');
    ok('kontrol: dugme disina dokunmak HICBIR SEY yapmiyor',
       ctx.__ekran.length === 0 && ctx.__cizim.length === 0 && ic('_firsatAktifTab') === 'ucuz' && aktifler() === 'ucuz');
    DOM['firsatArama'] = yeniEl();
    ctx.__o = olay({ dataset: { firsatSekme: 'dusen' } }); ic('_firsatSekmesineGit(__o)');
    ok('"Tumunu gor": aktif sekme dusen', ic('_firsatAktifTab') === 'dusen', ic('_firsatAktifTab'));
    ok('  sekme cubugunda YALNIZ dusen isaretli', aktifler() === 'dusen', aktifler());
    ok('  Firsatlar ekrani acildi', ctx.__ekran.join() === 'screen-firsatlar', ctx.__ekran.join());
    ok('  liste BIR KEZ ve dusen olarak ciziliyor (once isaretle, sonra ciz)', ctx.__cizim.join() === 'dusen', ctx.__cizim.join());
    ok('  alt menude Firsatlar isaretli', !!DOM['navFirsat'] && DOM['navFirsat'].classList.contains('active'));
    ok('  ay cipleri gizli (yalniz Zamlananlar\'da)', !!DOM['firsatAylar'] && DOM['firsatAylar'].classList.contains('gizli'));
    ok('  arama kutusu temizlendi', DOM['firsatArama'].value === '', DOM['firsatArama'].value);
    // SEKME CUBUGU KAYDIRMASI: sahte DOM olculebilir hale getiriliyor. Onceki
    // hali offsetLeft/clientWidth tasimadigi icin _firsatSekmeGorunur SESSIZCE
    // erken donuyordu -- yani yardimci hic test EDILMIYORDU (inceleme
    // 2026-09-12). Gercek tarayicida 375px'te cubuk 140px kaydirilmisti.
    const cubuk = { clientWidth: 300, scrollLeft: 0 };
    TABS.forEach((t, i) => { t.parentElement = cubuk; t.offsetLeft = i * 120; t.offsetWidth = 120; });
    ic('_firsatAktifTab = "ucuz"');
    ic('_firsatSekmesineGit(__o)');
    ok('dar ekranda sekme cubugu KAYDIRILIYOR (4. sekme gorunur oluyor)',
       cubuk.scrollLeft === 180
       && TABS[3].offsetLeft >= cubuk.scrollLeft
       && TABS[3].offsetLeft + TABS[3].offsetWidth <= cubuk.scrollLeft + cubuk.clientWidth,
       'scrollLeft=' + cubuk.scrollLeft);
    cubuk.scrollLeft = 0; cubuk.clientWidth = 600;
    ic('_firsatAktifTab = "ucuz"');
    ic('_firsatSekmesineGit(__o)');
    ok('  kontrol: sekme zaten gorunuyorsa cubuk OYNAMIYOR', cubuk.scrollLeft === 0, 'scrollLeft=' + cubuk.scrollLeft);
    ctx.__ekran = []; ctx.__cizim = [];
    ctx.__o = olay({ dataset: { firsatSekme: 'yok' } });
    const y = uyariYakala(() => ic('_firsatSekmesineGit(__o)'));
    ok('olmayan sekme: Firsatlar ACILMIYOR ve sessiz degil (uyari)',
       ctx.__ekran.length === 0 && ctx.__cizim.length === 0 && y.uyari.length === 1, y.uyari.join(' | '));
    // Mevcut sekme tiklamasi (firsatTab) ayni isaretleme kapisindan geciyor.
    DOM['firsatArama'] = yeniEl();
    ctx.__b = TABS[2]; ic('firsatTab("zam", __b)');
    ok('sekme tiklamasi (firsatTab) bozulmadi: zam isaretli, ay cipleri acik, bir kez ciziliyor, arama temiz',
       ic('_firsatAktifTab') === 'zam' && aktifler() === 'zam' && !DOM['firsatAylar'].classList.contains('gizli')
       && ctx.__cizim.join() === 'zam' && DOM['firsatArama'].value === '', aktifler() + ' / ' + ctx.__cizim.join());
    ic('showScreen = __gs; renderFirsatlar = __gr');
  }

  // (d)+(e) SEKME CIZIMI: data/dusenler.json sahte sunucudan, istekler sayiliyor.
  const eskiFetch = ctx.fetch;
  let yanit = null, istek = 0;
  ctx.fetch = (u, o) => (/dusenler\.json/.test(String(u))
    ? (istek++, Promise.resolve().then(() => yanit()))
    : eskiFetch(u, o));
  const cevap = (govde, durum = 200) => () => ({ ok: durum === 200, status: durum, headers: { get: () => null }, json: async () => govde });
  // KAYIT KENDI ICINDE TUTARLI: fiyat = normal * (1 - yuzde/100). Onceki hali
  // normal=100 ve fiyat=70 SABITKEN yuzdeyi 30'dan 16'ya dusuruyordu -- yani 15
  // kartin 14'u celiskili ciziliyordu ve test bunu GORMUYORDU (2026-09-12
  // incelemesi yakaladi). Asagida rozet ile okun iki ucu BIRBIRINE baglandi.
  const dk = (sid, ad, market, yuzde, normal = 100) => {
    const fiyat = Math.round(normal * (100 - yuzde)) / 100;
    return { u: { _id: sid, _sid: sid, ad, ana_kategori: 'K-' + sid, resim: null, agirlik_hacim: null,
                  en_dusuk_fiyat: fiyat, market_fiyatlari: [{ market, fiyat }] },
             dusus_yuzde: yuzde, market, normal, fiyat, baslangic: G(2), kaynak: 'seri' };
  };
  const on15 = Array.from({ length: 15 }, (_, i) => dk('t' + i, 'Tüm' + i + ' Ürün', ['migros', 'bim', 'a101'][i % 3], 30 - i));
  const kartSay = h => (h.match(/class="firsat-card"/g) || []).length;
  const sifirla = () => ic('_dusenTumCache = null; _dusenTumYukleniyor = null');
  const firsatCiz = async () => {
    DOM['firsatContent'] = yeniEl(); DOM['firsatOzet'] = yeniEl();
    ic('_firsatAktifTab = "dusen"'); ic('renderFirsatlar("dusen")');
    // Cizimin BITTIGI kosul: "Yukleniyor" gitti ve kap doldu.
    const bitti = await bekle(() => { const h = DOM['firsatContent'].innerHTML; return h !== '' && !/Yükleniyor/.test(h); });
    if (!bitti) console.log('        NOT: cizim 4 sn icinde bitmedi -- asagidaki iddia bunu gosterecek');
    return { html: DOM['firsatContent'].innerHTML, ozet: DOM['firsatOzet'].innerHTML };
  };
  ctx.__sbEski = ic('window.supabaseClient');
  const varCiz = ic('typeof renderFirsatDusen') === 'function' && ic('typeof dusenTumunuGetir') === 'function';
  ok('renderFirsatDusen ve dusenTumunuGetir tanimli', varCiz);
  if (varCiz) {
    sifirla(); istek = 0; yanit = cevap({ surum: 1, dusenler: on15 });
    ctx.__a = { surum: 1, dusenler: on15.slice(0, 12) }; ic('_anasayfaCache = __a; _anasayfaYukleniyor = null');
    ic('window.supabaseClient = null');
    ic('delete productMap["t0"]; delete productMap["t1"]');
    // BAYAT CANLI URUN: productMap'te DUNKU tam urun duruyor (catCache oturum
    // boyunca yapisik kaliyor, DATA_UPDATED onu bosaltmiyor). Kart ANLIK
    // GORUNTUDEN cizilmeli; canli fiyattan cizilseydi "-%29" rozetinin yaninda
    // "249,90 ₺" basilirdi (inceleme 2026-09-12).
    ctx.__tam = { _id: 't1', _sid: 't1', ad: 'Tüm1 Ürün', ana_kategori: 'K-t1', en_dusuk_fiyat: 249.9,
                  market_fiyatlari: [{ market: 'bim', fiyat: 249.9 }], fiyat_gecmisi: [{ t: '2026-09-01', f: 90 }] };
    ic('_pmEkle(__tam)');
    const r = await firsatCiz();
    // Kart fiyati tlHTML ile PARCALI basiliyor (fp-l / fp-k / fp-tl), yani duz
    // "249,90" aramak KORDU: kart canli urunden cizilse bile iddia yesil
    // kaliyordu (bozma 2026-09-12 yakaladi). Artik kartin KENDI fiyati da
    // anlik goruntuye bagli.
    const t1Kart = (r.html.split('class="firsat-card"').find(k => /data-id="t1"/.test(k)) || '');
    ok('bayat CANLI urun varken bile kart ANLIK GORUNTUDEN ciziliyor (rozet, ok ve kart fiyati celismiyor)',
       /BİM · 100,00 ₺ → 71,00 ₺/.test(r.html)
       && /fp-l">71<\/span><span class="fp-k">,00</.test(t1Kart)
       && !/fp-l">249</.test(r.html), t1Kart.slice(0, 240));
    ok('tam liste ciziliyor: 15 kart (seritteki 12 degil)', kartSay(r.html) === 15, 'kart=' + kartSay(r.html) + ' ' + r.html.slice(0, 160));
    ok('  Supabase YOKKEN de aciliyor', !/yüklenemiyor/.test(r.html) && kartSay(r.html) > 0);
    ok('  rozet -%yuzde, kendi sinifiyla', /firsat-badge-dusen[^"]*">-%30</.test(r.html), r.html.slice(0, 300));
    // Seritle AYNI iki kademe (>= DUSEN_BUYUK_YUZDE "buyuk"): ayni urun iki ekranda ayni renk.
    const rozetSinifi = y => ((r.html.match(new RegExp('class="firsat-card-badge ([^"]*)">-%' + y + '<')) || [])[1] || '');
    ok('  rozet siniri seritle AYNI: tam %25 buyuk, %24 normal',
       sabitDeger('DUSEN_BUYUK_YUZDE') === 25 && /firsat-badge-dusen--buyuk/.test(rozetSinifi(25))
       && /firsat-badge-dusen/.test(rozetSinifi(24)) && !/--buyuk/.test(rozetSinifi(24)),
       '25=' + rozetSinifi(25) + ' 24=' + rozetSinifi(24));
    ok('  serit de AYNI sabiti kullaniyor (sihirli 25 yok)',
       /DUSEN_BUYUK_YUZDE/.test(kodTemiz(govde('renderDusenlerSeridi'))) && !/>=\s*25\b/.test(kodTemiz(govde('renderDusenlerSeridi'))));
    ok('  alt metin: market + referans -> fiyat', /Migros · 100,00 ₺ → 70,00 ₺/.test(r.html), (r.html.match(/firsat-card-sub">[^<]*/) || [''])[0]);
    // BAGLAYICI IDDIA (inceleme 2026-09-12): rozetteki yuzde ile okun iki ucu
    // AYNI KARTTA tutarli olmali. Onceden rozet ve ok AYRI AYRI araniyordu;
    // ikisi de tesadufen tutarli olan tek karta dusuyor, kalan 14 kart celiskili
    // cizilse bile test YESIL kaliyordu.
    {
      const kartlar = r.html.split('class="firsat-card"').slice(1);
      const sayiyaCevir = (tam, kurus) => Number(String(tam).replace(/\./g, '') + '.' + kurus);
      const celiskili = [];
      for (const k of kartlar) {
        const ok2 = k.match(/firsat-card-sub">[^<]*?([\d.]+),(\d{2}) ₺ → ([\d.]+),(\d{2}) ₺/);
        const roz = k.match(/firsat-card-badge [^"]*">-%(\d+)</);
        if (!ok2 || !roz) { celiskili.push('eksik eslesme: ' + k.slice(0, 70)); continue; }
        const normal = sayiyaCevir(ok2[1], ok2[2]), fiyat = sayiyaCevir(ok2[3], ok2[4]);
        const beklenen = Math.round((normal - fiyat) / normal * 100);
        if (beklenen !== Number(roz[1])) celiskili.push('rozet -%' + roz[1] + ' ama ok %' + beklenen);
      }
      ok('  HER kartta rozet = (normal - fiyat) / normal (rozet ile ok CELISEMEZ)',
         kartlar.length === 15 && celiskili.length === 0, 'kart=' + kartlar.length + ' ' + celiskili.slice(0, 3).join(' | '));
    }
    ok('  bolum basligi pencereyi ve sayiyi soyluyor', /Son 7 günde fiyatı düşen 15 ürün/.test(r.html));
    ok('  ozet: 15 dusen urun', /firsat-ozet-sayi">15</.test(r.ozet) && /Düşen ürün/.test(r.ozet), r.ozet);
    ok('  kartlar productMap\'e KAYITLI (dokununca detay acilsin)', ic('!!productMap["t0"] && productMap["t0"]._kisa === true'));
    ok('  TAM urun kisa kartla EZILMIYOR (kategori gezildiyse)', ic('Array.isArray(productMap["t1"].fiyat_gecmisi) && !productMap["t1"]._kisa'));
    ok('  kart data-id urunun _id\'si', /data-id="t0"/.test(r.html));
    ok('  tek istek', istek === 1, istek);
    const r2 = await firsatCiz();
    ok('ikinci acilista YENIDEN INMIYOR (bellek)', istek === 1 && kartSay(r2.html) === 15, 'istek=' + istek);
    sifirla(); istek = 0;
    await Promise.all([ic('dusenTumunuGetir()'), ic('dusenTumunuGetir()')]);
    ok('  ayni anda iki cagri TEK istek', istek === 1, istek);

    sifirla(); yanit = cevap({ surum: 1, dusenler: [dk('k1', 'Kkk <b>Ürün</b>', '<img src=x>', 30),
      Object.assign(dk('k2', 'Bozuk Ürün', 'bim', 30), { dusus_yuzde: '<b>x</b>' })] });
    const r3 = await firsatCiz();
    ok('market adi ve urun adi KACISLI', /&lt;img src=x&gt;/.test(r3.html) && !/<img src=x>/.test(r3.html) && /Kkk &lt;b&gt;/.test(r3.html), r3.html.slice(0, 300));
    ok('  yuzdesi sayi olmayan kayit CIZILMIYOR (rozete yalniz sayi girer)', !/Bozuk Ürün/.test(r3.html) && kartSay(r3.html) === 1, kartSay(r3.html));

    sifirla(); istek = 0; yanit = cevap({}, 404);
    const y4 = await uyariYakalaAsync(() => firsatCiz());
    ok('tam liste inmezse: seritteki 12 kart + listenin EKSIK oldugu soyleniyor',
       kartSay(y4.sonuc.html) === 12 && /Tam liste yüklenemedi/.test(y4.sonuc.html), y4.sonuc.html.slice(0, 200));
    ok('  sessiz degil (uyari)', y4.uyari.some(u => /dusenler/.test(u)), y4.uyari.join(' | '));
    ok('  ozet BOS: eksik listede seritteki 12 "toplam" gibi yazilmiyor', y4.sonuc.ozet === '', y4.sonuc.ozet);
    yanit = cevap({ surum: 1, dusenler: on15 });
    const r4b = await firsatCiz();
    ok('  hata bellege YAZILMADI: sonraki acilista yeniden deneniyor', istek === 2 && kartSay(r4b.html) === 15, 'istek=' + istek);

    sifirla(); yanit = cevap({ surum: 2, dusenler: on15 });
    const y5 = await uyariYakalaAsync(() => firsatCiz());
    ok('surum uyumsuzsa KULLANILMIYOR (seritteki kartlar + uyari)', /Tam liste yüklenemedi/.test(y5.sonuc.html) && y5.uyari.length >= 1, y5.uyari.join(' | '));

    sifirla(); yanit = cevap({}, 500); ctx.__a = false; ic('_anasayfaCache = __a');
    const y6 = await uyariYakalaAsync(() => firsatCiz());
    ok('ne tam liste ne serit: acik mesaj, kart yok, ozet bos (sifir DEGIL, bilinmiyor)',
       /yüklenemiyor/.test(y6.sonuc.html) && kartSay(y6.sonuc.html) === 0 && y6.sonuc.ozet === '', y6.sonuc.html.slice(0, 160) + ' | ' + y6.sonuc.ozet);

    sifirla(); yanit = cevap({ surum: 1, dusenler: [] });
    const r7 = await firsatCiz();
    ok('bu hafta dusen yoksa bunu soyluyor, ozet 0', /düşüşü yakalanmadı/.test(r7.html) && /firsat-ozet-sayi">0</.test(r7.ozet), r7.html + ' | ' + r7.ozet);
    // OLCULEMEDI, OLCULDU-SIFIR DEGILDIR (inceleme 2026-09-12). Build supheli
    // puanlarini alamazsa havuz BOS yaziliyor; ayni cumleyi kurmak altyapi
    // arizasini olculmus bir urun iddiasina cevirirdi.
    sifirla(); yanit = cevap({ surum: 1, olculdu: false, dusenler: [] });
    const r8 = await firsatCiz();
    ok('olculemediyse "0" DEMIYOR, olculemedigini soyluyor ve ozet BOS kaliyor',
       /ölçülemedi/.test(r8.html) && !/yakalanmadı/.test(r8.html) && r8.ozet === '', r8.html + ' | ' + r8.ozet);
    ok('  kontrol: ayni bos liste olculdu bayragiyla gelince "yakalanmadı" diyor (kapi her seyi yutmuyor)',
       /düşüşü yakalanmadı/.test(r7.html) && /firsat-ozet-sayi">0</.test(r7.ozet));

    // YARIS: indirme surerken baska sekmeye gecildi.
    sifirla(); let birak = null; const oncekiIstek = istek;
    yanit = () => new Promise(res => { birak = () => res(cevap({ surum: 1, dusenler: on15 })()); });
    DOM['firsatContent'] = yeniEl(); DOM['firsatOzet'] = yeniEl();
    ic('_firsatAktifTab = "dusen"'); ic('renderFirsatlar("dusen")');
    await bekle(() => istek > oncekiIstek);   // istek GERCEKTEN atildi (sabit ms degil)
    ic('_firsatAktifTab = "ucuz"'); DOM['firsatContent'].innerHTML = 'BASKA_SEKME'; DOM['firsatOzet'].innerHTML = 'BASKA_OZET';
    if (birak) birak();
    await tik();
    ok('yaris: indirme surerken baska sekmeye gecildiyse o sekme EZILMIYOR',
       !!birak && DOM['firsatContent'].innerHTML === 'BASKA_SEKME' && DOM['firsatOzet'].innerHTML === 'BASKA_OZET',
       DOM['firsatContent'].innerHTML.slice(0, 80));
  }

  // (e2) OZET CIPI SEKMEYLE SIFIRLANIYOR (inceleme 2026-09-12): baska sekmeye
  // gecince, o sekmenin cevabi gelene kadar "336 Düşen ürün" yaziyordu.
  {
    DOM['firsatContent'] = yeniEl(); DOM['firsatOzet'] = yeniEl();
    DOM['firsatOzet'].innerHTML = '<div class="firsat-ozet-chip"><div class="firsat-ozet-sayi">336</div><div class="firsat-ozet-lbl">Düşen ürün</div></div>';
    ic('window.supabaseClient = null');
    ic('_firsatAktifTab = "ucuz"'); ic('renderFirsatlar("ucuz")');
    ok('sekme degisince ONCEKI sekmenin ozeti ANINDA siliniyor (yanlis etiketli sayi kalmiyor)',
       DOM['firsatOzet'].innerHTML === '', DOM['firsatOzet'].innerHTML.slice(0, 90));
  }

  // (f) MEVCUT SEKMELERIN YARISI: yeni sekme gec gelen cevaplara kurban gitmesin.
  {
    const sahteSb = () => {
      let birak; const bekle = new Promise(r => { birak = r; });
      const q = {};
      ['select', 'eq', 'not', 'order', 'limit', 'gte', 'lt'].forEach(m => { q[m] = () => q; });
      q.then = (res, rej) => bekle.then(() => ({ data: [], count: 0, error: null })).then(res, rej);
      return { sb: { from: () => q }, birak: () => birak() };
    };
    for (const degis of [true, false]) {
      const s = sahteSb(); ctx.__sb = s.sb; ic('window.supabaseClient = __sb');
      DOM['firsatContent'] = yeniEl(); DOM['firsatOzet'] = yeniEl();
      ic('_firsatAktifTab = "ucuz"'); ic('renderFirsatlar("ucuz")');
      if (degis) { ic('_firsatAktifTab = "dusen"'); DOM['firsatContent'].innerHTML = 'DUSEN_ICERIK'; DOM['firsatOzet'].innerHTML = 'DUSEN_OZET'; }
      s.birak(); await tik();
      if (degis) ok('gec gelen "En Ucuz" cevabi Dusenler\'i ve ozetini EZMIYOR',
        DOM['firsatContent'].innerHTML === 'DUSEN_ICERIK' && DOM['firsatOzet'].innerHTML === 'DUSEN_OZET',
        DOM['firsatContent'].innerHTML.slice(0, 80) + ' | ' + DOM['firsatOzet'].innerHTML.slice(0, 80));
      else ok('  kontrol: sekme degismediyse cevap GERCEKTEN ciziliyor (kapi her seyi yutmuyor)',
        /En Ucuz/.test(DOM['firsatOzet'].innerHTML), DOM['firsatOzet'].innerHTML.slice(0, 120));
    }
    let birakZ; ctx.__bekleZ = new Promise(r => { birakZ = r; });
    ic('_anasayfaCache = null; _anasayfaYukleniyor = __bekleZ');
    DOM['firsatContent'] = yeniEl(); DOM['firsatOzet'] = yeniEl(); DOM['firsatAylar'] = yeniEl();
    ic('_firsatAktifTab = "zam"'); ic('renderFirsatlar("zam")');
    ic('_firsatAktifTab = "dusen"'); DOM['firsatContent'].innerHTML = 'DUSEN_ICERIK';
    birakZ({ surum: 1, zamAylik: [] }); await tik();
    ok('gec gelen Zamlananlar verisi de Dusenler\'i EZMIYOR', DOM['firsatContent'].innerHTML === 'DUSEN_ICERIK', DOM['firsatContent'].innerHTML.slice(0, 80));
    ic('_anasayfaYukleniyor = null');
    ic('window.supabaseClient = __sbEski');
  }

  // (g) ANA SAYFA SERIDI: en fazla 12 kart ve tam listeyi INDIRMIYOR.
  {
    istek = 0;
    DOM['home-dusenler'] = yeniEl(); DOM['home-dusenler-list'] = yeniEl();
    ctx.__a = { surum: 1, dusenler: on15 }; ic('_anasayfaCache = __a; _anasayfaYukleniyor = null');
    await ic('renderDusenlerSeridi()');
    const n = (DOM['home-dusenler-list'].innerHTML.match(/class="strip-card"/g) || []).length;
    ok('ana sayfa seridi en fazla 12 kart', n === 12, n);
    ok('  serit tam listeyi INDIRMIYOR (ana sayfa hafif kalsin)', istek === 0, istek);
  }
  ctx.fetch = eskiFetch;
}

bitir();
