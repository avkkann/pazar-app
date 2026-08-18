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
import { enYeniGozlemTarihi } from './veri-tarihi.mjs';
import { gunDamgasi } from './hub-sayfa.mjs';

const KOK = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const D = (p) => path.join(KOK, p);

const { ic, ctx } = appOrtamiKur({ kok: KOK });

const t0 = Date.now();
await ic('loadAllCats()');
await ic('gecmisVeriGetir()');
const urunSayisi = ic('Object.values(catCache).reduce((a,b)=>a+(b?b.length:0),0)');
console.log(`[anasayfa] veri hazir: ${urunSayisi} urun, ${Date.now() - t0} ms`);

// Kart cizimi icin gereken ALANLAR (bkz. _stripKartHTML + birimFiyatHesapla).
// market_fiyatlari yalnizca market+fiyat ile tasiniyor: sehir filtresi ve
// birim fiyat bunu kullaniyor, gerisi ana sayfada gereksiz.
ic(`function _asKart(u) {
  return {
    _id: u._id, _sid: u._sid, ad: u.ad, resim: u.resim || null,
    ana_kategori: u.ana_kategori || '', agirlik_hacim: u.agirlik_hacim || null,
    en_dusuk_fiyat: u.en_dusuk_fiyat != null ? u.en_dusuk_fiyat : null,
    market_fiyatlari: (u.market_fiyatlari || [])
      .filter(f => f && f.market && f.fiyat != null)
      .map(f => ({ market: f.market, fiyat: f.fiyat })),
  };
}`);

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

const cikti = {
  surum: 1,
  uretim: new Date().toISOString(),
  veri_tarihi: veriTarihi,
  urun_sayisi: urunSayisi,
  zam: zam,
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
