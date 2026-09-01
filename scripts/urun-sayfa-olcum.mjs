// scripts/urun-sayfa-olcum.mjs — "Urun basina statik sayfa" (CLAUDE.md siradaki isler #2) icin KARAR OLCUMU.
// Soru: kac urun, deponun KENDI ince-icerik esigini (hub-sayfa.mjs:
// ESIK_SATIR=12, ESIK_KELIME=300) gecebilecek bir sayfa uretir?
// Yeni esik UYDURULMUYOR -- mevcut olan kullaniliyor.
import { readFileSync, readdirSync } from 'node:fs';

const ESIK_SATIR = 12, ESIK_KELIME = 300;
const gecmis = JSON.parse(readFileSync('data/gecmis_fiyatlar.json', 'utf8'));

const kelimeSay = (s) => String(s || '').trim().split(/\s+/).filter(Boolean).length;

let toplam = 0;
const dagilim = { satir: {}, gecen: 0, kalan: 0 };
const sebep = { satirYok: 0, kelimeYok: 0, ikisiDe: 0 };
const marketDagilim = {};
let gecenOrnek = [], kalanOrnek = [];

for (const f of readdirSync('data').filter(x => /^urunler_.*\.json$/.test(x))) {
  for (const u of JSON.parse(readFileSync('data/' + f, 'utf8'))) {
    toplam++;
    const marketler = (u.market_fiyatlari || []).filter(m => m && m.fiyat > 0);
    const kayitlar = (gecmis[u._sid] || []).filter(k => k && k.f > 0);
    marketDagilim[marketler.length] = (marketDagilim[marketler.length] || 0) + 1;

    // Bir urun sayfasinin TABLO SATIRLARI: market fiyat satirlari + fiyat
    // gecmisi satirlari. (Rozet/birim fiyat tablo satiri degil, metin.)
    const satir = marketler.length + kayitlar.length;

    // KELIME: ad + gramaj + kategori + market adlari + gecmis tarihleri +
    // sayfanin acıklama metni. Aciklama metni SABIT sablon oldugu icin
    // COMERTCE 60 kelime sayildi -- yani bu tahmin urunler LEHINE.
    let kelime = kelimeSay(u.ad) + kelimeSay(u.agirlik_hacim) + kelimeSay(u.ana_kategori) + 60;
    kelime += marketler.length * 3;      // "BIM 34,90 TL"
    kelime += kayitlar.length * 3;       // "12 Agustos 34,90 TL"

    const gecti = satir >= ESIK_SATIR && kelime >= ESIK_KELIME;
    const kova = satir >= 30 ? '30+' : satir >= 12 ? '12-29' : satir >= 6 ? '6-11' : satir >= 3 ? '3-5' : '0-2';
    dagilim.satir[kova] = (dagilim.satir[kova] || 0) + 1;
    if (gecti) { dagilim.gecen++; if (gecenOrnek.length < 3) gecenOrnek.push({ ad: u.ad, satir, kelime }); }
    else {
      dagilim.kalan++;
      if (satir < ESIK_SATIR && kelime < ESIK_KELIME) sebep.ikisiDe++;
      else if (satir < ESIK_SATIR) sebep.satirYok++;
      else sebep.kelimeYok++;
      if (kalanOrnek.length < 3) kalanOrnek.push({ ad: u.ad, satir, kelime });
    }
  }
}

const y = (n) => `${n} (%${(n / toplam * 100).toFixed(1)})`;
console.log('=== URUN SAYFASI ICIN INCE ICERIK OLCUMU ===');
console.log(`Esikler deponun KENDI degerleri: ESIK_SATIR=${ESIK_SATIR}, ESIK_KELIME=${ESIK_KELIME}\n`);
console.log('toplam urun:', toplam);
console.log('  esigi GECEN :', y(dagilim.gecen));
console.log('  esigin ALTINDA:', y(dagilim.kalan));
console.log('\nkalanlarin sebebi:');
console.log('  hem satir hem kelime yetersiz:', y(sebep.ikisiDe));
console.log('  yalniz satir yetersiz        :', y(sebep.satirYok));
console.log('  yalniz kelime yetersiz       :', y(sebep.kelimeYok));

console.log('\nSATIR SAYISI DAGILIMI (market + fiyat gecmisi):');
for (const k of ['0-2', '3-5', '6-11', '12-29', '30+']) if (dagilim.satir[k]) console.log(`  ${k.padStart(6)}: ${y(dagilim.satir[k])}`);

console.log('\nURUN BASINA MARKET SAYISI:');
for (const k of Object.keys(marketDagilim).sort((a, b) => a - b)) console.log(`  ${k} market: ${y(marketDagilim[k])}`);

console.log('\nornek GECEN :', JSON.stringify(gecenOrnek));
console.log('ornek KALAN :', JSON.stringify(kalanOrnek));
