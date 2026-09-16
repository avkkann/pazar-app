// test_bildirim_ozet.mjs — gecelik "Bu fiyat tutmadi" ozet e-postasi
//
// YONTEM: kaynak grep'i DEGIL. supabase/functions/bildirim-ozet/index.ts'in
// GERCEK kaynagi node:vm'de kosturuluyor; Deno, createClient ve fetch sahte.
// Boylece mantik kopyalanmiyor ve iddialar DAVRANISA bakiyor.
// (Ayni desen: test_sw_origin.mjs — sw.js'i vm'de kosturuyor.)
//
// KORUDUGU SEYLER
//  1) GIZLI BASLIK KAPISI: yetkisiz istekte 401 ve HICBIR yan etki
//     (e-posta yok, DB okumasi yok). CRON_SECRET tanimsizsa kapi KAPALI.
//  2) MUSTAFA'NIN KARARI (2026-09-16): e-posta bildirim OLMASA DA gidiyor —
//     gelmemesi "bozuldu" demek olsun diye. Bu kontrol grubuyla kilitli.
//  3) SESSIZ BASARISIZLIK YOK: alici adresi yoksa ya da Resend hata verirse
//     500 doner (200 + "gonderdim" gorunumu YASAK).
//  4) GIZLILIK: e-postada kullanici kimligi gecmiyor (kac kisi gorunur,
//     kim gorunmez — uygulamanin kendi kurali).
//  5) CIKTI KACISI: urun adi HTML'e kacisli giriyor.
//  6) SESSIZ KIRPMA YOK: satir siniri asilirsa kirpilan sayi hem e-postada
//     hem yanit govdesinde yaziliyor.
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

let pass = 0, fail = 0;
const ok = (ad, kosul, ek = '') => {
  if (kosul) { pass++; console.log('  PASS  ' + ad); }
  else { fail++; console.log('  FAIL  ' + ad + (ek ? '  -> ' + ek : '')); }
};

const YOL = 'supabase/functions/bildirim-ozet/index.ts';
const KAYNAK_HAM = readFileSync(YOL, 'utf8');
// Tek dis bagimlilik: jsr import'u. vm'de cozulemez, yerine sahte createClient
// enjekte ediliyor. BASKA HICBIR SEY DEGISTIRILMIYOR.
const KAYNAK = KAYNAK_HAM.replace(/^import\s*\{[^}]*\}\s*from\s*["']jsr:[^"']+["'];?\s*$/m, '');

// ── Sahte dunya ───────────────────────────────────────────────────────────
function sahteSupabase(veri) {
  const cagrilar = [];
  const client = {
    from(tablo) {
      const kayit = { tablo, filtre: {} };
      cagrilar.push(kayit);
      const builder = {
        select(s) { kayit.select = s; return builder; },
        gte(kolon, deger) { kayit.filtre.gte = [kolon, deger]; return builder; },
        order(kolon, opt) { kayit.filtre.order = [kolon, opt]; return builder; },
        in(kolon, liste) { kayit.filtre.in = [kolon, liste]; return builder; },
        then(cozum) {
          const cevap = tablo === 'fiyat_bildirim'
            ? (veri.bildirimHata ? { data: null, error: veri.bildirimHata } : { data: veri.bildirimler || [], error: null })
            : (veri.urunHata ? { data: null, error: veri.urunHata } : { data: veri.urunler || [], error: null });
          return Promise.resolve(cevap).then(cozum);
        },
      };
      return builder;
    },
  };
  return { client, cagrilar };
}

async function kosku({ secret = 'GIZLI', baslik = 'GIZLI', env = {}, veri = {}, resendOk = true, resendKod = 200 } = {}) {
  const { client, cagrilar } = sahteSupabase(veri);
  const epostalar = [];
  const uyarilar = [];
  const ortam = {
    // secret: null -> "CRON_SECRET hic tanimli degil" (guvenli varsayilan testi).
    // undefined GECMEZ: yikim varsayilani (secret = 'GIZLI') devreye girer ve
    // test yanlislikla dogru secret'i verir — bu tuzaga bir kez dusuldu.
    CRON_SECRET: secret === null ? undefined : secret,
    OZET_EPOSTA: 'alici@example.com',
    SUPABASE_URL: 'https://ornek.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'servis',
    RESEND_API_KEY: 'resend',
    ...env,
  };
  let handler = null;
  const ctx = vm.createContext({
    Deno: {
      env: { get: (k) => (ortam[k] === undefined ? undefined : ortam[k]) },
      serve: (h) => { handler = h; },
    },
    createClient: () => client,
    fetch: async (url, opt) => {
      epostalar.push({ url, opt, govde: JSON.parse(opt.body) });
      return { ok: resendOk, status: resendKod, text: async () => 'resend hata metni' };
    },
    Response, Request, Headers, TextEncoder, URL, Date, Map, Set, JSON, Promise, Number, String, Array, Object, isNaN,
    console: { warn: (...a) => uyarilar.push(a.join(' ')), log: () => {}, error: () => {} },
  });
  vm.runInContext(KAYNAK, ctx, { filename: YOL });
  if (typeof handler !== 'function') throw new Error('ALET KOR: Deno.serve handler yakalanamadi');

  const istek = new Request('https://ornek.functions/bildirim-ozet', {
    method: 'POST',
    headers: baslik === null ? {} : { 'x-cron-secret': baslik },
  });
  const yanit = await handler(istek);
  let govde = null;
  try { govde = await yanit.json(); } catch (e) { govde = null; }
  return { yanit, govde, epostalar, cagrilar, uyarilar, handler };
}

const dk = (i, ek = {}) => ({
  _sid: 'gida_' + i,
  market: 'bim',
  gosterilen_fiyat: 100,
  bildirilen_fiyat: 129.5,
  kullanici_id: '11111111-1111-1111-1111-11111111111' + (i % 10),
  olusturma: '2026-09-16T08:30:00.000Z',
  ...ek,
});

// ── 0. ALET KONTROLU ──────────────────────────────────────────────────────
console.log('\n=== 0. ALET KONTROLU ===');
ok('kaynak okundu ve jsr import\'u disinda dokunulmadi',
  KAYNAK.includes('Deno.serve') && !KAYNAK.includes('jsr:@supabase') && KAYNAK_HAM.includes('jsr:@supabase'));
{
  const r = await kosku({ veri: { bildirimler: [dk(1)], urunler: [{ _sid: 'gida_1', ad: 'Sut 1 L', agirlik_hacim: '1 L' }] } });
  ok('  handler calisti ve yanit uretti', r.yanit.status === 200, 'status=' + r.yanit.status);
  ok('  sahte e-posta servisi cagriyi gordu (alet sagir degil)', r.epostalar.length === 1);
}

// ── 1. GIZLI BASLIK KAPISI ────────────────────────────────────────────────
console.log('\n=== 1. YETKISIZ ISTEKTE YAN ETKI YOK ===');
{
  const r = await kosku({ baslik: 'YANLIS' });
  ok('yanlis gizli -> 401', r.yanit.status === 401, 'status=' + r.yanit.status);
  ok('  e-posta GONDERILMEDI', r.epostalar.length === 0);
  ok('  DB hic okunmadi', r.cagrilar.length === 0);
}
{
  const r = await kosku({ baslik: null });
  ok('baslik yok -> 401', r.yanit.status === 401);
  ok('  e-posta GONDERILMEDI', r.epostalar.length === 0);
}
{
  const r = await kosku({ baslik: 'GIZLIGIZLI' });
  ok('uzun/yanlis baslik -> 401 (uzunluk kapisi)', r.yanit.status === 401);
}
{
  // GUVENLI VARSAYILAN: secret tanimsizsa istek DOGRU basligi tasisa bile kapali.
  const r = await kosku({ secret: null, baslik: 'GIZLI' });
  ok('CRON_SECRET tanimsiz -> 401 (kapi kapali kalir)', r.yanit.status === 401);
  ok('  e-posta GONDERILMEDI', r.epostalar.length === 0);
}

// ── 2. BILDIRIM VARKEN ────────────────────────────────────────────────────
console.log('\n=== 2. BILDIRIM VARKEN OZET GIDIYOR ===');
{
  const r = await kosku({
    veri: {
      bildirimler: [dk(1), dk(2, { market: 'a101', bildirilen_fiyat: 89 })],
      urunler: [
        { _sid: 'gida_1', ad: 'Sut 1 L', agirlik_hacim: '1 L' },
        { _sid: 'gida_2', ad: 'Yumurta 10lu', agirlik_hacim: null },
      ],
    },
  });
  const e = r.epostalar[0];
  ok('200 dondu', r.yanit.status === 200);
  ok('  TEK e-posta gonderildi', r.epostalar.length === 1);
  ok('  Resend ucuna gitti', e && String(e.url).includes('api.resend.com/emails'));
  ok('  alici ORTAM DEGISKENINDEN', e && e.govde.to === 'alici@example.com', e && e.govde.to);
  ok('  konuda bildirim sayisi var', e && /2 fiyat bildirimi/.test(e.govde.subject), e && e.govde.subject);
  ok('  govdede urun adi var', e && e.govde.html.includes('Sut 1 L'));
  ok('  govdede market adi var', e && e.govde.html.includes('a101'));
  ok('  govdede bizim fiyat ve raftaki fiyat var', e && e.govde.html.includes('100.00') && e.govde.html.includes('129.50'));
  ok('  fark isaretiyle yaziliyor', e && e.govde.html.includes('+29.50'));
  ok('  yanit govdesi sayilari tasiyor', r.govde && r.govde.bildirim === 2 && r.govde.urun === 2 && r.govde.kisi === 2,
    JSON.stringify(r.govde));
  // GIZLILIK KILIDI
  ok('  e-postada kullanici kimligi YOK', e && !e.govde.html.includes('11111111-1111'));
  // PENCERE: kayan 24 saat
  const bildirimSorgu = r.cagrilar.find(c => c.tablo === 'fiyat_bildirim');
  const gte = bildirimSorgu && bildirimSorgu.filtre.gte;
  ok('  sorgu olusturma >= ... filtresi kuruyor', !!gte && gte[0] === 'olusturma', JSON.stringify(gte));
  const farkSaat = gte ? (Date.now() - Date.parse(gte[1])) / 3600000 : 0;
  ok('  pencere ~24 saat (takvim gunu degil)', farkSaat > 23.9 && farkSaat < 24.1, 'saat=' + farkSaat.toFixed(2));
  ok('  urun adlari yalniz bildirilen sid\'ler icin soruldu', (() => {
    const u = r.cagrilar.find(c => c.tablo === 'urunler');
    return u && u.filtre.in && u.filtre.in[1].length === 2;
  })());
}

// ── 3. KONTROL GRUBU: BILDIRIM YOKKEN DE GIDIYOR ──────────────────────────
console.log('\n=== 3. BILDIRIM YOKKEN DE E-POSTA GIDIYOR (Mustafa\'nin karari) ===');
{
  const r = await kosku({ veri: { bildirimler: [] } });
  const e = r.epostalar[0];
  ok('200 dondu', r.yanit.status === 200);
  ok('  e-posta YINE gonderildi', r.epostalar.length === 1);
  ok('  konu "bildirim yok" diyor', e && /bildirimi? yok/i.test(e.govde.subject), e && e.govde.subject);
  ok('  govde bos gecmiyor, acikca soyluyor', e && /hiç bildirim gelmedi/i.test(e.govde.html));
  ok('  govde "gelmezse bozulmustur" uyarisini tasiyor', e && /bozulmuş/i.test(e.govde.html));
  ok('  urun sorgusu hic atilmadi (bos listede gereksiz)', !r.cagrilar.find(c => c.tablo === 'urunler'));
  ok('  yanit bildirim=0 diyor', r.govde && r.govde.bildirim === 0);
}

// ── 4. SESSIZ BASARISIZLIK YOK ────────────────────────────────────────────
console.log('\n=== 4. SESSIZ BASARISIZLIK YOK ===');
{
  const r = await kosku({ env: { OZET_EPOSTA: undefined }, veri: { bildirimler: [dk(1)] } });
  ok('alici adresi yoksa 500', r.yanit.status === 500, 'status=' + r.yanit.status);
  ok('  hata metni OZET_EPOSTA diyor', r.govde && /OZET_EPOSTA/.test(r.govde.error), JSON.stringify(r.govde));
  ok('  e-posta denenmedi', r.epostalar.length === 0);
  ok('  DB okunmadi (bos istek atilmiyor)', r.cagrilar.length === 0);
}
{
  const r = await kosku({ resendOk: false, resendKod: 422, veri: { bildirimler: [dk(1)] } });
  ok('Resend hata verirse 500', r.yanit.status === 500, 'status=' + r.yanit.status);
  ok('  yanit ok:false ve kodu tasiyor', r.govde && r.govde.ok === false && /422/.test(r.govde.error), JSON.stringify(r.govde));
}
{
  const r = await kosku({ veri: { bildirimHata: { message: 'DB patladi' }, bildirimler: [] } });
  ok('DB okuma hatasi -> 500', r.yanit.status === 500);
  ok('  e-posta gonderilmedi', r.epostalar.length === 0);
}
{
  // Urun adi gelmezse ozet YINE gitmeli (ad kritik degil) ama SESSIZ OLMAMALI.
  const r = await kosku({ veri: { bildirimler: [dk(1)], urunHata: { message: 'ad sorgusu patladi' } } });
  ok('urun adi alinamazsa ozet yine gidiyor', r.yanit.status === 200 && r.epostalar.length === 1);
  ok('  _sid ile gonderiliyor', r.epostalar[0].govde.html.includes('gida_1'));
  ok('  uyari birakiliyor (sessiz degil)', r.uyarilar.some(u => /urun adlari alinamadi/.test(u)), JSON.stringify(r.uyarilar));
  ok('  yanit govdesinde adHatasi gorunuyor', r.govde && !!r.govde.adHatasi);
}

// ── 5. CIKTI KACISI ───────────────────────────────────────────────────────
console.log('\n=== 5. CIKTI KACISI ===');
{
  const r = await kosku({
    veri: {
      bildirimler: [dk(1)],
      urunler: [{ _sid: 'gida_1', ad: '<script>alert(1)</script> & "tirnak"', agirlik_hacim: null }],
    },
  });
  const html = r.epostalar[0].govde.html;
  ok('ham <script> govdede YOK', !html.includes('<script>'));
  ok('  kacisli hali VAR', html.includes('&lt;script&gt;'));
  ok('  & ve tirnak kacisli', html.includes('&amp;') && html.includes('&quot;'));
}

// ── 6. SESSIZ KIRPMA YOK ──────────────────────────────────────────────────
console.log('\n=== 6. SESSIZ KIRPMA YOK ===');
{
  const cok = Array.from({ length: 120 }, (_, i) => dk(i));
  const r = await kosku({ veri: { bildirimler: cok, urunler: [] } });
  const html = r.epostalar[0].govde.html;
  // Baslik satiri `<tr style=...>` ile basliyor, yani /<tr>/ onu ZATEN saymiyor.
  // Ilk halimde bir de elle 1 dusuyordum ve sayim 99 cikiyordu — testin kendi hatasi.
  const satirSayisi = (html.match(/<tr>/g) || []).length;
  ok('en fazla 100 satir cizildi', satirSayisi === 100, 'satir=' + satirSayisi);
  ok('  kirpilan sayi e-postada yaziyor', /20 bildirim daha geldi/.test(html));
  ok('  kirpilan sayi yanit govdesinde', r.govde && r.govde.kirpilan === 20, JSON.stringify(r.govde && r.govde.kirpilan));
  ok('  toplam sayi yine dogru', /120<\/b> bildirim/.test(html));
}

// ── 7. EKSIK VERIYE DAYANIKLILIK ──────────────────────────────────────────
console.log('\n=== 7. EKSIK VERI ===');
{
  const r = await kosku({
    veri: {
      bildirimler: [dk(1, { bildirilen_fiyat: null }), dk(2, { gosterilen_fiyat: null, bildirilen_fiyat: null })],
      urunler: [],
    },
  });
  const html = r.epostalar[0].govde.html;
  ok('raftaki fiyat yoksa e-posta yine gidiyor', r.yanit.status === 200);
  ok('  bos deger "—" olarak yaziliyor, NaN degil', html.includes('—') && !/NaN/.test(html), 'NaN var mi: ' + /NaN/.test(html));
}

// ── 8. GECE ISINE GERCEKTEN BAGLI MI ──────────────────────────────────────
// Bu depoda kayitli bir bosluk sinifi: kod yazilir ama CAGIRAN olmaz
// (fiyat alarmi taramasi, hub footer, bulten). Fonksiyonun varligi yetmez.
console.log('\n=== 8. GECE ISI BAGLANTISI ===');
{
  const WF = readFileSync('.github/workflows/update-data.yml', 'utf8');
  const blok = WF.slice(WF.indexOf('bildirim-ozet:'));
  ok('update-data.yml bildirim-ozet job\'u tasiyor', WF.includes('bildirim-ozet:'));
  ok('  fonksiyon uc noktasi cagriliyor', /functions\/v1\/bildirim-ozet/.test(WF));
  ok('  gizli baslik gonderiliyor', /x-cron-secret: \$\{\{ secrets\.CRON_SECRET \}\}/.test(blok));
  ok('  veri isinden SONRA kosuyor (needs: update)', /needs:\s*update/.test(blok));
  ok('  200 disinda HARD-FAIL (sessiz yutma yok)', /exit 1/.test(blok) && /::error::bildirim-ozet/.test(blok));
  ok('  continue-on-error YOK', !/continue-on-error/.test(blok));
  // Secret'i loglamaya karsi: -v ya da istek basligini echo eden satir olmasin.
  ok('  istek basliklari loglanmiyor', !/curl[^\n]*-v\b/.test(blok) && !/echo[^\n]*CRON_SECRET/.test(blok));
}

console.log(`\nSONUC: PASS=${pass} FAIL=${fail}`);
process.exit(fail ? 1 : 0);
