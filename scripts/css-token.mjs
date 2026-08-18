// CSS degisken cozucu — renk KORUMA testleri icin.
//
// Neden var: rozet renkleri artik `:root`ta anlamsal token olarak duruyor
// (--rozet-zam-fg gibi), kural govdesinde ham hex yok. Renk iddiasini
// dogrulayan testler kural govdesinde hex ariyordu ve token'a gecince
// kirmiziya dondu -- ANLAM degismemisti, testin YONTEMI bayatlamisti.
//
// Bu cozucu iddiayi zayiflatmiyor, GUCLENDIRIYOR: artik "kuralda amber
// hex yazili mi" degil, "kuralin kullandigi token GERCEKTEN amber'e
// cozuluyor mu" sorusu sinaniyor. Token yanlis renge isaret ederse test
// kirilir; oncesinde bu yakalanamazdi.

/** `:root` (ve varsa diger blok) icindeki --degisken: deger; ciftlerini toplar. */
export function tokenHaritasi(css) {
  const harita = new Map();
  for (const m of css.matchAll(/(--[a-zA-Z0-9-]+)\s*:\s*([^;}]+)[;}]/g)) {
    const ad = m[1];
    const deger = m[2].trim();
    // Ilk tanim kazanir: `:root` dosyanin basinda, tema override'lari sonra.
    // Koyu tema degerleri AYRI isim tasiyor (--*-koyu), o yuzden cakisma yok.
    if (!harita.has(ad)) harita.set(ad, deger);
  }
  return harita;
}

/**
 * Metindeki var(--x) / var(--x, yedek) cagrilarini degerleriyle degistirir.
 * Ic ice token'lar icin sinirli sayida tur atar (dongu korumasi).
 */
export function tokenCoz(css, metin, tur = 4) {
  const harita = tokenHaritasi(css);
  let s = metin;
  for (let i = 0; i < tur; i++) {
    const oncesi = s;
    s = s.replace(/var\(\s*(--[a-zA-Z0-9-]+)\s*(?:,\s*([^()]*?))?\s*\)/g,
      (tam, ad, yedek) => harita.get(ad) ?? (yedek != null ? yedek.trim() : tam));
    if (s === oncesi) break;
  }
  return s;
}
