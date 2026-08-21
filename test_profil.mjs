// Profil ekrani zenginlestirme testi.
// app.js'ten fonksiyon KAYNAGINI cikarip vm'de calistirir -- kopya mantik degil.
import fs from 'fs';
import vm from 'vm';

const APP = fs.readFileSync('app.js', 'utf8');
const HTML = fs.readFileSync('index.html', 'utf8');
const CSS = fs.readFileSync('style.css', 'utf8');

let pass = 0, fail = 0;
const ok = (ad, kosul, detay = '') => {
  if (kosul) { pass++; console.log('  PASS  ' + ad); }
  else { fail++; console.log('  FAIL  ' + ad + (detay ? '  -> ' + detay : '')); }
};

function fnKaynak(ad) {
  let bas = APP.indexOf('function ' + ad + '(');
  if (bas < 0) return null;
  if (APP.slice(Math.max(0, bas - 6), bas) === 'async ') bas -= 6;
  let d = 0;
  for (let j = APP.indexOf('{', bas); j < APP.length; j++) {
    const c = APP[j];
    if (c === '{') d++;
    else if (c === '}') { d--; if (d === 0) return APP.slice(bas, j + 1); }
  }
  return null;
}

const GEREKEN = ['profilTasarrufHTML', 'profilSablonlarHTML', 'profilAlarmlarHTML',
                 'profilKatkiHTML', 'profilMarketTercihHTML', 'tercihMarketleriOku', 'tercihMarketToggle'];
console.log('\n=== 0. YAPI TASLARI ===');
const eksik = [];
for (const f of GEREKEN) { const v = !!fnKaynak(f); ok('function ' + f, v); if (!v) eksik.push(f); }

if (eksik.length) {
  console.log('\n  Eksik: ' + eksik.join(', '));
  console.log('\nPASS=' + pass + '  FAIL=' + fail);
  process.exit(1);
}

// alarm: [[sid, hedef], ...] — Map sandbox ICINDE kurulur, yoksa cross-realm
// "instanceof Map" false doner (tarayicida tek realm var, uretim kodu dogru).
function kur({ sepet = [], sablon = [], alarm = [], katki = null, tercih = [], urunler = [] } = {}) {
  const store = { pazar_tercih_marketler: JSON.stringify(tercih) };
  const ctx = {
  _kacir: (s) => (s == null ? '' : String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;')),
    console, Math, JSON, Date, Array, Object, Number, String, isNaN, parseFloat,
    sepet, sablonlar: sablon,
    localStorage: {
      getItem: k => (k in store ? store[k] : null),
      setItem: (k, v) => { store[k] = String(v); },
      removeItem: k => { delete store[k]; },
    },
    _store: store,
    window: { pazarAuth: { user: { id: 'u1' } } },
    _alarmGirdi: alarm,
    MARKET_NAMES: { a101: 'A101', bim: 'BİM', carrefour: 'CarrefourSA', migros: 'Migros', sok: 'ŞOK', tarim_kredi: 'T.Kredi', hakmar: 'Hakmar' },
    tl: v => Number(v).toFixed(2).replace('.', ',') + ' ₺',
    tlHTML: v => '<span>' + Number(v).toFixed(2).replace('.', ',') + ' ₺</span>',
    fiyatlariTemizle: mf => ({ gecerli: (mf || []).filter(f => f && f.fiyat != null), gizlenen: [] }),
    _sablonDisplayAd: a => a,
    lcIcon: () => '<svg></svg>',
    // Sehir SECILMEMIS durum — hicbir zincir gizlenmez (digeri test_sehir.mjs'de).
    marketVarMi: () => true,
    catCache: { test: urunler },
    productMap: {},
    _tumUrunler: urunler,
  };
  vm.createContext(ctx);
  // Yardimci fonksiyonlar da app.js'ten gelmeli, yoksa ReferenceError.
  const YARDIMCI = ['_profilUrunBul', '_profilEnUcuz'];
  const kaynak = [...YARDIMCI, ...GEREKEN].map(fnKaynak).filter(Boolean).join('\n')
    + '\nconst TERCIH_MKT_KEY = ' + JSON.stringify((APP.match(/const TERCIH_MKT_KEY = '([^']+)'/) || [])[1] || 'x') + ';';
  vm.runInContext(kaynak, ctx);
  vm.runInContext('window.pazarAlarmMap = new Map(_alarmGirdi);', ctx);
  return ctx;
}
const calis = (ctx, i) => vm.runInContext(i, ctx);

const U = (sid, ad, fiyatlar) => ({ _sid: sid, ad, market_fiyatlari: fiyatlar.map(([m, f]) => ({ market: m, fiyat: f })) });

console.log('\n=== 1. A) TASARRUF OZETI ===');
{
  ok('liste bos -> kart YOK', calis(kur({ sepet: [] }), 'profilTasarrufHTML()') === '');
  const sepet = [U('s1', 'A', [['bim', 10], ['a101', 30]]), U('s2', 'B', [['sok', 5], ['migros', 25]])];
  const h = calis(kur({ sepet }), 'profilTasarrufHTML()');
  // mevcut paylasSepet formulu: enPahaliToplam - toplam = (30+25) - (10+5) = 40
  ok('tasarruf rakami mevcut formulle ayni (40)', /40,00/.test(h), h.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' '));
  ok('urun sayisi yaziyor (2)', /\b2\b/.test(h), h.replace(/<[^>]+>/g, ' '));
  ok('tek fiyatli urunde tasarruf 0 -> kart YOK',
     calis(kur({ sepet: [U('s1', 'A', [['bim', 10]])] }), 'profilTasarrufHTML()') === '');
}

console.log('\n=== 2. B) KAYITLI LISTELERIM ===');
{
  const bos = calis(kur({ sablon: [] }), 'profilSablonlarHTML()');
  ok('sablon yok -> bolum ciziliyor (boş durum)', !!bos, bos);
  // "profil-bos" sayarken "profil-bos-btn" de eslesmesin diye class="..." ile say.
  ok('  bos durum TEK satir + yonlendirme',
     /Listem/.test(bos) && (bos.match(/class="profil-bos"/g) || []).length === 1,
     bos.replace(/<[^>]+>/g, ' '));
  const urunler = [U('s1', 'A', [['bim', 10]]), U('s2', 'B', [['sok', 5]])];
  const sablon = [{ id: 'x1', ad: 'Haftalık', urunIds: [{ sid: 's1', slug: 'test' }, { sid: 's2', slug: 'test' }] }];
  const h = calis(kur({ sablon, urunler }), 'profilSablonlarHTML()');
  ok('sablon adi yaziyor', /Haftalık/.test(h), h.replace(/<[^>]+>/g, ' '));
  ok('urun sayisi yaziyor (2)', /2 ürün/.test(h), h.replace(/<[^>]+>/g, ' '));
  ok('guncel toplam tutar yaziyor (15)', /15,00/.test(h), h.replace(/<[^>]+>/g, ' '));
  ok('yukle eylemi var', /sablonYukleUI/.test(h));
  ok('sil eylemi var', /profilSablonSil\(/.test(h), h.replace(/<[^>]+>/g,' '));
  ok('  sil sarmalayicisi app.js icinde tanimli', !!fnKaynak('profilSablonSil'));
  ok('  sil sarmalayicisi gercek sablonSil() cagiriyor', /sablonSil\(/.test(fnKaynak('profilSablonSil')||''));
}

console.log('\n=== 3. C) FIYAT ALARMLARIM ===');
{
  const bos = calis(kur({ alarm: [] }), 'profilAlarmlarHTML()');
  ok('alarm yok -> boş durum', !!bos && /profil-bos/.test(bos), bos);
  const urunler = [U('s1', 'Karpuz 1 Kg', [['bim', 12]])];
  const alarm = [['s1', 10]];
  const h = calis(kur({ alarm, urunler }), 'profilAlarmlarHTML()');
  ok('urun adi', /Karpuz 1 Kg/.test(h), h.replace(/<[^>]+>/g, ' '));
  ok('hedef fiyat (10)', /10,00/.test(h), h.replace(/<[^>]+>/g, ' '));
  ok('guncel fiyat (12)', /12,00/.test(h), h.replace(/<[^>]+>/g, ' '));
  ok('hedefe uzaklik yaziyor', /2,00|%1[67]/.test(h), h.replace(/<[^>]+>/g, ' '));
  ok('alarmi kaldir eylemi', /profilAlarmKaldir\(/.test(h), h.replace(/<[^>]+>/g,' '));
  ok('  kaldir sarmalayicisi app.js icinde tanimli', !!fnKaynak('profilAlarmKaldir'));
  ok('  kaldir sarmalayicisi gercek fiyatAlarmKaldir() cagiriyor', /fiyatAlarmKaldir\(/.test(fnKaynak('profilAlarmKaldir')||''));
  // hedefe ULASILMIS durum
  const h2 = calis(kur({ alarm: [['s1', 15]], urunler }), 'profilAlarmlarHTML()');
  ok('hedefe ulasilmissa ayri isaret', /ulas|hedefin altında|hedefe ulaş/i.test(h2), h2.replace(/<[^>]+>/g, ' '));
}

console.log('\n=== 4. D) KATKILARIM (veri yoksa bolum YOK) ===');
{
  ok('sayi null -> bolum YOK', calis(kur({}), 'profilKatkiHTML(null)') === '');
  ok('sayi 0 -> bolum YOK', calis(kur({}), 'profilKatkiHTML(0)') === '');
  const h = calis(kur({}), 'profilKatkiHTML(3)');
  ok('sayi 3 -> bolum VAR, sayi yaziyor', /\b3\b/.test(h), h.replace(/<[^>]+>/g, ' '));
  ok('  aciklama cumlesi var', /uyar|katkı/i.test(h), h.replace(/<[^>]+>/g, ' '));
}

console.log('\n=== 5. E) TERCIH EDILEN MARKETLER ===');
{
  const ctx = kur({ tercih: [] });
  const h = calis(ctx, 'profilMarketTercihHTML()');
  ok('7 marketin hepsi listeleniyor', (h.match(/tercihMarketToggle/g) || []).length === 7, String((h.match(/tercihMarketToggle/g) || []).length));
  ok('secili yok -> hicbiri active', !/ active/.test(h), h.slice(0, 200));
  calis(ctx, 'tercihMarketToggle("bim")');
  ok('toggle sonrasi localStorage yazildi', JSON.parse(ctx._store.pazar_tercih_marketler).includes('bim'), ctx._store.pazar_tercih_marketler);
  calis(ctx, 'tercihMarketToggle("bim")');
  ok('tekrar toggle -> cikarildi', !JSON.parse(ctx._store.pazar_tercih_marketler).includes('bim'), ctx._store.pazar_tercih_marketler);
  const ctx2 = kur({ tercih: ['bim', 'a101'] });
  ok('tercihMarketleriOku kaydedileni donuyor', JSON.stringify(calis(ctx2, 'tercihMarketleriOku()')) === '["bim","a101"]');
  ok('bozuk localStorage -> bos dizi', (() => {
    const c = kur({}); c._store.pazar_tercih_marketler = '{bozuk';
    return JSON.stringify(calis(c, 'tercihMarketleriOku()')) === '[]';
  })());
}

console.log('\n=== 6. E) KATEGORI FILTRESINE VARSAYILAN UYGULANIYOR MU ===');
{
  const oc = fnKaynak('openCategory') || '';
  ok('openCategory tercihMarketleriOku kullaniyor', /tercihMarketleriOku\s*\(/.test(oc), oc.split('\n').filter(l => /aktifMarketler/.test(l)).join(' | '));
  ok('  aktifMarketler tercihten besleniyor', /aktifMarketler\s*=\s*tercihMarketleriOku\(\)/.test(oc.replace(/\s+/g, ' ')), '');
}

console.log('\n=== 7. HTML BOLUMLERI ===');
{
  // screen-favoriler profilden ONCE geliyor; dilimi install-banner'a kadar al.
  const p = HTML.slice(HTML.indexOf('id="screen-profil"'), HTML.indexOf('id="install-banner"'));
  ok('profil dilimi bos degil', p.length > 500, 'uzunluk=' + p.length);
  for (const [ad, id] of [['Tasarruf', 'profil-tasarruf'], ['Kayıtlı Listelerim', 'profil-sablonlar'],
                          ['Fiyat Alarmlarım', 'profil-alarmlar'], ['Katkılarım', 'profil-katki'],
                          ['Tercih Ettiğim Marketler', 'profil-market-tercih']]) {
    ok('#' + id + ' var (' + ad + ')', p.includes('id="' + id + '"'), '');
  }
  ok('mevcut Görünüm bolumu duruyor', /Görünüm/.test(p));
  ok('mevcut Bildirimler bolumu duruyor', /Bildirimler/.test(p));
  ok('mevcut Hızlı Erişim duruyor', /Hızlı Erişim/.test(p));
  ok('yeni bolumler .profil-kartlar grid icinde', p.indexOf('profil-kartlar') < p.indexOf('id="profil-sablonlar"'));
}

console.log('\n=== 8. TASARIM: yeni palet YOK, dokunma hedefi ===');
{
  const yeni = (CSS.match(/\.profil-(bos|tasarruf|satir|mini)[a-z-]*\s*\{[^}]*\}/g) || []).join('\n');
  ok('yeni profil CSS kurallari yazilmis', yeni.length > 40, 'uzunluk=' + yeni.length);
  const yasakli = /#(?!0E4938|0e4938)[0-9A-Fa-f]{6}/g;
  const renkler = [...new Set((yeni.match(/#[0-9A-Fa-f]{6}/g) || []))];
  const mevcutPalet = ['#0E4938', '#DCFCE7', '#065F46', '#FEF3C7', '#92400E', '#FEE2E2', '#991B1B',
                       '#EDE9FE', '#DBEAFE', '#F3F4F6', '#4B5563', '#059669', '#D97706', '#B45309',
                       '#FFFBEB', '#FDE68A', '#78350F', '#86EFAC', '#FCD34D', '#9CA3AF', '#111827'];
  const yabanci = renkler.filter(r => !mevcutPalet.map(x => x.toLowerCase()).includes(r.toLowerCase()));
  ok('mevcut palet disina cikilmadi', yabanci.length === 0, 'yabanci=' + yabanci.join(','));
  ok('tercih pill dokunma hedefi >=44px', /\.profil-mkt-pill\s*\{[^}]*min-height:\s*44px/.test(CSS), '');
  ok('.filter-pill\'e DOKUNULMADI', !/\.filter-pill\s*\{[^}]*min-height/.test(CSS), '');
}

console.log('\nPASS=' + pass + '  FAIL=' + fail);
process.exit(fail ? 1 : 0);
