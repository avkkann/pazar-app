// scripts/hub-uret.mjs
// Hub sayfalarinin (zam/market/kategori/hal) ORKESTRATORU. Veriyi okur,
// app.js'in KENDI fonksiyonlarini node:vm icinde cagirarak (app-vm.mjs
// uzerinden) sayfa modellerini kurar, hub-sayfa.mjs'teki sayfaKarari/
// sayfaHTML ile karar verip HTML'e cevirir ve .hub/ altina yazar.
//
// KRITIK KURAL: MANTIK YENIDEN YAZILMIYOR. Esik/filtre/siralama app.js'ten
// geliyor: ZAM_ESIK, _salinimVarSeri, fiyatlariTemizle, birimFiyatHesapla,
// MARKET_NAMES, KATEGORILER, _veBaglacliListe hepsi ic() ile app.js'in
// KENDI kodu cagrilarak kullaniliyor (bkz. scripts/anasayfa-uret.mjs, ayni
// desen). Tek BILINCLI istisna: aylik zam penceresi -- zamHavuzu() gunumuze
// (_yerelGunISO) cakili, takvim ayi icin parametreleştirilemiyor. Bu yuzden
// ay sayfasi kendi ay basi->ay sonu karsilastirmasini KURUYOR ama esigi
// (ZAM_ESIK) ve salinim elemesini (_salinimVarSeri) yine app.js'ten aliyor.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { appOrtamiKur } from './app-vm.mjs';
import { gunDamgasi, sayiTR, kirpmaNotu, ayKarari, sayfaKarari, sayfaHTML, slug } from './hub-sayfa.mjs';

const KOK = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const D = (p) => path.join(KOK, p);
const HUB_DIR = D('.hub');

const t0 = Date.now();

// ── ESIK_BOLUM_SATIR ─────────────────────────────────────────────────
// hub-sayfa.mjs'e DEGIL buraya konuyor: ESIK_SATIR/ESIK_KELIME orada TUM
// SAYFANIN toplamina bakiyor, bu ise TEK bir tablo BOLUMUNE bakiyor -- ayri
// bir sinir. Yeni bir esik ICAT edilmiyor: app.js'te ayni ilkenin iki emsali
// zaten var -- ZAM_MIN = 3 ("bundan azsa bölüm hiç çizilmez", app.js satir
// 2957) ve SUPHELI_SERIT_MIN = 3 (app.js satir 2876), ikisi de "3 satirdan
// az veri tasiyan bir seridi/bolumu hic cizme" diyor. Olcum (2026-08-18):
// /kategori/dondurulmus/ sayfasinda "Son 30 gunde zamlananlar" 2 satira,
// "Alt kategoriler" 1 satira dusuyor -- bolum esigi olmasa bos iskelet +
// 1-2 satirlik dolgu "ince icerik" sinyali verirdi.
const ESIK_BOLUM_SATIR = 3;

console.log('[hub] baslatiliyor...');
const { ic, ctx } = appOrtamiKur({ kok: KOK });
await ic('loadAllCats()');

const MARKET_NAMES = ic('MARKET_NAMES');
const MARKET_KODLARI = Object.keys(MARKET_NAMES);
const KATEGORILER = ic('KATEGORILER');
const ZAM_ESIK = ic('ZAM_ESIK');
const ZAM_MIN_KAYIT = ic('ZAM_MIN_KAYIT');
const ZAM_AYLAR = ic('ZAM_AYLAR');
const catCache = ic('catCache');
console.log(`[hub] app.js hazir: ${MARKET_KODLARI.length} market, ${KATEGORILER.length} kategori, ZAM_ESIK=${ZAM_ESIK}, ZAM_MIN_KAYIT=${ZAM_MIN_KAYIT}`);

// ── app.js pure fonksiyonlarina vm sinirindan cagri sarmalayicilari ────
function fiyatlariTemizleIc(marketFiyatlari) {
  ctx.__mf = marketFiyatlari;
  return ic('fiyatlariTemizle(__mf)');
}
function birimFiyatHesaplaIc(u) {
  ctx.__bu = u;
  return ic('birimFiyatHesapla(__bu)');
}
function veBaglacliListeIc(adlar) {
  ctx.__adlar = adlar;
  return ic('_veBaglacliListe(__adlar)');
}
function salinimVarMi(seri) {
  ctx.__seri = seri;
  return ic('_salinimVarSeri(__seri)') !== null;
}
// Zam ölçütü — YENİDEN YAZILMIYOR: app.js'teki zamOlcutu() çağrılıyor. Pencere
// takvim ayı (ayZamHesapla ayarlar), çekirdek (zirve/kayıt eşiği/artış) app.js'in
// KENDİ kodu. Bkz. YAPILACAK 1 (gorev-4-report.md) — iki ayrı "zam nedir" tanımı
// olmasın diye zamMarketArtisi (app.js) ile burası AYNI fonksiyonu paylaşıyor.
function zamOlcutuIc(kayitlar, pencereBas, pencereSon) {
  ctx.__zk = kayitlar; ctx.__zb = pencereBas; ctx.__zs = pencereSon;
  return ic('zamOlcutu(__zk, __zb, __zs)');
}

// ── bicimleme yardimcilari (is mantigi degil, sadece gorunum) ──────────
// tl()/tlHTML() (app.js satir 1159) ile AYNI Intl bicimini kullaniyor;
// DOM'a baglı olmadigi icin burada birebir aynen tekrar yaziliyor.
function paraTR(v) {
  if (v == null || !isFinite(v)) return '—';
  return v.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ₺';
}
function paraTutar(v) {
  if (v == null || !isFinite(v)) return '—';
  return v.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function oranTR(v) {
  return v.toLocaleString('tr-TR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}
function yuzdeIsaretli(v) {
  const isaret = v > 0 ? '+' : '';
  return `${isaret}%${sayiTR(Math.round(v))}`;
}
function medyan(sayilar) {
  if (!sayilar.length) return null;
  const s = sayilar.slice().sort((a, b) => a - b);
  const o = Math.floor(s.length / 2);
  return s.length % 2 ? s[o] : (s[o - 1] + s[o]) / 2;
}
// UTC ISO damgayi Turkiye yerel (+03:00) takvim gunune cevirir. DIKKAT: bu
// yasakli "toISOString().slice(0,10)" DESENI DEGIL -- o desen calistirilan
// MAKINENIN yerel saatini (`new Date()`) alip disari UTC olarak yazdirip
// kesiyordu, makine saat dilimi Turkiye'den farkliysa gun kayiyordu. Burada
// elimizde zaten SABIT bir UTC ISO damga var (anasayfa.json'un uretim
// alani); +3 saat ekleyip UTC bilesenlerini okumak makineden bagimsiz
// dogru Turkiye gunu verir -- Date nesnesi yalnizca saat ARITMETIGI icin
// kullaniliyor, "simdiki yerel gun nedir" sorusu icin degil.
function yerelTarihTR(isoUtc) {
  const d = new Date(isoUtc);
  const kaydirilmis = new Date(d.getTime() + 3 * 60 * 60 * 1000);
  const y = kaydirilmis.getUTCFullYear();
  const m = String(kaydirilmis.getUTCMonth() + 1).padStart(2, '0');
  const g = String(kaydirilmis.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${g}`;
}
function ayGunSayisiHesapla(yil, ay) {
  return new Date(yil, ay, 0).getDate();
}

// ── veri okuma (yalnizca OKUMA, data/ altina yazilmiyor) ────────────────
const anasayfa = JSON.parse(fs.readFileSync(D('data/anasayfa.json'), 'utf8'));
const ilMarketler = JSON.parse(fs.readFileSync(D('data/il_marketler.json'), 'utf8'));
const hal = JSON.parse(fs.readFileSync(D('data/hal.json'), 'utf8'));
const halGecmis = JSON.parse(fs.readFileSync(D('data/hal_gecmis.json'), 'utf8'));
const gecmisFiyatlar = JSON.parse(fs.readFileSync(D('data/gecmis_fiyatlar.json'), 'utf8'));
console.log(`[hub] veri okundu: anasayfa.zam=${(anasayfa.zam || []).length}, il_marketler=${ilMarketler.il_sayisi} il, hal=${hal.urunler.length} kalem, gecmis=${Object.keys(gecmisFiyatlar).length} seri`);

// veriDamgasi TUM sayfalar icin (hal disinda) anasayfa.json'un uretim
// alanindan gelir -- kaynak verinin damgasi budur, W3C Datetime zaten.
const VERI_DAMGASI = anasayfa.uretim;
const BUGUN = yerelTarihTR(anasayfa.uretim);
console.log(`[hub] BUGUN=${BUGUN}`);

// ── sid -> kategori slug / urun haritasi (tum katalog, 8 dosya) ────────
const sidSlug = new Map();
const sidUrun = new Map();
for (const kat of KATEGORILER) {
  for (const u of catCache[kat.slug] || []) {
    if (u && u._sid) { sidSlug.set(u._sid, kat.slug); sidUrun.set(u._sid, u); }
  }
}
const tumUrunler = KATEGORILER.flatMap((k) => catCache[k.slug] || []);
console.log(`[hub] katalog: ${tumUrunler.length} urun, ${sidSlug.size} sid eslendi`);

// ── urun analiz onbellegi: her urun icin fiyatlariTemizle SONUCU BIR KEZ
//    hesaplanip TUM bolumlerde (kategori fark tablosu, market en-ucuz
//    tablosu, genel istatistikler) yeniden kullanilir. ────────────────
function urunAnalizKur(u) {
  const temiz = fiyatlariTemizleIc(u.market_fiyatlari).gecerli.filter((f) => f && f.market && f.fiyat > 0);
  if (temiz.length < 2) return null;
  const min = Math.min(...temiz.map((f) => f.fiyat));
  const max = Math.max(...temiz.map((f) => f.fiyat));
  return {
    temiz, min, max, esit: min === max,
    enUcuzMarketler: temiz.filter((f) => f.fiyat === min).map((f) => f.market),
    enPahaliMarketler: temiz.filter((f) => f.fiyat === max).map((f) => f.market),
  };
}
const urunAnalizleri = new Map();
for (const u of tumUrunler) urunAnalizleri.set(u._sid, urunAnalizKur(u));
const ikiMarketliSayisi = [...urunAnalizleri.values()].filter(Boolean).length;
console.log(`[hub] >=2 marketli urun: ${ikiMarketliSayisi} / ${tumUrunler.length}`);

// Market istatistikleri: urunSayisi (gecerli fiyati olan) + enUcuzSayisi
// (esit-olmayan karsilastirmada en ucuz oldugu urun sayisi). "esit" (tum
// marketler ayni fiyat) durumu HARIC tutulur -- kural 3'un ayni ilkesinin
// uzantisi: bir urunde herkes ayni fiyati veriyorsa kimse "en ucuz" degildir.
function marketIstatistikleriCikar(urunler) {
  const out = new Map(MARKET_KODLARI.map((mk) => [mk, { urunSayisi: 0, enUcuzSayisi: 0 }]));
  for (const u of urunler) {
    for (const f of u.market_fiyatlari || []) {
      if (f && f.market && f.fiyat > 0 && out.has(f.market)) out.get(f.market).urunSayisi++;
    }
    const analiz = urunAnalizleri.get(u._sid);
    if (!analiz || analiz.esit) continue;
    for (const mk of analiz.enUcuzMarketler) if (out.has(mk)) out.get(mk).enUcuzSayisi++;
  }
  return out;
}
const katIstatistikleri = new Map();
for (const kat of KATEGORILER) katIstatistikleri.set(kat.slug, marketIstatistikleriCikar(catCache[kat.slug] || []));
const genelIstatistik = marketIstatistikleriCikar(tumUrunler);

function marketIlleri(marketKod) {
  const iller = [];
  for (const [ilAdi, v] of Object.entries(ilMarketler.iller)) {
    if (v.marketler.includes(marketKod)) iller.push(ilAdi);
  }
  return iller.sort((a, b) => a.localeCompare(b, 'tr'));
}

// ── manifest + yazim yardimcilari ───────────────────────────────────────
const manifest = [];
function tabloBolumEkle(bolumler, atlananlar, { baslik, sutunlar, satirlar, not }) {
  if (satirlar.length < ESIK_BOLUM_SATIR) {
    const sebep = `${satirlar.length} satır (bölüm eşiği ${ESIK_BOLUM_SATIR})`;
    atlananlar.push({ baslik, satir: satirlar.length, sebep });
    console.log(`[hub] BOLUM ATLANDI "${baslik}" — ${sebep}`);
    return;
  }
  const bolum = { baslik, tur: 'tablo', sutunlar, satirlar };
  if (not) bolum.not = not;
  bolumler.push(bolum);
}
function sayfaYazVeKaydet(model) {
  const karar = sayfaKarari(model);
  manifest.push({
    yol: model.yol, tip: model.tip, durum: karar.durum, sebep: karar.sebep,
    satir: karar.satir, kelime: karar.kelime,
    son_veri: model.sonVeri, veri_damgasi: model.veriDamgasi,
    atlanan_bolumler: model._atlananBolumler || [],
  });
  if (karar.durum !== 'uretildi') {
    console.log(`[hub] ATLANDI ${model.yol} — ${karar.sebep}`);
    return;
  }
  const html = sayfaHTML(model);
  const hedefDizin = path.join(HUB_DIR, model.yol.replace(/^\//, '').replace(/\/$/, ''));
  fs.mkdirSync(hedefDizin, { recursive: true });
  fs.writeFileSync(path.join(hedefDizin, 'index.html'), html, 'utf8');
  console.log(`[hub] uretildi ${model.yol} — ${karar.satir} satır, ${karar.kelime} kelime`);
}
function kategoriLinkleri(haricSlug) {
  return KATEGORILER.filter((k) => k.slug !== haricSlug).map((k) => ({ yol: `/kategori/${k.slug}/`, metin: `${k.label} fiyatları` }));
}
function marketLinkleri(haricKod) {
  return MARKET_KODLARI.filter((mk) => mk !== haricKod).map((mk) => ({ yol: `/market/${slug(mk)}/`, metin: `${MARKET_NAMES[mk]} fiyatları` }));
}

// ═══════════════════════════════════════════════════════════════════════
// 1) AY TESPITI + AYLIK ZAM HESABI
// ═══════════════════════════════════════════════════════════════════════
const ayIlkGozlem = new Map();
let enErkenGozlem = null;
for (const sid of Object.keys(gecmisFiyatlar)) {
  for (const k of gecmisFiyatlar[sid]) {
    if (!k || !k.t) continue;
    const ay = k.t.slice(0, 7);
    const mevcut = ayIlkGozlem.get(ay);
    if (!mevcut || k.t < mevcut) ayIlkGozlem.set(ay, k.t);
    if (!enErkenGozlem || k.t < enErkenGozlem) enErkenGozlem = k.t;
  }
}
const tumAylar = [...ayIlkGozlem.keys()].sort();

// İki ISO tarih ('yyyy-aa-gg') arasındaki GÜN FARKI. Saf aritmetik -- "şimdi"
// TÜRETMİYOR (girdiler zaten sabit ISO dizeleri), bu yüzden projenin
// yasakladığı yerel-saat/"new Date()"-turetme tuzağına girmiyor.
function gunFarkiHesapla(erkenISO, gecISO) {
  const [y1, a1, g1] = erkenISO.split('-').map(Number);
  const [y2, a2, g2] = gecISO.split('-').map(Number);
  return Math.round((Date.UTC(y2, a2 - 1, g2) - Date.UTC(y1, a1 - 1, g1)) / 86400000);
}
// AY ÖNCESİNDE EN AZ 30 GÜNLÜK GEÇMİŞ KAPISI (YAPILACAK 2). Yeni eşik icat
// edilmedi: 30, app.js'in KENDİ zam penceresinin uzunluğu (_zamGunISO(29) ->
// bugün dahil 30 gün, bkz. app.js zamMarketArtisi/zamOlcutu). "Önceki zirve"
// ölçütü bu kadarlık bir pencereye dayanamayan bir ay için KURULAMAZ -- ayın
// az satır üretmesi "sakin geçti" DEĞİL, ölçütün çapası yok demektir.
const AY_ONCESI_GEREKEN_GUN = 30;
function ayGecmisYeterliMi(ay) {
  const gun = gunFarkiHesapla(enErkenGozlem, `${ay}-01`);
  if (gun < AY_ONCESI_GEREKEN_GUN) {
    return { yeterli: false, gun, sebep: `${ay} ayı öncesinde yalnızca ${gun} günlük geçmiş var (gerekli: ${AY_ONCESI_GEREKEN_GUN}) — "önceki zirve" ölçütü bu kadar kısa bir pencereye dayanamaz` };
  }
  return { yeterli: true, gun, sebep: `${ay} ayı öncesinde ${gun} günlük geçmiş var (gerekli: ${AY_ONCESI_GEREKEN_GUN})` };
}
const ayKararlari = tumAylar.map((ay) => {
  const temelKarar = ayKarari(ay, ayIlkGozlem.get(ay));
  if (!temelKarar.uygun) return { ay, karar: temelKarar };
  const gecmisKarari = ayGecmisYeterliMi(ay);
  if (!gecmisKarari.yeterli) return { ay, karar: { uygun: false, sebep: gecmisKarari.sebep } };
  return { ay, karar: { uygun: true, sebep: `${temelKarar.sebep}; ${gecmisKarari.sebep}` } };
});
const uygunAylar = ayKararlari.filter((x) => x.karar.uygun).map((x) => x.ay);
console.log(`[hub] aylar: ${tumAylar.join(', ')} — uygun: ${uygunAylar.join(', ')} — en erken gözlem: ${enErkenGozlem}`);
for (const { ay, karar } of ayKararlari) {
  if (!karar.uygun) console.log(`[hub] AY ATLANDI ${ay} — ${karar.sebep}`);
}
const guncelAy = uygunAylar[uygunAylar.length - 1];

// Bir takvim ayi icin: ay basi -> ay sonu (ya da bugune kadar, mevcut ay
// icin) karsilastirmasi. ZAM OLCUTU app.js'teki zamOlcutu()'DAN GELIYOR --
// zirve/kayit-esigi/artis hesabinin TEK kaynagi orasi (bkz. zamOlcutuIc,
// YAPILACAK 1). Esik ZAM_ESIK'ten, salinim elemesi _salinimVarSeri'den
// geliyor -- ikisi de app.js'in KENDI kodu. Pencere SADECE takvim ayi --
// bu, "mantik yeniden yazilmiyor" kuralinin BILINCLI istisnasi (bkz. dosya
// basi yorumu): zamHavuzu() takvim ayina gore parametreleştirilemiyor.
function ayZamHesapla(ay, sonGun) {
  const [yilS, ayS] = ay.split('-');
  const gunler = [];
  for (let g = 1; g <= sonGun; g++) gunler.push(`${yilS}-${ayS}-${String(g).padStart(2, '0')}`);
  const pencereBas = gunler[0];
  const pencereSon = gunler[gunler.length - 1];
  console.log(`[hub] zam penceresi ${ay}: ${pencereBas}..${pencereSon} (${gunler.length} gün)`);

  const ciftler = [];
  let salinimElenen = 0;
  for (const sid of Object.keys(gecmisFiyatlar)) {
    const kategoriSlug = sidSlug.get(sid);
    // Katalogda olmayan (artik satilmayan) urunler ve MEVSIM TUZAGI:
    // meyve-sebze zam havuzunun disinda tutuluyor -- zamHavuzu()'nun
    // 'meyve'/'sebze' disarida birakma ilkesiyle ayni (app.js ~satir 3053).
    if (!kategoriSlug || kategoriSlug === 'meyve-sebze') continue;
    const urun = sidUrun.get(sid);
    const kayitlar = gecmisFiyatlar[sid];
    if (!Array.isArray(kayitlar) || !kayitlar.length) continue;
    const marketler = {};
    for (const k of kayitlar) {
      if (!k || !k.t || k.f == null || !(k.f > 0)) continue;
      const m = k.m || '?';
      (marketler[m] ||= []).push(k);
    }
    for (const m of Object.keys(marketler)) {
      if (!MARKET_NAMES[m]) continue;
      const a = marketler[m].slice().sort((x, y) => (x.t < y.t ? -1 : (x.t > y.t ? 1 : 0)));
      // Salinim testi TAM gun izgarali seri istiyor -- bu kisim degismedi.
      const seri = new Array(gunler.length).fill(null);
      let j = 0, son = null;
      for (let i = 0; i < gunler.length; i++) {
        while (j < a.length && a[j].t <= gunler[i]) { son = a[j]; j++; }
        seri[i] = son ? son.f : null;
      }
      // ZAM OLCUTU: onceki zirveye gore, app.js'in KENDI fonksiyonuyla.
      const r = zamOlcutuIc(a, pencereBas, pencereSon);
      if (!r || !(r.artis >= ZAM_ESIK)) continue;
      if (salinimVarMi(seri)) { salinimElenen++; continue; }
      ciftler.push({ sid, market: m, ad: urun ? urun.ad : sid, kategoriSlug, zirve: r.zirve, sonDeger: r.sonDeger, artis: r.artis, sonGozlemTarihi: son.t });
    }
  }
  return { ciftler, salinimElenen };
}

function zamSayfaModeliKur(ay) {
  const [yilS, ayS] = ay.split('-');
  const yil = Number(yilS);
  const ayIndex = uygunAylar.indexOf(ay);
  const ayAdi = ZAM_AYLAR[Number(ayS) - 1];
  const buAyBugunMu = ay === BUGUN.slice(0, 7);
  const sonGun = buAyBugunMu ? Number(BUGUN.slice(8, 10)) : ayGunSayisiHesapla(yil, Number(ayS));

  const { ciftler, salinimElenen } = ayZamHesapla(ay, sonGun);
  const urunSeti = new Set(ciftler.map((c) => c.sid));
  const zincirSeti = new Set(ciftler.map((c) => c.market));
  const kategoriSeti = new Set(ciftler.map((c) => c.kategoriSlug));
  const enYeniGozlem = ciftler.reduce((acc, c) => (c.sonGozlemTarihi > acc ? c.sonGozlemTarihi : acc), `${ay}-01`);

  const siraliCiftler = ciftler.slice().sort((a, b) => b.artis - a.artis);
  const ILK_N = 50;
  const gosterilenler = siraliCiftler.slice(0, ILK_N);

  const bolumler = [];
  const atlananBolumler = [];

  const satirlar1 = gosterilenler.map((c) => {
    const kat = KATEGORILER.find((k) => k.slug === c.kategoriSlug);
    return [
      c.ad, MARKET_NAMES[c.market] || c.market, paraTR(c.zirve), paraTR(c.sonDeger),
      yuzdeIsaretli(c.artis),
      { metin: kat ? kat.label : c.kategoriSlug, yol: `/kategori/${c.kategoriSlug}/` },
    ];
  });
  const not1 = siraliCiftler.length > ILK_N
    ? kirpmaNotu(siraliCiftler.length, gosterilenler.length, 'Eşiği geçen {toplam} çiftin artış sırasına göre ilk {gosterilen} tanesi gösteriliyor.')
    : '';
  tabloBolumEkle(bolumler, atlananBolumler, {
    baslik: `Ayın en çok zamlanan ${sayiTR(gosterilenler.length)} ürünü`,
    sutunlar: ['Ürün', 'Market', 'Zirve ₺', 'Son ₺', 'Artış %', 'Kategori'],
    satirlar: satirlar1, not: not1,
  });

  const zincirVeri = MARKET_KODLARI.map((mk) => {
    const grup = ciftler.filter((c) => c.market === mk);
    return { mk, sayi: grup.length, med: medyan(grup.map((c) => c.artis)) };
  }).sort((a, b) => b.sayi - a.sayi || a.mk.localeCompare(b.mk, 'tr'));
  tabloBolumEkle(bolumler, atlananBolumler, {
    baslik: 'Zincir bazında dağılım',
    sutunlar: ['Market', 'Zam sayısı', 'Medyan artış %'],
    satirlar: zincirVeri.map((v) => [{ metin: MARKET_NAMES[v.mk], yol: `/market/${slug(v.mk)}/` }, sayiTR(v.sayi), v.med == null ? '—' : yuzdeIsaretli(v.med)]),
  });

  const katVeri = KATEGORILER.map((k) => {
    const grup = ciftler.filter((c) => c.kategoriSlug === k.slug);
    return { k, sayi: grup.length, med: medyan(grup.map((c) => c.artis)) };
  }).sort((a, b) => b.sayi - a.sayi || a.k.label.localeCompare(b.k.label, 'tr'));
  tabloBolumEkle(bolumler, atlananBolumler, {
    baslik: 'Kategori bazında dağılım',
    sutunlar: ['Kategori', 'Zam sayısı', 'Medyan artış %'],
    satirlar: katVeri.map((v) => [{ metin: v.k.label, yol: `/kategori/${v.k.slug}/` }, sayiTR(v.sayi), v.med == null ? '—' : yuzdeIsaretli(v.med)]),
  });

  bolumler.push({
    baslik: 'Bu liste nasıl hesaplandı',
    tur: 'metin',
    metin: `Bu listeye, ${ayAdi} ${yil} ayı başlamadan ÖNCE gözlenmiş en yüksek fiyata (zirveye) göre en az %${sayiTR(ZAM_ESIK)} artan ürün-market çiftleri giriyor — karşılaştırma ayın ilk günündeki fiyatla DEĞİL, önceki zirveyle yapılıyor: fiyat geçici bir kampanya sonrası eski seviyesine geri dönüyorsa bu zam sayılmıyor, yalnızca DAHA ÖNCE HİÇ GÖRÜLMEMİŞ bir seviyeye çıkan fiyatlar zam sayılıyor. Zirve en az ${sayiTR(ZAM_MIN_KAYIT)} kayda dayanmıyorsa (çapa kırılgansa) o çift hiç ölçülmüyor. "Son ₺" ${sayiTR(sonGun)}. gündeki (bu ay hâlâ sürüyorsa bugüne kadarki) taşınan fiyat. Aynı marketin serisinde bir seviyeden ayrılıp eski seviyeye geri dönen salınımlı ${sayiTR(salinimElenen)} kayıt listeden elendi — API her zincir için tek bir temsilci mağaza döndürüyor ve bu mağaza zaman zaman değişiyor, bu da geçici bir sıçrama gibi görünebiliyor. Taze meyve ve sebze mevsimsel fiyat dalgalanması gösterdiği için listenin dışında tutuluyor. Bu sayfa geçmişin bir değişim günlüğüdür; güncel karşılaştırma için market ve kategori sayfalarına bakın. Her market zinciri için veride tek bir temsilci mağaza bulunduğundan gerçek raf fiyatı şehre göre değişebilir.`,
  });

  const icLinkler = [];
  if (ayIndex > 0) icLinkler.push({ yol: `/zam/${uygunAylar[ayIndex - 1]}/`, metin: `${ZAM_AYLAR[Number(uygunAylar[ayIndex - 1].slice(5, 7)) - 1]} zamları` });
  if (ayIndex >= 0 && ayIndex < uygunAylar.length - 1) icLinkler.push({ yol: `/zam/${uygunAylar[ayIndex + 1]}/`, metin: `${ZAM_AYLAR[Number(uygunAylar[ayIndex + 1].slice(5, 7)) - 1]} zamları` });
  icLinkler.push({ yol: '/hal/', metin: 'Hal fiyatları' });
  icLinkler.push(...kategoriLinkleri());
  icLinkler.push(...marketLinkleri());
  icLinkler.push({ yol: '/', metin: 'Pazar ana sayfa' });

  const gunAraligi = buAyBugunMu ? `1–${sonGun} ${ayAdi}` : `1–${sonGun} ${ayAdi}`;
  const ozet = `${ayAdi} ${yil}'da ${sayiTR(ciftler.length)} ürün-market çiftinde %${sayiTR(ZAM_ESIK)}'in üzerinde fiyat artışı gözlendi; bu ${sayiTR(urunSeti.size)} ayrı ürüne, ${sayiTR(zincirSeti.size)} zincire ve ${sayiTR(kategoriSeti.size)} kategoriye yayılıyor (${gunAraligi} arası, salınımlı kayıtlar elendi).`;
  const aciklama = `${ayAdi} ${yil}'da %${ZAM_ESIK}+ zamlanan ${sayiTR(ciftler.length)} ürün-market çifti; zincir, kategori dağılımı ve hesaplama yöntemiyle Pazar'da, geçmişin bir değişim günlüğü olarak.`;

  return {
    tip: 'zam', yol: `/zam/${ay}/`,
    baslik: `${ayAdi} ${yil}'da zamlanan ürünler`,
    titleEtiketi: `${ayAdi} ${yil} Zamları | Pazar`,
    aciklama, ozet,
    veriDamgasi: VERI_DAMGASI, sonVeri: gunDamgasi(enYeniGozlem),
    bolumler, icLinkler,
    uygulamaLinki: { yol: '/', metin: 'Uygulamada aç' },
    _atlananBolumler: atlananBolumler,
  };
}

for (const { ay, karar } of ayKararlari) {
  if (!karar.uygun) {
    manifest.push({
      yol: `/zam/${ay}/`, tip: 'zam', durum: 'atlandi', sebep: karar.sebep,
      satir: 0, kelime: 0, son_veri: null, veri_damgasi: VERI_DAMGASI, atlanan_bolumler: [],
    });
    console.log(`[hub] ATLANDI /zam/${ay}/ — ${karar.sebep}`);
    continue;
  }
  sayfaYazVeKaydet(zamSayfaModeliKur(ay));
}

// ═══════════════════════════════════════════════════════════════════════
// 2) MARKET SAYFALARI
// ═══════════════════════════════════════════════════════════════════════
const anasayfaZam = anasayfa.zam || [];
function marketIcinZamSatirlari(marketKod) {
  const out = [];
  for (const item of anasayfaZam) {
    const r = item.marketArtis && item.marketArtis[marketKod];
    if (!r || r.salinim || !(r.artis >= ZAM_ESIK)) continue;
    out.push({ ad: item.u.ad, zirve: r.zirve, sonHafta: r.sonHafta, artis: r.artis });
  }
  return out.sort((a, b) => b.artis - a.artis);
}
function marketEnUcuzUrunler(marketKod) {
  const out = [];
  for (const u of tumUrunler) {
    const analiz = urunAnalizleri.get(u._sid);
    if (!analiz || analiz.esit) continue;
    const buGirdi = (u.market_fiyatlari || []).find((f) => f && f.market === marketKod && f.fiyat > 0);
    if (!buGirdi) continue;
    if (buGirdi.fiyat !== analiz.min) continue; // bu market en ucuz degilse atla
    if (analiz.enUcuzMarketler.length > 1) continue; // esit-en-ucuzsa fark 0, kural 3'un uzantisi geregi girmez
    const rakipler = analiz.temiz.filter((f) => f.market !== marketKod);
    if (!rakipler.length) continue;
    const rakipMin = Math.min(...rakipler.map((f) => f.fiyat));
    const rakipMarketAdlari = rakipler.filter((f) => f.fiyat === rakipMin).map((f) => MARKET_NAMES[f.market] || f.market);
    const fark = ((rakipMin - buGirdi.fiyat) / buGirdi.fiyat) * 100;
    if (!(fark > 0)) continue;
    out.push({ u, buFiyat: buGirdi.fiyat, rakipMin, rakipMarketAdlari, fark, kategoriSlug: sidSlug.get(u._sid) });
  }
  return out.sort((a, b) => b.fark - a.fark);
}

function marketSayfaModeliKur(marketKod) {
  const marketAdi = MARKET_NAMES[marketKod];
  const genel = genelIstatistik.get(marketKod);
  const iller = marketIlleri(marketKod);
  const kategoriSayisi = KATEGORILER.filter((k) => (katIstatistikleri.get(k.slug).get(marketKod).urunSayisi) > 0).length;
  const enUcuzOran = ikiMarketliSayisi ? (genel.enUcuzSayisi / ikiMarketliSayisi) * 100 : 0;

  const bolumler = [];
  const atlananBolumler = [];

  const enUcuzler = marketEnUcuzUrunler(marketKod);
  const ILK_N1 = 40;
  const gosterilen1 = enUcuzler.slice(0, ILK_N1);
  const not1 = enUcuzler.length > ILK_N1
    ? kirpmaNotu(enUcuzler.length, gosterilen1.length, '{toplam} üründen fark yüzdesine göre ilk {gosterilen} tanesi gösteriliyor.')
    : '';
  tabloBolumEkle(bolumler, atlananBolumler, {
    baslik: 'Bu markette en ucuz olan ürünler',
    sutunlar: ['Ürün', `${marketAdi} ₺`, 'En yakın rakip ₺', 'Fark %', 'Kategori'],
    satirlar: gosterilen1.map((r) => {
      const kat = KATEGORILER.find((k) => k.slug === r.kategoriSlug);
      return [r.u.ad, paraTR(r.buFiyat), `${veBaglacliListeIc(r.rakipMarketAdlari)} ${paraTR(r.rakipMin)}`, yuzdeIsaretli(r.fark), kat ? { metin: kat.label, yol: `/kategori/${kat.slug}/` } : '—'];
    }),
    not: not1,
  });

  const zamSatirlari = marketIcinZamSatirlari(marketKod);
  const ILK_N2 = 30;
  const gosterilen2 = zamSatirlari.slice(0, ILK_N2);
  const not2 = zamSatirlari.length > ILK_N2
    ? kirpmaNotu(zamSatirlari.length, gosterilen2.length, 'Son 30 günde zamlanan {toplam} üründen ilk {gosterilen} tanesi gösteriliyor.')
    : '';
  tabloBolumEkle(bolumler, atlananBolumler, {
    baslik: 'Bu markette son 30 günde zamlananlar',
    sutunlar: ['Ürün', 'Zirve ₺', 'Son hafta ₺', 'Artış %'],
    satirlar: gosterilen2.map((r) => [r.ad, paraTR(r.zirve), paraTR(r.sonHafta), yuzdeIsaretli(r.artis)]),
    not: not2,
  });

  const katDagilimVeri = KATEGORILER.map((k) => ({ k, ist: katIstatistikleri.get(k.slug).get(marketKod) }))
    .sort((a, b) => b.ist.urunSayisi - a.ist.urunSayisi);
  tabloBolumEkle(bolumler, atlananBolumler, {
    baslik: 'Kategori dağılımı',
    sutunlar: ['Kategori', 'Bu markette ürün', 'En ucuz olduğu ürün'],
    satirlar: katDagilimVeri.map((v) => [{ metin: v.k.label, yol: `/kategori/${v.k.slug}/` }, sayiTR(v.ist.urunSayisi), sayiTR(v.ist.enUcuzSayisi)]),
  });

  bolumler.push({
    baslik: 'Hangi illerde var',
    tur: 'liste',
    ogeler: iller,
  });
  bolumler.push({
    baslik: 'Ölçüm notu',
    tur: 'metin',
    metin: `Her market zinciri için API tek bir temsilci mağaza döndürüyor; bu mağaza zaman içinde değişebiliyor, gerçek raf fiyatı şehre ve mağazaya göre burada gösterilenden farklı olabilir. Fiyatı eksik olan ürünler toplamlara katılmıyor — ürün sayısı, ${marketAdi} için geçerli bir fiyat bulunan kalemlerin sayısıdır. "En ucuz" karşılaştırması yalnızca aynı ürünü en az iki markette satan kalemler üzerinden yapılıyor; il listesi ${ilMarketler.yaricap_km} km yarıçapla taranan en yakın mağaza verisine dayanıyor.`,
  });

  const icLinkler = [
    ...kategoriLinkleri(),
    ...marketLinkleri(marketKod),
    { yol: `/zam/${guncelAy}/`, metin: `${ZAM_AYLAR[Number(guncelAy.slice(5, 7)) - 1]} zamları` },
    { yol: '/hal/', metin: 'Hal fiyatları' },
    { yol: '/', metin: 'Pazar ana sayfa' },
  ];

  const ozet = `${marketAdi} için geçerli fiyatı bulunan ${sayiTR(genel.urunSayisi)} ürün ${sayiTR(kategoriSayisi)} kategoriye ve ${sayiTR(iller.length)} ile yayılıyor; en az iki markette karşılaştırılabilen ${sayiTR(ikiMarketliSayisi)} üründen ${sayiTR(genel.enUcuzSayisi)} tanesinde (%${oranTR(enUcuzOran)}) en ucuz market ${marketAdi}. Veriler marketfiyati.org.tr kaynaklı ve günlük tazeleniyor.`;
  const aciklama = `${marketAdi} fiyat listesi: ${sayiTR(genel.urunSayisi)} ürün, ${sayiTR(iller.length)} ilde mağaza kapsamı, en ucuz olduğu ürünler ve son 30 günde zamlananlar — Pazar'da market karşılaştırması.`;

  return {
    tip: 'market', yol: `/market/${slug(marketKod)}/`,
    baslik: `${marketAdi} fiyatları — ${sayiTR(genel.urunSayisi)} ürün, ${sayiTR(iller.length)} ilde`,
    titleEtiketi: `${marketAdi} Fiyatları | Pazar`,
    aciklama, ozet,
    veriDamgasi: VERI_DAMGASI, sonVeri: gunDamgasi(BUGUN),
    bolumler, icLinkler,
    uygulamaLinki: { yol: '/', metin: 'Uygulamada aç' },
    _atlananBolumler: atlananBolumler,
  };
}

for (const mk of MARKET_KODLARI) sayfaYazVeKaydet(marketSayfaModeliKur(mk));

// ═══════════════════════════════════════════════════════════════════════
// 3) KATEGORI SAYFALARI
// ═══════════════════════════════════════════════════════════════════════
function kategoriIcinZamSatirlari(kategoriSlug) {
  const out = [];
  for (const item of anasayfaZam) {
    const sid = item.u._sid;
    if (sidSlug.get(sid) !== kategoriSlug) continue;
    let en = null;
    for (const mk of Object.keys(item.marketArtis || {})) {
      const r = item.marketArtis[mk];
      if (!r || r.salinim || !(r.artis >= ZAM_ESIK)) continue;
      if (!en || r.artis > en.artis) en = r;
    }
    if (en) out.push({ ad: item.u.ad, zirve: en.zirve, sonHafta: en.sonHafta, artis: en.artis });
  }
  return out.sort((a, b) => b.artis - a.artis);
}

function kategoriSayfaModeliKur(kat) {
  const urunler = catCache[kat.slug] || [];
  const ikiMarketli = urunler.filter((u) => { const a = urunAnalizleri.get(u._sid); return a && !a.esit; });
  const esitFiyatli = urunler.filter((u) => { const a = urunAnalizleri.get(u._sid); return a && a.esit; }).length;
  const altKategoriSeti = new Set(urunler.map((u) => u.ana_kategori || 'Diğer'));
  const marketIst = katIstatistikleri.get(kat.slug);
  let enGenisMarket = null;
  for (const mk of MARKET_KODLARI) {
    const s = marketIst.get(mk).urunSayisi;
    if (!enGenisMarket || s > enGenisMarket.s) enGenisMarket = { mk, s };
  }

  const bolumler = [];
  const atlananBolumler = [];

  const farkListesi = ikiMarketli.map((u) => {
    const a = urunAnalizleri.get(u._sid);
    const birim = birimFiyatHesaplaIc(u);
    const fark = ((a.max - a.min) / a.min) * 100;
    return {
      u, a, fark,
      birimMetin: birim ? `${paraTutar(birim.deger)} ₺/${birim.birim}` : '—',
    };
  }).sort((a, b) => b.fark - a.fark);
  const ILK_N1 = 40;
  const gosterilen1 = farkListesi.slice(0, ILK_N1);
  const not1 = farkListesi.length > ILK_N1
    ? kirpmaNotu(farkListesi.length, gosterilen1.length, 'Fark yüzdesi en yüksek {toplam} üründen ilk {gosterilen} tanesi gösteriliyor.')
    : '';
  tabloBolumEkle(bolumler, atlananBolumler, {
    baslik: 'Marketler arası fark en yüksek ürünler',
    sutunlar: ['Ürün', 'En ucuz market ₺', 'En pahalı market ₺', 'Fark %', 'Birim fiyat'],
    satirlar: gosterilen1.map((r) => [
      r.u.ad,
      `${veBaglacliListeIc(r.a.enUcuzMarketler.map((m) => MARKET_NAMES[m] || m))} ${paraTR(r.a.min)}`,
      `${veBaglacliListeIc(r.a.enPahaliMarketler.map((m) => MARKET_NAMES[m] || m))} ${paraTR(r.a.max)}`,
      yuzdeIsaretli(r.fark), r.birimMetin,
    ]),
    not: not1,
  });

  const zamSatirlari = kategoriIcinZamSatirlari(kat.slug);
  const ILK_N2 = 20;
  const gosterilen2 = zamSatirlari.slice(0, ILK_N2);
  const not2 = zamSatirlari.length > ILK_N2
    ? kirpmaNotu(zamSatirlari.length, gosterilen2.length, 'Son 30 günde zamlanan {toplam} üründen ilk {gosterilen} tanesi gösteriliyor.')
    : '';
  tabloBolumEkle(bolumler, atlananBolumler, {
    baslik: 'Son 30 günde zamlananlar',
    sutunlar: ['Ürün', 'Zirve ₺', 'Son hafta ₺', 'Artış %'],
    satirlar: gosterilen2.map((r) => [r.ad, paraTR(r.zirve), paraTR(r.sonHafta), yuzdeIsaretli(r.artis)]),
    not: not2,
  });

  const altKatVeri = [...altKategoriSeti].map((ak) => {
    const grup = urunler.filter((u) => (u.ana_kategori || 'Diğer') === ak);
    const ikiM = grup.filter((u) => { const a = urunAnalizleri.get(u._sid); return a && !a.esit; }).length;
    return { ak, sayi: grup.length, ikiM };
  }).sort((a, b) => b.sayi - a.sayi);
  tabloBolumEkle(bolumler, atlananBolumler, {
    baslik: 'Alt kategoriler',
    sutunlar: ['Alt kategori', 'Ürün sayısı', '≥2 marketli sayısı'],
    satirlar: altKatVeri.map((v) => [v.ak, sayiTR(v.sayi), sayiTR(v.ikiM)]),
  });

  const marketKapsamVeri = MARKET_KODLARI.map((mk) => ({ mk, ist: marketIst.get(mk) })).sort((a, b) => b.ist.urunSayisi - a.ist.urunSayisi);
  tabloBolumEkle(bolumler, atlananBolumler, {
    baslik: 'Market kapsamı',
    sutunlar: ['Market', 'Bu kategoride ürün', 'En ucuz olduğu ürün'],
    satirlar: marketKapsamVeri.map((v) => [{ metin: MARKET_NAMES[v.mk], yol: `/market/${slug(v.mk)}/` }, sayiTR(v.ist.urunSayisi), sayiTR(v.ist.enUcuzSayisi)]),
  });

  bolumler.push({
    baslik: 'Nasıl okunur',
    tur: 'metin',
    metin: `Gramaj farklı olan ürünlerde çıplak fiyat yanıltır — 1 litre bir ürün 60 ₺ iken 200 ml'lik bir ürün 15 ₺ olabilir ama kilogram/litre başına daha pahalıdır. Bu yüzden fark tablosunda birim fiyat (₺/kg, ₺/L ya da ₺/adet) ayrıca gösteriliyor; ambalaj büyüklüğü hilesini görünür kılan bu sütundur. Her market zinciri için veride tek bir temsilci mağaza bulunuyor, gerçek raf fiyatı şehre göre değişebilir. Yalnızca aynı ürünü en az iki markette satan kalemler karşılaştırmaya giriyor; tek markette satılan ürünler bu tablolarda yer almaz.`,
  });

  const icLinkler = [
    ...marketLinkleri(),
    ...kategoriLinkleri(kat.slug),
    { yol: `/zam/${guncelAy}/`, metin: `${ZAM_AYLAR[Number(guncelAy.slice(5, 7)) - 1]} zamları` },
    { yol: '/hal/', metin: 'Hal fiyatları' },
    { yol: '/', metin: 'Pazar ana sayfa' },
  ];

  const oran = urunler.length ? (ikiMarketli.length / urunler.length) * 100 : 0;
  const ozet = `${kat.label} kategorisinde ${sayiTR(urunler.length)} ürün var; bunların ${sayiTR(ikiMarketli.length)} tanesinde (%${oranTR(oran)}) en az iki markette fiyat karşılaştırması yapılabiliyor, ${sayiTR(esitFiyatli)} üründe ise bütün marketler aynı fiyatı veriyor. ${sayiTR(altKategoriSeti.size)} alt kategoriye ayrılan bu grupta en geniş kapsamlı market ${MARKET_NAMES[enGenisMarket.mk]}.`;
  const aciklama = `${kat.label} kategorisinde ${sayiTR(urunler.length)} ürünün ${sayiTR(MARKET_KODLARI.length)} markette karşılaştırması, en yüksek fark gösteren ürünler, alt kategori kırılımı ve zamlananlar — Pazar'da.`;

  return {
    tip: 'kategori', yol: `/kategori/${kat.slug}/`,
    baslik: `${kat.label} fiyatları — ${sayiTR(urunler.length)} ürün, ${sayiTR(MARKET_KODLARI.length)} markette karşılaştırma`,
    titleEtiketi: `${kat.label} Fiyatları | Pazar`,
    aciklama, ozet,
    veriDamgasi: VERI_DAMGASI, sonVeri: gunDamgasi(BUGUN),
    bolumler, icLinkler,
    uygulamaLinki: { yol: '/', metin: 'Uygulamada aç' },
    _atlananBolumler: atlananBolumler,
  };
}

for (const kat of KATEGORILER) sayfaYazVeKaydet(kategoriSayfaModeliKur(kat));

// ═══════════════════════════════════════════════════════════════════════
// 4) HAL SAYFASI
// ═══════════════════════════════════════════════════════════════════════
function halModeliKur() {
  let eslesmeyen = 0;
  const bolumler = [];
  const atlananBolumler = [];

  const toplam = hal.urunler.length;
  const tekKayitli = hal.urunler.filter((u) => u.satir_sayisi === 1).length;
  const satirlar1 = hal.urunler.slice().sort((a, b) => a.ad.localeCompare(b.ad, 'tr')).map((u) => [
    u.satir_sayisi === 1 ? `${u.ad} *` : u.ad,
    paraTR(u.fiyat), paraTR(u.fiyat_min), paraTR(u.fiyat_max), sayiTR(u.satir_sayisi),
  ]);
  tabloBolumEkle(bolumler, atlananBolumler, {
    baslik: 'Bülten fiyatları',
    sutunlar: ['Ürün', '₺/kg', 'En düşük', 'En yüksek', 'Kayıt sayısı'],
    satirlar: satirlar1,
    not: tekKayitli > 0 ? `Yıldızlı (*) ${sayiTR(tekKayitli)} kalem bültende tek kayıtla geçiyor; ortalama, en düşük ve en yüksek bu tek kayıttan gelir.` : '',
  });

  const degisimler = [];
  for (const u of hal.urunler) {
    const anahtar = u.ad.toLocaleLowerCase('tr');
    const seri = halGecmis[anahtar];
    if (!Array.isArray(seri) || seri.length < 2) { eslesmeyen++; continue; }
    const dilim = seri.slice(-8);
    const ilk = dilim[0], son = dilim[dilim.length - 1];
    if (!ilk || !son || !(ilk.f > 0)) { eslesmeyen++; continue; }
    const degisim = ((son.f - ilk.f) / ilk.f) * 100;
    let min = dilim[0].f, max = dilim[0].f;
    for (const k of dilim) { if (k.f < min) min = k.f; if (k.f > max) max = k.f; }
    degisimler.push({ ad: u.ad, ilk: ilk.f, son: son.f, degisim, min, max });
  }
  console.log(`[hub] hal_gecmis eslesmeyen kalem: ${eslesmeyen} / ${toplam}`);
  degisimler.sort((a, b) => Math.abs(b.degisim) - Math.abs(a.degisim));
  const ILK_N2 = 20;
  const gosterilen2 = degisimler.slice(0, ILK_N2);
  const not2 = degisimler.length > ILK_N2
    ? kirpmaNotu(degisimler.length, gosterilen2.length, 'Haftada en çok değişen {toplam} kalemden ilk {gosterilen} tanesi gösteriliyor.')
    : '';
  tabloBolumEkle(bolumler, atlananBolumler, {
    baslik: 'Bir haftada en çok değişenler',
    sutunlar: ['Ürün', '7 gün önce ₺', 'Şimdi ₺', 'Değişim %', 'Haftanın en düşüğü', 'Haftanın en yükseği'],
    satirlar: gosterilen2.map((d) => [d.ad, paraTR(d.ilk), paraTR(d.son), yuzdeIsaretli(d.degisim), paraTR(d.min), paraTR(d.max)]),
    not: not2,
  });

  bolumler.push({
    baslik: 'Hal fiyatı market fiyatıyla neden doğrudan karşılaştırılmıyor',
    tur: 'metin',
    metin: `Hal fiyatları ile market fiyatlarını doğrudan karşılaştırmak yanıltıcı sonuçlar veriyor. Yapılan bir denetimde hal ile market kalemleri eşleştirilen 20 üründen 17'sinde market tarafındaki isimde hal kaleminde karşılığı olmayan bir çeşit ayrımı bulundu — örneğin "Şeker Domates 250 Gr" market fiyatı 158,00 ₺/kg iken hal bülteninde yalnızca "Domates" 21,56 ₺/kg olarak geçiyor; bu iki kalem aynı ürün değil. Ayrıca tasarruf paket ağırlığı üzerinden hesaplanmadığında yanlış sonuç çıkabiliyor: "Soya Filizi 125 Gr" için hal fiyatına göre "1.008 ₺ ucuz" gibi anlamsız bir iddia üretilebiliyor. Bu yüzden Pazar, hal ve market fiyatlarını yan yana koyup tasarruf hesabı yapmıyor; hal fiyatları burada yalnızca kendi bülten bağlamında, toptan referans olarak gösteriliyor.`,
  });

  const veriDamga = hal.cekme_tarihi.replace(' ', 'T') + '+03:00';
  const sonVeriDamga = gunDamgasi(hal.bulten_tarihi);
  const ozet = `${hal.bulten_tarihi} tarihli hal.gov.tr bülteninde Türkiye geneli için ${sayiTR(toplam)} kalemin kilogram fiyatı yayımlandı. Bülten hafta sonları güncellenmiyor; burada listelenen fiyatlar toptan hal fiyatlarıdır, market raf fiyatı değildir.`;
  const aciklama = `Hal.gov.tr'nin ${hal.bulten_tarihi} bülteninden ${sayiTR(toplam)} kalemin kilogram fiyatı, haftalık değişimi ve market fiyatıyla karşılaştırılamama nedeni — Pazar'da.`;

  return {
    tip: 'hal', yol: '/hal/',
    baslik: `Hal fiyatları — ${sayiTR(toplam)} kalem (${hal.bulten_tarihi} bülteni)`,
    titleEtiketi: `Hal Fiyatları (${hal.bulten_tarihi}) | Pazar`,
    aciklama, ozet,
    veriDamgasi: veriDamga, sonVeri: sonVeriDamga,
    bolumler,
    icLinkler: [
      { yol: '/kategori/meyve-sebze/', metin: 'Meyve & Sebze fiyatları' },
      { yol: '/', metin: 'Pazar ana sayfa' },
    ],
    uygulamaLinki: { yol: '/?screen=hal', metin: 'Uygulamada aç' },
    _atlananBolumler: atlananBolumler,
  };
}

sayfaYazVeKaydet(halModeliKur());

// ═══════════════════════════════════════════════════════════════════════
// 5) MANIFEST + OZET
// ═══════════════════════════════════════════════════════════════════════
fs.mkdirSync(HUB_DIR, { recursive: true });
fs.writeFileSync(path.join(HUB_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');

const uretilen = manifest.filter((m) => m.durum === 'uretildi').length;
const atlandi = manifest.filter((m) => m.durum === 'atlandi').length;
const sure = Date.now() - t0;
console.log('─'.repeat(60));
console.log(`[hub] TOPLAM: ${manifest.length} sayfa — ${uretilen} üretildi, ${atlandi} atlandı — ${sure} ms`);
if (sure >= 30000) console.warn(`[hub] UYARI: hedef süre 30 sn asildi (${sure} ms)`);
