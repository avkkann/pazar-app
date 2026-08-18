// scripts/hub-sayfa.mjs icindeki sayfaHTML(model) ve kacir(metin) icin testler.
// Fixture modeller burada elle kuruluyor (test_hub_uret.mjs ile ayni disiplin) --
// gercek data/ altindaki veri OKUNMUYOR. sayfaKarari/sayiTR gibi zaten test
// edilmis yardimcilar burada TEKRAR sinanmiyor, sadece sayfaHTML'in onlari
// dogru CAGIRDIGI (ozellikle pazar-satir meta'si) sinaniyor.
import fs from 'fs';
import { sayfaHTML, kacir, sayfaKarari, sayiTR, ESIK_SATIR, ESIK_KELIME } from './scripts/hub-sayfa.mjs';

let pass = 0, fail = 0;
const ok = (ad, k, d = '') => { if (k) { pass++; console.log('  PASS  ' + ad); } else { fail++; console.log('  FAIL  ' + ad + (d ? '  -> ' + d : '')); } };

// N adet kelime uretir (test_hub_uret.mjs'teki kelimeUret ile ayni desen).
const kelimeUret = (n, kok = 'kelime') => Array.from({ length: n }, (_, i) => kok + i).join(' ');

// Tam olarak `satirSayisi` satirlik bir tablo bolumu.
function tabloBolumu(satirSayisi, kelimePerHucre = 1, baslik = 'Tablo', sutunlar = ['Sutun']) {
  const satirlar = Array.from({ length: satirSayisi }, (_, i) => [kelimeUret(kelimePerHucre, 'h' + i + '_')]);
  return { baslik, tur: 'tablo', sutunlar, satirlar };
}

// Tam olarak `uzunluk` karakter uzunlugunda bir aciklama dizesi uretir
// (140-155 sinirini test etmek icin karakter sayisini elle kontrol edebilmek gerekiyor).
function aciklamaUret(uzunluk) {
  const taban = 'Bu sayfa pazarapp.net icin uretilen bir hub sayfasi aciklamasidir ve test amacli doldurulmus metin icerir, arama motorlarinda gorunecek uzunluktadir. ';
  let s = '';
  while (s.length < uzunluk) s += taban;
  return s.slice(0, uzunluk);
}

// Esikleri rahat asan, tum guard'lardan gecen temel bir model. Testler bunun
// UZERINE tek alan degistirerek (throw testleri) ya da oldugu gibi (pozitif
// testler) calisir.
function gecerliModel(ekAlanlar = {}) {
  return {
    tip: 'kategori',
    yol: '/kategori/sut-kahvalti/',
    baslik: "Süt & Kahvaltı fiyatları",
    titleEtiketi: "Süt & Kahvaltı fiyatları | Pazar",
    aciklama: aciklamaUret(145),
    ozet: kelimeUret(ESIK_KELIME + 50, 'ozet_'),
    veriDamgasi: '2026-08-18T04:16:49Z',
    sonVeri: '2026-08-17T00:00:00+03:00',
    bolumler: [
      tabloBolumu(20, 3, 'Marketler arası fark en yüksek ürünler', ['Ürün', 'En ucuz ₺', 'En pahalı ₺']),
      { ...tabloBolumu(15, 3, 'Son 30 günde zamlananlar', ['Ürün', 'Zirve ₺', 'Son ₺']), not: 'Eşiği geçen ' + sayiTR(200) + ' kayıttan ilk ' + sayiTR(15) + ' satırı gösteriliyor.' },
      { baslik: 'Nasıl okunur', tur: 'metin', metin: kelimeUret(40, 'metin_') },
      { baslik: 'Alt kategoriler', tur: 'liste', ogeler: ['sut', 'yogurt', 'peynir', 'yumurta'] },
    ],
    icLinkler: [
      { yol: '/market/a101/', metin: 'A101' },
      { yol: '/market/bim/', metin: 'BİM' },
      { yol: '/zam/2026-08/', metin: 'Ağustos 2026 zamları' },
      { yol: '/hal/', metin: 'Hal fiyatları' },
    ],
    // Parametre adi 'kat' — app.js'teki rota (ekranRotasiUygula) bu adi okuyor.
    uygulamaLinki: { yol: '/?screen=kategori&kat=sut', metin: 'Uygulamada aç' },
    ...ekAlanlar,
  };
}

console.log('\n=== 1. TEK h1, h2 SIRASI, TH, h3 YOK ===');
{
  const model = gecerliModel();
  const html = sayfaHTML(model);
  const h1Sayisi = (html.match(/<h1[ >]/g) || []).length;
  ok('tam olarak 1 adet <h1>', h1Sayisi === 1, String(h1Sayisi));
  const h2Sayisi = (html.match(/<h2[ >]/g) || []).length;
  ok('h2 sayisi bolum sayisiyla ayni (' + model.bolumler.length + ')', h2Sayisi === model.bolumler.length, String(h2Sayisi));
  ok('<h3 hic yok', !/<h3[ >]/.test(html));
  ok('tablo basliklari <th> ile', /<th>/.test(html));
}

console.log('\n=== 2. GORELI YOL YOK ===');
{
  // Bu test Duzeltme 1'den sonra ikinci savunma hatti: yolDogrula zaten
  // goreli/egik-cizgisiz yollarda throw ediyor, ama tarama genis tutulur
  // (../ dahil) ki baska bir uretim yolu ayni hatayi tekrar actiginda da
  // yakalansin.
  const html = sayfaHTML(gecerliModel());
  ok('href="./ deseni yok', !html.includes('href="./'));
  ok('  src="./ deseni yok', !html.includes('src="./'));
  ok('  href="static/ deseni yok', !html.includes('href="static/'));
  ok('  src="static/ deseni yok', !html.includes('src="static/'));
  ok('  href="../ deseni yok', !html.includes('href="../'));
  ok('  src="../ deseni yok', !html.includes('src="../'));
}

console.log('\n=== 3. pazar-veri-damgasi META W3C DATETIME ===');
{
  const model = gecerliModel();
  const html = sayfaHTML(model);
  const m = /<meta name="pazar-veri-damgasi" content="([^"]*)">/.exec(html);
  ok('meta var', !!m, html.slice(0, 200));
  if (m) {
    ok('degeri modeldeki veriDamgasi ile ayni', m[1] === model.veriDamgasi, m[1]);
    ok('W3C Datetime bicimine uyuyor', /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(Z|[+-]\d{2}:\d{2})$/.test(m[1]), m[1]);
  }
}

console.log('\n=== 4. pazar-satir META sayfaKarari ILE BIREBIR AYNI (IKI FARKLI MODEL) ===');
{
  const modelA = gecerliModel();
  const htmlA = sayfaHTML(modelA);
  const satirA = sayfaKarari(modelA).satir;
  const metaA = /<meta name="pazar-satir" content="([^"]*)">/.exec(htmlA);
  ok('model A: meta var', !!metaA);
  ok('  model A: meta degeri sayfaKarari(model).satir ile ayni', metaA && Number(metaA[1]) === satirA, metaA && metaA[1] + ' vs ' + satirA);

  // Modele bir satir daha ekle (18 satirlik bagimsiz bir tablo bolumu ekliyoruz) --
  // meta SABIT KALMAMALI, degismeli.
  const modelB = gecerliModel();
  modelB.bolumler = [...modelB.bolumler, tabloBolumu(5, 2, 'Ek Tablo')];
  const htmlB = sayfaHTML(modelB);
  const satirB = sayfaKarari(modelB).satir;
  const metaB = /<meta name="pazar-satir" content="([^"]*)">/.exec(htmlB);
  ok('model B: meta degeri sayfaKarari(model).satir ile ayni', metaB && Number(metaB[1]) === satirB, metaB && metaB[1] + ' vs ' + satirB);
  ok('  model B satir sayisi model A dan buyuk (fixture dogru kuruldu)', satirB > satirA, satirA + ' vs ' + satirB);
  ok('  iki modelin meta degerleri FARKLI (sabit sayac degil)', metaA[1] !== metaB[1], metaA[1] + ' vs ' + metaB[1]);
}

console.log('\n=== 5. CANONICAL / og:url MUTLAK, / ILE BITIYOR, AYNI ===');
{
  const model = gecerliModel();
  const html = sayfaHTML(model);
  const canonical = /<link rel="canonical" href="([^"]*)">/.exec(html);
  const ogUrl = /<meta property="og:url" content="([^"]*)">/.exec(html);
  ok('canonical var', !!canonical);
  ok('  canonical https://pazarapp.net ile basliyor', canonical && canonical[1].startsWith('https://pazarapp.net/'), canonical && canonical[1]);
  ok('  canonical / ile bitiyor', canonical && canonical[1].endsWith('/'), canonical && canonical[1]);
  ok('  canonical == https://pazarapp.net + model.yol', canonical && canonical[1] === 'https://pazarapp.net' + model.yol, canonical && canonical[1]);
  ok('og:url var', !!ogUrl);
  ok('  og:url canonical ile AYNI', ogUrl && canonical && ogUrl[1] === canonical[1], ogUrl && ogUrl[1]);
}

console.log('\n=== 6. TITLE <=60, DESCRIPTION 140-155 ===');
{
  const model = gecerliModel();
  const html = sayfaHTML(model);
  const title = /<title>([^<]*)<\/title>/.exec(html);
  ok('title var', !!title);
  ok('  title uzunlugu <= 60', title && title[1].length <= 60, title && String(title[1].length));
  ok('  title icerigi titleEtiketi ile ayni (kacirilmis)', title && title[1] === kacir(model.titleEtiketi), title && title[1]);
  const desc = /<meta name="description" content="([^"]*)">/.exec(html);
  ok('description var', !!desc);
  ok('  description uzunlugu 140-155 arasi', desc && desc[1].length >= 140 && desc[1].length <= 155, desc && String(desc[1].length));
}

console.log('\n=== 7. <script HIC GECMIYOR ===');
{
  const html = sayfaHTML(gecerliModel());
  ok('<script deseni yok', !/<script/i.test(html));
}

console.log('\n=== 8. KACIS: <script> ENJEKSIYONU VE & / " KARAKTERLERI ===');
{
  const model = gecerliModel();
  model.baslik = '<script>alert(1)</script> Ü&M "x" test';
  model.bolumler = [
    { baslik: 'Zehirli Tablo', tur: 'tablo', sutunlar: ['Ürün'], satirlar: [['<script>alert(1)</script>'], ['Ü&M "x" ' + "y'z"]] },
    ...model.bolumler,
  ];
  const html = sayfaHTML(model);
  ok('ham <script>alert(1)</script> YOK', !html.includes('<script>alert(1)</script>'));
  ok('  kacirilmis hali VAR (&lt;script&gt;)', html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
  ok('  & karakteri &amp; olmus', html.includes('Ü&amp;M'));
  ok('  " karakteri &quot; olmus', html.includes('&quot;x&quot;'));
}

console.log("\n=== 9. DOGRULAMA THROW'LARI (madde 8, her ihlal ayri) ===");
{
  const throwEtti = (fn) => { try { fn(); return false; } catch (e) { return true; } };

  ok('gecerli model throw ETMIYOR (kontrol)', !throwEtti(() => sayfaHTML(gecerliModel())));

  ok('yol / ile baslamiyor -> throw', throwEtti(() => sayfaHTML(gecerliModel({ yol: 'kategori/sut/' }))));
  ok('yol / ile bitmiyor -> throw', throwEtti(() => sayfaHTML(gecerliModel({ yol: '/kategori/sut' }))));

  ok('titleEtiketi 60 karakterden uzun -> throw', throwEtti(() => sayfaHTML(gecerliModel({ titleEtiketi: 'x'.repeat(61) }))));

  ok('aciklama 140dan kisa -> throw', throwEtti(() => sayfaHTML(gecerliModel({ aciklama: aciklamaUret(139) }))));
  ok('aciklama 155ten uzun -> throw', throwEtti(() => sayfaHTML(gecerliModel({ aciklama: aciklamaUret(156) }))));

  ok('veriDamgasi W3C Datetime degil -> throw', throwEtti(() => sayfaHTML(gecerliModel({ veriDamgasi: '2026-08-18' }))));
  ok('sonVeri W3C Datetime degil -> throw', throwEtti(() => sayfaHTML(gecerliModel({ sonVeri: 'yarin' }))));

  ok("tip dort degerden biri degil -> throw", throwEtti(() => sayfaHTML(gecerliModel({ tip: 'ilan' }))));

  ok('bolumler bos -> throw', throwEtti(() => sayfaHTML(gecerliModel({ bolumler: [] }))));

  ok('sayfaKarari(model).durum !== uretildi -> throw', throwEtti(() => sayfaHTML(gecerliModel({ bolumler: [tabloBolumu(1, 1)], ozet: 'kisa' }))));
}

console.log('\n=== 10. EN AZ 3 IC LINK, MODELDEKI LINKLERLE BIREBIR (ATLANMIS/UYDURMA LINK YOK) ===');
{
  const model = gecerliModel();
  const html = sayfaHTML(model);
  ok('modelde en az 3 icLink var (fixture kontrolu)', model.icLinkler.length >= 3, String(model.icLinkler.length));
  for (const link of model.icLinkler) {
    ok('  icLink render edildi: ' + link.yol, html.includes(`<a href="${kacir(link.yol)}">${kacir(link.metin)}</a>`));
  }
  const tumHrefler = [...html.matchAll(/<a href="([^"]*)">/g)].map((m) => m[1]);
  const beklenenHrefler = new Set([...model.icLinkler.map((l) => kacir(l.yol)), kacir(model.uygulamaLinki.yol), '/']);
  ok('uretilen her <a href> beklenen kume icinde (uydurma link yok)', tumHrefler.every((h) => beklenenHrefler.has(h)), tumHrefler.join(', '));
  ok('uygulamaLinki render edildi', html.includes(`<a href="${kacir(model.uygulamaLinki.yol)}">${kacir(model.uygulamaLinki.metin)}</a>`));

  const modelSuz = gecerliModel({ uygulamaLinki: null });
  const htmlSuz = sayfaHTML(modelSuz);
  ok('uygulamaLinki null iken throw etmiyor ve crash olmuyor', typeof htmlSuz === 'string' && htmlSuz.length > 0);
}

console.log('\n=== 11. KIRPMA NOTU RENDER EDILIYOR ===');
{
  const model = gecerliModel();
  const html = sayfaHTML(model);
  const notluBolum = model.bolumler.find((b) => b.not);
  ok('fixture da not alanli bir bolum var (kontrol)', !!notluBolum);
  ok('kirpma-notu class li paragraf var ve icerik dogru', html.includes(`<p class="kirpma-notu">${kacir(notluBolum.not)}</p>`));
}

console.log('\n=== 12. pazar-hub-tipi META VE HEADER MARKASI ===');
{
  const model = gecerliModel();
  const html = sayfaHTML(model);
  ok('pazar-hub-tipi meta modeldeki tip ile ayni', html.includes(`<meta name="pazar-hub-tipi" content="${model.tip}">`));
  ok('header Pazar markasi / adresine link', /<header>[\s\S]*<a href="\/">Pazar<\/a>[\s\S]*<\/header>/.test(html));
}

console.log('\n=== 13. hub-sayfa.mjs SAF KALMAYA DEVAM EDIYOR ===');
{
  const kaynakTam = fs.readFileSync('scripts/hub-sayfa.mjs', 'utf8');
  const kodSatirlari = kaynakTam.split('\n').filter((satir) => !/^\s*\/\//.test(satir)).join('\n');
  ok('kod satirlarinda "node:fs" / "node:vm" / aglama YOK (saf modul)',
    !/from ['"](node:)?fs['"]/.test(kodSatirlari) && !/from ['"](node:)?vm['"]/.test(kodSatirlari) &&
    !/require\(/.test(kodSatirlari) && !/fetch\(/.test(kodSatirlari) && !/app\.js/.test(kodSatirlari));
}

console.log('\n=== 14. TABLO HUCRESI: LINK BICIMI RENDER EDILIYOR ===');
{
  const model = gecerliModel();
  model.bolumler = [
    {
      baslik: 'Kategoriler', tur: 'tablo', sutunlar: ['Kategori'],
      satirlar: [
        [{ metin: 'Süt & Kahvaltı', yol: '/kategori/sut/' }],
        ['Duz metin hucre'],
      ],
    },
    ...model.bolumler,
  ];
  const html = sayfaHTML(model);
  ok('link hucresi <td><a href="yol">metin</a></td> olarak render edildi, metin VE yol kacirilmis',
    html.includes(`<td><a href="${kacir('/kategori/sut/')}">${kacir('Süt & Kahvaltı')}</a></td>`));
  ok('  duz metin hucre eski davranisini koruyor (regresyon: <td>metin</td>)',
    html.includes('<td>Duz metin hucre</td>'));

  // Ozel karakterli link hucresiyle kacisi daha net dogrula (& ve " ayri ayri).
  const modelOzel = gecerliModel();
  modelOzel.bolumler = [
    {
      baslik: 'Kategoriler', tur: 'tablo', sutunlar: ['Kategori'],
      satirlar: [[{ metin: 'A & B "x"', yol: '/kategori/a-b/' }]],
    },
    ...modelOzel.bolumler,
  ];
  const htmlOzel = sayfaHTML(modelOzel);
  ok('  link hucresindeki metin kacirildi (& -> &amp;, " -> &quot;), yol degismedi',
    htmlOzel.includes('<td><a href="/kategori/a-b/">A &amp; B &quot;x&quot;</a></td>'));
}

console.log('\n=== 15. TABLO HUCRESI LINK: GECERSIZ YOL -> THROW ===');
{
  const throwEtti = (fn) => { try { fn(); return false; } catch (e) { return true; } };

  const modelBastaEgikCizgiYok = gecerliModel();
  modelBastaEgikCizgiYok.bolumler = [
    { baslik: 'Kategoriler', tur: 'tablo', sutunlar: ['Kategori'], satirlar: [[{ metin: 'Süt', yol: 'kategori/sut/' }]] },
    ...modelBastaEgikCizgiYok.bolumler,
  ];
  ok("link hucresi yolu '/' ile baslamiyor -> throw", throwEtti(() => sayfaHTML(modelBastaEgikCizgiYok)));

  const modelSonEgikCizgiYok = gecerliModel();
  modelSonEgikCizgiYok.bolumler = [
    { baslik: 'Kategoriler', tur: 'tablo', sutunlar: ['Kategori'], satirlar: [[{ metin: 'Süt', yol: '/kategori/sut' }]] },
    ...modelSonEgikCizgiYok.bolumler,
  ];
  ok("link hucresi yolu '/' ile bitmiyor -> throw", throwEtti(() => sayfaHTML(modelSonEgikCizgiYok)));

  ok('gecerli link hucreli model throw ETMIYOR (kontrol)', !throwEtti(() => sayfaHTML(gecerliModel({
    bolumler: [
      { baslik: 'Kategoriler', tur: 'tablo', sutunlar: ['Kategori'], satirlar: [[{ metin: 'Süt', yol: '/kategori/sut/' }]] },
      ...gecerliModel().bolumler,
    ],
  }))));
}

console.log('\n=== 16. IC LINK / UYGULAMA LINKI: GECERSIZ YOL -> THROW (ONEMLI 1) ===');
{
  const throwEtti = (fn) => { try { fn(); return false; } catch (e) { return true; } };

  ok("icLinkler yolu '/' ile baslamiyor -> throw", throwEtti(() => sayfaHTML(gecerliModel({
    icLinkler: [{ yol: 'market/a101/', metin: 'A101' }],
  }))));

  ok("icLinkler yolu sorgu dizesi TASIMADAN '/' ile bitmiyor -> throw", throwEtti(() => sayfaHTML(gecerliModel({
    icLinkler: [{ yol: '/market/a101', metin: 'A101' }],
  }))));

  ok("uygulamaLinki yolu '/' ile baslamiyor -> throw", throwEtti(() => sayfaHTML(gecerliModel({
    uygulamaLinki: { yol: '?screen=kategori', metin: 'Uygulamada aç' },
  }))));

  // Sorgu dizeli uygulamaLinki yolu GECERLI olmali (istisna): '/' ile
  // basliyor, '?' tasiyor, sondaki '/' zorunlu degil.
  ok('sorgu dizeli uygulamaLinki yolu ("/?screen=...") throw ETMIYOR (istisna gecerli)',
    !throwEtti(() => sayfaHTML(gecerliModel({
      uygulamaLinki: { yol: '/?screen=kategori&kat=dondurulmus', metin: 'Uygulamada aç' },
    }))));
  {
    const htmlSorgulu = sayfaHTML(gecerliModel({
      uygulamaLinki: { yol: '/?screen=kategori&kat=dondurulmus', metin: 'Uygulamada aç' },
    }));
    ok('  sorgu dizeli uygulamaLinki dogru kacirilmis halde render edildi',
      htmlSorgulu.includes(`<a href="${kacir('/?screen=kategori&kat=dondurulmus')}">Uygulamada aç</a>`), htmlSorgulu);
  }
}

console.log('\n=== 17. KANONIK/OG:URL KACISI (ONEMLI 2) ===');
{
  const zehirliYol = '/kategori/"><script>alert(1)</script>/';
  const model = gecerliModel({ yol: zehirliYol });
  const html = sayfaHTML(model);
  ok('ham <script>alert(1)</script> canonical/og:url icinde YOK', !html.includes('"><script>alert(1)</script>'));
  ok('  kacirilmis hali canonical href icinde VAR',
    html.includes(`<link rel="canonical" href="${kacir('https://pazarapp.net' + zehirliYol)}">`), html.slice(0, 400));
  ok('  kacirilmis hali og:url content icinde VAR',
    html.includes(`<meta property="og:url" content="${kacir('https://pazarapp.net' + zehirliYol)}">`));
  ok('  <script hic gecmiyor (genel kontrol)', !/<script/i.test(html));
}

console.log('\nPASS=' + pass + '  FAIL=' + fail);
process.exit(fail ? 1 : 0);
