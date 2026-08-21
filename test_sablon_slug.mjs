// SABLON KAYDET — KATEGORI SLUG TURETME + DURUST HATA
// Canli hata (2026-08): urunu sablona kaydederken "Baglanti hatasi — internet
// baglantinizi kontrol edin" cikiyordu. Kok neden AG DEGIL: slug _id'den
// turetiliyordu; ana sayfa serit urunlerinin _id'si <ad>_<gramaj> biciminde,
// yani gecerli bir KATEGORILER slug'i vermiyor -> KATEGORILER.find undefined ->
// _loadCatGetir catch'i kat.file'a IKINCI kez dokunup TypeError firlatiyor ->
// caller "Baglanti hatasi" diye yanlis etiketliyordu.
//
// test_tembel.mjs bunu KACIRDI cunku KATEGORILER'i STUB'liyor ve loadCat'i
// yalnizca GECERLI slug ("et") ile cagiriyordu. Bu test o boslugu kapatir:
//   - GERCEK KATEGORILER (app.js'ten cikarilir, stub yok)
//   - GERCEK slug turetme (urunKategoriSlugu) + GERCEK loadCat/_loadCatGetir
//   - Ana sayfa biciminli _id tasiyan urun (bug'in tam senaryosu)
//   - Kategori ekranindan eklenen urun (bugun calisan yol — bozulmamali)
//
// PROVE-BY-BREAKING (elle dogrulandi):
//   * slug duzeltmesini geri al (slug'i _id'den turet)      -> BOLUM 2 + 5 KIRMIZI
//   * _loadCatGetir guard'ini kaldir                        -> BOLUM 3 KIRMIZI
//   * mesaj ayrimini kaldir (hep "Baglanti hatasi" don)     -> BOLUM 4 KIRMIZI
import fs from 'fs';
import vm from 'vm';

const APP = fs.readFileSync('app.js', 'utf8');
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
// GERCEK KATEGORILER dizisini app.js kaynagindan cikar (STUB YOK — bu, testin ozu)
function kategorilerKaynak() {
  const bas = APP.indexOf('const KATEGORILER = [');
  if (bas < 0) return null;
  const son = APP.indexOf('];', bas);
  return APP.slice(bas, son + 2);
}

console.log('\n=== 0. YAPI ===');
ok('const KATEGORILER cikarildi', !!kategorilerKaynak());
ok('function urunKategoriSlugu', !!fnKaynak('urunKategoriSlugu'));
ok('function _yuklemeHataModali', !!fnKaynak('_yuklemeHataModali'));
ok('function ustKategori', !!fnKaynak('ustKategori'));
ok('function loadCat', !!fnKaynak('loadCat'));
ok('function _loadCatGetir', !!fnKaynak('_loadCatGetir'));
ok('function sablonKaydet', !!fnKaynak('sablonKaydet'));
ok('function sablonKaydetUI', !!fnKaynak('sablonKaydetUI'));
if (!fnKaynak('urunKategoriSlugu') || !kategorilerKaynak()) { console.log('\nPASS=' + pass + '  FAIL=' + fail); process.exit(1); }

// ── GERCEK bilesenleri tek bir vm context'te kur ──────────────────────────
let istekSayaci = 0;
const ctx = {
  console, Promise, JSON, Object, Array, Date, isNaN, String, TypeError, Error, setTimeout,
  productMap: {}, catCache: {},
  // fetch STUB'lanir (ag yok) ama slug turetme ve loadCat GERCEK. Gecerli
  // kategori dosyalari icin ornek urun doner; nokta bu degil, slug'in gecerli
  // olmasi. Gecersiz slug loadCat'e GELMEDEN guard'a takilmali.
  fetch: async (u) => { istekSayaci++; await new Promise(r => setTimeout(r, 5));
    return { ok: true, headers: { get: () => null }, json: async () => [{ ad: 'Ornek A' }, { ad: 'Ornek B' }] }; },
};
vm.createContext(ctx);
const dedup = APP.match(/let _catYukleniyor[^\n]*\n/);
vm.runInContext([
  kategorilerKaynak(),
  fnKaynak('ustKategori'),
  fnKaynak('urunKategoriSlugu'),
  fnKaynak('_yuklemeHataModali'),
  fnKaynak('assignIds'),
  dedup ? dedup[0] : 'let _catYukleniyor = new Map();',
  fnKaynak('loadCat'),
  fnKaynak('_loadCatGetir'),
].join('\n'), ctx);

console.log('\n=== 1. SLUG TURETME (GERCEK KATEGORILER) ===');
{
  // Ana sayfa serit urunu: _id ad-tabanli (BUG'in tam sekli), _sid slug-onekli
  const home = { _id: 'Beyoglu Gala Findikli Sutlu Cikolata 370 Gr_370 GR',
                 _sid: 'atistirmalik_beyoglu-gala-cikolata', ana_kategori: 'Cikolata' };
  ctx.h = home;
  const s = vm.runInContext('urunKategoriSlugu(h)', ctx);
  ok('ana sayfa urunu -> _sid\'den GECERLI slug', s === 'atistirmalik', 's=' + s);
  ok('  _id\'den turetilen COP slug DONMUYOR', s !== 'Beyoglu Gala Findikli Sutlu Cikolata 370 Gr', 's=' + s);

  // Kategori ekrani urunu (_id = slug_index, _sid var) — bugun calisan yol
  ctx.k = { _id: 'et_5', _sid: 'et_dana-kiyma', ana_kategori: 'Kirmizi Et' };
  ok('kategori urunu -> gecerli slug', vm.runInContext('urunKategoriSlugu(k)', ctx) === 'et');

  // _sid yok ama _id zaten slug_index — ikincil kaynak
  ctx.k2 = { _id: 'sut_3' };
  ok('_sid yok, _id=slug_index -> ikincil kaynak', vm.runInContext('urunKategoriSlugu(k2)', ctx) === 'sut');

  // Yalniz ana_kategori cozer (ustKategori) — ucuncul kaynak.
  // GERCEK deger Turkce ('Çikolata', olculdu); ustKategori bunu 'atistirmalik' yapar.
  ctx.a = { _id: 'x_y', ana_kategori: 'Çikolata' };
  ok('yalniz ana_kategori -> ustKategori ile slug', vm.runInContext('urunKategoriSlugu(a)', ctx) === 'atistirmalik');

  // Hicbiri cozemez -> null (durust hata; SESSIZ yanlis slug DEGIL)
  ctx.z = { _id: 'x', ana_kategori: 'Bilinmeyen Sey' };
  ok('cozulemez urun -> null (durust)', vm.runInContext('urunKategoriSlugu(z)', ctx) === null);
}

console.log('\n=== 2. AKIS: ana sayfa urunu ile loadCat COKMUYOR ===');
{
  // sablonKaydetUI'nin yaptigi: helper ile slug topla, eksikleri loadCat ile yukle.
  // BUG'da bu adim TypeError atip "Baglanti hatasi" gosteriyordu.
  ctx.sepet1 = [{ _id: 'Beyoglu ... Cikolata 370 Gr_370 GR', _sid: 'atistirmalik_beyoglu', ana_kategori: 'Cikolata' },
                { _id: 'Sutas Yarim Yagli Sut 1 L_1 L', _sid: 'sut_sutas-sut', ana_kategori: 'Sut' }];
  const sonuc = await vm.runInContext(`(async function(){
    var gerekli = new Set();
    sepet1.forEach(function(u){ var s = urunKategoriSlugu(u); if (s) gerekli.add(s); });
    var sluglar = [...gerekli];
    try { await Promise.all(sluglar.map(function(s){ return loadCat(s); }));
      return { ok:true, sluglar:sluglar }; }
    catch(e){ return { ok:false, kod:e.kod, tip:e.constructor.name, msg:e.message }; }
  })()`, ctx);
  ok('ana sayfa urunleri -> loadCat TypeError ATMIYOR', sonuc.ok === true, JSON.stringify(sonuc));
  ok('  turetilen sluglar gercek kategori', JSON.stringify((sonuc.sluglar || []).sort()) === '["atistirmalik","sut"]', JSON.stringify(sonuc.sluglar));
}

console.log('\n=== 3. GUARD: gecersiz slug -> AYIRT EDILEBILIR hata (sessiz bos DEGIL) ===');
{
  const r = await vm.runInContext(`(async function(){
    try { var p = await loadCat('bu-slug-yok-123');
      return { firlatti:false, dondu:p }; }
    catch(e){ return { firlatti:true, kod:e.kod, tip:e.constructor.name }; }
  })()`, ctx);
  ok('gecersiz slug loadCat -> HATA firlatiyor (sessiz bos degil)', r.firlatti === true, JSON.stringify(r));
  ok('  hata ayirt edilebilir: e.kod === GECERSIZ_KATEGORI', r.kod === 'GECERSIZ_KATEGORI', JSON.stringify(r));
  ok('  ham TypeError DEGIL (kat.file cokmesi giderildi)', r.tip !== 'TypeError' || r.kod === 'GECERSIZ_KATEGORI', JSON.stringify(r));
}

console.log('\n=== 4. DURUST MESAJ: sebep gercek hata sinifiyla eslesir ===');
{
  ctx.eKat = { kod: 'GECERSIZ_KATEGORI', message: 'Gecersiz kategori slug: x' };
  ctx.eAg = new TypeError('Failed to fetch');
  ctx.eDiger = new Error('beklenmeyen');
  const mKat = vm.runInContext('_yuklemeHataModali(eKat)', ctx);
  const mAg = vm.runInContext('_yuklemeHataModali(eAg)', ctx);
  const mDiger = vm.runInContext('_yuklemeHataModali(eDiger)', ctx);
  ok('gecersiz kategori -> "Baglanti hatasi" DEMIYOR', mKat.title !== 'Bağlantı hatası', JSON.stringify(mKat));
  ok('  gecersiz kategori -> dogru baslik', mKat.title === 'Ürün kategorisi belirlenemedi', JSON.stringify(mKat));
  ok('GERCEK ag hatasi (TypeError fetch) -> "Baglanti hatasi"', mAg.title === 'Bağlantı hatası', JSON.stringify(mAg));
  ok('  ag mesaji internete refere ediyor', /İnternet/.test(mAg.msg), JSON.stringify(mAg));
  ok('diger hata -> ne "Baglanti" ne yanlis sebep', mDiger.title === 'Ürün verileri yüklenemedi', JSON.stringify(mDiger));
}

console.log('\n=== 5. KAYNAK: iki kopya da tek helper\'a cikti (ucuncu kopya dogamaz) ===');
{
  const kaydet = fnKaynak('sablonKaydet') || '';
  const kaydetUI = fnKaynak('sablonKaydetUI') || '';
  ok('sablonKaydet urunKategoriSlugu CAGIRIYOR', /urunKategoriSlugu\s*\(/.test(kaydet), '');
  ok('sablonKaydet eski slice(0,-1) desenini TASIMIYOR', !/slice\(\s*0\s*,\s*-1\s*\)/.test(kaydet), '');
  ok('sablonKaydetUI urunKategoriSlugu CAGIRIYOR', /urunKategoriSlugu\s*\(/.test(kaydetUI), '');
  ok('sablonKaydetUI eski slice(0,-1) desenini TASIMIYOR', !/slice\(\s*0\s*,\s*-1\s*\)/.test(kaydetUI), '');
  // Yanlis "Baglanti hatasi" string'i artik yalnizca _yuklemeHataModali icinde
  // (ag kontrolunun ARKASINDA) — sablon catch'lerinde SABIT degil.
  ok('sablonKaydetUI govdesinde SABIT "Baglanti hatasi" YOK', !/Bağlantı hatası/.test(kaydetUI), '');
  ok('sablonKaydetUI _yuklemeHataModali kullaniyor', /_yuklemeHataModali\s*\(/.test(kaydetUI), '');
}

console.log('\nPASS=' + pass + '  FAIL=' + fail);
process.exit(fail ? 1 : 0);
