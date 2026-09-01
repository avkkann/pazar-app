// scripts/depot-olcum.mjs — HAYALET ZAM olcumu (tekrarlanabilir)
//
// SORU: API her market zinciri icin TEK TEMSILCI magaza donduruyor ve temsilci
// sabit degil (2026-08-11'de tek ornekle gorulmustu: carrefour-1012 169,95 ->
// carrefour-5027 171,50). Magaza degisimi gecmisimizde ZAM gibi mi gorunuyor?
//
// VERI KAYNAGI GIT: depot_id fiyat gecmisinde YOK (gecmis_fiyatlar.json {t,m,f}
// tutuyor, depot tasimiyor) -- ama data/urunler_*.json her gece commit'leniyor
// ve 2026-08-11'den beri market_fiyatlari kayitlarinda depot_id var. Yani depot
// gecmisi git'te duruyor. Bu script onu cikarip olcuyor.
//
// KULLANIM:  node scripts/depot-olcum.mjs [--since=2026-08-11]
// Cikti sadece rapor; hicbir dosyayi DEGISTIRMEZ.
//
// NOT: deploy build'i shallow checkout yapiyor (fetch-depth verilmiyor), bu
// yuzden bu script CI'da degil YERELDE kosturulur. Amaci kural degistirmeden
// once olcum uretmek -- CLAUDE.md'nin "olcum olmadan yeni esik uydurma" kurali.
import { execSync } from 'node:child_process';

const since = (process.argv.find(a => a.startsWith('--since=')) || '--since=2026-08-11').split('=')[1];
const ESIK = 15; // ZAM_ESIK ile ayni. Yeni esik UYDURULMUYOR.
const DOSYALAR = ['meyve', 'et', 'sut', 'gida', 'icecek', 'temizlik', 'atistirmalik', 'dondurulmus']
  .map(k => `data/urunler_${k}.json`);

// ── 1. Gunluk snapshot'lari topla ───────────────────────────────────────────
const ham = execSync(`git log --format="%H %ad" --date=short --since=${since} -- data/urunler_et.json`,
  { maxBuffer: 1e9 }).toString().trim().split('\n').filter(Boolean);
const gunler = new Map();
for (const s of ham) {
  const [sha, tarih] = s.trim().split(/\s+/);
  if (!gunler.has(tarih)) gunler.set(tarih, sha);   // gunun SON commit'i
}
const sirali = [...gunler.entries()].sort((a, b) => a[0].localeCompare(b[0]));
if (sirali.length < 3) {
  console.error(`[depot] yalnizca ${sirali.length} gun bulundu — olcum icin yetersiz.`);
  console.error('  Sebep genellikle SHALLOW CLONE: `git fetch --unshallow` gerekebilir.');
  process.exit(1);
}
console.log(`[depot] ${sirali.length} gun: ${sirali[0][0]} -> ${sirali.at(-1)[0]}\n`);

const seri = new Map();  // "sid|market" -> [[gunIndex, depot_id, fiyat]]
sirali.forEach(([, sha], gi) => {
  for (const dosya of DOSYALAR) {
    let arr;
    try { arr = JSON.parse(execSync(`git show ${sha}:${dosya}`, { maxBuffer: 1e9 }).toString()); }
    catch { continue; }
    for (const u of arr) {
      if (!u._sid) continue;
      for (const m of (u.market_fiyatlari || [])) {
        if (!m || !m.market || m.fiyat == null) continue;
        const k = u._sid + '|' + m.market;
        if (!seri.has(k)) seri.set(k, []);
        seri.get(k).push([gi, m.depot_id || null, m.fiyat]);
      }
    }
  }
});

// ── 2. Ardisik gun ciftleri: depot degisimi fiyat sicramasini acikliyor mu? ──
const ayni = [], degisti = [];
const marketIst = {};
for (const [k, kayit] of seri) {
  const market = k.split('|')[1];
  marketIst[market] ||= { cift: 0, depotDegisim: 0, esik: 0, esikDepotlu: 0, seri: 0, salinim: 0, depotDegisenSeri: 0 };
  kayit.sort((a, b) => a[0] - b[0]);
  for (let i = 1; i < kayit.length; i++) {
    const [g0, d0, f0] = kayit[i - 1], [g1, d1, f1] = kayit[i];
    if (g1 !== g0 + 1 || !f0 || !f1 || !d0 || !d1) continue;
    const dy = ((f1 - f0) / f0) * 100;
    const dd = d0 !== d1;
    (dd ? degisti : ayni).push(dy);
    marketIst[market].cift++;
    if (dd) marketIst[market].depotDegisim++;
    if (dy >= ESIK) { marketIst[market].esik++; if (dd) marketIst[market].esikDepotlu++; }
  }
}
const oran = (a, b) => b ? +(a / b * 100).toFixed(2) : 0;
const esikUstu = d => d.filter(x => x >= ESIK).length;
const sabit = d => d.filter(x => Math.abs(x) < 0.01).length;

console.log('=== ARDISIK GUN CIFTLERI ===');
console.log(`toplam ${ayni.length + degisti.length} | ayni depot ${ayni.length} | depot DEGISTI ${degisti.length}`);
console.table([
  { durum: 'AYNI depot', n: ayni.length, 'fiyat degismeyen %': oran(sabit(ayni), ayni.length), [`%${ESIK}+ artis %`]: oran(esikUstu(ayni), ayni.length) },
  { durum: 'DEPOT DEGISTI', n: degisti.length, 'fiyat degismeyen %': oran(sabit(degisti), degisti.length), [`%${ESIK}+ artis %`]: oran(esikUstu(degisti), degisti.length) }
]);
const toplamEsik = esikUstu(ayni) + esikUstu(degisti);
console.log(`%${ESIK}+ artislarin depot degisimiyle CAKISANI: ${esikUstu(degisti)}/${toplamEsik} (%${oran(esikUstu(degisti), toplamEsik)})`);
console.log(`KONTROL: depot degisip fiyat HIC degismeyen cift %${oran(sabit(degisti), degisti.length)} -> depot degisimi TEK BASINA zam demek DEGIL.\n`);

// ── 3. Salinim ile depot degisimi AYNI OLGU MU? ─────────────────────────────
// app.js'teki salinim ilkesi: seri bir seviyeden AYRILIP GERI DONUYOR (tolerans 0).
function salinimVar(f) {
  for (let i = 0; i < f.length; i++)
    for (let j = i + 2; j < f.length; j++)
      if (f[j] === f[i]) for (let k = i + 1; k < j; k++) if (f[k] !== f[i]) return true;
  return false;
}
for (const [k, kayit] of seri) {
  const market = k.split('|')[1];
  if (kayit.length < 3) continue;
  marketIst[market].seri++;
  if (salinimVar(kayit.map(x => x[2]))) marketIst[market].salinim++;
  if (new Set(kayit.map(x => x[1]).filter(Boolean)).size > 1) marketIst[market].depotDegisenSeri++;
}
console.log('=== SALINIM vs DEPOT DEGISIMI (zincir bazinda) ===');
console.table(Object.entries(marketIst).map(([m, v]) => ({
  market: m, seri: v.seri,
  'salinimli %': oran(v.salinim, v.seri),
  'depot degisen %': oran(v.depotDegisenSeri, v.seri),
  [`%${ESIK}+ artisin depotlu payi %`]: oran(v.esikDepotlu, v.esik)
})).sort((a, b) => b.seri - a.seri));

console.log(`
YORUM ICIN KONTROL GRUBU: bim zincirinde depot degisimi %0'dir. Salinim depot
degisiminden doguyor olsaydi bim'de salinim orani da ~0 olmaliydi. Tabloya bak:
degilse "salinim elemesini depot kuraliyla DEGISTIR" onerisi CURUR -- ikisi
farkli olgudur ve salinim elemesi kaldirilirsa bim korumasiz kalir.`);
