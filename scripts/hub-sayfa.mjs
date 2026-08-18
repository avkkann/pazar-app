// scripts/hub-sayfa.mjs
// Hub sayfalarinin (zam/market/kategori/hal) SAF cekirdegi: sayfa modelini
// degerlendiren esik mantigi ve yardimci fonksiyonlar. node:fs / node:vm /
// aglama YOK, app.js import EDILMIYOR -- yalnizca veri alip veri donduren
// fonksiyonlar. Test dogrudan import edip cagiriyor (test_hub_uret.mjs).
//
// HTML uretimi (sonraki gorev) ve veriyi okuyup modeli kuran orkestrator
// (ondan sonraki gorev) bu modulun disinda kalir; ikisi de burada tanimlanan sayfa
// modeline ve API'ye baglanir. Alan adlari GOREVLER ARASI ARAYUZ --
// degistirilmemeli.
//
// NEDEN IKI ESIK (satir + kelime): bu sayfalar tablo agirlikli. Sadece
// kelime sayilirsa 142 satirlik bir tablo "ince" gorunur; sadece satir
// sayilirsa bos basliklarla dolu bir iskelet "dolu" gorunur. Ikisi de
// gecmeli.
//
// NEDEN gunDamgasi'nda Date/toISOString YOK: bu projede toISOString().slice(0,10)
// tipi kesme UC KEZ yerel-gun hatasina yol acti; kural artik "tarih kesme
// yasak". Saf dize/sayi islemi hem dogru hem saat diliminden bagimsiz.

export const ESIK_SATIR = 12;
export const ESIK_KELIME = 300;
export const ESIK_AY_BASLANGIC = 3;

// ── slug ──────────────────────────────────────────────────────────────
// Turkce karakterleri ASCII'ye cevirir, alt cizgi/bosluklari tireye
// donusturur. Kategori slug'lari (meyve-sebze, et, sut, gida, icecek,
// temizlik, atistirmalik, dondurulmus) BU FONKSIYONLA TURETILMEZ -- onlar
// app.js'teki KATEGORILER dizisinde zaten yazili ve Gorev 4 oradan okuyacak.
// Bu fonksiyonun onlar icin gorevi tek: kendi kendinin sabit noktasi olmak
// (yani bu sekiz degeri bozmadan geri vermek).
const TURKCE_HARF_HARITASI = {
  ı: 'i', İ: 'i', I: 'i',
  ş: 's', Ş: 's',
  ğ: 'g', Ğ: 'g',
  ü: 'u', Ü: 'u',
  ö: 'o', Ö: 'o',
  ç: 'c', Ç: 'c',
};

export function slug(ham) {
  if (typeof ham !== 'string') throw new Error('[hub-sayfa] slug: dize bekleniyor: ' + JSON.stringify(ham));
  const cevrilmis = ham.split('').map((ch) => (ch in TURKCE_HARF_HARITASI ? TURKCE_HARF_HARITASI[ch] : ch)).join('');
  return cevrilmis
    .toLowerCase()
    .replace(/[_\s]+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

// ── gunDamgasi ────────────────────────────────────────────────────────
// Girdi 'gg.aa.yyyy' (hal bulteni bicimi) ya da 'yyyy-aa-gg'. Cikti W3C
// Datetime: 'yyyy-aa-ggT00:00:00+03:00'. Saf dize islemi -- Date nesnesi
// KULLANILMIYOR. Gecersiz girdide throw eder (sessizce bozuk damga
// uretmek sitemap'i zehirler).
const AY_GUN_SAYILARI_ARTIK_OLMAYAN = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function artikYilMi(yil) {
  return (yil % 4 === 0 && yil % 100 !== 0) || yil % 400 === 0;
}

function ayGunSayisi(yil, ay) {
  if (ay === 2 && artikYilMi(yil)) return 29;
  return AY_GUN_SAYILARI_ARTIK_OLMAYAN[ay - 1];
}

export function gunDamgasi(ham) {
  if (typeof ham !== 'string') throw new Error('[hub-sayfa] gunDamgasi: gecersiz girdi: ' + JSON.stringify(ham));
  const dize = ham.trim();

  let yilStr, ayStr, gunStr;
  const isoEslesme = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dize);
  const halEslesme = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(dize);
  if (isoEslesme) {
    [, yilStr, ayStr, gunStr] = isoEslesme;
  } else if (halEslesme) {
    [, gunStr, ayStr, yilStr] = halEslesme;
  } else {
    throw new Error('[hub-sayfa] gunDamgasi: tanimlanamayan tarih bicimi: ' + JSON.stringify(ham));
  }

  const yil = Number(yilStr);
  const ay = Number(ayStr);
  const gun = Number(gunStr);
  if (ay < 1 || ay > AY_GUN_SAYILARI_ARTIK_OLMAYAN.length) {
    throw new Error('[hub-sayfa] gunDamgasi: gecersiz ay: ' + JSON.stringify(ham));
  }
  if (gun < 1 || gun > ayGunSayisi(yil, ay)) {
    throw new Error('[hub-sayfa] gunDamgasi: gecersiz gun: ' + JSON.stringify(ham));
  }

  return `${yilStr}-${ayStr}-${gunStr}T00:00:00+03:00`;
}

// ── sayiTR ────────────────────────────────────────────────────────────
export function sayiTR(n) {
  return new Intl.NumberFormat('tr-TR').format(n);
}

// ── kirpmaNotu ────────────────────────────────────────────────────────
// Bu proje "sessiz kirpma yok" kuraliyla calisiyor: bir liste kirpiliyorsa
// kac kayittan kacinin gosterildigi sayfanin kendi metninde yazar. `kalip`
// cagiranin yazdigi TAM cumle sablonudur, icinde {toplam} ve/veya
// {gosterilen} yer tutuculari gecer; bu fonksiyon onlari sayiTR'den
// gecirilmis sayilarla degistirir. Sayfaya ozgu soz dizimi (esik var mi,
// "ilk N" mi "en cok N" mi) kalipta, cagiranda kalir -- burada sabitlenmez.
//
// NEDEN sayidan sonra Turkce cekim eki YOK: "ilk 50'si" gibi yapilar sayinin
// okunusuna gore degisir (50->'si, 40->'ı, 30->'u, 20->'si, 10->'u, 100->'ü);
// sabit bir ek sadece bazi sayilar icin doğru cikar. Doğru cozum eki hesaplamak
// degil, eke hic ihtiyac duymayan cumle kurmaktir (orn. "ilk 50 satır
// gösteriliyor"); bu yuzden kaliplar boyle yazilir ve fonksiyon kendisi ek
// uretmez.
//
// Yer tutucusuz kalipta (ne {toplam} ne {gosterilen} varsa) throw edilir:
// sayiyi tasimayan bir kirpma notu "sessiz kirpma yok" kuralinin sessizce
// delinmesi demektir.
export function kirpmaNotu(toplam, gosterilen, kalip) {
  if (typeof kalip !== 'string' || (!kalip.includes('{toplam}') && !kalip.includes('{gosterilen}'))) {
    throw new Error('[hub-sayfa] kirpmaNotu: kalipta {toplam} ya da {gosterilen} yer tutucusu yok: ' + JSON.stringify(kalip));
  }
  if (gosterilen > toplam) {
    throw new Error('[hub-sayfa] kirpmaNotu: gosterilen (' + gosterilen + ') toplamdan (' + toplam + ') buyuk olamaz');
  }
  if (gosterilen >= toplam) return '';

  return kalip
    .replaceAll('{toplam}', sayiTR(toplam))
    .replaceAll('{gosterilen}', sayiTR(gosterilen));
}

// ── ayKarari ──────────────────────────────────────────────────────────
// ay: 'yyyy-aa'. ilkGozlemTarihi: 'yyyy-aa-gg' -- o aydaki ilk gozlemin
// tarihi. Verinin o aydaki ilk gozlemi ayin 1'i + ESIK_AY_BASLANGIC gununu
// GECIYORSA (esit dahil degil, sadece asim) ay temsil edilmiyor demektir.
export function ayKarari(ay, ilkGozlemTarihi) {
  if (typeof ay !== 'string' || !/^\d{4}-\d{2}$/.test(ay)) {
    throw new Error('[hub-sayfa] ayKarari: gecersiz ay: ' + JSON.stringify(ay));
  }
  if (typeof ilkGozlemTarihi !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(ilkGozlemTarihi)) {
    throw new Error('[hub-sayfa] ayKarari: gecersiz ilkGozlemTarihi: ' + JSON.stringify(ilkGozlemTarihi));
  }

  const ayinAyi = ilkGozlemTarihi.slice(0, 7);
  const sinirGunu = 1 + ESIK_AY_BASLANGIC;

  if (ayinAyi !== ay) {
    return {
      uygun: false,
      sebep: `ilk gözlem tarihi (${ilkGozlemTarihi}) ${ay} ayına ait değil`,
    };
  }

  const gun = Number(ilkGozlemTarihi.slice(8, 10));
  if (gun <= sinirGunu) {
    return {
      uygun: true,
      sebep: `${ay} ayında ilk gözlem ayın ${gun}. gününde, eşik ayın 1-${sinirGunu}. günleri arasında`,
    };
  }
  return {
    uygun: false,
    sebep: `${ay} ayında ilk gözlem ayın ${gun}. gününde başlıyor, eşik ayın 1-${sinirGunu}. gününü aşıyor`,
  };
}

// ── sayfaKarari ───────────────────────────────────────────────────────
// satir = tur:'tablo' bolumlerindeki satirlar uzunluklarinin toplami.
// kelime = baslik + ozet + bolum basliklari + metin govdeleri + liste
// ogeleri + tablo hucrelerindeki kelimelerin toplami. Ortak header/footer
// modelde ZATEN YOK, dolayisiyla sayilmiyor. Sutun basliklari (sutunlar)
// da sayilmiyor -- brief'te sayilacaklar arasinda degil.
function kelimeSay(metin) {
  const dize = String(metin == null ? '' : metin).trim();
  if (dize.length === 0) return 0;
  return dize.split(/\s+/).length;
}

export function sayfaKarari(model) {
  const bolumler = Array.isArray(model && model.bolumler) ? model.bolumler : [];

  let satir = 0;
  let kelime = 0;
  kelime += kelimeSay(model && model.baslik);
  kelime += kelimeSay(model && model.ozet);

  for (const bolum of bolumler) {
    kelime += kelimeSay(bolum && bolum.baslik);
    if (bolum && bolum.tur === 'tablo') {
      const satirlar = Array.isArray(bolum.satirlar) ? bolum.satirlar : [];
      satir += satirlar.length;
      for (const satirDizisi of satirlar) {
        for (const hucre of satirDizisi) kelime += kelimeSay(hucre);
      }
    } else if (bolum && bolum.tur === 'metin') {
      kelime += kelimeSay(bolum.metin);
    } else if (bolum && bolum.tur === 'liste') {
      const ogeler = Array.isArray(bolum.ogeler) ? bolum.ogeler : [];
      for (const oge of ogeler) kelime += kelimeSay(oge);
    }
  }

  const satirTamam = satir >= ESIK_SATIR;
  const kelimeTamam = kelime >= ESIK_KELIME;

  if (satirTamam && kelimeTamam) {
    return { durum: 'uretildi', sebep: '', satir, kelime };
  }

  const sebepler = [];
  if (!satirTamam) sebepler.push(`satır eşiği karşılanmadı (${satir} satır, eşik ${ESIK_SATIR})`);
  if (!kelimeTamam) sebepler.push(`kelime eşiği karşılanmadı (${kelime} kelime, eşik ${ESIK_KELIME})`);

  return { durum: 'atlandi', sebep: sebepler.join('; '), satir, kelime };
}

// ── kacir ─────────────────────────────────────────────────────────────
// Projede merkezi bir HTML-kacis fonksiyonu YOK (79 innerHTML kullanimi
// acik borc olarak duruyor -- bkz. teknik borc notlari). Hub tarafi bunu
// bastan dogru yapiyor: modelden gelen HER metin (urun adi, market adi,
// serbest metin) buradan gecmeden HTML'e yazilmiyor. Sira onemli: & once
// kacirilmali, yoksa sonraki kacislarin urettigi '&lt;' gibi diziler
// ikinci kez kacirilip '&amp;lt;' olur.
export function kacir(metin) {
  return String(metin == null ? '' : metin)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

// ── sayfaHTML ─────────────────────────────────────────────────────────
// Model -> tam HTML belgesi. Gorev 2'de sabitlenen model sozlesmesini
// DOGRULAR ve ihlalde throw eder (bozuk sayfayi sessizce yayinlamaktansa
// build kirilsin). Dogrulama gectikten sonra saf dize birlestirmeyle
// belge kurulur -- node:fs/node:vm/ag/app.js YOK, bu modul saf kalmaya
// devam ediyor.
const GECERLI_HUB_TIPLERI = ['zam', 'market', 'kategori', 'hal'];
// W3C Datetime: 'yyyy-aa-ggThh:mm:ss' + ('Z' ya da '+hh:mm'/'-hh:mm').
// Saniye kesirleri de kabul edilir. Bu proje icin gunDamgasi() hep
// '+03:00' ve kaynak veri damgalari genelde 'Z' uretir; ikisi de gecerli.
const W3C_DATETIME_DESENI = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;

function w3cDatetimeMi(deger) {
  return typeof deger === 'string' && W3C_DATETIME_DESENI.test(deger);
}

function sayfaModelDogrula(model) {
  const on = '[hub-sayfa] sayfaHTML: ';
  if (!model || typeof model !== 'object') {
    throw new Error(on + 'model bir nesne olmali: ' + JSON.stringify(model));
  }
  if (!GECERLI_HUB_TIPLERI.includes(model.tip)) {
    throw new Error(on + 'tip gecerli degil (zam|market|kategori|hal bekleniyor): ' + JSON.stringify(model.tip));
  }
  if (typeof model.yol !== 'string' || !model.yol.startsWith('/') || !model.yol.endsWith('/')) {
    throw new Error(on + "yol '/' ile baslayip '/' ile bitmeli: " + JSON.stringify(model.yol));
  }
  if (typeof model.titleEtiketi !== 'string' || model.titleEtiketi.length > 60) {
    throw new Error(on + 'titleEtiketi 60 karakteri asamaz (Google basligi kesiyor): ' +
      JSON.stringify(model.titleEtiketi) + ' (' + (model.titleEtiketi && model.titleEtiketi.length) + ' krk)');
  }
  if (typeof model.aciklama !== 'string' || model.aciklama.length < 140 || model.aciklama.length > 155) {
    throw new Error(on + 'aciklama 140-155 karakter araliginda olmali: ' +
      (model.aciklama && model.aciklama.length) + ' karakter');
  }
  if (!w3cDatetimeMi(model.veriDamgasi)) {
    throw new Error(on + 'veriDamgasi W3C Datetime degil: ' + JSON.stringify(model.veriDamgasi));
  }
  if (!w3cDatetimeMi(model.sonVeri)) {
    throw new Error(on + 'sonVeri W3C Datetime degil: ' + JSON.stringify(model.sonVeri));
  }
  if (!Array.isArray(model.bolumler) || model.bolumler.length === 0) {
    throw new Error(on + 'bolumler bos olamaz');
  }
  const karar = sayfaKarari(model);
  if (karar.durum !== 'uretildi') {
    throw new Error(on + `esik altindaki sayfa HTML'e cevrilmez (${karar.sebep})`);
  }
  return karar;
}

function bolumHTML(bolum) {
  const on = '[hub-sayfa] sayfaHTML: ';
  const baslikHTML = `<h2>${kacir(bolum && bolum.baslik)}</h2>`;
  if (bolum.tur === 'tablo') {
    const sutunlar = Array.isArray(bolum.sutunlar) ? bolum.sutunlar : [];
    const satirlar = Array.isArray(bolum.satirlar) ? bolum.satirlar : [];
    const theadSatir = '<tr>' + sutunlar.map((s) => `<th>${kacir(s)}</th>`).join('') + '</tr>';
    const govdeSatirlari = satirlar
      .map((satir) => '<tr>' + satir.map((hucre) => `<td>${kacir(hucre)}</td>`).join('') + '</tr>')
      .join('');
    const notHTML = bolum.not ? `<p class="kirpma-notu">${kacir(bolum.not)}</p>` : '';
    return `${baslikHTML}\n<div class="tablo-sarmalayici"><table><thead>${theadSatir}</thead><tbody>${govdeSatirlari}</tbody></table></div>\n${notHTML}`;
  }
  if (bolum.tur === 'metin') {
    return `${baslikHTML}\n<p>${kacir(bolum.metin)}</p>`;
  }
  if (bolum.tur === 'liste') {
    const ogeler = Array.isArray(bolum.ogeler) ? bolum.ogeler : [];
    return `${baslikHTML}\n<ul>${ogeler.map((oge) => `<li>${kacir(oge)}</li>`).join('')}</ul>`;
  }
  throw new Error(on + 'bilinmeyen bolum turu: ' + JSON.stringify(bolum && bolum.tur));
}

function linkHTML(link) {
  return `<a href="${kacir(link.yol)}">${kacir(link.metin)}</a>`;
}

// ~2 KB, satir ici. index.html / style.css'teki --primary (#0E4938) ve
// krem (#E8DCC4) paletinden. Dis font/CDN YOK -- sistem yigini.
const HUB_STIL = `
    :root {
      --bg: #F8F9FA; --card-bg: #FFFFFF; --text: #1A1A2E; --text-muted: #6B7280;
      --border: #E5E7EB; --primary: #0E4938; --link: #0E4938; --accent: #E8DCC4;
    }
    @media (prefers-color-scheme: dark) {
      :root {
        --bg: #14181B; --card-bg: #1C2226; --text: #E8DCC4; --text-muted: #9CA3AF;
        --border: #2A3236; --primary: #1D9E75; --link: #4FD8A6; --accent: #E8DCC4;
      }
    }
    * { box-sizing: border-box; }
    body {
      margin: 0; background: var(--bg); color: var(--text);
      font: 16px/1.6 system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
    }
    header, main, footer { max-width: 860px; margin: 0 auto; padding: 16px 20px; }
    header { border-bottom: 1px solid var(--border); }
    header a { color: var(--primary); font-weight: 700; text-decoration: none; font-size: 1.1em; }
    h1 { font-size: 1.6em; line-height: 1.35; margin: 8px 0 12px; }
    h2 { font-size: 1.2em; margin: 28px 0 10px; color: var(--primary); }
    p, li { color: var(--text); }
    .tablo-sarmalayici { overflow-x: auto; border: 1px solid var(--border); border-radius: 8px; }
    table { border-collapse: collapse; width: 100%; min-width: 480px; }
    th, td { text-align: left; padding: 8px 12px; border-bottom: 1px solid var(--border); white-space: nowrap; }
    th { background: var(--accent); color: var(--primary); }
    tbody tr:last-child td { border-bottom: none; }
    .kirpma-notu { color: var(--text-muted); font-size: 0.9em; margin-top: 6px; }
    footer { border-top: 1px solid var(--border); color: var(--text-muted); font-size: 0.95em; }
    footer nav a, footer p a { color: var(--link); }
    footer ul { list-style: none; padding: 0; display: flex; flex-wrap: wrap; gap: 12px 20px; }
`;

export function sayfaHTML(model) {
  const karar = sayfaModelDogrula(model);
  const kanonikYol = 'https://pazarapp.net' + model.yol;
  const ogGorsel = 'https://pazarapp.net/static/og-image.png';

  const bolumlerHTML = model.bolumler.map(bolumHTML).join('\n');
  const icLinkler = Array.isArray(model.icLinkler) ? model.icLinkler : [];
  const icLinklerHTML = icLinkler.length
    ? `<ul>${icLinkler.map((l) => `<li>${linkHTML(l)}</li>`).join('')}</ul>`
    : '';
  const uygulamaLinkiHTML = model.uygulamaLinki ? `<p>${linkHTML(model.uygulamaLinki)}</p>` : '';

  return `<!doctype html>
<html lang="tr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${kacir(model.titleEtiketi)}</title>
  <meta name="description" content="${kacir(model.aciklama)}">
  <link rel="canonical" href="${kanonikYol}">
  <meta property="og:type" content="article">
  <meta property="og:url" content="${kanonikYol}">
  <meta property="og:title" content="${kacir(model.baslik)}">
  <meta property="og:description" content="${kacir(model.aciklama)}">
  <meta property="og:locale" content="tr_TR">
  <meta property="og:site_name" content="Pazar">
  <meta property="og:image" content="${ogGorsel}">
  <meta name="robots" content="index, follow">
  <meta name="pazar-veri-damgasi" content="${kacir(model.veriDamgasi)}">
  <meta name="pazar-hub-tipi" content="${kacir(model.tip)}">
  <meta name="pazar-satir" content="${karar.satir}">
  <style>${HUB_STIL}</style>
</head>
<body>
  <header><a href="/">Pazar</a></header>
  <main>
    <h1>${kacir(model.baslik)}</h1>
    <p>${kacir(model.ozet)}</p>
    ${bolumlerHTML}
  </main>
  <footer>
    <p>Bu sayfa <time datetime="${kacir(model.veriDamgasi)}">${kacir(model.veriDamgasi)}</time> itibarıyla güncel.</p>
    ${uygulamaLinkiHTML}
    ${icLinklerHTML}
  </footer>
</body>
</html>
`;
}
