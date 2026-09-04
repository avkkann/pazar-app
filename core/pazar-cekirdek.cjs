// ╔══════════════════════════════════════════════════════════════════╗
// ║  URETILMIS DOSYA — ELLE DUZENLEME.                                ║
// ║  Kaynak: app.js   Ureten: scripts/cekirdek-uret.mjs               ║
// ║  Yeniden uret: node scripts/cekirdek-uret.mjs                     ║
// ║  Ayrisma testi: node test_cekirdek.mjs                            ║
// ╚══════════════════════════════════════════════════════════════════╝
//
// Pazar cekirdegi — is mantiginin TEK kaynagi. Web (app.js) ve React Native
// istemcisi ayni kurallari buradan alir; kural iki yerde yazilmaz.
//
// KULLANIM:
//   const C = require('./pazar-cekirdek.cjs');       // veya <script src=...>
//   C.baglaAyarla({ sehirOku: () => 'İstanbul' });   // zorunlu enjeksiyon
//   C.durumAyarla({ gecmis: gecmisJson, puanlar: puanMap, ilMarketleri: harita });
//   C.urunAra('domates', katalog);
//
// NEDEN ENJEKSIYON: sehirOku() localStorage okuyor. Cekirdege kopyalanip
// RN'e gore degistirilseydi IKI KAYNAK olurdu. Cagiran taraf veriyor.
(function (kok, fabrika) {
  if (typeof module === 'object' && module.exports) module.exports = fabrika();
  else kok.PazarCekirdek = fabrika();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  // ── Enjekte edilen baglar ───────────────────────────────────────────
  let _bag = {
    sehirOku: function () { return null; },   // sehir secilmemis = filtre yok
  };
  function baglaAyarla(b) { _bag = Object.assign({}, _bag, b || {}); }
  function sehirOku() { return _bag.sehirOku(); }

  // ── app.js'in modul seviyesindeki onbellekleri ──────────────────────
  // Adlar app.js ile AYNI; asagidaki fonksiyon govdeleri birebir kopya
  // oldugu icin ayni adlari gormek ZORUNDALAR.
  let catCache = {};
  let productMap = {};
  // sepet: app.js'te "let sepet = _rawSepet" (localStorage'a bagli) oldugu icin
  // BIREBIR KOPYALANAMAZ. catCache/productMap ile ayni desen: burada tanimli,
  // disaridan doldruluyor. Market toplamlarini hesaplayan fonksiyonlar bunu okuyor.
  let sepet = [];

  /** Cekirdege veri verir. Hicbiri zorunlu degil; verilmeyen dokunulmaz. */
  function durumAyarla(d) {
    if (!d) return;
    if (d.katalog) {
      catCache = d.katalog;
      productMap = {};
      for (const slug of Object.keys(catCache)) {
        for (const u of catCache[slug] || []) {
          if (!u._id) u._id = u.ad + '_' + (u.agirlik_hacim || '');
          productMap[u._id] = u;
        }
      }
      _ahIndex = null; _ahIndexSize = 0;   // katalog degisti -> indeks bayat
    }
    if (d.gecmis) { _gecmisCache = d.gecmis; _seriCache = new Map(); }
    if (d.puanlar) _puanCache = d.puanlar;
    if (d.ilMarketleri) _ilMarketCache = d.ilMarketleri;
    // Bos dizi GECERLI bir deger (kullanici sepeti bosaltti) -> "if (d.sepet)" yanlis olurdu.
    if (Array.isArray(d.sepet)) sepet = d.sepet;
  }

  function durumOku() {
    return { katalogSlug: Object.keys(catCache), urunSayisi: Object.keys(productMap).length,
             gecmisVar: !!_gecmisCache, puanVar: !!_puanCache, ilVar: !!_ilMarketCache,
             sepetSayisi: sepet.length };
  }

  // ══ BURADAN ASAGISI app.js'TEN BIREBIR ═══════════════════════════════
const AL_ZAMANI_MIN_OYNAMA = 0.05;  // 30 gunde en az %5 oynama yoksa yorum yok

const AL_ZAMANI_TOLERANS = 0.02;    // uca %2 yakinlik "ucta" sayilir

const KART_GRUP = {
  'meyve': 'meyve', 'sebze': 'sebze',
  'et': 'et', 'tavuk': 'et', 'et tavuk': 'et', 'sarkuteri': 'et', 'balik': 'et', 'kirmizi et': 'et', 'beyaz et': 'et', 'deniz urunleri': 'et',
  'sut': 'sut', 'kahvalti': 'sut', 'sut kahvalti': 'sut',
  'temel gida': 'gida', 'gida': 'gida', 'bakliyat': 'gida', 'makarna': 'gida',
  'icecek': 'icecek', 'su': 'icecek', 'cay': 'icecek', 'kahve': 'icecek', 'kola': 'icecek',
  'temizlik': 'temizlik', 'deterjan': 'temizlik',
  'atistirmalik': 'atistirmalik', 'cips': 'atistirmalik', 'cikolata': 'atistirmalik', 'sekerleme': 'atistirmalik',
  'dondurulmus': 'dondurulmus'
};

const SEHIR_KEY = 'pazar_sehir';

const SUPHELI_KUTU_ESIK = 5;

const SUPHELI_SEBEP_CUMLE = {
  kisa_zirve:        'Fiyat birkaç gün önce zaten bu seviyedeydi',
  orta_zirve:        'Yüksek fiyat sadece birkaç gün sürdü',
  yuksek_oynaklik:   'Fiyat son ayda sürekli oynadı',
  tekrarli_dongu:    'Son 30 günde tekrarlayan zam-indirim döngüsü',
  tek_dongu:         'Son 30 günde bir zam-indirim döngüsü oldu',
  asiri_yuksek_oran: 'İndirim oranı gerçekçi değil'
};

const SUPHELI_ZAMANSAL_SEBEPLER = ['kisa_zirve', 'orta_zirve', 'tekrarli_dongu'];

const TUZAK_WHITELIST = new Set([
  "Süt", "S├╝t",
  "Yoğurt", "Yo─şurt",
  "Peynir",
  "Tereyağı ve Margarin", "Tereya─ş─▒ ve Margarin",
  "Ayran ve Kefir",
  "Su",
  "Maden Suyu",
  "Gazlı İçecekler", "Gazl─▒ ─░├ğecekler",
  "Meyve Suyu",
  "Bulaşık Temizlik Ürünleri", "Bula┼ş─▒k Temizlik ├£r├╝nleri",
  "Çamaşır Temizlik Ürünleri", "├çama┼ş─▒r Temizlik ├£r├╝nleri",
  "Genel Temizlik Ürünleri", "Genel Temizlik ├£r├╝nleri",
  "Duş Banyo ve Sabun", "Du┼ş Banyo ve Sabun",
  "Bakliyat",
  "Mantı Makarna ve Erişte",
  "Un ve İrmik", "Un ve ─░rmik",
  "Şeker ve Tatlandırıcılar", "┼Şeker ve Tatland─▒r─▒c─▒lar",
  "Sıvı Yağlar", "S─▒v─▒ Ya─şlar",
  "Bisküvi ve Kraker", "Bisk├╝vi ve Kraker",
  "Çikolata", "├çikolata",
  "Kuruyemiş ve Kuru Meyve", "Kuruyemi┼ş ve Kuru Meyve"
]);

const ZAM_ESIK = 15;        // bu yüzdenin altındaki artış listeye girmez

const ZAM_KAT_MAX = 3;      // aynı alt kategoriden en fazla kaç ürün

const ZAM_MARKA_MAX = 2;    // aynı markadan en fazla kaç ürün

const ZAM_MAX = 10;         // en fazla kaç ürün

const ZAM_MIN_KAYIT = 2;    // pencere öncesi en az kaç kayıt olmalı

const _ARAMA_GRUP_SLUG = { meyve: 'meyve-sebze', sebze: 'meyve-sebze' };

const MARKET_NAMES = {
  a101:'A101', bim:'BİM', carrefour:'CarrefourSA',
  migros:'Migros', sok:'ŞOK', tarim_kredi:'T.Kredi',
  hakmar:'Hakmar'
};

const MARKET_SIRALIYE = {
  a101:'A101', bim:'BİM', carrefour:'CarrefourSA',
  migros:'Migros', sok:'ŞOK', tarim_kredi:'Tarım Kredi',
  hakmar:'Hakmar'
};

const BOLME_MIN_KAZANC = 50;

const KAT_EMOJI = {
  meyve:'🍎', sebze:'🥦', et:'🥩', sut:'🧀',
  gida:'🥫', icecek:'🥤', temizlik:'🧴', atistirmalik:'🍫', dondurulmus:'🧊', diger:'📦'
};

const PAGE_SIZE = 48;

let _ahIndex = null;

let _ahIndexSize = 0;

let _gecmisCache = null;

let _ilMarketCache = null;

let _puanCache = null;

let _seriCache = new Map();

function trNormalize(s) {
  return String(s || '')
    // BIRLESIK NOKTA (U+0307). OLCULDU 2026-08-25: hal.json'daki 139 urunun
    // 56'sinda (%40) ad "Ci̇lek" gibi -- 'i' + COMBINING DOT ABOVE. Kaynaktaki
    // bozuk buyuk/kucuk harf donusumunden geliyor. Bu isaret soyulmadan
    // "cilek" yazan kullanici o 56 urunun HICBIRINI bulamiyordu.
    // Ana katalogda bu isaretten 0 tane var (olculdu, 16.696 urun) -> bu satir
    // orayi ETKILEMEZ, yalnizca hal aramasini kurtarir.
    .replace(/̇/g, '')
    .replace(/İ/g, 'i').replace(/I/g, 'i').replace(/ı/g, 'i')
    .replace(/Ş/g, 's').replace(/ş/g, 's')
    .replace(/Ğ/g, 'g').replace(/ğ/g, 'g')
    .replace(/Ü/g, 'u').replace(/ü/g, 'u')
    .replace(/Ö/g, 'o').replace(/ö/g, 'o')
    .replace(/Ç/g, 'c').replace(/ç/g, 'c')
    .toLowerCase().trim();
}

function norm(s) {
  return (s||'').toLowerCase()
    .replace(/ğ/g,'g').replace(/ü/g,'u').replace(/ş/g,'s')
    .replace(/ı/g,'i').replace(/ö/g,'o').replace(/ç/g,'c')
    .replace(/[^a-z0-9 ]/g,'').trim();
}

function tl(v) {
  return v == null ? '—' :
    v.toLocaleString('tr-TR',{minimumFractionDigits:2,maximumFractionDigits:2}) + ' ₺';
}

function ustKategori(k) {
  k = k || '';
  if (['Meyve'].includes(k)) return 'meyve';
  if (['Sebze'].includes(k)) return 'sebze';
  if (['Şarküteri','Beyaz Et','Kırmızı Et','Deniz Ürünleri','Sakatat',
       // 2026-09-01: veride vardi ama listede yoktu -> 'diger'e dusuyordu
       'Taze Deniz Ürünleri'].includes(k)) return 'et';
  if (['Süt','Yoğurt','Peynir','Tereyağı ve Margarin','Kaymak ve Krema','Yumurta',
       'Zeytin','Bal ve Reçel','Helva Tahin ve Pekmez','Kahvaltılık Gevrek Bar ve Granola',
       'Sürülebilir Ürünler ve Kahvaltılık Soslar','Ayran ve Kefir',
       // 2026-09-01: veride vardi ama listede yoktu -> 'diger'e dusuyordu
       'Diğer Süt Ürünleri'].includes(k)) return 'sut';
  if (['Mantı Makarna ve Erişte','Pasta Malzemeleri','Hazır Gıda','Bakliyat',
       'Ekmek ve Unlu Mamüller','Konserve','Salça','Ketçap Mayonez Sos ve Sirkeler',
       'Sıvı Yağlar','Tuz Baharat ve Harçlar','Şeker ve Tatlandırıcılar',
       'Turşu','Un ve İrmik','Bebek Mamaları',
       // 2026-09-01: veride vardi ama listede yoktu -> 'diger'e dusuyordu
       'Hazır Yemekler','Hazır Gıda Karışımları'].includes(k)) return 'gida';
  if (['Meyve Suyu','Su','Maden Suyu','Çay ve Bitki Çayları',
       'Gazsız İçecekler','Gazlı İçecekler','Kahve'].includes(k)) return 'icecek';
  if (['Bulaşık Temizlik Ürünleri','Kağıt Havlu','Kağıt Peçete ve Mendil',
       'Genel Temizlik Ürünleri','Hijyenik Ped','Çamaşır Temizlik Ürünleri',
       'Saç Bakım','Cilt Bakımı','Parfüm Deodorant Kolonya ve Kokular',
       'Mutfak Sarf Malzemeleri','Duş Banyo ve Sabun','Ağız Bakım',
       'Bebek ve Hasta Bezi','Temizlik ve Kişisel Bakım',
       // 2026-07-25: kaynak sitede kategori ikiye bolununce gelen yeni main_category degerleri
       'Ağda ve Epilasyon','Diğer Temizlik','Islak Mendiller','Kağıt Peçete ve Mendiller',
       'Parfüm ve Deodorant','Sağlık ve Medikal','Tuvalet Kağıtları','Tıraş Ürünleri',
       // 2026-09-01: veride vardi ama listede yoktu -> 'diger'e dusuyordu
       'Makyaj','Hasta Bakım Ürünleri'].includes(k)) return 'temizlik';
  if (['Bisküvi ve Kraker','Cips','Dondurmalar','Gofret','Kek','Kuruyemiş ve Kuru Meyve','Sakız ve Şekerleme','Tatlılar','Çikolata'].includes(k)) return 'atistirmalik';
  if (k === 'Dondurulmuş Ürünler') return 'dondurulmus';
  return 'diger';
}

// ── SKELETON ──────────────────────────────────────────

function markaBul(u) {
  if (!u || !u.ad) return '';
  const ilk = String(u.ad).trim().split(/\s+/)[0] || '';
  return ilk.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function _zamMarka(ad) {
  return String(ad || '').trim().split(/\s+/)[0].toLocaleLowerCase('tr');
}

function _birimFiyatHam(agirlikHacim, fiyat, ad) {
  if (!fiyat || fiyat <= 0) return null;
  const u = { agirlik_hacim: agirlikHacim, ad: ad };
  return _birimFiyatAyristir(u, fiyat);
}

function _birimFiyatAyristir(u, fiyat) {
  const s = String(u.agirlik_hacim || '').toLowerCase().replace(/,/g, '.');
  let m = s.match(/(\d+(?:\.\d+)?)\s*kg\b/);
  if (m) { const kg = parseFloat(m[1]); if (kg > 0) return { deger: fiyat / kg, birim: 'kg' }; }
  m = s.match(/(\d+(?:\.\d+)?)\s*gr?\b/);
  if (m) { const gr = parseFloat(m[1]); if (gr > 0) return { deger: (fiyat / gr) * 1000, birim: 'kg' }; }
  m = s.match(/(\d+(?:\.\d+)?)\s*ml\b/);
  if (m) { const ml = parseFloat(m[1]); if (ml > 0) return { deger: (fiyat / ml) * 1000, birim: 'L' }; }
  m = s.match(/(\d+(?:\.\d+)?)\s*(?:lt|litre|l)\b/);
  if (m) { const l = parseFloat(m[1]); if (l > 0) return { deger: fiyat / l, birim: 'L' }; }
  m = s.match(/x\s*(\d+)\b/) || s.match(/(\d+)\s*(?:lu|li|adet)\b/);
  if (m) { const a = parseInt(m[1], 10); if (a > 0) return { deger: fiyat / a, birim: 'adet' }; }
  if (u.ad) {
    const adS = String(u.ad).toLowerCase().replace(/'/g, '').replace(/,/g, '.');
    const m2 = adS.match(/(\d+)\s*adet\b/) || adS.match(/x\s*(\d+)\b/);
    if (m2) { const a = parseInt(m2[1], 10); if (a > 0) return { deger: fiyat / a, birim: 'adet' }; }
  }
  return null;
}

function birimFiyatHesapla(u) {
  if (!u) return null;
  const fiyat = enDusukFiyat(u);
  if (!fiyat || fiyat <= 0) return null;
  return _birimFiyatAyristir(u, fiyat);
}

function birimFiyatYazi(bf) {
  if (!bf) return '';
  return bf.birim + ' başına ' + tl(bf.deger);
}

// ── AYKIRI FİYAT FİLTRESİ ─────────────────────────────────────────
// Bir markette sehven girilmiş uçuk fiyat, "en pahalı" satırını ve tasarruf
// hesabını bozuyordu. Dönüş: { gecerli: [{market,fiyat}], gizlenen: [{market,fiyat}] }
// Her ikisi de girdi sırasını korur.
// Marketin ILAN ETTIGI liste fiyati (API: discountlessPrice). Bizim
// fiyat_gecmisi cikarimimizdan bagimsiz, kaynagin kendi beyani.
// Sadece urun detayinda, market fiyat satirinda gosterilir.

function _yerelGunISO(n) {
  const d = new Date();
  d.setDate(d.getDate() - (n || 0));
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') +
         '-' + String(d.getDate()).padStart(2, '0');
}

// Bir dizide bir DEĞER ayrılıp GERİ DÖNÜYORSA (iki ayrı blokta görünüyorsa)
// salınım vardır. Gerekçesi ve tolerans=0 ölçümü için bkz. zamSalinimVar.
// null girdiler (marketin o gün fiyatı bilinmiyor) atlanıyor.

function _zamGunISO(n) {
  return _yerelGunISO(n);
}

function _salinimVarSeri(seri) {
  if (!Array.isArray(seri)) return null;
  const gorulen = new Map();
  let blok = 0, onceki = null, sayi = 0, bulunan = null;
  for (let i = 0; i < seri.length; i++) {
    const v = seri[i];
    if (v == null) continue;
    if (sayi > 0 && v !== onceki) blok++;
    sayi++;
    if (bulunan === null && gorulen.has(v) && gorulen.get(v) !== blok) bulunan = v;
    gorulen.set(v, blok);
    onceki = v;
  }
  return sayi >= 3 ? bulunan : null;
}

// 30 günlük seriyi TEK GEÇİŞTE kurar ve üç çıktıyı birden verir:
//   marketSeri : her market için kendi carry-forward dizisi (bilinmeyen gün null)
//   tum        : günlük minimum, TÜM marketler üzerinden  (eski davranış)
//   temiz      : günlük minimum, yalnızca SALINIMSIZ marketler üzerinden
// Salınım testi zaten market serisini gerektirdiği için "temiz" varyantı bu
// hesabın içinden bedavaya çıkıyor — ikinci bir geçiş gerekmiyor. Ölçüm:
// tam tarama 1014 ms -> 660 ms (market dizileri artık gün başına yeniden
// taranmıyor, bir kez kurulup indeksleniyor).
//
// TEMIZ NİYE VAR: API her zincir için TEK temsilci mağaza döndürüyor ve
// temsilci zaman içinde değişiyor; mağaza değişimi seride hayalet bir dip
// bırakıyor. Erikli Su'da 30 günün dibi 10,00 ₺ görünüyordu, ürün 28,00 ₺ —
// o hedefe kurulan alarm hiç çalmaz. Salınımsız seriden gelen 18,75 ₺ ise
// istikrarlı seviyede gerçekten gözlenmiş bir fiyat.
//
// GELECEK — BU GEÇİCİ: scraper 2026-08-11'den beri market_fiyatlari içine
// depot_id/depot_ad yazıyor. 2-3 hafta veri birikince "bu dip gerçekten başka
// mağazanın mı" sorusu DOĞRUDAN cevaplanabilecek; bu yapısal ayrım o zaman
// depot_id değişimini izleyen ölçüme dayalı kuralla değiştirilmeli.

function _seriKur(sid) {
  const bos = { tum: [], temiz: [], marketSeri: new Map(), salinimli: new Set() };
  if (!sid || !_gecmisCache) return bos;
  const bellek = _seriCache.get(sid);
  if (bellek) return bellek;
  const kayitlar = _gecmisCache[sid];
  if (!Array.isArray(kayitlar) || !kayitlar.length) return bos;

  const marketler = {};
  kayitlar.forEach(k => {
    if (!k || !k.t || k.f == null || !(k.f > 0)) return;
    const m = k.m || '?';
    if (!marketler[m]) marketler[m] = [];
    marketler[m].push(k);
  });
  Object.values(marketler).forEach(a => a.sort((x, y) => x.t < y.t ? -1 : 1));

  const gunler = [];
  for (let i = 29; i >= 0; i--) gunler.push(_yerelGunISO(i));

  const marketSeri = new Map();
  const salinimli = new Set();
  for (const m of Object.keys(marketler)) {
    const a = marketler[m];
    const seri = new Array(30).fill(null);
    let j = 0, son = null;
    for (let i = 0; i < 30; i++) {
      while (j < a.length && a[j].t <= gunler[i]) { son = a[j]; j++; }
      seri[i] = son ? son.f : null;
    }
    marketSeri.set(m, seri);
    if (_salinimVarSeri(seri) !== null) salinimli.add(m);
  }

  const tum = [], temiz = [];
  for (let i = 0; i < 30; i++) {
    let hepsi = null, sade = null;
    for (const [m, seri] of marketSeri) {
      const v = seri[i];
      if (v == null) continue;
      if (hepsi === null || v < hepsi) hepsi = v;
      if (!salinimli.has(m) && (sade === null || v < sade)) sade = v;
    }
    if (hepsi !== null) tum.push(hepsi);
    if (sade !== null) temiz.push(sade);
  }

  // SUSTURMA YOK: hiç salınımsız market yoksa temiz seri tüm seriye düşer.
  const out = { tum: tum, temiz: temiz.length ? temiz : tum, marketSeri: marketSeri, salinimli: salinimli };
  _seriCache.set(sid, out);
  return out;
}

function otuzGunlukSeri(sid) { return _seriKur(sid).tum; }

function otuzGunlukSeriTemiz(sid) { return _seriKur(sid).temiz; }

function otuzGunMinFiyat(sid) {
  const seri = otuzGunlukSeri(sid);
  if (!seri.length) return null;
  return Math.min.apply(null, seri);
}

// Salınımsız serinin dibi. Hedef fiyat için savunabileceğimiz değer bu:
// istikrarlı bir seviyede GERÇEKTEN gözlenmiş fiyat. Bkz. _seriKur.

function otuzGunMinFiyatTemiz(sid) {
  const seri = otuzGunlukSeriTemiz(sid);
  if (!seri.length) return null;
  return Math.min.apply(null, seri);
}

function enDusukFiyat(u) {
  if (!u || !Array.isArray(u.market_fiyatlari) || !u.market_fiyatlari.length) return null;
  let min = Infinity;
  u.market_fiyatlari.forEach(mf => {
    const f = parseFloat(mf.fiyat);
    if (!isNaN(f) && f > 0 && f < min) min = f;
  });
  return min === Infinity ? null : min;
}

// Hedef fiyat onerisi. Onceden alan enDusuk*0.95 ile doluyordu — keyfi bir %5,
// urunun gercek gecmisiyle hicbir bagi yok, o yuzden alarmlar ates almiyordu.
// Artik oneri son 30 gunun GERCEKTEN gorulmus en dusuk fiyati.

function fiyatlariTemizle(market_fiyatlari) {
  const liste = (market_fiyatlari || []).filter(f => f && f.fiyat != null);
  if (liste.length < 2) return { gecerli: liste.slice(), gizlenen: [] };

  const gecerli = [], gizlenen = [];

  // 2 market: biri diğerinin 5 katından fazlaysa yüksek olanı gizle
  if (liste.length === 2) {
    const dusuk  = liste[0].fiyat <= liste[1].fiyat ? liste[0] : liste[1];
    const yuksek = dusuk === liste[0] ? liste[1] : liste[0];
    if (dusuk.fiyat > 0 && yuksek.fiyat > dusuk.fiyat * 5) {
      liste.forEach(f => (f === yuksek ? gizlenen : gecerli).push(f));
    } else {
      liste.forEach(f => gecerli.push(f));
    }
    return { gecerli, gizlenen };
  }

  // 3+ market: kendisi hariç diğerlerinin medyanının 3 katından yüksekse gizle
  const medyan = sayilar => {
    const s = sayilar.slice().sort((a, b) => a - b);
    const o = Math.floor(s.length / 2);
    return s.length % 2 ? s[o] : (s[o - 1] + s[o]) / 2;
  };
  liste.forEach((f, i) => {
    const m = medyan(liste.filter((_, j) => j !== i).map(x => x.fiyat));
    if (m > 0 && f.fiyat > m * 3) gizlenen.push(f);
    else gecerli.push(f);
  });
  return { gecerli, gizlenen };
}

// ── TAZELİK DAMGASI ───────────────────────────────────────────────
// son_senkron yoksa/bozuksa sessizce düşer, hata basmaz.

function indirimRozetiHesapla(urun) {
  if (!urun || !urun._sid) return null;
  const seri = otuzGunlukSeri(urun._sid);
  if (seri.length < 2) return null;
  const zirve = Math.max.apply(null, seri);
  const simdi = urun.en_dusuk_fiyat;
  if (zirve == null || simdi == null || zirve <= simdi) return null;

  const dusus = ((zirve - simdi) / zirve) * 100;
  if (dusus >= 25) return { tip: 'buyuk', yuzde: Math.round(dusus) };
  if (dusus >= 10) return { tip: 'normal', yuzde: Math.round(dusus) };
  return null;
}

function supheliDurum(u) {
  if (!u || !u._sid || !_puanCache) return null;
  const k = _puanCache.get(u._sid);
  if (!k || k.indirim_supheli_puan == null || k.indirim_supheli_puan < 2) return null;
  // Rozet bir iddiaya verilen cevap: ortada indirim yoksa sahteligini iddia
  // etmek anlamsiz. Olcut mevcut indirim rozetiyle AYNI (yeni esik uydurulmaz);
  // o indirim gormuyorsa hicbir sey gosterilmez.
  if (!indirimRozetiHesapla(u)) return null;
  const sebepler = (k.indirim_supheli_sebepler || [])
    .map(s => String(s).trim())
    .filter(s => SUPHELI_SEBEP_CUMLE[s]);
  const zamansalVar = sebepler.some(s => SUPHELI_ZAMANSAL_SEBEPLER.indexOf(s) >= 0);
  return {
    seviye: (k.indirim_supheli_puan >= SUPHELI_KUTU_ESIK && zamansalVar) ? 'kutu' : 'rozet',
    puan: k.indirim_supheli_puan,
    sebepler: sebepler,
    dusus: k.indirim_supheli_dusus_yuzde
  };
}

function alZamaniDurumu(u) {
  if (!u || !u._sid) return null;
  // Supheli indirimde hicbir tavsiye verilmez — "iyi zaman" demek celiskili olur.
  if (supheliDurum(u)) return null;
  // urunRozetleriHTML detayin TEK rozet kaynagi. O bir sey soyluyorsa bu blok
  // susar; ikisi ayni anda konusunca celisiyorlar. Olcum: 186 "bekle" urunu ayni
  // anda indirim rozeti tasiyordu — Dolma Biber'de rozet "30 gunun en dusugu"
  // derken blok "son ayda 79,00 TL'ye kadar indi" diyordu.
  // gercekIndirimRozetiHesapla zaten indirimRozetiHesapla'ya bagli, bu tek
  // kontrol ucunu birden kapsiyor.
  if (indirimRozetiHesapla(u)) return null;
  // Zam blogu ayni olguyu daha ayrintili anlatiyor; ikisi birden cizilince
  // detaydaki yigin 5'e cikiyordu. Ayni kural: zam blogu konusuyorsa bu susar.
  if (typeof zamDurumu === 'function' && zamDurumu(u)) return null;
  const gecerli = fiyatlariTemizle(u.market_fiyatlari).gecerli.map(f => f.fiyat).filter(f => f > 0);
  if (!gecerli.length) return null;
  const bugun = Math.min.apply(null, gecerli);
  const seri = otuzGunlukSeri(u._sid);
  if (seri.length < 30) return null;              // 30 gunu doldurmayan urunde yorum yok
  // Uygunluk kapısı yukarıda TÜM seride kaldı (susturma yok); yalnızca ÖLÇÜLEN
  // uçlar salınımsız seriden alınıyor — hayalet dip "bekle"yi "iyi zaman"
  // gösteriyordu. Bkz. _seriKur.
  const olcum = otuzGunlukSeriTemiz(u._sid);
  const min = Math.min.apply(null, olcum);
  const max = Math.max.apply(null, olcum);
  if (!(max > 0) || min >= max) return null;
  if ((max - min) / max < AL_ZAMANI_MIN_OYNAMA) return null;

  if (bugun <= min * (1 + AL_ZAMANI_TOLERANS)) {
    return { tip: 'iyi', bugun: bugun, min: min, max: max };
  }
  if (bugun >= max * (1 - AL_ZAMANI_TOLERANS) && min < bugun) {
    return { tip: 'bekle', bugun: bugun, min: min, max: max };
  }
  return null;
}

function _hamDipMi(sid, deger) {
  if (deger == null || !(deger > 0)) return false;
  const ham = otuzGunlukSeri(sid);
  if (!ham || !ham.length) return false;
  return deger <= Math.min.apply(null, ham) + 0.005;
}

function zamOlcutu(kayitlar, pencereBas, pencereSon) {
  if (!Array.isArray(kayitlar) || !pencereBas || !pencereSon) return null;
  const gecerli = kayitlar.filter(k => k && k.t && k.f > 0);
  const eski = gecerli.filter(k => k.t < pencereBas);
  if (eski.length < ZAM_MIN_KAYIT) return null;
  const zirve = Math.max.apply(null, eski.map(k => k.f));
  if (!(zirve > 0)) return null;
  const icinde = gecerli.filter(k => k.t <= pencereSon).sort((a, b) => a.t < b.t ? -1 : (a.t > b.t ? 1 : 0));
  if (!icinde.length) return null;
  const sonDeger = icinde[icinde.length - 1].f;
  return { artis: ((sonDeger - zirve) / zirve) * 100, zirve: zirve, sonDeger: sonDeger, kayit: eski.length };
}

// Ölçüt TEK SERIDEKIYLE AYNI, yalnizca kapsam market: son 7 gun ortalamasi,
// o marketin pencere oncesi tepesiyle karsilastiriliyor. ZIRVE ve KAYIT
// SAYISI ESIGI zamOlcutu'ndan geliyor (paylasilan kisim); ORTALAMA mantigi
// (son 7 gunun ortalamasi) burada, degismeden kaliyor — davranis birebir ayni.

function zamSalinimVar(sid, market) {
  return _salinimVarSeri(zamMarketSerisi(sid, market));
}

function zamMarketSerisi(sid, market) {
  if (!sid || !market || !_gecmisCache) return null;
  // _seriKur market kirilimini zaten kuruyor ve memoize ediyor — burada
  // yeniden kurmuyoruz. Dizi salt okunur kullanilmali.
  const seri = _seriKur(sid).marketSeri.get(market);
  if (!seri) return null;
  if (seri[0] == null) return null;     // pencerenin basinda fiyat bilinmiyorsa olcme
  return seri;
}

function zamMarketArtisi(sid, market) {
  const seri = zamMarketSerisi(sid, market);
  if (!seri) return null;
  const sonHafta = seri.slice(23, 30).reduce((a, b) => a + b, 0) / 7;
  const pencereBas = _zamGunISO(29);
  const pencereSon = _zamGunISO(0);
  const kayitlar = (_gecmisCache[sid] || []).filter(k => k && k.m === market);
  const olcut = zamOlcutu(kayitlar, pencereBas, pencereSon);
  if (!olcut) return null;
  return { artis: ((sonHafta - olcut.zirve) / olcut.zirve) * 100, zirve: olcut.zirve, sonHafta: sonHafta, kayit: olcut.kayit };
}

function zamDurumu(u) {
  if (!u || !u._sid || !_gecmisCache) return null;
  const gecerli = fiyatlariTemizle(u.market_fiyatlari).gecerli.filter(f => f.fiyat > 0);
  let enIyi = null;
  gecerli.forEach(f => {
    if (!marketVarMi(f.market)) return;
    const r = zamMarketArtisi(u._sid, f.market);
    if (!r || r.artis < ZAM_ESIK) return;
    if (!enIyi || r.artis > enIyi.artis) enIyi = { market: f.market, ...r };
  });
  return enIyi;
}

function zamAdaylari() {
  return zamSecHavuzdan(zamHavuzu());
}

function zamHavuzu() {
  if (!_gecmisCache) return [];
  const urunler = [];
  const gorulen = {};
  Object.values(catCache || {}).forEach(liste => (liste || []).forEach(u => {
    if (u && u._sid && !gorulen[u._sid]) { gorulen[u._sid] = 1; urunler.push(u); }
  }));
  const havuz = [];
  urunler.forEach(u => {
    // MEVSİM TUZAĞI: taze meyve/sebzede fiyat sezona göre doğal oynuyor.
    const kat = ustKategori(u.ana_kategori || '');
    if (kat === 'meyve' || kat === 'sebze') return;
    const gecerli = fiyatlariTemizle(u.market_fiyatlari).gecerli.filter(f => f.fiyat > 0);
    if (!gecerli.length) return;
    // Ürünün satıldığı HER market ölçülüyor (şehir filtresi YOK — seçimde).
    const marketArtis = {};
    let adayVar = false;
    gecerli.forEach(f => {
      if (!f.market || marketArtis[f.market] !== undefined) return;
      const r = zamMarketArtisi(u._sid, f.market);
      if (!r) { marketArtis[f.market] = null; return; }
      const kayit = { artis: r.artis, zirve: r.zirve, sonHafta: r.sonHafta, kayit: r.kayit };
      // Salınımlı seride "yeni seviye" iddiası kurulamaz — bkz. zamSalinimVar.
      // Kayıt SİLİNMİYOR, işaretleniyor: aday seçiminden düşer ama yaygınlık
      // sayımı (zamMarketDurumu) onu görmeye devam eder — canlı yolla aynı.
      if (zamSalinimVar(u._sid, f.market) !== null) kayit.salinim = true;
      else if (r.artis >= ZAM_ESIK) adayVar = true;
      marketArtis[f.market] = kayit;
    });
    if (!adayVar) return;
    havuz.push({ u: u, marketArtis: marketArtis });
  });
  return havuz;
}

function zamSecHavuzdan(havuz) {
  if (!Array.isArray(havuz) || !havuz.length) return [];
  const adaylar = [];
  havuz.forEach(x => {
    if (!x || !x.u || !x.marketArtis) return;
    const u = x.u;
    // Şehir seçiliyse o ilde bulunmayan zincirin ürünü listeye girmesin.
    let enIyi = null;
    Object.keys(x.marketArtis).forEach(m => {
      if (!marketVarMi(m)) return;
      const r = x.marketArtis[m];
      if (!r || r.salinim || r.artis < ZAM_ESIK) return;
      if (!enIyi || r.artis > enIyi.artis) {
        enIyi = { u: u, ad: u.ad, market: m, eski: r.zirve, yeni: r.sonHafta,
                  artis: r.artis, kayit: r.kayit };
      }
    });
    if (enIyi) adaylar.push(enIyi);
  });
  adaylar.sort((a, b) => b.artis - a.artis);

  // ÇEŞİTLİLİK: marka başına en fazla 2, alt kategori başına en fazla 3.
  // Kural yüzünden liste dolmazsa EŞİK DÜŞÜRÜLMEZ, daha az ürünle gösterilir.
  const secilen = [], markaSay = {}, katSay = {};
  for (const x of adaylar) {
    if (secilen.length >= ZAM_MAX) break;
    const mk = _zamMarka(x.ad);
    const ak = (x.u && x.u.ana_kategori) || '';
    if ((markaSay[mk] || 0) >= ZAM_MARKA_MAX) continue;
    if ((katSay[ak] || 0) >= ZAM_KAT_MAX) continue;
    markaSay[mk] = (markaSay[mk] || 0) + 1;
    katSay[ak] = (katSay[ak] || 0) + 1;
    secilen.push(x);
  }
  return secilen;
}

function _aramaSkoru(ad, qn) {
  const adn = trNormalize(ad);
  if (!qn || !adn) return 0;
  const kelimeler = adn.split(/[^a-z0-9]+/).filter(Boolean);
  if (kelimeler.includes(qn)) return 3;
  if (kelimeler.some(w => w.startsWith(qn))) return 2;
  if (adn.includes(qn)) return 1;
  return 0;
}

function urunAra(liste, q) {
  const qn = trNormalize(q);
  if (!qn) return [];
  const bulunan = [];
  for (const u of (liste || [])) {
    const s = _aramaSkoru(u && u.ad, qn);
    if (s) bulunan.push({ u: u, s: s });
  }
  bulunan.sort((a, b) => b.s - a.s || String(a.u.ad || '').length - String(b.u.ad || '').length);
  return bulunan.map(x => x.u);
}

// Kategori onerisi: "icecek" yazan kullanici urun adi eslesmesine dusup
// bos ekran gormesin. ANA KATEGORI eslesmesi TAM KELIME arar -- startsWith
// birakilsaydi "tuz" yine "Tuz Baharat ve Harclar"in tamamini isaret ederdi.

function _ahIndexRebuildIfNeeded() {
  const size = Object.keys(productMap).length;
  if (_ahIndex && size === _ahIndexSize) return;
  _ahIndex = {};
  for (const k in productMap) {
    const u = productMap[k];
    if (!u) continue;
    const key = (u.ana_kategori || '') + '|' + (markaBul(u) || '');
    if (!_ahIndex[key]) _ahIndex[key] = [];
    _ahIndex[key].push(u);
  }
  _ahIndexSize = size;
}

function ayniUrunMu(u1, u2) {
  if (!u1 || !u2) return false;
  if (u1._id === u2._id) return false;
  if ((u1.ana_kategori || '') !== (u2.ana_kategori || '')) return false;
  if (markaBul(u1) !== markaBul(u2)) return false;
  const norm = (ad, ah) => {
    let s = String(ad || '').toLowerCase();
    if (ah) s = s.replace(String(ah).toLowerCase(), '');
    return s.replace(/\d+\s*(?:kg|gr?|ml|l|lu|lü|li|lı|adet)\b/gi, '')
            .replace(/[^a-z0-9çğıöşü ]/gi, ' ')
            .replace(/\s+/g, ' ').trim();
  };
  return norm(u1.ad, u1.agirlik_hacim) === norm(u2.ad, u2.agirlik_hacim);
}

function digerPaketleriBul(u) {
  if (!u || !productMap) return [];
  _ahIndexRebuildIfNeeded();
  const key = (u.ana_kategori || '') + '|' + (markaBul(u) || '');
  const aday = _ahIndex[key] || [];
  const out = [];
  for (const v of aday) {
    if (!v || v._id === u._id) continue;
    if (ayniUrunMu(u, v)) out.push(v);
  }
  return out;
}

function ilMarketleri() {
  const il = sehirOku();
  if (!il) return null;
  const harita = (_ilMarketCache && _ilMarketCache.iller) || null;
  if (!harita) return null;
  const kayit = harita[il];
  if (!kayit || !Array.isArray(kayit.marketler) || !kayit.marketler.length) return null;
  return new Set(kayit.marketler);
}

// Tek karar noktası. Şehir seçili değilse HER ZAMAN true — hiçbir şey gizlenmez.

function marketVarMi(m) {
  const s = ilMarketleri();
  if (!s) return true;
  return s.has(m);
}

function _sepetMarketFiyati(u, market) {
  const f = fiyatlariTemizle(u.market_fiyatlari).gecerli
    .filter(x => x.market === market && x.fiyat != null)
    .sort((a, b) => a.fiyat - b.fiyat)[0];
  return f ? f.fiyat : null;
}

function marketToplamlari() {
  const liste = sepet || [];
  if (!liste.length) return [];
  // Sehir seciliyse o ilde BULUNMAYAN zincir hic aday olmasin — kullaniciyi
  // gidemeyecegi bir markete yonlendirmeyelim. Secim yoksa marketVarMi hep true.
  const marketler = new Set();
  liste.forEach(u => fiyatlariTemizle(u.market_fiyatlari).gecerli.forEach(f => {
    if (f.market && marketVarMi(f.market)) marketler.add(f.market);
  }));
  const sonuc = [];
  marketler.forEach(m => {
    let toplam = 0, varOlan = 0;
    liste.forEach(u => {
      const f = _sepetMarketFiyati(u, m);
      if (f != null) { toplam += f; varOlan++; }
    });
    sonuc.push({
      market: m, ad: MARKET_NAMES[m] || m,
      toplam: toplam, varOlan: varOlan, eksik: liste.length - varOlan
    });
  });
  // Sepetin tamamını karşılayanlar önce, sonra ucuzdan pahalıya.
  sonuc.sort((a, b) => (a.eksik - b.eksik) || (a.toplam - b.toplam));
  return sonuc;
}

function sepetBolmeOnerisi() {
  const liste = sepet || [];
  const bos = { oner: false, tekMarket: null, ikili: null, kazanc: 0 };
  if (!liste.length) return bos;
  const toplamlar = marketToplamlari();
  const tamKapsayan = toplamlar.filter(m => m.eksik === 0);
  if (!tamKapsayan.length) return bos;
  const tek = tamKapsayan[0];

  // En iyi İKİ market kombinasyonu. İkiden fazlaya asla bölmüyoruz.
  const adaylar = toplamlar.map(m => m.market);
  let enIyi = null;
  for (let i = 0; i < adaylar.length; i++) {
    for (let j = i + 1; j < adaylar.length; j++) {
      const ikili = [adaylar[i], adaylar[j]];
      let toplam = 0, kapsandi = 0;
      liste.forEach(u => {
        let en = null;
        ikili.forEach(m => {
          const f = _sepetMarketFiyati(u, m);
          if (f != null && (en == null || f < en)) en = f;
        });
        if (en != null) { toplam += en; kapsandi++; }
      });
      if (kapsandi !== liste.length) continue;   // ikisi birlikte sepeti karşılamıyorsa geçersiz
      if (!enIyi || toplam < enIyi.toplam) {
        enIyi = { marketler: ikili, adlar: ikili.map(m => MARKET_NAMES[m] || m), toplam: toplam };
      }
    }
  }
  if (!enIyi) return { oner: false, tekMarket: tek, ikili: null, kazanc: 0 };
  const kazanc = tek.toplam - enIyi.toplam;
  return { oner: kazanc >= BOLME_MIN_KAZANC, tekMarket: tek, ikili: enIyi, kazanc: kazanc > 0 ? kazanc : 0 };
}

function enIyiBirimIdleri(liste) {
  const sonuc = new Set();
  if (!liste || !liste.length) return sonuc;
  const gruplar = {};
  liste.forEach(u => {
    const bf = birimFiyatHesapla(u);
    if (!bf || !(bf.deger > 0)) return;
    if (!gruplar[bf.birim]) gruplar[bf.birim] = [];
    gruplar[bf.birim].push({ id: u._id, deger: bf.deger });
  });
  Object.values(gruplar).forEach(g => {
    if (g.length < 2) return;
    // Eşit birim fiyata sahip TÜM ürünler işaretlenir -- yalnızca ilk
    // rastlanan değil. Aksi halde aynı birim fiyata sahip iki üründen
    // biri "en ucuz" alır, diğeri almaz: yanlış değil ama yanıltıcı.
    const enDeger = Math.min(...g.map(x => x.deger));
    g.forEach(x => { if (x.deger === enDeger && x.id != null) sonuc.add(x.id); });
  });
  return sonuc;
}
// ══ BIREBIR KOPYA SONU ═════════════════════════════════════════════════

  return {
    baglaAyarla: baglaAyarla,
    durumAyarla: durumAyarla,
    durumOku: durumOku,
    AL_ZAMANI_MIN_OYNAMA: AL_ZAMANI_MIN_OYNAMA,
    AL_ZAMANI_TOLERANS: AL_ZAMANI_TOLERANS,
    BOLME_MIN_KAZANC: BOLME_MIN_KAZANC,
    KART_GRUP: KART_GRUP,
    KAT_EMOJI: KAT_EMOJI,
    MARKET_NAMES: MARKET_NAMES,
    MARKET_SIRALIYE: MARKET_SIRALIYE,
    PAGE_SIZE: PAGE_SIZE,
    SEHIR_KEY: SEHIR_KEY,
    SUPHELI_KUTU_ESIK: SUPHELI_KUTU_ESIK,
    SUPHELI_SEBEP_CUMLE: SUPHELI_SEBEP_CUMLE,
    SUPHELI_ZAMANSAL_SEBEPLER: SUPHELI_ZAMANSAL_SEBEPLER,
    TUZAK_WHITELIST: TUZAK_WHITELIST,
    ZAM_ESIK: ZAM_ESIK,
    ZAM_KAT_MAX: ZAM_KAT_MAX,
    ZAM_MARKA_MAX: ZAM_MARKA_MAX,
    ZAM_MAX: ZAM_MAX,
    ZAM_MIN_KAYIT: ZAM_MIN_KAYIT,
    _ARAMA_GRUP_SLUG: _ARAMA_GRUP_SLUG,
    _ahIndexRebuildIfNeeded: _ahIndexRebuildIfNeeded,
    _aramaSkoru: _aramaSkoru,
    _birimFiyatAyristir: _birimFiyatAyristir,
    _birimFiyatHam: _birimFiyatHam,
    _hamDipMi: _hamDipMi,
    _salinimVarSeri: _salinimVarSeri,
    _sepetMarketFiyati: _sepetMarketFiyati,
    _seriKur: _seriKur,
    _yerelGunISO: _yerelGunISO,
    _zamGunISO: _zamGunISO,
    _zamMarka: _zamMarka,
    alZamaniDurumu: alZamaniDurumu,
    ayniUrunMu: ayniUrunMu,
    birimFiyatHesapla: birimFiyatHesapla,
    birimFiyatYazi: birimFiyatYazi,
    digerPaketleriBul: digerPaketleriBul,
    enDusukFiyat: enDusukFiyat,
    enIyiBirimIdleri: enIyiBirimIdleri,
    fiyatlariTemizle: fiyatlariTemizle,
    ilMarketleri: ilMarketleri,
    indirimRozetiHesapla: indirimRozetiHesapla,
    markaBul: markaBul,
    marketToplamlari: marketToplamlari,
    marketVarMi: marketVarMi,
    norm: norm,
    otuzGunMinFiyat: otuzGunMinFiyat,
    otuzGunMinFiyatTemiz: otuzGunMinFiyatTemiz,
    otuzGunlukSeri: otuzGunlukSeri,
    otuzGunlukSeriTemiz: otuzGunlukSeriTemiz,
    sepetBolmeOnerisi: sepetBolmeOnerisi,
    supheliDurum: supheliDurum,
    tl: tl,
    trNormalize: trNormalize,
    urunAra: urunAra,
    ustKategori: ustKategori,
    zamAdaylari: zamAdaylari,
    zamDurumu: zamDurumu,
    zamHavuzu: zamHavuzu,
    zamMarketArtisi: zamMarketArtisi,
    zamMarketSerisi: zamMarketSerisi,
    zamOlcutu: zamOlcutu,
    zamSalinimVar: zamSalinimVar,
    zamSecHavuzdan: zamSecHavuzdan,
  };
});
