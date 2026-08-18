// 1) ?screen= query routing  2) profil masaustu sutun dengesi
// app.js/index.html/style.css kaynagini dogrudan okur.
import fs from 'fs';
import vm from 'vm';

const APP = fs.readFileSync('app.js', 'utf8');
const HTML = fs.readFileSync('index.html', 'utf8');
const CSS = fs.readFileSync('style.css', 'utf8');
const MANIFEST = JSON.parse(fs.readFileSync('manifest.json', 'utf8'));

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

// app.js'teki KATEGORILER dizisinin KAYNAGI (yeniden yazilmiyor, kesiliyor).
const KAT_BAS = APP.indexOf('const KATEGORILER = [');
const KAT_KAYNAK = KAT_BAS < 0 ? '' : APP.slice(KAT_BAS, APP.indexOf('];', KAT_BAS) + 2);
const KAT_SLUGLARI = [...KAT_KAYNAK.matchAll(/slug:\s*'([^']+)'/g)].map(m => m[1]);

console.log('\n=== 1. ?screen= ROUTING ===');
const varFn = !!fnKaynak('ekranRotasiUygula');
ok('function ekranRotasiUygula tanimli', varFn);

if (varFn) {
  function calistir(qs, { authHazir = true } = {}) {
    const cagrilan = [];
    const dinleyiciler = {};
    const ctx = {
      console, URLSearchParams,
      location: { search: qs },
      document: {
        addEventListener: (ad, fn, o) => { (dinleyiciler[ad] = dinleyiciler[ad] || []).push(fn); },
      },
      showScreen: id => cagrilan.push('showScreen:' + id),
      goSepet: () => cagrilan.push('goSepet'),
      goFirsatlar: () => cagrilan.push('goFirsatlar'),
      goProfil: () => cagrilan.push('goProfil'),
      openHalScreen: () => cagrilan.push('openHalScreen'),
      openCategory: slug => cagrilan.push('openCategory:' + slug),
      window: { openFavoriler: () => cagrilan.push('openFavoriler'), pazarAuth: { ready: authHazir, user: authHazir ? { id: 'u' } : null } },
      _hata: null,
    };
    vm.createContext(ctx);
    // KATEGORILER app.js'ten AYNEN alinip baglama konuyor (kopya liste yok):
    // kategori rotasinin taniyacagi slug kumesi ile uygulamanin kategori
    // izgarasinin slug kumesi TEK kaynak olmali.
    try { vm.runInContext(KAT_KAYNAK, ctx); } catch (e) { ctx._hata = String(e.message); }
    try { vm.runInContext(fnKaynak('ekranRotasiUygula') + '\nekranRotasiUygula();', ctx); }
    catch (e) { ctx._hata = String(e.message); }
    return {
      cagrilan, hata: ctx._hata, dinleyiciler,
      authHazirOldu: () => (dinleyiciler['pazarAuthReady'] || []).forEach(f => f()),
    };
  }

  const bekle = [
    ['?screen=home', /showScreen:screen-home/],
    ['?screen=anasayfa', /showScreen:screen-home/],
    ['?screen=list', /goSepet/],
    ['?screen=listem', /goSepet/],
    ['?screen=firsat', /goFirsatlar/],
    ['?screen=firsatlar', /goFirsatlar/],
    ['?screen=profil', /goProfil/],
    ['?screen=favoriler', /openFavoriler/],
    ['?screen=hal', /openHalScreen/],
  ];
  for (const [qs, re] of bekle) {
    const r = calistir(qs);
    ok(qs.padEnd(20) + ' -> ' + String(re).replace(/[/\\]/g, ''),
       re.test(r.cagrilan.join(',')) && !r.hata, JSON.stringify(r));
  }
  console.log('  --- bilinmeyen / bos ---');
  for (const qs of ['?screen=zzzyok', '?screen=', '', '?baska=1']) {
    const r = calistir(qs);
    ok((qs || '(bos)').padEnd(20) + ' -> Ana Sayfa, hata YOK',
       r.cagrilan.join(',') === 'showScreen:screen-home' && !r.hata, JSON.stringify(r));
  }
  console.log('  --- oturuma bagli ekran: auth HAZIR DEGILKEN ---');
  {
    const r = calistir('?screen=favoriler', { authHazir: false });
    ok('auth hazir degilken openFavoriler HEMEN cagrilmiyor',
       !r.cagrilan.includes('openFavoriler'), JSON.stringify(r.cagrilan));
    ok('  pazarAuthReady dinleyicisi kuruldu',
       (r.dinleyiciler['pazarAuthReady'] || []).length === 1, Object.keys(r.dinleyiciler).join(','));
    ok('  Ana Sayfa\'ya DUSMUYOR (ekran calinmiyor)',
       !r.cagrilan.includes('showScreen:screen-home'), JSON.stringify(r.cagrilan));
    r.authHazirOldu();
    ok('  auth hazir olunca openFavoriler cagriliyor',
       r.cagrilan.includes('openFavoriler'), JSON.stringify(r.cagrilan));
  }
  {
    const r = calistir('?screen=hal', { authHazir: false });
    ok('oturumsuz ekran auth beklemiyor (hal)', r.cagrilan.includes('openHalScreen'), JSON.stringify(r.cagrilan));
  }
  // ── KATEGORI DERIN BAGLANTISI (hub /kategori/<slug>/ -> uygulama) ──────
  // Hub kategori sayfalarinin footer'indaki "Uygulamada aç" linki buraya
  // dusuyor. TEK GERCEK RISK slug bicimi: hub sayfalari tireli slug kullaniyor
  // (meyve-sebze, tarim-kredi). Iki taraf FARKLI normallestirme yaparsa link
  // calisir GORUNUR ama YANLIS ekrana duser -- bu, Gorev 4'teki alt cizgi/tire
  // sorununun ikizi. Asagida slug listesi app.js'ten TURETILIYOR, teste
  // sabitlenmiyor; yeni kategori eklenirse test kendiliginden onu da kapsiyor.
  console.log('  --- ?screen=kategori&kat=<slug> ---');
  {
    ok('KATEGORILER kaynagi app.js\'ten okunabildi', KAT_SLUGLARI.length > 0, 'adet=' + KAT_SLUGLARI.length);
    console.log('    app.js slug\'lari: ' + KAT_SLUGLARI.join(' '));
    for (const s of KAT_SLUGLARI) {
      const r = calistir('?screen=kategori&kat=' + s);
      ok(('kat=' + s).padEnd(24) + ' -> openCategory:' + s,
         r.cagrilan.join(',') === 'openCategory:' + s && !r.hata, JSON.stringify(r));
    }
    console.log('  --- bilinmeyen/eksik kat: Ana Sayfa (bilinmeyen screen ile AYNI davranis) ---');
    for (const qs of ['?screen=kategori&kat=yokboyle', '?screen=kategori&kat=', '?screen=kategori',
                      '?screen=kategori&kat=meyve_sebze', '?screen=kategori&kat=/kategori/sut/']) {
      const r = calistir(qs);
      ok(qs.padEnd(38) + ' -> Ana Sayfa, hata YOK',
         r.cagrilan.join(',') === 'showScreen:screen-home' && !r.hata, JSON.stringify(r));
    }
    // openCategory tanimsiz slug'da kat.label okurken patlar; kapinin rotada
    // olmasi gerekiyor -- "sessizce ana sayfaya dus" sozunun tek dayanagi bu.
    const src = fnKaynak('ekranRotasiUygula') || '';
    ok('rota kat degerini KATEGORILER\'e karsi dogruluyor', /KATEGORILER/.test(src),
       src.split('\n').filter(l => /kategori|kat/.test(l)).join(' | ').slice(0, 200));
    ok('  rotada elle yazilmis kategori slug listesi YOK (tek kaynak KATEGORILER)',
       !KAT_SLUGLARI.some(s => new RegExp("['\"]" + s + "['\"]").test(src)), src.slice(0, 200));
  }

  console.log('  --- HUB SLUG PARITESI (olcum, iddia degil) ---');
  {
    const MYOL = '.hub/manifest.json';
    if (!fs.existsSync(MYOL)) {
      console.log('    ATLANDI: .hub/manifest.json yok (turetilmis, repoda durmuyor) — "node scripts/hub-uret.mjs" sonrasi kosulur');
    } else {
      const hubSluglari = JSON.parse(fs.readFileSync(MYOL, 'utf8'))
        .filter(k => k.tip === 'kategori' && k.durum === 'uretildi')
        .map(k => k.yol.replace(/^\/kategori\//, '').replace(/\/$/, ''));
      console.log('    hub slug\'lari: ' + hubSluglari.join(' '));
      ok('hub kategori slug\'lari app.js KATEGORILER slug\'lariyla BIREBIR ayni',
         JSON.stringify([...hubSluglari].sort()) === JSON.stringify([...KAT_SLUGLARI].sort()),
         'hub=' + hubSluglari.join(',') + ' app=' + KAT_SLUGLARI.join(','));
      // Asil kanit: her hub yolu, rotadan gecince O kategoriyi aciyor.
      const yanlis = hubSluglari.filter(s => calistir('?screen=kategori&kat=' + s).cagrilan.join(',') !== 'openCategory:' + s);
      ok('  her hub kategori sayfasi DOGRU ekrani aciyor (yanlis ekran = 0)', yanlis.length === 0, yanlis.join(' '));
    }
  }

  console.log('  --- manifest kisayollari BOZULMADI ---');
  for (const s of (MANIFEST.shortcuts || [])) {
    const q = '?' + s.url.split('?')[1];
    const r = calistir(q);
    ok('manifest "' + s.name + '" (' + q + ') calisiyor', r.cagrilan.length === 1 && !r.hata, JSON.stringify(r));
  }
  const src = fnKaynak('ekranRotasiUygula');
  ok('konsola hata basilmiyor', !/console\.(error|warn)/.test(src));
  ok('eski 3-anahtarli satir kaldirildi',
     !/\{\s*list:\s*'screen-sepet',\s*firsat:/.test(APP), '');
}

console.log('\n=== ?screen=hal VERI GELMEDEN ACILIRSA ===');
{
  // openHalScreen() renderHalScreen()'i HEMEN cagiriyor; halVerisi henuz yoksa
  // ekran "yukleniyor"da kaliyordu ve veri gelince kimse yeniden cizmiyordu.
  // hal.json 18 KB -> 44 KB buyuyunce (cinsi/turu/hacim alanlari) bu yaris
  // kalici sekilde kaybedilmeye basladi.
  const oh = fnKaynak('openHalScreen') || '';
  ok('openHalScreen hala tek seferde ciziyor', /renderHalScreen\(\)/.test(oh), oh);
  const ld = fnKaynak('loadData') || '';
  ok('loadData veri gelince hal ekranini YENIDEN ciziyor', /renderHalScreen\(\)/.test(ld),
     ld.split('\n').filter(l => /render/.test(l)).join(' | '));
  ok('  yalnizca hal ekrani acikken (her yuklemede degil)',
     /screen-hal/.test(ld), ld.split('\n').filter(l => /screen-hal|renderHalScreen/.test(l)).join(' | '));
  const rh = fnKaynak('renderHalScreen') || '';
  ok('renderHalScreen bos veride hala guvenli cikiyor', /if \(!window\.halVerisi\)/.test(rh.replace(/\s+/g, ' ')), '');

  // #halDate index.html'de YOK; korumasiz erisim .then govdesini her acilista
  // kesiyordu ve hata .catch tarafindan sessizce yutuluyordu.
  ok('#halDate gercekten index.html\'de yok (varsayim degil olcum)', !/halDate/.test(HTML), '');
  ok('halDate erisimi KORUMALI', !/getElementById\('halDate'\)\.innerHTML/.test(ld),
     ld.split('\n').filter(l => /halDate/.test(l)).join(' | '));
  ok('  null kontrolu var', /_halDate\s*&&|halDate\)\s*\{|if \(bt && /.test(ld), '');
  ok('loadData catch sessiz DEGIL', /\.catch\(\(?\w+\)?\s*=>\s*\{\s*console\.(error|warn)/.test(ld.replace(/\s+/g, ' ')),
     ld.replace(/\s+/g, ' ').slice(ld.replace(/\s+/g, ' ').indexOf('.catch'), ld.replace(/\s+/g, ' ').indexOf('.catch') + 60));
}

console.log('\n=== 2. PROFIL MASAUSTU SUTUN DENGESI ===');
{
  const p = HTML.slice(HTML.indexOf('id="screen-profil"'), HTML.indexOf('id="install-banner"'));
  const sutunlar = (p.match(/class="profil-sutun"/g) || []).length;
  ok('2 adet .profil-sutun sarmalayicisi', sutunlar === 2, 'adet=' + sutunlar);
  ok('sarmalayicilar .profil-kartlar ICINDE',
     p.indexOf('profil-kartlar') < p.indexOf('profil-sutun'), '');

  // Mobil sira: sarmalayicilar display:contents oldugu icin DOM sirasi = mobil sira.
  const sirali = [...p.matchAll(/class="profil-section"[^>]*id="(profil-[a-z-]+)"|<div class="profil-section">\s*<div class="profil-section-title">([^<]+)/g)]
    .map(m => (m[1] || m[2] || '').trim()).filter(Boolean);
  ok('DOM sirasi korundu (Hızlı Erişim ilk)', sirali[0] === 'Hızlı Erişim', JSON.stringify(sirali));
  ok('kullaniciya ait bolumler ustte',
     sirali.indexOf('profil-sablonlar') < sirali.indexOf('Görünüm') &&
     sirali.indexOf('profil-alarmlar') < sirali.indexOf('Görünüm'), JSON.stringify(sirali));
  ok('ayarlar/uygulama altta',
     sirali.indexOf('Görünüm') < sirali.indexOf('Uygulama Hakkında') ||
     sirali.indexOf('Bildirimler') < sirali.indexOf('Uygulama Hakkında'), JSON.stringify(sirali));

  // Bolme noktasi: 1440px olcumune gore ilk sutun Tercih'te bitiyor.
  const s1 = p.slice(p.indexOf('class="profil-sutun"'));
  const ikinciIdx = s1.indexOf('class="profil-sutun"', 5);
  const sutun1 = s1.slice(0, ikinciIdx);
  ok('1. sutun: Hızlı Erişim + Kayıtlı + Alarmlar + Tercih',
     /Hızlı Erişim/.test(sutun1) && /profil-sablonlar/.test(sutun1) &&
     /profil-alarmlar/.test(sutun1) && /profil-market-tercih/.test(sutun1), '');
  ok('1. sutunda Uygulama Hakkında YOK', !/Uygulama Hakkında/.test(sutun1), '');
}

console.log('\n=== 3. CSS: mobilde sarmalayici gorunmez, masaustunde sutun ===');
{
  ok('.profil-sutun { display: contents } (mobil varsayilan)',
     /\.profil-sutun\s*\{[^}]*display:\s*contents/.test(CSS), '');
  const md = CSS.slice(CSS.indexOf('@media (min-width: 1024px)'));
  ok('1024px+ .profil-sutun flex column',
     /\.profil-sutun\s*\{[^}]*display:\s*flex[^}]*flex-direction:\s*column/s.test(md), '');
  // "grid-template-columns" multi-column DEGIL; sadece column-count / columns
  // kisayolunu ve column-span'i ara.
  ok('multi-column KULLANILMADI',
     !/(^|[;{\s])(column-count|column-span|columns)\s*:/.test(CSS),
     (CSS.match(/(^|[;{\s])(column-count|column-span|columns)\s*:/) || [])[0] || '');
  ok('masonry KULLANILMADI', !/masonry/.test(CSS), '');
  ok('duzen #screen-profil\'e DEGIL sarmalayiciya verildi',
     !/#screen-profil\s*\{[^}]*display:\s*(grid|flex)/.test(CSS), '');
}

console.log('\nPASS=' + pass + '  FAIL=' + fail);
process.exit(fail ? 1 : 0);
