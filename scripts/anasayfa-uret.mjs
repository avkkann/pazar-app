// scripts/anasayfa-uret.mjs
// Ana sayfa seritlerini BUILD zamaninda hesaplayip data/anasayfa.json'a yazar.
//
// KRITIK KURAL: MANTIK YENIDEN YAZILMIYOR. app.js oldugu gibi node:vm icinde
// kosturuluyor ve KENDI fonksiyonlari (zamHavuzu, tuzakRozetiHesapla,
// supheliDurum, indirimRozetiHesapla, _seriKur ...) cagriliyor. Iki ayri
// uygulama = kacinilmaz sapma; bu dosyada hicbir esik, filtre veya siralama
// kuralı YOKTUR — hepsi app.js'ten geliyor.
//
// NEDEN: olculdu (2026-08-11, canli, soguk onbellek)
//   8 kategori JSON paralel     850 ms   (12,63 MB ham / 1,36 MB gzip)
//   gecmis_fiyatlar.json       1177 ms   ( 4,15 MB ham / 0,64 MB gzip)
//   tuzak taramasi (hesap)    14701 ms   <- asil darbogaz, ag degil HESAP
//   zamAdaylari (hesap)         976 ms
// Bu veri gunde bir kez degisiyor; her kullanicinin 17 MB indirip 16.790
// urun taramasi gereksiz.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { appOrtamiKur } from './app-vm.mjs';
import { asKartTanimla } from './kart-bicimi.mjs';
import { enYeniGozlemTarihi } from './veri-tarihi.mjs';
import { gunDamgasi } from './hub-sayfa.mjs';
import { ayZamCiftleri, ayIcinSonGun } from './zam-aylik.mjs';

const KOK = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const D = (p) => path.join(KOK, p);

const { ic, ctx } = appOrtamiKur({ kok: KOK });

const t0 = Date.now();
await ic('loadAllCats()');
await ic('gecmisVeriGetir()');
const urunSayisi = ic('Object.values(catCache).reduce((a,b)=>a+(b?b.length:0),0)');
console.log(`[anasayfa] veri hazir: ${urunSayisi} urun, ${Date.now() - t0} ms`);

// _asKart tanimi 2026-09-03'te scripts/kart-bicimi.mjs'e tasindi: mercek-uret.mjs
// de ayni bicimi uretiyor, kopyalamak iki kaynak yaratirdi.
asKartTanimla(ic);

// ── ZAM: sehirden BAGIMSIZ havuz. Secim (sehir + cesitlilik + ZAM_MAX)
//    istemcide zamSecHavuzdan ile ayni kodla yapiliyor.
const tZam = Date.now();
const zam = ic('zamHavuzu().map(x => ({ u: _asKart(x.u), marketArtis: x.marketArtis }))');
console.log(`[anasayfa] zam havuzu: ${zam.length} urun, ${Date.now() - tZam} ms`);

// ── TUZAKLAR: renderTuzaklarSeridi'nin AYNI tarama dongusu.
//    Secim (karistir + 6) istemcide kaliyor — bugunku davranis rastgele.
const tTuz = Date.now();
const tuzaklar = ic(`(() => {
  const kirmizi = [], sari = [];
  const ids = Object.keys(productMap);
  for (let j = 0; j < ids.length; j++) {
    const u = productMap[ids[j]];
    if (!u || !u._id) continue;
    if (!u.resim) continue;
    const adL = String(u.ad || '').toLowerCase();
    if (/\\b(bebelac|aptamil|hipp|nestle baby|organik|bio|gluten|konserve|hazır|superfresh|hellmann|heinz|bebek)\\b/.test(adL)) continue;
    const r = tuzakRozetiHesapla(u);
    if (!r) continue;
    if (r.tip === 'kirmizi') kirmizi.push({ u: _asKart(u), r: r });
    else sari.push({ u: _asKart(u), r: r });
    if (kirmizi.length >= 30) break;
  }
  return { kirmizi: kirmizi, sari: sari.slice(0, 30) };
})()`);
console.log(`[anasayfa] tuzaklar: ${tuzaklar.kirmizi.length} kirmizi + ${tuzaklar.sari.length} sari, ${Date.now() - tTuz} ms`);

// ── SUPABASE'E DAYALI IKI SERIT
await ic('supheliPuanlariYukle()');
const tDus = Date.now();
const dusenler = await (async () => {
  const { data, error } = await ic('supabaseClient').rpc('get_fiyat_dusenler',
    { p_limit: ic('DUSENLER_RPC_LIMIT') });
  if (error || !data) { console.warn('[anasayfa] dusenler RPC hatasi: ' + (error && error.message)); return []; }
  ic('window.__ham = null');
  ctx.__ham = data;
  return ic(`(() => {
    __ham.forEach(u => { if (!u._id) u._id = u.ad + '_' + (u.agirlik_hacim || ''); });
    return __ham.filter(u => !supheliDurum(u))
      .map(u => ({ u: _asKart(u), dusus_yuzde: u.dusus_yuzde }));
  })()`);
})();
console.log(`[anasayfa] dusenler: ${dusenler.length} aday, ${Date.now() - tDus} ms`);

const tSup = Date.now();
const supheli = await (async () => {
  const { data, error } = await ic('supabaseClient').from('urunler').select('*')
    .gte('indirim_supheli_puan', 4)
    .order('indirim_supheli_puan', { ascending: false })
    .limit(ic('SUPHELI_SERIT_SORGU_LIMIT'));
  if (error || !data) { console.warn('[anasayfa] supheli sorgu hatasi: ' + (error && error.message)); return []; }
  ctx.__ham2 = data;
  return ic(`(() => {
    const out = [];
    __ham2.forEach(u => {
      if (!u._id) u._id = u.ad + '_' + (u.agirlik_hacim || '');
      if (!supheliDurum(u)) return;
      const ir = indirimRozetiHesapla(u);
      out.push({ u: _asKart(u), puan: u.indirim_supheli_puan, yuzde: ir ? ir.yuzde : 0,
                 durum: supheliDurum(u) });
    });
    return out;
  })()`);
})();
console.log(`[anasayfa] supheli: ${supheli.length} aday, ${Date.now() - tSup} ms`);

// ── veri_tarihi: ana sayfanin tazelik gostergesi ──────────────────────
// `uretim` BUILD ANIDIR ve tazelik olcemez (her kosuda "simdi"ye esitleniyor).
// Gosterge VERININ KENDI en yeni gozlem tarihinden turer — hub sayfalarindaki
// pazar-veri-damgasi ile AYNI fonksiyondan (scripts/veri-tarihi.mjs), ki iki
// yer ayni gunu soylesin. Diskten okunuyor: catCache VM icinde ve tum katalogu
// VM sinirindan gecirmek okumaktan pahali.
const tVeri = Date.now();
const gecmisFiyatlar = JSON.parse(fs.readFileSync(D('data/gecmis_fiyatlar.json'), 'utf8'));
const katalog = fs.readdirSync(D('data'))
  .filter((f) => /^urunler_.*\.json$/.test(f))
  .flatMap((f) => {
    const a = JSON.parse(fs.readFileSync(D('data/' + f), 'utf8'));
    return Array.isArray(a) ? a : (a.urunler || []);
  });
const veriTarihi = gunDamgasi(enYeniGozlemTarihi(gecmisFiyatlar, katalog));
console.log(`[anasayfa] veri_tarihi (en yeni gozlem): ${veriTarihi}  (${Date.now() - tVeri} ms)`);

// ── AYLIK ZAM LISTELERI (Firsatlar > Zamlananlar sekmesi) ──────────────
// Ana sayfa seridi 30 GUNLUK KAYAN pencere kullaniyor; bu listeler TAKVIM AYI.
// Ikisi AYRI sorulari cevapliyor: "son 30 gunde ne zamlandi" vs "Agustos'ta
// ne zamlandi".
//
// TEK TANIM: hesap scripts/zam-aylik.mjs'te ve hub sayfalari (/zam/2026-08/)
// AYNI fonksiyonu cagiriyor. Yani uygulamadaki liste ile hub sayfasindaki
// liste ayni uretecten cikiyor -- ikisi ayri yazilsaydi kullanici ayni ay
// icin iki farkli liste gorurdu.
//
// NEDEN BUILD'DE (olculdu): istemcide de hesaplanabilirdi -- uc ay 73 ms --
// AMA gecmis_fiyatlar.json gerektiriyor: 728 KB gzip. Build'de uretilip
// anasayfa.json'a konunca maliyet +4,9 KB gzip (24 -> 29 KB) ve o dosya
// ZATEN ana sayfada iniyor: sekme aninda aciliyor, YENI ISTEK YOK.
//
// AY LISTESI VERIDEN TURUYOR, sabit yazilmiyor: bugunun ayindan geriye
// AY_SAYISI kadar bakiliyor ve BOS AYLAR CIKARILIYOR -> her ay yeni ay
// kendiliginden giriyor, en eskisi dusuyor; verisi olmayan ay (or. ayin
// 1'i) hic cizilmiyor ("veri yoksa bos kabuk gosterme").
const AY_SAYISI = 3;
const AY_URUN_MAX = 50;   // hub sayfasiyla ayni ust sinir ("Ayin en cok zamlanan 50 urunu")
const tAy = Date.now();
const MARKET_NAMES = ic('MARKET_NAMES');
const ZAM_ESIK = ic('ZAM_ESIK');
const ZAM_AYLAR = ic('ZAM_AYLAR');
const KATEGORILER_AY = ic('KATEGORILER');
const catCacheAy = ic('catCache');
const sidSlug = new Map();
const sidUrun = new Map();
for (const kat of KATEGORILER_AY) {
  for (const u of catCacheAy[kat.slug] || []) {
    if (u && u._sid) { sidSlug.set(u._sid, kat.slug); sidUrun.set(u._sid, u); }
  }
}
function zamOlcutuIc(kayitlar, pencereBas, pencereSon) {
  ctx.__zk = kayitlar; ctx.__zb = pencereBas; ctx.__zs = pencereSon;
  return ic('zamOlcutu(__zk, __zb, __zs)');
}
function salinimVarMi(seri) {
  ctx.__seri = seri;
  return ic('_salinimVarSeri(__seri)') !== null;
}
const bugunISO = (() => {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
})();
const zamAylik = [];
for (let i = 0; i < AY_SAYISI; i++) {
  const d = new Date(Number(bugunISO.slice(0, 4)), Number(bugunISO.slice(5, 7)) - 1 - i, 1);
  const ay = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  const { ciftler } = ayZamCiftleri(ay, ayIcinSonGun(ay, bugunISO), {
    gecmisFiyatlar, sidSlug, sidUrun, MARKET_NAMES, ZAM_ESIK,
    zamOlcutu: zamOlcutuIc, salinimVar: salinimVarMi
  });
  // Ayni urun birden cok markette esigi gecebilir; listede BIR KEZ, en yuksek
  // artisiyla gorunsun (hub sayfasi cift bazinda tablo basiyor, uygulamada
  // kart listesi var ve ayni urunun iki karti kafa karistirir).
  const enIyi = new Map();
  for (const c of ciftler) {
    const v = enIyi.get(c.sid);
    if (!v || c.artis > v.artis) enIyi.set(c.sid, c);
  }
  const urunler = [...enIyi.values()]
    .sort((a, b) => b.artis - a.artis)
    .slice(0, AY_URUN_MAX)
    .map((c) => {
      ctx.__u = sidUrun.get(c.sid);
      return { u: ic('_asKart(__u)'), market: c.market, artis: c.artis, zirve: c.zirve, sonDeger: c.sonDeger };
    })
    .filter((x) => x.u);
  if (!urunler.length) continue;                      // BOS AY CIZILMEZ
  zamAylik.push({ ay, etiket: `${ZAM_AYLAR[Number(ay.slice(5, 7)) - 1]} ${ay.slice(0, 4)}`, urunler });
}
console.log(`[anasayfa] aylik zam: ${zamAylik.map((a) => a.ay + '=' + a.urunler.length).join(' ') || '(hic ay yok)'}, ${Date.now() - tAy} ms`);

const cikti = {
  surum: 1,
  uretim: new Date().toISOString(),
  veri_tarihi: veriTarihi,
  urun_sayisi: urunSayisi,
  zam: zam,
  zamAylik: zamAylik,
  tuzaklar: tuzaklar,
  dusenler: dusenler,
  supheli: supheli,
};
const hedef = D('data/anasayfa.json');
fs.writeFileSync(hedef, JSON.stringify(cikti), 'utf8');
const kb = fs.statSync(hedef).size / 1024;
console.log(`[anasayfa] data/anasayfa.json yazildi: ${kb.toFixed(1)} KB ham  (toplam ${Date.now() - t0} ms)`);
if (!zam.length && !tuzaklar.kirmizi.length && !dusenler.length && !supheli.length) {
  console.error('[anasayfa] UYARI: dort serit de bos — dosya yazildi ama istemci geriye dusecek');
  process.exit(1);
}
