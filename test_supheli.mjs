// Sahte indirim rozeti testi.
// app.js'ten fonksiyon KAYNAGINI cikarip vm'de calistirir -- kopya mantik degil.
// Kullanim: node test_supheli.mjs
import fs from 'fs';
import vm from 'vm';

const APP = fs.readFileSync('app.js', 'utf8');
const CSS = fs.readFileSync('style.css', 'utf8');

let pass = 0, fail = 0;
const ok = (ad, kosul, detay = '') => {
  if (kosul) { pass++; console.log('  PASS  ' + ad); }
  else { fail++; console.log('  FAIL  ' + ad + (detay ? '  -> ' + detay : '')); }
};

function blokKaynak(basSablon, ad) {
  const bas = APP.indexOf(basSablon + ad);
  if (bas < 0) return null;
  // Acilis parantezi { (nesne/govde) ya da [ (dizi) olabilir; hangisi once
  // geliyorsa o. Yoksa dizi sabitlerde sonraki bloga tasip fazla kod yutuyoruz.
  const iSus = APP.indexOf('{', bas), iKose = APP.indexOf('[', bas);
  if (iSus < 0 && iKose < 0) return null;
  const acilis = (iKose >= 0 && (iSus < 0 || iKose < iSus)) ? iKose : iSus;
  const ac = APP[acilis], kap = ac === '[' ? ']' : '}';
  let derinlik = 0;
  for (let j = acilis; j < APP.length; j++) {
    const c = APP[j];
    if (c === ac) derinlik++;
    else if (c === kap) { derinlik--; if (derinlik === 0) return APP.slice(bas, j + 1); }
  }
  return null;
}
const fnKaynak  = ad => blokKaynak('function ', ad);
const objKaynak = ad => { const s = blokKaynak('const ', ad + ' = '); return s ? s + ';' : null; };

const GEREKEN_FN = ['supheliDurum', 'supheliCumleler', 'supheliRozetHTML', 'supheliKutuHTML', 'gercekIndirimRozetiHesapla', 'urunRozetleriHTML'];
const GEREKEN_OBJ = ['SUPHELI_SEBEP_CUMLE', 'SUPHELI_ZAMANSAL_SEBEPLER'];

console.log('\n=== 0. YAPI TASLARI VAR MI ===');
const eksik = [];
for (const f of GEREKEN_FN)  { const v = !!fnKaynak(f);  ok('function ' + f + ' tanimli', v); if (!v) eksik.push(f); }
for (const o of GEREKEN_OBJ) { const v = !!objKaynak(o); ok('const ' + o + ' tanimli', v); if (!v) eksik.push(o); }

if (eksik.length) {
  console.log('\n  Eksik: ' + eksik.join(', ') + ' -> davranis testleri kosulamiyor.');
  console.log('\nPASS=' + pass + '  FAIL=' + fail);
  process.exit(1);
}

// ---- sandbox ----
const TUM_ETIKETLER = ['kisa_zirve', 'orta_zirve', 'yuksek_oynaklik', 'tekrarli_dongu', 'tek_dongu', 'asiri_yuksek_oran'];

function kur(puanKayitlari, gecmis) {
  const ctx = {
    console,
    _puanCache: puanKayitlari === null ? null : new Map(puanKayitlari.map(r => [r._sid, r])),
    _gecmisCache: gecmis || {},
    lcIcon: () => '<svg></svg>',
    indirimRozetiHesapla: (u) => (u && u._buyukIndirim ? { tip: 'buyuk', yuzde: 40 } : null),
    indirimRozetiHTML: (r, kisa) => '<span class="indirim-rozet ' + (kisa ? 'buyuk-kisa' : 'buyuk') + '">Büyük indirim</span>',
  };
  vm.createContext(ctx);
  const kaynak = [
    objKaynak('SUPHELI_SEBEP_CUMLE'),
    objKaynak('SUPHELI_ZAMANSAL_SEBEPLER'),
    fnKaynak('supheliDurum'),
    fnKaynak('supheliCumleler'),
    fnKaynak('supheliRozetHTML'),
    fnKaynak('supheliKutuHTML'),
    fnKaynak('gercekIndirimRozetiHesapla'),
    fnKaynak('gercekIndirimRozetiHTML'),
    fnKaynak('urunRozetleriHTML'),
  ].join('\n');
  vm.runInContext(kaynak, ctx);
  return ctx;
}
const calis = (ctx, ifade) => vm.runInContext(ifade, ctx);

console.log('\n=== 1. ETIKET -> INSAN DILI ===');
{
  const ctx = kur([]);
  const harita = calis(ctx, 'SUPHELI_SEBEP_CUMLE');
  for (const e of TUM_ETIKETLER) {
    const c = harita[e];
    ok('etiket "' + e + '" eslenmis', typeof c === 'string' && c.length > 3, JSON.stringify(c));
    if (typeof c === 'string') {
      ok('  "' + e + '" cumlesinde ham etiket yok', !c.includes('_'), c);
    }
  }
  ok('haritada fazladan/uydurma etiket yok',
     Object.keys(harita).every(k => TUM_ETIKETLER.includes(k)),
     Object.keys(harita).filter(k => !TUM_ETIKETLER.includes(k)).join(','));
}
{
  const ctx = kur([{ _sid: 'x', indirim_supheli_puan: 5, indirim_supheli_sebepler: ['kisa_zirve', 'bilinmeyen_etiket', 'yuksek_oynaklik'], indirim_supheli_dusus_yuzde: 40 }]);
  const c = calis(ctx, 'supheliCumleler(supheliDurum({_sid:"x"}), {_sid:"x"})');
  ok('bilinmeyen etiket cumleye donusmuyor', !c.join(' ').includes('bilinmeyen_etiket'), JSON.stringify(c));
  ok('bilinmeyen etiket atlanip digerleri kaliyor', c.length === 2, JSON.stringify(c));
  ok('hicbir cumlede alt cizgi (ham etiket) yok', c.every(x => !x.includes('_')), JSON.stringify(c));
}

console.log('\n=== 2. SEVIYE: kutu / rozet / yok ===');
const senaryolar = [
  { ad: 'puan 5 + kisa_zirve',                        puan: 5, seb: ['kisa_zirve', 'yuksek_oynaklik', 'tekrarli_dongu'], bek: 'kutu' },
  { ad: 'puan 6 tam ev',                              puan: 6, seb: ['kisa_zirve', 'yuksek_oynaklik', 'tekrarli_dongu', 'asiri_yuksek_oran'], bek: 'kutu' },
  { ad: 'puan 4 + tekrarli_dongu (zamansal var)',     puan: 4, seb: ['yuksek_oynaklik', 'tekrarli_dongu', 'asiri_yuksek_oran'], bek: 'kutu' },
  { ad: 'puan 4 + orta_zirve (zamansal var)',         puan: 4, seb: ['orta_zirve', 'yuksek_oynaklik', 'tek_dongu', 'asiri_yuksek_oran'], bek: 'kutu' },
  { ad: 'puan 4 ZAMANSAL YOK (oran+oynaklik+tek)',    puan: 4, seb: ['yuksek_oynaklik', 'tek_dongu', 'asiri_yuksek_oran'], bek: 'rozet' },
  { ad: 'puan 3',                                     puan: 3, seb: ['kisa_zirve', 'yuksek_oynaklik'], bek: 'rozet' },
  { ad: 'puan 2',                                     puan: 2, seb: ['tek_dongu'], bek: 'rozet' },
];
for (const s of senaryolar) {
  const ctx = kur([{ _sid: 'x', indirim_supheli_puan: s.puan, indirim_supheli_sebepler: s.seb, indirim_supheli_dusus_yuzde: 30 }]);
  const d = calis(ctx, 'supheliDurum({_sid:"x"})');
  ok(s.ad + ' -> ' + s.bek, d && d.seviye === s.bek, d ? d.seviye : String(d));
}
{
  const ctx = kur([{ _sid: 'x', indirim_supheli_puan: 1, indirim_supheli_sebepler: ['tek_dongu'], indirim_supheli_dusus_yuzde: 5 }]);
  ok('puan 1 -> hicbir sey', calis(ctx, 'supheliDurum({_sid:"x"})') === null);
}
{
  const ctx = kur([]);
  ok('cache bos -> hicbir sey', calis(ctx, 'supheliDurum({_sid:"x"})') === null);
}
{
  const ctx = kur(null);
  ok('cache YOK (istek basarisiz) -> hicbir sey', calis(ctx, 'supheliDurum({_sid:"x"})') === null);
  ok('cache YOK -> gercek indirim rozeti de yok', calis(ctx, 'gercekIndirimRozetiHesapla({_sid:"x",en_dusuk_fiyat:10})') === null);
}
{
  const ctx = kur([{ _sid: 'x', indirim_supheli_puan: 4, indirim_supheli_sebepler: [], indirim_supheli_dusus_yuzde: 60 }]);
  ok('puan 4 ama sebep listesi BOS -> rozet (kutu degil)', (calis(ctx, 'supheliDurum({_sid:"x"})') || {}).seviye === 'rozet');
}

console.log('\n=== 3. KUTU ICERIGI ===');
{
  const ctx = kur([{ _sid: 'x', indirim_supheli_puan: 6, indirim_supheli_sebepler: ['kisa_zirve', 'yuksek_oynaklik', 'tekrarli_dongu', 'asiri_yuksek_oran'], indirim_supheli_dusus_yuzde: 50 }]);
  const html = calis(ctx, 'supheliKutuHTML(supheliDurum({_sid:"x"}), {_sid:"x"})');
  ok('kutu basligi "Bu indirim gerçek görünmüyor"', html.includes('Bu indirim gerçek görünmüyor'), html.slice(0, 160));
  const madde = (html.match(/supheli-kutu-madde/g) || []).length;
  ok('4 sebep verildi ama EN FAZLA 2 madde', madde === 2, 'madde=' + madde);
  ok('kutuda ham etiket yok', !/kisa_zirve|yuksek_oynaklik|tekrarli_dongu|asiri_yuksek_oran/.test(html), html.slice(0, 300));
  const rozet = calis(ctx, 'supheliRozetHTML()');
  ok('rozet metni "Şüpheli indirim"', rozet.includes('Şüpheli indirim'), rozet);
}

console.log('\n=== 4. "BUYUK INDIRIM" BASTIRILIYOR MU (davranis) ===');
{
  const buyukIndirimli = { _sid: 'x', _buyukIndirim: true, en_dusuk_fiyat: 70 };
  // 4a) supheli DEGIL -> Buyuk indirim cikar
  {
    const ctx = kur([]);
    const kart  = calis(ctx, 'urunRozetleriHTML({_sid:"x",_buyukIndirim:true,en_dusuk_fiyat:70}, true)');
    ok('temiz urun: kartta "Büyük indirim" ciziliyor', /indirim-rozet/.test(kart) && /Büyük indirim/.test(kart), kart);
  }
  // 4b) supheli (kutu) -> Buyuk indirim BASTIRILIR
  {
    const ctx = kur([{ _sid: 'x', indirim_supheli_puan: 5, indirim_supheli_sebepler: ['kisa_zirve', 'tekrarli_dongu'], indirim_supheli_dusus_yuzde: 40 }]);
    const kart  = calis(ctx, 'urunRozetleriHTML({_sid:"x",_buyukIndirim:true,en_dusuk_fiyat:70}, true)');
    const detay = calis(ctx, 'urunRozetleriHTML({_sid:"x",_buyukIndirim:true,en_dusuk_fiyat:70}, false)');
    ok('puan 5 kart: "Büyük indirim" YOK', !/Büyük indirim/.test(kart), kart);
    ok('puan 5 kart: sadece kucuk rozet (kutu YOK)', /supheli-rozet/.test(kart) && !/supheli-kutu/.test(kart), kart);
    ok('puan 5 detay: "Büyük indirim" YOK', !/Büyük indirim/.test(detay), detay.slice(0, 120));
    ok('puan 5 detay: kutu ciziliyor', /supheli-kutu/.test(detay), detay.slice(0, 120));
  }
  // 4c) supheli (rozet seviyesi) -> yine bastirilir, kutu yok
  {
    const ctx = kur([{ _sid: 'x', indirim_supheli_puan: 3, indirim_supheli_sebepler: ['tek_dongu'], indirim_supheli_dusus_yuzde: 20 }]);
    const kart  = calis(ctx, 'urunRozetleriHTML({_sid:"x",_buyukIndirim:true,en_dusuk_fiyat:70}, true)');
    const detay = calis(ctx, 'urunRozetleriHTML({_sid:"x",_buyukIndirim:true,en_dusuk_fiyat:70}, false)');
    ok('puan 3 kart: "Büyük indirim" YOK', !/Büyük indirim/.test(kart), kart);
    ok('puan 3 detay: kutu YOK, rozet VAR', !/supheli-kutu/.test(detay) && /supheli-rozet/.test(detay), detay);
  }
  // 4d) puan 4 ama zamansal sebep yok -> detayda da kutu degil rozet
  {
    const ctx = kur([{ _sid: 'x', indirim_supheli_puan: 4, indirim_supheli_sebepler: ['yuksek_oynaklik', 'tek_dongu', 'asiri_yuksek_oran'], indirim_supheli_dusus_yuzde: 70 }]);
    const detay = calis(ctx, 'urunRozetleriHTML({_sid:"x",_buyukIndirim:true,en_dusuk_fiyat:70}, false)');
    ok('puan 4 / zamansal yok: detayda kutu YOK', !/supheli-kutu/.test(detay), detay);
    ok('puan 4 / zamansal yok: rozet VAR', /supheli-rozet/.test(detay), detay);
  }
  // 4e) dort cagri yerinin hepsi ayni fonksiyondan geciyor mu
  const kartFn = fnKaynak('cardHTML') || '';
  ok('cardHTML urunRozetleriHTML kullaniyor', /urunRozetleriHTML\s*\(/.test(kartFn));
  ok('cardHTML artik indirimRozetiHTML dogrudan cagirmiyor', !/indirimRozetiHTML\s*\(/.test(kartFn), '');
  const detayBolge = APP.slice(APP.indexOf('function openDetay('), APP.indexOf('function openDetay(') + 4000);
  ok('openDetay urunRozetleriHTML kullaniyor', /urunRozetleriHTML\s*\(/.test(detayBolge));
  ok('openDetay artik indirimRozetiHTML dogrudan cagirmiyor', !/indirimRozetiHTML\s*\(/.test(detayBolge), '');
}

console.log('\n=== 5. GERCEK INDIRIM ROZETI (yesil) ===');
{
  // 30 gunun en dusugu + supheli degil -> rozet
  const bugun = new Date();
  const g = (n) => { const d = new Date(bugun); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); };
  const gecmis = { y: [ {t:g(25),m:'a101',f:100}, {t:g(18),m:'a101',f:110}, {t:g(9),m:'a101',f:95}, {t:g(1),m:'a101',f:70} ] };
  const ctx = kur([], gecmis);
  const r = calis(ctx, 'gercekIndirimRozetiHesapla({_sid:"y", en_dusuk_fiyat:70, _buyukIndirim:true})');
  ok('temiz urun + 30 gunun en dusugu -> rozet var', !!r, JSON.stringify(r));
  const r2 = calis(ctx, 'gercekIndirimRozetiHesapla({_sid:"y", en_dusuk_fiyat:96, _buyukIndirim:true})');
  ok('en dusuk DEGIL -> rozet yok', r2 === null, JSON.stringify(r2));
  const ctx2 = kur([{ _sid: 'y', indirim_supheli_puan: 2, indirim_supheli_sebepler: ['tek_dongu'], indirim_supheli_dusus_yuzde: 20 }], gecmis);
  ok('supheli (puan 2) -> yesil rozet ASLA', calis(ctx2, 'gercekIndirimRozetiHesapla({_sid:"y", en_dusuk_fiyat:70, _buyukIndirim:true})') === null);
  const ctx3 = kur([], gecmis);
  ok('gercek dusus yok -> yesil rozet yok', calis(ctx3, 'gercekIndirimRozetiHesapla({_sid:"y", en_dusuk_fiyat:70})') === null);
}

console.log('\n=== 6. VERI YOLU: tek istek, puan>=2, sessiz hata ===');
{
  const yukle = fnKaynak('supheliPuanlariYukle');
  ok('supheliPuanlariYukle tanimli', !!yukle);
  if (yukle) {
    ok('  .gte ile puan>=2 filtreleniyor', /gte\(\s*['"]indirim_supheli_puan['"]\s*,\s*2\s*\)/.test(yukle), yukle.replace(/\s+/g, ' ').slice(0, 260));
    ok('  select listesi 4 kolon (tum satir cekilmiyor)',
       /select\(\s*['"]_sid,\s*indirim_supheli_puan,\s*indirim_supheli_sebepler,\s*indirim_supheli_dusus_yuzde['"]/.test(yukle),
       (yukle.match(/select\([^)]*\)/) || [''])[0]);
    ok('  hata yolunda console.error/warn YOK (sessiz)', !/console\.(error|warn)/.test(yukle), (yukle.match(/console\.\w+/g) || []).join(','));
    ok('  hatada _puanCache null kaliyor', /catch/.test(yukle) && !/_puanCache\s*=\s*new Map\(\)\s*;?\s*\}?\s*catch/.test(yukle));
  }
}

console.log('\n=== 7. TASARIM: amber/yesil, KIRMIZI YOK ===');
{
  const kurallar = (CSS.match(/\.supheli-[a-z-]*\s*\{[^}]*\}/g) || []).join('\n')
                 + (CSS.match(/\.gercek-indirim-rozet[a-z-]*\s*\{[^}]*\}/g) || []).join('\n');
  ok('supheli/gercek-indirim CSS kurallari yazilmis', kurallar.length > 40, 'uzunluk=' + kurallar.length);
  const kirmiziRe = /#(DC2626|dc2626|EF4444|ef4444|B91C1C|b91c1c|F87171|f87171)|(^|[^a-z])red([^a-z]|$)/;
  ok('supheli/gercek kurallarinda KIRMIZI yok', !kirmiziRe.test(kurallar), (kurallar.match(kirmiziRe) || []).join(','));
  ok('supheli kurallarinda amber var', /#(F59E0B|D97706|B45309|92400E|FEF3C7|FFFBEB|f59e0b|d97706|b45309|92400e|fef3c7|fffbeb)/.test(kurallar));
  // Projenin mevcut yesil tokenlari: .indirim-rozet.normal / .tazelik-chip.taze
  ok('gercek indirim kuralinda yesil var',
     /#(DCFCE7|065F46|86EFAC|059669|10B981|047857|dcfce7|065f46|86efac)|var\(--primary/.test(kurallar),
     kurallar.slice(0, 200));
}

console.log('\n=== 8. GRAFIKTE ZIRVE ISARETI ===');
{
  const fg = fnKaynak('fiyatGecmisiBlogu') || '';
  ok('fiyatGecmisiBlogu zirve halkasi uretiyor', /fg-zirve-halka/.test(fg));
  ok('  "gün sürdü" notu var', /gün sürdü/.test(fg), '');
  ok('  not SVG icine degil altyaziya yaziliyor (cakisma yok)',
     /zirveNotu/.test(fg) && !/fg-zirve-etiket/.test(fg));
  ok('  sadece kisa_zirve/orta_zirve sebebinde ciziliyor', /kisa_zirve|zirveIsareti|_sd/.test(fg));
  ok('  mevcut cizim korunmus (bandPath/avgPath duruyor)', /bandPath/.test(fg) && /avgPath/.test(fg));
}

console.log('\nPASS=' + pass + '  FAIL=' + fail);
process.exit(fail ? 1 : 0);
