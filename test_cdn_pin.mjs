// B5 (CDN tedarik zinciri) koruma testi — 1. asama: surum pinleme + butunluk.
// CDN'den <script src> ile yuklenen SDK KAYAN surume (@2, @latest, @next)
// donerse ya da integrity dusserse KIRMIZIYA doner. Boylece bir sonraki
// bagimlilik yukseltmesi/geri-alma sessizce tedarik zinciri riskini geri
// getiremez. Kullanim: node test_cdn_pin.mjs
import fs from 'fs';

const HTML = fs.readFileSync('index.html', 'utf8');
let pass = 0, fail = 0;
const ok = (ad, k, d = '') => { if (k) { pass++; console.log('  PASS  ' + ad); } else { fail++; console.log('  FAIL  ' + ad + (d ? '  -> ' + d : '')); } };

console.log('\n=== SUPABASE SDK: tam surume pinli + SRI ===');
{
  // Supabase SDK'yi yukleyen <script> etiketini bul
  const tag = (HTML.match(/<script\b[^>]*supabase-js@[^>]*><\/script>/) || [])[0] || '';
  ok('supabase-js <script> etiketi bulundu', !!tag, HTML.slice(0, 120));

  // src icindeki surum ifadesi: supabase-js@<SURUM> ... " ' ya da bosluga kadar
  const surum = (tag.match(/supabase-js@([^"'\s]+)/) || [])[1] || '';
  // TAM semver (X.Y.Z) sart. @2, @2.x, @latest, @next -> KIRMIZI.
  ok(`  surum TAM pinli (X.Y.Z), kayan degil  [gelen: "${surum}"]`,
     /^\d+\.\d+\.\d+$/.test(surum), surum);

  // integrity=sha384-... ve crossorigin ayni etikette
  ok('  integrity="sha384-..." mevcut',
     /integrity="sha384-[A-Za-z0-9+/=]+"/.test(tag), tag.slice(0, 200));
  ok('  crossorigin mevcut (SRI icin sart)',
     /\bcrossorigin\b/.test(tag), tag.slice(0, 200));
}

console.log('\n=== GENEL: jsdelivr npm <script> KAYAN surum tasimasin ===');
{
  // Tum <script src=...jsdelivr.net/npm/...> etiketlerini topla; her birinde
  // paket adindan sonraki surum ifadesi TAM semver olmali.
  const betikler = HTML.match(/<script\b[^>]*src="[^"]*cdn\.jsdelivr\.net\/npm\/[^"]*"[^>]*>/g) || [];
  ok('jsdelivr npm <script> sayisi >= 1 (kapsam var)', betikler.length >= 1, String(betikler.length));
  for (const b of betikler) {
    const src = (b.match(/src="([^"]+)"/) || [])[1] || '';
    // .../npm/<paket>@<surum>/...  — surum X.Y.Z olmali; @latest/@next/@<major> KIRMIZI
    const s = (src.match(/\/npm\/(?:@[^/]+\/)?[^@/]+@([^/"']+)/) || [])[1] || '';
    ok(`  pinli: ${src.slice(0, 70)}  [surum: "${s}"]`,
       /^\d+\.\d+\.\d+$/.test(s), src);
  }
}

console.log(`\nPASS=${pass}  FAIL=${fail}`);
process.exit(fail ? 1 : 0);
