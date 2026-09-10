// KAPALI PANELDE HAYALET DENETIM + SIRALAMA MENUSU KLAVYESI.
//
// KUSUR 1 (denetim, yuksek): uc panel kapaliyken aria-hidden="true" tasiyor
// ama denetimleri HALA ODAKLANABILIYORDU. OLCULDU (canli, ana sayfa, her
// ogeye gercekten focus() verilerek): 9 hayalet denetim -- auth-sheet 6,
// msSheet 2, mfSheet 1. Klavye kullanicisi GORMEDIGI dugmelere takiliyor,
// ekran okuyucu ise orada olduklarini soylemiyor.
//
// KUSUR 2 (ayni denetim): siralama menusu klavyeyle KULLANILAMIYORDU.
// Secenekler <div role="option"> ve tabindex YOK -> odak hic giremiyor;
// panelde tek bir tus dinleyicisi de yoktu. Yani klavyeyle sirali listeye
// gecmek imkansizdi.
//
// Test DAVRANISSAL: app.js'in GERCEK fonksiyonlari node:vm'de kosturulur.
// Kontrol grubu gomulu.

import fs from 'node:fs';
import vm from 'node:vm';

const APP  = fs.readFileSync(new URL('./app.js', import.meta.url), 'utf8');
const HTML = fs.readFileSync(new URL('./index.html', import.meta.url), 'utf8');

let GECTI = 0, KALDI = 0;
const ok = (ad, kosul, ipucu = '') => {
  if (kosul) { GECTI++; console.log('  PASS  ' + ad); }
  else { KALDI++; console.log('  FAIL  ' + ad + (ipucu ? '  -> ' + String(ipucu).slice(0, 200) : '')); }
};

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
// Kaynakta desen ararken yorumlari soy (testin yasakladigi seyi anlatan yorum
// yanlis alarm verir -- bu depoda dort kez yasandi).
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

// ── sahte DOM ────────────────────────────────────────────────────────
function sahteEleman(ad, siniflar) {
  const sinif = new Set(siniflar || []);
  const oz = {};
  const el = {
    _ad: ad, dataset: {}, textContent: ad,
    classList: {
      add: (...c) => c.forEach(x => sinif.add(x)),
      remove: (...c) => c.forEach(x => sinif.delete(x)),
      toggle: (c, v) => { if (v) sinif.add(c); else sinif.delete(c); },
      contains: (c) => sinif.has(c)
    },
    setAttribute: (k, v) => { oz[k] = v; },
    removeAttribute: (k) => { delete oz[k]; },
    getAttribute: (k) => (k in oz ? oz[k] : null),
    hasAttribute: (k) => k in oz,
    addEventListener: () => {},
    _oz: oz, _sinif: sinif
  };
  return el;
}

// ─────────────────────────────────────────────────────────────────────
console.log('\n=== 1. _panelGizli: aria-hidden VE inert BIRLIKTE ===');
{
  const ctx = { console };
  vm.createContext(ctx);
  vm.runInContext(govde('_panelGizli'), ctx);
  const el = sahteEleman('panel');
  ctx.el = el;

  vm.runInContext('_panelGizli(el, true)', ctx);
  ok('kapalida aria-hidden="true"', el.getAttribute('aria-hidden') === 'true', String(el.getAttribute('aria-hidden')));
  ok('  kapalida inert VAR (odak da kalkiyor)', el.hasAttribute('inert'), JSON.stringify(el._oz));

  vm.runInContext('_panelGizli(el, false)', ctx);
  ok('acikta aria-hidden="false"', el.getAttribute('aria-hidden') === 'false', String(el.getAttribute('aria-hidden')));
  ok('  acikta inert YOK (denetimler geri gelir)', !el.hasAttribute('inert'), JSON.stringify(el._oz));

  // KONTROL: null ile cagirinca patlamamali (cagri yerlerinde getElementById
  // null donebilir; patlarsa panel acilisi komple oldururdu).
  ctx.yok = null;
  let patladi = false;
  try { vm.runInContext('_panelGizli(yok, true)', ctx); } catch (e) { patladi = true; }
  ok('  KONTROL: null guvenli', !patladi);
}

console.log('\n=== 2. UC PANEL DE TEK KAPIDAN GECIYOR ===');
{
  const T = kodTemiz(APP);
  for (const panel of ['auth-sheet', 'msSheet', 'mfSheet']) {
    const dogrudan = new RegExp("getElementById\\('" + panel + "'\\)\\.setAttribute\\('aria-hidden'").test(T);
    ok(`${panel}: dogrudan aria-hidden yazimi YOK`, !dogrudan, 'hala dogrudan yaziyor');
  }
  // msSheet kapanisi degiskene alinmis (s.setAttribute) -> o yol da kapali mi?
  ok('  degisken uzerinden aria-hidden yazimi da YOK',
     !/\bs\.setAttribute\('aria-hidden'/.test(T), 'kalan dogrudan yazim var');
  const cagri = (T.match(/_panelGizli\(/g) || []).length;
  ok('  _panelGizli 6 cagri yerinde (3 panel x ac/kapa) + tanim', cagri >= 6, 'bulunan: ' + cagri);
}

console.log('\n=== 3. MARKUP: kapali paneller basta da inert ===');
{
  // JS acilistan once calissa bile panel bir an odaklanabilir olmamali.
  for (const [id, desen] of [
    ['auth-sheet', /<div id="auth-sheet"[^>]*\binert\b[^>]*>/],
    ['msSheet',    /<div id="msSheet"[^>]*\binert\b[^>]*>/],
    ['mfSheet',    /<div id="mfSheet"[^>]*\binert\b[^>]*>/]])
    ok(`${id} markup'ta inert tasiyor`, desen.test(HTML), 'inert yok');
}

console.log('\n=== 4. SIRALAMA SECENEKLERI ODAKLANABILIR ===');
{
  const secenekler = HTML.match(/<div class="siralama-option[^"]*"[^>]*>/g) || [];
  ok('secenek bulundu', secenekler.length === 6, String(secenekler.length));
  ok('  hepsi tabindex tasiyor (odak girebiliyor)',
     secenekler.every(s => /tabindex="-1"/.test(s)),
     secenekler.filter(s => !/tabindex="-1"/.test(s)).join(' | '));
  ok('  hepsi aria-selected tasiyor',
     secenekler.every(s => /aria-selected="(true|false)"/.test(s)),
     secenekler.filter(s => !/aria-selected=/.test(s)).join(' | '));
  const secili = secenekler.filter(s => /aria-selected="true"/.test(s));
  ok('  TEK secenek secili', secili.length === 1, String(secili.length));
  ok('  secili olan `active` sinifini da tasiyor', /class="siralama-option active"/.test(secili[0]), secili[0]);
  ok('  panel role="listbox"', /id="catSiralamaPanel"[^>]*role="listbox"/.test(HTML));
  ok('  dugme aria-haspopup + aria-expanded', /id="catSiralamaBtn"[^>]*aria-haspopup="listbox"/.test(HTML)
     && /id="catSiralamaBtn"[^>]*aria-expanded=/.test(HTML));
}

console.log('\n=== 5. setSiralama aria-selected TASIYOR ===');
{
  // Sinif gorsel, aria-selected ise ekran okuyucunun okudugu SEY. Yalnizca
  // sinifi guncellemek menuyu goren kullaniciya dogru, duyan kullaniciya
  // YANLIS bilgi verirdi.
  const g = kodTemiz(govde('setSiralama'));
  ok("setSiralama aria-selected yaziyor", /setAttribute\('aria-selected'/.test(g), g.slice(0, 600));
  ok('  deger secime BAGLI (sabit degil)', /secili \? 'true' : 'false'/.test(g), g.slice(0, 600));
}

console.log('\n=== 6. KLAVYE: ok tuslari, Home/End, Enter, Tab ===');
{
  const degerler = ['populer', 'birimfiyat', 'fiyatasc', 'fiyatdesc', 'az', 'za'];
  function kur(aktifIdx) {
    const secenekler = degerler.map((d, i) => {
      const e = sahteEleman(d, i === aktifIdx ? ['siralama-option', 'active'] : ['siralama-option']);
      e.dataset.value = d;
      return e;
    });
    const panel = sahteEleman('panel', ['siralama-panel']);   // panel-hidden YOK -> acik
    panel.querySelectorAll = () => secenekler;
    panel.contains = (el) => secenekler.indexOf(el) >= 0;
    panel.querySelector = (s) => s.includes('active')
      ? secenekler.find(o => o._sinif.has('active')) || null : secenekler[0];
    const btn = sahteEleman('btn');
    const ctx = {
      console,
      secildi: [],
      kapandi: 0,
      setSiralama: (v) => ctx.secildi.push(v),
      _kapatSiralamaPanel: () => { ctx.kapandi++; },
      document: {
        getElementById: (id) => id === 'catSiralamaPanel' ? panel : id === 'catSiralamaBtn' ? btn : null,
        activeElement: null
      },
      panel, btn, secenekler
    };
    secenekler.forEach(e => { e.focus = () => { ctx.document.activeElement = e; }; });
    btn.focus = () => { ctx.document.activeElement = btn; };
    ctx.window = ctx;
    vm.createContext(ctx);
    vm.runInContext(govde('_siralamaTus'), ctx);
    return ctx;
  }
  const bas = (ctx, key, hedef) => {
    ctx.document.activeElement = hedef;
    let engellendi = false;
    vm.runInContext('_siralamaTus(__e)', Object.assign(ctx, {
      __e: { key, preventDefault: () => { engellendi = true; } }
    }));
    return engellendi;
  };

  const c = kur(0);
  ok('ALET KONTROLU: baslangicta odak yok', c.document.activeElement === null);

  bas(c, 'ArrowDown', c.secenekler[0]);
  ok('ArrowDown bir sonraki secenege gidiyor', c.document.activeElement === c.secenekler[1],
     String(c.document.activeElement && c.document.activeElement._ad));
  bas(c, 'ArrowUp', c.secenekler[1]);
  ok('  ArrowUp bir oncekine', c.document.activeElement === c.secenekler[0]);
  bas(c, 'ArrowUp', c.secenekler[0]);
  ok('  bastan ArrowUp SONA sariyor', c.document.activeElement === c.secenekler[5]);
  bas(c, 'ArrowDown', c.secenekler[5]);
  ok('  sondan ArrowDown BASA sariyor', c.document.activeElement === c.secenekler[0]);
  bas(c, 'End', c.secenekler[0]);
  ok('  End sona', c.document.activeElement === c.secenekler[5]);
  bas(c, 'Home', c.secenekler[5]);
  ok('  Home basa', c.document.activeElement === c.secenekler[0]);
  ok('  ok tuslari sayfayi kaydirmiyor (preventDefault)', bas(c, 'ArrowDown', c.secenekler[0]));

  const c2 = kur(0);
  bas(c2, 'Enter', c2.secenekler[2]);
  ok('Enter o secenegi seciyor', c2.secildi.join(',') === 'fiyatasc', c2.secildi.join(','));
  ok('  ve menuyu kapatiyor (odak dugmeye doner)', c2.kapandi === 1, String(c2.kapandi));

  const c3 = kur(0);
  const spaceEngelledi = bas(c3, ' ', c3.secenekler[1]);
  ok('Space de seciyor', c3.secildi.join(',') === 'birimfiyat', c3.secildi.join(','));
  // AYNI cagrinin donusu kullaniliyor: ayri bir kur() ile olcmek baska bir
  // baglamin ogesini gonderir, indexOf -1 doner ve iddia bos yere kirmizi olur.
  ok('  Space sayfayi kaydirmiyor (preventDefault)', spaceEngelledi === true, String(spaceEngelledi));

  const c4 = kur(0);
  bas(c4, 'Tab', c4.secenekler[0]);
  ok('Tab menuyu kapatiyor (ekranda asili kalmiyor)', c4.kapandi === 1, String(c4.kapandi));
  ok('  Tab secim YAPMIYOR', c4.secildi.length === 0, c4.secildi.join(','));

  // KONTROL: panel KAPALIYKEN tuslar hicbir sey yapmamali
  const c5 = kur(0);
  c5.panel.classList.add('panel-hidden');
  bas(c5, 'ArrowDown', c5.secenekler[0]);
  ok('KONTROL: panel kapaliyken ok tusu ETKISIZ', c5.document.activeElement === c5.secenekler[0],
     String(c5.document.activeElement && c5.document.activeElement._ad));
}

console.log('\n=== 7. ODAK YONETIMI (DAVRANISSAL) ===');
{
  // BU BOLUM ONCE KAYNAK GREP'IYDI ve prove-by-breaking KOR OLDUGUNU gosterdi:
  // `if (false) secili.focus();` mutasyonu testi YESIL birakti, cunku iddia
  // cagrinin VARLIGINA bakiyordu, KOSTUGUNA degil. Iddia gevsetilmedi;
  // fonksiyonlar artik GERCEKTEN kosturuluyor ve odagin nereye gittigi olculuyor.
  function odakOrtami(aktifIdx) {
    const degerler = ['populer', 'birimfiyat', 'fiyatasc', 'fiyatdesc', 'az', 'za'];
    const secenekler = degerler.map((d, i) => {
      const e = sahteEleman(d, i === aktifIdx ? ['siralama-option', 'active'] : ['siralama-option']);
      e.dataset.value = d;
      return e;
    });
    const panel = sahteEleman('panel', ['siralama-panel', 'panel-hidden']);
    panel.querySelectorAll = () => secenekler;
    panel.querySelector = (s) => s.indexOf('.active') >= 0
      ? (secenekler.find(o => o._sinif.has('active')) || null) : secenekler[0];
    panel.contains = (el) => secenekler.indexOf(el) >= 0;
    const btn = sahteEleman('btn');
    const disari = sahteEleman('baska-yer');
    const ctx = {
      console,
      requestAnimationFrame: (f) => f(),     // eszamanli kostur
      setTimeout: (f) => f(),
      document: {
        getElementById: (id) => id === 'catSiralamaPanel' ? panel : id === 'catSiralamaBtn' ? btn : null,
        activeElement: null
      },
      panel, btn, secenekler, disari
    };
    secenekler.concat([btn, disari]).forEach(e => { e.focus = () => { ctx.document.activeElement = e; }; });
    ctx.window = ctx;
    vm.createContext(ctx);
    vm.runInContext([govde('_acSiralamaPanel'), govde('_kapatSiralamaPanel')].join('\n'), ctx);
    return ctx;
  }

  // ALET KONTROLU: ortam odak hareketini gorebiliyor mu?
  const c0 = odakOrtami(0);
  c0.secenekler[2].focus();
  ok('ALET KONTROLU: odak hareketi goruluyor', c0.document.activeElement === c0.secenekler[2]);

  const c = odakOrtami(3);                    // secili = "fiyatdesc"
  c.document.activeElement = c.btn;
  vm.runInContext('_acSiralamaPanel()', c);
  ok('acilista odak MENUYE giriyor', c.secenekler.indexOf(c.document.activeElement) >= 0,
     String(c.document.activeElement && c.document.activeElement._ad));
  ok('  ve SECILI secenege (ilkine degil)', c.document.activeElement === c.secenekler[3],
     String(c.document.activeElement && c.document.activeElement._ad));
  ok('  panel gorunur oldu', !c.panel.classList.contains('panel-hidden'));
  ok('  aria-expanded true', c.btn.getAttribute('aria-expanded') === 'true');

  // Kapanis: odak MENUDEYKEN dugmeye donmeli
  const c2 = odakOrtami(0);
  vm.runInContext('_acSiralamaPanel()', c2);
  vm.runInContext('_kapatSiralamaPanel()', c2);
  ok('kapanista odak DUGMEYE donuyor', c2.document.activeElement === c2.btn,
     String(c2.document.activeElement && c2.document.activeElement._ad));
  ok('  aria-expanded false', c2.btn.getAttribute('aria-expanded') === 'false');

  // KONTROL GRUBU: odak zaten DISARDAYSA dokunulmamali -- yoksa kullanicinin
  // fareyle tikladigi yerden odagi calariz.
  const c3 = odakOrtami(0);
  vm.runInContext('_acSiralamaPanel()', c3);
  c3.disari.focus();
  vm.runInContext('_kapatSiralamaPanel()', c3);
  ok('  KONTROL: odak disardaysa CALINMIYOR', c3.document.activeElement === c3.disari,
     String(c3.document.activeElement && c3.document.activeElement._ad));
}

console.log('\n=== 8. KLAVYE KAPISI rAF\'A BAGLI DEGIL ===');
{
  // `open` sinifi cift requestAnimationFrame icinde ekleniyor; rAF gecikirse
  // (sekme arka planda) klavye tamamen olur. OLCULDU: pane gizliyken cift rAF
  // 1500 ms icinde HIC kosmadi, panel acikti ama ok tuslari islemiyordu.
  const g = kodTemiz(govde('_siralamaTus'));
  ok("kapi `open` sinifina BAKMIYOR", !/classList\.contains\('open'\)/.test(g), g.slice(0, 400));
  ok("  kapi `panel-hidden` yokluguna bakiyor (eszamanli kaldirilir)",
     /classList\.contains\('panel-hidden'\)/.test(g), g.slice(0, 400));
  const a = kodTemiz(govde('_acSiralamaPanel'));
  ok('  ve panel-hidden acilista ESZAMANLI kaldiriliyor',
     a.indexOf("classList.remove('panel-hidden')") < a.indexOf('requestAnimationFrame'), a.slice(0, 400));
}

console.log('\nPASS=' + GECTI + '  FAIL=' + KALDI);
process.exit(KALDI ? 1 : 0);
