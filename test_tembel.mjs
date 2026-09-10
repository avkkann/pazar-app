// TEMBEL YUKLEME + UCUSTA TEKILLESTIRME
// 1) gecmis_fiyatlar.json (4,2 MB / 653 KB gzip) ana sayfada INMEZ; yalnizca
//    gercekten gerektiginde (detay, kategori ekrani, profil enflasyonu) iner.
// 2) loadCat ucustaki istegi tekillestirir: iki es zamanli cagiran AYNI
//    Promise'i bekler. Olculmustu: her kategori JSON'u iki kez iniyordu
//    (urunler_et 733 ms ve 734 ms).
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

console.log('\n=== 0. YAPI ===');
ok('function gecmisVeriGetir', !!fnKaynak('gecmisVeriGetir'));
ok('function loadCat', !!fnKaynak('loadCat'));
ok('function gecmisGerekli', !!fnKaynak('gecmisGerekli'));
if (!fnKaynak('gecmisGerekli')) { console.log('\nPASS=' + pass + '  FAIL=' + fail); process.exit(1); }

console.log('\n=== 1. TOP-LEVEL OTOMATIK CAGRI YOK ===');
// Fonksiyon govdelerinin DISINDA kalan "gecmisVeriGetir();" satiri olmamali
const govdeler = ['gecmisVeriGetir', 'loadCat', 'gecmisGerekli', 'openDetay', 'openCategory',
  'renderZamSeridi', 'renderDusenlerSeridi', 'renderSupheliSeridi', 'profilBolumleriCiz',
  'loadData', 'renderTuzaklarSeridi']
  .map(fnKaynak).filter(Boolean).join('\n');
let disKod = APP;
for (const g of [fnKaynak('gecmisVeriGetir'), fnKaynak('gecmisGerekli')].filter(Boolean)) disKod = disKod.split(g).join('');
const otoCagri = /^\s*gecmisVeriGetir\s*\(\s*\)\s*;/m.test(disKod.split('\n')
  .filter(l => !/^\s*(\/\/|\*)/.test(l)).join('\n')
  .replace(new RegExp(govdeler.length ? '' : 'x'), ''));
ok('app.js govdesinde kendiliginden gecmisVeriGetir() cagrisi YOK',
  !/\n\s*gecmisVeriGetir\(\);/.test(APP), 'satir hala duruyor');
ok('loadData gecmisVeriGetir BEKLEMIYOR', !/gecmisVeriGetir/.test(fnKaynak('loadData') || ''), '');

console.log('\n=== 2. UCUSTA TEKILLESTIRME: gecmisVeriGetir ===');
{
  let istek = 0;
  const ctx = {
    console, Promise, JSON, Object, Array, Date,
    fetch: async () => { istek++; await new Promise(r => setTimeout(r, 30));
      return { ok: true, json: async () => ({ a: [1] }) }; },
    setTimeout,
  };
  vm.createContext(ctx);
  vm.runInContext('let _gecmisCache=null; let _gecmisYukleniyor=null;\n' + fnKaynak('gecmisVeriGetir'), ctx);
  const r = await vm.runInContext('Promise.all([gecmisVeriGetir(),gecmisVeriGetir(),gecmisVeriGetir()])', ctx);
  ok('3 es zamanli cagri -> TEK istek', istek === 1, 'istek=' + istek);
  ok('ucu de ayni nesneyi aliyor', r[0] === r[1] && r[1] === r[2]);
  await vm.runInContext('gecmisVeriGetir()', ctx);
  ok('sicak onbellekte yeni istek YOK', istek === 1, 'istek=' + istek);
}

console.log('\n=== 3. UCUSTA TEKILLESTIRME: loadCat ===');
{
  let istek = 0;
  const izlenen = [];
  const ctx = {
    console, Promise, JSON, Object, Array, Date, isNaN,
    catCache: {},
    KATEGORILER: [{ slug: 'et', file: 'urunler_et', label: 'Et' },
                  { slug: 'sut', file: 'urunler_sut', label: 'Sut' }],
    assignIds: (slug, p) => p.forEach((u, i) => { u._id = slug + '_' + i; }),
    fetch: async (u) => { istek++; izlenen.push(String(u)); await new Promise(r => setTimeout(r, 30));
      return { ok: true, headers: { get: () => null }, json: async () => [{ ad: 'X' }, { ad: 'Y' }] }; },
    setTimeout,
  };
  vm.createContext(ctx);
  const dedup = APP.match(/let _catYukleniyor[^\n]*\n/);
  vm.runInContext([dedup ? dedup[0] : '', fnKaynak('loadCat'), fnKaynak('_loadCatGetir')].join('\n'), ctx);
  const r = await vm.runInContext('Promise.all([loadCat("et"),loadCat("et"),loadCat("et")])', ctx);
  ok('ayni slug 3 es zamanli cagri -> TEK istek', istek === 1, 'istek=' + istek + ' ' + JSON.stringify(izlenen));
  ok('ucu de ayni diziyi aliyor', r[0] === r[1] && r[1] === r[2]);
  ok('urunler dolu ve id atanmis', r[0].length === 2 && r[0][0]._id === 'et_0', JSON.stringify(r[0]));
  await vm.runInContext('loadCat("et")', ctx);
  ok('sicak onbellekte yeni istek YOK', istek === 1, 'istek=' + istek);
  await vm.runInContext('Promise.all([loadCat("sut"),loadCat("sut")])', ctx);
  ok('FARKLI slug ayri istek atiyor (toplam 2)', istek === 2, 'istek=' + istek);
  ok('iki slug ayri onbellekte', vm.runInContext('Object.keys(catCache).sort().join(",")', ctx) === 'et,sut');
}

console.log('\n=== 4. loadCat HATADA takilmiyor (uctaki kayit temizleniyor) ===');
{
  let istek = 0, patlat = true;
  const ctx = {
    console, Promise, JSON, Object, Array, Date, isNaN,
    catCache: {},
    KATEGORILER: [{ slug: 'et', file: 'urunler_et', label: 'Et' }],
    assignIds: (slug, p) => p.forEach((u, i) => { u._id = slug + '_' + i; }),
    fetch: async () => { istek++; if (patlat) throw new Error('ag koptu');
      return { ok: true, headers: { get: () => null }, json: async () => [{ ad: 'X' }] }; },
    setTimeout,
  };
  vm.createContext(ctx);
  const dedup = APP.match(/let _catYukleniyor[^\n]*\n/);
  vm.runInContext([dedup ? dedup[0] : '', fnKaynak('loadCat'), fnKaynak('_loadCatGetir')].join('\n'), ctx);
  // IDDIA GUCLENDIRILDI, GEVSETILMEDI.
  // ESKI iddia "bos dizi donuyor" idi -- ve tam olarak O DAVRANIS kusurun
  // kendisiydi: bos dizi catCache'e "yuklendi" diye yaziliyor, JavaScript'te
  // truthy oldugu icin bir daha ISTEK ATILMIYOR ve kategori OTURUM BOYUNCA
  // bos kaliyordu (denetim 2026-09-08, uc ayri bulgu, tek kok).
  // Bolum basliginin soyledigi asil sart -- "uctaki kayit temizleniyor" --
  // aynen duruyor ve uzerine uc yeni sart eklendi.
  let firlatti = false, hataKodu = null;
  try { await vm.runInContext('loadCat("et")', ctx); }
  catch (e) { firlatti = true; hataKodu = e && e.kod; }
  ok('basarisizlikta HATA FIRLIYOR (bos dizi donmuyor)', firlatti, 'sessizce bos dizi dondu');
  ok('  hata ayirt edilebilir kod tasiyor', hataKodu === 'AG_HATASI', String(hataKodu));
  ok('  ONBELLEK ZEHIRLENMEDI (catCache bos kayit tutmuyor)',
     vm.runInContext('catCache["et"] === undefined', ctx), JSON.stringify(ctx.catCache));
  // KONTROL GRUBU: ag geri gelince tekrar deneme GERCEKTEN yeni istek atiyor
  // NOT: `istek` ve `patlat` bu test dosyasinin DIS degiskenleri; fetch
  // taklidi onlari kapanisla goruyor. ctx.istek diye okumak undefined verir
  // (bu oturumda ayni sinif sonda hatasi dorduncu kez yasandi).
  const oncekiIstek = istek;
  patlat = false;
  const sonra = await vm.runInContext('loadCat("et")', ctx);
  ok('  ag gelince tekrar deneme CALISIYOR', Array.isArray(sonra) && sonra.length > 0,
     JSON.stringify(sonra));
  ok('  ve gercekten YENI istek atildi', istek > oncekiIstek, oncekiIstek + ' -> ' + istek);
}

console.log('\n=== 5. GECMISI GEREKTIREN EKRANLAR TETIKLIYOR ===');
const gg = fnKaynak('gecmisGerekli') || '';
ok('gecmisGerekli sicak onbellekte cikiyor', /_gecmisCache/.test(gg) && /return/.test(gg), gg.slice(0, 120));
ok('gecmisGerekli yenileme geri cagrisi aliyor', /yenile|geri|cb/.test(gg), gg.slice(0, 160));
ok('gecmisGerekli sessiz yutmuyor (console.warn)', /console\.warn/.test(gg), '');
ok('openCategory gecmisi tetikliyor', /gecmisGerekli\s*\(/.test(fnKaynak('openCategory') || ''), '');
ok('profil enflasyonu gecmisi tetikliyor',
  /gecmisGerekli\s*\(/.test(fnKaynak('profilBolumleriCiz') || ''), '');
// profilBolumleriCiz ACILISTA da cagriliyor (ekran gizliyken). Sartsiz
// tetiklerse 4,2 MB her sayfa acilisinda iner — canli olcumde yakalandi.
{
  const pb = fnKaynak('profilBolumleriCiz') || '';
  const once = pb.slice(0, pb.indexOf('gecmisGerekli'));
  ok('  profil YALNIZCA EKRAN GORUNURSE tetikliyor',
    /_ekranGorunur\s*\(\s*'screen-profil'\s*\)/.test(once), once.slice(-200));
}
// Yalnizca inline style.display'e bakmak YETMEZ: showScreen ilk kez kosana
// kadar tum ekranlarin inline display'i BOS, gizlilik CSS'ten geliyor.
// Canli olcumde yakalandi — gizli profil "gorunur" sanildi, 4,2 MB indi.
{
  const eg = fnKaynak('_ekranGorunur') || '';
  ok('_ekranGorunur tanimli', !!eg);
  ok('  hesaplanan stile de bakiyor (sadece inline degil)',
    /getComputedStyle/.test(eg), eg.slice(0, 200));
  ok('  inline none kisa devre', /style\.display\s*===\s*'none'/.test(eg), '');
}
{
  const oc = fnKaynak('openCategory') || '';
  ok('  openCategory tetiklemesi kategori ekrani acilirken',
    oc.indexOf('gecmisGerekli') > oc.indexOf("showScreen('screen-cat')"), '');
}
// IDDIA AYNI KALDI -- "detay ekrani gecmisi tetikliyor". Yalnizca ZINCIR
// bir adim derinlesti: tembel yukleme openDetay govdesinden cikip
// _detayTamVeriGetir'e tasindi. Sebep bicim degil: dort test openDetay'i
// SABIT KARAKTER PENCERESIYLE kesiyor ve govdeye eklenen her satir aranan
// cagrilari pencerenin disina itiyor. Guard artik ZINCIRI takip ediyor,
// yani hem baglantinin hem tetiklemenin varligini ayri ayri kilitliyor.
{
  const od = fnKaynak('openDetay') || '';
  const tv = fnKaynak('_detayTamVeriGetir') || '';
  ok('openDetay tembel yukleyiciyi cagiriyor', /_detayTamVeriGetir\s*\(/.test(od), od.slice(0, 300));
  ok('  tembel yukleyici gecmisi tetikliyor', /gecmisVeriGetir|gecmisGerekli/.test(tv), tv.slice(0, 300));
  // Hafif urun (arama indeksi) TAM KATALOGU indirmemeli -- indeksin
  // varlik sebebi tam olarak bu; regresyon sessizce 1,3 MB geri getirirdi.
  const hafifDal = tv.slice(0, tv.indexOf('_kisa') > 0 ? tv.indexOf('_kisa') : tv.length);
  ok('  hafif urun YALNIZCA kendi kategorisini indiriyor',
     /loadCat\(u\._kat\)/.test(hafifDal) && !/loadAllCats/.test(hafifDal), hafifDal.slice(0, 300));
}

console.log('\n=== 6. ANA SAYFA SERITLERI GECMIS BEKLEMIYOR (hizli yol) ===');
for (const f of ['renderZamSeridi', 'renderDusenlerSeridi', 'renderSupheliSeridi', 'renderTuzaklarSeridi']) {
  const s = fnKaynak(f) || '';
  const kesim = s.indexOf('GERİYE DÜŞÜŞ');
  const hizli = kesim > 0 ? s.slice(0, kesim) : s;
  ok(f + ' hizli yolda gecmis BEKLEMIYOR', !/await\s+gecmisVeriGetir/.test(hizli), '');
}

console.log('\nPASS=' + pass + '  FAIL=' + fail);
process.exit(fail ? 1 : 0);
