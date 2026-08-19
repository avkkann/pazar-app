// Fiyat bildirimi YAZMA yetkisi — oturuma bağlı, "RPC hatası"na DEĞİL.
// app.js'ten fonksiyon KAYNAĞINI çıkarıp vm'de koşturur; kopya mantık değil.
// Güvenlik regresyonu koruması: DB tarafı authenticated+auth.uid()'e kapatıldı,
// istemci de ona uymalı. Kullanım: node test_bildirim_yetki.mjs
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
// Yorumları soy: kaynakta desen ararken yorum içeriği yanlış alarm veriyor
// (bu depoda iki kez yaşandı). Kod ile yorum AYRI değerlendirilecek.
const soy = (s) => (s || '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');

// ── ortam: modalAc / openAuthSheet / toast / RPC hepsi casus ──────────
function ortamKur(oturum) {
  const cagri = { modalAc: 0, openAuthSheet: 0, insert: 0, insertPayload: null, toast: [] };
  const ctx = {
    console, Number, String, parseFloat, isNaN, Date, Map, Object,
    window: {
      pazarAuth: oturum ? { user: { id: 'user-uuid-123' } } : { user: null },
      openAuthSheet: () => { cagri.openAuthSheet++; },
      supabaseClient: {
        rpc: async () => ({ data: [], error: null }),   // anon'a 200 [] taklidi
        from: () => ({ insert: async (p) => { cagri.insert++; cagri.insertPayload = p; return { error: null }; } }),
      },
    },
    productMap: { 'p1': { _id: 'p1', _sid: 'sut_1', market_fiyatlari: [{ market: 'bim', fiyat: 10 }] } },
    fiyatlariTemizle: (mf) => ({ gecerli: mf || [] }),
    MARKET_NAMES: { bim: 'BİM' },
    _kacir: (s) => s,
    localStorage: (() => { const m = {}; return { getItem: k => m[k] ?? null, setItem: (k, v) => { m[k] = v; } }; })(),
    modalAc: async () => { cagri.modalAc++; return true; },   // "Giriş yap"a bas
    toastGoster: (t) => cagri.toast.push(t),
    _bildirimMarketSec: () => {},
    _fiyatBildirimMap: new Map(),   // fiyatBildirAc başarılı yolda güncelliyor
    _bildirimSecilenMarket: null,
  };
  ctx.window.pazarAuth = ctx.window.pazarAuth;
  vm.createContext(ctx);
  vm.runInContext([
    fnKaynak('_bildirimYetkiVarMi'),
    fnKaynak('fiyatBildirimleriYukle'),
    fnKaynak('fiyatBildirAc'),
  ].filter(Boolean).join('\n'), ctx);
  return { ctx, cagri, calis: (i) => vm.runInContext(i, ctx) };
}

console.log('\n=== 1. KAPI OTURUMA BAĞLI, "RPC hatası"na DEĞİL ===');
{
  const src = soy(fnKaynak('_bildirimYetkiVarMi'));
  ok('_bildirimYetkiVarMi tanımlı', !!src, '');
  ok('  oturum varlığına bakıyor (window.pazarAuth.user)', /window\.pazarAuth\s*&&\s*window\.pazarAuth\.user|pazarAuth\.user/.test(src), src);
  // KRİTİK REGRESYON KAPISI: kapı RPC hatasına/verisine bağlanırsa test kırılır.
  ok('  RPC hatası/verisi kapıyı BELİRLEMİYOR', !/error|rpc|get_fiyat_bildirimleri|data/i.test(src), src);
  // Buton render'ı canlı kontrolü kullanmalı, ölü boolean değil
  ok('buton render\'ı _bildirimYetkiVarMi() çağırıyor', /_bildirimYetkiVarMi\(\)\s*\?/.test(APP), '');
  ok('  eski ölü bayrak (let _bildirimYetkiVar =) kalmadı', !/\blet\s+_bildirimYetkiVar\b/.test(APP), '');
}

console.log('\n=== 2. BOŞ SONUÇ ile HATA AYRI DALLAR ===');
{
  const yukle = soy(fnKaynak('fiyatBildirimleriYukle'));
  ok('boş sonuç için ayrı dal var (!data || !data.length)', /!data\s*\|\|\s*!data\.length/.test(yukle), yukle.slice(0, 300));
  ok('  RPC hatası için ayrı dal var (if (error))', /if\s*\(\s*error\s*\)/.test(yukle), '');
  // yetki BU fonksiyondan türetilmemeli
  ok('  yükleme fonksiyonu yetki bayrağı SET ETMİYOR', !/_bildirimYetkiVar\s*=/.test(yukle), yukle);
}

console.log('\n=== 3. OTURUMSUZ: gönderim engelleniyor, INSERT ATILMIYOR ===');
{
  const { cagri, calis } = ortamKur(false);
  await calis('fiyatBildirAc("p1")');
  ok('oturumsuzda INSERT hiç atılmadı', cagri.insert === 0, 'insert=' + cagri.insert);
  ok('  yönlendirme modalı gösterildi (modalAc)', cagri.modalAc >= 1, 'modalAc=' + cagri.modalAc);
  ok('  "Giriş yap"a basınca auth sheet açıldı', cagri.openAuthSheet === 1, 'openAuthSheet=' + cagri.openAuthSheet);
}

console.log('\n=== 4. OTURUMLU: gönderim çalışıyor, kullanici_id session\'dan ===');
{
  const { cagri, calis } = ortamKur(true);
  await calis('fiyatBildirAc("p1")');
  ok('oturumluda INSERT atıldı', cagri.insert === 1, 'insert=' + cagri.insert);
  ok('  kullanici_id session user id\'si (istemci null göndermiyor)',
     cagri.insertPayload && cagri.insertPayload.kullanici_id === 'user-uuid-123', JSON.stringify(cagri.insertPayload));
  ok('  giriş modalı GÖSTERİLMEDİ (zaten oturumlu)', cagri.openAuthSheet === 0, 'openAuthSheet=' + cagri.openAuthSheet);
}

console.log('\n=== 5. INSERT ÖNCESİ İKİNCİ SAVUNMA (modal sırasında oturum düşerse) ===');
{
  const src = soy(fnKaynak('fiyatBildirAc'));
  // INSERT'ten önce ikinci bir session kontrolü olmalı, kullanici_id ondan gelmeli
  ok('INSERT payload\'ında ham null yerine _user.id kullanılıyor',
     /kullanici_id:\s*_user\.id/.test(src), '');
  ok('  INSERT öncesi _user yokluğunda erken dönüş var',
     /if\s*\(\s*!_user\s*\)/.test(src), src.slice(src.indexOf('_user'), src.indexOf('_user') + 200));
}

console.log('\n=== 6. 24 SAAT SOĞUMASI KORUNDU + "tek koruma değil" NOTU ===');
{
  ok('24 saatlik localStorage soğuması duruyor', /86400000/.test(fnKaynak('fiyatBildirAc')), '');
  // İstek: koda not düşülsün ki soğuma artık tek koruma değil
  ok('  soğumanın tek koruma OLMADIĞI koda not düşülmüş',
     /ARTIK TEK KORUMA\s*\n?\s*(?:\/\/\s*)?DEGIL|artık tek koruma değil|tek koruma DEGIL/i.test(fnKaynak('fiyatBildirAc')), '');
}

console.log(`\nPASS=${pass}  FAIL=${fail}`);
process.exit(fail ? 1 : 0);
