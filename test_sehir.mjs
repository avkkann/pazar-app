// Sehir secimi + zincir mevcudiyeti.
// Sehir SECILMEMISKEN hicbir davranis degismemeli — testlerin yarisi bunu kilitliyor.
import fs from 'fs';
import vm from 'vm';

const APP = fs.readFileSync('app.js', 'utf8');
const HTML = fs.readFileSync('index.html', 'utf8');
const CSS = fs.readFileSync('style.css', 'utf8');
const IL = JSON.parse(fs.readFileSync('data/il_marketler.json', 'utf8'));

let pass = 0, fail = 0;
const ok = (ad, k, d = '') => { if (k) { pass++; console.log('  PASS  ' + ad); } else { fail++; console.log('  FAIL  ' + ad + (d ? '  -> ' + d : '')); } };

function fnKaynak(ad) {
  let bas = APP.indexOf('function ' + ad + '(');
  if (bas < 0) return null;
  if (APP.slice(Math.max(0, bas - 6), bas) === 'async ') bas -= 6;
  let dd = 0;
  for (let j = APP.indexOf('{', bas); j < APP.length; j++) {
    const c = APP[j];
    if (c === '{') dd++;
    else if (c === '}') { dd--; if (dd === 0) return APP.slice(bas, j + 1); }
  }
  return null;
}

console.log('\n=== 0. VERI DOSYASI ===');
ok('data/il_marketler.json var', !!IL.iller);
ok('81 il', Object.keys(IL.iller).length === 81, Object.keys(IL.iller).length);
ok('yaricap kayitli', IL.yaricap_km > 0, IL.yaricap_km);
ok('her ilde en az 1 zincir', Object.values(IL.iller).every(x => (x.marketler || []).length > 0));
ok('Gaziantep\'te hakmar YOK', !IL.iller['Gaziantep'].marketler.includes('hakmar'), IL.iller['Gaziantep'].marketler);
ok('Gaziantep\'te carrefour YOK', !IL.iller['Gaziantep'].marketler.includes('carrefour'), IL.iller['Gaziantep'].marketler);
ok('Istanbul\'da ikisi de VAR',
   IL.iller['İstanbul'].marketler.includes('hakmar') && IL.iller['İstanbul'].marketler.includes('carrefour'),
   IL.iller['İstanbul'].marketler);

const GEREKEN = ['sehirOku', 'sehirSec', 'ilMarketleri', 'marketVarMi', 'profilSehirHTML'];
console.log('\n=== 1. YAPI ===');
const eksik = [];
for (const f of GEREKEN) { const v = !!fnKaynak(f); ok('function ' + f, v); if (!v) eksik.push(f); }
if (eksik.length) { console.log('\n  Eksik: ' + eksik.join(', ')); console.log('\nPASS=' + pass + '  FAIL=' + fail); process.exit(1); }

function kur(sehir) {
  const depo = {};
  const ctx = {
    console, Math, JSON, Array, Object, Number, String, isNaN, Set, Map,
    MARKET_NAMES: { a101: 'A101', bim: 'BİM', migros: 'Migros', carrefour: 'CarrefourSA', sok: 'ŞOK', tarim_kredi: 'Tarım Kredi', hakmar: 'Hakmar' },
    _ilMarketCache: IL,
    localStorage: {
      getItem: k => (k in depo ? depo[k] : null),
      setItem: (k, v) => { depo[k] = String(v); },
      removeItem: k => { delete depo[k]; },
    },
    document: { getElementById: () => null, querySelectorAll: () => [] },
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  const sabit = (APP.match(/const SEHIR_KEY\s*=\s*'[^']*';/) || [''])[0];
  vm.runInContext([sabit, ...GEREKEN.map(fnKaynak)].join('\n'), ctx);
  if (sehir) vm.runInContext('sehirSec(' + JSON.stringify(sehir) + ')', ctx);
  return ctx;
}
const calis = (ctx, i) => vm.runInContext(i, ctx);

console.log('\n=== 2. SEHIR SECILMEMISKEN: HICBIR SEY DEGISMEZ ===');
{
  const c = kur(null);
  ok('sehirOku() null', calis(c, 'sehirOku()') === null, calis(c, 'sehirOku()'));
  ok('ilMarketleri() null (filtre YOK demek)', calis(c, 'ilMarketleri()') === null, JSON.stringify(calis(c, 'ilMarketleri()')));
  ok('marketVarMi("hakmar") true', calis(c, 'marketVarMi("hakmar")') === true);
  ok('marketVarMi("carrefour") true', calis(c, 'marketVarMi("carrefour")') === true);
  ok('marketVarMi(bilinmeyen) true (gizleme yok)', calis(c, 'marketVarMi("zzz")') === true);
  ok('profil bolumu yine de ciziliyor (secim yapilabilsin)', calis(c, 'profilSehirHTML()') !== '');
}

console.log('\n=== 3. SEHIR SECILIYKEN ===');
{
  const c = kur('Gaziantep');
  ok('sehirOku() Gaziantep', calis(c, 'sehirOku()') === 'Gaziantep', calis(c, 'sehirOku()'));
  const s = calis(c, '[...ilMarketleri()]');
  // ESKI IDDIA: s.length === 5. Bu sayi CANLI data/il_marketler.json'dan
  // geliyor ve HAFTALIK is (Il Market Haritasi) onu guncelliyor — Gaziantep
  // 5'ten 4'e dusunce test kirildi (bu turda HEAD'de de kirmiziydi, benim
  // degisikligimden degil). Sayiyi sabitlemek kirilgan; artik DAVRANIS
  // dogrulaniyor: iterable donuyor, dolu, ve icerigi dosyayla birebir ayni.
  const gzt = (JSON.parse(fs.readFileSync('data/il_marketler.json', 'utf8'))
    .iller['Gaziantep'] || {}).marketler || [];
  ok('ilMarketleri() Set donuyor ve dosyayla tutarli',
    Array.isArray(s) && s.length > 0 && s.length === gzt.length && gzt.every(m => s.includes(m)),
    JSON.stringify(s) + '  vs dosya ' + JSON.stringify(gzt));
  ok('hakmar YOK', calis(c, 'marketVarMi("hakmar")') === false);
  ok('carrefour YOK', calis(c, 'marketVarMi("carrefour")') === false);
  ok('bim VAR', calis(c, 'marketVarMi("bim")') === true);
  ok('migros VAR', calis(c, 'marketVarMi("migros")') === true);
}
{
  const c = kur('İstanbul');
  ok('Istanbul: hakmar VAR', calis(c, 'marketVarMi("hakmar")') === true);
  ok('Istanbul: carrefour VAR', calis(c, 'marketVarMi("carrefour")') === true);
}
{
  const c = kur('Olmayanİl');
  ok('haritada olmayan il -> filtre YOK (guvenli taraf)', calis(c, 'ilMarketleri()') === null);
  ok('  ve hepsi gorunur', calis(c, 'marketVarMi("hakmar")') === true);
}

console.log('\n=== 4. SEPETI BOL / msSheet SADECE MEVCUT ZINCIRLERI KULLANIYOR ===');
{
  const mt = fnKaynak('marketToplamlari') || '';
  ok('marketToplamlari marketVarMi ile suzuyor', /marketVarMi\s*\(/.test(mt), mt.split('\n').filter(l => /market/.test(l)).slice(0, 3).join(' | '));
  const kr = fnKaynak('karsilastir') || '';
  ok('karsilastir (msSheet kaynagi) marketVarMi ile suzuyor', /marketVarMi\s*\(/.test(kr), '');
  const sb = fnKaynak('sepetBolmeOnerisi') || '';
  ok('sepetBolmeOnerisi marketToplamlari uzerinden besleniyor (ayri filtre gerekmez)',
     /marketToplamlari\s*\(/.test(sb), '');
}

console.log('\n=== 5. FILTRE PILL\'LERI VE TERCIH MARKETLERI ===');
{
  const src = APP;
  ok('pill gizleme fonksiyonu var', /function sehirPillleriUygula/.test(src), '');
  const pm = fnKaynak('profilMarketTercihHTML') || '';
  ok('tercih marketleri marketVarMi ile suzuluyor', /marketVarMi\s*\(/.test(pm), '');
  // Gizleme SESSIZ degil ama TEK YERDE: "Sehrim" bolumu soyluyor. Iki bolum ayni
  // sutunda ve 129px arayla duruyor (1440px olcumu), tekrar gurultu olurdu.
  const ps2 = fnKaynak('profilSehirHTML') || '';
  ok('  gizlenen zincir kullaniciya SOYLENIYOR (Sehrim bolumunde)', /bulunmuyor/.test(ps2), ps2.replace(/\s+/g, ' ').slice(0, 240));
  ok('  Tercih bolumunde TEKRARLANMIYOR', !/bulunmuyor/.test(pm), pm.replace(/\s+/g, ' ').slice(0, 200));
  const to = fnKaynak('tercihMarketleriOku') || '';
  ok('tercihMarketleriOku da suzuyor (eski secim kalmasin)', /marketVarMi\s*\(/.test(to), '');
}

console.log('\n=== 6. PROFIL: SEHIR SECIMI ===');
{
  ok('#profil-sehir sarmalayicisi index.html\'de', /id="profil-sehir"/.test(HTML), '');
  const pb = fnKaynak('profilBolumleriCiz') || '';
  ok('profilBolumleriCiz sehir bolumunu ciziyor', /profil-sehir/.test(pb), '');
  const ps = fnKaynak('profilSehirHTML') || '';
  ok('81 il listeleniyor (select)', /<select/.test(ps), ps.slice(0, 120));
  ok('  "secilmedi" secenegi var', /Seçilmedi|seçilmedi/.test(ps), ps.replace(/\s+/g, ' ').slice(0, 200));
}

console.log('\n=== 7. DURUSTLUK NOTU ===');
{
  ok('katalog notu index.html\'de', /İstanbul kataloğundan|İstanbul katalog/.test(HTML), '');
  // NOT: indexOf('katalog') Turkce "kataloğundan"daki ğ yuzunden eslesmiyor;
  // cumlenin kendisi uzerinden bakiliyor.
  const n = (HTML.match(/İstanbul kataloğundan[^<]*/) || [''])[0];
  ok('  taze urun uyarisi ayni cumlede', /taze/.test(n), n);
  ok('  tek cumle, kisa (<=150 karakter)', n.length > 0 && n.length <= 150, n.length + ': ' + n);
}

console.log('\n=== 8. TASARIM ===');
{
  const k = (CSS.match(/[^\n{}]*\.profil-sehir[^{}]*\{[^}]*\}/g) || []).join('\n');
  ok('.profil-sehir* kurallari var', k.length > 30, 'uzunluk=' + k.length);
  ok('KIRMIZI yok', !/#(DC2626|EF4444|B91C1C)/i.test(k), k.slice(0, 200));
  const yeni = (k.match(/#[0-9A-Fa-f]{6}/g) || []).filter(c => !/^#(0E4938|1D9E75|059669|065F46|ECFDF5|D1FAE5|6EE7B7|888888|1a1a1a)$/i.test(c));
  ok('yeni palet getirilmedi', yeni.length === 0, yeni.join(','));
}

console.log('\n=== 9. ACILISTA VERI CEKILIYOR ===');
{
  ok('ilMarketVeriGetir tanimli', !!fnKaynak('ilMarketVeriGetir'), '');
  ok('modul seviyesinde bir kez cagriliyor', /^ilMarketVeriGetir\(\)\.then\(/m.test(APP), '');
  ok('  gelince pill\'ler uygulaniyor', /ilMarketVeriGetir\(\)\.then\([\s\S]{0,200}sehirPillleriUygula/.test(APP), '');
  const f = fnKaynak('ilMarketVeriGetir') || '';
  ok('  fetch basarisiz olursa bos harita (filtre yok)', /catch\(/.test(f.replace(/\s+/g, '')) && /iller:\s*\{\}/.test(f), f.replace(/\s+/g, ' ').slice(-140));
}

console.log('\n=== 10. SW PRECACHE ===');
{
  const SW = fs.readFileSync('sw.js', 'utf8');
  ok('il_marketler.json sw.js DATA_URLS icinde DEGIL (gunluk degismiyor)',
     !/il_marketler/.test(SW), '');
}

console.log('\n=== SEHIR SECIMI GORUNURLUGU (2026-08-25) ===');
// OLCULDU (onceki tur): secim CALISIYOR -- kaydediliyor, okunuyor, kullaniliyor.
// Sorun kullanicinin ETKIYI GOREMEMESIYDI: Erzurum secen kisi urun detayinda
// Carrefour fiyatini gormeye devam ediyor ve "secim ise yaramiyor" saniyordu.
// Iki dokunus noktasi eklendi: (1) etkinin GERCEKTEN oldugu yerde (sepet market
// ozeti) sehir adi, (2) secimin yapildigi yerde (profil) KAPSAM cumlesi.
{
  // Yorumlar soyulur: bu depoda testin kendi aciklamasiyla eslesmesi
  // dort kez yanlis KIRMIZI uretti (bkz. CLAUDE.md).
  const kodu = (src) => String(src || '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  const govde = (ad) => {
    const b = APP.indexOf('function ' + ad + '(');
    if (b < 0) return '';
    let d = 0;
    for (let j = APP.indexOf('{', b); j < APP.length; j++) {
      const c = APP[j];
      if (c === '{') d++;
      else if (c === '}') { d--; if (d === 0) return APP.slice(b, j + 1); }
    }
    return '';
  };

  const ozet = kodu(govde('sepetMarketOzetiHTML'));
  ok('sepet ozeti secili sehri okuyor', /sehirOku\(\)/.test(ozet), ozet.slice(0, 160));
  // DIKKAT: "_sehir ... ? ... : ''" seklinde gevsek aramak KOR -- _sehir sablon
  // icinde de geciyor (${_kacir(_sehir)}), dolayisiyla kosul 'true' yapilsa
  // bile desen tutuyordu (harness yakaladi; bu oturumda ayni sinif KORLUGUN
  // UCUNCUSU). Iddia KOSULUN KENDISINE bakiyor.
  ok('  sehir notu KOSULLU (secim yoksa cizilmez)',
     /const sehirNotu\s*=\s*_sehir\b/.test(ozet), (ozet.match(/const sehirNotu[\s\S]{0,120}/) || [''])[0]);
  ok('  not sehir ADINI yaziyor (kacisli)', /\$\{_kacir\(_sehir\)\}/.test(ozet), '');
  // Not GERCEKTEN cikiya giriyor mu -- degisken tanimi yeterli DEGIL.
  // (Bu depoda "degisken var ama yazma satirinda yok" korlugu iki kez yasandi.)
  const donus = (ozet.match(/return `<div class="sepet-mkt">[\s\S]*?`;/) || [''])[0];
  ok('  not DONUS blogunda basiliyor', /\$\{sehirNotu\}/.test(donus), donus.slice(0, 200));

  const profil = kodu(govde('profilSehirHTML'));
  ok('profil KAPSAM cumlesi tasiyor', /const kapsam\s*=/.test(profil), profil.slice(0, 160));
  ok('  kapsam NE ETKILENIR diyor', /karşılaştırma/.test(profil) && /zam/.test(profil), '');
  ok('  kapsam NE ETKILENMEZ diyor (urun fiyatlari)', /ürün fiyatları/.test(profil), '');
  const pDonus = (profil.match(/return `<div class="profil-sehir">[\s\S]*?`;/) || [''])[0];
  ok('  kapsam DONUS blogunda basiliyor', /\$\{kapsam\}/.test(pDonus), pDonus.slice(0, 220));

  // Satir ici stil/handler yasagi (CSP + 117 kilidi)
  ok('  eklenen markup satir ici stil TASIMIYOR', !/style="/.test(ozet) && !/style="/.test(profil), '');
  ok('  eklenen markup YENI satir ici handler getirmiyor',
     !/sehirNotu[^`]*on[a-z]+=/.test(ozet), '');
}

console.log('\nPASS=' + pass + '  FAIL=' + fail);
process.exit(fail ? 1 : 0);
