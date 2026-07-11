const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://gc.zgo.at",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://api.fontshare.com",
  "font-src https://fonts.gstatic.com https://api.fontshare.com",
  "img-src 'self' data: https://cdn.marketfiyati.org.tr",
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
