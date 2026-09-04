// scripts/mercek-uret.mjs
// "Mercek" sekmesinin verisini BUILD zamaninda hesaplayip data/mercek.json'a yazar.
//
// NEDEN AYRI DOSYA (anasayfa.json'a eklenmedi): anasayfa.json bugun 209 KB ve
// ANA SAYFADA yukleniyor. Buradaki listeler ana sayfada gerekmiyor; Mercek
// sekmesi acilinca tembel yuklenecek. gecmis_fiyatlar.json'un ana sayfadan
// bilincli olarak cikarilmis olmasiyla ayni gerekce.
//
// KRITIK KURAL (anasayfa-uret.mjs ile ayni): MANTIK YENIDEN YAZILMIYOR.
// app.js node:vm icinde kosturuluyor, kart bicimi _asKart'tan geliyor.
//
// URETTIGI DORT BOLUM:
//   ilanYalan       A1 — ilan edilen "eski fiyat" gecmiste hic gorulmemis olanlar
//   marketIstatistik A5 — hangi market kac uruncte en ucuz (hub-uret.mjs'teki
//                        hesabin ayni kurali; orada vardi, uygulamaya girmiyordu)
//   supheliTum      A4 — supheli indirim listesinin TAMAMI (ana sayfa 49 tasiyor)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { appOrtamiKur } from './app-vm.mjs';
import { asKartTanimla } from './kart-bicimi.mjs';

const KOK = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const D = (p) => path.join(KOK, p);
const { ic, ctx } = appOrtamiKur({ kok: KOK });

asKartTanimla(ic);

const t0 = Date.now();
await ic('loadAllCats()');

// ── Katalogu ve gecmisi DISKTEN oku ───────────────────────────────────
// VM sinirindan 20 MB gecirmek okumaktan pahali (anasayfa-uret.mjs:124 ayni
// gerekceyle boyle yapiyor).
const gecmis = JSON.parse(fs.readFileSync(D('data/gecmis_fiyatlar.json'), 'utf8'));
const katalog = [];
for (const f of fs.readdirSync(D('data'))) {
  if (!/^urunler_.*\.json$/.test(f)) continue;
  const d = JSON.parse(fs.readFileSync(D('data/' + f), 'utf8'));
  katalog.push(...(Array.isArray(d) ? d : (d.urunler || [])));
}
console.log(`[mercek] katalog ${katalog.length} urun, gecmis ${Object.keys(gecmis).length} anahtar`);

// ══════════════════════════════════════════════════════════════════════
// A1 — ILAN EDILEN "ESKI FIYAT" GECMISTE HIC GORULMEDI
// ══════════════════════════════════════════════════════════════════════
// ilan_indirim_gecmisi[] = {tarih, market, liste_fiyat, satis_fiyat}
// gecmis_fiyatlar.json  = {_sid: [{t, m, f}]}
//
// OLCUM DISIPLINI — bu liste bir SUCLAMA DEGIL:
//  · Yalnizca o markette >=3 gozlemimiz varsa bakiyoruz (tek gozlemle
//    "hic gorulmedi" demek olcum degil gurultudur).
//  · Esik %10: esiksiz tarama 1.186 kayit (%15,0) veriyor ama icinde
//    "67,25 vs 66,50" gibi yuvarlama gurultusu var. %10 uzeri 359 kayit (%4,5).
//  · Pencere 101 gun (2026-05-25 ->). Fiyat pencereden ONCE ya da iki gunluk
//    ornekleme ARASINDA var olmus olabilir.
// Bu yuzden istemcideki dil "market yalan soyluyor" degil "biz gormedik".
const ILAN_ESIK = 1.10;
const ILAN_MIN_GOZLEM = 3;
const ILAN_MAX = 120;

const tIlan = Date.now();
const ilanAdaylar = [];
for (const u of katalog) {
  const seri = gecmis[u._sid];
  if (!Array.isArray(seri) || !seri.length) continue;
  const enYuksek = {}, gozlem = {};
  for (const p of seri) {
    const m = p && p.m, f = p && p.f;
    if (!m || typeof f !== 'number' || !(f > 0)) continue;
    enYuksek[m] = Math.max(enYuksek[m] || 0, f);
    gozlem[m] = (gozlem[m] || 0) + 1;
  }
  // Ayni urun+market icin EN AGIR kaydi al (ayni ilan tekrar tekrar yaziliyor)
  const enAgir = new Map();
  for (const k of (u.ilan_indirim_gecmisi || [])) {
    const m = k && k.market, lf = k && k.liste_fiyat;
    if (!m || typeof lf !== 'number' || !(lf > 0)) continue;
    if (!(m in enYuksek) || gozlem[m] < ILAN_MIN_GOZLEM) continue;
    if (lf <= enYuksek[m] * ILAN_ESIK) continue;
    const kayit = { market: m, ilan: lf, gorulen: enYuksek[m], gozlem: gozlem[m],
                    sisme: Math.round((lf / enYuksek[m] - 1) * 100), tarih: k.tarih || null };
    const v = enAgir.get(m);
    if (!v || kayit.sisme > v.sisme) enAgir.set(m, kayit);
  }
  for (const kayit of enAgir.values()) ilanAdaylar.push({ sid: u._sid, kayit });
}
ilanAdaylar.sort((a, b) => b.kayit.sisme - a.kayit.sisme);
const ilanYalan = [];
const sidIndeks = new Map(katalog.map((u) => [u._sid, u]));
for (const a of ilanAdaylar.slice(0, ILAN_MAX)) {
  ctx.__u = sidIndeks.get(a.sid);
  const kart = ic('(() => { if (!__u._id) __u._id = __u.ad + "_" + (__u.agirlik_hacim || ""); return _asKart(__u); })()');
  if (kart) ilanYalan.push({ u: kart, ...a.kayit });
}
console.log(`[mercek] ilanYalan: ${ilanAdaylar.length} aday -> ${ilanYalan.length} yazildi, ${Date.now() - tIlan} ms`);

// ══════════════════════════════════════════════════════════════════════
// A5 — HANGI MARKET KAC URUNDE EN UCUZ
// ══════════════════════════════════════════════════════════════════════
// Kural hub-uret.mjs:191 marketIstatistikleriCikar ile AYNI: yalnizca
// >=2 markette fiyati olan urunler sayilir (tek marketli urunde "en ucuz"
// diye bir sey yok), esitlik durumunda hicbir markete puan yazilmaz.
const tMar = Date.now();
const marketSayac = new Map();
let karsilastirilabilir = 0, esitlik = 0;
for (const u of katalog) {
  const enDusuk = new Map();
  for (const f of (u.market_fiyatlari || [])) {
    if (!f || !f.market || !(f.fiyat > 0)) continue;
    const v = enDusuk.get(f.market);
    if (v == null || f.fiyat < v) enDusuk.set(f.market, f.fiyat);
    if (!marketSayac.has(f.market)) marketSayac.set(f.market, { urunSayisi: 0, enUcuzSayisi: 0 });
  }
  for (const m of enDusuk.keys()) marketSayac.get(m).urunSayisi++;
  if (enDusuk.size < 2) continue;
  karsilastirilabilir++;
  const min = Math.min(...enDusuk.values());
  const kazananlar = [...enDusuk.entries()].filter(([, v]) => v === min).map(([m]) => m);
  if (kazananlar.length > 1) { esitlik++; continue; }   // ESITLIKTE PUAN YOK
  marketSayac.get(kazananlar[0]).enUcuzSayisi++;
}
const marketIstatistik = [...marketSayac.entries()]
  .map(([market, v]) => ({ market, ...v,
    oran: karsilastirilabilir ? Math.round((v.enUcuzSayisi / karsilastirilabilir) * 1000) / 10 : 0 }))
  .sort((a, b) => b.enUcuzSayisi - a.enUcuzSayisi);
console.log(`[mercek] marketIstatistik: ${karsilastirilabilir} karsilastirilabilir urun, ${esitlik} esitlik, ${Date.now() - tMar} ms`);

// ══════════════════════════════════════════════════════════════════════
// A4 — SUPHELI INDIRIM LISTESININ TAMAMI
// ══════════════════════════════════════════════════════════════════════
// anasayfa.json puan>=4 filtresiyle 49 kayit tasiyor; indirim_analiz_son.json
// 419 supheli + 961 "dikkat" raporluyor. Burada esik 2'ye iniyor (dikkat dahil).
// supheliDurum() IKI kapiya bakiyor: (1) _puanCache dolu olmali —
// supheliPuanlariYukle() cagrilmadan hepsi null doner; (2) urun SU AN
// indirimde olmali (indirimRozetiHesapla). Ikinci kapi BILINCLI ve
// KALDIRILMADI: ortada indirim yokken "bu indirim supheli" demek anlamsiz.
// Yani "419'un tamami" gosterilemez; gosterilebilir olan, puan>=2 olup
// SU AN indirim iddiasi tasiyanlar.
await ic('supheliPuanlariYukle()');
const tSup = Date.now();
const supheliTum = await (async () => {
  try {
    const { data, error } = await ic('supabaseClient').from('urunler').select('*')
      .gte('indirim_supheli_puan', 2)
      .order('indirim_supheli_puan', { ascending: false })
      .limit(1200);
    if (error || !data) { console.warn('[mercek] supheli sorgu hatasi: ' + (error && error.message)); return []; }
    ctx.__ham = data;
    return ic(`(() => {
      const out = [];
      __ham.forEach(u => {
        if (!u._id) u._id = u.ad + '_' + (u.agirlik_hacim || '');
        const d = supheliDurum(u);
        if (!d) return;
        const ir = indirimRozetiHesapla(u);
        out.push({ u: _asKart(u), puan: u.indirim_supheli_puan,
                   yuzde: ir ? ir.yuzde : 0, durum: d });
      });
      return out;
    })()`);
  } catch (e) { console.warn('[mercek] supheli alinamadi: ' + e.message); return []; }
})();
console.log(`[mercek] supheliTum: ${supheliTum.length} kayit, ${Date.now() - tSup} ms`);

// ══════════════════════════════════════════════════════════════════════
const cikti = {
  surum: 1,
  uretim: new Date().toISOString(),
  olcum: {
    ilanEsikYuzde: Math.round((ILAN_ESIK - 1) * 100),
    ilanMinGozlem: ILAN_MIN_GOZLEM,
    ilanAdaySayisi: ilanAdaylar.length,
    karsilastirilabilirUrun: karsilastirilabilir,
    esitlikSayisi: esitlik,
    katalogUrun: katalog.length,
  },
  ilanYalan,
  marketIstatistik,
  supheliTum,
};
fs.writeFileSync(D('data/mercek.json'), JSON.stringify(cikti), 'utf8');
const kb = fs.statSync(D('data/mercek.json')).size / 1024;
console.log(`[mercek] data/mercek.json yazildi: ${kb.toFixed(1)} KB ham  (toplam ${Date.now() - t0} ms)`);
