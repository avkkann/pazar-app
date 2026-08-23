const CSP = [
  "default-src 'self'",
  // script-src'de 'unsafe-inline' BILEREK DURUYOR. Kaldirmak 117 satir ici olay
  // ozniteligini (onclick= vb.) delegasyona tasimayi gerektiriyor; o goc 4-6 turluk
  // ayri bir is olarak ERTELENDI. TETIKLEYICI: kullanici girdisi ya da ucuncu taraf
  // icerigi render eden YENI bir yuzey eklenirse one alinir.
  // NOT: nonce/hash bu maddeyi COZMEZ -- ikisi de <script> BLOKLARINI kapsar, satir
  // ici olay ozniteliklerini kapsamaz; kapsatmak icin 'unsafe-hashes' gerekir, o da
  // korumayi geri acar. Yani handler gocu yapilmadan hash'in kazanci sifir.
  "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://gc.zgo.at",
  // DARALTILDI 2026-08-22: dis font host'lari CIKARILDI.
  //   Cikanlar: fonts.googleapis.com, fonts.gstatic.com (style-src/font-src),
  //             api.fontshare.com, cdn.fontshare.com.
  //   Neden: fontlar bfbfa8f ile SELF-HOST'a alindi (style.css'teki dort
  //   @font-face de /static/fonts/*.woff2). CANLI OLCUM 2026-08-22: uygulama
  //   gezilirken (anasayfa + kategori + firsat + hal + sepet + profil) dort
  //   woff2'nin dordu de pazarapp.net'ten geldi, dort font yuzu de "loaded",
  //   ve bu dort host'a giden istek sayisi SIFIR (Resource Timing).
  //   Yani bu izinler yalnizca CSP'yi genisletiyordu, hicbir sey yuklemiyordu.
  //   TARIHCE (silinmeden once neden vardilar): her font saglayicisi CSS'i bir
  //   hosttan, woff2'yi BASKA hosttan verir (googleapis->gstatic,
  //   api.fontshare->cdn.fontshare). Self-host'tan onceki donemde ciftin ikinci
  //   yarisi atlaninca Cabinet Grotesk sessizce Inter'e dusuyordu (2026-08-17).
  //   Self-host bu tuzagi komple ortadan kaldirdi. Geri eklemek GEREKMEZ; disaridan
  //   font yuklemeye donulurse CIFTIN IKI YARISI da eklenmelidir.
  // 'unsafe-inline' KALDIRILDI 2026-08-23: 58 satir ici style="" ozniteligi CSS
  // siniflarina, 2 <style> blogu harici dosyaya tasindi (static/noscript.css,
  // static/hub.css). HASH KULLANILMADI (icerik degistikce elle bakim demek).
  // element.style / cssText yazimlari (84 adet) CSP'ye TABI DEGIL, oldugu gibi kaldi.
  "style-src 'self'",
  // 'self': fontlar self-host (static/fonts/inter-latin.woff2, index.html:50 preload).
  // 'self' YOKKEN o woff2 CSP'ce bloklaniyordu — gizli sekmede olculdu 2026-08-21.
  // Guard: test_cdn_pin.mjs worker'i KOSTURUP ciktiyi olcuyor; silinen dort host
  // herhangi bir direktife geri eklenirse KIRMIZI.
  "font-src 'self'",
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
  "form-action 'self'",
  // Siteyi hicbir yere iframe'lemiyoruz -> en siki dogru: 'none' ('self' degil).
  // Olculdu 2026-08-21: gercek uygulamada <iframe> yok, hub sayfalari/PWA iframe
  // kullanmiyor, OAuth redirect tabanli (iframe degil). _tasarim_taslak/ (design
  // taslagi) deploy EDILMIYOR. X-Frame-Options eklenmedi: frame-ancestors modern
  // ve daha guclu esdegeri. Mesru bir iframe ihtiyaci dogarsa bu 'none' engeller.
  "frame-ancestors 'none'"
].join('; ');

export default {
  async fetch(request, env) {
    const response = await env.ASSETS.fetch(request);
    const newResponse = new Response(response.body, response);
    newResponse.headers.set('Content-Security-Policy', CSP);
    // MIME-sniffing kapali: tarayici Content-Type'i tahmin etmesin (nosniff).
    newResponse.headers.set('X-Content-Type-Options', 'nosniff');
    // HSTS — KADEMELI ROLLOUT, 2. BASAMAK: SADECE max-age=86400 (1 gun).
    // 1. basamak (300 = 5 dk) 2026-08-21'de canliya cikti ve sorunsuz calisti;
    //   bu tur onu 1 gune cikariyor. Sonraki basamaklar: 1 hafta -> daha uzun.
    // includeSubDomains HALA YOK: www yonlendirmesi artik kurulu ama subdomain
    //   envanteri tek tek OLCULMEDI. Bu bayrak TUM subdomain'leri (bugun var
    //   olmayan, yarin acilacak olan dahil) HTTPS'e kilitler ve max-age dolana
    //   kadar geri ALINAMAZ. Once max-age basamaklari, sonra envanter olcumu,
    //   en son bu. Sirayi bozma.
    // preload YOK: preload listesine girmek aylarca geri ALINAMAZ, asla acele.
    // Kademeli olmanin sebebi: yanlis giderse (bir subdomain HTTP'de, sertifika
    //   sorunu) tarayici kilidi max-age kadar surer. 1 gun hala kurtarilabilir
    //   bir pencere; 1 yil degil.
    // Deger test_cdn_pin.mjs'te sabitli — burasi degisip test degismezse KIRMIZI.
    newResponse.headers.set('Strict-Transport-Security', 'max-age=86400');
    return newResponse;
  }
};
