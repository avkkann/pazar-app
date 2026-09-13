// Urun detayinda liste_fiyat gosterimi testi.
// app.js'ten fonksiyon KAYNAGINI cikarip vm'de calistirir -- kopya mantik degil.
import fs from 'fs';
import vm from 'vm';

const APP = fs.readFileSync('app.js', 'utf8');
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
  let derinlik = 0;
  for (let j = APP.indexOf('{', bas); j < APP.length; j++) {
    const c = APP[j];
    if (c === '{') derinlik++;
    else if (c === '}') { derinlik--; if (derinlik === 0) return APP.slice(bas, j + 1); }
  }
  return null;
}

console.log('\n=== 0. YAPI ===');
const varFn = !!fnKaynak('listeFiyatHTML');
ok('function listeFiyatHTML tanimli', varFn);

function kur() {
  const ctx = {
    console,
    tlHTML: v => '<span class="fp">' + String(v).replace('.', ',') + ' ₺</span>',
    tl: v => String(v).replace('.', ',') + ' ₺',
  };
  vm.createContext(ctx);
  vm.runInContext(fnKaynak('listeFiyatHTML'), ctx);
  return ctx;
}
const calis = (ctx, i) => vm.runInContext(i, ctx);

if (varFn) {
  const ctx = kur();
  console.log('\n=== 1. liste_fiyat VARKEN ===');
  const h = calis(ctx, 'listeFiyatHTML({market:"migros", fiyat:35.18, liste_fiyat:46.9})');
  ok('bos degil', !!h, JSON.stringify(h));
  ok('liste fiyati yaziliyor', /46,9/.test(h), h);
  ok('indirim yuzdesi yaziliyor (%25)', /%25/.test(h), h);
  ok('kendi sinifini kullaniyor (.detay-mkt-liste)', /detay-mkt-liste/.test(h), h);

  console.log('\n=== 2. liste_fiyat YOKKEN / GECERSIZKEN -> bos string ===');
  ok('liste_fiyat yok', calis(ctx, 'listeFiyatHTML({market:"sok", fiyat:9.9})') === '');
  ok('liste_fiyat null', calis(ctx, 'listeFiyatHTML({market:"sok", fiyat:9.9, liste_fiyat:null})') === '');
  ok('liste_fiyat == fiyat', calis(ctx, 'listeFiyatHTML({market:"sok", fiyat:9.9, liste_fiyat:9.9})') === '');
  ok('liste_fiyat < fiyat', calis(ctx, 'listeFiyatHTML({market:"sok", fiyat:9.9, liste_fiyat:5})') === '');
  ok('fiyat null', calis(ctx, 'listeFiyatHTML({market:"sok", fiyat:null, liste_fiyat:20})') === '');
  ok('arguman yok', calis(ctx, 'listeFiyatHTML(null)') === '');

  // 2026-09-13 olcumu: ilan tasiyan 2.776 kaydin 749'u (%27) bizim o markette
  // HIC gormedigimiz bir fiyat (kaynak da discount=false diyor). Ornek:
  // Finish Quantum ilan 858,00 iken 103 gunde gordugumuz en yuksek 849,90.
  console.log('\n=== 1b. GOZLENMEMIS ILAN: yuzde rozeti BASILMIYOR ===');
  {
    const h2 = calis(ctx, 'listeFiyatHTML({market:"carrefour", fiyat:399.9, liste_fiyat:858}, 849.9)');
    ok('ilan YINE gosteriliyor (marketin beyani silinmiyor)', /858/.test(h2), h2);
    ok('  "-%N" rozeti YOK (biz dogrulamadik)', !/%\d/.test(h2), h2);
    ok('  yerine "biz gormedik" notu var', /görmedik/.test(h2), h2);
    const h3 = calis(ctx, 'listeFiyatHTML({market:"carrefour", fiyat:399.9, liste_fiyat:858}, 858)');
    ok('kontrol: gozlem DESTEKLIYORSA rozet yine basiliyor', /%53/.test(h3), h3);
    const h4 = calis(ctx, 'listeFiyatHTML({market:"c", fiyat:100, liste_fiyat:200})');
    ok('kontrol: gozlem bilinmiyorsa bugunku davranis korunuyor', /%50/.test(h4), h4);
  }

  console.log('\n=== 3. YUZDE HESABI ===');
  const y = (l, f) => (calis(ctx, `listeFiyatHTML({market:"m", fiyat:${f}, liste_fiyat:${l}})`).match(/%(\d+)/) || [])[1];
  ok('185.9 -> 129.9  = %30', y(185.9, 129.9) === '30', y(185.9, 129.9));
  ok('199 -> 179      = %10', y(199, 179) === '10', y(199, 179));
  ok('20 -> 15.9      = %21', y(20, 15.9) === '21', y(20, 15.9));
}

console.log('\n=== 4. DETAY SATIRINA BAGLANMIS MI ===');
{
  const det = APP.slice(APP.indexOf('function openDetay('), APP.indexOf('function openDetay(') + 3800);
  ok('detay market satirlari TEK yerden uretiliyor', /_detayMarketSatirlariHTML\(/.test(det), '');
  // Uretici openDetay'in DISINDA: uc test (al_zamani, esit_fiyat, supheli) o
  // fonksiyonu SABIT karakter penceresiyle kesip icinde cagri ariyor; govdeye
  // eklenen her satir aranan cagrilari disari itiyor (CLAUDE.md'de kayitli
  // tuzak, 2026-09-13'te bir kez daha yasandi: cagrilar 4299-4619, pencere 4000).
  const satir = fnKaynak('_detayMarketSatirlariHTML') || '';
  ok('  uretici listeFiyatHTML cagiriyor', /listeFiyatHTML\s*\(/.test(satir), '');
  ok('  detay-mkt-row icinde cagriliyor', /detay-mkt-row[\s\S]{0,400}listeFiyatHTML/.test(satir), '');
  ok('  gozlenen en yuksek fiyat ikinci arguman olarak veriliyor',
     /listeFiyatHTML\(f,\s*gozlenen/.test(satir), '');
  ok('  gozlem haritasi _marketEnYuksekHaritasi\'ndan geliyor',
     /_marketEnYuksekHaritasi\(/.test(satir), '');
  ok('  fiyatin KAYNAGI (magaza/il/saat) satirin altinda basiliyor',
     /_fiyatKaynagiHTML\(f\)/.test(satir), '');
}

console.log('\n=== 4c. GOZLENEN EN YUKSEK FIYAT HARITASI ===');
{
  const ctx4 = { _gecmisCache: null };
  vm.createContext(ctx4);
  vm.runInContext(fnKaynak('_marketEnYuksekHaritasi') || 'function _marketEnYuksekHaritasi(){}', ctx4);
  const c = i => vm.runInContext(i, ctx4);
  ok('gecmis INMEDIYSE null (bilmedigimizi iddiaya cevirmiyoruz)', c('_marketEnYuksekHaritasi("x")') === null);
  vm.runInContext('_gecmisCache = { x: [{t:"2026-09-01",m:"carrefour",f:849.9},{t:"2026-09-07",m:"carrefour",f:399.9},{t:"2026-09-01",m:"bim",f:"120"}] };', ctx4);
  const h = c('_marketEnYuksekHaritasi("x")');
  ok('  market bazinda EN YUKSEK gozlem', h && h.carrefour === 849.9, JSON.stringify(h));
  ok('  dize fiyat sayiya cevriliyor (alfabetik karsilastirma tuzagi)', h && h.bim === 120, JSON.stringify(h));
  ok('  kaydi olmayan urun icin BOS harita (null degil)',
     JSON.stringify(c('_marketEnYuksekHaritasi("yok")')) === '{}', JSON.stringify(c('_marketEnYuksekHaritasi("yok")')));
}

console.log('\n=== 4b. FIYAT KAYNAGI SATIRI ===');
{
  const ctx3 = { _kacir: s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'),
                 ZAM_AYLAR: ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'] };
  vm.createContext(ctx3);
  vm.runInContext(fnKaynak('_fiyatZamaniYazi') + '\n' + fnKaynak('_fiyatKaynagiHTML'), ctx3);
  const c = i => vm.runInContext(i, ctx3);
  const h = c('_fiyatKaynagiHTML({market:"carrefour", fiyat:399.9, depot_ad:"Istanbul Üsküdar Salacak Mını", depot_il:"İstanbul", fiyat_guncelleme:"2026-09-13T08:50"})');
  ok('magaza adi yaziliyor', /Üsküdar Salacak/.test(h), h);
  ok('  guncelleme zamani okunur bicimde', /13 Eylül 08:50/.test(h), h);
  ok('  il magaza adinda zaten geciyorsa TEKRAR yazilmiyor', (h.match(/İstanbul/g) || []).length === 1, h);
  const h2 = c('_fiyatKaynagiHTML({market:"migros", fiyat:1, depot_ad:"Pelitlik Cd M", depot_il:"Antalya"})');
  ok('il magaza adinda yoksa EKLENIYOR', /Antalya/.test(h2), h2);
  ok('veri yoksa satir HIC cizilmiyor', c('_fiyatKaynagiHTML({market:"bim", fiyat:1})') === '');
  ok('kacis uygulaniyor', /&lt;img/.test(c('_fiyatKaynagiHTML({market:"bim", fiyat:1, depot_ad:"<img src=x>"})')));
}

console.log('\n=== 5. KART TARAFINA DOKUNULMADI ===');
{
  const kart = fnKaynak('cardHTML') || '';
  ok('cardHTML listeFiyatHTML cagirmiyor', !/listeFiyatHTML/.test(kart));
  ok('cardHTML liste_fiyat okumuyor', !/liste_fiyat/.test(kart));
  const strip = fnKaynak('_stripKartHTML') || '';
  ok('_stripKartHTML liste_fiyat okumuyor', !/liste_fiyat/.test(strip));
  const firsat = fnKaynak('_firsatKartHtml') || '';
  ok('_firsatKartHtml liste_fiyat okumuyor', !/liste_fiyat/.test(firsat));
}

console.log('\n=== 6. MEVCUT ROZET SISTEMI DEGISMEDI ===');
{
  ok('urunRozetleriHTML duruyor', /function urunRozetleriHTML/.test(APP));
  ok('supheliRozetHTML duruyor', /function supheliRozetHTML/.test(APP));
  ok('gercekIndirimRozetiHesapla duruyor', /function gercekIndirimRozetiHesapla/.test(APP));
  ok('yeni rozet sinifi UYDURULMADI', !/indirim-rozet\s+ilan|ilan-rozet/.test(APP));
}

console.log('\n=== 7. MEVCUT OKUYUCULAR KIRILMADI (fiyatlariTemizle nesneyi koruyor) ===');
{
  const ctx2 = {};
  vm.createContext(ctx2);
  vm.runInContext(fnKaynak('fiyatlariTemizle'), ctx2);
  const girdi = [{ market: 'migros', fiyat: 35.18, liste_fiyat: 46.9 }, { market: 'sok', fiyat: 40 }];
  const r = vm.runInContext('fiyatlariTemizle(' + JSON.stringify(girdi) + ')', ctx2);
  ok('gecerli uzunlugu 2', r.gecerli.length === 2, JSON.stringify(r));
  ok('liste_fiyat filtreden gecti (nesne yeniden kurulmuyor)', r.gecerli[0].liste_fiyat === 46.9, JSON.stringify(r.gecerli[0]));
  ok('liste_fiyat OLMAYAN kayit hala saglam', r.gecerli[1].market === 'sok' && r.gecerli[1].fiyat === 40);
}

console.log('\n=== 8. CSS ===');
{
  // alt secicileri de yakala: ".detay-mkt-liste s { ... }"
  const k = (CSS.match(/[^\n{}]*\.detay-mkt-liste[^{}]*\{[^}]*\}/g) || []).join('\n');
  ok('.detay-mkt-liste kurali var', k.length > 20, 'uzunluk=' + k.length);
  ok('ustu cizili (line-through)', /line-through/.test(k), k);
  ok('KIRMIZI kullanilmamis', !/#(DC2626|dc2626|EF4444|ef4444)/.test(k), k);
}

console.log('\nPASS=' + pass + '  FAIL=' + fail);
process.exit(fail ? 1 : 0);
