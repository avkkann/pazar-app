// Ozellik A: "Simdi al / bekle".
// Bugunku fiyatin son 30 gunun min/max'ina gore yeri. Yuzdelik KULLANILMIYOR:
// carry-forward serisi basamakli oldugu icin yuzdelik esikler yaniltiyor
// (olcum: %33.2 uyusmazlik; bugun serinin tam maksimumundayken p20 "alt" diyordu).
// app.js'ten fonksiyon KAYNAGINI cikarip vm'de calistirir.
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

const GEREKEN = ['otuzGunlukSeri', 'alZamaniDurumu', 'alZamaniHTML'];
console.log('\n=== 0. YAPI ===');
const eksik = [];
for (const f of GEREKEN) { const v = !!fnKaynak(f); ok('function ' + f, v); if (!v) eksik.push(f); }
if (eksik.length) { console.log('\n  Eksik: ' + eksik.join(', ')); console.log('\nPASS=' + pass + '  FAIL=' + fail); process.exit(1); }

const gun = n => { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); };

function kur(gecmis, opts = {}) {
  const ctx = {
    console, Math, Date, JSON, Array, Object, Number, String, isNaN, Set, parseFloat,
    _gecmisCache: gecmis,
    tl: v => Number(v).toFixed(2).replace('.', ',') + ' ₺',
    lcIcon: () => '<svg></svg>',
    fiyatlariTemizle: mf => ({ gecerli: (mf || []).filter(f => f && f.fiyat != null), gizlenen: [] }),
    supheliDurum: () => opts.supheli || null,
    gercekIndirimRozetiHesapla: () => opts.gercek || null,
    indirimRozetiHesapla: () => opts.indirim || opts.gercek || null,
  };
  vm.createContext(ctx);
  const sabitler = ['AL_ZAMANI_MIN_OYNAMA', 'AL_ZAMANI_TOLERANS']
    .map(s => { const m = APP.match(new RegExp('const ' + s + '\\s*=\\s*([0-9.]+)')); return m ? 'const ' + s + ' = ' + m[1] + ';' : ''; })
    .filter(Boolean).join('\n');
  vm.runInContext([sabitler, ...GEREKEN.map(fnKaynak)].join('\n'), ctx);
  return ctx;
}
const calis = (ctx, i) => vm.runInContext(i, ctx);
const U = (sid, bugun) => ({ _sid: sid, ad: 'X', market_fiyatlari: [{ market: 'bim', fiyat: bugun }] });

console.log('\n=== 1. otuzGunlukSeri: CARRY-FORWARD ===');
{
  // Pencereden ONCE tek kayit -> 30 gun boyunca ayni deger tasinir
  const ctx = kur({ a: [{ t: gun(60), m: 'bim', f: 100 }] });
  const s = calis(ctx, 'otuzGunlukSeri("a")');
  ok('pencere oncesi tek kayit -> 30 gunluk dolu seri', s.length === 30, 'uzunluk=' + s.length);
  ok('  hepsi ayni deger (100)', s.every(x => x === 100), JSON.stringify(s.slice(0, 3)));
}
{
  // 10 gun once degisim -> basamak: 20 gun 100, 10 gun 80
  const ctx = kur({ a: [{ t: gun(60), m: 'bim', f: 100 }, { t: gun(9), m: 'bim', f: 80 }] });
  const s = calis(ctx, 'otuzGunlukSeri("a")');
  ok('degisim sonrasi basamak olusuyor', new Set(s).size === 2, JSON.stringify([...new Set(s)]));
  ok('  eski deger daha COK gun tutuyor (sure agirligi)', s.filter(x => x === 100).length > s.filter(x => x === 80).length,
     '100:' + s.filter(x => x === 100).length + ' 80:' + s.filter(x => x === 80).length);
}
{
  // iki market -> gunluk MIN
  const ctx = kur({ a: [{ t: gun(60), m: 'bim', f: 100 }, { t: gun(60), m: 'a101', f: 70 }] });
  const s = calis(ctx, 'otuzGunlukSeri("a")');
  ok('iki markette gunluk MIN aliniyor', s.every(x => x === 70), JSON.stringify([...new Set(s)]));
}
ok('gecmisi olmayan sid -> bos dizi', calis(kur({}), 'otuzGunlukSeri("yok")').length === 0);
ok('null sid -> patlamiyor', (() => { try { return calis(kur({}), 'otuzGunlukSeri(null)').length === 0; } catch (e) { return false; } })());

console.log('\n=== 2. alZamaniDurumu: ALT / UST / ORTA ===');
const GECMIS_GENIS = { a: [{ t: gun(60), m: 'bim', f: 100 }, { t: gun(20), m: 'bim', f: 60 }] };  // seri: 100 (10g), 60 (20g)
{
  const ctx = kur(GECMIS_GENIS);
  const r = calis(ctx, 'alZamaniDurumu(' + JSON.stringify(U('a', 60)) + ')');
  ok('bugun 30 gun minimumunda -> "iyi"', r && r.tip === 'iyi', JSON.stringify(r));
  ok('  gercek min tasiniyor (60)', r && r.min === 60, JSON.stringify(r));
}
{
  const ctx = kur(GECMIS_GENIS);
  const r = calis(ctx, 'alZamaniDurumu(' + JSON.stringify(U('a', 100)) + ')');
  ok('bugun 30 gun maksimumunda -> "bekle"', r && r.tip === 'bekle', JSON.stringify(r));
  ok('  "genelde X TL\'ye iniyor" icin GERCEK min (60)', r && r.min === 60, JSON.stringify(r));
}
{
  const ctx = kur(GECMIS_GENIS);
  const r = calis(ctx, 'alZamaniDurumu(' + JSON.stringify(U('a', 80)) + ')');
  ok('bugun ORTADA -> null (hicbir sey gosterme)', r === null, JSON.stringify(r));
}

console.log('\n=== 3. VERI YETERSIZ / OYNAMA YOK -> SESSIZ ===');
{
  const ctx = kur({ a: [{ t: gun(60), m: 'bim', f: 100 }] });
  ok('tek deger (oynama yok) -> null', calis(ctx, 'alZamaniDurumu(' + JSON.stringify(U('a', 100)) + ')') === null);
}
{
  // %5'ten az oynama -> yorum yapma
  const ctx = kur({ a: [{ t: gun(60), m: 'bim', f: 100 }, { t: gun(20), m: 'bim', f: 97 }] });
  ok('oynama %5 altinda -> null', calis(ctx, 'alZamaniDurumu(' + JSON.stringify(U('a', 97)) + ')') === null);
}
{
  // gecmis pencereye yetmiyor (ilk kayit 10 gun once) -> 30 gunluk seri kurulamaz
  const ctx = kur({ a: [{ t: gun(10), m: 'bim', f: 100 }, { t: gun(5), m: 'bim', f: 60 }] });
  ok('30 gunluk seri kurulamiyorsa -> null', calis(ctx, 'alZamaniDurumu(' + JSON.stringify(U('a', 60)) + ')') === null);
}
ok('gecmis yok -> null', calis(kur({}), 'alZamaniDurumu(' + JSON.stringify(U('a', 60)) + ')') === null);
ok('bugunku fiyat yok -> null', calis(kur(GECMIS_GENIS), 'alZamaniDurumu({"_sid":"a","market_fiyatlari":[]})') === null);

console.log('\n=== 4. YIGILMA: BASKA ROZET VARKEN SUS ===');
{
  const ctx = kur(GECMIS_GENIS, { supheli: { seviye: 'kutu' } });
  ok('SUPHELI varken "iyi" YOK', calis(ctx, 'alZamaniDurumu(' + JSON.stringify(U('a', 60)) + ')') === null);
  ok('SUPHELI varken "bekle" de YOK', calis(ctx, 'alZamaniDurumu(' + JSON.stringify(U('a', 100)) + ')') === null);
}
{
  // urunRozetleriHTML tek rozet kaynagi: bir sey soyluyorsa bu blok tamamen susar.
  const ctx = kur(GECMIS_GENIS, { gercek: { yuzde: 30 } });
  ok('"Gercek indirim" rozeti varken "iyi" YOK (rozet zaten ayni seyi soyluyor)',
     calis(ctx, 'alZamaniDurumu(' + JSON.stringify(U('a', 60)) + ')') === null);
  ok('  "bekle" de YOK (olcum: 186 uruncte rozetle CELISIYORDU)',
     calis(ctx, 'alZamaniDurumu(' + JSON.stringify(U('a', 100)) + ')') === null);
}
{
  const ctx = kur(GECMIS_GENIS, { indirim: { tip: 'buyuk', yuzde: 39 } });
  ok('"Buyuk indirim" rozeti varken "bekle" YOK', calis(ctx, 'alZamaniDurumu(' + JSON.stringify(U('a', 100)) + ')') === null);
  ok('"Buyuk indirim" rozeti varken "iyi" de YOK', calis(ctx, 'alZamaniDurumu(' + JSON.stringify(U('a', 60)) + ')') === null);
}
{
  // rozet YOKKEN normal davranis bozulmadi
  const ctx = kur(GECMIS_GENIS);
  ok('rozet yokken "iyi" cikiyor', (calis(ctx, 'alZamaniDurumu(' + JSON.stringify(U('a', 60)) + ')') || {}).tip === 'iyi');
  ok('rozet yokken "bekle" cikiyor', (calis(ctx, 'alZamaniDurumu(' + JSON.stringify(U('a', 100)) + ')') || {}).tip === 'bekle');
}

console.log('\n=== 5. HTML ===');
{
  const ctx = kur(GECMIS_GENIS);
  const hIyi = calis(ctx, 'alZamaniHTML(' + JSON.stringify(U('a', 60)) + ')');
  const hBek = calis(ctx, 'alZamaniHTML(' + JSON.stringify(U('a', 100)) + ')');
  const hOrt = calis(ctx, 'alZamaniHTML(' + JSON.stringify(U('a', 80)) + ')');
  const dz = h => h.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  ok('orta -> bos string', hOrt === '', JSON.stringify(hOrt));
  // NOT: /i bayragi Turkce "İ"yi "i"ye indirgemiyor (i + birlesik nokta cikiyor),
  // o yuzden buyuk harfli hali dogrudan araniyor.
  ok('iyi -> "İyi zaman" diyor', /İyi zaman/.test(dz(hIyi)), dz(hIyi));
  ok('  "son ayin en ucuz" ifadesi var', /en ucuz/i.test(dz(hIyi)), dz(hIyi));
  ok('bekle -> "bekle" diyor', /bekle/i.test(dz(hBek)), dz(hBek));
  ok('  GERCEK rakam yaziliyor (60,00 TL)', /60,00 ₺/.test(dz(hBek)), dz(hBek));
  ok('  uydurma/yuvarlanmis rakam yok', !/6[1-9],|59,/.test(dz(hBek)), dz(hBek));
}

console.log('\n=== 6. TASARIM: AMBER YOK, YENI PALET YOK ===');
{
  const k = (CSS.match(/[^\n{}]*\.detay-zaman[^{}]*\{[^}]*\}/g) || []).join('\n');
  ok('.detay-zaman* kurallari var', k.length > 40, 'uzunluk=' + k.length);
  ok('AMBER kullanilmadi (supheli kutusunun dili)', !/#(FFFBEB|FDE68A|D97706|92400E|B45309)/i.test(k), k.slice(0, 240));
  ok('KIRMIZI yok', !/#(DC2626|EF4444|B91C1C)/i.test(k), k.slice(0, 240));
  ok('mevcut yesil/notr paletten (DCFCE7/065F46/ECFDF5/D1FAE5/059669 veya var(--*))',
     /#(DCFCE7|065F46|ECFDF5|D1FAE5|059669)|var\(--/i.test(k), k.slice(0, 240));
  // 6EE7B7 mevcut palette: .alarm-active-text koyu temada zaten bu tonu kullaniyor.
  const yeni = (k.match(/#[0-9A-Fa-f]{6}/g) || []).filter(c => !/^#(DCFCE7|065F46|ECFDF5|D1FAE5|059669|6EE7B7)$/i.test(c));
  ok('yeni renk sabiti getirilmedi', yeni.length === 0, yeni.join(','));
  ok('  6EE7B7 gercekten mevcut palette (uydurulmadi)', /alarm-active-text[^}]*#6ee7b7/i.test(CSS.replace(/\s+/g, ' ')), '');
  ok('urun adindan kucuk (detay-name 20px+, bu <=14px)', /font-size:\s*(1[0-4])px/.test(k), k.slice(0, 240));
}

console.log('\n=== 7. YER: SADECE URUN DETAYI, KART DEGISMEDI ===');
{
  ok('detay render alZamaniHTML cagiriyor', /alZamaniHTML\s*\(/.test(APP.slice(APP.indexOf('function openDetay'), APP.indexOf('function openDetay') + 4000)), '');
  ok('cardHTML cagirmiyor', !/alZamani/.test(fnKaynak('cardHTML') || ''));
  ok('_stripKartHTML cagirmiyor', !/alZamani/.test(fnKaynak('_stripKartHTML') || ''));
  ok('_firsatKartHtml cagirmiyor', !/alZamani/.test(fnKaynak('_firsatKartHtml') || ''));
  ok('urunRozetleriHTML degismedi (tek rozet kaynagi bozulmadi)', !/alZamani/.test(fnKaynak('urunRozetleriHTML') || ''));
}

console.log('\nPASS=' + pass + '  FAIL=' + fail);
process.exit(fail ? 1 : 0);
