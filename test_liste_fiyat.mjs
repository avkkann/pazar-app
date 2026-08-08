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

  console.log('\n=== 3. YUZDE HESABI ===');
  const y = (l, f) => (calis(ctx, `listeFiyatHTML({market:"m", fiyat:${f}, liste_fiyat:${l}})`).match(/%(\d+)/) || [])[1];
  ok('185.9 -> 129.9  = %30', y(185.9, 129.9) === '30', y(185.9, 129.9));
  ok('199 -> 179      = %10', y(199, 179) === '10', y(199, 179));
  ok('20 -> 15.9      = %21', y(20, 15.9) === '21', y(20, 15.9));
}

console.log('\n=== 4. DETAY SATIRINA BAGLANMIS MI ===');
{
  const det = APP.slice(APP.indexOf('function openDetay('), APP.indexOf('function openDetay(') + 3000);
  ok('detay market satiri listeFiyatHTML cagiriyor', /listeFiyatHTML\s*\(/.test(det), '');
  ok('mktRows icinde cagriliyor', /detay-mkt-row[\s\S]{0,400}listeFiyatHTML/.test(det), '');
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
