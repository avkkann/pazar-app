const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://gc.zgo.at",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://api.fontshare.com",
  // IKI HOSTLU DESEN — her font saglayicisi CSS'i bir hosttan, font
  // DOSYALARINI baska bir hosttan veriyor:
  //   fonts.googleapis.com (CSS)  -> fonts.gstatic.com   (woff2)   [Inter]
  //   api.fontshare.com    (CSS)  -> cdn.fontshare.com   (woff2)   [Cabinet Grotesk]
  // Googleapis cifti bastan dogru yazilmisti, fontshare ciftinin ikinci
  // yarisi atlanmisti: CSS icindeki src'ler PROTOKOL-GORELI (//cdn.fontshare.com/wf/...)
  // ve o host repoda hicbir yerde gecmiyor, yalnizca indirilen CSS'in icinde.
  // Sonuc: 2026-08-17'de canli olculdu, uzantisiz temiz profilde 6 ihlal
  // ("Loading the font 'https://cdn.fontshare.com/...woff2' violates ...
  //   font-src ... The action has been blocked") ve Cabinet Grotesk hic
  // yuklenmiyordu — .header-text h1, .hdr-left h2, .home-strip-title,
  // .detay-name, .detay-mkt-price, .product-price, .profil-istat-sayi
  // sessizce Inter'e dusuyordu.
  "font-src https://fonts.gstatic.com https://api.fontshare.com https://cdn.fontshare.com",
  // cdn.marketfiyati.org.tr  : urun resimleri (data/ icinde 14.336 urunun resmi
  //                            bu host'tan geliyor — olculdu 2026-08-17)
  // lh3.googleusercontent.com: Google OAuth avatari. app.js:225 giris yapan
  //                            kullanicinin avatarini <img src="{avatarUrl}">
  //                            ile basiyor; kaynak user_metadata.avatar_url /
  //                            picture. Google girisi canli
  //                            (signInWithOAuth provider:'google'). Bu host
  //                            olmadan avatar bloklanip bos kutu kaliyordu.
  // pazar-app.goatcounter.com: GoatCounter'in YEDEK yolu. count.js isabeti
  //                            once navigator.sendBeacon ile yolluyor
  //                            (connect-src'de zaten var), sendBeacon yoksa
  //                            document.createElement('img') + img.src'ye
  //                            dusuyor — o yol img-src'ye tabi. Olmadan
  //                            analitik SESSIZCE kayboluyordu.
  "img-src 'self' data: https://cdn.marketfiyati.org.tr https://lh3.googleusercontent.com https://pazar-app.goatcounter.com",
  "connect-src 'self' https://gbgxxahhbfnulmyecxia.supabase.co https://api.marketfiyati.org.tr https://pazar-app.goatcounter.com",
  "manifest-src 'self'",
  "base-uri 'self'",
  "form-action 'self'"
].join('; ');

export default {
  async fetch(request, env) {
    const response = await env.ASSETS.fetch(request);
    const newResponse = new Response(response.body, response);
    newResponse.headers.set('Content-Security-Policy', CSP);
    return newResponse;
  }
};
