// test_cekirdek.mjs — core/pazar-cekirdek.cjs, app.js'ten AYRIŞMASIN.
//
// NEDEN VAR: cekirdek app.js'ten URETILIYOR (scripts/cekirdek-uret.mjs).
// Uretici kosulmadan app.js degistirilirse cekirdek sessizce BAYATLAR ve
// React Native istemcisi eski kurali kullanmaya devam eder -- bu depoda
// "iki ayri uygulama = kacinilmaz sapma" diye kayitli olan tuzagin ta kendisi.
// Bu test her fonksiyon govdesini KARAKTER KARAKTER karsilastirir.
//
// Kullanim: node test_cekirdek.mjs
import fs from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
let pass = 0, fail = 0;
const ok = (ad, k, d = '') => {
  if (k) { pass++; console.log('  PASS  ' + ad); }
  else { fail++; console.log('  FAIL  ' + ad + (d ? '  -> ' + d : '')); }
};

const APP = fs.readFileSync('app.js', 'utf8');
const CEK_YOL = 'core/pazar-cekirdek.cjs';

console.log('\n=== 1. CEKIRDEK VAR VE YUKLENIYOR ===');
ok('core/pazar-cekirdek.cjs mevcut', fs.existsSync(CEK_YOL), CEK_YOL);
const CEK = fs.readFileSync(CEK_YOL, 'utf8');
let C = null;
try { C = require('./' + CEK_YOL); } catch (e) { /* asagidaki iddia dusurur; hata mesaji orada gorunur */ }
ok('modul yuklenebiliyor', !!C, C ? '' : 'require patladi');
ok('disa verilen ad sayisi >= 50', C && Object.keys(C).length >= 50,
   C ? String(Object.keys(C).length) : '0');

console.log('\n=== 2. URETILMIS OLDUGU BELLI ===');
ok('bas yorumda "URETILMIS DOSYA" uyarisi var', /URETILMIS DOSYA/.test(CEK), '');
ok('ureteci adi yaziyor', /cekirdek-uret\.mjs/.test(CEK), '');

console.log('\n=== 3. GOVDELER app.js ILE BIREBIR (ayrisma yok) ===');
// Ust duzey `function ad(` blogunu, bir sonraki ust duzey bildirime kadar alir.
// Ureticideki fonksiyonun AYNISI -- kasten: farkli kesim = yanlis karsilastirma.
function govde(kaynak, ad) {
  const L = kaynak.split(/\r?\n/);
  const bas = L.findIndex((l) => new RegExp(`^(async )?function ${ad.replace(/\$/g, '\\$')}\\s*\\(`).test(l));
  if (bas < 0) return null;
  for (let i = bas + 1; i < L.length; i++) {
    if (/^(async )?function [A-Za-z_$]/.test(L[i]) || /^(const|let|var) /.test(L[i])
        || /^document\./.test(L[i]) || /^\/\/ ═/.test(L[i])) {
      return L.slice(bas, i).join('\n').replace(/\s+$/, '');
    }
  }
  return L.slice(bas).join('\n');
}

// Cekirdekteki ust duzey fonksiyon adlarini dosyadan cikar (elle liste tutmuyoruz:
// liste burada da yazilsaydi UCUNCU bir kaynak olurdu).
const cekAdlar = [...CEK.matchAll(/^(?:async )?function ([A-Za-z_$][\w$]*)\s*\(/gm)]
  .map((m) => m[1])
  // cekirdegin KENDI altyapi fonksiyonlari app.js'te yok, karsilastirilmaz
  .filter((a) => !['baglaAyarla', 'durumAyarla', 'durumOku', 'sehirOku'].includes(a));

ok('cekirdekte karsilastirilacak fonksiyon var', cekAdlar.length >= 30, 'adet=' + cekAdlar.length);

const ayrisan = [], bulunamayan = [];
for (const ad of cekAdlar) {
  const a = govde(APP, ad);
  const c = govde(CEK, ad);
  if (!a) { bulunamayan.push(ad); continue; }
  if (a !== c) ayrisan.push(ad);
}
ok('her fonksiyon app.js\'te de var', bulunamayan.length === 0, bulunamayan.join(', '));
ok('hicbir govde AYRISMAMIS (karakter karakter ayni)', ayrisan.length === 0,
   ayrisan.length ? ayrisan.join(', ') + '  -> `node scripts/cekirdek-uret.mjs` kos' : '');

console.log('\n=== 4. SABITLER AYNI DEGERDE ===');
// Deger karsilastirmasi metin degil DAVRANIS uzerinden: sayisal sabitler
// app.js'ten regexle okunup cekirdegin disa verdigi degerle karsilastiriliyor.
const sayisalSabit = ['ZAM_ESIK', 'ZAM_MAX', 'ZAM_MIN_KAYIT', 'ZAM_KAT_MAX',
                      'ZAM_MARKA_MAX', 'SUPHELI_KUTU_ESIK'];
for (const ad of sayisalSabit) {
  const m = new RegExp(`^const ${ad}\\s*=\\s*([0-9.]+)`, 'm').exec(APP);
  const beklenen = m ? Number(m[1]) : null;
  ok(`  ${ad} = ${beklenen}`, C && beklenen !== null && C[ad] === beklenen,
     `app.js=${beklenen} cekirdek=${C ? C[ad] : '?'}`);
}

console.log('\n=== 5. CALISIYOR (davranissal ornekler) ===');
if (C) {
  ok('trNormalize Turkce asimetriyi duzlestiriyor', C.trNormalize('ÇİĞ KÖFTE') === 'cig kofte',
     C.trNormalize('ÇİĞ KÖFTE'));
  ok('tl() tr-TR bicimi + lira isareti', /^1\.234,50\s?₺$/.test(C.tl(1234.5)), C.tl(1234.5));
  ok('ustKategori eslestiriyor', C.ustKategori('Peynir') === 'sut', C.ustKategori('Peynir'));
  // sehirOku ENJEKTE: varsayilan null -> marketVarMi her zaman true
  ok('sehir secilmemisken marketVarMi TRUE (hicbir sey gizlenmez)',
     C.marketVarMi('carrefour') === true, '');
  C.baglaAyarla({ sehirOku: () => 'YokIl' });
  C.durumAyarla({ ilMarketleri: { iller: { 'YokIl': { marketler: ['bim'] } } } });
  ok('enjekte edilen sehirle filtre calisiyor',
     C.marketVarMi('bim') === true && C.marketVarMi('carrefour') === false, '');
  C.baglaAyarla({ sehirOku: () => null });   // testler arasi sizinti olmasin
}


console.log('');
console.log('=== 6. SEPET HESABI (enjekte edilen durum) ===');
// NEDEN BURADA: market toplamlari ve bolme onerisi IS MANTIGI. RN istemcisi
// bunu yeniden yazsaydi iki farkli "hangi market daha ucuz" cevabi olurdu --
// bu depoda "iki kaynak = kacinilmaz sapma" diye kayitli tuzagin ta kendisi.
// app.js'te bu fonksiyonlar modul seviyesindeki "sepet" degiskenini okuyor;
// cekirdekte ayni ad durumAyarla() ile disaridan doldruluyor.
if (C) {
  const sahteUrun = (ad, fiyatlar) => ({
    _id: ad, _sid: ad, ad: ad,
    market_fiyatlari: Object.keys(fiyatlar).map((m) => ({ market: m, fiyat: fiyatlar[m] })),
  });
  const A = sahteUrun('A', { bim: 100, a101: 250 });   // iki markette de var
  const B = sahteUrun('B', { bim: 40 });               // yalniz bim'de

  // KONTROL GRUBU ONCE: sepet bosken hicbir sey uretilmemeli. Bu gorulmeden
  // asagidaki iddialar anlamsiz olurdu -- bos sepet de 0 verirdi.
  C.durumAyarla({ sepet: [] });
  ok('bos sepette market toplami YOK', C.marketToplamlari().length === 0, '');
  ok('bos sepette bolme onerisi kapali', C.sepetBolmeOnerisi().oner === false, '');

  C.durumAyarla({ sepet: [A, B] });
  const t = C.marketToplamlari();
  const bim = t.find((x) => x.market === 'bim');
  const a101 = t.find((x) => x.market === 'a101');
  ok('sepet enjekte edildi (durumOku goruyor)', C.durumOku().sepetSayisi === 2,
     String(C.durumOku().sepetSayisi));
  ok('bim toplami 140 ve eksigi yok', !!bim && bim.toplam === 140 && bim.eksik === 0,
     bim ? bim.toplam + '/' + bim.eksik : 'yok');
  ok('a101 eksik urun sayisini bildiriyor', !!a101 && a101.eksik === 1,
     a101 ? String(a101.eksik) : 'yok');
  ok('sepeti tam karsilayan once siralaniyor', !!t[0] && t[0].market === 'bim',
     t[0] ? t[0].market : 'yok');
  ok('market adi cozuluyor (MARKET_NAMES cekirdekte)', !!bim && bim.ad === 'BİM',
     bim ? bim.ad : 'yok');

  // Tek market 140; en iyi ikili de 140 -> kazanc 0, esik 50 -> ONERILMEZ.
  const o = C.sepetBolmeOnerisi();
  ok('kazanc esigin altindayken bolme ONERILMIYOR', o.oner === false && o.kazanc === 0,
     'oner=' + o.oner + ' kazanc=' + o.kazanc);
  ok('bolme esigi app.js ile ayni (50)', C.BOLME_MIN_KAZANC === 50, String(C.BOLME_MIN_KAZANC));

  // Esigi gercekten asan durum -> onerilmeli. (Iki yonlu kapi.)
  C.durumAyarla({ sepet: [A, sahteUrun('B', { bim: 230, a101: 60 })] });
  const o2 = C.sepetBolmeOnerisi();
  ok('kazanc esigi asinca bolme ONERILIYOR', o2.oner === true && o2.kazanc >= 50,
     'oner=' + o2.oner + ' kazanc=' + o2.kazanc);
  ok('ikiden fazla markete bolunmuyor', !o2.ikili || o2.ikili.marketler.length === 2,
     o2.ikili ? String(o2.ikili.marketler.length) : 'yok');

  const bf = (ad, fi, gr) => ({ _id: ad, ad: ad, en_dusuk_fiyat: fi, agirlik_hacim: gr,
                                market_fiyatlari: [{ market: 'bim', fiyat: fi }] });
  const isaret = C.enIyiBirimIdleri([bf('ucuz', 10, '1 kg'), bf('pahali', 30, '1 kg')]);
  ok('enIyiBirimIdleri Set donduruyor', isaret instanceof Set, typeof isaret);
  ok('grupta yalniz en ucuz birim fiyat isaretli',
     isaret.has('ucuz') && !isaret.has('pahali'), [...isaret].join(','));
  ok('tek elemanli grupta isaretleme yok',
     C.enIyiBirimIdleri([bf('yalniz', 10, '1 kg')]).size === 0, '');

  C.durumAyarla({ sepet: [] });   // testler arasi sizinti olmasin
}

console.log('\nPASS=' + pass + '  FAIL=' + fail);
process.exit(fail ? 1 : 0);
