// KOYU TEMA OKUNURLUGU — secili sekme + giris paneli.
//
// KUSUR 1 (denetim, yuksek): `[data-theme="dark"] .nav-btn.active { color:#0F1A14 }`
// KOK SEVIYEDE yaziliydi. O koyu metin "parlak yesil zemin" icin dogruydu ama
// yesil zemin YALNIZCA >=1024px'te var (.nav-btn.active { background:var(--primary) }
// masaustu blogunda). Telefonda aktif dugmenin zemini yok; buton koyu nav
// cubugunun uzerinde duruyor. OLCULDU (canli, 375px, koyu tema): secili sekme
// yazisi rgb(15,26,20), cubuk zemini rgb(28,40,35) -> KONTRAST 1,17 (gereken
// 4,5). Menunun tek isi olan "buradasin" bilgisi hic okunmuyordu; diger dort
// sekme 6,01 ile net gorunurken secili olan kayboluyordu.
//
// KUSUR 2 (ayni denetim): giris panelinin koyu tema override'i EKSIKTI. OLCULDU
// (canli, koyu tema, panel acik): .auth-sheet__panel beyaz zeminde #E5E7EB
// metin -> 1,24; #auth-email / #auth-password -> 1,24; .auth-divider -> 2,54.
//
// Test SAYISAL: kontrast tokenlardan hesaplanir. KONTROL GRUBU GOMULU --
// once aletin OLCULEN kusur degerlerini (1,17 / 1,24 / 6,01) yeniden uretip
// uretmedigi sinanir; uretemiyorsa asagidaki "gecti"ler hicbir sey kanitlamaz.

import fs from 'node:fs';

const CSS = fs.readFileSync(new URL('./style.css', import.meta.url), 'utf8');
const AA = 4.5;

let GECTI = 0, KALDI = 0;
const ok = (ad, kosul, ipucu = '') => {
  if (kosul) { GECTI++; console.log('  PASS  ' + ad); }
  else { KALDI++; console.log('  FAIL  ' + ad + (ipucu ? '  -> ' + String(ipucu).slice(0, 200) : '')); }
};

// ── kontrast (WCAG 2.x rolatif parlaklik) ────────────────────────────
function rgb(h) {
  h = h.trim().replace('#', '');
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16));
}
function L(hex) {
  return rgb(hex).map(v => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  }).reduce((a, v, i) => a + v * [0.2126, 0.7152, 0.0722][i], 0);
}
function kontrast(a, b) {
  const l1 = L(a), l2 = L(b);
  const [x, y] = l1 > l2 ? [l1, l2] : [l2, l1];
  return +((x + 0.05) / (y + 0.05)).toFixed(2);
}

// ── token haritasi: :root ve [data-theme="dark"] ─────────────────────
function tokenlar(secici) {
  const i = CSS.indexOf(secici + ' {');
  if (i < 0) throw new Error('blok yok: ' + secici);
  const son = CSS.indexOf('\n}', i);
  const govde = CSS.slice(i, son);
  const harita = {};
  for (const m of govde.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) harita[m[1]] = m[2].trim();
  return harita;
}
const KOYU = tokenlar('[data-theme="dark"]');

// var(--x) -> gercek deger (koyu tema)
function coz(deger) {
  const m = /var\((--[\w-]+)\)/.exec(deger);
  return m ? (KOYU[m[1]] || deger) : deger;
}

// ── @media (min-width: 1024px) araliklari (ic ice parantez sayarak) ──
function medyaAraliklari() {
  const araliklar = [];
  const re = /@media \(min-width:\s*1024px\)\s*\{/g;
  let m;
  while ((m = re.exec(CSS))) {
    const bas = CSS.indexOf('{', m.index);
    let d = 0;
    for (let i = bas; i < CSS.length; i++) {
      if (CSS[i] === '{') d++;
      else if (CSS[i] === '}') { d--; if (d === 0) { araliklar.push([m.index, i]); break; } }
    }
  }
  return araliklar;
}
const MASAUSTU = medyaAraliklari();
const masaustundeMi = (i) => MASAUSTU.some(([a, b]) => i > a && i < b);

// Bir seciciye yazilan bildirimin degerini VE kapsamini bul.
// TAM ESLESME SART: `.auth-form input` metni `.auth-form input::placeholder`
// icinde de geciyor; onek eslesmesi yanlis kuraldan deger okurdu.
function kural(secici, ozellik) {
  const bulunan = [];
  let i = 0;
  while ((i = CSS.indexOf(secici, i)) >= 0) {
    const sonrasi = CSS.slice(i + secici.length).match(/^\s*(.)/);
    if (!sonrasi || (sonrasi[1] !== '{' && sonrasi[1] !== ',')) { i += secici.length; continue; }
    const ac = CSS.indexOf('{', i);
    const kapa = CSS.indexOf('}', ac);
    if (ac < 0 || kapa < 0) break;
    const govde = CSS.slice(ac + 1, kapa);
    const m = new RegExp('(?:^|;|\\s)' + ozellik + '\\s*:\\s*([^;}]+)').exec(govde);
    if (m) bulunan.push({ deger: m[1].trim(), masaustu: masaustundeMi(i), konum: i });
    i = kapa;
  }
  return bulunan;
}

// ─────────────────────────────────────────────────────────────────────
console.log('\n=== 1. ALET KONTROLU: OLCULEN kusur degerleri yeniden uretiliyor mu ===');
{
  // Bu bolum gecmezse asagidaki hicbir "gecti" bir sey kanitlamaz.
  ok('secili sekme kusuru: #0F1A14 / #1C2823 = 1,17', kontrast('#0F1A14', '#1C2823') === 1.17,
     String(kontrast('#0F1A14', '#1C2823')));
  ok('  pasif sekme (SAGLAM kontrol): #9CA3AF / #1C2823 = 6,01',
     kontrast('#9CA3AF', '#1C2823') === 6.01, String(kontrast('#9CA3AF', '#1C2823')));
  ok('  giris paneli kusuru: #E5E7EB / #FFFFFF = 1,24', kontrast('#E5E7EB', '#FFFFFF') === 1.24,
     String(kontrast('#E5E7EB', '#FFFFFF')));
  ok('  alet ESIGI dogru uyguluyor (1,17 kaliyor / 6,01 geciyor)',
     kontrast('#0F1A14', '#1C2823') < AA && kontrast('#9CA3AF', '#1C2823') >= AA);
}

console.log('\n=== 2. KOYU TEMA TOKENLARI ===');
{
  for (const t of ['--bg', '--card-bg', '--text', '--text-muted', '--border', '--primary'])
    ok(`${t} koyu temada tanimli`, !!KOYU[t], Object.keys(KOYU).join(','));
}

console.log('\n=== 3. SECILI SEKME: koyu metin YALNIZ masaustunde ===');
{
  const k = kural('[data-theme="dark"] .nav-btn.active', 'color');
  ok('kural bulundu', k.length >= 2, JSON.stringify(k));
  const kok = k.filter(x => !x.masaustu);
  const mas = k.filter(x => x.masaustu);
  ok('  kok seviyede (telefon) bir kural var', kok.length === 1, JSON.stringify(kok));
  ok('  masaustu blogunda bir kural var', mas.length === 1, JSON.stringify(mas));

  // TELEFON: zemin nav cubugu (--card-bg), yesil pill YOK.
  const telefon = coz(kok[0] ? kok[0].deger : '#000');
  const oranTel = kontrast(telefon, KOYU['--card-bg']);
  ok(`  TELEFON okunur: ${telefon} / ${KOYU['--card-bg']} = ${oranTel}`, oranTel >= AA, String(oranTel));

  // MASAUSTU: zemin --primary (yesil pill).
  const masa = coz(mas[0] ? mas[0].deger : '#000');
  const oranMas = kontrast(masa, KOYU['--primary']);
  ok(`  MASAUSTU okunur: ${masa} / ${KOYU['--primary']} = ${oranMas}`, oranMas >= AA, String(oranMas));

  // KILIT: koyu metin kok seviyeye GERI DONMESIN. Kok kuralin degeri
  // masaustu kuralinin degerinden FARKLI olmali; ayni olsalardi telefonda
  // yine koyu-uzerine-koyu olurdu (kusurun tam kendisi).
  ok('  kok ve masaustu degerleri FARKLI (kural geri tasinmamis)',
     telefon.toLowerCase() !== masa.toLowerCase(), telefon + ' vs ' + masa);

  // svg de ayni kapsamda olmali, yoksa ikon kaybolur ama yazi kalir.
  const s = kural('[data-theme="dark"] .nav-btn.active svg', 'stroke');
  ok('  ikon kurali da MASAUSTUNE bagli', s.length === 1 && s[0].masaustu, JSON.stringify(s));
}

console.log('\n=== 4. GIRIS PANELI: koyu tema override VAR ===');
{
  const beklenen = [
    ['[data-theme="dark"] .auth-sheet__panel', 'background', '--card-bg'],
    ['[data-theme="dark"] .auth-sheet__tabs',  'background', '--bg'],
    ['[data-theme="dark"] .auth-sheet__handle','background', '--border'],
  ];
  for (const [sec, oz, token] of beklenen) {
    const k = kural(sec, oz);
    ok(`${sec.replace('[data-theme="dark"] ', '')} koyu zemin aliyor`, k.length >= 1, 'kural yok');
    ok(`  paletten (${token}), ham hex DEGIL`, k.length >= 1 && k[0].deger.includes(token), k.length ? k[0].deger : '-');
  }
}

console.log('\n=== 5. GIRIS PANELI: SAYISAL okunurluk ===');
{
  // Panel govdesindeki metin --text; panel zemini --card-bg.
  const panel = kural('[data-theme="dark"] .auth-sheet__panel', 'background');
  const oranPanel = kontrast(KOYU['--text'], coz(panel[0].deger));
  ok(`panel metni okunur: --text / --card-bg = ${oranPanel} (onceden 1,24)`, oranPanel >= AA, String(oranPanel));

  const inp = kural('[data-theme="dark"] .auth-form input', 'background');
  ok('input koyu zemin aliyor', inp.length >= 1, 'kural yok');
  const inpRenk = kural('[data-theme="dark"] .auth-form input', 'color');
  const oranInp = kontrast(coz(inpRenk[0].deger), coz(inp[0].deger));
  ok(`  input metni okunur: ${oranInp} (onceden 1,24)`, oranInp >= AA, String(oranInp));

  const ph = kural('[data-theme="dark"] .auth-form input::placeholder', 'color');
  const oranPh = kontrast(coz(ph[0].deger), coz(inp[0].deger));
  ok(`  yer tutucu okunur: ${oranPh}`, oranPh >= AA, String(oranPh));

  const g = kural('[data-theme="dark"] .auth-google', 'background');
  const gRenk = kural('[data-theme="dark"] .auth-google', 'color');
  const oranG = kontrast(coz(gRenk[0].deger), coz(g[0].deger));
  ok(`  Google butonu okunur: ${oranG}`, oranG >= AA, String(oranG));

  const bas = kural('[data-theme="dark"] .auth-sheet__title', 'color');
  const panelZemin = coz(panel[0].deger);
  const oranBas = kontrast(bas[0].deger, panelZemin);
  ok(`  baslik okunur: ${bas[0].deger} / ${panelZemin} = ${oranBas}`, oranBas >= AA, String(oranBas));
}

console.log('\n=== 6. #auth-submit BILEREK DOKUNULMADI ===');
{
  // Ilk olcum bu butonu 1,00 gosterdi ve "duzeltilecek" sanildi. ARTEFAKTMIS:
  // buton linear-gradient(135deg,#0F5132,#0E4938) tasiyor ve backgroundColor
  // gradyanlari SAYDAM raporluyor. Uzerindeki beyaz metin gercekte okunur.
  // Buraya bir koyu tema zemini yazmak gradyani EZER ve markayi bozar.
  const s = kural('[data-theme="dark"] .auth-submit', 'background')
    .concat(kural('[data-theme="dark"] #auth-submit', 'background'));
  ok('gonder butonuna koyu tema zemini YAZILMAMIS', s.length === 0, JSON.stringify(s));
  ok('  gradyani duruyor', /#auth-submit|\.auth-submit/.test(CSS) && /linear-gradient\(135deg,\s*#0F5132/i.test(CSS),
     'gradyan bulunamadi');
  // Beyaz metin gradyanin ACIK ucunda bile okunur olmali (en kotu durum).
  ok('  beyaz metin gradyanin acik ucunda okunur', kontrast('#FFFFFF', '#0F5132') >= AA,
     String(kontrast('#FFFFFF', '#0F5132')));
}

console.log('\n=== 7. KOYU TEMA BLOGUNDA ACIK ZEMIN HEX YOK ===');
{
  // Kusur 2'nin kok nedeni: koyu tema kurallarinda acik zemin. Yeniden
  // dogmasin diye auth kurallarinda beyaz/acik gri zemin YASAK.
  const authKurallari = CSS.split('\n').filter(l =>
    /\[data-theme="dark"\][^{]*\.auth/.test(l) || /\[data-theme="dark"\][^{]*#auth/.test(l));
  const acik = authKurallari.filter(l => /background[^;]*(#fff|#FFF|#f8|#F8|#e5e7eb|white)/.test(l));
  ok('koyu tema auth kurallarinda acik zemin yok', acik.length === 0, acik.join(' | '));
  ok('  auth kurali gercekten tarandi (alet kor degil)', authKurallari.length >= 8,
     'bulunan kural satiri: ' + authKurallari.length);
}

console.log('\nPASS=' + GECTI + '  FAIL=' + KALDI);
process.exit(KALDI ? 1 : 0);
