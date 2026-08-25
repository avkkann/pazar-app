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
// const NAME = (arg) => { ... } biçimli ok fonksiyonlarının kaynağı (ör. _cmpItemHTML)
function arrowKaynak(ad) {
  const m = 'const ' + ad + ' = (it) => {';
  let b = APP.indexOf(m);
  if (b < 0) return null;
  let dd = 0;
  for (let j = APP.indexOf('{', b); j < APP.length; j++) {
    const c = APP[j];
    if (c === '{') dd++;
    else if (c === '}') { dd--; if (dd === 0) return APP.slice(b, j + 1); }
  }
  return null;
}
// Yorumları soy: /*…*/ ve //… (http:// içindeki // korunur: önündeki ':' ile).
// Satır yorumlarını ÖNCE soy: bir `//` yorumu içindeki `/*` (örn. yol `cat/*.png`)
// blok-soyucu önce çalışırsa sahte blok başı sanılıp sonraki `*/`'e kadar GERÇEK
// kodu siler (bu depoda yaşandı). `://` URL'leri `[^:]` ile korunur.
const soy = (s) => (s || '').replace(/(^|[^:])\/\/[^\n]*/g, '$1').replace(/\/\*[\s\S]*?\*\//g, '');
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
  // 2026-08-24: gramaj artik .cart-item-satir2 icinde ve KOSULSUZ basiliyor
  // (satir her zaman var, rozet asenkron gelince kart ici kaymasin diye), yani
  // bicim `${_kacir(x)}` degil `${x ? _kacir(x) : ''}`. IDDIA AYNI KALDI --
  // "agirlik_hacim _kacir'den geciyor mu" -- yalnizca desen gercek bicime
  // uyarlandi. Ciplak interpolasyon yasagi asagida ayrica duruyor (satir 126),
  // yani gevseme yok: kacissiz yazilirsa o iddia kirmizi verir.
  ok('renderSepet: cart-item-sub _kacir(u.agirlik_hacim)',
     /cart-item-sub">\$\{[^}]*_kacir\(u\.agirlik_hacim\)/.test(sep), sep.slice(0, 200));
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

// ══════════════════════════════════════════════════════════════════════
// PARTİ 2 — S2/S4 (dış API/DB kaynaklı sink'ler). Yardımcılar Parti 1'den:
// _kacir (metin+öznitelik), _guvenliUrl (URL şema beyaz listesi).
// Kapsam DIŞI (bu testte de serbest bırakılır): satır içi olay
// (onclick/onkeydown/onerror içindeki ${u._id}) ve navigator.share metni
// (paylasSepet/paylasZamlar `• ${u.ad}`). CSP dokunulmadı.
// ══════════════════════════════════════════════════════════════════════
console.log('\n=== 6. S4 sink\'leri doğru yardımcıdan geçiyor (kaynak, yorumsuz+düz) ===');
{
  const card = yass(fnKaynak('cardHTML'));
  const strip = yass(fnKaynak('_stripKartHTML'));
  const detay = yass(fnKaynak('openDetay'));
  const firsat = yass(fnKaynak('_firsatKartHtml'));

  // Aynı veriyi iki yerde basan cardHTML ve _stripKartHTML AYNI deseni kullanmalı
  ok('cardHTML: src _guvenliUrl(u.resim)', /src="\$\{_guvenliUrl\(u\.resim\)\}"/.test(card), card.slice(0,120));
  ok('cardHTML: aria-label _kacir(u.ad)', /aria-label="\$\{_kacir\(u\.ad\)\}"/.test(card));
  ok('cardHTML: product-name _kacir(u.ad)', /product-name">\$\{_kacir\(u\.ad\)\}</.test(card));
  ok('_stripKartHTML: src _guvenliUrl(u.resim)  (aynı desen)', /src="\$\{_guvenliUrl\(u\.resim\)\}"/.test(strip));
  ok('_stripKartHTML: strip-card-name _kacir(u.ad)  (aynı desen)', /strip-card-name">\$\{_kacir\(u\.ad\)\}</.test(strip));
  ok('detay: detay-name _kacir(u.ad)', /detay-name">\$\{_kacir\(u\.ad\)\}</.test(detay));
  ok('detay: src _guvenliUrl(u.resim)', /src="\$\{_guvenliUrl\(u\.resim\)\}"/.test(detay));
  ok('firsat: _guvenliUrl(u.resim) + _kacir(u.ad) + _kacir(altText)',
     /_guvenliUrl\(u\.resim\)/.test(firsat) && /_kacir\(u\.ad\|\|''\)/.test(firsat) && /_kacir\(altText\)/.test(firsat));

  // Tüm dosyada geçen kritik S4 yardımcı sarmaları (mf/ms/cmp/zam/sepetÖzet)
  const A = yass(APP);
  ok('hal: _guvenliUrl(u.gorsel) + alt _kacir(u.ad)', /src="\$\{_guvenliUrl\(u\.gorsel\)\}" alt="\$\{_kacir\(u\.ad\)\}"/.test(A));
  ok('compare: _guvenliUrl(it.resim) + _kacir(it.ad)', /_guvenliUrl\(it\.resim\)/.test(A) && /cmp-mkt-item-name">\$\{_kacir\(it\.ad\)\}</.test(A));
  ok('mf: _kacir(title) + _guvenliUrl(url)', /mf-card-title">\$\{_kacir\(title\)\}</.test(A) && /src="\$\{_guvenliUrl\(url\)\}"/.test(A));
  ok('ms satır: _kacir(m.name) + _kacir(m.key)', /ms-market-name">\$\{_kacir\(m\.name\)\}</.test(A) && /data-mkt="\$\{_kacir\(m\.key\)\}"/.test(A));
  ok('sepetÖzet: _kacir(m.ad) + _kacir(o.tekMarket.ad)', /sepet-mkt-ad">\$\{_kacir\(m\.ad\)\}</.test(A) && /_kacir\(o\.tekMarket\.ad\)/.test(A));
  ok('zam: _kacir(metin) + _kacir(MARKET_NAMES...)', /zam-yayginlik">\$\{_kacir\(metin\)\}</.test(A) && /_kacir\(MARKET_NAMES\[market\] \|\| market\)/.test(A));
}

console.log('\n=== 7. TARAMA: yeni KAÇIŞSIZ S4 sink\'i eklenirse kırmızı (tüm dosya) ===');
{
  const A = yass(APP);
  // URL bağlamı: hiçbir ham src="${...}" kalmamalı (u.resim/u.gorsel/it.resim/url)
  ok('çıplak src="${u.resim/u.gorsel/it.resim/url}" YOK', !/src="\$\{(u\.resim|u\.gorsel|it\.resim|url)\}"/.test(A), 'ham src interpolasyonu bulundu');
  ok('çıplak birleştirme src="'+"'+u.resim+'"+'" YOK (fırsat)', !/src="'\+u\.resim\+'"/.test(A));
  // Metin/öznitelik: bu alanların ÇIPLAK ${...} biçimi kalmamalı
  for (const alan of ['u.gorsel','it.ad','it.resim','m.name','m.ad','marketAdi','depotName','title']) {
    const re = new RegExp('\\$\\{' + alan.replace('.', '\\.') + '\\}');
    ok('çıplak ${' + alan + '} YOK', !re.test(A), 'kaçışsız ' + alan + ' interpolasyonu');
  }
  // ${u.ad} yalnız paylaşım metninde (• ...) serbest; DOM sink olarak çıplağı kalmamalı
  const uAdKalan = A.replace(/•\s*\$\{u\.ad\}/g, '');
  ok('DOM sink olarak çıplak ${u.ad} YOK (yalnız paylaşım metni serbest)', !/\$\{u\.ad\}/.test(uAdKalan), 'kaçışsız DOM ${u.ad} bulundu');
  // aria-label / alt öznitelikte ham u.ad kalmamalı
  ok('çıplak aria-label/alt="${u.ad}" YOK', !/(aria-label|alt)="\$\{u\.ad\}"/.test(A));
  // Kullanıcı arama sorgusu (marketfiyati "Aranıyor" echo'su) kaçırılmalı.
  // Kör-nokta avında bulundu: guard yalnız bilinen alan desenlerine bakıyordu,
  // ${q} echo'su (self-XSS) atlanmıştı.
  ok('mf "Aranıyor" arama sorgusu _kacir(q) ile', /Aran[iı]yor: <b>\$\{_kacir\(q\)\}<\/b>/.test(A), 'arama sorgusu kaçışsız echo ediliyor');
  ok('  çıplak <b>${q}</b> (kaçışsız sorgu) YOK', !/<b>\$\{q\}<\/b>/.test(A), 'ham ${q} innerHTML echo bulundu');
}

console.log('\n=== 8. KANIT: S4 korumasını bilerek boz, tarama KIRMIZIYA dönüyor ===');
{
  const gercek = yass(fnKaynak('cardHTML'));
  const bozuk = gercek
    .replace(/\$\{_guvenliUrl\(u\.resim\)\}/g, '${u.resim}')
    .replace(/product-name">\$\{_kacir\(u\.ad\)\}/g, 'product-name">${u.ad}');
  ok('gerçek cardHTML: çıplak src="${u.resim}" yok', !/src="\$\{u\.resim\}"/.test(gercek));
  ok('bozuk cardHTML: çıplak src="${u.resim}" VAR (mutasyon)', /src="\$\{u\.resim\}"/.test(bozuk));
  ok('bozuk cardHTML: çıplak product-name ${u.ad} VAR (mutasyon)', /product-name">\$\{u\.ad\}/.test(bozuk));
  // Yorum tuzağı: yorumdaki ham sink yanlış alarm üretmemeli
  const yorumlu = 'function t(){ /* örnek: src="${u.resim}" */ return `<img src="${_guvenliUrl(u.resim)}">`; }';
  ok('yorum içindeki ham src taramada SOYULUYOR', !/src="\$\{u\.resim\}"/.test(yass(yorumlu)));
}

// ══════════════════════════════════════════════════════════════════════
// PARTİ 3 — satır içi olay bağlamı. Değer artık handler'ın JS-string'ine
// interpolasyon EDİLMİYOR; data-* özniteliğine (_kacir'li) yazılıp handler
// this.dataset'ten okuyor. Böylece iki katlı bağlam (HTML özniteliği + JS
// dizesi) tek kata iner. CSP'ye dokunulmadı; JS-string kaçış fonksiyonu YOK.
// ══════════════════════════════════════════════════════════════════════
console.log("\n=== 9. Satır içi olay: değer data-*'ta, handler this.dataset'ten okuyor ===");
{
  const A = yass(APP);
  const card = yass(fnKaynak('cardHTML'));
  ok('cardHTML: openDetay(this.dataset.id)', /onclick="openDetay\(this\.dataset\.id\)"/.test(card));
  ok('cardHTML: onkeydown _kartTus(event, this.dataset.id)', /onkeydown="_kartTus\(event, this\.dataset\.id\)"/.test(card));
  ok('cardHTML: toggleSepet(this.dataset.pid)', /toggleSepet\(this\.dataset\.pid\)/.test(card));
  ok('_stripKartHTML: openDetay(this.dataset.id)', /onclick="openDetay\(this\.dataset\.id\)"/.test(yass(fnKaynak('_stripKartHTML'))));
  ok('renderSepet: removeFromSepet(this.dataset.id)', /removeFromSepet\(this\.dataset\.id\)/.test(A));
  ok('detay: toggleSepet(this.dataset.id) + fiyatBildirAc(this.dataset.id)', /toggleSepet\(this\.dataset\.id\); renderDetayBtn\(this\.dataset\.id\)/.test(A) && /fiyatBildirAc\(this\.dataset\.id\)/.test(A));
  ok('favBtn: favToggle(this.dataset.sid, this) + data-sid _kacir', /favToggle\(this\.dataset\.sid, this\)/.test(A) && /data-sid="\$\{_kacir\(sid\)\}"/.test(A));
  ok('ms satır: msSheetToggle(this.dataset.mkt, this)', /msSheetToggle\(this\.dataset\.mkt, this\)/.test(A));
  ok('renderSablonBar: sablonYukleUI/sablonSilUI(this.dataset.id)', /sablonYukleUI\(this\.dataset\.id\)/.test(A) && /sablonSilUI\(this\.dataset\.id\)/.test(A));
  ok('profil: profilSablonSil/profilAlarmKaldir(this.dataset.*)', /profilSablonSil\(this\.dataset\.id\)/.test(A) && /profilAlarmKaldir\(this\.dataset\.sid\)/.test(A));
  ok('alarm: fiyatAlarmKur/Kaldir(this.dataset.sid)', /fiyatAlarmKur\(this\.dataset\.sid\)/.test(A) && /fiyatAlarmKaldir\(this\.dataset\.sid\)/.test(A));
  ok('altKat: setAltKat(this.dataset.kat) + data-kat _kacir', /setAltKat\(this\.dataset\.kat\)/.test(A));
  ok('cat-card: openCategory(this.dataset.slug)', /openCategory\(this\.dataset\.slug\)/.test(A));
  ok('mf onerror: textContent=this.dataset.initial (innerHTML enjeksiyonu değil)', /textContent=this\.dataset\.initial/.test(A) && !/innerHTML='\$\{initial/.test(A));
}

console.log("\n=== 10. TARAMA: bir handler değeri JS-string'e enjekte ederse kırmızı (tüm dosya) ===");
{
  const A = yass(APP);
  // Satır içi olay özniteliğinde '${...} = değer doğrudan JS dizesine giriyor = kırılgan.
  // Migrasyon sonrası HİÇBİRİ kalmamalı (hepsi this.dataset okuyor).
  ok("hiçbir satır içi olayda '${...} yok (JS-string enjeksiyonu)", !/on[a-z]+="[^"]*'\$\{/.test(A), "handler içine doğrudan interpolasyon bulundu");
}

console.log("\n=== 11. KANIT: bir handler'ı JS-string enjeksiyonuna geri sar, tarama KIRMIZI ===");
{
  const gercek = yass(fnKaynak('cardHTML'));
  const bozuk = gercek.replace(/onclick="openDetay\(this\.dataset\.id\)"/, `onclick="openDetay('` + '${u._id}' + `')"`);
  ok("gerçek cardHTML: handler'da '${ yok", !/on[a-z]+="[^"]*'\$\{/.test(gercek));
  ok("bozuk cardHTML: handler'da '${ VAR (mutasyon oluştu)", /on[a-z]+="[^"]*'\$\{/.test(bozuk));
  // Yorum tuzağı: yorumdaki enjeksiyon deseni yanlış alarm üretmemeli
  const yorumlu = "function t(){ /* eski: onclick=\"f('${u._id}')\" */ return `<div onclick=\"f(this.dataset.id)\"></div>`; }";
  ok('yorumdaki enjeksiyon taramada SOYULUYOR (yanlış alarm yok)', !/on[a-z]+="[^"]*'\$\{/.test(yass(yorumlu)));
}

console.log('\n=== S4 DIŞ-API RENDER YOLLARI: GERÇEK _kacir ile kaçış (4639/4630/5428/4867/4932) ===');
// B1 son partisi (2026-08-21): CI kapısı kurulurken bu yolların testlerine
// passthrough _kacir stub'ı konmuştu -> gerçek kaçış görünmüyordu. Burada GERÇEK
// _kacir vm'e yükleniyor; iddialar üretim çıktısını doğruluyor (stub YOK).
{
  const PAY = '<img src=x onerror=1>';
  function kur(extra) {
    const c = Object.assign({ console, tl: (n) => String(n), birimFiyatYazi: () => '',
      _birimFiyatHam: () => ({}), placeholderRenk: () => ({ emoji: 'X' }),
      ustKategori: (x) => x, lcIcon: () => '',
      // 2026-08-25: sepetMarketOzetiHTML artik secili sehri okuyor.
      // Bu test KACIS yollarini sinar, sehir gorunurlugunu degil -> stub
      // 'secim yok' der, not cizilmez, sinanan yollar AYNEN kalir.
      sehirOku: () => null }, extra || {});
    vm.createContext(c);
    vm.runInContext([fnKaynak('_kacir'), fnKaynak('_guvenliUrl')].filter(Boolean).join('\n'), c);
    return c;
  }
  // 4639 + 4630 (kontrol grubu): sepetMarketOzetiHTML
  {
    const c = kur({
      marketToplamlari: () => [{ ad: PAY, toplam: 100, eksik: 0 }],
      sepetBolmeOnerisi: () => ({ oner: true, ikili: { adlar: [PAY, 'A101'], toplam: 90 }, kazanc: 10, tekMarket: { ad: 'BIM', toplam: 100 } }),
    });
    vm.runInContext(fnKaynak('sepetMarketOzetiHTML'), c);
    const h = c.sepetMarketOzetiHTML();
    ok('4639 sepetMarketOzetiHTML: o.ikili.adlar market adları KAÇILIYOR', !h.includes(PAY) && h.includes('&lt;img src=x'), h.slice(0, 160));
    ok('  4630 kontrol grubu (m.ad) da kaçılıyor (>=2 kaçışlı)', (h.match(/&lt;img src=x/g) || []).length >= 2, '');
    ok('  " + " ayırıcısı literal kalıyor (görünüm bozulmaz)', h.includes(' + A101'), h.slice(0, 160));
  }
  // 5428: profilAlarmlarHTML (eski manuel replace(/</g) -> _kacir)
  {
    const c = kur({ _profilUrunBul: () => ({ ad: PAY }), _profilEnUcuz: () => ({ fiyat: 10 }) });
    c.window = vm.runInContext('({ pazarAlarmMap: new Map([["sid1", 20]]) })', c);
    vm.runInContext(fnKaynak('profilAlarmlarHTML'), c);
    const h = c.profilAlarmlarHTML();
    ok('5428 profilAlarmlarHTML: ürün adı _kacir (& dahil, kısmi replace GİTTİ)', h.includes('&lt;img src=x') && !h.includes('<img src=x'), h.slice(0, 200));
  }
  // 4867 + kontrol (it.ad): _cmpItemHTML gramaj
  {
    const src = arrowKaynak('_cmpItemHTML').replace('const _cmpItemHTML', 'globalThis._cmpItemHTML');
    const c = kur(); vm.runInContext(src, c);
    const h = c._cmpItemHTML({ ad: PAY, agirlik_hacim: PAY, resim: null, fiyat: 10 });
    ok('4867 _cmpItemHTML: gramaj (it.agirlik_hacim) KAÇILIYOR', !h.includes(PAY) && h.includes('&lt;img src=x'), h.slice(0, 160));
    ok('  kontrol: it.ad da kaçılıyor (cmp-mkt-item-name)', /cmp-mkt-item-name">&lt;img/.test(h), '');
  }
  // 4932: hal-badge bt.slice — tek satır (fonksiyon değil) -> kaynak taraması
  ok('4932 hal-badge: bt.slice(0,10) _kacir\'li', /Hal:\s*\$\{_kacir\(bt\.slice\(0, 10\)\)\}/.test(APP), '');
}

console.log(`\nPASS=${pass}  FAIL=${fail}`);
process.exit(fail ? 1 : 0);
