// TARAYICI GERI TUSU + KATEGORI YARISI.
//
// KUSUR 1 (denetim, yuksek): uygulama ekran gecislerini history'ye HIC
// yazmiyordu. OLCULDU (canli, ardarda uc ekran degisimi): history.length
// 1 -> 1, history.state null. Sonuc: Android donanim geri tusu / masaustu
// geri oku / iOS kenar kaydirma jesti kullaniciyi bir onceki EKRANA degil
// SITEDEN DISARI cikariyordu -- standalone PWA'da "uygulama kapandi".
//
// KUSUR 2 (ayni denetim): loadKategoriSayfasi `if (yukleniyor) return;` ile
// basliyordu. Iki kategoriye hizli dokunulunca IKINCI istek sessizce
// dusuyor, uctaki ILK istek donup ekrani ele geciriyordu. OLCULDU
// (et -> temizlik): baslik "Temizlik" olurken yuklenenUrunler 779 ET urunu,
// ekrandaki ilk uc kart "Namet Hindi Fume" / "Banvit Pilic Sosis" /
// "Namet Hindi Salam".
//
// Test DAVRANISSAL: app.js'in GERCEK kaynagi node:vm'de kosturulur, mantik
// kopyalanmaz. Kontrol gruplu -- her bolumde once aletin o seyi GOREBILDIGI
// gosterilir, yoksa "gecti" hicbir sey kanitlamaz.

import fs from 'node:fs';
import vm from 'node:vm';

const APP  = fs.readFileSync(new URL('./app.js', import.meta.url), 'utf8');
const HTML = fs.readFileSync(new URL('./index.html', import.meta.url), 'utf8');

let GECTI = 0, KALDI = 0;
const ok = (ad, kosul, ipucu = '') => {
  if (kosul) { GECTI++; console.log('  PASS  ' + ad); }
  else { KALDI++; console.log('  FAIL  ' + ad + (ipucu ? '  -> ' + String(ipucu).slice(0, 220) : '')); }
};

// Fonksiyon govdesini PARANTEZ SAYARAK cikar (sabit ofset DEGIL -- fonksiyon
// buyuyunce bozulan desen bu depoda uc testi birden kirmisti).
function govde(ad) {
  const re = new RegExp('(?:^|\\n)\\s*(?:async )?function ' + ad + '\\s*\\([^)]*\\)\\s*\\{');
  const m = re.exec(APP);
  if (!m) throw new Error('bulunamadi: ' + ad);
  const bas = APP.indexOf('{', m.index);
  let d = 0;
  for (let i = bas; i < APP.length; i++) {
    if (APP[i] === '{') d++;
    else if (APP[i] === '}') { d--; if (d === 0) return APP.slice(m.index, i + 1); }
  }
  throw new Error('kapanmadi: ' + ad);
}

// popstate dinleyicisinin GERCEK govdesini cikarip cagrilabilir hale getir.
function popstateKaynagi() {
  const i0 = APP.indexOf("window.addEventListener('popstate'");
  if (i0 < 0) throw new Error('popstate dinleyicisi YOK');
  const bas = APP.indexOf('{', APP.indexOf('function (e)', i0));
  let d = 0;
  for (let i = bas; i < APP.length; i++) {
    if (APP[i] === '{') d++;
    else if (APP[i] === '}') { d--; if (d === 0) return 'function _popstate(e) ' + APP.slice(bas, i + 1); }
  }
  throw new Error('popstate govdesi kapanmadi');
}

// Sahte history: gercek tarayicininkiyle ayni sozlesme (state okunur,
// push/replace yazar) + ne yapildiginin kaydini tutar.
function sahteHistory(baslangic) {
  const kayit = [];
  let d = baslangic === undefined ? null : baslangic;
  return {
    kayit,
    get state() { return d; },
    pushState(yeni) { d = yeni; kayit.push({ tur: 'push', durum: yeni }); },
    replaceState(yeni) { d = yeni; kayit.push({ tur: 'replace', durum: yeni }); },
    back() { kayit.push({ tur: 'back' }); }
  };
}

function gecmisOrtami(baslangic) {
  const cagrilar = [];
  const ctx = {
    console: { warn() {}, error() {} },
    history: sahteHistory(baslangic),
    currentKategori: null,
    openDetay: (id) => cagrilar.push('openDetay:' + id),
    openCategory: (s) => cagrilar.push('openCategory:' + s),
    showScreen: (id, yon) => cagrilar.push('showScreen:' + id + ':' + (yon || '')),
    cagrilar
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext([
    'let _gecmisSonN = 0;',
    govde('_gecmisDurum'),
    govde('_gecmisDerinlik'),
    govde('_gecmisIleri'),
    govde('_geriGit'),
    popstateKaynagi()
  ].join('\n'), ctx);
  return ctx;
}
const calis = (ctx, i) => vm.runInContext(i, ctx);

// ─────────────────────────────────────────────────────────────────────
console.log('\n=== 1. ALET KONTROLU: sahte history gercekten kayit tutuyor mu ===');
{
  const c = gecmisOrtami({ pazar: 'screen-home', n: 0 });
  ok('baslangicta hicbir yazma yok', c.history.kayit.length === 0);
  calis(c, "_gecmisIleri('screen-sepet', null)");
  ok('  push GORULUYOR (alet kor degil)', c.history.kayit.length === 1 && c.history.kayit[0].tur === 'push',
     JSON.stringify(c.history.kayit));
  ok('  state gercekten degisti', c.history.state.pazar === 'screen-sepet', JSON.stringify(c.history.state));
}

console.log('\n=== 2. ACILIS KAYDI: replaceState, pushState DEGIL ===');
{
  // pushState olsaydi arkada state'i NULL bir giris kalirdi; oraya donen
  // popstate'te `if (!d || !d.pazar) return` calisir, ekran degismez ama
  // history bir adim geri gitmis olurdu -- kullanici geri tusuna basip
  // "hicbir sey olmadi" gorurdu.
  const acilis = APP.match(/history\.replaceState\(\s*\{\s*pazar:\s*'screen-home',\s*n:\s*0\s*\}/);
  ok('acilis kaydi replaceState ile yaziliyor', !!acilis);
  const i = APP.indexOf("history.replaceState({ pazar: 'screen-home'");
  const j = APP.indexOf('function _gecmisIleri');
  ok('  ust duzeyde (fonksiyon icinde degil) -- acilista KOSUYOR', i > 0 && i < j, 'i=' + i + ' j=' + j);
}

console.log('\n=== 3. ILERI GECIS: her ekran bir kayit acar, n artar ===');
{
  const c = gecmisOrtami({ pazar: 'screen-home', n: 0 });
  calis(c, "_gecmisIleri('screen-sepet', null)");
  calis(c, "_gecmisIleri('screen-firsatlar', null)");
  calis(c, "_gecmisIleri('screen-profil', null)");
  const pushlar = c.history.kayit.filter(k => k.tur === 'push');
  ok('uc gecis = uc kayit', pushlar.length === 3, String(pushlar.length));
  ok('  n 1,2,3 diye artiyor', pushlar.map(p => p.durum.n).join(',') === '1,2,3',
     pushlar.map(p => p.durum.n).join(','));
  ok('  son kayit dogru ekrani tasiyor', c.history.state.pazar === 'screen-profil');
}

console.log('\n=== 4. AYNI KAYITTA TEKRAR PUSH YOK ===');
{
  // openDetay tembel veri gelince KENDINI yeniden cagiriyor; popstate ile
  // kurulan ekran da showScreen'e ugruyor. Ikisinde de yeni kayit acilirsa
  // geri tusu ayni ekranda saplanip kalir.
  const c = gecmisOrtami({ pazar: 'screen-home', n: 0 });
  calis(c, "_gecmisIleri('screen-detay', { urun: 'sut_pinar-1l' })");
  calis(c, "_gecmisIleri('screen-detay', { urun: 'sut_pinar-1l' })");
  ok('ayni ekran+urun icin tek kayit', c.history.kayit.filter(k => k.tur === 'push').length === 1,
     String(c.history.kayit.length));
  // KONTROL: urun DEGISIRSE yeni kayit acilmali (yoksa detaydan detaya
  // gecince geri tusu iki urunu birden atlar)
  calis(c, "_gecmisIleri('screen-detay', { urun: 'et_kiyma-1kg' })");
  ok('  KONTROL: urun degisince YENI kayit', c.history.kayit.filter(k => k.tur === 'push').length === 2,
     String(c.history.kayit.length));
  calis(c, "_gecmisIleri('screen-cat', { kat: 'et' })");
  calis(c, "_gecmisIleri('screen-cat', { kat: 'sut' })");
  ok('  KONTROL: kategori degisince YENI kayit',
     c.history.kayit.filter(k => k.tur === 'push').length === 4, String(c.history.kayit.length));
}

console.log('\n=== 5. KIMLIK KAYITTA TASINIYOR (detay + kategori) ===');
{
  const c = gecmisOrtami({ pazar: 'screen-home', n: 0 });
  calis(c, "_gecmisIleri('screen-cat', { kat: 'temizlik' })");
  ok('kategori kaydi slug tasiyor', c.history.state.kat === 'temizlik', JSON.stringify(c.history.state));
  calis(c, "_gecmisIleri('screen-detay', { urun: 'x_1' })");
  ok('  detay kaydi urun kimligi tasiyor', c.history.state.urun === 'x_1', JSON.stringify(c.history.state));
  ok('  gereksiz alan yazilmiyor (kat yok)', !('kat' in c.history.state), JSON.stringify(c.history.state));
}

console.log('\n=== 6. POPSTATE: ekrani GERI KURUYOR ===');
{
  const c = gecmisOrtami({ pazar: 'screen-home', n: 0 });
  calis(c, "_gecmisSonN = 2");
  calis(c, "_popstate({ state: { pazar: 'screen-firsatlar', n: 1 } })");
  ok('ekran geri kuruluyor', c.cagrilar.join('|').includes('showScreen:screen-firsatlar'), c.cagrilar.join('|'));
  ok('  yon "back" (n azaldi)', c.cagrilar[0] === 'showScreen:screen-firsatlar:back', c.cagrilar[0]);

  // ILERI tusu: n artiyor -> yon forward olmali, yoksa ileri giderken ekran
  // geriye dogru kayar ve gecis yanlis hikaye anlatir.
  const c2 = gecmisOrtami({ pazar: 'screen-home', n: 0 });
  calis(c2, "_gecmisSonN = 1");
  calis(c2, "_popstate({ state: { pazar: 'screen-profil', n: 3 } })");
  ok('  ILERI tusunda yon "forward"', c2.cagrilar[0] === 'showScreen:screen-profil:forward', c2.cagrilar[0]);
}

console.log('\n=== 7. POPSTATE: BIZIM OLMAYAN KAYDA KARISMIYOR ===');
{
  // Sayfa disi bir gecmis girisi (baska site, ya da acilis oncesi kayit)
  // state tasimaz. Ona karisirsak kullaniciyi siteye HAPSEDERIZ.
  const c = gecmisOrtami({ pazar: 'screen-home', n: 0 });
  calis(c, "_popstate({ state: null })");
  calis(c, "_popstate({ state: { baska: 1 } })");
  ok('state yoksa hicbir sey yapilmiyor', c.cagrilar.length === 0, c.cagrilar.join('|'));
}

console.log('\n=== 8. POPSTATE: TEK DOM tasiyan ekranlarda ICERIK de kuruluyor ===');
{
  // screen-detay ve screen-cat tek bir DOM kullaniyor. Hedef BASKA bir
  // urun/kategori ise yalnizca ekrani gostermek yetmez -- baslik bir sey
  // der, liste baska seyi gosterir (duzeltilen kategori yarisi kusurunun
  // geri/ileri tusu uzerinden geri gelmis hali).
  const c = gecmisOrtami({ pazar: 'screen-home', n: 0 });
  calis(c, "currentKategori = 'et'");
  calis(c, "_popstate({ state: { pazar: 'screen-cat', kat: 'temizlik', n: 1 } })");
  ok('baska kategoriye donuste openCategory cagriliyor',
     c.cagrilar.join('|') === 'openCategory:temizlik', c.cagrilar.join('|'));

  // KONTROL: AYNI kategoriye donuste yeniden yuklenmemeli (DOM zaten dogru;
  // yeniden acmak aramayi/filtreyi sifirlar ve kaydirmayi kaybettirir)
  const c2 = gecmisOrtami({ pazar: 'screen-home', n: 0 });
  calis(c2, "currentKategori = 'et'");
  calis(c2, "_popstate({ state: { pazar: 'screen-cat', kat: 'et', n: 1 } })");
  ok('  KONTROL: ayni kategoride yeniden YUKLEME YOK',
     c2.cagrilar.join('|').indexOf('openCategory') < 0 && c2.cagrilar.join('|').includes('showScreen:screen-cat'),
     c2.cagrilar.join('|'));

  const c3 = gecmisOrtami({ pazar: 'screen-home', n: 0 });
  calis(c3, "window._detayUrunId = 'a'");
  calis(c3, "_popstate({ state: { pazar: 'screen-detay', urun: 'b', n: 1 } })");
  ok('baska urune donuste openDetay cagriliyor', c3.cagrilar.join('|') === 'openDetay:b', c3.cagrilar.join('|'));

  const c4 = gecmisOrtami({ pazar: 'screen-home', n: 0 });
  calis(c4, "window._detayUrunId = 'a'");
  calis(c4, "_popstate({ state: { pazar: 'screen-detay', urun: 'a', n: 1 } })");
  ok('  KONTROL: ayni urunde yeniden ACMA YOK',
     c4.cagrilar.join('|').indexOf('openDetay') < 0, c4.cagrilar.join('|'));
}

console.log('\n=== 9. UYGULAMA ICI GERI TEK YIGINDA ===');
{
  // Ekran ici geri butonu kendi basina showScreen cagirsaydi history'de bir
  // kayit ARKADA KALIRDI: kullanici geri butonuyla ana sayfaya doner, sonra
  // donanim geri tusuna basinca zaten gectigi ekrana geri firlatilirdi.
  const c = gecmisOrtami({ pazar: 'screen-cat', n: 2 });
  calis(c, "_geriGit('screen-home')");
  ok('kaydimiz varsa history.back() kullaniliyor',
     c.history.kayit.length === 1 && c.history.kayit[0].tur === 'back', JSON.stringify(c.history.kayit));
  ok('  showScreen DOGRUDAN cagrilmiyor', c.cagrilar.length === 0, c.cagrilar.join('|'));

  // KONTROL: derin link ile gelindiyse (arkada bizim kaydimiz YOK)
  // history.back() kullaniciyi SITEDEN cikarirdi -> ekran ici hedefe don.
  const c2 = gecmisOrtami({ pazar: 'screen-cat', n: 0 });
  calis(c2, "_geriGit('screen-home')");
  ok('  KONTROL: kaydimiz yoksa back() YOK, ekran ici hedefe donuluyor',
     c2.history.kayit.length === 0 && c2.cagrilar[0] === 'showScreen:screen-home:back',
     JSON.stringify(c2.history.kayit) + ' / ' + c2.cagrilar.join('|'));

  const c3 = gecmisOrtami(null);
  calis(c3, "_geriGit('screen-profil')");
  ok('  state hic yoksa da cikilmiyor', c3.cagrilar[0] === 'showScreen:screen-profil:back', c3.cagrilar.join('|'));
}

console.log('\n=== 10. showScreen GECMISE YAZIYOR (DAVRANISSAL) ===');
{
  // BU BOLUM ONCE KAYNAK GREP'IYDI ve prove-by-breaking KOR OLDUGUNU gosterdi:
  // cagriyi `if (false) _gecmisIleri(...)` yapan mutasyon testi YESIL birakti,
  // cunku iddia cagrinin VARLIGINA ve konumuna bakiyordu, KOSTUGUNA degil.
  // (Bu deponun bes kez yasadigi kor nokta sinifi.) Iddia gevsetilmedi;
  // showScreen artik GERCEKTEN kosturuluyor ve history'ye NE YAZILDIGI olculuyor.
  function sahteEleman(id) {
    const sinif = new Set();
    return {
      id, style: { display: '' }, offsetWidth: 1,
      classList: {
        add: (...c) => c.forEach(x => sinif.add(x)),
        remove: (...c) => c.forEach(x => sinif.delete(x)),
        toggle: (c, v) => { if (v) sinif.add(c); else sinif.delete(c); },
        contains: (c) => sinif.has(c)
      },
      addEventListener: () => {}
    };
  }
  function ekranOrtami(mevcut) {
    const ekranIdler = ['screen-home', 'screen-sepet', 'screen-firsatlar', 'screen-profil',
                        'screen-cat', 'screen-detay', 'screen-hal', 'screen-mercek', 'screen-favoriler'];
    const navIdler = ['navHome', 'navSepet', 'navFirsat', 'navProfil'];
    const ekranlar = {}, navlar = {};
    ekranIdler.forEach(i => { ekranlar[i] = sahteEleman(i); });
    navIdler.forEach(i => { navlar[i] = sahteEleman(i); });
    const ctx = {
      console: { warn() {}, error() {} },
      history: sahteHistory({ pazar: 'screen-home', n: 0 }),
      currentKategori: null,
      setTimeout: () => 0, clearTimeout: () => {},
      renderHalScreen: () => {},
      _gecisTemizle: () => {}, _gecisAzalt: () => true, _gecisSureMs: () => 300,
      _gecisCikan: null, _gecisZaman: null,
      document: {
        getElementById: (id) => ekranlar[id] || navlar[id] || null,
        querySelectorAll: (s) => s === '.screen' ? ekranIdler.map(i => ekranlar[i])
                              : s === '.nav-btn' ? navIdler.map(i => navlar[i]) : []
      }
    };
    ctx.window = ctx;
    ctx._currentScreen = mevcut;
    ctx.pageYOffset = 0;
    ctx.scrollTo = () => {};
    vm.createContext(ctx);
    vm.runInContext([
      'let _gecmisSonN = 0;',
      govde('_gecmisDurum'), govde('_gecmisDerinlik'), govde('_gecmisIleri'),
      govde('showScreen')
    ].join('\n'), ctx);
    return ctx;
  }

  // ALET KONTROLU: ortam gercekten ekran degistirebiliyor mu? Gecmezse
  // asagidaki "gecmise yazildi" iddialari bos yere yesil kalirdi.
  const c = ekranOrtami('screen-home');
  calis(c, "showScreen('screen-sepet')");
  ok('KONTROL: sahte ortam ekran degistirebiliyor', c.window._currentScreen === 'screen-sepet',
     String(c.window._currentScreen));

  ok('ileri gecis GERCEKTEN gecmise yazildi',
     c.history.kayit.filter(k => k.tur === 'push').length === 1, JSON.stringify(c.history.kayit));
  ok('  kayit dogru ekrani tasiyor', c.history.state.pazar === 'screen-sepet', JSON.stringify(c.history.state));

  // KONTROL: ayni ekrana ikinci cagri yeni kayit ACMAMALI
  calis(c, "showScreen('screen-sepet')");
  ok('  KONTROL: ayni ekrana tekrar cagri kayit acmiyor',
     c.history.kayit.filter(k => k.tur === 'push').length === 1, JSON.stringify(c.history.kayit));

  const c2 = ekranOrtami('screen-home');
  calis(c2, "window._detayUrunId = 'sut_pinar-1l'; showScreen('screen-detay')");
  ok('detay gecisinde urun kimligi kayda giriyor', c2.history.state.urun === 'sut_pinar-1l',
     JSON.stringify(c2.history.state));

  const c3 = ekranOrtami('screen-home');
  calis(c3, "currentKategori = 'et'; showScreen('screen-cat')");
  ok('kategori gecisinde slug kayda giriyor', c3.history.state.kat === 'et', JSON.stringify(c3.history.state));

  // SIRA KILIDI (davranissal): openCategory ZATEN screen-cat'teyken baska bir
  // kategori acabiliyor. Gecmise yazma erken donusten SONRA olsaydi bu gecis
  // history'ye HIC yazilmaz, kayit ESKI kategoride kalir ve geri/ileri tusu
  // yanlis listeyi geri getirirdi -- duzeltilen yarisin gecmis uzerinden hali.
  calis(c3, "currentKategori = 'temizlik'; showScreen('screen-cat')");
  ok('  ZATEN o ekrandayken kategori degisimi de kayda giriyor',
     c3.history.state.kat === 'temizlik', JSON.stringify(c3.history.state));
}

console.log('\n=== 11. MARKUP: geri butonlari TEK KAPIDAN geciyor ===');
{
  const butonlar = HTML.match(/<button[^>]*class="back-btn"[^>]*>/g) || [];
  ok('geri butonu bulundu', butonlar.length >= 7, String(butonlar.length));
  const dogrudan = butonlar.filter(b => /onclick="showScreen\(/.test(b));
  ok('  hicbiri DOGRUDAN showScreen cagirmiyor (yigin ayrismasin)',
     dogrudan.length === 0, dogrudan.join(' | '));
  const kapili = butonlar.filter(b => /onclick="(_geriGit\(|goBack\(\))/.test(b));
  ok('  hepsi _geriGit / goBack kullaniyor', kapili.length === butonlar.length,
     butonlar.filter(b => !/onclick="(_geriGit\(|goBack\(\))/.test(b)).join(' | '));
  const gb = govde('goBack');
  ok('  goBack da tek kapidan geciyor', /_geriGit\(_prevScreen\)/.test(gb), gb);
  ok('  goBack DOGRUDAN showScreen cagirmiyor', !/showScreen\(/.test(gb), gb);
}

// ═════════════════════════════════════════════════════════════════════
// KATEGORI YARISI
// ═════════════════════════════════════════════════════════════════════

function katOrtami() {
  const cizilen = [];
  let cozucu = {};
  const ctx = {
    console: { warn() {}, error() {} },
    Promise, Object, Array, JSON, String, Number,
    // loadCat ELDE TUTULUYOR: yarisi kurmak icin hangi kategorinin ne zaman
    // dondugunu test belirlemeli.
    loadCat: (slug) => new Promise((res) => { cozucu[slug] = () => { res(); }; }),
    catCache: {},
    renderAltKatBar: () => {},
    // uygulaCatFiltre EKRANA YAZAN adim: ne zaman, hangi veriyle cagrildi?
    uygulaCatFiltre: () => cizilen.push((ctx.window.yuklenenUrunler || []).map(u => u.kat).join(',')),
    // Hata dali bu testin KONUSU DEGIL -- yalnizca calisabilsin diye asgari.
    _yuklemeHataModali: () => ({ title: 'Baglanti hatasi', msg: 'dene' }),
    lcIcon: () => '', _kacir: (x) => String(x),
    skeletonHTML: () => '',
    document: { getElementById: () => null },
    cizilen, coz: (slug) => cozucu[slug] && cozucu[slug]()
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext([
    'let yukleniyor = false;',
    'let _katIstekSira = 0;',
    govde('loadKategoriSayfasi')
  ].join('\n'), ctx);
  return ctx;
}
const bekle = () => new Promise(r => setTimeout(r, 0));

console.log('\n=== 12. ALET KONTROLU: tek istek EKRANA YAZIYOR ===');
{
  const c = katOrtami();
  c.catCache = {};
  vm.runInContext("loadKategoriSayfasi('et', 1)", c);
  c.catCache['et'] = [{ kat: 'et' }];
  c.coz('et');
  await bekle(); await bekle();
  ok('tek istekte ekran ciziliyor', c.cizilen.join('|') === 'et', c.cizilen.join('|'));
  ok('  yuklenenUrunler dolduruldu', (c.window.yuklenenUrunler || []).length === 1);
  ok('  bayrak birakildi', vm.runInContext('yukleniyor', c) === false);
}

console.log('\n=== 13. YARIS: ikinci istek SESSIZCE DUSMUYOR ===');
{
  const c = katOrtami();
  vm.runInContext("loadKategoriSayfasi('et', 1)", c);          // 1. dokunus
  vm.runInContext("loadKategoriSayfasi('temizlik', 1)", c);    // 2. dokunus
  ok('ikinci istek sira numarasi ALDI (erken donus yok)',
     vm.runInContext('_katIstekSira', c) === 2, String(vm.runInContext('_katIstekSira', c)));
}

console.log('\n=== 14. YARIS: BAYAT istek ekrani ELE GECIREMEZ ===');
{
  const c = katOrtami();
  vm.runInContext("loadKategoriSayfasi('et', 1)", c);
  vm.runInContext("loadKategoriSayfasi('temizlik', 1)", c);
  // Gercek senaryo: kullanicinin ISTEMEDIGI kategori once donuyor
  c.catCache['et'] = [{ kat: 'et' }];
  c.coz('et');
  await bekle(); await bekle();
  ok('bayat istek EKRANA DOKUNMADI', c.cizilen.length === 0, c.cizilen.join('|'));
  ok('  yuklenenUrunler et ile DOLDURULMADI', !c.window.yuklenenUrunler, JSON.stringify(c.window.yuklenenUrunler));
  ok('  bayrak birakilmadi (son istek hala ucta)', vm.runInContext('yukleniyor', c) === true);

  c.catCache['temizlik'] = [{ kat: 'temizlik' }];
  c.coz('temizlik');
  await bekle(); await bekle();
  ok('  SON istek ekrani ciziyor', c.cizilen.join('|') === 'temizlik', c.cizilen.join('|'));
  ok('  ekranda KULLANICININ istedigi kategori var',
     (c.window.yuklenenUrunler || []).map(u => u.kat).join(',') === 'temizlik',
     JSON.stringify(c.window.yuklenenUrunler));
  ok('  bayrak simdi birakildi', vm.runInContext('yukleniyor', c) === false);
}

console.log('\n=== 15. YARIS: BAYAT HATA ekrani basilmiyor ===');
{
  // Eski kategori aga takilip HATA donerse, kullanici YENI kategoriye
  // bakarken "Baglanti hatasi" ekrani basmamali.
  const c = katOrtami();
  let patlat = null;
  c.loadCat = (slug) => new Promise((res, rej) => { if (slug === 'et') patlat = rej; else res(); });
  vm.runInContext("loadKategoriSayfasi('et', 1)", c);
  vm.runInContext("loadKategoriSayfasi('temizlik', 1)", c);
  c.catCache['temizlik'] = [{ kat: 'temizlik' }];
  await bekle(); await bekle();
  const hataKur = new Error('ag koptu'); hataKur.kod = 'AG_HATASI';
  patlat(hataKur);
  await bekle(); await bekle();
  ok('bayat hata ekrani BASMADI', c.cizilen.join('|') === 'temizlik', c.cizilen.join('|'));
}

// Kaynakta desen ararken ONCE YORUMLARI SOY. Bu depoda ucuncu vaka: testin
// yasakladigi seyi, o seyin NEDEN yasak oldugunu anlatan yorum iceriyor ve
// test kendi aciklamasiyla eslesip yanlis alarm veriyor. Soymak iddiayi
// GEVSETMEZ, aksine sertlestirir -- yorumda gecen bir isim artik kodmus gibi
// sayilmadigi icin silinen kod yorumla maskelenemez.
// GUVENLI YORUM SOYUCU (satir tabanli).
// Naif /\/\*[\s\S]*?\*\//g deseni BU DEPODA BOZUK: app.js'te 25 "/*" ama
// 23 "*/" var (bir kismi dize/regex icinde), esler kayiyor ve dosyanin %55'i
// siliniyor -- "desen kaynakta YOK" diyen iddialar bos yere yesil kalirdi.
// Yalnizca SATIR BASINDA baslayan blok yorumlar ve tam satirlik // yorumlar
// silinir; bu depoda aciklamalar zaten oyle yazili.
function kodTemiz(src) {
  const cikti = [];
  let blokta = false;
  // CRLF GUVENLIGI: JS regexinde nokta satir sonlandiricilarini (CR dahil)
  // ESLEMEZ ve m bayragi yokken satir-sonu capasi DIZE sonunu bekler. CRLF
  // bir satirda geriye kalan CR yuzunden asagidaki // deseni HIC eslesmez,
  // yorum SOYULMAZ ve "su desen kaynakta YOK" diyen iddia yorumla eslesip
  // YANLIS ALARM verir. SINSI: CI (Linux, LF checkout) YESIL kalir, hata
  // yalnizca Windows ta gorunur -- deponun kayitli tuzagi (2026-09-03,
  // test_sessiz_catch). Regex ile degil KARAKTER KODUYLA kirpiliyor.
  for (let l of String(src).split(String.fromCharCode(10))) {
    if (l.charCodeAt(l.length - 1) === 13) l = l.slice(0, -1);
    if (blokta) { if (l.indexOf("*/") >= 0) blokta = false; cikti.push(""); continue; }
    if (/^\s*\/\*/.test(l)) { if (l.indexOf("*/") < 0) blokta = true; cikti.push(""); continue; }
    cikti.push(l.replace(/^\s*\/\/.*$/, ""));
  }
  return cikti.join(String.fromCharCode(10));
}

// ALET KONTROLU (soyucunun KENDI kontrol grubu). Bu alet 2026-09-10 turunda
// SESSIZCE BOZUKTU: CRLF satirlarda yorumu hic soymuyordu ve bunu ancak
// baska bir testin YANLIS ALARMI acik etti. CI Linux ta LF checkout yaptigi
// icin orada yesil kaliyordu. Artik alet her kosuda kendini kanitliyor.
{
  const CR = String.fromCharCode(13), LF = String.fromCharCode(10);
  const _crlf = kodTemiz("// SOYULMALI_YORUM" + CR + LF + "const _kod = 1;" + CR + LF);
  const _lf   = kodTemiz("// SOYULMALI_YORUM" + LF + "const _kod = 1;" + LF);
  ok("ALET: CRLF satirda yorum SOYULUYOR", !/SOYULMALI_YORUM/.test(_crlf), JSON.stringify(_crlf));
  ok("ALET:   LF satirda yorum SOYULUYOR", !/SOYULMALI_YORUM/.test(_lf), JSON.stringify(_lf));
  ok("ALET: kod satiri KORUNUYOR (asiri soyma yok)",
     /const _kod = 1;/.test(_crlf) && /const _kod = 1;/.test(_lf), JSON.stringify(_crlf));
}

console.log('\n=== 16. KAYNAK KILIDI: erken donus GERI GELMESIN ===');
{
  const g = kodTemiz(govde('loadKategoriSayfasi'));
  ok('erken donus (`if (yukleniyor) return`) YOK', !/if\s*\(\s*yukleniyor\s*\)\s*return/.test(g), g.slice(0, 400));
  ok('  sira numarasi aliniyor', /const istek = \+\+_katIstekSira;/.test(g), g.slice(0, 700));
  // Iddia CAGRIYA degil KOSULA bagli: yalnizca "istek gecti mi" diye sormak,
  // karsilastirma silinse bile ismin varligiyla yesil kalirdi (bu deponun
  // bes kez yasadigi kor nokta).
  const kapilar = (g.match(/if \(istek !== _katIstekSira\) return;/g) || []).length;
  ok('  bayatlik kapisi HEM basari HEM hata dalinda', kapilar === 2, 'bulunan: ' + kapilar);
  ok('  bayrak yalnizca son istekce birakiliyor',
     /if \(istek === _katIstekSira\) yukleniyor = false;/.test(g), g.slice(-400));
  // Sonsuz scroll gozlemcisi hala ayni bayraga bakmali; bayrak kalkarsa
  // inen kategoriye sayfa eklemeye baslar.
  ok('  sonsuz scroll gozlemcisi bayragi hala kullaniyor',
     /isIntersecting && !yukleniyor/.test(APP));
}

console.log('\nPASS=' + GECTI + '  FAIL=' + KALDI);
process.exit(KALDI ? 1 : 0);
