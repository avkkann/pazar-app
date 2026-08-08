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

console.log('\n=== 1. ?screen= ROUTING ===');
const varFn = !!fnKaynak('ekranRotasiUygula');
ok('function ekranRotasiUygula tanimli', varFn);

if (varFn) {
  function calistir(qs) {
    const cagrilan = [];
    const ctx = {
      console, URLSearchParams,
      location: { search: qs },
      showScreen: id => cagrilan.push('showScreen:' + id),
      goSepet: () => cagrilan.push('goSepet'),
      goFirsatlar: () => cagrilan.push('goFirsatlar'),
      goProfil: () => cagrilan.push('goProfil'),
      openHalScreen: () => cagrilan.push('openHalScreen'),
      window: { openFavoriler: () => cagrilan.push('openFavoriler') },
      _hata: null,
    };
    vm.createContext(ctx);
    try { vm.runInContext(fnKaynak('ekranRotasiUygula') + '\nekranRotasiUygula();', ctx); }
    catch (e) { ctx._hata = String(e.message); }
    return { cagrilan, hata: ctx._hata };
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
