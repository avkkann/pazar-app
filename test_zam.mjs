// "Bu ay en cok zamlananlar" seridi.
// Olcut kesifle secildi: son 7 gun ortalamasi vs PENCERE ONCESI TEPE.
// Sebep: ilk-hafta/son-hafta karsilastirmasi kampanya bitisini zam saniyordu
// (Palmolive gecmisi: 369,95 -> 189,95 -> 369,95 -> 129,95 -> 369,95).
import fs from 'fs';
import vm from 'vm';

const APP = fs.readFileSync('app.js', 'utf8');
const HTML = fs.readFileSync('index.html', 'utf8');
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

const GEREKEN = ['zamOncekiZirve', 'zamAdaylari', 'paylasZamlar'];
console.log('\n=== 0. YAPI ===');
const eksik = [];
for (const f of GEREKEN) { const v = !!fnKaynak(f); ok('function ' + f, v); if (!v) eksik.push(f); }
ok('async function renderZamSeridi', !!fnKaynak('renderZamSeridi'));
if (eksik.length) { console.log('\n  Eksik: ' + eksik.join(', ')); console.log('\nPASS=' + pass + '  FAIL=' + fail); process.exit(1); }

const gun = n => { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); };

function kur(gecmis, urunler, opts = {}) {
  const ctx = {
    console, Math, Date, JSON, Array, Object, Number, String, isNaN, Set, Map,
    _gecmisCache: gecmis,
    _tumUrunler: urunler,
    catCache: { test: urunler },
    MARKET_NAMES: { a101: 'A101', bim: 'BİM', migros: 'Migros', carrefour: 'CarrefourSA' },
    tl: v => Number(v).toFixed(2).replace('.', ',') + ' ₺',
    lcIcon: () => '<svg></svg>',
    fiyatlariTemizle: mf => ({ gecerli: (mf || []).filter(f => f && f.fiyat != null), gizlenen: [] }),
    marketVarMi: m => (opts.yokMarket ? m !== opts.yokMarket : true),
    ustKategori: k => (k === 'Meyve' || k === 'Sebze') ? (k === 'Meyve' ? 'meyve' : 'sebze') : 'gida',
    navigator: {}, window: {},
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  const sabitler = ['ZAM_ESIK', 'ZAM_MAX', 'ZAM_MIN', 'ZAM_MIN_KAYIT', 'ZAM_MARKA_MAX', 'ZAM_KAT_MAX']
    .map(s => { const m = APP.match(new RegExp('const ' + s + '\\s*=\\s*([0-9.]+)')); return m ? 'const ' + s + ' = ' + m[1] + ';' : ''; })
    .filter(Boolean).join('\n');
  const seriCache = APP.match(/let _seriCache[^\n]*\n/);
  vm.runInContext([
    sabitler, seriCache ? seriCache[0] : '',
    fnKaynak('otuzGunlukSeri'), fnKaynak('_zamGunISO'),
    fnKaynak('zamMarketSerisi'), fnKaynak('zamMarketArtisi'),
    fnKaynak('zamOncekiZirve'), fnKaynak('_zamMarka'), fnKaynak('zamAdaylari'),
  ].join('\n'), ctx);
  return ctx;
}
const calis = (ctx, i) => vm.runInContext(i, ctx);

// yardimci: sabit fiyatli gecmis + bugunku urun
const U = (sid, ad, bugun, kat) => ({ _sid: sid, _id: sid, ad, ana_kategori: kat || 'Gıda',
  en_dusuk_fiyat: bugun, market_fiyatlari: [{ market: 'bim', fiyat: bugun }] });

console.log('\n=== 1. zamOncekiZirve ===');
{
  const g = { a: [{ t: gun(70), m: 'bim', f: 100 }, { t: gun(50), m: 'bim', f: 120 }, { t: gun(5), m: 'bim', f: 200 }] };
  const c = kur(g, []);
  const r = calis(c, 'zamOncekiZirve("a")');
  ok('pencere ONCESI en yuksek fiyat (120)', r && r.zirve === 120, JSON.stringify(r));
  ok('  pencere ICI kayit (200) zirveye girmiyor', r && r.zirve !== 200, JSON.stringify(r));
  ok('  eski kayit sayisi 2', r && r.kayit === 2, JSON.stringify(r));
}
ok('gecmisi olmayan -> null', calis(kur({}, []), 'zamOncekiZirve("yok")') === null);
{
  const g = { a: [{ t: gun(5), m: 'bim', f: 200 }] };
  ok('yalnizca pencere ICI kayit varsa -> null (capa yok)',
     calis(kur(g, []), 'zamOncekiZirve("a")') === null);
}

console.log('\n=== 2. KAMPANYA BITISI ZAM SAYILMIYOR (asil sinav) ===');
{
  // Palmolive gercek deseni: normal 369.95, arada 129.95 kampanya, simdi yine 369.95
  const g = { p: [
    { t: gun(77), m: 'migros', f: 369.95 }, { t: gun(67), m: 'migros', f: 189.95 },
    { t: gun(53), m: 'migros', f: 369.95 }, { t: gun(32), m: 'migros', f: 129.95 },
    { t: gun(17), m: 'migros', f: 369.95 },
  ] };
  const c = kur(g, [U('p', 'Palmolive Duş Jeli', 369.95)]);
  const liste = calis(c, 'zamAdaylari()');
  ok('kampanya bitisi listeye GIRMIYOR', liste.length === 0, JSON.stringify(liste.map(x => x.ad + ' %' + x.artis)));
  const z = calis(c, 'zamOncekiZirve("p")');
  ok('  cunku onceki tepe (369,95) bugunku fiyata esit', z && Math.abs(z.zirve - 369.95) < 0.01, JSON.stringify(z));
}
{
  // GERCEK zam: onceki tepeyi asiyor
  const g = { s: [
    { t: gun(80), m: 'bim', f: 50 }, { t: gun(60), m: 'bim', f: 60 },
    { t: gun(20), m: 'bim', f: 159 },
  ] };
  const c = kur(g, [U('s', 'Sprite Gazoz 1 Lt', 159)]);
  const liste = calis(c, 'zamAdaylari()');
  ok('onceki tepeyi asan GERCEK zam listeye giriyor', liste.length === 1, JSON.stringify(liste));
  ok('  artis onceki tepeye gore (60 -> 159 = %165)', liste[0] && Math.round(liste[0].artis) === 165, liste[0] && liste[0].artis);
  ok('  eski/yeni fiyat tasiniyor', liste[0] && liste[0].eski === 60 && liste[0].yeni > 150, JSON.stringify(liste[0]));
}

console.log('\n=== 3. ESIK VE SINIRLAR ===');
{
  const g = { x: [{ t: gun(80), m: 'bim', f: 100 }, { t: gun(60), m: 'bim', f: 100 }, { t: gun(20), m: 'bim', f: 110 }] };
  ok('%15 altindaki artis listeye GIRMIYOR (%10)',
     calis(kur(g, [U('x', 'Az Zamli', 110)]), 'zamAdaylari()').length === 0);
}
{
  const g = { x: [{ t: gun(80), m: 'bim', f: 100 }, { t: gun(60), m: 'bim', f: 100 }, { t: gun(20), m: 'bim', f: 130 }] };
  ok('%15 ustundeki artis giriyor (%30)',
     calis(kur(g, [U('x', 'Zamli', 130)]), 'zamAdaylari()').length === 1);
}
{
  // tek eski kayit -> capa kirilgan, alinmiyor
  const g = { x: [{ t: gun(60), m: 'bim', f: 100 }, { t: gun(20), m: 'bim', f: 200 }] };
  ok('eski kayit 1 ise ALINMIYOR (capa kirilgan)',
     calis(kur(g, [U('x', 'Tek Kayit', 200)]), 'zamAdaylari()').length === 0);
}
{
  // NOT: cesitlilik kurali (marka<=2, alt kategori<=3) yuzunden her urun
  // FARKLI marka ve kategoriden olmali, yoksa 10'a varmadan kesilir.
  const g = {}; const urunler = [];
  for (let i = 0; i < 15; i++) {
    g['u' + i] = [{ t: gun(80), m: 'bim', f: 100 }, { t: gun(60), m: 'bim', f: 100 }, { t: gun(20), m: 'bim', f: 200 + i }];
    const p = U('u' + i, 'Marka' + i + ' Urun', 200 + i);
    p.ana_kategori = 'Kategori' + i;
    urunler.push(p);
  }
  const liste = calis(kur(g, urunler), 'zamAdaylari()');
  ok('en fazla 10 urun', liste.length === 10, liste.length);
  ok('  artisa gore azalan sirali', liste.every((x, i) => i === 0 || liste[i - 1].artis >= x.artis), JSON.stringify(liste.map(x => Math.round(x.artis))));
}

console.log('\n=== 4. MEVSIM TUZAGI: TAZE URUN ALINMIYOR ===');
{
  const g = { k: [{ t: gun(80), m: 'bim', f: 10 }, { t: gun(60), m: 'bim', f: 10 }, { t: gun(20), m: 'bim', f: 40 }] };
  const c = kur(g, [{ _sid: 'k', _id: 'k', ad: 'Karpuz 1 Kg', ana_kategori: 'Meyve',
                      en_dusuk_fiyat: 40, market_fiyatlari: [{ market: 'bim', fiyat: 40 }] }]);
  ok('taze meyve listeye GIRMIYOR', calis(c, 'zamAdaylari()').length === 0);
  const za = fnKaynak('zamAdaylari') || '';
  ok('  ust kategori ile eleniyor', /ustKategori\s*\(/.test(za) && /meyve|sebze/.test(za), '');
}

console.log('\n=== 4b. LISTE URUN-MARKET CIFTINDEN KURULUYOR ===');
{
  // a101 zamlandi, bim ayni. Tek-seri yonteminde min bim'i izler ve urun
  // esigi GECEMEZ. Market bazli olcutle a101 yakalanmali.
  const g = { x: [
    { t: gun(78), m: 'a101', f: 50 }, { t: gun(60), m: 'a101', f: 50 }, { t: gun(20), m: 'a101', f: 120 },
    { t: gun(78), m: 'bim', f: 52 },  { t: gun(60), m: 'bim', f: 52 },  { t: gun(20), m: 'bim', f: 53 },
  ] };
  const u = [{ _sid: 'x', _id: 'x', ad: 'Test Deterjan', ana_kategori: 'Gıda',
               en_dusuk_fiyat: 53, market_fiyatlari: [{ market: 'a101', fiyat: 120 }, { market: 'bim', fiyat: 53 }] }];
  const liste = calis(kur(g, u), 'zamAdaylari()');
  ok('bir markette zamlanan urun ARTIK yakalaniyor', liste.length === 1, JSON.stringify(liste.map(x => x.ad)));
  ok('  zamlanan market kayitta', liste[0] && liste[0].market === 'a101', JSON.stringify(liste[0] && liste[0].market));
  ok('  artis o marketin kendi serisinden (%140)', liste[0] && Math.round(liste[0].artis) === 140, liste[0] && liste[0].artis);
  ok('  eski fiyat o marketin tepesi (50)', liste[0] && liste[0].eski === 50, liste[0] && liste[0].eski);
}
{
  // ayni urun IKI markette zamli -> TEK kart
  const g = { x: [
    { t: gun(78), m: 'a101', f: 50 }, { t: gun(60), m: 'a101', f: 50 }, { t: gun(20), m: 'a101', f: 120 },
    { t: gun(78), m: 'bim', f: 52 },  { t: gun(60), m: 'bim', f: 52 },  { t: gun(20), m: 'bim', f: 110 },
  ] };
  const u = [{ _sid: 'x', _id: 'x', ad: 'Iki Markette', ana_kategori: 'Gıda',
               en_dusuk_fiyat: 110, market_fiyatlari: [{ market: 'a101', fiyat: 120 }, { market: 'bim', fiyat: 110 }] }];
  const liste = calis(kur(g, u), 'zamAdaylari()');
  ok('ayni urun icin TEK kart', liste.length === 1, JSON.stringify(liste.map(x => x.ad + '/' + x.market)));
  ok('  en yuksek artisli market temsil ediyor', liste[0] && liste[0].market === 'a101', liste[0] && liste[0].market);
}

console.log('\n=== 4c. CESITLILIK KURALI (marka<=2, alt kategori<=3) ===');
{
  const g = {}; const u = [];
  // ayni marka + ayni alt kategoride 6 urun
  for (let i = 0; i < 6; i++) {
    g['m' + i] = [{ t: gun(78), m: 'a101', f: 50 }, { t: gun(60), m: 'a101', f: 50 }, { t: gun(20), m: 'a101', f: 200 - i }];
    u.push({ _sid: 'm' + i, _id: 'm' + i, ad: 'Garnier Urun ' + i, ana_kategori: 'Cilt Bakımı',
             en_dusuk_fiyat: 200 - i, market_fiyatlari: [{ market: 'a101', fiyat: 200 - i }] });
  }
  const liste = calis(kur(g, u), 'zamAdaylari()');
  ok('ayni markadan en fazla 2', liste.length === 2, JSON.stringify(liste.map(x => x.ad)));
}
{
  const g = {}; const u = [];
  // ayni alt kategoride 6 FARKLI marka
  const markalar = ['Aa', 'Bb', 'Cc', 'Dd', 'Ee', 'Ff'];
  markalar.forEach((mk, i) => {
    g['k' + i] = [{ t: gun(78), m: 'a101', f: 50 }, { t: gun(60), m: 'a101', f: 50 }, { t: gun(20), m: 'a101', f: 200 - i }];
    u.push({ _sid: 'k' + i, _id: 'k' + i, ad: mk + ' Urun', ana_kategori: 'Cilt Bakımı',
             en_dusuk_fiyat: 200 - i, market_fiyatlari: [{ market: 'a101', fiyat: 200 - i }] });
  });
  const liste = calis(kur(g, u), 'zamAdaylari()');
  ok('ayni alt kategoriden en fazla 3', liste.length === 3, JSON.stringify(liste.map(x => x.ad)));
}
{
  // kural yuzunden 10'a dolmuyorsa ESIK DUSURULMEZ, az urunle gosterilir
  const za = fnKaynak('zamAdaylari') || '';
  ok('esik dinamik degil (tek ZAM_ESIK karsilastirmasi)',
     (za.match(/ZAM_ESIK/g) || []).length <= 2, (za.match(/ZAM_ESIK/g) || []).length + ' kez geciyor');
  ok('  marka siniri kodda', /ZAM_MARKA_MAX/.test(za), '');
  ok('  alt kategori siniri kodda', /ZAM_KAT_MAX/.test(za), '');
}

console.log('\n=== 5. SEHIR FILTRESI ===');
{
  const g = { x: [{ t: gun(80), m: 'bim', f: 100 }, { t: gun(60), m: 'bim', f: 100 }, { t: gun(20), m: 'bim', f: 200 }] };
  const u = [{ _sid: 'x', _id: 'x', ad: 'Sadece BIM', ana_kategori: 'Gıda', en_dusuk_fiyat: 200,
               market_fiyatlari: [{ market: 'bim', fiyat: 200 }] }];
  ok('sehir filtresi yokken listede', calis(kur(g, u), 'zamAdaylari()').length === 1);
  ok('o ilde bim YOKSA listeden dusuyor', calis(kur(g, u, { yokMarket: 'bim' }), 'zamAdaylari()').length === 0);
  const za = fnKaynak('zamAdaylari') || '';
  ok('  marketVarMi ile suzuluyor', /marketVarMi\s*\(/.test(za), '');
}

console.log('\n=== 6. SERIT: 3\'TEN AZSA HIC CIZILMEZ ===');
{
  const rz = fnKaynak('renderZamSeridi') || '';
  ok('ZAM_MIN esigi kullaniliyor', /ZAM_MIN/.test(rz), '');
  ok('  az ise display none', /display\s*=\s*'none'/.test(rz), '');
  ok('mevcut kart deseni kullaniliyor (_stripKartHTML)', /_stripKartHTML\s*\(/.test(rz), '');
  ok('  yeni kart bileseni uydurulmadi', !/zam-kart|zamCard/.test(APP), '');
  ok('artis yuzdesi kartta gosteriliyor', /_kartaRozetEkle|zamRozetHTML/.test(rz), '');
}

console.log('\n=== 7. YER: "Bu indirimlere dikkat"in HEMEN ALTI ===');
{
  const iS = HTML.indexOf('id="home-supheli"');
  const iZ = HTML.indexOf('id="home-zam"');
  const iC = HTML.indexOf('id="home-cats"');
  ok('#home-zam var', iZ > -1);
  ok('supheli seridinin ALTINDA', iZ > iS, 'supheli=' + iS + ' zam=' + iZ);
  ok('kategori gridinin USTUNDE', iZ < iC, 'zam=' + iZ + ' cats=' + iC);
  ok('baslik dogru', /Bu ay en çok zamlananlar/.test(HTML), '');
  ok('alt baslik dogru', /Son 30 günde fiyatı en çok artan ürünler/.test(HTML), '');
  ok('loadData renderZamSeridi cagiriyor', /renderZamSeridi\s*\(/.test(fnKaynak('loadData') || ''), '');
  // catCache LAZY: loadData icinde dogrudan cagrilirsa havuz bos olur ve bolum
  // sessizce gizli kalir. Canlida tam bunu yasadik.
  const rz2 = fnKaynak('renderZamSeridi') || '';
  ok('  renderZamSeridi once loadAllCats bekliyor', /await\s+loadAllCats\s*\(/.test(rz2),
     rz2.split('\n').filter(l => /await/.test(l)).join(' | '));
  ok('  ilk boyamayi bloklamiyor (idle/timeout icinde)',
     /requestIdleCallback\([^)]*renderZamSeridi|setTimeout\(\s*\(\)\s*=>\s*\{[^}]*renderZamSeridi/.test((fnKaynak('loadData') || '').replace(/\s+/g, ' ')),
     '');
}

console.log('\n=== 8. PAYLASIM ===');
{
  const p = fnKaynak('paylasZamlar') || '';
  ok('navigator.share kullaniyor', /navigator\.share/.test(p), '');
  ok('  wa.me yedegi var', /wa\.me/.test(p), '');
  ok('  yeni paylasim altyapisi kurulmadi (mevcut desen)', /navigator\.share/.test(fnKaynak('paylasEnflasyon') || ''), '');
  ok('ilk 5 urun paylasiliyor', /slice\(0,\s*5\)/.test(p.replace(/\s+/g, '')) || /\.slice\(0, 5\)/.test(p), p.replace(/\s+/g, ' ').slice(0, 200));
  ok('  metin rakam odakli (%)', /%/.test(p), '');
  // Buton index.html'de duruyor (onclick), renderZamSeridi yalnizca gorunur yapiyor.
  ok('serit basliginda paylas butonu var', /id="home-zam-paylas"[^>]*onclick="paylasZamlar\(\)"/.test(HTML), '');
  ok('  varsayilan gizli, liste dolunca aciliyor',
     /id="home-zam-paylas"[^>]*style="display:none"/.test(HTML) &&
     /home-zam-paylas/.test(fnKaynak('renderZamSeridi') || ''), '');
}

console.log('\n=== 9. TASARIM: AMBER, KIRMIZI YOK ===');
{
  const k = (CSS.match(/[^\n{}]*\.zam-rozet[^{}]*\{[^}]*\}/g) || []).join('\n');
  ok('.zam-rozet kurali var', k.length > 20, 'uzunluk=' + k.length);
  ok('KIRMIZI kullanilmadi', !/#(DC2626|EF4444|B91C1C|FF0000)/i.test(k), k.slice(0, 200));
  ok('amber ton (B45309/D97706/92400E/FFFBEB/FDE68A)', /#(B45309|D97706|92400E|FFFBEB|FDE68A)/i.test(k), k.slice(0, 200));
  const yeni = (k.match(/#[0-9A-Fa-f]{6}/g) || []).filter(c => !/^#(B45309|D97706|92400E|FFFBEB|FDE68A)$/i.test(c));
  ok('yeni palet getirilmedi', yeni.length === 0, yeni.join(','));
}

console.log('\n=== 10. URUN DETAYI DEGISMEDI ===');
{
  const od = APP.slice(APP.indexOf('function openDetay'), APP.indexOf('function openDetay') + 4500);
  ok('detay render zam koduna dokunmuyor', !/zamAdaylari|zamRozet|renderZamSeridi/.test(od), '');
}

console.log('\nPASS=' + pass + '  FAIL=' + fail);
process.exit(fail ? 1 : 0);
