// FIYAT GECMISI GRAFIGI — etiket cakismasi koruma testi.
//
// SIKAYET: "fiyat etiketleri grafikle ve/veya birbiriyle ic ice geciyor,
// okunmuyor."
//
// OLCUM (2026-08-25, CDP + gercek tarayici, getBBox, Inter 9,5px/700;
// SAYIM -- o gun grafik cizen 193 urunun TAMAMI, ornekleme degil). Taban:
//   E-C etiket <-> ortalama cizgisi  144 ornek / 123 grafik (%64)
//   E-E etiket <-> etiket              6   ("149,00 ₺" uzerine "145,00 ₺")
//   E-X etiket <-> y ekseni tick'i     4   ("89,50 ₺" + "93")
//   E-N etiket <-> vurgulu nokta       8
//   X-X tarih  <-> tarih               1   ("20 Ağu" + "23 Ağu")
//   TASMA etiket viewBox disinda       1   (5 haneli fiyat, sentetik)
// Duzeltme sonrasi: E-E=0 E-X=0 X-X=0 TASMA=0, E-N 8->4, E-C hale ile
// okunur (yerlesimle cozulemez, cizginin egimi sinirsiz).
//
// BU TEST NEDEN KAYNAK GREP'I DEGIL: cakisma bir GEOMETRI olayi. "kodda
// su fonksiyon cagriliyor mu" sorusu bug'in yasadigi yeri olcmez. Burada
// gercek app.js vm'de kosturuluyor, gercek katalog verisi besleniyor ve
// URETILEN SVG'nin koordinatlari uzerinden cakisma HESAPLANIYOR.
// (Tarayici olmadigi icin metin genisligi app.js'in KENDI _fgEtiketGenislik
// tahminiyle degil, tarayicida olculmus sabit tabloyla hesaplaniyor --
// yoksa test, olctugu seyin kendisini dogru varsayardi.)
import fs from 'fs';
import vm from 'node:vm';

const APP = fs.readFileSync('app.js', 'utf8');
const CSS = fs.readFileSync('style.css', 'utf8');
let pass = 0, fail = 0;
const ok = (ad, k, d = '') => { if (k) { pass++; console.log('  PASS  ' + ad); } else { fail++; console.log('  FAIL  ' + ad + (d ? '  -> ' + d : '')); } };

function govde(ad, tur = 'function') {
  const anahtar = tur === 'const' ? ('const ' + ad + ' =') : ('function ' + ad + '(');
  const b = APP.indexOf(anahtar);
  if (b < 0) return '';
  if (tur === 'const') {
    let j = APP.indexOf('=', b) + 1;
    while (' \t\n\r'.includes(APP[j])) j++;
    if (APP[j] === '{' || APP[j] === '[') {
      const ac = APP[j], kap = ac === '{' ? '}' : ']';
      let d = 0;
      for (let k = j; k < APP.length; k++) { if (APP[k] === ac) d++; else if (APP[k] === kap) { d--; if (d === 0) return APP.slice(b, k + 1) + ';'; } }
    }
    return APP.slice(b, APP.indexOf('\n', b)) + ';';
  }
  let d = 0;
  for (let j = APP.indexOf('{', b); j < APP.length; j++) {
    if (APP[j] === '{') d++; else if (APP[j] === '}') { d--; if (d === 0) return APP.slice(b, j + 1); }
  }
  return '';
}

// ── Gercek app.js'i vm'de kur ──
const PARCALAR = [
  ['_FG_MKT_AD', 'const'], ['_FG_AYLAR', 'const'],
  ['_FG_ETIKET_UST', 'const'], ['_FG_ETIKET_YUK', 'const'], ['_FG_EKSEN_KAR', 'const'],
  ['_yerelGunISO'], ['_fgTarihFormatla'], ['_fgGunFarki'], ['_veBaglacliListe'],
  ['_fgAsiriDegerBilgisi'], ['_fgEtiketGenislik'], ['_fgKutuCakisiyor'],
  ['_fgEmptyBlock'], ['fiyatGecmisiBlogu'],
];
const eksik = PARCALAR.filter(([a, t]) => !govde(a, t || 'function'));
const kod = PARCALAR.map(([a, t]) => govde(a, t || 'function')).filter(Boolean).join('\n\n');

const gecmis = JSON.parse(fs.readFileSync('data/gecmis_fiyatlar.json', 'utf8'));
const ctx = { _gecmisCache: gecmis, supheliDurum: () => null, console, Date, Math, Object, Set, Array, Number, String, JSON, isNaN, parseFloat, parseInt };
vm.createContext(ctx);
vm.runInContext(kod, ctx);

// ── Tarayicida OLCULMUS metin metrikleri (getBBox/getComputedTextLength).
// Testin app.js'ten BAGIMSIZ olcusu; app.js'in tahmini bunun uzerinde kalmali.
const KAR = { '0': 6.45, '1': 4.15, '2': 6.13, '3': 6.13, '4': 6.45, '5': 6.13, '6': 6.19, '7': 5.72, '8': 6.32, '9': 6.19, ',': 3.19, '.': 3.19, ' ': 2.30, '₺': 6.12 };
const olcGen = m => [...String(m)].reduce((s, c) => s + (KAR[c] !== undefined ? KAR[c] : 6.45), 0);
const ETIKET_YUK = 11.25, ETIKET_UST = 9.39;   // olculdu
const EKSEN_KAR9 = 5.05, EKSEN_YUK = 10.61, EKSEN_UST = 8.57;

function kutulariCikar(svg) {
  const fiyat = [...svg.matchAll(/<text x="([-\d.]+)" y="([-\d.]+)" text-anchor="(\w+)" class="fg-fiyat-etiket">([^<]*)<\/text>/g)]
    .map(m => {
      const x = +m[1], y = +m[2], a = m[3], t = m[4], w = olcGen(t);
      const sol = a === 'start' ? x : a === 'end' ? x - w : x - w / 2;
      return { tur: 'fiyat', metin: t, left: sol, right: sol + w, top: y - ETIKET_UST, bottom: y - ETIKET_UST + ETIKET_YUK };
    });
  const eksen = [...svg.matchAll(/<text x="([-\d.]+)" y="([-\d.]+)" text-anchor="(\w+)" class="fg-axis-label">([^<]*)<\/text>/g)]
    .map(m => {
      const x = +m[1], y = +m[2], a = m[3], t = m[4], w = t.length * EKSEN_KAR9;
      const sol = a === 'start' ? x : a === 'end' ? x - w : x - w / 2;
      return { tur: 'eksen', metin: t, left: sol, right: sol + w, top: y - EKSEN_UST, bottom: y - EKSEN_UST + EKSEN_YUK };
    });
  const vurgu = [...svg.matchAll(/<circle cx="([-\d.]+)" cy="([-\d.]+)" r="([\d.]+)" class="fg-point fg-point-vurgu"\/>/g)]
    .map(m => ({ cx: +m[1], cy: +m[2], r: +m[3] }));
  return { fiyat, eksen, vurgu };
}
const kesis = (a, b) => !(a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top);

function cakismaSay(html) {
  const svg = (html.match(/<svg[\s\S]*<\/svg>/) || [''])[0];
  if (!svg) return null;
  const { fiyat, eksen, vurgu } = kutulariCikar(svg);
  let ee = 0, ex = 0, en = 0, xx = 0, tasma = 0;
  const ayrinti = [];
  for (let i = 0; i < fiyat.length; i++) {
    for (let j = i + 1; j < fiyat.length; j++) if (kesis(fiyat[i], fiyat[j])) { ee++; ayrinti.push('E-E ' + fiyat[i].metin + '|' + fiyat[j].metin); }
    for (const x of eksen) if (kesis(fiyat[i], x)) { ex++; ayrinti.push('E-X ' + fiyat[i].metin + '|' + x.metin); }
    for (const p of vurgu) if (kesis(fiyat[i], { left: p.cx - p.r, right: p.cx + p.r, top: p.cy - p.r, bottom: p.cy + p.r })) { en++; break; }
    if (fiyat[i].left < -0.01 || fiyat[i].right > 320.01 || fiyat[i].top < -0.01 || fiyat[i].bottom > 180.01) { tasma++; ayrinti.push('TASMA ' + fiyat[i].metin); }
  }
  for (let i = 0; i < eksen.length; i++) for (let j = i + 1; j < eksen.length; j++) if (kesis(eksen[i], eksen[j])) { xx++; ayrinti.push('X-X ' + eksen[i].metin + '|' + eksen[j].metin); }
  return { ee, ex, en, xx, tasma, fiyatSayi: fiyat.length, eksenSayi: eksen.length, ayrinti };
}

console.log('\n=== 0. VM KURULUMU (testin kendi kontrol grubu) ===');
ok('gerekli parcalarin hepsi app.js\'te bulundu', eksik.length === 0, eksik.map(e => e[0]).join(','));
ok('fiyatGecmisiBlogu vm\'de calisiyor', typeof ctx.fiyatGecmisiBlogu === 'function');
// Olcum aleti bozuksa "hic cakisma yok" der ve test SESSIZCE yesil kalir.
// Bu yuzden aletin cakismayi GORDUGU sentetik bir vaka zorunlu.
{
  const sahte = '<svg><text x="50" y="50" text-anchor="middle" class="fg-fiyat-etiket">100,00 ₺</text>'
    + '<text x="52" y="52" text-anchor="middle" class="fg-fiyat-etiket">200,00 ₺</text></svg>';
  const s = cakismaSay(sahte);
  ok('ALET KONTROLU: ustuste iki etiket cakisma olarak sayiliyor', s && s.ee === 1, JSON.stringify(s));
  const ayrik = '<svg><text x="40" y="30" text-anchor="middle" class="fg-fiyat-etiket">100,00 ₺</text>'
    + '<text x="260" y="150" text-anchor="middle" class="fg-fiyat-etiket">200,00 ₺</text></svg>';
  ok('ALET KONTROLU: ayrik iki etiket cakisma SAYILMIYOR', cakismaSay(ayrik).ee === 0);
}

// ── Gercek katalog uzerinde sayim ──
const _d = new Date(); _d.setDate(_d.getDate() - 30);
const LIM = _d.getFullYear() + '-' + String(_d.getMonth() + 1).padStart(2, '0') + '-' + String(_d.getDate()).padStart(2, '0');
const adaylar = [];
for (const sid of Object.keys(gecmis)) {
  const a = gecmis[sid];
  if (!Array.isArray(a)) continue;
  const gun = new Set(a.filter(x => x && x.t && x.f != null && x.m && x.t >= LIM).map(x => x.t)).size;
  adaylar.push({ sid, gun });
}
const grafikler = [];
const bosBloklar = [];
for (const u of adaylar) {
  let html = '';
  try { html = ctx.fiyatGecmisiBlogu({ _sid: u.sid }); } catch (e) { html = 'HATA:' + e.message; }
  if (html.includes('<svg')) grafikler.push({ ...u, html });
  else if (html.includes('fg-empty')) bosBloklar.push({ ...u, html });
}

console.log('\n=== 1. GERCEK KATALOG: SIFIR ETIKET CAKISMASI ===');
ok('grafik cizen urun bulundu (test anlamli)', grafikler.length >= 20, 'grafik=' + grafikler.length);
const olcumler = grafikler.map(g => ({ sid: g.sid, gun: g.gun, s: cakismaSay(g.html) }));
const top = k => olcumler.reduce((a, b) => a + b.s[k], 0);
const kotu = k => olcumler.filter(o => o.s[k] > 0).slice(0, 3).map(o => o.sid + ' ' + o.s.ayrinti.join(';')).join(' || ');
ok('E-E: hicbir fiyat etiketi bir digerinin uzerine binmiyor', top('ee') === 0, kotu('ee'));
ok('E-X: hicbir fiyat etiketi eksen etiketine binmiyor', top('ex') === 0, kotu('ex'));
ok('X-X: hicbir eksen etiketi digerine binmiyor', top('xx') === 0, kotu('xx'));
ok('TASMA: hicbir etiket viewBox disina tasmiyor', top('tasma') === 0, kotu('tasma'));

console.log('\n=== 2. BILGI KAYBI YOK (cakismayi etiketi silerek cozmek YASAK) ===');
// Cakismayi "etiketleri hic cizme" ile de sifirlamak mumkun -- o bir cozum
// degil, bilgiyi atmak olurdu. Bu yuzden etiketlerin GERCEKTEN cizildigi
// ayrica sart kosuluyor.
const etiketsiz = olcumler.filter(o => o.s.fiyatSayi === 0);
ok('her grafikte en az bir fiyat etiketi var', etiketsiz.length === 0, etiketsiz.slice(0, 3).map(o => o.sid).join(','));
const azEtiket = olcumler.filter(o => o.s.fiyatSayi < 2);
ok('grafiklerin ezici cogunlugunda >=2 fiyat etiketi', azEtiket.length === 0, azEtiket.slice(0, 3).map(o => o.sid).join(','));
// ASIL KILIT — SESSIZ ETIKET DUSMESI.
// Yerlesim kodunda "iki dikey konum da doluysa etiketi hic cizme" dali var.
// Bu dal bugun gercek veride HIC calismiyor (olculdu) ama calismaya baslarsa
// kullanici bir fiyati sessizce kaybeder ve kimse fark etmez. Vurgulu nokta
// hep ciziliyor, yani "kac gun one cikarildi" veriden okunabilen bir sayi:
// yazilan etiket sayisi ona ESIT olmali.
// (Bu iddia harness'ta 2. bozmayi -- dikey alternatif konumun kaldirilmasi --
// yakalamak icin eklendi; onsuz o mutasyon YESIL kaliyordu.)
const dusen = grafikler.map(g => ({
  sid: g.sid,
  et: (g.html.match(/fg-fiyat-etiket/g) || []).length,
  vu: (g.html.match(/fg-point-vurgu/g) || []).length,
})).filter(x => x.et !== x.vu);
ok('SESSIZ DUSME YOK: etiket sayisi = vurgulu nokta sayisi (her grafikte)',
  dusen.length === 0, dusen.slice(0, 4).map(x => x.sid + ' etiket=' + x.et + ' vurgu=' + x.vu).join(' || '));
const azEksen = olcumler.filter(o => o.s.eksenSayi < 5);
ok('her grafikte >=5 eksen etiketi (3 y + en az 2 tarih)', azEksen.length === 0, azEksen.slice(0, 3).map(o => o.sid + ':' + o.s.eksenSayi).join(','));
// Kose tarihleri eksenin sinirini soyler -- orta tarih dusebilir, bunlar ASLA.
const kose = grafikler.filter(g => {
  const t = [...g.html.matchAll(/class="fg-axis-label">([^<]*)</g)].map(m => m[1]);
  const tarih = t.filter(x => /[A-Za-zÇĞİÖŞÜçğıöşü]/.test(x));
  return tarih.length < 2;
});
ok('ilk ve son tarih HER grafikte duruyor', kose.length === 0, kose.slice(0, 3).map(g => g.sid).join(','));

console.log('\n=== 3. KONTROL GRUBU: AZ NOKTALI URUNDE GRAFIK YOK ===');
// Sikayetin "az noktali urunde ne oluyor" ayagi. Grafik 7 farkli tarih
// esigi altinda HIC cizilmemeli -- ve bunun sebebi kullaniciya yazilmali.
const tek = bosBloklar.filter(b => b.gun <= 1);
const azNokta = bosBloklar.filter(b => b.gun >= 2 && b.gun <= 6);
ok('tek noktali urun var (kontrol grubu anlamli)', tek.length > 0, 'tek=' + tek.length);
ok('tek noktali urunde SVG hic cizilmiyor', tek.every(b => !b.html.includes('<svg')));
ok('2-6 noktali urunde de SVG cizilmiyor', azNokta.length > 0 && azNokta.every(b => !b.html.includes('<svg')), 'n=' + azNokta.length);
ok('bos blok sebebi sessiz degil, metinle soyleniyor',
  tek.concat(azNokta).every(b => /fg-empty">[^<]{10,}</.test(b.html)));
ok('grafik cizen her urunun 7+ farkli tarihi var', grafikler.every(g => g.gun >= 7), (grafikler.find(g => g.gun < 7) || {}).sid);

console.log('\n=== 4. NOKTA SAYISINDAN BAGIMSIZLIK (sentetik uc durum) ===');
// Gercek veride 30 gunluk penceredeki tavan 18 gun. Cozumun "50'de duzeldi"
// olmadigini gostermek icin YAPISAL tavan (31 gun) ve 7 market/gun (217 ham
// kayit) sentetik olarak zorlanıyor. Cizgideki nokta = farkli GUN oldugu icin
// 31 bu grafigin ulasabilecegi en yuksek yogunluk.
const gunISO = n => { const d = new Date(); d.setDate(d.getDate() - n); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
const MKT = ['a101', 'bim', 'migros', 'carrefour', 'sok', 'tarim_kredi', 'hakmar'];
function sentetik(ad, gunSayi, fn, marketSayi, gunSec) {
  const k = [];
  for (let i = 0; i < gunSayi; i++) {
    const g = gunSec ? gunSec(i) : (29 - Math.floor(i * 29 / Math.max(1, gunSayi - 1)));
    for (let m = 0; m < marketSayi; m++) k.push({ t: gunISO(g), m: MKT[m % MKT.length], f: fn(i, gunSayi, m) });
  }
  ctx._gecmisCache[ad] = k;
  return { ad, gun: new Set(k.map(x => x.t)).size, kayit: k.length };
}
const UC = [
  sentetik('__t_tavan31', 31, i => 100 + 40 * Math.sin(i * 1.7), 7, i => 30 - i),
  sentetik('__t_testere', 31, i => (i % 2 ? 100 : 128), 7, i => 30 - i),          // maksimum yerel egim
  sentetik('__t_uzunsayi', 31, i => 88888 + (i % 2 ? 8888.80 : 0), 3, i => 30 - i), // en genis etiket metni
  sentetik('__t_yakinfiyat', 12, (i, n) => (i === 0 ? 1000.10 : i === n - 1 ? 1000.20 : i === 5 ? 1000.00 : i === 6 ? 1000.50 : 1000.30), 2),
  sentetik('__t_tarihkumeli', 10, i => 60 + i * 3, 2, i => (i < 8 ? 30 - i : 2 - (i - 8))),
  sentetik('__t_esik7', 7, (i, n, m) => (i === 0 ? 500 : i === n - 1 ? 520 : i === 3 ? 480 : i === 4 ? 560 : 530) + m, 7),
];
let ucGrafik = 0;
for (const u of UC) {
  const html = ctx.fiyatGecmisiBlogu({ _sid: u.ad });
  const s = cakismaSay(html);
  if (!s) { ok('uc durum ' + u.ad + ' grafik cizdi', false, 'grafik cizilmedi (' + u.gun + ' gun)'); continue; }
  ucGrafik++;
  ok(u.ad + ' (' + u.gun + ' gun / ' + u.kayit + ' kayit): E-E+E-X+X-X+TASMA = 0',
    s.ee + s.ex + s.xx + s.tasma === 0, JSON.stringify(s.ayrinti));
  ok('  ' + u.ad + ': etiket sessizce dusmedi',
    (html.match(/fg-fiyat-etiket/g) || []).length === (html.match(/fg-point-vurgu/g) || []).length,
    'etiket=' + (html.match(/fg-fiyat-etiket/g) || []).length + ' vurgu=' + (html.match(/fg-point-vurgu/g) || []).length);
}
ok('uc durumlarin cogu gercekten grafik cizdi', ucGrafik >= 5, 'cizen=' + ucGrafik);
// 31 gunluk seri gercekten 31 nokta ciziyor mu (senaryo bosa gitmesin)
{
  const html = ctx.fiyatGecmisiBlogu({ _sid: '__t_tavan31' });
  const nokta = (html.match(/class="fg-point/g) || []).length;
  ok('yapisal tavan senaryosu 31 nokta ciziyor', nokta === 31, 'nokta=' + nokta);
  ok('yapisal tavanda fiyat etiketi sayisi yine <= 4 (is nokta sayisindan bagimsiz)',
    (html.match(/fg-fiyat-etiket/g) || []).length <= 4);
}

console.log('\n=== 5. GRAFIK KUTUSU DEGISMEDI (detay yerlesimi kilidi) ===');
// Sikayet okunabilirlikti; kutuyu buyutmek yerlesimi bozardi.
const ornek = grafikler[0].html;
ok('viewBox hala 0 0 320 180', /viewBox="0 0 320 180"/.test(ornek), (ornek.match(/viewBox="[^"]*"/) || [])[0]);
ok('preserveAspectRatio korundu (olcek tek parca)', /preserveAspectRatio="xMidYMid meet"/.test(ornek));
ok('CSS: .fg-svg genislik %100 / yukseklik auto', /\.fg-svg\s*\{[^}]*width:\s*100%[^}]*height:\s*auto/.test(CSS));
ok('grafiklerin hepsi ayni viewBox\'i kullaniyor',
  grafikler.every(g => g.html.includes('viewBox="0 0 320 180"')));

console.log('\n=== 6. HALE (etiket <-> cizgi okunabilirligi) ===');
// E-C sinifi yerlesimle cozulemez; cozum CSS'te hale. Hale sessizce
// kaybolursa 123 grafikte rakamlar yine cizgiyle kaynasir.
const haleKural = (CSS.match(/\.fg-svg\s+\.fg-fiyat-etiket\s*\{[^}]*paint-order[^}]*\}/) || [''])[0];
ok('hale kurali var (paint-order)', !!haleKural, 'bulunamadi');
ok('paint-order: stroke ONCE (yoksa kontur metnin USTUNE biner, rakami inceltir)',
  /paint-order:\s*stroke/.test(haleKural), haleKural);
ok('hale rengi var(--bg) — grafigin arkasindaki GERCEK zemin .screen\'in zemini (olculdu: acik rgb(248,249,250) / koyu rgb(15,26,20)); var(--card-bg) YANLIS olurdu',
  /stroke:\s*var\(--bg\)/.test(haleKural), haleKural);
ok('hale kalinligi metni cizgiden ayiracak kadar (>=2px)',
  (+(/stroke-width:\s*([\d.]+)px/.exec(haleKural) || [0, 0])[1]) >= 2, haleKural);
ok('stroke-linejoin: round (kose sivrileri rakami kirpmasin)', /stroke-linejoin:\s*round/.test(haleKural));

console.log('\n=== 7. SATIR ICI STIL / HANDLER YASAGI (CSP + 19 kilidi) ===');
const fgKod = govde('fiyatGecmisiBlogu');
ok('grafik uretiminde satir ici style= yok (style-src \'self\')',
  !/\sstyle="/.test(fgKod), (fgKod.match(/.{0,60}style=".{0,40}/) || [])[0]);
ok('grafik uretiminde satir ici olay ozniteligi yok (script-src kilidi)',
  !/\son(click|error|load|keydown|mouse\w+)=/i.test(fgKod));

console.log('\n=== 8. TAHMIN GUVENLI YONDE (asla eksik olcmemeli) ===');
// _fgEtiketGenislik gercek genisligi ASLA kucuk tahmin etmemeli: kucuk
// tahmin = "cakismiyor" deyip cakismasina izin vermek.
{
  const ornekler = ['0,00 ₺', '1,11 ₺', '99,90 ₺', '103,95 ₺', '1234,56 ₺', '88888,00 ₺', '97776,80 ₺', '149,00 ₺', '7,77 ₺'];
  const eksikTahmin = ornekler.filter(m => ctx._fgEtiketGenislik(m) < olcGen(m) - 0.01);
  ok('tahmin hicbir ornekte gercek genisligin ALTINDA degil', eksikTahmin.length === 0,
    eksikTahmin.map(m => m + ' tahmin=' + ctx._fgEtiketGenislik(m).toFixed(2) + ' gercek=' + olcGen(m).toFixed(2)).join(', '));
  const sapma = ornekler.map(m => ctx._fgEtiketGenislik(m) - olcGen(m));
  ok('fazla tahmin makul (en fazla +12 birim)', Math.max(...sapma) <= 12, 'max sapma=' + Math.max(...sapma).toFixed(2));
  // Kontrol grubu: olcGen ile _fgEtiketGenislik AYNI fonksiyon olmasin
  ok('KONTROL: iki olcu birbirinden bagimsiz (birebir ayni degil)',
    sapma.some(s => Math.abs(s) > 0.01), 'tum sapmalar sifir -> test kendi kendini olcuyor');
}
ok('_fgKutuCakisiyor: ayrik kutulara false',
  ctx._fgKutuCakisiyor({ x: 0, y: 0, w: 10, h: 10 }, { x: 20, y: 20, w: 10, h: 10 }) === false);
ok('_fgKutuCakisiyor: kesisen kutulara true',
  ctx._fgKutuCakisiyor({ x: 0, y: 0, w: 10, h: 10 }, { x: 5, y: 5, w: 10, h: 10 }) === true);
ok('_fgKutuCakisiyor: sadece degen kenar cakisma SAYILMAZ',
  ctx._fgKutuCakisiyor({ x: 0, y: 0, w: 10, h: 10 }, { x: 10, y: 0, w: 10, h: 10 }) === false);

console.log('\nSONUC: PASS=' + pass + ' FAIL=' + fail);
if (fail > 0) process.exit(1);
