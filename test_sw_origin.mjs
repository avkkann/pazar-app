// sw.js notificationclick — ORIGIN KAPISI testi.
//
// Push yukundeki data.url dogrudan clients.openWindow'a gidiyordu. Bugun zararsiz
// (sunucu sabit "./" yolluyor, push VAPID ozel anahtari ister) ama dogrulama YOKTU:
// yuke bir gun dinamik url konursa dis origin'e acilan bir pencere olurdu.
// Bu test kapiyi GERCEK KODLA dogrular: sw.js kaynagi node:vm'de sahte bir
// ServiceWorkerGlobalScope icinde kosturulur, notificationclick handler'i
// yakalanir ve cesitli url degerleriyle CAGRILIR. Mantik burada KOPYALANMAZ.
//
// Kullanim: node test_sw_origin.mjs
import fs from 'fs';
import vm from 'node:vm';

const SW_KAYNAK = fs.readFileSync('sw.js', 'utf8');
const ORIGIN = 'https://pazarapp.net';

let pass = 0, fail = 0;
const ok = (ad, k, d = '') => { if (k) { pass++; console.log('  PASS  ' + ad); } else { fail++; console.log('  FAIL  ' + ad + (d ? '  -> ' + d : '')); } };

// sw.js'i sahte bir SW global'i icinde kosturur, handler'lari toplar.
function swYukle() {
  const handlers = {};
  const self = {
    location: new URL(ORIGIN + '/'),
    addEventListener: (tip, fn) => { handlers[tip] = fn; },
    skipWaiting: () => {},
    registration: { showNotification: () => {} },
    clients: {
      claim: () => {},
      // Acik pencere YOK -> notificationclick openWindow dalina girer.
      matchAll: async () => [],
      openWindow: async (u) => { self.__acilan = u; return {}; },
    },
    caches: { open: async () => ({ addAll: async () => {}, match: async () => undefined, put: async () => {} }), keys: async () => [], delete: async () => {} },
    fetch: async () => ({ ok: false }),
    __acilan: undefined,
  };
  // console.warn KAYIT ALTINDA: "sessiz yutma yok" kurali kaynak regex'iyle degil,
  // gercekten uyari CIKTI MI diye olculur (regex, dallardan biri iz kaybetse bile
  // digerini gorup yesil kaliyordu — prove-by-breaking'de yakalandi).
  const uyarilar = [];
  const sahteConsole = { ...console, warn: (...a) => { uyarilar.push(a.map(String).join(' ')); } };
  self.__uyarilar = uyarilar;
  const ctx = { self, URL, console: sahteConsole, setTimeout, Promise, fetch: self.fetch };
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(SW_KAYNAK, ctx);
  return { self, handlers };
}

// Verilen data.url ile notificationclick'i calistirir, openWindow'a NE gittigini doner.
async function tiklat(url) {
  const { self, handlers } = swYukle();
  if (typeof handlers.notificationclick !== 'function') throw new Error('notificationclick handler yok');
  let bekle;
  await handlers.notificationclick({
    notification: { close: () => {}, data: url === undefined ? undefined : { url } },
    waitUntil: (p) => { bekle = p; },
  });
  if (bekle) await bekle;
  return { acilan: self.__acilan, uyarilar: self.__uyarilar };
}

console.log('\n=== sw.js notificationclick: origin kapisi ===');
{
  ok('sw.js notificationclick dinleyicisi kayitli', typeof swYukle().handlers.notificationclick === 'function');

  // DIS ORIGIN -> acilmamali, guvenli varsayilana ("./") dusmeli.
  const disler = [
    ['https://evil.example.com/', 'duz dis origin'],
    ['https://evil.example.com/derin/yol?a=1', 'dis origin + yol'],
    ['//evil.example.com', 'protokol-goreli'],
    ['https://pazarapp.net.evil.example.com/', 'sonek hilesi (prefix eslesmesi olsa gecerdi)'],
    ['http://pazarapp.net/', 'ayni host ama http (origin FARKLI)'],
  ];
  for (const [u, ad] of disler) {
    const { acilan, uyarilar } = await tiklat(u);
    ok(`  DIS reddedildi -> "./"  [${ad}: ${u}]`, acilan === './', String(acilan));
    // SESSIZ YUTMA YASAGI (davranissal): red edilen her url gorunur iz birakmali.
    ok(`    ...ve uyari birakti (sessiz degil)  [${ad}]`, uyarilar.length > 0, 'console.warn cikmadi');
  }

  // AYNI ORIGIN -> aynen onurlanmali (kapi mesru yolu kirmamali).
  const icler = [
    ['./', 'varsayilan'],
    ['./?screen=list', 'goreli + sorgu'],
    ['/sepet', 'kok-goreli'],
    ['https://pazarapp.net/derin/yol?a=1', 'tam URL, ayni origin'],
  ];
  for (const [u, ad] of icler) {
    const { acilan, uyarilar } = await tiklat(u);
    ok(`  ICERIDEKI onurlandi  [${ad}: ${u}]`, acilan === u, String(acilan));
    // KONTROL GRUBU: mesru url uyari URETMEMELI. Bu olmadan "uyari var" iddiasi,
    // kosulsuz warn atan bir kodda da yesil kalirdi.
    ok(`    ...ve uyari YOK (gurultu degil)  [${ad}]`, uyarilar.length === 0, uyarilar.join(' | '));
  }

  // Bozuk/eksik degerler -> patlamamali, guvenli varsayilan.
  // izBekleniyor=false: "data yok" / "bos string" zaten normal varsayilan yol,
  // reddedilen bir sey yok -> uyari da beklenmez.
  for (const [u, ad, izBekleniyor] of [
    [undefined, 'data yok', false],
    ['', 'bos string', false],
    ['javascript:alert(1)', 'javascript: semasi', true],
    ['http://[bozuk', 'ayristirilamaz URL', true],
  ]) {
    const { acilan, uyarilar } = await tiklat(u);
    ok(`  BOZUK/EKSIK -> "./"  [${ad}]`, acilan === './', String(acilan));
    ok(`    ...iz ${izBekleniyor ? 'VAR' : 'yok'} beklendi  [${ad}]`,
       izBekleniyor ? uyarilar.length > 0 : uyarilar.length === 0, uyarilar.join(' | '));
  }
}

console.log('\n=== sessiz yutma yasagi (kaynak) ===');
{
  const govde = (SW_KAYNAK.match(/notificationclick[\s\S]*$/) || [''])[0];
  ok('ciplak catch(e){} yok', !/catch\s*\([^)]*\)\s*\{\s*\}/.test(govde), govde.slice(0, 200));
}

console.log(`\nPASS=${pass}  FAIL=${fail}`);
process.exit(fail ? 1 : 0);
