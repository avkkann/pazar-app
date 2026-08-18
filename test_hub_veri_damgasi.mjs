// scripts/hub-uret.mjs'teki VERI_DAMGASI DUZELTMESI icin regresyon testi
// (gorev-8). Kusur: damga BUILD ANINI yansitiyordu (anasayfa.json'un
// uretim alani her koşuda "simdi"ye esitleniyordu) -- bu yuzden
// veri_tazelik_kontrol.py --hub kapisinin damga-yasi kontrolu HICBIR ZAMAN
// kirmiziya donemiyordu. Duzeltme: damga artik veri kumesinin KENDI en yeni
// gozlem tarihinden turuyor (gecmis_fiyatlar.json 't' + urunler_*.json
// fiyat_gecmisi max'i).
//
// GERCEK ureticiyi kosturup GOZLEMLIYORUZ (test_hub_zam_pencere.mjs ile
// AYNI desen) -- hub-uret.mjs top-level bir script, disa modul vermiyor.
// AG YOK, data/ altina YAZILMIYOR (yalnizca .hub/ -- build artefaktı,
// .gitignore'da).
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const KOK = path.dirname(fileURLToPath(import.meta.url));

let pass = 0, fail = 0;
const ok = (ad, k, d = '') => { if (k) { pass++; console.log('  PASS  ' + ad); } else { fail++; console.log('  FAIL  ' + ad + (d ? '  -> ' + d : '')); } };

function hubUretCalistir() {
  return execFileSync('node', ['scripts/hub-uret.mjs'], { cwd: KOK, encoding: 'utf8', timeout: 60000 });
}

// ── W3C Datetime deseni -- veri_tazelik_kontrol.py'deki ile AYNI kural ──
const W3C_DATETIME_DESENI = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;

console.log('=== 1. VERI_DAMGASI BUILD ANI DEGIL: IKI KOSU, AYNI VERI -> AYNI DAMGA ===');
console.log('  (hub-uret.mjs iki kez KOŞTURULUYOR, aralarinda gercek zaman geciyor...)');

let stdout1, stdout2;
try {
  stdout1 = hubUretCalistir();
  // Eski (buggy) davranista damga `new Date().toISOString()` gibi saniye/ms
  // hassasiyetindeydi -- iki kosu arasinda EN AZ birkac ms gecmesi yeterliydi
  // farkli damga uretmeye. Burada test ortaminda calisma suresinin (~1-2 sn)
  // KENDISI bu farki dogal olarak saglıyor; ekstra bekleme eklenmiyor.
  stdout2 = hubUretCalistir();
} catch (e) {
  console.log('  FAIL  hub-uret.mjs calistirilamadi -> ' + (e && e.message));
  console.log('\nPASS=0  FAIL=1');
  process.exit(1);
}

const damgaDeseni = /\[hub\] VERI_DAMGASI \(en yeni gozlem\): (\S+) -> (\S+)/;
const m1 = damgaDeseni.exec(stdout1);
const m2 = damgaDeseni.exec(stdout2);
ok('1. kosu VERI_DAMGASI logladi', !!m1, stdout1.slice(0, 300));
ok('2. kosu VERI_DAMGASI logladi', !!m2, stdout2.slice(0, 300));

const [, enYeniGozlem1, veriDamgasi1] = m1 || [];
const [, enYeniGozlem2, veriDamgasi2] = m2 || [];

ok('KAYNAK gozlem tarihi iki kosuda AYNI (veri degismedi)', enYeniGozlem1 === enYeniGozlem2,
  `1.kosu=${enYeniGozlem1}  2.kosu=${enYeniGozlem2}`);
ok('VERI_DAMGASI iki kosuda BIREBIR AYNI -- BUILD ANINDAN turemiyor (regresyon kilidi)',
  veriDamgasi1 === veriDamgasi2, `1.kosu=${veriDamgasi1}  2.kosu=${veriDamgasi2}`);
ok('  damga saniye/ms hassasiyetinde bir "simdi" damgasi DEGIL (gun-duzeyinde, T00:00:00 ile bitiyor)',
  /T00:00:00\+03:00$/.test(veriDamgasi1 || ''), veriDamgasi1);

console.log('\n=== 2. DAMGA VERI KUMESININ EN YENI GOZLEMINDEN TURUYOR (BAGIMSIZ HESAP) ===');
{
  // hub-uret.mjs'in KENDI kodundan BAGIMSIZ, testin kendi icinde ayni
  // kaynaklardan (gecmis_fiyatlar.json + urunler_*.json fiyat_gecmisi) max
  // tarihi yeniden hesaplayip KARSILASTIRIYORUZ -- ayni fonksiyonu tekrar
  // cagirmak degil, ayri bir olcum.
  const gecmis = JSON.parse(fs.readFileSync(path.join(KOK, 'data/gecmis_fiyatlar.json'), 'utf8'));
  let enYeni = null;
  for (const sid of Object.keys(gecmis)) {
    for (const k of gecmis[sid]) {
      if (k && k.t && (!enYeni || k.t > enYeni)) enYeni = k.t;
    }
  }
  const urunlerDosyalari = fs.readdirSync(path.join(KOK, 'data')).filter((f) => f.startsWith('urunler_') && f.endsWith('.json'));
  for (const dosya of urunlerDosyalari) {
    const urunler = JSON.parse(fs.readFileSync(path.join(KOK, 'data', dosya), 'utf8'));
    for (const u of urunler) {
      for (const kayit of u.fiyat_gecmisi || []) {
        const tarih = Array.isArray(kayit) ? kayit[0] : null;
        if (tarih && (!enYeni || tarih > enYeni)) enYeni = tarih;
      }
    }
  }
  ok('bagimsiz hesaplanan en yeni gozlem tarihi bulundu', !!enYeni, String(enYeni));
  ok('hub-uret.mjs log\'undaki kaynak gozlem tarihi, testin BAGIMSIZ hesabiyla AYNI',
    enYeniGozlem1 === enYeni, `hub-uret=${enYeniGozlem1}  bagimsiz=${enYeni}`);
  ok('VERI_DAMGASI, bu tarihin gunDamgasi() bicimiyle BIREBIR eslesiyor',
    veriDamgasi1 === `${enYeni}T00:00:00+03:00`, `veriDamgasi=${veriDamgasi1}  beklenen=${enYeni}T00:00:00+03:00`);
}

console.log('\n=== 3. anasayfa.json URETIM ALANI ARTIK VERI_DAMGASI ICIN KULLANILMIYOR ===');
{
  const anasayfa = JSON.parse(fs.readFileSync(path.join(KOK, 'data/anasayfa.json'), 'utf8'));
  // anasayfa.uretim BUILD ANINA yakin bir zaman damgasi (saniye/ms
  // hassasiyetinde); VERI_DAMGASI artik ondan FARKLI bir bicimde (gun
  // duzeyinde, T00:00:00+03:00 ile biten). Ayni anda bile olsalar bicim
  // (saniye hassasiyeti) FARKLI olmali -- bu, kaynagin degistiginin dolayli
  // kanitidir.
  ok('anasayfa.uretim W3C Datetime (kaynak dogrulamasi icin)', W3C_DATETIME_DESENI.test(anasayfa.uretim), anasayfa.uretim);
  ok('VERI_DAMGASI anasayfa.uretim ile BIREBIR AYNI DEGIL (artik ondan turemiyor)',
    veriDamgasi1 !== anasayfa.uretim, `veriDamgasi=${veriDamgasi1}  anasayfa.uretim=${anasayfa.uretim}`);
}

console.log('\n=== 4. HAL SAYFASI HALA cekme_tarihi KULLANIYOR (bozulmadi) ===');
{
  const manifestYolu = path.join(KOK, '.hub/manifest.json');
  ok('.hub/manifest.json var (son kosudan)', fs.existsSync(manifestYolu), manifestYolu);
  const manifest = JSON.parse(fs.readFileSync(manifestYolu, 'utf8'));

  const hal = JSON.parse(fs.readFileSync(path.join(KOK, 'data/hal.json'), 'utf8'));
  const beklenenHalDamga = hal.cekme_tarihi.replace(' ', 'T') + '+03:00';

  const halKaydi = manifest.find((k) => k.tip === 'hal');
  ok('manifestte tip=hal kaydi var', !!halKaydi, JSON.stringify(manifest.map((k) => k.tip)));
  ok('  hal veri_damgasi hal.json cekme_tarihinden turuyor (aynen)',
    halKaydi && halKaydi.veri_damgasi === beklenenHalDamga,
    `gercek=${halKaydi && halKaydi.veri_damgasi}  beklenen=${beklenenHalDamga}`);
  ok('  hal damgasi W3C Datetime ve +03:00 tasiyor',
    halKaydi && W3C_DATETIME_DESENI.test(halKaydi.veri_damgasi) && halKaydi.veri_damgasi.endsWith('+03:00'),
    halKaydi && halKaydi.veri_damgasi);

  console.log('\n=== 5. TUM zam/market/kategori SAYFALARI AYNI TEK VERI_DAMGASI DEGERINI PAYLASIYOR ===');
  const digerTipler = ['zam', 'market', 'kategori'];
  const uretilenDigerleri = manifest.filter((k) => digerTipler.includes(k.tip) && k.durum === 'uretildi');
  ok('en az bir zam/market/kategori sayfasi uretildi', uretilenDigerleri.length > 0, String(uretilenDigerleri.length));
  const hepsiAyni = uretilenDigerleri.every((k) => k.veri_damgasi === veriDamgasi1);
  ok('  zam/market/kategori sayfalarinin HEPSI ayni VERI_DAMGASI degerini tasiyor (tek kaynak, tek hesap)',
    hepsiAyni, JSON.stringify([...new Set(uretilenDigerleri.map((k) => k.veri_damgasi))]));
  ok('  bu deger W3C Datetime ve +03:00 tasiyor', W3C_DATETIME_DESENI.test(veriDamgasi1) && veriDamgasi1.endsWith('+03:00'), veriDamgasi1);
}

console.log('\nPASS=' + pass + '  FAIL=' + fail);
process.exit(fail ? 1 : 0);
