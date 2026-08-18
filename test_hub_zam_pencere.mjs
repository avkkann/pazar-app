// scripts/hub-uret.mjs GERCEKTEN TAKVIM AYI penceresi mi geciyor -- kod
// icinde dize aramiyoruz, GERCEK ureticiyi kosturup stdout'a bastigi
// pencereyi GOZLEMLIYORUZ. hub-uret.mjs top-level bir script (disa modul
// vermiyor), bu yuzden zamOlcutuIc'in aldigi pencereyi yakalamanin en
// dogrudan yolu ureticinin kendi logunu okumak (bkz. hub-uret.mjs:
// "[hub] zam penceresi ..." ve "[hub] BUGUN=..." satirlari).
//
// AG YOK, data/ altina YAZILMIYOR (yalnizca .hub/ -- build artefaktı,
// .gitignore'da). Calisma suresi ~1-2 sn.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const KOK = path.dirname(fileURLToPath(import.meta.url));

let pass = 0, fail = 0;
const ok = (ad, k, d = '') => { if (k) { pass++; console.log('  PASS  ' + ad); } else { fail++; console.log('  FAIL  ' + ad + (d ? '  -> ' + d : '')); } };

console.log('=== hub-uret.mjs GERCEKTEN TAKVIM AYI PENCERESI KULLANIYOR MU ===');
console.log('  (node scripts/hub-uret.mjs kosturuluyor, stdout gozleniyor...)');

let stdout;
try {
  stdout = execFileSync('node', ['scripts/hub-uret.mjs'], { cwd: KOK, encoding: 'utf8', timeout: 60000 });
} catch (e) {
  console.log('  FAIL  hub-uret.mjs calistirilamadi -> ' + (e && e.message));
  console.log('\nPASS=0  FAIL=1');
  process.exit(1);
}

const bugunEslesme = stdout.match(/\[hub\] BUGUN=(\d{4}-\d{2}-\d{2})/);
ok('BUGUN loglaniyor', !!bugunEslesme, stdout.slice(0, 200));
const BUGUN = bugunEslesme ? bugunEslesme[1] : null;

const pencereSatirlari = [...stdout.matchAll(/\[hub\] zam penceresi (\d{4}-\d{2}): (\d{4}-\d{2}-\d{2})\.\.(\d{4}-\d{2}-\d{2}) \((\d+) gün\)/g)];
ok('en az bir zam penceresi loglandi (uretilen ay sayfasi var)', pencereSatirlari.length > 0, stdout.slice(0, 500));

function ayinSonGunu(yil, ay) {
  return new Date(Date.UTC(yil, ay, 0)).getUTCDate();
}

for (const m of pencereSatirlari) {
  const [, ay, pencereBas, pencereSon, gunSayisiStr] = m;
  const gunSayisi = Number(gunSayisiStr);
  const [yilS, ayS] = ay.split('-');
  const yil = Number(yilS), ayNo = Number(ayS);

  ok(`${ay}: pencere basi ayin 1'i (${ay}-01)`, pencereBas === `${ay}-01`, `gercek=${pencereBas}`);

  const buAyBugunMu = BUGUN && BUGUN.slice(0, 7) === ay;
  if (buAyBugunMu) {
    ok(`${ay}: SUREN AY -- pencere sonu BUGUN (${BUGUN}), ayin sonu DEGIL`,
       pencereSon === BUGUN, `gercek=${pencereSon} beklenen=${BUGUN}`);
    const beklenenGun = Number(BUGUN.slice(8, 10));
    ok(`${ay}: gun sayisi bugune kadar (${beklenenGun})`, gunSayisi === beklenenGun, `gercek=${gunSayisi}`);
  } else {
    const sonGun = ayinSonGunu(yil, ayNo);
    const beklenenSon = `${ay}-${String(sonGun).padStart(2, '0')}`;
    ok(`${ay}: TAMAMLANMIS AY -- pencere sonu ayin SON GUNU (${beklenenSon})`,
       pencereSon === beklenenSon, `gercek=${pencereSon}`);
    ok(`${ay}: gun sayisi ayin tam uzunlugu (${sonGun})`, gunSayisi === sonGun, `gercek=${gunSayisi}`);
  }
}

// 2026-06 bu depoda BILINEN bir vaka: ayKarari uygun der ama ay oncesi
// gecmis 30 gunun altinda (7 gun) oldugu icin AYRICA atlanmali -- pencere
// hic loglanmamali (uretilmedi).
const haziranLoglandi = pencereSatirlari.some((m) => m[1] === '2026-06');
ok('2026-06 icin pencere LOGLANMADI (ay oncesi gecmis yetersiz, sayfa uretilmedi)', !haziranLoglandi,
   'pencereSatirlari=' + JSON.stringify(pencereSatirlari.map((m) => m[1])));
ok('  ATLANDI /zam/2026-06/ stdout\'ta gerekceli', /ATLANDI \/zam\/2026-06\/.*ayı öncesinde yalnızca \d+ günlük geçmiş var/.test(stdout),
   stdout.split('\n').filter((l) => l.includes('2026-06')).join(' | '));

console.log('\nPASS=' + pass + '  FAIL=' + fail);
process.exit(fail ? 1 : 0);
