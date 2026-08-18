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
