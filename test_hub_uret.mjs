// scripts/hub-sayfa.mjs icin saf fonksiyon testleri. Fixture'lar burada elle
// kuruluyor -- gercek 17 MB veri (data/ altindaki dosyalar) OKUNMUYOR. Bir
// test daha once ilMarketleri().length === 5 diye canli veriye sayi pinlemisti
// ve veri degisince kod degismeden kirmiziya donmustu; o hatayi tekrarlamamak
// icin butun modeller bu dosyada elle kuruluyor.
//
// Esikler TEK YERDE: scripts/hub-sayfa.mjs. Bu test onlari import EDER,
// kendi icinde 12/300/3 degerlerini yeniden yazmaz -- asagida ESIK_SATIR,
// ESIK_KELIME, ESIK_AY_BASLANGIC disinda literal esik sayisi gecmiyor.
import fs from 'fs';
import {
  ESIK_SATIR, ESIK_KELIME, ESIK_AY_BASLANGIC,
  slug, gunDamgasi, sayiTR, kirpmaNotu, ayKarari, sayfaKarari,
} from './scripts/hub-sayfa.mjs';

let pass = 0, fail = 0;
const ok = (ad, k, d = '') => { if (k) { pass++; console.log('  PASS  ' + ad); } else { fail++; console.log('  FAIL  ' + ad + (d ? '  -> ' + d : '')); } };

// N adet kelime uretir, satir/kelime esiklerini elle kontrol etmek icin.
const kelimeUret = (n, kok = 'kelime') => Array.from({ length: n }, (_, i) => kok + i).join(' ');

// Tam olarak `satirSayisi` satirlik bir tablo bolumu, her satirda `kelimePerHucre`
// kelime tasiyan tek hucre. Boylece satir ve kelime sayilari test icinde bagimsiz
// kontrol edilebiliyor.
function tabloBolumu(satirSayisi, kelimePerHucre = 1, baslik = 'Tablo') {
  const satirlar = Array.from({ length: satirSayisi }, (_, i) => [kelimeUret(kelimePerHucre, 'h' + i + '_')]);
  return { baslik, tur: 'tablo', sutunlar: ['Sutun'], satirlar };
}

function temelModel(ekBolumler = [], ekAlanlar = {}) {
  return {
    tip: 'kategori',
    yol: '/kategori/test/',
    baslik: 'Baslik',
    titleEtiketi: 'Baslik | pazarapp.net',
    aciklama: 'Aciklama',
    ozet: 'Ozet',
    veriDamgasi: '2026-08-18T04:16:49Z',
    sonVeri: '2026-08-17T00:00:00+03:00',
    bolumler: ekBolumler,
    icLinkler: [],
    uygulamaLinki: null,
    ...ekAlanlar,
  };
}

console.log('\n=== 1. AY PENCERESI: 2026-05 senaryosu ===');
{
  const r = ayKarari('2026-05', '2026-05-25');
  ok('ayin 1inden gec baslayan veri -> uygun degil', r.uygun === false, JSON.stringify(r));
  ok('  sebep dolu bir Turkce cumle', typeof r.sebep === 'string' && r.sebep.trim().length > 10, r.sebep);

  const sinirIcinde = ayKarari('2026-05', '2026-05-0' + (1 + ESIK_AY_BASLANGIC));
  ok('sinir GUNUNDE (1+ESIK_AY_BASLANGIC) uygun (esit dahil)', sinirIcinde.uygun === true, JSON.stringify(sinirIcinde));
  ok('  sebep dolu', typeof sinirIcinde.sebep === 'string' && sinirIcinde.sebep.trim().length > 0, sinirIcinde.sebep);

  const ilkGun = ayKarari('2026-05', '2026-05-01');
  ok('ayin 1i her zaman uygun', ilkGun.uygun === true, JSON.stringify(ilkGun));
}

console.log('\n=== 2. ESIK ALTI SAYFA URETILMIYOR (satir, sinir dahil) ===');
{
  // Kelime esigini rahat gececek kadar dolgu veriyoruz (ozette), boylece
  // sadece satir esigi test ediliyor.
  const ozetDolgu = kelimeUret(ESIK_KELIME + 50, 'ozet_');

  const altiKapali = temelModel([tabloBolumu(ESIK_SATIR - 1, 1)], { ozet: ozetDolgu });
  const rAlti = sayfaKarari(altiKapali);
  ok('ESIK_SATIR - 1 satir -> atlandi', rAlti.durum === 'atlandi', JSON.stringify(rAlti));
  ok('  sebep dolu ve satir esigini adlandiriyor', rAlti.sebep.length > 0 && /sat[ıi]r/i.test(rAlti.sebep), rAlti.sebep);
  ok('  satir sayisi modelden dogru olculdu', rAlti.satir === ESIK_SATIR - 1, String(rAlti.satir));

  const tamEsik = temelModel([tabloBolumu(ESIK_SATIR, 1)], { ozet: ozetDolgu });
  const rTam = sayfaKarari(tamEsik);
  ok('ESIK_SATIR satir (esit) -> uretildi', rTam.durum === 'uretildi', JSON.stringify(rTam));
  ok('  satir sayisi tam esik', rTam.satir === ESIK_SATIR, String(rTam.satir));
}

console.log('\n=== 3. KELIME ESIGI ORTAK HEADER/FOOTER SAYMIYOR ===');
{
  // Bos tablo (0 satir, satir esigini zaten dusurur) + modelin DISINDA,
  // sayilan alanlara (baslik/ozet/bolum basligi/metin/liste/tablo hucresi)
  // dahil OLMAYAN alanlara konan uzun "footer benzeri" metin. sayfaKarari
  // sadece modelde tanimli alanlari saymali; bu yuzden bu ek alanlar
  // kelime sayisini ETKILEMEMELI.
  const uzunFooterBenzeri = kelimeUret(5000, 'footer_');
  const model = temelModel([{ baslik: 'Bos Tablo', tur: 'tablo', sutunlar: ['S'], satirlar: [] }], {
    ortakFooterMetni: uzunFooterBenzeri,      // modelde tanimli olmayan alan
    ortakHeaderMetni: uzunFooterBenzeri,      // modelde tanimli olmayan alan
  });
  const r = sayfaKarari(model);
  ok('bos tablo -> satir esigi karsilanmadi -> atlandi', r.durum === 'atlandi', JSON.stringify(r));
  ok('  dis alanlardaki 10.000 kelime SAYILMADI (kelime kucuk kaldi)', r.kelime < 100, String(r.kelime));
  ok('  sebep hem satir hem kelime esigini adlandiriyor', /sat[ıi]r/i.test(r.sebep) && /kelime/i.test(r.sebep), r.sebep);
}

console.log('\n=== 4. KIRPMA METNI SATIR SAYISIYLA TUTARLI ===');
{
  const kalip = 'Eşiği geçen {toplam} çiftin ilk {gosterilen} satırı gösteriliyor.';
  const not = kirpmaNotu(2315, 50, kalip);
  ok('yer tutucular sayiTR bicimiyle degisiyor (binlik ayracli)', not.includes(sayiTR(2315)) && not.includes(sayiTR(50)), not);
  ok('  metin ornekteki bicimle eslesiyor', not === `Eşiği geçen ${sayiTR(2315)} çiftin ilk ${sayiTR(50)} satırı gösteriliyor.`, not);
  ok('  sayidan hemen sonra kesme+ek gelmiyor (kusurun tekrarini engelleyen koruma)', !/\d['’]\w/.test(not), not);

  ok('gosterilen === toplam -> bos dize (kirpma yok)', kirpmaNotu(142, 142, kalip) === '', JSON.stringify(kirpmaNotu(142, 142, kalip)));

  ok('gosterilen > toplam -> throw', (() => { try { kirpmaNotu(10, 20, kalip); return false; } catch (e) { return true; } })());

  ok('yer tutucusuz kalip -> throw', (() => { try { kirpmaNotu(10, 5, 'sabit metin, yer tutucu yok'); return false; } catch (e) { return true; } })());

  // model uzerinden: gosterilen sayi tabloya konan satir sayisiyla tutarli olmali
  const gosterilenSatir = 50;
  const toplamAday = 2315;
  const bolum = tabloBolumu(gosterilenSatir, 1, 'Ayin en cok zamlanan urunleri');
  bolum.not = kirpmaNotu(toplamAday, gosterilenSatir, kalip);
  const model = temelModel([bolum], { ozet: kelimeUret(ESIK_KELIME + 10) });
  const r = sayfaKarari(model);
  ok('kirpma notundaki gosterilen sayi modeldeki satir sayisiyla ayni', bolum.not.includes(sayiTR(gosterilenSatir)), bolum.not);
  ok('  bu senaryoda sayfa uretiliyor (esikler asildi)', r.durum === 'uretildi', JSON.stringify(r));
}

console.log('\n=== 5. gunDamgasi: SAF DIZE ISLEMI (TZ BAGIMSIZ) ===');
{
  const eskiTZ = process.env.TZ;
  for (const tz of ['UTC', 'Europe/Istanbul']) {
    process.env.TZ = tz;
    const r1 = gunDamgasi('17.08.2026');
    const r2 = gunDamgasi('2026-08-17');
    ok(`TZ=${tz}: 'gg.aa.yyyy' bicimi dogru cevriliyor`, r1 === '2026-08-17T00:00:00+03:00', r1);
    ok(`TZ=${tz}: 'yyyy-aa-gg' bicimi dogru cevriliyor`, r2 === '2026-08-17T00:00:00+03:00', r2);
  }
  process.env.TZ = eskiTZ;

  ok('gecersiz girdide throw ediyor (bos dize)', (() => { try { gunDamgasi(''); return false; } catch (e) { return true; } })());
  ok('  gecersiz girdide throw ediyor (saçma dize)', (() => { try { gunDamgasi('yarin'); return false; } catch (e) { return true; } })());
  ok('  gecersiz girdide throw ediyor (ay 13)', (() => { try { gunDamgasi('2026-13-01'); return false; } catch (e) { return true; } })());
  ok('  gecersiz girdide throw ediyor (gun 32)', (() => { try { gunDamgasi('32.01.2026'); return false; } catch (e) { return true; } })());
  ok('  gecersiz girdide throw ediyor (null)', (() => { try { gunDamgasi(null); return false; } catch (e) { return true; } })());

  // fonksiyon govdesinde Date/toISOString kullanilmiyor -- saf dize/sayi islemi.
  // Yorum satirlari bu kısıtlamaları ACIKLAMAK icin kelimeleri gecebilir
  // (orn. "neden toISOString kullanilmadi"), o yuzden kontrol KOD satirlari
  // uzerinden yapiliyor (satir basi // ile baslayan yorum satirlari elenir).
  const kaynakTam = fs.readFileSync('scripts/hub-sayfa.mjs', 'utf8');
  const kodSatirlari = kaynakTam.split('\n').filter((satir) => !/^\s*\/\//.test(satir)).join('\n');
  ok('kod satirlarinda "new Date" YOK', !/new Date/.test(kodSatirlari));
  ok('  kod satirlarinda "toISOString" YOK', !/toISOString/.test(kodSatirlari));
  ok('  kod satirlarinda "node:fs" / "node:vm" / aglama YOK (saf modul)',
    !/from ['"](node:)?fs['"]/.test(kodSatirlari) && !/from ['"](node:)?vm['"]/.test(kodSatirlari) &&
    !/require\(/.test(kodSatirlari) && !/fetch\(/.test(kodSatirlari) && !/app\.js/.test(kodSatirlari));
}

console.log('\n=== 6. ESIKLER TEK YERDE TANIMLI ===');
{
  const kaynak = fs.readFileSync('scripts/hub-sayfa.mjs', 'utf8');

  // Esigin elle koda gomulmesi demek, esik degerinin KARSILASTIRMA ya da
  // ATAMA baglaminda literal olarak kullanilmasi demek (orn. `satir >= 12`,
  // `if (gun > 3)`, `const x = 300`). CSS'teki `1.35`, `padding: 3px` ya da
  // metin icindeki bir sayi bu degil -- bu kontrolun amaci "esik degeri
  // koda elle gomulmesin", "bu rakam dosyada gecmesin" degil. Bu yuzden
  // kontrol operator komsulugu arayan bir desenle sinirlaniyor.
  const esikGomulmuMu = (kaynakParcasi, deger) => {
    const desen = new RegExp(`[<>=!]=?=?\\s*\\b${deger}\\b|\\b${deger}\\b\\s*[<>=!]=?=?`, 'g');
    return kaynakParcasi.match(desen) || [];
  };

  const tekYerdeKontrolEt = (isim, deger) => {
    ok(`export const ${isim} tanimi kaynakta var`,
      new RegExp(`export const ${isim}\\s*=\\s*${deger}\\s*;`).test(kaynak));
    const kullanimSayisi = (kaynak.match(new RegExp(`\\b${isim}\\b`, 'g')) || []).length;
    ok(`  ${isim} kod icinde en az bir kez KULLANILIYOR (tanim disinda)`, kullanimSayisi >= 2, String(kullanimSayisi));

    // Tanim satirini disarida birak, kalan kaynakta esik degerinin
    // karsilastirma/atama baglaminda gecip gecmedigine bak.
    const tanimDeseni = new RegExp(`^export const ${isim}\\s*=\\s*${deger}\\s*;\\s*$`, 'm');
    const kalanKaynak = kaynak.replace(tanimDeseni, '');
    const gomulmeler = esikGomulmuMu(kalanKaynak, deger);
    ok(`  ${isim} degeri (${deger}) kod icinde karsilastirma/atama baglaminda GOMULU degil (tanim disinda)`,
      gomulmeler.length === 0, `gomulme(ler): ${gomulmeler.join(', ')}`);
  };
  tekYerdeKontrolEt('ESIK_SATIR', ESIK_SATIR);
  tekYerdeKontrolEt('ESIK_KELIME', ESIK_KELIME);
  tekYerdeKontrolEt('ESIK_AY_BASLANGIC', ESIK_AY_BASLANGIC);

  console.log('\n=== 6b. DARALTILMIS ESIK-LITERAL KONTROLU HALA DIRI (sentetik ornek) ===');
  const sahteKaynakGomulu = 'function sayfaKarari(model) {\n  const satirTamam = satir >= 12;\n  return satirTamam;\n}\n';
  ok('sentetik "satir >= 12" gommesi hala yakalaniyor (kontrol diri)',
    esikGomulmuMu(sahteKaynakGomulu, 12).length > 0, JSON.stringify(esikGomulmuMu(sahteKaynakGomulu, 12)));

  const sahteKaynakAtama = 'function f() {\n  const x = 300;\n  return x;\n}\n';
  ok('  sentetik "const x = 300" atamasi da yakalaniyor',
    esikGomulmuMu(sahteKaynakAtama, 300).length > 0, JSON.stringify(esikGomulmuMu(sahteKaynakAtama, 300)));

  const sahteKaynakTemiz = 'function sayfaKarari(model) {\n  const satirTamam = satir >= ESIK_SATIR;\n  return satirTamam;\n}\n// CSS notu: line-height 1.35, padding: 12px, 12'; // '12' burada karsilastirma/atama baglaminda DEGIL
  ok('  isim uzerinden karsilastirma (ESIK_SATIR) ve ilgisiz CSS/metin sayilari YANLIS POZITIF uretmiyor',
    esikGomulmuMu(sahteKaynakTemiz, 12).length === 0, JSON.stringify(esikGomulmuMu(sahteKaynakTemiz, 12)));
}

console.log('\n=== 7. SLUG URETIMI ===');
{
  ok("tarim_kredi -> tarim-kredi", slug('tarim_kredi') === 'tarim-kredi', slug('tarim_kredi'));
  ok('  bosluk da tireye donusuyor', slug('tarim kredi') === 'tarim-kredi', slug('tarim kredi'));
  ok('  Turkce harfler cevriliyor: ı->i', slug('ıspanak') === 'ispanak', slug('ıspanak'));
  ok('  Turkce harfler cevriliyor: ş->s', slug('şeker') === 'seker', slug('şeker'));
  ok('  Turkce harfler cevriliyor: ğ->g', slug('yağ') === 'yag', slug('yağ'));
  ok('  Turkce harfler cevriliyor: ü->u', slug('süt') === 'sut', slug('süt'));
  ok('  Turkce harfler cevriliyor: ö->o', slug('börek') === 'borek', slug('börek'));
  ok('  Turkce harfler cevriliyor: ç->c', slug('çay') === 'cay', slug('çay'));
  ok('  Turkce harfler cevriliyor: İ->i', slug('İstanbul') === 'istanbul', slug('İstanbul'));

  const KATEGORI_SLUGLARI = ['meyve-sebze', 'et', 'sut', 'gida', 'icecek', 'temizlik', 'atistirmalik', 'dondurulmus'];
  for (const k of KATEGORI_SLUGLARI) {
    ok(`slug('${k}') kendi kendinin sabit noktasi (bozmuyor)`, slug(k) === k, slug(k));
  }
}

console.log('\n=== 8. TABLO HUCRESI LINK BICIMI: sayfaKarari SADECE metin SAYIYOR ===');
{
  // Ayni metin, FARKLI uzunlukta yol tasiyan iki link hucresi + bir duz
  // metin hucresi karsilastirmasi. sayfaKarari kelime sayisi SADECE
  // metin'den gelmeli; yol'un uzunlugu sonucu ETKILEMEMELI.
  const metinIcerik = 'Sut Kahvalti Urunleri';
  const duzMetinBolum = { baslik: 'Kategoriler', tur: 'tablo', sutunlar: ['Kategori'], satirlar: [[metinIcerik]] };
  const kisaYolBolum = { baslik: 'Kategoriler', tur: 'tablo', sutunlar: ['Kategori'], satirlar: [[{ metin: metinIcerik, yol: '/k/' }]] };
  const uzunYolBolum = { baslik: 'Kategoriler', tur: 'tablo', sutunlar: ['Kategori'], satirlar: [[{ metin: metinIcerik, yol: '/kategori/cok-daha-uzun-bir-slug-burada/alt-slug-bile-var/' }]] };

  const ozetDolgu = kelimeUret(ESIK_KELIME + 50, 'ozet_');
  const rDuz = sayfaKarari(temelModel([duzMetinBolum], { ozet: ozetDolgu }));
  const rKisa = sayfaKarari(temelModel([kisaYolBolum], { ozet: ozetDolgu }));
  const rUzun = sayfaKarari(temelModel([uzunYolBolum], { ozet: ozetDolgu }));

  ok('link hucresi crash etmiyor, kelime sayisi duz metin hucresiyle AYNI', rKisa.kelime === rDuz.kelime, `${rKisa.kelime} vs ${rDuz.kelime}`);
  ok('  farkli uzunlukta yol kelime sayisini DEGISTIRMIYOR (sadece metin sayiliyor)', rUzun.kelime === rDuz.kelime, `${rUzun.kelime} vs ${rDuz.kelime}`);
  ok('  satir sayisi da normal sekilde 1 (link hucresi satir sayimini bozmuyor)', rDuz.satir === 1 && rKisa.satir === 1 && rUzun.satir === 1);
}

console.log('\nPASS=' + pass + '  FAIL=' + fail);
process.exit(fail ? 1 : 0);
