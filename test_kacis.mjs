// XSS çıkış kaçışı — B1 PARTİ 1 (S3: localStorage kaynaklı sink'ler) koruması.
// app.js'ten fonksiyon KAYNAĞINI çıkarır; kopya mantık değil.
//
// Kapsam (bu parti): saldırganın DOĞRUDAN kontrol ettiği yollar.
//   S1 (URL/query)  -> ölçümde SIFIR sink (?screen ve ?kat whitelist'li, hiçbir
//                      DOM sink'ine ulaşmıyor) — bu turda kod değişmedi.
//   S3 (localStorage): şablon adı (renderSablonBar, profilSablonlarHTML) ve
//                      sepet (renderSepet: u.ad metin+aria-label, u.resim src).
// S2 (başka kullanıcı) / S4 (dış API: ürün adı, market, görsel) AYRI PARTİ.
//
// Bu depoda iki tuzak, testte de savunuluyor:
//   1) Kaynakta desen ararken önce YORUMLARI SOY (yorum içi ${u.ad} yanlış alarm).
//   2) Çok satırlı birleştirmeleri/şablonları DÜZLEŞTİR (.sablon-chip üç tur atlattı).
// Kullanım: node test_kacis.mjs
import fs from 'fs';
import vm from 'vm';

const APP = fs.readFileSync('app.js', 'utf8');

let pass = 0, fail = 0;
const ok = (ad, k, d = '') => { if (k) { pass++; console.log('  PASS  ' + ad); } else { fail++; console.log('  FAIL  ' + ad + (d ? '  -> ' + d : '')); } };

function fnKaynak(ad) {
  let bas = APP.indexOf('function ' + ad + '(');
  if (bas < 0) return null;
  if (APP.slice(Math.max(0, bas - 6), bas) === 'async ') bas -= 6;
  let dd = 0;
  for (let j = APP.indexOf('{', bas); j < APP.length; j++) {
    const c = APP[j];
    if (c === '{') dd++;
    else if (c === '}') { dd--; if (dd === 0) return APP.slice(bas, j + 1); }
  }
  return null;
}
// Yorumları soy: /*…*/ ve //… (http:// içindeki // korunur: önündeki ':' ile).
const soy = (s) => (s || '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
// Düzleştir: yorumsuz kaynakta tüm boşluğu (satır sonları dahil) tek boşluğa indir.
// Böylece çok satırlı şablon/birleştirme tek satır gibi taranır.
const yass = (s) => soy(s).replace(/\s+/g, ' ');

// ── ortam: _kacir + _guvenliUrl'i gerçek kaynaklarından vm'de kur ──────
const ctx = {};
vm.createContext(ctx);
vm.runInContext([fnKaynak('_kacir'), fnKaynak('_guvenliUrl')].filter(Boolean).join('\n'), ctx);
const _kacir = ctx._kacir, _guvenliUrl = ctx._guvenliUrl;

console.log('\n=== 1. _kacir: beş karakter + & ÇİFT kaçışa gitmiyor ===');
{
  ok('_kacir tanımlı', typeof _kacir === 'function');
  ok('  < kaçırılıyor', _kacir('<x') === '&lt;x');
  ok('  > kaçırılıyor', _kacir('x>') === 'x&gt;');
  ok('  " kaçırılıyor (öznitelik tırnağı)', _kacir('a"b') === 'a&quot;b');
  ok("  ' kaçırılıyor", _kacir("a'b") === 'a&#39;b');
  ok('  & kaçırılıyor', _kacir('a&b') === 'a&amp;b');
  // & ÖNCE çevrilmezse &lt; -> &amp;lt; olurdu; regresyon kapısı:
  ok('  & ÇİFT kaçışa gitmiyor (a&<b -> a&amp;&lt;b)', _kacir('a&<b') === 'a&amp;&lt;b');
  ok('  null/undefined boş dize', _kacir(null) === '' && _kacir(undefined) === '');
}

console.log('\n=== 2. _guvenliUrl: şema beyaz listesi (javascript:/data: REDDEDİLİR) ===');
{
  ok('_guvenliUrl tanımlı', typeof _guvenliUrl === 'function');
  // NEGATİF: tehlikeli şemalar boşa düşmeli
  ok('  javascript: -> boş', _guvenliUrl('javascript:alert(1)') === '');
  ok('  JaVaScRiPt: (harf büyüklüğü) -> boş', _guvenliUrl('JaVaScRiPt:alert(1)') === '');
  ok('  data: -> boş', _guvenliUrl('data:text/html,<script>') === '');
  ok('  vbscript: -> boş', _guvenliUrl('vbscript:msgbox(1)') === '');
  ok('  başta boşluklu javascript: -> boş', _guvenliUrl('  javascript:alert(1)') === '');
  // POZİTİF: meşru URL'ler korunur
  ok('  https korunur', _guvenliUrl('https://cdn.x/a.png') === 'https://cdn.x/a.png');
  ok('  protokol-göreli korunur', _guvenliUrl('//cdn.x/a.png') === '//cdn.x/a.png');
  ok('  köke göreli korunur', _guvenliUrl('/static/x.png') === '/static/x.png');
  // Öznitelik güvenliği: URL içindeki " kaçırılır
  ok('  URL içi " kaçırılıyor', _guvenliUrl('https://x/a".png') === 'https://x/a&quot;.png');
}

console.log('\n=== 3. S3 sink\'leri doğru bağlam yardımcısından geçiyor (kaynak, yorumsuz+düz) ===');
{
  const bar = yass(fnKaynak('renderSablonBar'));
  const prof = yass(fnKaynak('profilSablonlarHTML'));
  const sep = yass(fnKaynak('renderSepet'));

  // renderSablonBar — şablon adı _kacir'den geçiyor, eski ad-hoc kaçış GİTTİ
  ok('renderSablonBar: adSafe = _kacir(_sablonDisplayAd(s.ad)', /adSafe\s*=\s*_kacir\(\s*_sablonDisplayAd\(s\.ad\)/.test(bar), bar.slice(0, 200));
  ok("  eski .replace(/</g,'&lt;').replace(/\"/g,...) kalmadı", !/replace\(\/<\/g,\s*['"]&lt;/.test(bar), bar);

  // profilSablonlarHTML — adSafe _kacir'den, hem metin hem aria-label kapanıyor
  ok('profilSablonlarHTML: adSafe = _kacir(_sablonDisplayAd(s.ad)', /adSafe\s*=\s*_kacir\(\s*_sablonDisplayAd\(s\.ad\)/.test(prof), prof.slice(0, 200));
  ok('  aria-label adSafe kullanıyor', /aria-label="\$\{adSafe\}/.test(prof), prof);
  ok("  eski String(...).replace(/</g,'&lt;') tek kaçışı kalmadı", !/\)\s*\.replace\(\/<\/g,\s*['"]&lt;['"]\)\s*;/.test(prof), prof);

  // renderSepet — u.ad _kacir (metin+aria-label), u.resim _guvenliUrl (src)
  ok('renderSepet: aria-label _kacir(u.ad)', /aria-label="\$\{_kacir\(u\.ad\)\}"/.test(sep), sep.slice(0, 300));
  ok('renderSepet: cart-item-name _kacir(u.ad)', /cart-item-name">\$\{_kacir\(u\.ad\)\}</.test(sep), sep);
  ok('renderSepet: cart-item-sub _kacir(u.agirlik_hacim)', /cart-item-sub">\$\{_kacir\(u\.agirlik_hacim\)\}</.test(sep), sep);
  ok('renderSepet: src _guvenliUrl(u.resim)', /src="\$\{_guvenliUrl\(u\.resim\)\}"/.test(sep), sep);
}

console.log('\n=== 4. TARAMA: yeni KAÇIŞSIZ S3 sink\'i eklenirse kırmızı ===');
// S3 hassas belirteçleri sink şablonuna ÇIPLAK (${...}) girmemeli.
// Yorumları soy + düzleştir; sonra çıplak interpolasyonu ara.
function ciplakVar(kaynakAdi, belirtecRegex) {
  const src = yass(fnKaynak(kaynakAdi));
  return belirtecRegex.test(src);
}
{
  // renderSepet: ham ${u.ad} veya ${u.resim} = yeni kaçışsız sink -> kırmızı
  ok('renderSepet: çıplak ${u.ad} YOK', !ciplakVar('renderSepet', /\$\{u\.ad\}/), 'ham u.ad interpolasyonu bulundu');
  ok('renderSepet: çıplak ${u.resim} YOK', !ciplakVar('renderSepet', /\$\{u\.resim\}/), 'ham u.resim interpolasyonu bulundu');
  ok('renderSepet: çıplak ${u.agirlik_hacim} YOK', !ciplakVar('renderSepet', /cart-item-sub">\$\{u\.agirlik_hacim\}/), 'ham u.agirlik_hacim interpolasyonu bulundu');
  // renderSablonBar / profilSablonlarHTML: şablon adı yalnız adSafe üzerinden;
  // ham _sablonDisplayAd(s.ad) interpolasyonu (kaçışsız) girmemeli.
  ok('renderSablonBar: çıplak ${_sablonDisplayAd(s.ad)} YOK', !ciplakVar('renderSablonBar', /\$\{\s*_sablonDisplayAd\(s\.ad\)/), 'kaçışsız ad interpolasyonu');
  ok('profilSablonlarHTML: çıplak ${_sablonDisplayAd(s.ad)} YOK', !ciplakVar('profilSablonlarHTML', /\$\{\s*_sablonDisplayAd\(s\.ad\)/), 'kaçışsız ad interpolasyonu');
}

console.log('\n=== 5. KANIT: korumayı bilerek boz, tarama KIRMIZIYA dönüyor ===');
{
  // renderSepet kaynağını al, düzeltmeyi geri sar (regresyon taklidi): _kacir(u.ad) -> u.ad
  const gercek = yass(fnKaynak('renderSepet'));
  const bozuk = gercek
    .replace(/\$\{_kacir\(u\.ad\)\}/g, '${u.ad}')
    .replace(/\$\{_guvenliUrl\(u\.resim\)\}/g, '${u.resim}');
  // Gerçekte çıplak yok; bozuk sürümde VAR olmalı -> tarama bunu yakalamalı
  ok('gerçek kaynakta çıplak ${u.ad} yok', !/\$\{u\.ad\}/.test(gercek));
  ok('bozuk kaynakta çıplak ${u.ad} VAR (mutasyon oluştu)', /\$\{u\.ad\}/.test(bozuk));
  ok('bozuk kaynakta çıplak ${u.resim} VAR', /\$\{u\.resim\}/.test(bozuk));
  // Yorum tuzağı kanıtı: yorum içindeki ${u.ad} yanlış alarm ÜRETMEMELİ
  const yorumlu = 'function t(){ /* zararsız yorum: ${u.ad} */ return `<b>${_kacir(u.ad)}</b>`; }';
  ok('yorum içindeki ${u.ad} tarama tarafından SOYULUYOR (yanlış alarm yok)', !/\$\{u\.ad\}/.test(yass(yorumlu)), yass(yorumlu));
}

console.log(`\nPASS=${pass}  FAIL=${fail}`);
process.exit(fail ? 1 : 0);
