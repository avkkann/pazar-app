// Zam seridideki rakagin GEREKCESI: tarih, kademe, yayginlik, kategori baglami.
// KURAL: sebep uydurulmaz. Doviz/maliyet/tedarik verisi yok — yalnizca kendi
// verimizden cikan olgular gosterilir.
import fs from 'fs';
import vm from 'vm';

const APP = fs.readFileSync('app.js', 'utf8');
const CSS = fs.readFileSync('style.css', 'utf8');

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

const GEREKEN = ['zamKademeleri', 'zamMarketDurumu', 'zamKategoriOrt', 'zamYayginlikHTML', 'zamDetayHTML'];
console.log('\n=== 0. YAPI ===');
const eksik = [];
for (const f of GEREKEN) { const v = !!fnKaynak(f); ok('function ' + f, v); if (!v) eksik.push(f); }
if (eksik.length) { console.log('\n  Eksik: ' + eksik.join(', ')); console.log('\nPASS=' + pass + '  FAIL=' + fail); process.exit(1); }

const gun = n => { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); };

function kur(gecmis, urunler) {
  const ctx = {
  _kacir: (s) => (s == null ? '' : String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;')),
    console, Math, Date, JSON, Array, Object, Number, String, isNaN, Set, Map,
    _gecmisCache: gecmis, catCache: { t: urunler || [] },
    MARKET_NAMES: { a101: 'A101', bim: 'BİM', migros: 'Migros', carrefour: 'CarrefourSA', sok: 'ŞOK' },
    tl: v => Number(v).toFixed(2).replace('.', ',') + ' ₺',
    lcIcon: () => '<svg></svg>',
    fiyatlariTemizle: mf => ({ gecerli: (mf || []).filter(f => f && f.fiyat != null), gizlenen: [] }),
    marketVarMi: () => true,
    ustKategori: () => 'gida',
  };
  vm.createContext(ctx);
  const sabitler = ['ZAM_ESIK', 'ZAM_MIN_KAYIT', 'ZAM_KADEME_ESIK', 'ZAM_KAT_MIN', 'ZAM_MARKA_MAX', 'ZAM_KAT_MAX']
    .map(s => { const m = APP.match(new RegExp('const ' + s + '\\s*=\\s*([0-9.]+)')); return m ? 'const ' + s + ' = ' + m[1] + ';' : ''; })
    .filter(Boolean).join('\n');
  const seriCache = APP.match(/let _seriCache[^\n]*\n/);
  const ayDizi = APP.match(/const ZAM_AYLAR[^\n]*\n/);
  // NOT: _ZAM_RAKAM_SON iki satira yayiliyor, '};' gorene kadar al.
  const rakam = APP.match(/const _ZAM_RAKAM_SON[\s\S]*?\};/);
  vm.runInContext([sabitler, seriCache ? seriCache[0] : '', ayDizi ? ayDizi[0] : '',
    rakam ? rakam[0] : '',
    fnKaynak('_yerelGunISO'), fnKaynak('_salinimVarSeri'), fnKaynak('_seriKur'), fnKaynak('otuzGunlukSeri'), fnKaynak('otuzGunlukSeriTemiz'), fnKaynak('otuzGunMinFiyatTemiz'), fnKaynak('zamOncekiZirve'),
    fnKaynak('_zamGunISO'), fnKaynak('_zamTarihYazi'), fnKaynak('_trBulunma'),
    fnKaynak('zamOlcutu'), fnKaynak('zamMarketSerisi'), fnKaynak('zamMarketArtisi'), fnKaynak('zamDurumu'),
    ...GEREKEN.map(fnKaynak)].join('\n'), ctx);
  return ctx;
}
const calis = (ctx, i) => vm.runInContext(i, ctx);
const U = (sid, ad, mf) => ({ _sid: sid, _id: sid, ad, ana_kategori: 'Gazlı İçecekler',
  en_dusuk_fiyat: Math.min(...mf.map(x => x.fiyat)), market_fiyatlari: mf });

console.log('\n=== 1. ZAM TARIHI VE KADEMELER ===');
{
  // Sprite gercek deseni: 60'tan 159'a TEK sicrama, 27 gun once
  const g = { s: [{ t: gun(78), m: 'a101', f: 60 }, { t: gun(59), m: 'a101', f: 48 },
                  { t: gun(50), m: 'a101', f: 60 }, { t: gun(27), m: 'a101', f: 159 }] };
  const c = kur(g, []);
  const k = calis(c, 'zamKademeleri("s")');
  ok('tek kademe bulundu', k.length === 1, JSON.stringify(k));
  ok('  oncesi 60, sonrasi 159', k[0] && k[0].oncesi === 60 && k[0].sonrasi === 159, JSON.stringify(k[0]));
  ok('  tarih ISO olarak tasiniyor', k[0] && /^\d{4}-\d{2}-\d{2}$/.test(k[0].tarih), k[0] && k[0].tarih);
}
{
  // KADEMELI zam: 60 -> 90 -> 159. Tek sicrama gibi gosterilmemeli.
  const g = { s: [{ t: gun(78), m: 'a101', f: 60 }, { t: gun(60), m: 'a101', f: 60 },
                  { t: gun(20), m: 'a101', f: 90 }, { t: gun(8), m: 'a101', f: 159 }] };
  const k = calis(kur(g, []), 'zamKademeleri("s")');
  ok('iki kademe ayri ayri bulundu', k.length === 2, JSON.stringify(k));
  ok('  1. kademe 60 -> 90', k[0] && k[0].oncesi === 60 && k[0].sonrasi === 90, JSON.stringify(k[0]));
  ok('  2. kademe 90 -> 159', k[1] && k[1].oncesi === 90 && k[1].sonrasi === 159, JSON.stringify(k[1]));
  ok('  kronolojik sirali', k[0] && k[1] && k[0].tarih < k[1].tarih, JSON.stringify(k.map(x => x.tarih)));
}
{
  const g = { s: [{ t: gun(78), m: 'a101', f: 100 }, { t: gun(60), m: 'a101', f: 100 },
                  { t: gun(10), m: 'a101', f: 102 }] };
  ok('kucuk oynama kademe SAYILMIYOR (%2)', calis(kur(g, []), 'zamKademeleri("s")').length === 0);
}
ok('gecmisi olmayan -> bos dizi', calis(kur({}, []), 'zamKademeleri("yok")').length === 0);

console.log('\n=== 2. YAYGINLIK ===');
{
  // TEK markette satilan (olcum: havuzun 153/159\'u boyle)
  const g = { s: [{ t: gun(78), m: 'a101', f: 60 }, { t: gun(60), m: 'a101', f: 60 },
                  { t: gun(20), m: 'a101', f: 159 }] };
  const c = kur(g, []);
  const d = calis(c, 'zamMarketDurumu(' + JSON.stringify(U('s', 'Sprite', [{ market: 'a101', fiyat: 159 }])) + ')');
  ok('satildigi market 1', d.satilan.length === 1, JSON.stringify(d));
  ok('  zamli 1', d.zamli.length === 1, JSON.stringify(d));
  const h = calis(c, 'zamYayginlikHTML(' + JSON.stringify(U('s', 'Sprite', [{ market: 'a101', fiyat: 159 }])) + ')');
  const dz = h.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  ok('kart metni: yalnizca o markette SATILDIGINI soyluyor', /Yalnızca/.test(dz) && /A101/.test(dz), dz);
  ok('  "digerinde ayni" gibi YANLIS iddia YOK', !/aynı|değişmedi/i.test(dz), dz);
}
{
  // COK markette, hepsinde zamli
  const g = { s: [{ t: gun(78), m: 'migros', f: 50 }, { t: gun(60), m: 'migros', f: 50 }, { t: gun(20), m: 'migros', f: 90 },
                  { t: gun(78), m: 'carrefour', f: 52 }, { t: gun(60), m: 'carrefour', f: 52 }, { t: gun(20), m: 'carrefour', f: 95 }] };
  const u = U('s', 'Dove', [{ market: 'migros', fiyat: 90 }, { market: 'carrefour', fiyat: 95 }]);
  const c = kur(g, []);
  const d = calis(c, 'zamMarketDurumu(' + JSON.stringify(u) + ')');
  ok('2 markette satiliyor, 2\'sinde de zamli', d.satilan.length === 2 && d.zamli.length === 2, JSON.stringify(d));
  const dz = calis(c, 'zamYayginlikHTML(' + JSON.stringify(u) + ')').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  ok('kart metni: "2 marketin 2\'sinde"', /2 marketin 2/.test(dz), dz);
}
{
  // COK markette, YALNIZCA BIRINDE zamli -> digerinde ayni oldugunu soyleyebiliriz
  const g = { s: [{ t: gun(78), m: 'a101', f: 50 }, { t: gun(60), m: 'a101', f: 50 }, { t: gun(20), m: 'a101', f: 90 },
                  { t: gun(78), m: 'bim', f: 52 }, { t: gun(60), m: 'bim', f: 52 }, { t: gun(20), m: 'bim', f: 53 }] };
  const u = U('s', 'X', [{ market: 'a101', fiyat: 90 }, { market: 'bim', fiyat: 53 }]);
  const c = kur(g, []);
  const d = calis(c, 'zamMarketDurumu(' + JSON.stringify(u) + ')');
  ok('1 zamli 1 sabit ayirt ediliyor', d.zamli.length === 1 && d.sabit.length === 1, JSON.stringify(d));
  const dz = calis(c, 'zamYayginlikHTML(' + JSON.stringify(u) + ')').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  ok('kart metni sabit kalan marketi ADIYLA soyluyor', /BİM/.test(dz), dz);
  ok('  "Sadece A101" diyor', /Sadece A101|Yalnızca A101/.test(dz), dz);
}

{
  // 2 markette satiliyor ama digerinin serisi OLCULEMIYOR (tek kayit).
  // "aynı" DIYEMEYIZ — olcemedigimiz markete iddia kurulmaz.
  const g = { s: [{ t: gun(78), m: 'migros', f: 50 }, { t: gun(60), m: 'migros', f: 50 }, { t: gun(20), m: 'migros', f: 120 },
                  { t: gun(20), m: 'a101', f: 55 }] };
  const u = U('s', 'X', [{ market: 'migros', fiyat: 120 }, { market: 'a101', fiyat: 55 }]);
  const c = kur(g, []);
  const d = calis(c, 'zamMarketDurumu(' + JSON.stringify(u) + ')');
  ok('olculemeyen market ne zamli ne sabit', d.zamli.length === 1 && d.sabit.length === 0, JSON.stringify(d));
  const dz = calis(c, 'zamYayginlikHTML(' + JSON.stringify(u) + ')').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  ok('  "aynı" iddiasi KURULMUYOR', !/aynı/.test(dz), dz);
  ok('  bos market adi yazilmiyor', !/·\s*aynı/.test(dz) && !/,\s*aynı/.test(dz), dz);
  // GERCEK cikti dogrulanir: zamYayginlikHTML tumunu _kacir'liyor -> apostrof &#39;.
  // Entity DECODE etme (passthrough korlugunu geri getirir); kacis bozulursa kirmizi olsun.
  ok('  yalnizca olgu: "Migros&#39;ta zamlandı" (uretimde kacisli)', /Migros&#39;ta zamlandı/.test(dz), dz);
}

console.log('\n=== 3. KATEGORI BAGLAMI ===');
{
  const g = {}; const urunler = [];
  for (let i = 0; i < 8; i++) {
    g['k' + i] = [{ t: gun(78), m: 'bim', f: 100 }, { t: gun(60), m: 'bim', f: 100 }, { t: gun(20), m: 'bim', f: 105 }];
    urunler.push({ _sid: 'k' + i, _id: 'k' + i, ad: 'U' + i, ana_kategori: 'Gazlı İçecekler',
                   en_dusuk_fiyat: 105, market_fiyatlari: [{ market: 'bim', fiyat: 105 }] });
  }
  const c = kur(g, urunler);
  const r = calis(c, 'zamKategoriOrt("Gazlı İçecekler")');
  ok('8 urunlu kategori -> ortalama donuyor', r && r.adet === 8, JSON.stringify(r));
  ok('  ortalama ~%5', r && Math.abs(r.ortalama - 5) < 1.5, JSON.stringify(r));
}
{
  // Kategori ortalamasi NEGATIF ise "%-0,4 degisim" degil, yon kelimeyle.
  const g = {}; const urunler = [];
  for (let i = 0; i < 6; i++) {
    g['d' + i] = [{ t: gun(78), m: 'bim', f: 100 }, { t: gun(60), m: 'bim', f: 100 }, { t: gun(20), m: 'bim', f: 92 }];
    urunler.push({ _sid: 'd' + i, _id: 'd' + i, ad: 'D' + i, ana_kategori: 'Gazlı İçecekler',
                   en_dusuk_fiyat: 92, market_fiyatlari: [{ market: 'bim', fiyat: 92 }] });
  }
  // NOT: zamli urun AYRI kategoride olmali; ayni kategoriye konursa kendi
  // +%165'i ortalamayi pozitife cevirir ve test kendi premisini bozar.
  g.z = [{ t: gun(78), m: 'a101', f: 60 }, { t: gun(60), m: 'a101', f: 60 }, { t: gun(20), m: 'a101', f: 159 }];
  const zu = { _sid: 'z', _id: 'z', ad: 'Zamli', ana_kategori: 'Gazlı İçecekler',
               en_dusuk_fiyat: 159, market_fiyatlari: [{ market: 'a101', fiyat: 159 }] };
  // 6 dusen urun 'Gazlı İçecekler'de; zamli urunu ayri kategoriye almak yerine
  // dusenlerin sayisini artirip etkisini seyreltiyoruz (ayni kategori sart).
  for (let i = 6; i < 40; i++) {
    g['d' + i] = [{ t: gun(78), m: 'bim', f: 100 }, { t: gun(60), m: 'bim', f: 100 }, { t: gun(20), m: 'bim', f: 92 }];
    urunler.push({ _sid: 'd' + i, _id: 'd' + i, ad: 'D' + i, ana_kategori: 'Gazlı İçecekler',
                   en_dusuk_fiyat: 92, market_fiyatlari: [{ market: 'bim', fiyat: 92 }] });
  }
  urunler.push(zu);
  const dz = calis(kur(g, urunler), 'zamDetayHTML(' + JSON.stringify(zu) + ')').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  ok('negatif kategori ortalamasi "%-" olarak yazilmiyor', !/%-/.test(dz), dz);
  ok('  yon kelimeyle veriliyor (dustu)', /düştü/.test(dz), dz);
}
{
  const g = {}; const urunler = [];
  for (let i = 0; i < 3; i++) {
    g['k' + i] = [{ t: gun(78), m: 'bim', f: 100 }, { t: gun(60), m: 'bim', f: 100 }, { t: gun(20), m: 'bim', f: 105 }];
    urunler.push({ _sid: 'k' + i, _id: 'k' + i, ad: 'U' + i, ana_kategori: 'Az Urun',
                   en_dusuk_fiyat: 105, market_fiyatlari: [{ market: 'bim', fiyat: 105 }] });
  }
  ok('5\'ten az urun -> null (satir gosterilmez)', calis(kur(g, urunler), 'zamKategoriOrt("Az Urun")') === null);
}

console.log('\n=== 4. DETAY BLOGU ===');
{
  const g = { s: [{ t: gun(78), m: 'a101', f: 60 }, { t: gun(60), m: 'a101', f: 60 }, { t: gun(20), m: 'a101', f: 159 }] };
  const u = U('s', 'Sprite', [{ market: 'a101', fiyat: 159 }]);
  const c = kur(g, []);
  const h = calis(c, 'zamDetayHTML(' + JSON.stringify(u) + ')');
  const dz = h.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  ok('zam tarihi yaziliyor', /Temmuz|Ağustos|Ocak|Şubat|Mart|Nisan|Mayıs|Haziran|Eylül|Ekim|Kasım|Aralık/.test(dz), dz);
  ok('  eski ve yeni fiyat', /60,00 ₺/.test(dz) && /159,00 ₺/.test(dz), dz);
  ok('  kac gundur bu fiyatta', /gündür/.test(dz), dz);
  ok('SEBEP UYDURULMUYOR', !/döviz|dolar|maliyet|tedarik|enflasyon nedeniyle|zam yapıldı çünkü/i.test(dz), dz);
}
{
  // kademeli
  const g = { s: [{ t: gun(78), m: 'a101', f: 60 }, { t: gun(60), m: 'a101', f: 60 },
                  { t: gun(20), m: 'a101', f: 90 }, { t: gun(8), m: 'a101', f: 159 }] };
  const u = U('s', 'X', [{ market: 'a101', fiyat: 159 }]);
  const dz = calis(kur(g, []), 'zamDetayHTML(' + JSON.stringify(u) + ')').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  ok('kademeli zam TEK sicrama gibi anlatilmiyor', /2 kademe|iki kademe/i.test(dz), dz);
  ok('  ara fiyat (90) goruluyor', /90,00 ₺/.test(dz), dz);
}
{
  const g = { s: [{ t: gun(78), m: 'a101', f: 100 }, { t: gun(60), m: 'a101', f: 100 }, { t: gun(20), m: 'a101', f: 101 }] };
  ok('zam yoksa detay blogu BOS', calis(kur(g, []), 'zamDetayHTML(' + JSON.stringify(U('s', 'X', [{ market: 'a101', fiyat: 101 }])) + ')') === '');
}

console.log('\n=== 4b. KADEME = ONCEKI TEPEYI ASAN ADIM ===');
{
  // Garnier gercek deseni: 1 gunluk cukurdan geri donus AYRI KADEME DEGIL.
  // seri: 119.95 x4, 95.96 x4, 119.95 x4, 242.50 x13, 133.38 x1, 242.50 x2
  const g = { s: [{ t: gun(78), m: 'carrefour', f: 119.95 }, { t: gun(60), m: 'carrefour', f: 119.95 },
                  { t: gun(25), m: 'carrefour', f: 95.96 }, { t: gun(21), m: 'carrefour', f: 119.95 },
                  { t: gun(17), m: 'carrefour', f: 242.5 }, { t: gun(4), m: 'carrefour', f: 133.38 },
                  { t: gun(3), m: 'carrefour', f: 242.5 }] };
  const k = calis(kur(g, []), 'zamKademeleri("s")');
  ok('cukurdan geri donus kademe SAYILMIYOR -> 1 kademe', k.length === 1, JSON.stringify(k.map(x => x.oncesi + '->' + x.sonrasi)));
  ok('  kademe 119,95 -> 242,50', k[0] && k[0].oncesi === 119.95 && k[0].sonrasi === 242.5, JSON.stringify(k[0]));
  const u = U('s', 'Garnier', [{ market: 'carrefour', fiyat: 242.5 }]);
  const dz = calis(kur(g, []), 'zamDetayHTML(' + JSON.stringify(u) + ')').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  ok('  zincirde AYNI deger iki kez yazilmiyor', !/242,50 ₺ → 242,50 ₺/.test(dz), dz);
}

console.log('\n=== 4c. TURKCE EKLER ===');
{
  const c = kur({}, []);
  const b = s => calis(c, '_trBulunma(' + JSON.stringify(s) + ')');
  const bekle = { 'A101': "A101'de", 'CarrefourSA': "CarrefourSA'da", 'Migros': "Migros'ta",
                  'BİM': "BİM'de", 'ŞOK': "ŞOK'ta", 'Hakmar': "Hakmar'da",
                  'Temmuz': "Temmuz'da", 'Ağustos': "Ağustos'ta", 'Ocak': "Ocak'ta",
                  'Nisan': "Nisan'da", 'Eylül': "Eylül'de", 'Aralık': "Aralık'ta" };
  Object.keys(bekle).forEach(k => ok('  ' + k + ' -> ' + bekle[k], b(k) === bekle[k], b(k)));
}

console.log('\n=== 5. EKRAN YERLESIMI ===');
{
  const rz = fnKaynak('renderZamSeridi') || '';
  ok('kartta yayginlik satiri var', /zamYayginlikHTML\s*\(/.test(rz), '');
  ok('  kartta detay blogu YOK (yer dar)', !/zamDetayHTML/.test(rz), '');
  const od = APP.slice(APP.indexOf('function openDetay'), APP.indexOf('function openDetay') + 5000);
  ok('detayda zamDetayHTML ciziliyor', /zamDetayHTML\s*\(/.test(od), '');
}

console.log('\n=== 5b. YIGIN: ZAM VARKEN AL/BEKLE SUSUYOR ===');
{
  const az = fnKaynak('alZamaniDurumu') || '';
  ok('alZamaniDurumu zamDurumu ile susuyor', /zamDurumu\(u\)\)\s*return null/.test(az.replace(/\s+/g, ' ')),
     az.split('\n').filter(l => /zamDurumu/.test(l)).join(' | '));
  ok('  rozet kurali da duruyor', /indirimRozetiHesapla\(u\)\)\s*return null/.test(az.replace(/\s+/g, ' ')), '');
  // davranis: zamli urunde al/bekle null
  const ctx2 = (() => {
    const c = {
      console, Math, Date, JSON, Array, Object, Number, String, isNaN, Set, Map,
      _gecmisCache: { s: [{ t: gun(78), m: 'a101', f: 60 }, { t: gun(60), m: 'a101', f: 60 },
                          { t: gun(20), m: 'a101', f: 159 }] },
      MARKET_NAMES: { a101: 'A101' },
      fiyatlariTemizle: mf => ({ gecerli: (mf || []).filter(f => f && f.fiyat != null), gizlenen: [] }),
      marketVarMi: () => true, supheliDurum: () => null, indirimRozetiHesapla: () => null,
      gercekIndirimRozetiHesapla: () => null, tl: v => String(v),
    };
    vm.createContext(c);
    const sb = ['ZAM_ESIK', 'ZAM_MIN_KAYIT', 'AL_ZAMANI_MIN_OYNAMA', 'AL_ZAMANI_TOLERANS']
      .map(s => { const m = APP.match(new RegExp('const ' + s + '\\s*=\\s*([0-9.]+)')); return m ? 'const ' + s + ' = ' + m[1] + ';' : ''; }).join('\n');
    vm.runInContext([sb, (APP.match(/let _seriCache[^\n]*\n/) || [''])[0],
      fnKaynak('_yerelGunISO'), fnKaynak('_salinimVarSeri'), fnKaynak('_seriKur'), fnKaynak('otuzGunlukSeri'), fnKaynak('otuzGunlukSeriTemiz'), fnKaynak('otuzGunMinFiyatTemiz'), fnKaynak('_zamGunISO'), fnKaynak('zamMarketSerisi'),
      fnKaynak('zamOlcutu'), fnKaynak('zamMarketArtisi'), fnKaynak('zamDurumu'), fnKaynak('alZamaniDurumu')].join('\n'), c);
    return c;
  })();
  const zamliUrun = { _sid: 's', ad: 'Sprite', en_dusuk_fiyat: 159,
                      market_fiyatlari: [{ market: 'a101', fiyat: 159 }] };
  ok('zamli urunde zamDurumu VAR', calis(ctx2, 'zamDurumu(' + JSON.stringify(zamliUrun) + ')') !== null);
  ok('  al/bekle blogu SUSUYOR', calis(ctx2, 'alZamaniDurumu(' + JSON.stringify(zamliUrun) + ')') === null);
}

console.log('\n=== 6. TASARIM: AMBER, KIRMIZI YOK ===');
{
  const k = (CSS.match(/[^\n{}]*\.zam-(yayginlik|detay)[^{}]*\{[^}]*\}/g) || []).join('\n');
  ok('.zam-yayginlik / .zam-detay kurallari var', k.length > 40, 'uzunluk=' + k.length);
  ok('KIRMIZI yok', !/#(DC2626|EF4444|B91C1C|FF0000)/i.test(k), k.slice(0, 200));
  // FCD34D koyu tema amberi: YENI palet DEGIL, projede zaten 9 yerde var
  // (.supheli-rozet, .tazelik-chip.orta, .supheli-kutu-baslik ...). 2026-08-11
  // denetiminde .zam-yayginlik koyu zeminde 2,15 oraniyla AA'yi geciremiyordu;
  // acik tema amberi (#92400E) koyu zeminde okunmuyor, ayni ailenin koyu tonu kondu.
  const yeni = (k.match(/#[0-9A-Fa-f]{6}/g) || []).filter(c => !/^#(B45309|D97706|92400E|FFFBEB|FDE68A|FCD34D)$/i.test(c));
  ok('yeni palet getirilmedi (amber ailesi)', yeni.length === 0, yeni.join(','));
}

console.log('\nPASS=' + pass + '  FAIL=' + fail);
process.exit(fail ? 1 : 0);
