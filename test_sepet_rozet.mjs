// Sepet semasina _sid (additive) + sepet ekraninda rozet koruma testi.
// - _sid iki push noktasina (toggleSepet, firsatSepetEkle) additive yazilir.
// - _sepetSid TEMBEL backfill: eski (_sid'siz) sepet ogesini _id'den cozer ve
//   ogeye YAZAR; urun kataloğdan cikmissa null (rozet cizilmez, ayri dal).
// - renderSepet rozeti CANLI urunden (productMap[u._id]) hesaplar ve CIFT-cache
//   sarti tasir (_gecmisCache && _puanCache) -- _puanCache olmadan supheli/gercek
//   ayirt edilemez, plain indirim sahteyi olumlu etiketlemesin.
// Kullanim: node test_sepet_rozet.mjs
import fs from 'fs';
import vm from 'vm';

const APP = fs.readFileSync('app.js', 'utf8');
let pass = 0, fail = 0;
const ok = (ad, k, d = '') => { if (k) { pass++; console.log('  PASS  ' + ad); } else { fail++; console.log('  FAIL  ' + ad + (d ? '  -> ' + d : '')); } };

function fnKaynak(ad) {
  let bas = APP.indexOf('function ' + ad + '(');
  if (bas < 0) return null;
  let dd = 0;
  for (let j = APP.indexOf('{', bas); j < APP.length; j++) {
    const c = APP[j];
    if (c === '{') dd++;
    else if (c === '}') { dd--; if (dd === 0) return APP.slice(bas, j + 1); }
  }
  return null;
}
// yorumlari soy (satir-yorum ONCE; bu depoda blok-once soyucu 2287 satir gizlemisti)
const soy = (s) => (s || '').replace(/(^|[^:])\/\/[^\n]*/g, '$1').replace(/\/\*[\s\S]*?\*\//g, '');

console.log('\n=== 1. _sid ADDITIVE yaziliyor (iki push noktasi) ===');
{
  const kac = (APP.match(/_id: u\._id, _sid: u\._sid,/g) || []).length;
  ok('toggleSepet + firsatSepetEkle push _sid tasiyor (>=2)', kac >= 2, 'bulunan=' + kac);
}

console.log('\n=== 2. _sepetSid TEMBEL backfill (vm davranis) ===');
{
  const src = fnKaynak('_sepetSid');
  ok('_sepetSid tanimli', !!src, '');
  // vm: stub productMap ile davranisi kosur
  const ctx = { productMap: { 'urun_1': { _sid: 'sid-1' } } };
  vm.createContext(ctx);
  vm.runInContext(src, ctx);
  // (a) zaten _sid varsa onu doner, productMap'e bakmaz
  const a = { _id: 'urun_1', _sid: 'mevcut' };
  ok('  zaten _sid varsa onu doner', ctx._sepetSid(a) === 'mevcut', '');
  // (b) _sid yok, _id productMap'te -> sid doner VE ogeye YAZAR (backfill)
  const b = { _id: 'urun_1' };
  const rb = ctx._sepetSid(b);
  ok('  eski (_sid siz) oge: _id den cozer', rb === 'sid-1', 'donen=' + rb);
  ok('  cozulen _sid ogeye YAZILIR (backfill-write)', b._sid === 'sid-1', 'oge._sid=' + b._sid);
  // (c) _id productMap'te yok (kataloğdan cikti) -> null
  const c = { _id: 'yok_9' };
  ok('  kataloğda yok -> null (rozet cizilmez)', ctx._sepetSid(c) === null, '');
}

console.log('\n=== 3. renderSepet rozeti CANLI urunden + CIFT-cache sarti ===');
{
  const rs = soy(fnKaynak('renderSepet'));
  ok('renderSepet tanimli', !!rs, '');
  // canli urun productMap[u._id] den aliniyor
  ok('  rozet CANLI urunden (productMap[u._id])', /const _canliUrun = productMap\[u\._id\]/.test(rs), '');
  // tek kaynak urunRozetleriHTML, canli urunle cagriliyor
  ok('  tek kaynak urunRozetleriHTML(_canliUrun, true)', /urunRozetleriHTML\(_canliUrun, true\)/.test(rs), '');
  // KRITIK: cift-cache sarti -- _puanCache dusetse supheli/gercek ayirt edilemez
  ok('  cift-cache sarti (_gecmisCache && _puanCache)',
     /_canliUrun && _gecmisCache && _puanCache/.test(rs), rs.slice(0,0));
  // _sid backfill-write cagriliyor
  ok('  _sepetSid(u) cagriliyor (backfill-write)', /_sepetSid\(u\)/.test(rs), '');
  // rozet yoksa element HIC cizilmez (kayma yok) -- kosullu
  ok('  rozet yoksa kap cizilmez (kosullu)', /rozetHTML \? [`'"].*cart-item-rozet/.test(rs), '');
}

ok('KANIT: kasitli kirma — HEMEN geri alinacak (test kapisi ispati)', false, 'beklenen: test job KIRMIZI + deploy SKIPPED');

console.log(`\nPASS=${pass}  FAIL=${fail}`);
process.exit(fail ? 1 : 0);
