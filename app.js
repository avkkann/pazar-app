  // ===== SUPABASE CLIENT =====
  const SUPABASE_URL = 'https://gbgxxahhbfnulmyecxia.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdiZ3h4YWhoYmZudWxteWVjeGlhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI4MjY4MDgsImV4cCI6MjA5ODQwMjgwOH0.VqJ1MAPKBbvEfS1c781iFbHisEJ9GmHvCLmwz1c6pWM';
  const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  window.supabaseClient = supabaseClient;

  // Auth state listener — global pazarAuth objesi
  window.pazarAuth = {
    user: null,
    session: null,
    ready: false
  };

  supabaseClient.auth.getSession().then(({ data: { session } }) => {
    window.pazarAuth.session = session;
    window.pazarAuth.user = session?.user || null;
    window.pazarAuth.ready = true;
    document.dispatchEvent(new CustomEvent('pazarAuthReady', { detail: window.pazarAuth }));
  });

  supabaseClient.auth.onAuthStateChange((event, session) => {
    window.pazarAuth.session = session;
    window.pazarAuth.user = session?.user || null;
    document.dispatchEvent(new CustomEvent('pazarAuthChange', { detail: { event, session, user: session?.user || null } }));
  });
  // ===== /SUPABASE CLIENT =====

  var onboardingIdx = 0;

  function onboardingUIGuncelle() {
    document.querySelectorAll('.onboarding-dot').forEach(function(d, i) { d.classList.toggle('active', i === onboardingIdx); });
    document.getElementById('onboardingNextBtn').textContent = onboardingIdx === 2 ? 'Başla' : 'İleri';
    document.querySelectorAll('.onboarding-slide').forEach(function(s, i) { s.classList.toggle('enter', i === onboardingIdx); });
  }

  function onboardingBaslat() {
    if (localStorage.getItem('pazar_onboarded') === '1') return;
    var overlay = document.getElementById('onboarding-overlay');
    if (!overlay) return;
    overlay.style.display = 'flex';
    onboardingUIGuncelle();
    var slides = document.getElementById('onboardingSlides');
    slides.addEventListener('scroll', function() {
      var idx = Math.round(slides.scrollLeft / slides.clientWidth);
      if (idx === onboardingIdx) return;
      onboardingIdx = idx;
      onboardingUIGuncelle();
    });
  }

  function onboardingIleri() {
    if (onboardingIdx >= 2) {
      onboardingBitir();
      return;
    }
    onboardingIdx++;
    var slides = document.getElementById('onboardingSlides');
    slides.scrollTo({ left: slides.clientWidth * onboardingIdx, behavior: 'smooth' });
    onboardingUIGuncelle();
  }

  function onboardingBitir() {
    localStorage.setItem('pazar_onboarded', '1');
    var overlay = document.getElementById('onboarding-overlay');
    if (overlay) overlay.style.display = 'none';
  }

  // ── SPLASH: sabit sure DEGIL, GERCEK hazir sinyali ──────────────────
  // Oncesi olculdu: setTimeout(600) + 250 ms gecis => splash 1179 ms'de
  // kalkiyordu, oysa uygulama 379 ms'de kullanilabilirdi. 800 ms'yi kullanici
  // HAZIR bir ekranin ustundeki opak katmana bakarak geciriyordu; sicak
  // acilista (327 ms'de hazir) ceza daha da buyuktu -- yani gunde birkac kez
  // acan kullanici en cok odeyen taraftl.
  //
  // Artik splash `pazar:hazir` olayini bekliyor (bkz. _anaEkraniCiz).
  // Kapanma = max(ANIMASYON BITTI, VERI HAZIR) — ikisinin GEC olani. Iki koruma:
  //   TABAN  — animasyonun BITMESI garanti olsun diye splash en az animasyon
  //            suresi kadar gorulur (CSS token --splash-toplam); veri daha erken
  //            hazirsa fark kadar bekler, GEC gelirse hic beklemez.
  //            reduced-motion'da animasyon atlandigi icin TABAN = 0.
  //            !! GERILEME DEGIL !!: 8503f6f'te "sabit 600ms bekleme" BILEREK
  //            kaldirilmisti (hazir ekranin ustundeki opak katmanda bosa beklenmesin).
  //            Bu onu geri GETIRMEZ: sabit sure degil, TABAN'i ANIMASYON SURESINE
  //            baglar. Sebep: yeni splash cok asamali (mark->ad->slogan ~1185ms);
  //            veri ~850ms'de gelince animasyon yarida kesiliyordu. Yani "bosa
  //            bekleme" degil, "baslayan animasyonu bitir". Sure buyurse (token)
  //            burasi kendiliginden uyar.
  //   KILIT  — hazir sinyali hic gelmezse kullanici opak katmanin altinda
  //            kalmasin. "Sure ayari" degil, KILITLENME korumasi: devreye girerse
  //            SESSIZ kalmaz, konsola uyari basar (4000 ms KALIR).
  (function(){
    // TARAYICI DISINDA CIK. Build betikleri app.js'i node:vm icinde kosturuyor
    // (scripts/app-vm.mjs) ve orada getComputedStyle/requestAnimationFrame yok;
    // KILIT zamanlayicisi build sirasinda atesleyip "getComputedStyle is not
    // defined" ile TUM BUILD'i dusuruyordu. Splash zaten tarayiciya ozgu.
    if (typeof getComputedStyle !== 'function' || typeof requestAnimationFrame !== 'function') return;
    var s = document.getElementById('splash');
    if (!s) return;
    var KILIT_MS = 4000;
    var gorulduT = null;
    var bitti = false;

    // CSS zaman tokenini ms'e cevirir (ms ya da s kabul eder). Iki yerde
    // (--splash-toplam, --splash-cikis) ayri sayi tutmayalim.
    function _splashMs(ad, def) {
      var ham = getComputedStyle(document.documentElement).getPropertyValue(ad);
      var v = parseFloat(ham) || def;
      if (/\ds\s*$/.test(ham.trim()) && !/ms/.test(ham)) v *= 1000;
      return v;
    }

    // Splash'in gercekten boyandigi an (ilk kare) — TABAN bundan sayilir.
    // Navigasyon anindan saymak yanlis olurdu: splash ~290 ms'de boyaniyor.
    requestAnimationFrame(function () { gorulduT = performance.now(); });

    function kaldir() {
      if (bitti) return;
      bitti = true;
      var gecen = gorulduT == null ? 0 : performance.now() - gorulduT;
      var azalt = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
      // TABAN = animasyonun bitisi (token --splash-toplam) ki animasyon yarida
      // kesilmesin; veri daha erken hazirsa fark kadar bekler (max mantigi).
      // reduced-motion'da animasyon yok -> TABAN 0, hic bekleme.
      var taban = azalt ? 0 : _splashMs('--splash-toplam', 0);
      setTimeout(function () {
        s.classList.add('gizle');
        // Sonme suresi de CSS tokeninden; reduced-motion'da aninda (0).
        var sure = azalt ? 0 : _splashMs('--splash-cikis', 200);
        setTimeout(function () {
          s.style.display = 'none';
          onboardingBaslat();
        }, sure);
      }, Math.max(0, taban - gecen));
    }

    document.addEventListener('pazar:hazir', kaldir, { once: true });
    setTimeout(function () {
      if (bitti) return;
      console.warn('[splash] hazir sinyali ' + KILIT_MS + ' ms icinde gelmedi; kilitlenme korumasi devreye girdi. loadData zinciri sonuclanmadi mi?');
      kaldir();
    }, KILIT_MS);
  })();
  // ===== AUTH UI =====
  let authTabMode = 'login';

  window.openAuthSheet = function(mode) {
    if (mode) authTabMode = mode;
    switchAuthTab(authTabMode);
    document.getElementById('auth-email').value = '';
    document.getElementById('auth-password').value = '';
    document.getElementById('auth-password-confirm').value = '';
    const errEl = document.getElementById('auth-error');
    errEl.style.display = 'none';
    errEl.style.background = '';
    errEl.style.color = '';
    document.getElementById('auth-sheet').setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  };

  window.closeAuthSheet = function() {
    document.getElementById('auth-sheet').setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  };

  window.switchAuthTab = function(mode) {
    authTabMode = mode;
    document.querySelectorAll('.auth-tab').forEach(function(t) {
      t.classList.toggle('auth-tab--active', t.dataset.tab === mode);
    });
    document.getElementById('auth-sheet-title').textContent = mode === 'login' ? 'Giriş Yap' : 'Üye Ol';
    document.getElementById('auth-submit').textContent = mode === 'login' ? 'Giriş Yap' : 'Üye Ol';
    document.getElementById('auth-password-confirm').style.display = mode === 'signup' ? 'block' : 'none';
    const errEl = document.getElementById('auth-error');
    errEl.style.display = 'none';
    errEl.style.background = '';
    errEl.style.color = '';
  };

  window.handleAuthSubmit = async function() {
    const email = document.getElementById('auth-email').value.trim();
    const password = document.getElementById('auth-password').value;
    const passwordConfirm = document.getElementById('auth-password-confirm').value;
    const errEl = document.getElementById('auth-error');
    const btn = document.getElementById('auth-submit');
    errEl.style.display = 'none';
    errEl.style.background = '';
    errEl.style.color = '';

    if (!email || !password) {
      errEl.textContent = 'E-posta ve şifre gerekli.';
      errEl.style.display = 'block';
      return;
    }
    if (password.length < 6) {
      errEl.textContent = 'Şifre en az 6 karakter olmalı.';
      errEl.style.display = 'block';
      return;
    }
    if (authTabMode === 'signup' && password !== passwordConfirm) {
      errEl.textContent = 'Şifreler eşleşmiyor.';
      errEl.style.display = 'block';
      return;
    }

    btn.disabled = true;
    const originalText = btn.textContent;
    btn.textContent = 'Lütfen bekle...';

    try {
      let result;
      if (authTabMode === 'signup') {
        result = await window.supabaseClient.auth.signUp({ email: email, password: password });
      } else {
        result = await window.supabaseClient.auth.signInWithPassword({ email: email, password: password });
      }

      if (result.error) {
        let msg = result.error.message;
        if (msg.indexOf('Invalid login credentials') !== -1) msg = 'E-posta veya şifre hatalı.';
        else if (msg.indexOf('already registered') !== -1 || msg.indexOf('User already') !== -1) msg = 'Bu e-posta zaten kayıtlı.';
        else if (msg.indexOf('Email not confirmed') !== -1) msg = 'E-postanı onaylaman gerekiyor.';
        else if (msg.indexOf('Password should be') !== -1) msg = 'Şifre çok zayıf — daha güçlü bir şifre dene.';
        errEl.textContent = msg;
        errEl.style.display = 'block';
      } else {
        if (authTabMode === 'signup' && result.data && result.data.user && !result.data.session) {
          errEl.style.background = '#ecfdf5';
          errEl.style.color = '#065f46';
          errEl.textContent = 'E-postanı kontrol et — onay linki gönderdik.';
          errEl.style.display = 'block';
        } else {
          closeAuthSheet();
        }
      }
    } catch (err) { console.warn('[onboarding] kapanis kaydedilemedi, ekran tekrar cikabilir:', err && err.message);
      errEl.textContent = 'Beklenmeyen bir hata: ' + err.message;
      errEl.style.display = 'block';
    } finally {
      btn.disabled = false;
      btn.textContent = originalText;
    }
  };

  window.handleGoogleLogin = async function() {
    const result = await window.supabaseClient.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin + window.location.pathname }
    });
    if (result.error) {
      const errEl = document.getElementById('auth-error');
      errEl.textContent = 'Google ile giriş başarısız: ' + result.error.message;
      errEl.style.display = 'block';
    }
  };

  window.handleLogout = async function() {
    await window.supabaseClient.auth.signOut();
  };
  // ===== /AUTH UI =====
  // ===== PROFIL AUTH RENDER =====
  let pazarProfile = null;

  async function loadPazarProfile() {
    if (!window.pazarAuth?.user) { pazarProfile = null; return; }
    try {
      const { data, error } = await window.supabaseClient
        .from('profiles')
        .select('id, email, ad, avatar_url')
        .eq('id', window.pazarAuth.user.id)
        .single();
      if (!error) pazarProfile = data;
    } catch (e) { console.warn('[profil] kullanici profili yuklenemedi, ad/avatar bos kalacak:', e && e.message); }
  }

  window.renderProfilAuth = function() {
    const user = window.pazarAuth?.user;
    const avatar = document.getElementById('profilAvatar');
    const isim = document.getElementById('profilIsim');
    const alt = document.getElementById('profilAlt');
    const ctaEl = document.getElementById('profil-auth-cta');
    const logoutEl = document.getElementById('profil-auth-logout');
    if (!avatar || !isim || !alt || !ctaEl || !logoutEl) return;

    if (user) {
      // Login durumu
      const ad = pazarProfile?.ad || user.user_metadata?.full_name || user.user_metadata?.name || (user.email ? user.email.split('@')[0] : 'Kullanıcı');
      const avatarUrl = pazarProfile?.avatar_url || user.user_metadata?.avatar_url || user.user_metadata?.picture;
      if (avatarUrl) {
        avatar.classList.remove('profil-avatar--letter');
        avatar.innerHTML = '<img src="' + avatarUrl + '" alt="" referrerpolicy="no-referrer">';
      } else {
        avatar.classList.add('profil-avatar--letter');
        avatar.innerHTML = '';
        avatar.textContent = (ad[0] || '?').toUpperCase();
      }
      isim.innerHTML = ad.replace(/</g, '&lt;');
      isim.style.cursor = 'pointer';
      isim.onclick = duzenleKullaniciAdi;
      isim.removeAttribute('onclick');
      alt.textContent = user.email || '';
      ctaEl.style.display = 'none';
      logoutEl.style.display = 'block';
    } else {
      // Misafir
      avatar.classList.remove('profil-avatar--letter');
      avatar.innerHTML = '';
      avatar.textContent = '🛒';
      isim.innerHTML = 'Pazar Kullanıcısı';
      isim.style.cursor = 'default';
      isim.onclick = null;
      isim.removeAttribute('onclick');
      alt.textContent = 'Üye ol, favorilerini ve fiyat alarmlarını eşitle';
      ctaEl.style.display = 'flex';
      logoutEl.style.display = 'none';
    }
  };

  window.confirmLogout = async function() {
    const onay = await modalAc({ title: 'Çıkış yap', msg: 'Çıkış yapmak istediğine emin misin?', okText: 'Çıkış yap', danger: true });
    if (!onay) return;
    await window.handleLogout();
  };

  // Auth event listeners
  document.addEventListener('pazarAuthReady', async () => {
    await loadPazarProfile();
    window.renderProfilAuth();
  });
  document.addEventListener('pazarAuthChange', async () => {
    await loadPazarProfile();
    window.renderProfilAuth();
  });

  // DOM hazır olduğunda da bir kez çalıştır (pazarAuthReady ondan önce gelmiş olabilir)
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', async () => {
      if (window.pazarAuth?.ready) { await loadPazarProfile(); window.renderProfilAuth(); }
    });
  } else {
    (async () => {
      if (window.pazarAuth?.ready) { await loadPazarProfile(); window.renderProfilAuth(); }
    })();
  }
  // ===== /PROFIL AUTH RENDER =====
  // ===== FAVORİLER =====
  window.pazarFavSet = new Set();

  async function loadPazarFavoriler() {
    if (!window.pazarAuth?.user) { window.pazarFavSet = new Set(); refreshFavButtons(); return; }
    try {
      const { data, error } = await window.supabaseClient
        .from('favoriler')
        .select('urun_sid')
        .eq('user_id', window.pazarAuth.user.id);
      if (error) { console.warn('Favoriler yüklenemedi:', error.message); return; }
      window.pazarFavSet = new Set((data || []).map(r => r.urun_sid));
      refreshFavButtons();
    } catch (e) { console.warn('Favori yükleme hatası:', e); }
  }

  window.refreshFavButtons = function() {
    document.querySelectorAll('.fav-btn[data-sid]').forEach(btn => {
      const sid = btn.getAttribute('data-sid');
      btn.classList.toggle('is-fav', window.pazarFavSet.has(sid));
      btn.setAttribute('aria-pressed', window.pazarFavSet.has(sid) ? 'true' : 'false');
    });
  };

  window.favToggle = async function(sid, btnEl) {
    if (!sid) return;
    const user = window.pazarAuth?.user;
    if (!user) {
      if (typeof window.openAuthSheet === 'function') window.openAuthSheet('login');
      return;
    }
    const isFav = window.pazarFavSet.has(sid);
    // Optimistic UI
    if (isFav) window.pazarFavSet.delete(sid); else window.pazarFavSet.add(sid);
    refreshFavButtons();
    try {
      let error;
      if (isFav) {
        const res = await window.supabaseClient.from('favoriler')
          .delete()
          .match({ user_id: user.id, urun_sid: sid });
        error = res.error;
      } else {
        const res = await window.supabaseClient.from('favoriler')
          .insert({ user_id: user.id, urun_sid: sid });
        error = res.error;
      }
      if (error) {
        // Rollback
        if (isFav) window.pazarFavSet.add(sid); else window.pazarFavSet.delete(sid);
        refreshFavButtons();
        console.warn('Favori güncellenemedi:', error.message);
      }
    } catch (e) {
      if (isFav) window.pazarFavSet.add(sid); else window.pazarFavSet.delete(sid);
      refreshFavButtons();
      console.warn('Favori toggle hatası:', e);
    }
  };

  window.favBtnHTML = function(sid) {
    if (!sid) return '';
    const isFav = window.pazarFavSet.has(sid);
    return `<button class="fav-btn${isFav ? ' is-fav' : ''}" data-sid="${_kacir(sid)}" aria-pressed="${isFav ? 'true' : 'false'}" aria-label="Favoriye ekle" onclick="event.stopPropagation(); favToggle(this.dataset.sid, this)"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg></button>`;
  };

  document.addEventListener('pazarAuthReady', loadPazarFavoriler);
  document.addEventListener('pazarAuthChange', loadPazarFavoriler);

  // Fallback: pazarAuthReady event bu script parse olmadan önce fire olmuş olabilir
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      if (window.pazarAuth?.ready) loadPazarFavoriler();
    });
  } else {
    if (window.pazarAuth?.ready) loadPazarFavoriler();
  }
  window.openFavoriler = async function() {
    if (!window.pazarAuth?.user) {
      if (typeof window.openAuthSheet === 'function') window.openAuthSheet('login');
      return;
    }
    showScreen('screen-favoriler');
    document.getElementById('screen-favoriler').scrollTop = 0;
    await renderFavorilerScreen();
  };

  window.renderFavorilerScreen = async function() {
    const container = document.getElementById('favorilerContent');
    if (!container) return;
    const favSids = [...(window.pazarFavSet || [])];
    if (favSids.length === 0) {
      container.innerHTML = `
        <div class="fav-empty">
          <div class="fav-empty-icon">💔</div>
          <div class="fav-empty-title">Henüz favorin yok</div>
          <div class="fav-empty-sub">Ürün kartlarındaki kalp ikonuna basarak favori ekleyebilirsin</div>
        </div>`;
      return;
    }
    container.innerHTML = `<div class="fav-loading">Favoriler yükleniyor...</div>`;

    // Eksik kategorileri yükle (sid formatı: kategori_slug)
    const kategoriler = [...new Set(favSids.map(sid => sid.split('_')[0]))];
    await Promise.all(kategoriler.map(async kat => {
      try {
        if (typeof loadCat === 'function' && !productMap[kat + '_0']) await loadCat(kat);
      } catch(e) { console.warn('[favori] kategori yuklenemedi, favoriler eksik gorunebilir:', kat, e && e.message); }
    }));

    // productMap key formatı tutarlı değil — Object.values'tan sidMap oluştur
    const sidMap = {};
    Object.values(productMap).forEach(u => { if (u && u._sid) sidMap[u._sid] = u; });
    const urunler = favSids.map(sid => sidMap[sid] || productMap[sid]).filter(Boolean);
    const bulunamayan = favSids.length - urunler.length;

    if (urunler.length === 0) {
      container.innerHTML = `
        <div class="fav-empty">
          <div class="fav-empty-icon">🔍</div>
          <div class="fav-empty-title">Favorilerin bulunamadı</div>
          <div class="fav-empty-sub">Ürün verileri güncelleniyor olabilir, biraz sonra tekrar dene</div>
        </div>`;
      return;
    }

    const grid = urunler.map(u => cardHTML(u)).join('');
    const footer = bulunamayan > 0
      ? `<div class="fav-footer-note">${bulunamayan} favori ürün gösterilemiyor (veri güncellenmiş olabilir)</div>`
      : '';
    container.innerHTML = `<div class="product-list">${grid}</div>${footer}`;
  };

  // ===== /FAVORİLER =====
  // ===== FİYAT ALARMI =====
  window.pazarAlarmMap = new Map();

  async function loadPazarAlarmlar() {
    if (!window.pazarAuth?.user) { window.pazarAlarmMap = new Map(); return; }
    try {
      const { data, error } = await window.supabaseClient
        .from('fiyat_alarmlari')
        .select('urun_sid, hedef_fiyat')
        .eq('user_id', window.pazarAuth.user.id)
        .eq('aktif_mi', true);
      if (error) { console.warn('Alarmlar yüklenemedi:', error.message); return; }
      window.pazarAlarmMap = new Map((data || []).map(r => [r.urun_sid, r.hedef_fiyat]));
    } catch (e) { console.warn('Alarm yükleme hatası:', e); }
  }

  window.refreshDetayAlarm = function(sid) {
    const box = document.getElementById('alarmBlogu-' + sid);
    if (!box) return;
    const u = Object.values(productMap).find(p => p && p._sid === sid);
    if (u) box.outerHTML = fiyatAlarmiBlogu(u);
  };

  window.fiyatAlarmKur = async function(sid) {
    if (!sid) return;
    const user = window.pazarAuth?.user;
    if (!user) {
      if (typeof window.openAuthSheet === 'function') window.openAuthSheet('login');
      return;
    }
    const input = document.getElementById('alarmInput-' + sid);
    const hedef = parseFloat(input?.value);
    if (!hedef || hedef <= 0) { input?.focus(); return; }
    const eski = window.pazarAlarmMap.get(sid);
    window.pazarAlarmMap.set(sid, hedef);
    window.refreshDetayAlarm(sid);
    try {
      const { error } = await window.supabaseClient
        .from('fiyat_alarmlari')
        .upsert({ user_id: user.id, urun_sid: sid, hedef_fiyat: hedef, aktif_mi: true }, { onConflict: 'user_id,urun_sid' });
      if (error) {
        if (eski == null) window.pazarAlarmMap.delete(sid); else window.pazarAlarmMap.set(sid, eski);
        window.refreshDetayAlarm(sid);
        console.warn('Alarm kurulamadı:', error.message);
        return;
      }
      if (typeof Notification !== 'undefined' && Notification.permission === 'default' && !sessionStorage.getItem('_alarmBildirimOnerisiGosterildi')) {
        sessionStorage.setItem('_alarmBildirimOnerisiGosterildi', '1');
        setTimeout(() => { if (typeof toastGoster === 'function') toastGoster('Fiyat düşünce haber almak için Profil > Bildirimler\'i aç'); }, 600);
      }
    } catch (e) {
      if (eski == null) window.pazarAlarmMap.delete(sid); else window.pazarAlarmMap.set(sid, eski);
      window.refreshDetayAlarm(sid);
      console.warn('Alarm kurma hatası:', e);
    }
  };

  window.fiyatAlarmKaldir = async function(sid) {
    if (!sid) return;
    const user = window.pazarAuth?.user;
    if (!user) return;
    const eski = window.pazarAlarmMap.get(sid);
    window.pazarAlarmMap.delete(sid);
    window.refreshDetayAlarm(sid);
    try {
      const { error } = await window.supabaseClient
        .from('fiyat_alarmlari')
        .update({ aktif_mi: false })
        .match({ user_id: user.id, urun_sid: sid });
      if (error) {
        window.pazarAlarmMap.set(sid, eski);
        window.refreshDetayAlarm(sid);
        console.warn('Alarm kaldırılamadı:', error.message);
      }
    } catch (e) {
      window.pazarAlarmMap.set(sid, eski);
      window.refreshDetayAlarm(sid);
      console.warn('Alarm kaldırma hatası:', e);
    }
  };

  document.addEventListener('pazarAuthReady', loadPazarAlarmlar);
  document.addEventListener('pazarAuthChange', loadPazarAlarmlar);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      if (window.pazarAuth?.ready) loadPazarAlarmlar();
    });
  } else {
    if (window.pazarAuth?.ready) loadPazarAlarmlar();
  }
  // ===== /FİYAT ALARMI =====
  // ===== BİLDİRİMLER (PUSH) =====
  const PUSH_VAPID_PUBLIC_KEY = 'BHvsLWY9utiO0DOaI1zKIKKWixLDAGfGhb_C6AC_yRvy43IpFaaTese8nG_wyPy4SiILksxAH48C6viCiYUBXBQ';

  function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; i++) outputArray[i] = rawData.charCodeAt(i);
    return outputArray;
  }

  function pushDesteklerMi() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return false;
    const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
    if (isIOS && !window.navigator.standalone) return false;
    return true;
  }

  async function bildirimDurumGuncelle() {
    const el = document.getElementById('bildirimDurumYazi');
    if (!el) return;
    if (!pushDesteklerMi()) {
      el.textContent = /iphone|ipad|ipod/i.test(navigator.userAgent)
        ? 'Açmak için uygulamayı ana ekrana ekle'
        : 'Bu tarayıcı desteklemiyor';
      return;
    }
    if (Notification.permission === 'denied') {
      el.textContent = 'Tarayıcı ayarlarından izin ver';
      return;
    }
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      el.textContent = sub ? 'Açık ✓' : 'Alarm kurduğun ürünler için haber al';
    } catch (e) { /* bildirim izni okunamadi: altta notr aciklama metni yaziliyor, kullanici yine dogru bilgi goruyor */ el.textContent = 'Alarm kurduğun ürünler için haber al'; }
  }

  window.bildirimAbonelikToggle = async function() {
    const user = window.pazarAuth?.user;
    if (!user) {
      if (typeof window.openAuthSheet === 'function') window.openAuthSheet('login');
      return;
    }
    if (!pushDesteklerMi()) { bildirimDurumGuncelle(); return; }
    const el = document.getElementById('bildirimDurumYazi');
    try {
      const reg = await navigator.serviceWorker.ready;
      const mevcut = await reg.pushManager.getSubscription();
      if (mevcut) {
        await window.supabaseClient.from('push_subscriptions').delete().match({ user_id: user.id, endpoint: mevcut.endpoint });
        await mevcut.unsubscribe();
        if (el) el.textContent = 'Alarm kurduğun ürünler için haber al';
        return;
      }
      const izin = await Notification.requestPermission();
      if (izin !== 'granted') {
        if (el) el.textContent = 'İzin verilmedi';
        return;
      }
      const yeniSub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(PUSH_VAPID_PUBLIC_KEY)
      });
      const j = yeniSub.toJSON();
      const { error } = await window.supabaseClient.from('push_subscriptions').upsert({
        user_id: user.id,
        endpoint: yeniSub.endpoint,
        p256dh: j.keys.p256dh,
        auth_key: j.keys.auth
      }, { onConflict: 'user_id,endpoint' });
      if (error) { console.warn('Push subscription kaydedilemedi:', error.message); if (el) el.textContent = 'Kaydedilemedi, tekrar dene'; return; }
      if (el) el.textContent = 'Açık ✓';
    } catch (e) {
      console.warn('Bildirim abonelik hatası:', e);
      if (el) el.textContent = 'Bir hata oluştu, tekrar dene';
    }
  };

  document.addEventListener('DOMContentLoaded', bildirimDurumGuncelle);
  // ===== /BİLDİRİMLER (PUSH) =====
// ── SABİTLER ──────────────────────────────────────────
const MARKET_NAMES = {
  a101:'A101', bim:'BİM', carrefour:'CarrefourSA',
  migros:'Migros', sok:'ŞOK', tarim_kredi:'T.Kredi',
  hakmar:'Hakmar'
};

// ── KAÇIRMA (escape) ─────────────────────────────────────────────
// f.market (marketfiyati.org.tr API -> scraper.py -> data/urunler_*.json)
// ÜÇÜNCÜ TARAF kaynaklı bir dize. Tanınan kodlar MARKET_NAMES'ten sabit
// Türkçe adlara geçiyor ama tanınmayan kod ham haliyle innerHTML'e
// basılabiliyor -- bu, o ham geçişleri HTML'e güvenli hale getirir.
// Yalnızca HTML metin/öznitelik bağlamı içindir; bu depoda merkezî bir
// kaçış katmanı YOK (DENETIM.md 1.5, 79 innerHTML çağrısı açık kalıyor,
// bu fonksiyon o borcu kapatmıyor). & MUTLAKA ilk çevrilir, yoksa
// sonraki değişimler çift kaçışa (&amp;lt; gibi) yol açar.
function _kacir(metin) {
  if (metin === null || metin === undefined) return '';
  return String(metin)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ── URL BAĞLAMI (href/src için ŞEMA BEYAZ LİSTESİ) ───────────────────
// _kacir metin/öznitelik bağlamını kapatır ama URL bağlamını KAPATMAZ:
// src="${_kacir(u)}" tırnak kırılmasını önler, fakat u="javascript:alert(1)"
// _kacir'den DEĞİŞMEDEN geçer (: < > " ' içermiyor) ve href/src'ye
// yerleşince tıklamada/yüklemede script çalışır. unsafe-inline yayında
// olduğu için (src/worker.js) bu artık teorik değil.
//   NE YAPAR: yalnızca http(s), protokol-göreli (//) ve aynı-origin göreli
//     yollara (/, ./, ../) izin verir; sonucu _kacir'den geçirir (öznitelik
//     tırnağı da güvenli). Şema tanınmazsa (javascript:, data:, vbscript:,
//     file:, blob:) BOŞ dize döner -> href/src etkisiz kalır, onerror yedeği
//     devreye girer.
//   NE YAPMAZ: URL'nin nereye gittiğini (açık yönlendirme / SSRF) denetlemez;
//     yalnızca ŞEMAyı sınırlar. Satır içi olay özniteliği (onclick=) üretmez;
//     o bağlam bu turda kapsam dışı (unsafe-inline göçü ayrı proje).
function _guvenliUrl(url) {
  const s = String(url === null || url === undefined ? '' : url).trim();
  if (!s) return '';
  // http:// https:// //host  |  /yol  ./yol  ../yol  -> güvenli kabul
  if (/^(https?:)?\/\//i.test(s) || /^\.{0,2}\//.test(s)) return _kacir(s);
  return '';
}

// ── MARKET SINIFI (class özniteliği için BEYAZ LİSTE) ────────────────
// Bu, İKİNCİ tekrar: bir tur önce m-tag'in METNİ kaçırıldı (_kacir eklendi)
// ama CLASS özniteliği unutuldu -- sonuç ham geçiyordu:
//   <span class="m-tag m-<img src=x onerror=alert(1)>">...
// f.market marketfiyati.org.tr API -> scraper.py -> data/urunler_*.json
// üzerinden gelen ÜÇÜNCÜ TARAF dize. Öznitelik (class="...") bağlamında
// _kacir (kaçış) YETERSİZ: değer kaçırılsa bile class'ın KENDİSİ (öznitelik
// sınırı) kırılabilir. Doğru savunma kaçış değil BEYAZ LİSTEdir -- yalnızca
// [a-z0-9_-] karakterleri class adı olarak anlamlı olabilir, gerisi risktir.
// style.css'teki .m-a101/.m-bim/.m-carrefour/.m-migros/.m-sok/.m-tarim_kredi/
// .m-hakmar/.m-default AYNEN korunmalı -- bu yüzden tanınan kodlar bu
// süzgeçten DEĞİŞMEDEN geçer (bkz. test_esit_fiyat.mjs). (DENETIM.md 1.5
// hâlâ kapalı: 79 innerHTML borcu duruyor, bu fonksiyon o borcu KAPATMIYOR,
// yalnızca market etiketi üretimini tek yerden geçirip aynı hatanın ÜÇÜNCÜ
// kez tekrarlanmasını engelliyor.)
function _marketSinifi(kod) {
  const slug = String(kod === null || kod === undefined ? '' : kod)
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '');
  return slug || 'default';
}

// Tam <span class="m-tag m-SLUG">Etiket</span> üretir. Çağıran ne class'ı
// ne metni kendi kurmasın diye METİN ve ÖZNİTELİK bağlamlarını BİRLİKTE ele
// alan TEK yardımcı budur -- ikisini ayrı ayrı elde etme hatası (bkz. yukarı)
// böylece tekrarlanamaz.
function _marketEtiketiHTML(kod) {
  const etiket = MARKET_NAMES[kod] || _kacir(kod) || '?';
  return `<span class="m-tag m-${_marketSinifi(kod)}">${etiket}</span>`;
}

const KAT_EMOJI = {
  meyve:'🍎', sebze:'🥦', et:'🥩', sut:'🧀',
  gida:'🥫', icecek:'🥤', temizlik:'🧴', atistirmalik:'🍫', dondurulmus:'🧊', diger:'📦'
};
// `ikon` = _LUCIDE_PATHS anahtari. Onceki `emoji` alani kaldirildi: kategori
// izgarasi artik markanin SVG dilini kullaniyor (isletim sistemi emojisi
// iOS'ta Apple, Windows'ta Segoe ciziyordu -- marka kendi en buyuk gorsel
// ogesini kontrol edemiyordu). `img` alani da kaldirildi: static/cat/*.png
// bekliyordu ama o klasor hic var olmadi ve alan HICBIR yerde okunmuyordu
// (olculdu: k.img 0 kullanim, k.emoji yalnizca renderCatGrid'de 1).
//
// DIKKAT: serit/urun kartlarinin foto yedegindeki emoji AYRI bir kaynaktan
// geliyor (placeholderRenk'in kendi haritasi) -- ona dokunulmadi.
const KATEGORILER = [
  { slug:'meyve-sebze', label:'Meyve & Sebze', ikon:'apple',      file:'urunler_meyve' },
  { slug:'et',          label:'Et & Tavuk',    ikon:'drumstick',  file:'urunler_et'    },
  { slug:'sut',         label:'Süt & Kahvaltı',ikon:'milk',       file:'urunler_sut'   },
  { slug:'gida',        label:'Temel Gıda',    ikon:'wheat',      file:'urunler_gida'  },
  { slug:'icecek',      label:'İçecek',        ikon:'cup-soda',   file:'urunler_icecek'},
  { slug:'temizlik',    label:'Temizlik',      ikon:'spray-can',  file:'urunler_temizlik'},
  { slug:'atistirmalik',label:'Atıştırmalık',  ikon:'cookie',     file:'urunler_atistirmalik'},
  { slug:'dondurulmus', label:'Dondurulmuş',   ikon:'snowflake',  file:'urunler_dondurulmus'},
];
const PAGE_SIZE = 48;

// ── DURUM ─────────────────────────────────────────────
let halMap = {};
let catCache = {};    // slug → [products with _id]
let productMap = {};  // _id → product
let urunler = [];     // görünen ürünler (toggleSepet için)
let currentKategori = null, currentSayfa = 1, toplamSayfa = 1, yukleniyor = false;
let activeMarket = null;
let _prevScreen = 'screen-home';

// Eski format sepeti temizle (id → _id migrasyonu)
let _rawSepet = JSON.parse(localStorage.getItem('pazar_sepet') || '[]');
if (_rawSepet.length && _rawSepet[0].id !== undefined && _rawSepet[0]._id === undefined) {
  _rawSepet = [];
  localStorage.setItem('pazar_sepet', '[]');
}
let sepet = _rawSepet;

// === ŞABLON SİSTEMİ (veri katmanı) ===
let _rawSablonlar = JSON.parse(localStorage.getItem('pazar_sablonlar') || '[]');
let sablonlar = Array.isArray(_rawSablonlar) ? _rawSablonlar : [];

function sablonKaydet(ad) {
  if (!ad || !ad.trim()) return null;
  if (!sepet.length) return null;
  const yeni = {
    id: 'sbl_' + Date.now() + '_' + Math.random().toString(36).slice(2,7),
    ad: ad.trim().slice(0, 40),
    urunIds: sepet.map(u => {
      const sid = u._sid || (productMap[u._id] && productMap[u._id]._sid) || null;
      const parcalar = (u._id || '').split('_');
      const slug = parcalar.length >= 2 ? parcalar.slice(0, -1).join('_') : '';
      return { sid: sid, slug: slug };
    }).filter(o => o.sid && o.slug),
    olusturma: Date.now()
  };
  if (!yeni.urunIds.length) return null;
  sablonlar.push(yeni);
  localStorage.setItem('pazar_sablonlar', JSON.stringify(sablonlar));
  return yeni;
}

function sablonAdGuncelle(id, yeniAd) {
  if (!yeniAd || !yeniAd.trim()) return false;
  const s = sablonlar.find(x => x.id === id);
  if (!s) return false;
  s.ad = yeniAd.trim().slice(0, 40);
  localStorage.setItem('pazar_sablonlar', JSON.stringify(sablonlar));
  return true;
}

function sablonSil(id) {
  sablonlar = sablonlar.filter(s => s.id !== id);
  localStorage.setItem('pazar_sablonlar', JSON.stringify(sablonlar));
}

let _modalResolve = null;

function modalAc(opts) {
  return new Promise(resolve => {
    document.getElementById('appModalTitle').textContent = opts.title || '';
    document.getElementById('appModalMsg').textContent = opts.msg || '';
    // İsteğe bağlı zengin içerik alanı (ör. market seçim pill'leri).
    const bodyEl = document.getElementById('appModalBody');
    if (bodyEl) {
      if (opts.bodyHtml) { bodyEl.innerHTML = opts.bodyHtml; bodyEl.style.display = 'block'; }
      else { bodyEl.innerHTML = ''; bodyEl.style.display = 'none'; }
    }
    const inputEl = document.getElementById('appModalInput');
    if (opts.input) {
      inputEl.style.display = 'block';
      inputEl.value = opts.defaultValue || '';
      inputEl.placeholder = opts.placeholder || '';
    } else {
      inputEl.style.display = 'none';
      inputEl.value = '';
    }
    const okBtn = document.getElementById('appModalOk');
    okBtn.textContent = opts.okText || 'Tamam';
    okBtn.classList.toggle('danger', !!opts.danger);
    const cancelBtn = document.querySelector('.app-modal-cancel');
    const backdrop = document.querySelector('.app-modal-backdrop');

    let done = false;
    const cleanup = () => {
      document.getElementById('appModal').style.display = 'none';
      if (bodyEl) { bodyEl.innerHTML = ''; bodyEl.style.display = 'none'; }
      okBtn.onclick = null;
      if (cancelBtn) cancelBtn.onclick = null;
      if (backdrop) backdrop.onclick = null;
      _modalResolve = null;
    };

    okBtn.onclick = () => {
      if (done) return;
      done = true;
      const val = opts.input ? inputEl.value.trim() : true;
      cleanup();
      resolve(opts.input ? (val || null) : true);
    };

    const close = () => {
      if (done) return;
      done = true;
      cleanup();
      resolve(false);
    };

    if (cancelBtn) cancelBtn.onclick = close;
    if (backdrop) backdrop.onclick = close;

    _modalResolve = close;

    document.getElementById('appModal').style.display = 'flex';
    if (opts.input) setTimeout(() => inputEl.focus(), 50);
  });
}

function modalKapat() {
  if (_modalResolve) _modalResolve();
}

document.addEventListener('keydown', e => {
  const m = document.getElementById('appModal');
  if (!m || m.style.display === 'none') return;
  if (e.key === 'Enter') { e.preventDefault(); document.getElementById('appModalOk').click(); }
  if (e.key === 'Escape') { e.preventDefault(); modalKapat(); }
});

function _sablonDisplayAd(ad) {
  const SISTEM_ADLAR = {
    'TEKRAR_HAFTALIK': 'Haftalık Temel',
    'KAHVALTI_SETI': 'Kahvaltı Seti',
    'OGRUNCULER_İCİN': 'Öğrenciler İçin',
    'DIYET': 'Diyet Listesi',
    'RAMAZAN': 'Ramazan Koruması'
  };
  if (SISTEM_ADLAR[ad]) return SISTEM_ADLAR[ad];
  if (ad && ad.includes('_') && ad === ad.toUpperCase() && ad.length > 3) {
    return ad.replace(/_/g, ' ').replace(/\b\w/g, function(c){return c.toUpperCase();});
  }
  return ad;
}

function renderSablonBar() {
  const bar = document.getElementById('sablonBar');
  if (!bar) return;
  let html = '<button class="sablon-chip add" onclick="sablonKaydetUI()">+ Şablon kaydet</button>';
  sablonlar.forEach(s => {
    const sidAttr = _kacir(s.id);  // öznitelik değeri; handler this.dataset.id'den okur
    const adSafe = _kacir(_sablonDisplayAd(s.ad) || 'Şablon');  // S3: localStorage şablon adı, metin bağlamı
    html += '<span class="sablon-chip" data-id="' + sidAttr + '" '
         + 'onclick="sablonYukleUI(this.dataset.id)" '
         + 'oncontextmenu="event.preventDefault();sablonDuzenleUI(this.dataset.id);return false;" '
         + 'title="Tıkla: yükle | Sağ tık / uzun bas: düzenle">'
         + adSafe
         + ' <button class="sablon-chip-del" data-id="' + sidAttr + '" onclick="event.stopPropagation();sablonSilUI(this.dataset.id)" title="Sil">×</button>'
         + '</span>';
  });
  bar.innerHTML = html;
  bar.querySelectorAll('.sablon-chip:not(.add)').forEach((chip, i) => {
    let timer = null;
    chip.addEventListener('touchstart', () => {
      timer = setTimeout(() => {
        timer = null;
        sablonDuzenleUI(sablonlar[i].id);
      }, 500);
    }, { passive: true });
    chip.addEventListener('touchend', () => { if (timer) clearTimeout(timer); });
    chip.addEventListener('touchmove', () => { if (timer) { clearTimeout(timer); timer = null; } });
  });
}

async function sablonKaydetUI() {
  if (!sepet.length) {
    await modalAc({ title: 'Liste boş', msg: 'Kaydedilecek ürün yok.', okText: 'Tamam' });
    return;
  }
  const ad = await modalAc({
    title: 'Şablon kaydet',
    msg: 'Bu listeye bir ad verin.',
    input: true,
    defaultValue: 'Haftalık',
    placeholder: 'Örn: Haftalık alışveriş',
    okText: 'Kaydet'
  });
  if (!ad) return;

  const gerekliSluglar = new Set();
  sepet.forEach(u => {
    const parc = (u._id || '').split('_');
    if (parc.length >= 2) gerekliSluglar.add(parc.slice(0, -1).join('_'));
  });
  const yuklenecekler = [];
  gerekliSluglar.forEach(slug => {
    if (!productMap[slug + '_0']) yuklenecekler.push(slug);
  });
  if (yuklenecekler.length) {
    try {
      await Promise.all(yuklenecekler.map(slug => loadCat(slug)));
    } catch (e) { console.warn('[sablon] liste kaydedilemedi, kullanicinin listesi kayboldu:', e && e.message);
      await modalAc({
        title: 'Bağlantı hatası',
        msg: 'Ürün verileri yüklenemedi. İnternet bağlantınızı kontrol edin.',
        okText: 'Tamam'
      });
      return;
    }
  }

  const yeni = sablonKaydet(ad);
  if (yeni) {
    renderSablonBar();
  } else {
    await modalAc({
      title: 'Kaydedilemedi',
      msg: 'Şablon kaydedilemedi. Ürün bilgileri eksik olabilir.',
      okText: 'Tamam'
    });
  }
}

async function sablonYukleUI(id) {
  const s = sablonlar.find(x => x.id === id);
  if (!s) return;
  const onay = await modalAc({
    title: 'Şablonu yükle',
    msg: '"' + s.ad + '" şablonu yüklenecek. Mevcut listeniz silinecek.',
    okText: 'Yükle'
  });
  if (!onay) return;

  // 1) Şablondaki _id'lerden gerekli kategori slug'larını çıkar
  const gerekliSluglar = new Set();
  s.urunIds.forEach(item => {
    if (typeof item === 'string') {
      const parcalar = item.split('_');
      if (parcalar.length >= 2) {
        gerekliSluglar.add(parcalar.slice(0, -1).join('_'));
      }
    } else if (item && typeof item === 'object' && item.slug) {
      gerekliSluglar.add(item.slug);
    }
  });

  // 2) productMap'te HENÜZ olmayan kategorileri tespit et
  // Bir kategori yüklenmişse productMap içinde "slug_0" anahtarı bulunur
  const yuklenecekler = [];
  gerekliSluglar.forEach(slug => {
    if (!productMap[slug + '_0']) yuklenecekler.push(slug);
  });

  // 3) Eksik kategorileri paralel yükle
  if (yuklenecekler.length) {
    try {
      await Promise.all(yuklenecekler.map(slug => loadCat(slug)));
    } catch (e) { console.warn('[sablon] kayitli liste yuklenemedi:', e && e.message);
      await modalAc({
        title: 'Bağlantı hatası',
        msg: 'Ürün verileri yüklenirken hata oluştu. Lütfen internet bağlantınızı kontrol edin.',
        okText: 'Tamam'
      });
      return;
    }
  }

  // 4) Şimdi şablonu uygula
  const r = sablonYukle(id);
  renderSepet();
  renderSablonBar();
  if (r.atlanan > 0) {
    await modalAc({
      title: 'Kısmen yüklendi',
      msg: r.yuklenen + ' ürün yüklendi, ' + r.atlanan + ' ürün artık katalogda yok.',
      okText: 'Tamam'
    });
  }
}

async function sablonSilUI(id) {
  const s = sablonlar.find(x => x.id === id);
  if (!s) return;
  const onay = await modalAc({
    title: 'Şablonu sil',
    msg: '"' + s.ad + '" şablonu silinecek. Bu işlem geri alınamaz.',
    okText: 'Sil',
    danger: true
  });
  if (!onay) return;
  sablonSil(id);
  renderSablonBar();
}

async function sablonDuzenleUI(id) {
  const s = sablonlar.find(x => x.id === id);
  if (!s) return;
  const yeniAd = await modalAc({
    title: 'Şablon adını düzenle',
    input: true,
    defaultValue: s.ad,
    okText: 'Kaydet'
  });
  if (!yeniAd || yeniAd === s.ad) return;
  sablonAdGuncelle(id, yeniAd);
  renderSablonBar();
}

function sablonYukle(id) {
  const s = sablonlar.find(x => x.id === id);
  if (!s) return { yuklenen: 0, atlanan: 0 };
  sepet.length = 0;
  let yuklenen = 0, atlanan = 0;

  const sidMap = {};
  Object.values(productMap).forEach(u => {
    if (u && u._sid) sidMap[u._sid] = u;
  });

  s.urunIds.forEach(item => {
    let urun = null;
    if (typeof item === 'string') {
      urun = productMap[item] || null;
    } else if (item && typeof item === 'object' && item.sid) {
      urun = sidMap[item.sid] || null;
    }
    if (urun) { sepet.push(urun); yuklenen++; }
    else atlanan++;
  });

  localStorage.setItem('pazar_sepet', JSON.stringify(sepet));
  return { yuklenen, atlanan };
}

// ── NAVİGASYON ────────────────────────────────────────
window._currentScreen = window._currentScreen || 'screen-home';

function showScreen(id, direction) {
  if (window._currentScreen === id) return;

  if (!direction) {
    var navOrder = {'screen-home':0, 'screen-sepet':1, 'screen-firsatlar':2, 'screen-profil':3};
    var fromIdx = window._currentScreen ? navOrder[window._currentScreen] : null;
    var toIdx = navOrder[id];
    if (fromIdx != null && toIdx != null) {
      direction = toIdx > fromIdx ? 'forward' : 'back';
    } else {
      direction = 'forward';
    }
  }

  document.querySelectorAll('.screen').forEach(function(s){ s.style.display = 'none'; });
  var hedef = document.getElementById(id);
  hedef.style.display = 'block';
  hedef.classList.remove('anim-slide-in', 'anim-slide-back');
  void hedef.offsetWidth;
  hedef.classList.add(direction === 'back' ? 'anim-slide-back' : 'anim-slide-in');

  document.querySelectorAll('.nav-btn').forEach(function(b){ b.classList.remove('active'); });
  if (id === 'screen-home')      document.getElementById('navHome').classList.add('active');
  if (id === 'screen-sepet')     document.getElementById('navSepet').classList.add('active');
  if (id === 'screen-firsatlar') { var el=document.getElementById('navFirsat'); if(el) el.classList.add('active'); }
  if (id === 'screen-profil')    { var el=document.getElementById('navProfil'); if(el) el.classList.add('active'); }
  if (id === 'screen-hal') { renderHalScreen(); }

  window._currentScreen = id;
}

function goSepet() { renderSepet(); showScreen('screen-sepet'); }

function goBack() {
  if (_prevScreen === 'screen-sepet') renderSepet();
  showScreen(_prevScreen, 'back');
}

function openDetay(urunId) {
  const screens = ['screen-home', 'screen-cat', 'screen-sepet'];
  _prevScreen = screens.find(id => {
    const el = document.getElementById(id);
    return el && el.style.display !== 'none';
  }) || 'screen-home';

  let u = productMap[urunId] || sepet.find(s => s._id === urunId);
  if (!u) return;
  productMap[u._id] = u;

  // Ana sayfa şeritleri KISA kart taşıyor (ana sayfa 14 MB indirmesin diye).
  // Detayda seri, alarm önerisi, al/bekle ve rozetler tam veri istiyor —
  // burada tembel yüklenip ekran bir kez yenileniyor.
  if (u._kisa || !_gecmisCache) {
    Promise.all([loadAllCats(), gecmisVeriGetir()]).then(() => {
      const tam = productMap[urunId];
      if (tam && !tam._kisa && document.getElementById('screen-detay') &&
          document.getElementById('screen-detay').style.display !== 'none') {
        openDetay(urunId);
      }
    }).catch(e => console.warn('[detay] tam veri yuklenemedi:', e && e.message));
  }

  const temiz    = fiyatlariTemizle(u.market_fiyatlari);
  const mktler   = temiz.gecerli.slice().sort((a, b) => a.fiyat - b.fiyat);
  const emoji    = KAT_EMOJI[ustKategori(u.ana_kategori)] || '📦';
  const imgHtml  = u.resim
    ? `<img src="${_guvenliUrl(u.resim)}" alt="" loading="lazy" onerror="this.onerror=null;this.parentElement.innerHTML='<div style=\'width:100%;height:120px;background:#f8f8f8;display:flex;align-items:center;justify-content:center;font-size:3rem\'>${emoji}</div>'">`
    : emoji;



  const { fiyatlarFarkli, durumlar } = _mktRowDurumu(mktler);

  const mktRows = mktler.map((f, i) => {
    const { isBest, isWorst } = durumlar[i];
    return `<div class="detay-mkt-row${isBest ? ' best' : isWorst ? ' worst' : ''}">
      ${_marketEtiketiHTML(f.market)}
      <span class="detay-mkt-price">${listeFiyatHTML(f)}${tlHTML(f.fiyat)}${isWorst ? '<span class="detay-mkt-badge">en pahalı</span>' : ''}</span>
    </div>${bildirimUyariHTML(u._sid, f.market)}`;
  }).join('');

  const inCart = sepet.some(s => s._id === urunId);
  const btnHtml = `<button id="detayEkleBtn" class="detay-btn-ekle${inCart ? ' added' : ''}" data-id="${_kacir(u._id)}"
    onclick="toggleSepet(this.dataset.id); renderDetayBtn(this.dataset.id)">
    ${inCart
? `<svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg> Listemde`
      : `<svg viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Listeme Ekle`}
  </button>`;

  // detay-sol / detay-sag: mobilde stilsiz düz blok (akış birebir aynı),
  // masaüstünde iki sütunlu düzenin taşıyıcısı.
  document.getElementById('detayContent').innerHTML = `
    <div class="detay-sol">
    <div class="detay-img-wrap">${imgHtml}</div>
    <div class="detay-info">
      <div class="detay-name">${_kacir(u.ad)}</div>
      ${u.agirlik_hacim ? `<div class="detay-unit">${_kacir(u.agirlik_hacim)}</div>` : ''}
      ${tazelikChipHTML(u)}
    </div>
    ${(() => { const bf = birimFiyatHesapla(u); return bf ? `<div class="detay-birim-fiyat">${birimFiyatYazi(bf)}</div>` : ''; })()}
    ${(() => { const rz = tuzakRozetiHesapla(u); return rz ? tuzakRozetiHTML(rz, false) : ''; })()}
    ${urunRozetleriHTML(u, false)}
    ${alZamaniHTML(u)}
    ${zamDetayHTML(u)}
    <div class="detay-section detay-section--market">
      <div class="detay-sec-label">Market Fiyatları</div>
      <div class="detay-mkt-list">
        ${mktRows || '<div style="padding:12px 14px;font-size:.82rem;color:var(--text-muted)">Market verisi yok</div>'}
      </div>
      ${_esitFiyatBilgiHTML(mktler, fiyatlarFarkli)}
      ${_gizlenenFiyatHTML(temiz)}
    </div>
    </div>
    <div class="detay-sag">
    ${fiyatGecmisiBlogu(u)}
    ${fiyatAlarmiBlogu(u)}
    ${btnHtml}
    ${_bildirimYetkiVarMi() ? `<button type="button" class="fiyat-bildir-btn" data-id="${_kacir(u._id)}" onclick="fiyatBildirAc(this.dataset.id)"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>Bu fiyat tutmadı</button>` : ''}
    </div>
    ${(() => {
  const digerler = digerPaketleriBul(u);
  if (!digerler.length) return '';
  let html = '<div class="detay-bolum"><div class="detay-bolum-baslik">Bu ürünün diğer paketleri</div><div class="detay-bolum-liste detay-bolum-liste-strip">';
  digerler.forEach(d => {
    const rzD = tuzakRozetiHesapla(d);
    html += _stripKartHTML(d, rzD);
  });
  html += '</div></div>';
  return html;
})()}
    ${(() => {
  const rakipler = rakipMarkalariBul(u);
  if (!rakipler.length) return '';
  let html = '<div class="detay-bolum"><div class="detay-bolum-baslik">Aynı boyda rakip markalar</div><div class="detay-bolum-liste detay-bolum-liste-strip">';
  rakipler.forEach(d => {
    html += _stripKartHTML(d, null);
  });
  html += '</div></div>';
  return html;
})()}`;

  showScreen('screen-detay');
  document.getElementById('screen-detay').scrollTop = 0;
}

function renderDetayBtn(urunId) {
  const btn = document.getElementById('detayEkleBtn');
  if (!btn) return;
  const inCart = sepet.some(s => s._id === urunId);
  btn.className = 'detay-btn-ekle' + (inCart ? ' added' : '');
  btn.innerHTML = inCart
    ? `<svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg> Listemde`
    : `<svg viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Listeme Ekle`;
}

// ── YARDIMCILAR ───────────────────────────────────────
function norm(s) {
  return (s||'').toLowerCase()
    .replace(/ğ/g,'g').replace(/ü/g,'u').replace(/ş/g,'s')
    .replace(/ı/g,'i').replace(/ö/g,'o').replace(/ç/g,'c')
    .replace(/[^a-z0-9 ]/g,'').trim();
}

function tl(v) {
  return v == null ? '—' :
    v.toLocaleString('tr-TR',{minimumFractionDigits:2,maximumFractionDigits:2}) + ' ₺';
}

function tlHTML(v) {
  if (v == null) return '<span class="fp"><span class="fp-l">—</span></span>';
  const formatted = v.toLocaleString('tr-TR', {minimumFractionDigits: 2, maximumFractionDigits: 2});
  const parcalar = formatted.split(',');
  const lira = parcalar[0] || '0';
  const kurus = parcalar[1] || '00';
  return `<span class="fp"><span class="fp-l">${lira}</span><span class="fp-k">,${kurus}</span><span class="fp-tl">₺</span></span>`;
}

function ustKategori(k) {
  k = k || '';
  if (['Meyve'].includes(k)) return 'meyve';
  if (['Sebze'].includes(k)) return 'sebze';
  if (['Şarküteri','Beyaz Et','Kırmızı Et','Deniz Ürünleri','Sakatat'].includes(k)) return 'et';
  if (['Süt','Yoğurt','Peynir','Tereyağı ve Margarin','Kaymak ve Krema','Yumurta',
       'Zeytin','Bal ve Reçel','Helva Tahin ve Pekmez','Kahvaltılık Gevrek Bar ve Granola',
       'Sürülebilir Ürünler ve Kahvaltılık Soslar','Ayran ve Kefir'].includes(k)) return 'sut';
  if (['Mantı Makarna ve Erişte','Pasta Malzemeleri','Hazır Gıda','Bakliyat',
       'Ekmek ve Unlu Mamüller','Konserve','Salça','Ketçap Mayonez Sos ve Sirkeler',
       'Sıvı Yağlar','Tuz Baharat ve Harçlar','Şeker ve Tatlandırıcılar',
       'Turşu','Un ve İrmik','Bebek Mamaları'].includes(k)) return 'gida';
  if (['Meyve Suyu','Su','Maden Suyu','Çay ve Bitki Çayları',
       'Gazsız İçecekler','Gazlı İçecekler','Kahve'].includes(k)) return 'icecek';
  if (['Bulaşık Temizlik Ürünleri','Kağıt Havlu','Kağıt Peçete ve Mendil',
       'Genel Temizlik Ürünleri','Hijyenik Ped','Çamaşır Temizlik Ürünleri',
       'Saç Bakım','Cilt Bakımı','Parfüm Deodorant Kolonya ve Kokular',
       'Mutfak Sarf Malzemeleri','Duş Banyo ve Sabun','Ağız Bakım',
       'Bebek ve Hasta Bezi','Temizlik ve Kişisel Bakım',
       // 2026-07-25: kaynak sitede kategori ikiye bolununce gelen yeni main_category degerleri
       'Ağda ve Epilasyon','Diğer Temizlik','Islak Mendiller','Kağıt Peçete ve Mendiller',
       'Parfüm ve Deodorant','Sağlık ve Medikal','Tuvalet Kağıtları','Tıraş Ürünleri'].includes(k)) return 'temizlik';
  if (['Bisküvi ve Kraker','Cips','Dondurmalar','Gofret','Kek','Kuruyemiş ve Kuru Meyve','Sakız ve Şekerleme','Tatlılar','Çikolata'].includes(k)) return 'atistirmalik';
  if (k === 'Dondurulmuş Ürünler') return 'dondurulmus';
  return 'diger';
}

// ── SKELETON ──────────────────────────────────────────
function skeletonHTML(n = 4) {
  return Array(n).fill(`
    <div class="skeleton-card">
      <div class="skeleton skeleton-img"></div>
      <div class="skeleton-body">
        <div class="skeleton skeleton-line"></div>
        <div class="skeleton skeleton-line short"></div>
        <div class="skeleton skeleton-line price"></div>
      </div>
    </div>`).join('');
}

// ── ID ATAMA & KATEGORİ YÜKLEME ───────────────────────
function assignIds(slug, products) {
  products.forEach((u, i) => {
    if (!u._id) {
      u._id = slug + '_' + i;
      productMap[u._id] = u;
    }
  });
  return products;
}

// UÇUŞTA TEKİLLEŞTİRME: yalnızca catCache'e bakmak yetmiyordu — iki çağıran
// aynı anda gelirse ikisi de cache'i boş görüp AYRI istek atıyordu. Ölçüldü:
// her kategori JSON'u iki kez iniyordu (urunler_et 733 ms ve 734 ms), çünkü
// renderTuzaklarSeridi ile renderZamSeridi loadAllCats()'i eş zamanlı
// çağırıyordu. Artık ikinci çağıran AYNI Promise'i bekliyor.
let _catYukleniyor = new Map();
async function loadCat(slug) {
  if (catCache[slug]) return catCache[slug];
  const ucusta = _catYukleniyor.get(slug);
  if (ucusta) return ucusta;
  const p = _loadCatGetir(slug);
  _catYukleniyor.set(slug, p);
  try {
    return await p;
  } finally {
    // Hata durumunda da temizleniyor, yoksa slug kalıcı olarak kilitlenirdi.
    _catYukleniyor.delete(slug);
  }
}

async function _loadCatGetir(slug) {
  const kat = KATEGORILER.find(k => k.slug === slug);
  let products = [];
  try {
    const resp = await fetch('./data/' + kat.file + '.json');
    if (resp.ok) {
      const data = await resp.json();
      products = Array.isArray(data) ? data : (data.urunler || []);
      // Kategori JSON'larında zaman alanı yok (15 bin ürünü şişirmemek için).
      // Tazelik damgasını dosyanın Last-Modified başlığından besle.
      // Başlık yoksa son_senkron atanmaz -> chip hiç görünmez.
      const lm = resp.headers.get('Last-Modified');
      if (lm) {
        const t = new Date(lm);
        if (!isNaN(t.getTime())) {
          const iso = t.toISOString();
          products.forEach(u => { if (!u.son_senkron) u.son_senkron = iso; });
        }
      }
    }
  } catch (e) {
    console.warn('Kategori yuklenemedi:', kat.file, e);
  }
  assignIds(slug, products);
  catCache[slug] = products;
  return products;
}

// ── KART HTML ─────────────────────────────────────────
function placeholderRenk(kategori) {
  const renkler = {
    'meyve': {bg:'#FFF3E0', emoji:'🍎'},
    'sebze': {bg:'#E8F5E9', emoji:'🥦'},
    'et': {bg:'#FCE4EC', emoji:'🥩'},
    'sut': {bg:'#E3F2FD', emoji:'🧀'},
    'gida': {bg:'#F3E5F5', emoji:'🛒'},
    'icecek': {bg:'#E0F7FA', emoji:'🥤'},
    'temizlik': {bg:'#F9FBE7', emoji:'🧴'},
    'atistirmalik': {bg:'#FFF4E0', emoji:'🍫'},
    'dondurulmus': {bg:'#E0F2FE', emoji:'🧊'}
  };
  return renkler[kategori] || {bg:'#F5F5F5', emoji:'📦'};
}

// Ayrıştırma çekirdeği: gramaj metni + VERİLEN fiyat → birim fiyat.
// Ayrı fonksiyon olmasının sebebi: "Marketleri Karşılaştır" sonuç ekranında
// doğru fiyat ürünün global mininmumu DEĞİL, o satıra ATANAN marketin fiyatı.
// birimFiyatHesapla(u) davranışı değişmedi, sadece ayrıştırmayı buraya devretti.
function _birimFiyatHam(agirlikHacim, fiyat, ad) {
  if (!fiyat || fiyat <= 0) return null;
  const u = { agirlik_hacim: agirlikHacim, ad: ad };
  return _birimFiyatAyristir(u, fiyat);
}

function birimFiyatHesapla(u) {
  if (!u) return null;
  const fiyat = enDusukFiyat(u);
  if (!fiyat || fiyat <= 0) return null;
  return _birimFiyatAyristir(u, fiyat);
}

function _birimFiyatAyristir(u, fiyat) {
  const s = String(u.agirlik_hacim || '').toLowerCase().replace(/,/g, '.');
  let m = s.match(/(\d+(?:\.\d+)?)\s*kg\b/);
  if (m) { const kg = parseFloat(m[1]); if (kg > 0) return { deger: fiyat / kg, birim: 'kg' }; }
  m = s.match(/(\d+(?:\.\d+)?)\s*gr?\b/);
  if (m) { const gr = parseFloat(m[1]); if (gr > 0) return { deger: (fiyat / gr) * 1000, birim: 'kg' }; }
  m = s.match(/(\d+(?:\.\d+)?)\s*ml\b/);
  if (m) { const ml = parseFloat(m[1]); if (ml > 0) return { deger: (fiyat / ml) * 1000, birim: 'L' }; }
  m = s.match(/(\d+(?:\.\d+)?)\s*(?:lt|litre|l)\b/);
  if (m) { const l = parseFloat(m[1]); if (l > 0) return { deger: fiyat / l, birim: 'L' }; }
  m = s.match(/x\s*(\d+)\b/) || s.match(/(\d+)\s*(?:lu|li|adet)\b/);
  if (m) { const a = parseInt(m[1], 10); if (a > 0) return { deger: fiyat / a, birim: 'adet' }; }
  if (u.ad) {
    const adS = String(u.ad).toLowerCase().replace(/'/g, '').replace(/,/g, '.');
    const m2 = adS.match(/(\d+)\s*adet\b/) || adS.match(/x\s*(\d+)\b/);
    if (m2) { const a = parseInt(m2[1], 10); if (a > 0) return { deger: fiyat / a, birim: 'adet' }; }
  }
  return null;
}

function _agirlikRef(u) {
  if (!u) return null;
  const s = String(u.agirlik_hacim || '').toLowerCase().replace(/,/g, '.');
  let m = s.match(/(\d+(?:\.\d+)?)\s*kg\b/);
  if (m) { const v = parseFloat(m[1]); if (v > 0) return v * 1000; }
  m = s.match(/(\d+(?:\.\d+)?)\s*gr?\b/);
  if (m) { const v = parseFloat(m[1]); if (v > 0) return v; }
  m = s.match(/(\d+(?:\.\d+)?)\s*(?:lt|litre|l)\b/);
  if (m) { const v = parseFloat(m[1]); if (v > 0) return v * 1000; }
  m = s.match(/(\d+(?:\.\d+)?)\s*ml\b/);
  if (m) { const v = parseFloat(m[1]); if (v > 0) return v; }
  return null;
}

function enDusukFiyat(u) {
  if (!u || !Array.isArray(u.market_fiyatlari) || !u.market_fiyatlari.length) return null;
  let min = Infinity;
  u.market_fiyatlari.forEach(mf => {
    const f = parseFloat(mf.fiyat);
    if (!isNaN(f) && f > 0 && f < min) min = f;
  });
  return min === Infinity ? null : min;
}

// Hedef fiyat onerisi. Onceden alan enDusuk*0.95 ile doluyordu — keyfi bir %5,
// urunun gercek gecmisiyle hicbir bagi yok, o yuzden alarmlar ates almiyordu.
// Artik oneri son 30 gunun GERCEKTEN gorulmus en dusuk fiyati.
function otuzGunMinFiyat(sid) {
  const seri = otuzGunlukSeri(sid);
  if (!seri.length) return null;
  return Math.min.apply(null, seri);
}

// Salınımsız serinin dibi. Hedef fiyat için savunabileceğimiz değer bu:
// istikrarlı bir seviyede GERÇEKTEN gözlenmiş fiyat. Bkz. _seriKur.
function otuzGunMinFiyatTemiz(sid) {
  const seri = otuzGunlukSeriTemiz(sid);
  if (!seri.length) return null;
  return Math.min.apply(null, seri);
}

function alarmOnerisi(u) {
  if (!u || !u._sid) return null;
  const guncel = enDusukFiyat(u);
  if (guncel == null || !(guncel > 0)) return null;
  // Ölçüm: kirli dip 158 üründe hayaletti (medyan %14, max %49 sapma).
  // Erikli Su 10,00 ₺ hedefi hiç çalmaz; temiz dip 18,75 ₺ ulaşılabilir.
  const min = otuzGunMinFiyatTemiz(u._sid);
  if (min == null || !(min > 0)) return null;
  // Fiyat zaten 30 gunun dibindeyse onerecek daha dusuk bir seviye yok.
  if (min >= guncel) return null;
  return { deger: min, guncel: guncel };
}

function alarmOneriHTML(u) {
  const o = alarmOnerisi(u);
  if (!o) return '';
  const sidAttr = _kacir(String(u._sid));  // öznitelik değeri; handler this.dataset.sid'den okur
  // "Son ay X'ye kadar indi" HAM seriye ait bir iddia. Öneri salınımsız seriden
  // geldiği için X ham seride gözlenmemiş olabilir — o zaman CÜMLE KURULMAZ,
  // ama öneri butonu kalır (özellik susmuyor, yalnızca yanlış iddia susuyor).
  const metin = _hamDipMi(u._sid, o.deger)
    ? `<span class="alarm-oneri-metin">Son ay ${tl(o.deger)}'ye kadar indi</span>`
    : `<span class="alarm-oneri-metin">Önerilen hedef ${tl(o.deger)}</span>`;
  return `<div class="alarm-oneri">
      ${metin}
      <button type="button" class="alarm-oneri-btn" data-sid="${sidAttr}" onclick="alarmOneriUygula(this.dataset.sid, ${o.deger})">Bu fiyatı kullan</button>
    </div>`;
}

function alarmOneriUygula(sid, deger) {
  const el = document.getElementById('alarmInput-' + sid);
  if (!el) return;
  el.value = deger;
  el.focus();
}

function fiyatAlarmiBlogu(u) {
  const sid = u && u._sid;
  if (!sid) return '';
  const sidAttr = _kacir(String(sid));  // öznitelik/id değeri; DOM entity'yi çözünce ham sid ile eşleşir
  const aktifHedef = window.pazarAlarmMap ? window.pazarAlarmMap.get(sid) : null;
  if (aktifHedef != null) {
    return `<div class="detay-section detay-section--alarm" id="alarmBlogu-${sidAttr}">
      <div class="detay-sec-label">Fiyat Alarmı</div>
      <div class="alarm-box alarm-active">
        <div class="alarm-active-text">${tl(aktifHedef)}'nin altına düşünce haber vereceğiz</div>
        <button class="alarm-kaldir-btn" data-sid="${sidAttr}" onclick="fiyatAlarmKaldir(this.dataset.sid)">Kaldır</button>
      </div>
    </div>`;
  }
  // Gecmis varsa 30 gunun gercek dibi onerilir; yoksa MEVCUT akis (enDusuk*0.95)
  // aynen korunur — bos alanla birakmak kullaniciyi geriye goturuyordu.
  const gecmisOneri = alarmOnerisi(u);
  const enDusuk = enDusukFiyat(u);
  const oneri = gecmisOneri ? gecmisOneri.deger : (enDusuk ? (enDusuk * 0.95).toFixed(2) : '');
  return `<div class="detay-section detay-section--alarm" id="alarmBlogu-${sidAttr}">
    <div class="detay-sec-label">Fiyat Alarmı</div>
    <div class="alarm-box">
      <input type="number" inputmode="decimal" step="0.01" min="0.01" class="alarm-input" id="alarmInput-${sidAttr}" placeholder="Hedef fiyat (₺)" value="${oneri}">
      <button class="alarm-kur-btn" data-sid="${sidAttr}" onclick="fiyatAlarmKur(this.dataset.sid)">Alarm Kur</button>
    </div>
    ${alarmOneriHTML(u)}
  </div>`;
}

function markaBul(u) {
  if (!u || !u.ad) return '';
  const ilk = String(u.ad).trim().split(/\s+/)[0] || '';
  return ilk.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function ayniUrunMu(u1, u2) {
  if (!u1 || !u2) return false;
  if (u1._id === u2._id) return false;
  if ((u1.ana_kategori || '') !== (u2.ana_kategori || '')) return false;
  if (markaBul(u1) !== markaBul(u2)) return false;
  const norm = (ad, ah) => {
    let s = String(ad || '').toLowerCase();
    if (ah) s = s.replace(String(ah).toLowerCase(), '');
    return s.replace(/\d+\s*(?:kg|gr?|ml|l|lu|lü|li|lı|adet)\b/gi, '')
            .replace(/[^a-z0-9çğıöşü ]/gi, ' ')
            .replace(/\s+/g, ' ').trim();
  };
  return norm(u1.ad, u1.agirlik_hacim) === norm(u2.ad, u2.agirlik_hacim);
}

let _ahIndex = null;
let _ahIndexSize = 0;

function _ahIndexRebuildIfNeeded() {
  const size = Object.keys(productMap).length;
  if (_ahIndex && size === _ahIndexSize) return;
  _ahIndex = {};
  for (const k in productMap) {
    const u = productMap[k];
    if (!u) continue;
    const key = (u.ana_kategori || '') + '|' + (markaBul(u) || '');
    if (!_ahIndex[key]) _ahIndex[key] = [];
    _ahIndex[key].push(u);
  }
  _ahIndexSize = size;
}

function digerPaketleriBul(u) {
  if (!u || !productMap) return [];
  _ahIndexRebuildIfNeeded();
  const key = (u.ana_kategori || '') + '|' + (markaBul(u) || '');
  const aday = _ahIndex[key] || [];
  const out = [];
  for (const v of aday) {
    if (!v || v._id === u._id) continue;
    if (ayniUrunMu(u, v)) out.push(v);
  }
  return out;
}

const TUZAK_WHITELIST = new Set([
  "Süt", "S├╝t",
  "Yoğurt", "Yo─şurt",
  "Peynir",
  "Tereyağı ve Margarin", "Tereya─ş─▒ ve Margarin",
  "Ayran ve Kefir",
  "Su",
  "Maden Suyu",
  "Gazlı İçecekler", "Gazl─▒ ─░├ğecekler",
  "Meyve Suyu",
  "Bulaşık Temizlik Ürünleri", "Bula┼ş─▒k Temizlik ├£r├╝nleri",
  "Çamaşır Temizlik Ürünleri", "├çama┼ş─▒r Temizlik ├£r├╝nleri",
  "Genel Temizlik Ürünleri", "Genel Temizlik ├£r├╝nleri",
  "Duş Banyo ve Sabun", "Du┼ş Banyo ve Sabun",
  "Bakliyat",
  "Mantı Makarna ve Erişte",
  "Un ve İrmik", "Un ve ─░rmik",
  "Şeker ve Tatlandırıcılar", "┼Şeker ve Tatland─▒r─▒c─▒lar",
  "Sıvı Yağlar", "S─▒v─▒ Ya─şlar",
  "Bisküvi ve Kraker", "Bisk├╝vi ve Kraker",
  "Çikolata", "├çikolata",
  "Kuruyemiş ve Kuru Meyve", "Kuruyemi┼ş ve Kuru Meyve"
]);

let _gecmisCache = null;
let _gecmisYukleniyor = null;
async function gecmisVeriGetir() {
  if (_gecmisCache) return _gecmisCache;
  if (_gecmisYukleniyor) return _gecmisYukleniyor;
  _gecmisYukleniyor = (async () => {
    try {
      const r = await fetch('./data/gecmis_fiyatlar.json');
      if (!r.ok) throw new Error('fetch failed');
      _gecmisCache = await r.json();
    } catch(e) { console.warn('[gecmis] gecmis_fiyatlar.json yuklenemedi; rozetler, alarm onerisi ve al/bekle SESSIZCE cikmaz:', e && e.message);
      _gecmisCache = {};
    }
    return _gecmisCache;
  })();
  return _gecmisYukleniyor;
}

// gecmis_fiyatlar.json 4,2 MB (653 KB gzip). ANA SAYFA ONU İSTEMİYOR —
// dört şerit build zamanında hesaplanıyor (bkz. anasayfaVeriGetir). Yalnızca
// gerçekten gerektiğinde iniyor: ürün detayı, kategori ekranı kartlarındaki
// rozetler (urunRozetleriHTML -> indirimRozetiHesapla) ve profildeki sepet
// enflasyonu (_otuzGunOncekiEnUcuz).
//
// Bu fonksiyonlar geçmiş yoksa SESSİZCE boş dönüyor — rozet hiç çizilmez ve
// kullanıcı eksikliği fark etmez. O yüzden ekran açılışında tetikleyip veri
// gelince BİR KEZ yeniden çiziyoruz. gecmisVeriGetir zaten uçuşta
// tekilleştiriyor, birden çok ekran çağırsa da tek istek gider.
// Ekran GERÇEKTEN görünüyor mu. Yalnızca inline style.display'e bakmak YETMEZ:
// showScreen ilk kez çalışana kadar tüm ekranların inline display'i BOŞ, gizlilik
// CSS'ten geliyor. Ölçümde yakalandı — gizli profil ekranı "görünür" sanıldı ve
// 4,2 MB geçmiş her sayfa açılışında indi.
function _ekranGorunur(id) {
  const e = document.getElementById(id);
  if (!e) return false;
  if (e.style.display === 'none') return false;
  if (typeof getComputedStyle !== 'function') return true;
  return getComputedStyle(e).display !== 'none';
}

function gecmisGerekli(yenile) {
  if (_gecmisCache) return;                 // zaten elde, yeniden çizmeye gerek yok
  gecmisVeriGetir()
    .then(() => { if (typeof yenile === 'function') yenile(); })
    .catch(e => console.warn('[gecmis] yuklenemedi, rozetler eksik kalabilir:', e && e.message));
}

// ═══ ANA SAYFA ÖNCEDEN HESAPLANMIŞ ŞERİTLER ═════════════
// Dört şeridin içeriği build zamanında scripts/anasayfa-uret.mjs ile
// hesaplanıyor (app.js'in KENDİ fonksiyonları Node'da koşturularak — mantık
// tek yerde, sapma yok). Ölçüm: ana sayfa 2,00 MB gzip + 14,7 sn tuzak
// taraması yerine 25,9 KB tek dosya.
// gecmis_fiyatlar.json artık ana sayfada GEREKMİYOR; yalnızca ürün detayı
// veya kategori gezinmesi açıldığında tembel yükleniyor.
let _anasayfaCache = null;
let _anasayfaYukleniyor = null;
async function anasayfaVeriGetir() {
  if (_anasayfaCache !== null) return _anasayfaCache;
  if (_anasayfaYukleniyor) return _anasayfaYukleniyor;
  _anasayfaYukleniyor = (async () => {
    try {
      const r = await fetch('./data/anasayfa.json');
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const d = await r.json();
      if (!d || d.surum !== 1) throw new Error('surum uyumsuz: ' + (d && d.surum));
      _anasayfaCache = d;
    } catch (e) {
      // SESSİZ YUTMA YOK: eski yol (istemcide hesaplama) devreye girecek.
      console.warn('[anasayfa] onceden hesaplanmis serit yuklenemedi, istemcide hesaplanacak:', e.message);
      _anasayfaCache = false;
    }
    // Tazelik göstergesi buradan besleniyor: veri zaten indirildi, ayrı
    // istek yok. Yüklenemezse gösterge hiç çizilmiyor (yanlış tarih
    // göstermektense hiç göstermemek doğru).
    if (_anasayfaCache && _anasayfaCache.veri_tarihi) {
      try { veriTazelikCiz(_anasayfaCache.veri_tarihi); }
      catch (e) { console.warn('[tazelik] gosterge cizilemedi:', e && e.message); }
    }
    return _anasayfaCache;
  })();
  return _anasayfaYukleniyor;
}

// Önceden hesaplanmış kartlar productMap'e "kısa" olarak giriyor. Detay
// açılınca tam ürün gerekiyor (fiyat_gecmisi, seri, rozetler) — openDetay
// bunu görüp tam veriyi tembel yüklüyor.
function _anasayfaKartlariKaydet(kartlar) {
  (kartlar || []).forEach(u => {
    if (!u || !u._id) return;
    if (!productMap[u._id] || productMap[u._id]._kisa) {
      u._kisa = true;
      productMap[u._id] = u;
    }
  });
}

// ═══ 30 GÜNLÜK SERİ — son 30 günle ilgili TEK KAYNAK ════
// Kayitlar yalnizca fiyat DEGISINCE yaziliyor. Ham kayit listesini tarihe gore
// suzmek iki hata birden yapiyordu:
//   1) Sureyi yok sayiyordu — 29 gun 100 TL, 1 gun 60 TL olan urun ham listede
//      iki esit deger gibi gorunuyordu (olcum: %33,2 farkli dilim).
//   2) Pencere basinda YURURLUKTE olan ama kaydi daha eski tarihli fiyati hic
//      gormuyordu. Ornek: BIM 2026-06-10'da 79 TL, sonraki BIM kaydi 07-31.
//      Pencerenin ilk ~19 gunu BIM 79 TL'ydi ama kayit "pencere disi" sayiliyordu.
//      Bu yuzden "30 gunun en dusugu" rozeti olculebilen urunlerin %21,5'inde
//      YANLIS iddia ediyordu.
// Seri carry-forward ile gun gun kuruluyor; indirim rozeti, gercek indirim
// rozeti ve "simdi al / bekle" blogunun UCU DE buradan besleniyor.
let _seriCache = new Map();

// Gün sınırı YEREL takvime göre. toISOString() UTC'ye çevirdiği için UTC+3'te
// her gece 00:00-03:00 arasında pencereyi bir gün geriye kaydırıyordu — o
// saatte uygulamayı açan kullanıcı bir gün kaymış veri görüyordu.
function _yerelGunISO(n) {
  const d = new Date();
  d.setDate(d.getDate() - (n || 0));
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') +
         '-' + String(d.getDate()).padStart(2, '0');
}

// Bir dizide bir DEĞER ayrılıp GERİ DÖNÜYORSA (iki ayrı blokta görünüyorsa)
// salınım vardır. Gerekçesi ve tolerans=0 ölçümü için bkz. zamSalinimVar.
// null girdiler (marketin o gün fiyatı bilinmiyor) atlanıyor.
function _salinimVarSeri(seri) {
  if (!Array.isArray(seri)) return null;
  const gorulen = new Map();
  let blok = 0, onceki = null, sayi = 0, bulunan = null;
  for (let i = 0; i < seri.length; i++) {
    const v = seri[i];
    if (v == null) continue;
    if (sayi > 0 && v !== onceki) blok++;
    sayi++;
    if (bulunan === null && gorulen.has(v) && gorulen.get(v) !== blok) bulunan = v;
    gorulen.set(v, blok);
    onceki = v;
  }
  return sayi >= 3 ? bulunan : null;
}

// 30 günlük seriyi TEK GEÇİŞTE kurar ve üç çıktıyı birden verir:
//   marketSeri : her market için kendi carry-forward dizisi (bilinmeyen gün null)
//   tum        : günlük minimum, TÜM marketler üzerinden  (eski davranış)
//   temiz      : günlük minimum, yalnızca SALINIMSIZ marketler üzerinden
// Salınım testi zaten market serisini gerektirdiği için "temiz" varyantı bu
// hesabın içinden bedavaya çıkıyor — ikinci bir geçiş gerekmiyor. Ölçüm:
// tam tarama 1014 ms -> 660 ms (market dizileri artık gün başına yeniden
// taranmıyor, bir kez kurulup indeksleniyor).
//
// TEMIZ NİYE VAR: API her zincir için TEK temsilci mağaza döndürüyor ve
// temsilci zaman içinde değişiyor; mağaza değişimi seride hayalet bir dip
// bırakıyor. Erikli Su'da 30 günün dibi 10,00 ₺ görünüyordu, ürün 28,00 ₺ —
// o hedefe kurulan alarm hiç çalmaz. Salınımsız seriden gelen 18,75 ₺ ise
// istikrarlı seviyede gerçekten gözlenmiş bir fiyat.
//
// GELECEK — BU GEÇİCİ: scraper 2026-08-11'den beri market_fiyatlari içine
// depot_id/depot_ad yazıyor. 2-3 hafta veri birikince "bu dip gerçekten başka
// mağazanın mı" sorusu DOĞRUDAN cevaplanabilecek; bu yapısal ayrım o zaman
// depot_id değişimini izleyen ölçüme dayalı kuralla değiştirilmeli.
function _seriKur(sid) {
  const bos = { tum: [], temiz: [], marketSeri: new Map(), salinimli: new Set() };
  if (!sid || !_gecmisCache) return bos;
  const bellek = _seriCache.get(sid);
  if (bellek) return bellek;
  const kayitlar = _gecmisCache[sid];
  if (!Array.isArray(kayitlar) || !kayitlar.length) return bos;

  const marketler = {};
  kayitlar.forEach(k => {
    if (!k || !k.t || k.f == null || !(k.f > 0)) return;
    const m = k.m || '?';
    if (!marketler[m]) marketler[m] = [];
    marketler[m].push(k);
  });
  Object.values(marketler).forEach(a => a.sort((x, y) => x.t < y.t ? -1 : 1));

  const gunler = [];
  for (let i = 29; i >= 0; i--) gunler.push(_yerelGunISO(i));

  const marketSeri = new Map();
  const salinimli = new Set();
  for (const m of Object.keys(marketler)) {
    const a = marketler[m];
    const seri = new Array(30).fill(null);
    let j = 0, son = null;
    for (let i = 0; i < 30; i++) {
      while (j < a.length && a[j].t <= gunler[i]) { son = a[j]; j++; }
      seri[i] = son ? son.f : null;
    }
    marketSeri.set(m, seri);
    if (_salinimVarSeri(seri) !== null) salinimli.add(m);
  }

  const tum = [], temiz = [];
  for (let i = 0; i < 30; i++) {
    let hepsi = null, sade = null;
    for (const [m, seri] of marketSeri) {
      const v = seri[i];
      if (v == null) continue;
      if (hepsi === null || v < hepsi) hepsi = v;
      if (!salinimli.has(m) && (sade === null || v < sade)) sade = v;
    }
    if (hepsi !== null) tum.push(hepsi);
    if (sade !== null) temiz.push(sade);
  }

  // SUSTURMA YOK: hiç salınımsız market yoksa temiz seri tüm seriye düşer.
  const out = { tum: tum, temiz: temiz.length ? temiz : tum, marketSeri: marketSeri, salinimli: salinimli };
  _seriCache.set(sid, out);
  return out;
}

function otuzGunlukSeri(sid) { return _seriKur(sid).tum; }
function otuzGunlukSeriTemiz(sid) { return _seriKur(sid).temiz; }

// ═══ İDDİA–HESAP UYUMU ══════════════════════════════════
// Kullanıcıya gösterilen sayısal cümleler ("30 günün en düşüğü", "son ay X'ye
// kadar indi", "son ayın en ucuz seviyesinde") HAM seriye ait bir iddia kuruyor.
// Ölçüm (2026-08-11 denetimi): rozet SALINIMSIZ seriden hesaplanırken metin
// değişmemişti — 1492 rozetin 91'i (%6,1) yanlıştı, en kötüsü %45,5
// (Ülker Gofret: "30 günün en düşüğü" 16,00 ₺ derken ham seride 11,00 ₺ vardı).
//
// KURAL: iddia zayıflatılmaz, doğru olmadığı yerde GÖSTERİLMEZ. Salınımsız seri
// hâlâ ölçüm için kullanılıyor (hayalet dip sorunu için); yalnızca HAM seriye
// ait cümle kurulmadan önce bu kapıdan geçiliyor.
function _hamDipMi(sid, deger) {
  if (deger == null || !(deger > 0)) return false;
  const ham = otuzGunlukSeri(sid);
  if (!ham || !ham.length) return false;
  return deger <= Math.min.apply(null, ham) + 0.005;
}

function indirimRozetiHesapla(urun) {
  if (!urun || !urun._sid) return null;
  const seri = otuzGunlukSeri(urun._sid);
  if (seri.length < 2) return null;
  const zirve = Math.max.apply(null, seri);
  const simdi = urun.en_dusuk_fiyat;
  if (zirve == null || simdi == null || zirve <= simdi) return null;

  const dusus = ((zirve - simdi) / zirve) * 100;
  if (dusus >= 25) return { tip: 'buyuk', yuzde: Math.round(dusus) };
  if (dusus >= 10) return { tip: 'normal', yuzde: Math.round(dusus) };
  return null;
}

// ═══ Sahte indirim rozeti ═══════════════════════════════
// indirim_analiz.py her gece urunler.indirim_supheli_* kolonlarini yaziyor.
// Etiketler o dosyadaki sebepler.append(...) ile birebir; eslenmeyen bir etiket
// gelirse o madde HIC gosterilmez (ham teknik metin kullaniciya basilmaz).
const SUPHELI_SEBEP_CUMLE = {
  kisa_zirve:        'Fiyat birkaç gün önce zaten bu seviyedeydi',
  orta_zirve:        'Yüksek fiyat sadece birkaç gün sürdü',
  yuksek_oynaklik:   'Fiyat son ayda sürekli oynadı',
  tekrarli_dongu:    'Son 30 günde tekrarlayan zam-indirim döngüsü',
  tek_dongu:         'Son 30 günde bir zam-indirim döngüsü oldu',
  asiri_yuksek_oran: 'İndirim oranı gerçekçi değil'
};
// Kutu guclu bir iddia ("bu indirim gercek gorunmuyor"), o yuzden zamansal desen
// sart. Yuksek indirim orani tek basina sahtelik kaniti degil — sezon sonu
// tasfiyesinde de oran yuksek cikar (olcum: gunes urunleri, %55-70).
const SUPHELI_ZAMANSAL_SEBEPLER = ['kisa_zirve', 'orta_zirve', 'tekrarli_dongu'];
// Kutu esigi 5. Esik 4'te 124 urun kutu aliyordu ve icinde 14 mevsimsel
// gunes/SPF tasfiyesi vardi; esik 5'te mevsimsellerin hepsi kutudan cikiyor.
const SUPHELI_KUTU_ESIK = 5;

// null = veri yok. Bu durumda hicbir rozet cizilmez (ne supheli ne gercek).
let _puanCache = null;

async function supheliPuanlariYukle() {
  if (_puanCache) return _puanCache;
  try {
    const { data, error } = await window.supabaseClient
      .from('urunler')
      .select('_sid, indirim_supheli_puan, indirim_supheli_sebepler, indirim_supheli_dusus_yuzde')
      .gte('indirim_supheli_puan', 2);
    if (error || !data) return null;
    _puanCache = new Map(data.map(r => [r._sid, r]));
    return _puanCache;
  } catch (e) { console.warn('[supheli] indirim_supheli puanlari alinamadi, sahte-indirim rozetleri hic cizilmeyecek:', e && e.message);
    return null;
  }
}

function supheliDurum(u) {
  if (!u || !u._sid || !_puanCache) return null;
  const k = _puanCache.get(u._sid);
  if (!k || k.indirim_supheli_puan == null || k.indirim_supheli_puan < 2) return null;
  // Rozet bir iddiaya verilen cevap: ortada indirim yoksa sahteligini iddia
  // etmek anlamsiz. Olcut mevcut indirim rozetiyle AYNI (yeni esik uydurulmaz);
  // o indirim gormuyorsa hicbir sey gosterilmez.
  if (!indirimRozetiHesapla(u)) return null;
  const sebepler = (k.indirim_supheli_sebepler || [])
    .map(s => String(s).trim())
    .filter(s => SUPHELI_SEBEP_CUMLE[s]);
  const zamansalVar = sebepler.some(s => SUPHELI_ZAMANSAL_SEBEPLER.indexOf(s) >= 0);
  return {
    seviye: (k.indirim_supheli_puan >= SUPHELI_KUTU_ESIK && zamansalVar) ? 'kutu' : 'rozet',
    puan: k.indirim_supheli_puan,
    sebepler: sebepler,
    dusus: k.indirim_supheli_dusus_yuzde
  };
}

function supheliCumleler(durum) {
  if (!durum || !durum.sebepler) return [];
  return durum.sebepler.map(s => SUPHELI_SEBEP_CUMLE[s]).filter(Boolean);
}

function supheliRozetHTML() {
  return `<span class="supheli-rozet">${lcIcon('alert-triangle')} Şüpheli indirim</span>`;
}

function supheliKutuHTML(durum) {
  if (!durum || durum.seviye !== 'kutu') return '';
  const maddeler = supheliCumleler(durum).slice(0, 2)
    .map(c => `<li class="supheli-kutu-madde">${c}</li>`).join('');
  return `<div class="supheli-kutu" role="note">
      <div class="supheli-kutu-baslik">${lcIcon('alert-triangle')} Bu indirim gerçek görünmüyor</div>
      ${maddeler ? `<ul class="supheli-kutu-liste">${maddeler}</ul>` : ''}
    </div>`;
}

// Karsi taraf: supheli olmayan VE fiyati son 30 gunun en dusugunde olan urun.
// _puanCache yoksa hic iddia edilmez.
function gercekIndirimRozetiHesapla(u) {
  if (!u || !u._sid || !_puanCache) return null;
  if (supheliDurum(u)) return null;
  const ir = indirimRozetiHesapla(u);
  if (!ir) return null;
  const seri = otuzGunlukSeri(u._sid);
  if (seri.length < 2) return null;              // uygunluk kapısı: DEĞİŞMEDİ
  // Rozetin metni "30 günün en düşüğü" — bu HAM seriye ait bir iddia, o yüzden
  // HAM seriye karşı doğrulanıyor. Bkz. _hamDipMi. (Önceden salınımsız seriden
  // ölçülüyordu ve 91 üründe yanlış iddia kuruyordu.)
  if (!_hamDipMi(u._sid, u.en_dusuk_fiyat)) return null;
  return { yuzde: ir.yuzde };
}

function gercekIndirimRozetiHTML(rozet, kisa) {
  if (!rozet) return '';
  return kisa
    ? `<span class="gercek-indirim-rozet kisa">${lcIcon('leaf')} Gerçek indirim</span>`
    : `<span class="gercek-indirim-rozet">${lcIcon('leaf')} Gerçek indirim · 30 günün en düşüğü</span>`;
}

// ═══ "Şimdi al / bekle" ═════════════════════════════════
const AL_ZAMANI_MIN_OYNAMA = 0.05;  // 30 gunde en az %5 oynama yoksa yorum yok
const AL_ZAMANI_TOLERANS = 0.02;    // uca %2 yakinlik "ucta" sayilir

function alZamaniDurumu(u) {
  if (!u || !u._sid) return null;
  // Supheli indirimde hicbir tavsiye verilmez — "iyi zaman" demek celiskili olur.
  if (supheliDurum(u)) return null;
  // urunRozetleriHTML detayin TEK rozet kaynagi. O bir sey soyluyorsa bu blok
  // susar; ikisi ayni anda konusunca celisiyorlar. Olcum: 186 "bekle" urunu ayni
  // anda indirim rozeti tasiyordu — Dolma Biber'de rozet "30 gunun en dusugu"
  // derken blok "son ayda 79,00 TL'ye kadar indi" diyordu.
  // gercekIndirimRozetiHesapla zaten indirimRozetiHesapla'ya bagli, bu tek
  // kontrol ucunu birden kapsiyor.
  if (indirimRozetiHesapla(u)) return null;
  // Zam blogu ayni olguyu daha ayrintili anlatiyor; ikisi birden cizilince
  // detaydaki yigin 5'e cikiyordu. Ayni kural: zam blogu konusuyorsa bu susar.
  if (typeof zamDurumu === 'function' && zamDurumu(u)) return null;
  const gecerli = fiyatlariTemizle(u.market_fiyatlari).gecerli.map(f => f.fiyat).filter(f => f > 0);
  if (!gecerli.length) return null;
  const bugun = Math.min.apply(null, gecerli);
  const seri = otuzGunlukSeri(u._sid);
  if (seri.length < 30) return null;              // 30 gunu doldurmayan urunde yorum yok
  // Uygunluk kapısı yukarıda TÜM seride kaldı (susturma yok); yalnızca ÖLÇÜLEN
  // uçlar salınımsız seriden alınıyor — hayalet dip "bekle"yi "iyi zaman"
  // gösteriyordu. Bkz. _seriKur.
  const olcum = otuzGunlukSeriTemiz(u._sid);
  const min = Math.min.apply(null, olcum);
  const max = Math.max.apply(null, olcum);
  if (!(max > 0) || min >= max) return null;
  if ((max - min) / max < AL_ZAMANI_MIN_OYNAMA) return null;

  if (bugun <= min * (1 + AL_ZAMANI_TOLERANS)) {
    return { tip: 'iyi', bugun: bugun, min: min, max: max };
  }
  if (bugun >= max * (1 - AL_ZAMANI_TOLERANS) && min < bugun) {
    return { tip: 'bekle', bugun: bugun, min: min, max: max };
  }
  return null;
}

function alZamaniHTML(u) {
  const d = alZamaniDurumu(u);
  if (!d) return '';
  // Alt satırlar HAM seriye ait iddia kuruyor ("en ucuz seviyesinde",
  // "son ayda X'ye kadar indi"). Ölçüm salınımsız seriden geldiği için iddia
  // ham seriye karşı doğrulanmadan yazılmaz — bkz. _hamDipMi.
  if (d.tip === 'iyi') {
    const alt = _hamDipMi(u._sid, d.bugun)
      ? '<span class="detay-zaman-alt">son ayın en ucuz seviyesinde</span>' : '';
    return `<div class="detay-zaman detay-zaman--iyi">
      <span class="detay-zaman-ana">İyi zaman</span>
      ${alt}
    </div>`;
  }
  const altB = _hamDipMi(u._sid, d.min)
    ? `<span class="detay-zaman-alt">son ayda ${tl(d.min)}'ye kadar indi</span>` : '';
  return `<div class="detay-zaman detay-zaman--bekle">
      <span class="detay-zaman-ana">Beklemek mantıklı</span>
      ${altB}
    </div>`;
}

// Kart ve detayin TEK rozet kaynagi. Sirali: supheli > gercek indirim > indirim.
// Supheli ise "Büyük indirim" hic cizilmez — uygulama sahte indirimi firsat diye
// pazarlamasin. Kartta (kisa=true) kutu yerine her zaman kucuk rozet cikar.
function urunRozetleriHTML(u, kisa) {
  const sd = supheliDurum(u);
  if (sd) return (!kisa && sd.seviye === 'kutu') ? supheliKutuHTML(sd) : supheliRozetHTML();
  const gi = gercekIndirimRozetiHesapla(u);
  if (gi) return gercekIndirimRozetiHTML(gi, kisa);
  const ir = indirimRozetiHesapla(u);
  return ir ? indirimRozetiHTML(ir, kisa) : '';
}

// ═══ Fiyat Geçmişi: 30 günlük min-max band + ortalama çizgi + outlier cap ═══
const _FG_MKT_AD = {
  a101: 'A101',
  bim: 'BİM',
  carrefour: 'Carrefour',
  migros: 'Migros',
  sok: 'ŞOK',
  tarim_kredi: 'Tarım Kredi',
  hakmar: 'Hakmar',
};
const _FG_AYLAR = ['Oca','Şub','Mar','Nis','May','Haz','Tem','Ağu','Eyl','Eki','Kas','Ara'];

function _fgTarihFormatla(iso) {
  const [y, m, d] = iso.split('-');
  return parseInt(d, 10) + ' ' + _FG_AYLAR[parseInt(m, 10) - 1];
}

function _fgGunFarki(isoA, isoB) {
  const a = new Date(isoA + 'T00:00:00Z');
  const b = new Date(isoB + 'T00:00:00Z');
  return Math.round((b - a) / 86400000);
}

// ── EN UCUZ / EN PAHALI ÖZET BİLGİSİ — eşitlikte TÜM marketler + EN GEÇ tarih ──
// temiz: [{t: ISO tarih, m: market kodu, f: fiyat}]. Minimum (veya maksimum)
// fiyata sahip TÜM kayıtlar toplanır: market adlarının HEPSİ yazılır
// (_veBaglacliListe ile "A ve B" / "A, B ve C"), tarih olarak ise en GEÇ
// (en son) görülen seçilir -- kullanıcı için yararlı olan "bu fiyat hâlâ o
// seviyeye iniyor mu" sorusudur, ilk görüldüğü tarih değil. Aynı fiyat
// birden çok AYRI tarihte görülmüşse "en son " ön eki eklenir; tek tarihte
// görülmüşse eklenmez. Ölçüm (13.503 seri): minimum fiyat serilerin
// %2,6'sında birden çok markette, %20,9'unda birden çok tarihte eşit
// çıkıyor -- reduce ile "ilkini al" öncesi davranış hem market adını hem
// tarihi keyfi seçiyordu.
function _fgAsiriDegerBilgisi(temiz, yon) {
  const hedefF = yon === 'min'
    ? temiz.reduce((m, k) => (k.f < m ? k.f : m), temiz[0].f)
    : temiz.reduce((m, k) => (k.f > m ? k.f : m), temiz[0].f);
  const esitler = temiz.filter(k => k.f === hedefF);
  const tarihler = [...new Set(esitler.map(k => k.t))].sort();
  const enGecTarih = tarihler[tarihler.length - 1];
  const enSonMu = tarihler.length > 1;
  const adlarSet = new Set();
  const adlar = [];
  esitler.forEach(k => {
    const ad = _FG_MKT_AD[k.m] || _kacir(k.m);
    if (!adlarSet.has(ad)) { adlarSet.add(ad); adlar.push(ad); }
  });
  return {
    fiyat: hedefF,
    tarihText: (enSonMu ? 'en son ' : '') + _fgTarihFormatla(enGecTarih),
    marketText: _veBaglacliListe(adlar),
  };
}

function _fgEmptyBlock(mesaj) {
  return '<div class="detay-section detay-section--gecmis"><div class="detay-sec-label">Fiyat Geçmişi</div><div class="fg-empty">' + mesaj + '</div></div>';
}

function fiyatGecmisiBlogu(urun) {
  if (!urun || !urun._sid) return '';
  if (typeof _gecmisCache === 'undefined' || !_gecmisCache) return '';
  const tumKayitlar = _gecmisCache[urun._sid];
  if (!tumKayitlar || !Array.isArray(tumKayitlar) || tumKayitlar.length === 0) {
    return _fgEmptyBlock('Bu ürün için fiyat geçmişi henüz yok');
  }

  // Son 30 gün
  const bugun = new Date();
  const limitIso = _yerelGunISO(30);            // yerel takvim günü, bkz. _yerelGunISO
  const son30 = tumKayitlar.filter(k => k && k.t && k.f != null && k.m && k.t >= limitIso);

  // Eligibility: 7+ farklı tarih
  const farkliTarihler = new Set(son30.map(k => k.t));
  if (farkliTarihler.size < 7) {
    // Veri YOK demek degil: fiyat son ayda yeterince farkli gunde degismedigi
    // icin cizilecek nokta yok. Ust taraftaki "son ayda X TL'ye kadar indi"
    // blogu ayni ekranda durabildigi icin metin sebebi acikca soyluyor.
    return _fgEmptyBlock('Grafik için yeterli fiyat noktası yok · Fiyat son ayda az değişti');
  }

  // Aynı tarih + market varsa en son kaydı al
  const dedupe = {};
  son30.forEach(k => { dedupe[k.t + '|' + k.m] = k.f; });
  const temiz = Object.entries(dedupe).map(([key, f]) => {
    const [t, m] = key.split('|');
    return { t, m, f };
  });

  // Veri kalitesi kontrolü: üç metrik birden — herhangi biri tetiklerse veri tutarsız
  // P75/P25 > 2.5  → geniş bimodal dağılım (kruvasan gibi)
  // median/P25 > 1.5 → alt cluster (küçük paket karışmış, Erikli gibi)
  // max/median > 3.0 → extreme üst outlier (yedek savunma)
  const tutarlilikF = temiz.map(k => k.f).sort((a, b) => a - b);
  const p25t = tutarlilikF[Math.floor(tutarlilikF.length * 0.25)];
  const p75t = tutarlilikF[Math.floor(tutarlilikF.length * 0.75)];
  const medianT = tutarlilikF[Math.floor(tutarlilikF.length / 2)];
  const kontrolMax = tutarlilikF[tutarlilikF.length - 1];
  const veriTutarsiz = p25t > 0 && medianT > 0 && (
    (p75t / p25t) > 2.5 ||
    (medianT / p25t) > 1.5 ||
    (kontrolMax / medianT) > 3.0
  );
  if (veriTutarsiz) {
    return _fgEmptyBlock('Bu üründe fiyat geçmişi henüz güvenilir değil');
  }

  // Median-bazlı outlier tespiti (üst kenar): median * 1.8 üstü = outlier
  // Alt kenar outlier'ı yok — gerçek fiyat düşüşleri her zaman bilgi
  const sortedF = temiz.map(k => k.f).sort((a, b) => a - b);
  const median = sortedF[Math.floor(sortedF.length / 2)];
  const outlierEsik = median * 1.8;
  const isOutlier = f => f > outlierEsik;
  const outlierKayitlar = temiz.filter(k => isOutlier(k.f));
  const filtreli = temiz.filter(k => !isOutlier(k.f));

  // Eğer filtreli veri çok azaldıysa (örn. tamamı outlier) fallback olarak ham veri
  const gunlukKaynak = filtreli.length >= 5 ? filtreli : temiz;
  const outlierAktif = filtreli.length >= 5 && outlierKayitlar.length > 0;

  // Tarihe göre grupla
  const tariheGore = {};
  gunlukKaynak.forEach(k => {
    if (!tariheGore[k.t]) tariheGore[k.t] = [];
    tariheGore[k.t].push(k.f);
  });
  const gunler = Object.keys(tariheGore).sort().map(t => {
    const fiyatlar = tariheGore[t];
    return {
      t,
      min: Math.min(...fiyatlar),
      max: Math.max(...fiyatlar),
      avg: fiyatlar.reduce((s, f) => s + f, 0) / fiyatlar.length,
    };
  });

  // Y eksen sınırları — gunlukKaynak'tan (outlier hariç)
  const kaynakF = gunlukKaynak.map(k => k.f);
  const fMin = Math.min(...kaynakF);
  const fMax = Math.max(...kaynakF);
  const fPad = (fMax - fMin) * 0.08 || 1;
  const fAlt = Math.max(0, Math.floor(fMin - fPad));
  const fUst = Math.ceil(fMax + fPad);

  // SVG koordinatları
  const W = 320, H = 180;
  const padL = 38, padR = 12, padT = 14, padB = 28;
  const chartW = W - padL - padR;
  const chartH = H - padT - padB;
  // X aralığı tüm tarihleri kapsar (outlier dahil), grafik horizontal scope korunsun
  const tumTarihler = [...new Set(temiz.map(k => k.t))].sort();
  const minT = tumTarihler[0];
  const maxT = tumTarihler[tumTarihler.length - 1];
  const gunAraligi = Math.max(1, _fgGunFarki(minT, maxT));
  const xFor = iso => padL + (_fgGunFarki(minT, iso) / gunAraligi) * chartW;
  const yFor = f => padT + chartH - ((f - fAlt) / (fUst - fAlt)) * chartH;

  // Band path
  const minNok = gunler.map(g => xFor(g.t).toFixed(1) + ' ' + yFor(g.min).toFixed(1));
  const maxNok = gunler.map(g => xFor(g.t).toFixed(1) + ' ' + yFor(g.max).toFixed(1)).reverse();
  const bandPath = 'M ' + minNok.join(' L ') + ' L ' + maxNok.join(' L ') + ' Z';

  // Ortalama line path
  const avgPath = gunler.map((g, i) => (i === 0 ? 'M' : 'L') + ' ' + xFor(g.t).toFixed(1) + ' ' + yFor(g.avg).toFixed(1)).join(' ');

  // Outlier işaretleri — üst kenarda küçük kırmızı dot (X tarihte, Y=padT-3)
  let outlierMarkers = '';
  outlierKayitlar.forEach(k => {
    const x = xFor(k.t);
    outlierMarkers += '<circle cx="' + x.toFixed(1) + '" cy="' + (padT - 3) + '" r="2.5" class="fg-outlier"/>';
  });

  // Net fiyat noktaları: ilk gün, son gün, en düşük ortalama, en yüksek ortalama
  // DOĞRULANDI (değiştirilmedi): "<" / ">" ile reduce EŞİTLİKTE ZATEN EN GEÇ
  // günü tutuyor -- ilkini değil. reduce soldan sağa aktığı için eşit avg'de
  // sıkı eşitsizlik false döner ve akış hep sağdaki (daha geç) elemana geçer;
  // bu, dizideki global min/maks değerin SON görüldüğü indekste durmakla
  // sonuçlanır (node ile üç kontrol serisiyle doğrulandı). "<=" / ">=" yapmak
  // burada YANLIŞ yönde bir REGRESYON olurdu -- eşitlikte EN ERKEN günü
  // seçmeye çevirirdi. Bu yüzden operatörler kasıtlı olarak değiştirilmedi.
  const fgFiyatYaz = f => f.toFixed(2).replace('.', ',');
  const ilkGun = gunler[0];
  const sonGun = gunler[gunler.length - 1];
  const enDusukGun = gunler.reduce((a, b) => a.avg < b.avg ? a : b);
  const enYuksekGun = gunler.reduce((a, b) => a.avg > b.avg ? a : b);

  const etiketliGunlerSet = new Set([ilkGun.t, sonGun.t, enDusukGun.t, enYuksekGun.t]);
  const etiketliGunler = gunler.filter(g => etiketliGunlerSet.has(g.t));

  let fgNoktalar = '';
  let fgEtiketler = '';
  gunler.forEach(g => {
    const x = xFor(g.t);
    const y = yFor(g.avg);
    const oneCikan = etiketliGunlerSet.has(g.t);
    fgNoktalar += '<circle cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="' + (oneCikan ? 3.5 : 2) + '" class="fg-point' + (oneCikan ? ' fg-point-vurgu' : '') + '"/>';
  });
  etiketliGunler.forEach(g => {
    const x = xFor(g.t);
    const y = yFor(g.avg);
    const ustte = g.t === enDusukGun.t ? false : true;
    const etiketY = ustte ? (y - 8) : (y + 14);
    let anchor = 'middle';
    if (g.t === ilkGun.t) anchor = 'start';
    if (g.t === sonGun.t) anchor = 'end';
    fgEtiketler += '<text x="' + x.toFixed(1) + '" y="' + etiketY.toFixed(1) + '" text-anchor="' + anchor + '" class="fg-fiyat-etiket">' + fgFiyatYaz(g.avg) + ' ₺</text>';
  });

  // Zirve işareti — yalnızca şüphe sebebi zamansal zirveyse. Süre grafiğin KENDİ
  // serisinden hesaplanır (çizilen şeyle tutarlı olsun); DB'nin fiyat_gecmisi'si
  // farklı bir seri olduğu için puanın dayandığı gün sayısı birebir aynı olmayabilir.
  let zirveIsareti = '', zirveNotu = '';
  const _sd = typeof supheliDurum === 'function' ? supheliDurum(urun) : null;
  if (_sd && _sd.sebepler.some(s => s === 'kisa_zirve' || s === 'orta_zirve')) {
    const zi = gunler.findIndex(g => g.t === enYuksekGun.t);
    const sonraki = zi >= 0 ? gunler[zi + 1] : null;
    if (sonraki) {
      const sure = _fgGunFarki(enYuksekGun.t, sonraki.t);
      const zx = xFor(enYuksekGun.t), zy = yFor(enYuksekGun.avg);
      // Grafikte sadece halka. Açıklama SVG içine değil alt yazıya yazılır —
      // fiyat etiketleri hem eğrinin çevresini hem iki köşeyi kullandığı için
      // SVG içindeki her konum bir üründe çakışıyordu (ölçüm: 36 grafikte 3).
      // Outlier notu da zaten aynı yerde duruyor.
      zirveIsareti =
        '<circle cx="' + zx.toFixed(1) + '" cy="' + zy.toFixed(1) + '" r="5.5" class="fg-zirve-halka"/>';
      zirveNotu = '<span class="fg-zirve-not">◯ Zirve · ' + sure + ' gün sürdü</span>';
    }
  }

  // Y ekseni 3 değer
  const yTicks = [fAlt, Math.round((fAlt + fUst) / 2), fUst];
  let ekseny = '';
  yTicks.forEach(v => {
    const y = yFor(v);
    ekseny += '<text x="' + (padL - 4) + '" y="' + (y + 3) + '" text-anchor="end" class="fg-axis-label">' + v + '</text>';
    ekseny += '<line x1="' + padL + '" y1="' + y + '" x2="' + (W - padR) + '" y2="' + y + '" stroke="var(--border)" stroke-width="0.5" opacity="0.3"/>';
  });

  // X ekseni 3 tarih
  const ortaTarih = tumTarihler[Math.floor(tumTarihler.length / 2)];
  const xLabels = [
    { t: minT, anchor: 'start' },
    { t: ortaTarih, anchor: 'middle' },
    { t: maxT, anchor: 'end' },
  ];
  let eksenX = '';
  xLabels.forEach(xl => {
    const x = xFor(xl.t);
    eksenX += '<text x="' + x + '" y="' + (H - 10) + '" text-anchor="' + xl.anchor + '" class="fg-axis-label">' + _fgTarihFormatla(xl.t) + '</text>';
  });

  // Özet: %değişim filtreli üzerinden, en ucuz/pahalı TÜM veriden
  const ilkYari = gunler.slice(0, Math.ceil(gunler.length / 2));
  const sonYari = gunler.slice(Math.floor(gunler.length / 2));
  const ilkAvg = ilkYari.reduce((s, g) => s + g.avg, 0) / ilkYari.length;
  const sonAvg = sonYari.reduce((s, g) => s + g.avg, 0) / sonYari.length;
  const degisim = ((sonAvg - ilkAvg) / ilkAvg) * 100;
  const yon = degisim > 1 ? 'yükseldi' : (degisim < -1 ? 'düştü' : 'sabit');
  const enUcuzBilgi = _fgAsiriDegerBilgisi(temiz, 'min');
  const enPahaliBilgi = _fgAsiriDegerBilgisi(temiz, 'max');
  const degisimText = yon === 'sabit'
    ? 'Son 30 günde fiyat <b>sabit</b>'
    : 'Son 30 günde <b>%' + Math.abs(degisim).toFixed(0) + ' ' + yon + '</b>';
  const ozetText = degisimText
    + ' · En ucuz: <b>' + enUcuzBilgi.fiyat.toFixed(2).replace('.', ',') + ' ₺</b> (' + enUcuzBilgi.tarihText + ', ' + enUcuzBilgi.marketText + ')'
    + ' · En pahalı: <b>' + enPahaliBilgi.fiyat.toFixed(2).replace('.', ',') + ' ₺</b> (' + enPahaliBilgi.tarihText + ', ' + enPahaliBilgi.marketText + ')';

  // Altyazı: outlier varsa not düş
  const altyaziText = outlierAktif
    ? 'Bant: günün fiyat aralığı · Çizgi: ortalama · <span style="color:#DC2626">●</span> Olağandışı kayıt (' + outlierKayitlar.length + ')'
    : 'Bant: günün fiyat aralığı · Çizgi: ortalama';

  return '<div class="detay-section detay-section--gecmis">'
    + '<div class="detay-sec-label">Fiyat Geçmişi</div>'
    + '<div class="fg-wrap">'
    +   '<svg class="fg-svg" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="xMidYMid meet">'
    +     ekseny
    +     '<path d="' + bandPath + '" class="fg-band"/>'
    +     '<path d="' + avgPath + '" class="fg-avg-line"/>'
    +     fgNoktalar
    +     fgEtiketler
    +     outlierMarkers
    +     zirveIsareti
    +     eksenX
    +   '</svg>'
    + '</div>'
    + '<div class="fg-altyazi">' + altyaziText + (zirveNotu ? ' · ' + zirveNotu : '') + '</div>'
    + '<div class="fg-ozet">' + ozetText + '</div>'
    + '</div>';
}

// Lucide SVG icon helpers — inline (kütüphane yüklemeden)
//
// KATEGORI IKONLARI (apple…snowflake) buraya eklendi, ayrı SVG dosyası olarak
// DEĞİL. Ölçüldü ve üç alternatif elendi:
//   • <img src="static/cat/*.svg">  → <img> içindeki SVG ayrı belgedir,
//     currentColor'ı ALMAZ; tema değişince ikon değişmezdi. Emojiden kurtulma
//     sebebimizin yarısı buydu, o yüzden eledim. (Ayrıca 8 ek istek.)
//   • CSS mask-image → tema çalışırdı ama yine 8 ek istek.
//   • sprite + <use> → 1 istek, ama ek cache/CSP yüzeyi, kazanç yok.
// Satır içi seçildi: currentColor bedava geliyor, ek istek yok ve satır içi
// SVG *markup*'tır — hiçbir CSP direktifine tabi değil, canlıdaki 9 direktif
// aynen kalıyor. Maliyet ölçüldü: 8 path = 2.126 bayt ham / 806 bayt gzip,
// app.js'in %0,83'ü.
const _LUCIDE_PATHS = {
  'alert-triangle': '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
  // .tazelik-chip zaten bu cizimi satir ici SVG olarak tasiyordu; ana sayfa
  // tazelik gostergesi ayni ikonu isteyince ikinci kopya yazmak yerine
  // projenin ikon sistemine tasindi.
  'clock': '<circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 14"/>',
  'trending-down': '<polyline points="22 17 13.5 8.5 8.5 13.5 2 7"/><polyline points="16 17 22 17 22 11"/>',

  // ── KATEGORİ İKONLARI (8) ───────────────────────────────────────────
  // Hepsi Lucide'ın KENDİ setinden alındı, elle çizilmedi: stroke/cap/join
  // sapması riski böylece sıfır. lcIcon() zaten viewBox 0 0 24 24, fill:none,
  // stroke:currentColor, width 2, round/round ve aria-hidden veriyor.
  // Metaforlar: elma=taze ürün · but=et+tavuk'u BİRLİKTE karşılayan tek şekil
  // (biftek kırmızı ete kayardı) · süt kutusu=kahvaltı · buğday=temel gıda
  // (un/pirinç/makarna/bakliyat; konserve dar kalırdı) · pipetli bardak=içecek
  // (sıcak/soğuk ayırmıyor) · sprey=temizlik · kurabiye=atıştırmalık ·
  // kar tanesi=dondurulmuş.
  'apple': '<path d="M12 20.94c1.5 0 2.75 1.06 4 1.06 3 0 6-8 6-12.22A4.91 4.91 0 0 0 17 5c-2.22 0-4 1.44-5 2-1-.56-2.78-2-5-2a4.9 4.9 0 0 0-5 4.78C2 14 5 22 8 22c1.25 0 2.5-1.06 4-1.06Z"/><path d="M10 2c1 .5 2 2 2 5"/>',
  'drumstick': '<path d="M15.45 15.4c-2.13.65-4.3.32-5.7-1.1-2.29-2.27-1.76-6.5 1.17-9.42 2.93-2.93 7.15-3.46 9.43-1.18 1.41 1.41 1.74 3.57 1.1 5.71-1.4-.51-3.26-.02-4.64 1.36-1.38 1.38-1.87 3.23-1.36 4.63z"/><path d="m11.25 15.6-2.16 2.16a2.5 2.5 0 1 1-4.56 1.73 2.49 2.49 0 0 1-1.41-4.24 2.5 2.5 0 0 1 3.14-.32l2.16-2.16"/>',
  'milk': '<path d="M8 2h8"/><path d="M9 2v2.789a4 4 0 0 1-.672 2.219l-.656.984A4 4 0 0 0 7 10.212V20a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2v-9.789a4 4 0 0 0-.672-2.219l-.656-.984A4 4 0 0 1 15 4.788V2"/><path d="M7 15a6.472 6.472 0 0 1 5 0 6.47 6.47 0 0 0 5 0"/>',
  'wheat': '<path d="M2 22 16 8"/><path d="M3.47 12.53 5 11l1.53 1.53a3.5 3.5 0 0 1 0 4.94L5 19l-1.53-1.53a3.5 3.5 0 0 1 0-4.94Z"/><path d="M7.47 8.53 9 7l1.53 1.53a3.5 3.5 0 0 1 0 4.94L9 15l-1.53-1.53a3.5 3.5 0 0 1 0-4.94Z"/><path d="M11.47 4.53 13 3l1.53 1.53a3.5 3.5 0 0 1 0 4.94L13 11l-1.53-1.53a3.5 3.5 0 0 1 0-4.94Z"/>',
  'cup-soda': '<path d="m6 8 1.75 12.28a2 2 0 0 0 2 1.72h4.54a2 2 0 0 0 2-1.72L18 8"/><path d="M5 8h14"/><path d="M7 15a6.47 6.47 0 0 1 5 0 6.47 6.47 0 0 0 5 0"/><path d="m12 8 1-6h2"/>',
  'spray-can': '<path d="M3 3h.01"/><path d="M7 5h.01"/><path d="M11 7h.01"/><path d="M3 7h.01"/><path d="M7 9h.01"/><path d="M3 11h.01"/><rect width="4" height="4" x="15" y="5"/><path d="m19 9 2 7h-8l2-7"/><path d="M13 16a3 3 0 0 0-3 3v3h8v-3a3 3 0 0 0-3-3z"/>',
  'cookie': '<path d="M12 2a10 10 0 1 0 10 10 4 4 0 0 1-5-5 4 4 0 0 1-5-5"/><path d="M8.5 8.5v.01"/><path d="M16 15.5v.01"/><path d="M12 12v.01"/><path d="M11 17v.01"/><path d="M7 14v.01"/>',
  'snowflake': '<line x1="2" x2="22" y1="12" y2="12"/><line x1="12" x2="12" y1="2" y2="22"/><path d="m20 16-4-4 4-4"/><path d="m4 8 4 4-4 4"/><path d="m16 4-4 4-4-4"/><path d="m8 20 4-4 4 4"/>',

  'flame': '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>',
  'leaf': '<path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19.2 2.96a1 1 0 0 1 1.8.66c0 4.49-1.05 8.74-6.41 11.59a7 7 0 0 1-3.59.79z"/><path d="M2 21c0-3 1.85-5.36 5.08-6"/>',
  'coins': '<circle cx="8" cy="8" r="6"/><path d="M18.09 10.37A6 6 0 1 1 10.34 18"/><path d="M7 6h1v4"/><path d="m16.71 13.88.7.71-2.82 2.82"/>',
  'shopping-cart': '<circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/>',
  'search-x': '<path d="m13.5 8-4 4"/><path d="m17.5 8-4 4"/><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>',
  'filter-x': '<path d="M13.5 8H11V6.5L4.5 13l6.5 6.5V18h2.5l5-5-5-5Z"/><path d="m18 12 4 4"/><path d="m22 12-4 4"/>',
  'zap': '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>',
  'share-2': '<path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/>',
  'building-2': '<path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"/><path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"/><path d="M18 12h2a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2h-2"/><path d="M6 22v-4"/><path d="M18 22v-4"/>',
  'database': '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5V19A9 3 0 0 0 21 19V5"/><path d="M3 12A9 3 0 0 0 21 12"/>',
  'refresh-cw': '<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>',
  'info': '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>',
  'heart': '<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.29 1.51 4.04 3 5.5l7 7Z"/>',
  'search': '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  'bell': '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
  'trash-2': '<path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/>',
  'store': '<path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7"/><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><path d="M2 7h20"/><path d="M12 22V12"/>',
  'bookmark': '<path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"/>',
  'megaphone': '<path d="m3 11 18-5v12L3 14v-3z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/>'
};
function lcIcon(name, klass) {
  const path = _LUCIDE_PATHS[name];
  if (!path) return '';
  const c = klass || 'lc-icon';
  return `<svg class="${c}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>`;
}

function indirimRozetiHTML(rozet, kisa) {
  if (!rozet) return '';
  if (rozet.tip === 'buyuk') {
    return kisa
      ? `<span class="indirim-rozet buyuk-kisa">${lcIcon('flame')} -%${rozet.yuzde}</span>`
      : `<span class="indirim-rozet buyuk">${lcIcon('flame')} Büyük indirim · Son ayın zirvesinden %${rozet.yuzde} ucuz</span>`;
  }
  return kisa
    ? `<span class="indirim-rozet normal-kisa">${lcIcon('trending-down')} -%${rozet.yuzde}</span>`
    : `<span class="indirim-rozet normal">${lcIcon('trending-down')} Fiyat düştü · Son ayın zirvesinden %${rozet.yuzde} ucuz</span>`;
}

function tuzakRozetiHesapla(u) {
  if (!u) return null;
  if (!TUZAK_WHITELIST.has(u.ana_kategori)) return null;
  const bfu = birimFiyatHesapla(u);
  if (!bfu) return null;
  const digerler = digerPaketleriBul(u);
  if (!digerler.length) return null;
  const ayniBirim = digerler
    .map(d => ({ u: d, bf: birimFiyatHesapla(d) }))
    .filter(x => x.bf && x.bf.birim === bfu.birim);
  if (!ayniBirim.length) return null;
  const adayRef = _agirlikRef(u);
  if (adayRef != null) {
    let minDiger = Infinity;
    ayniBirim.forEach(x => {
      const r = _agirlikRef(x.u);
      if (r != null && r < minDiger) minDiger = r;
    });
    if (minDiger !== Infinity && adayRef < minDiger * 0.3) return null;
  }
  let enUcuz = bfu.deger;
  ayniBirim.forEach(x => { if (x.bf.deger < enUcuz) enUcuz = x.bf.deger; });
  if (bfu.deger <= enUcuz) return null;
  const fark = ((bfu.deger - enUcuz) / enUcuz) * 100;
  if (fark < 25) return null;
  if (fark >= 50) return { tip: 'kirmizi', yuzde: Math.round(fark) };
  return { tip: 'sari', yuzde: Math.round(fark) };
}

function tuzakRozetiHTML(rozet, kisa) {
  if (!rozet) return '';
  if (rozet.tip === 'kirmizi') {
    return kisa
      ? `<div class="tuzak-rozet kirmizi"><span class="lc-dot kirmizi"></span>Tuzak · %${rozet.yuzde} pahalı</div>`
      : `<div class="tuzak-rozet kirmizi"><span class="lc-dot kirmizi"></span>Küçük paket tuzağı · Birim fiyat %${rozet.yuzde} daha yüksek</div>`;
  }
  return kisa
    ? `<div class="tuzak-rozet sari"><span class="lc-dot sari"></span>%${rozet.yuzde} pahalı</div>`
    : `<div class="tuzak-rozet sari"><span class="lc-dot sari"></span>Birim fiyat %${rozet.yuzde} daha yüksek</div>`;
}



function adOzu(ad) {
  if (!ad) return new Set();
  let s = String(ad).toLowerCase();
  const tr = {'ş':'s','ğ':'g','ü':'u','ı':'i','ö':'o','ç':'c'};
  s = s.replace(/[şğüıöç]/g, c => tr[c] || c);
  s = s.replace(/\d+[\s.,]*(kg|gr|gram|ml|lt|cl|adet|paket|li|lu|lik|luk)\b/gi, '');
  s = s.replace(/\d+/g, ' ');
  const stop = new Set(['mini','buyuk','kucuk','orta','ithal','yerli','organik','taze','premium','ozel','extra','jumbo','select','ekonomik','ekstra','klasik','seckin','dilim','dilimli','tane','adet','paket','ambalaj','soguk','sicak','sade','tatli','aci','tuzlu']);
  const tokens = s.split(/[^a-z]+/).filter(t => t.length > 2 && !stop.has(t));
  return new Set(tokens);
}

function adKesisimVar(u1, u2) {
  const a = adOzu(u1 && u1.ad), b = adOzu(u2 && u2.ad);
  if (!a.size || !b.size) return false;
  for (const w of a) if (b.has(w)) return true;
  return false;
}

let _akIndex = null;
let _akIndexSize = 0;

function _akIndexRebuildIfNeeded() {
  const size = Object.keys(productMap).length;
  if (_akIndex && size === _akIndexSize) return;
  _akIndex = {};
  for (const k in productMap) {
    const u = productMap[k];
    if (!u) continue;
    const key = (u.ana_kategori || '');
    if (!_akIndex[key]) _akIndex[key] = [];
    _akIndex[key].push(u);
  }
  _akIndexSize = size;
}

function rakipMarkalariBul(u) {
  if (!u || !u.agirlik_hacim || !productMap) return [];
  _akIndexRebuildIfNeeded();
  const aday = _akIndex[u.ana_kategori || ''] || [];
  const ah = String(u.agirlik_hacim || '').toLowerCase().trim();
  const out = [];
  for (const v of aday) {
    if (!v || v._id === u._id) continue;
    if (markaBul(v) === markaBul(u)) continue;
    if (String(v.agirlik_hacim || '').toLowerCase().trim() !== ah) continue;
    if (!adKesisimVar(v, u)) continue;
    out.push(v);
  }
  out.sort((a,b) => {
    const ba = birimFiyatHesapla(a), bb = birimFiyatHesapla(b);
    if (!ba && !bb) return 0;
    if (!ba) return 1; if (!bb) return -1;
    return ba.deger - bb.deger;
  });
  return out.slice(0, 6);
}

// Listede birim fiyatı KARŞILAŞTIRILABİLİR olanlar arasında en iyiyi bulur.
// Sadece aynı birim (kg / L / adet) kendi içinde karşılaştırılır; grupta tek
// ürün varsa "en iyi" demek anlamsız olduğu için vurgulanmaz.
// Birim fiyatı hesaplanamayan ürün hiç yarışmaz — uydurma değer üretilmez.
let _enIyiBirimSet = null;

function enIyiBirimIdleri(liste) {
  const sonuc = new Set();
  if (!liste || !liste.length) return sonuc;
  const gruplar = {};
  liste.forEach(u => {
    const bf = birimFiyatHesapla(u);
    if (!bf || !(bf.deger > 0)) return;
    if (!gruplar[bf.birim]) gruplar[bf.birim] = [];
    gruplar[bf.birim].push({ id: u._id, deger: bf.deger });
  });
  Object.values(gruplar).forEach(g => {
    if (g.length < 2) return;
    // Eşit birim fiyata sahip TÜM ürünler işaretlenir -- yalnızca ilk
    // rastlanan değil. Aksi halde aynı birim fiyata sahip iki üründen
    // biri "en ucuz" alır, diğeri almaz: yanlış değil ama yanıltıcı.
    const enDeger = Math.min(...g.map(x => x.deger));
    g.forEach(x => { if (x.deger === enDeger && x.id != null) sonuc.add(x.id); });
  });
  return sonuc;
}

function birimFiyatYazi(bf) {
  if (!bf) return '';
  return bf.birim + ' başına ' + tl(bf.deger);
}

// ── AYKIRI FİYAT FİLTRESİ ─────────────────────────────────────────
// Bir markette sehven girilmiş uçuk fiyat, "en pahalı" satırını ve tasarruf
// hesabını bozuyordu. Dönüş: { gecerli: [{market,fiyat}], gizlenen: [{market,fiyat}] }
// Her ikisi de girdi sırasını korur.
// Marketin ILAN ETTIGI liste fiyati (API: discountlessPrice). Bizim
// fiyat_gecmisi cikarimimizdan bagimsiz, kaynagin kendi beyani.
// Sadece urun detayinda, market fiyat satirinda gosterilir.
function listeFiyatHTML(mf) {
  if (!mf) return '';
  const liste = mf.liste_fiyat, satis = mf.fiyat;
  if (liste == null || satis == null || !(liste > satis)) return '';
  const yuzde = Math.round(((liste - satis) / liste) * 100);
  if (!(yuzde > 0)) return '';
  return `<span class="detay-mkt-liste"><s>${tl(liste)}</s><span class="detay-mkt-liste-yuzde">-%${yuzde}</span></span>`;
}

function fiyatlariTemizle(market_fiyatlari) {
  const liste = (market_fiyatlari || []).filter(f => f && f.fiyat != null);
  if (liste.length < 2) return { gecerli: liste.slice(), gizlenen: [] };

  const gecerli = [], gizlenen = [];

  // 2 market: biri diğerinin 5 katından fazlaysa yüksek olanı gizle
  if (liste.length === 2) {
    const dusuk  = liste[0].fiyat <= liste[1].fiyat ? liste[0] : liste[1];
    const yuksek = dusuk === liste[0] ? liste[1] : liste[0];
    if (dusuk.fiyat > 0 && yuksek.fiyat > dusuk.fiyat * 5) {
      liste.forEach(f => (f === yuksek ? gizlenen : gecerli).push(f));
    } else {
      liste.forEach(f => gecerli.push(f));
    }
    return { gecerli, gizlenen };
  }

  // 3+ market: kendisi hariç diğerlerinin medyanının 3 katından yüksekse gizle
  const medyan = sayilar => {
    const s = sayilar.slice().sort((a, b) => a - b);
    const o = Math.floor(s.length / 2);
    return s.length % 2 ? s[o] : (s[o - 1] + s[o]) / 2;
  };
  liste.forEach((f, i) => {
    const m = medyan(liste.filter((_, j) => j !== i).map(x => x.fiyat));
    if (m > 0 && f.fiyat > m * 3) gizlenen.push(f);
    else gecerli.push(f);
  });
  return { gecerli, gizlenen };
}

// ── TAZELİK DAMGASI ───────────────────────────────────────────────
// son_senkron yoksa/bozuksa sessizce düşer, hata basmaz.
function tazelikChipHTML(u) {
  const ham = u && u.son_senkron;
  if (!ham) return '';
  const d = new Date(ham);
  if (isNaN(d.getTime())) return '';
  const simdi = new Date();
  // Takvim günü farkı (yerel saat) — toISOString kullanma, gün kaydırır
  const g1 = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const g0 = new Date(simdi.getFullYear(), simdi.getMonth(), simdi.getDate());
  const gun = Math.round((g0 - g1) / 86400000);
  if (gun < 0) return '';

  let sinif, metin;
  if (gun === 0) {
    const ss = String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
    sinif = 'taze'; metin = `Bugün ${ss}'te güncellendi`;
  } else if (gun === 1) {
    sinif = 'taze'; metin = 'Dün güncellendi';
  } else if (gun <= 4) {
    sinif = 'orta'; metin = `${gun} gün önce güncellendi`;
  } else {
    sinif = 'eski'; metin = `${gun} gün önce güncellendi · Bu fiyat eski olabilir`;
  }
  return `<div class="tazelik-chip ${sinif}"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 14"/></svg>${metin}</div>`;
}

// ── DETAY MARKET SATIRI DURUMU (best/worst/rozet) ───────────────────
// Salt hesap -- DOM'a dokunmaz, testte doğrudan çağrılabilir. "en pahalı"
// GERÇEKTEN farklı fiyat varsa iddia edilir. Bütün marketler aynı fiyatı
// veriyorsa (mktler.length>1 ama hepsi eşit) ne best ne worst ne rozet
// işaretlenir -- satırlar nötr kalır (bkz. test_esit_fiyat.mjs).
// Fiyatların en düşüğü ya da en yükseği birden çok markette EŞİTSE (ör. 3
// market, 2'si aynı en düşük ya da aynı en yüksek fiyatta) o eşit-uçtaki
// marketlerin HEPSİ işaretlenir -- yalnızca sıralamada ilk ya da son sıraya
// düşen tek satır değil. Aksi halde tekil ("en ucuz"/"en pahalı" TEK
// marketmiş) yanlış iddiası -- ki bu görsel bir iddiadır, .best/.worst CSS
// sınıfları satırı yeşil/kırmızı boyar -- tam bu projenin bilinen hata
// desenine (kod bir şey ölçer, görsel başkasını iddia eder) girerdi.
function _mktRowDurumu(mktler) {
  if (!mktler || !mktler.length) return { fiyatlarFarkli: false, durumlar: [] };
  const enDusukFiy  = mktler[0].fiyat;
  const enYuksekFiy = mktler[mktler.length - 1].fiyat;
  const fiyatlarFarkli = mktler.length > 1 && enYuksekFiy !== enDusukFiy;
  const durumlar = mktler.map((f) => ({
    isBest: fiyatlarFarkli && f.fiyat === enDusukFiy,
    isWorst: fiyatlarFarkli && f.fiyat === enYuksekFiy,
  }));
  return { fiyatlarFarkli, durumlar };
}

// ── TÜRKÇE "VE" BAĞLAÇLI LİSTE ─────────────────────────────────────
// ["A"] -> "A" · ["A","B"] -> "A ve B" · ["A","B","C"] -> "A, B ve C"
function _veBaglacliListe(adlar) {
  if (!adlar || !adlar.length) return '';
  if (adlar.length === 1) return adlar[0];
  return adlar.slice(0, -1).join(', ') + ' ve ' + adlar[adlar.length - 1];
}

// ── EŞİT FİYAT BİLGİ SATIRI ─────────────────────────────────────────
// Bütün marketler AYNI fiyatı veriyorsa (detay ekranındaki "en pahalı"
// rozetinin bilerek basılmadığı durum) kullanıcıya hangi marketlerin eşit
// olduğu söylenir -- sayı değil, isim: "kaç market" onun işine yaramaz.
function _esitFiyatBilgiHTML(mktler, fiyatlarFarkli) {
  if (fiyatlarFarkli || !mktler || mktler.length < 2) return '';
  const adlar = mktler.map(f => MARKET_NAMES[f.market] || _kacir(f.market) || '?');
  return `<div class="fg-ozet">${_veBaglacliListe(adlar)} aynı fiyatı veriyor</div>`;
}

// ── GİZLENEN FİYAT SATIRI ─────────────────────────────────────────
function _gizlenenFiyatHTML(temiz) {
  const g = temiz.gizlenen;
  if (!g.length) return '';
  const f = temiz.gecerli.map(x => x.fiyat).sort((a, b) => a - b);
  const o = Math.floor(f.length / 2);
  const med = f.length ? (f.length % 2 ? f[o] : (f[o - 1] + f[o]) / 2) : 0;
  const kat = med > 0 ? Math.round(g[0].fiyat / med) : 0;
  const satirlar = g.map(x => `<div class="detay-mkt-row gizli">
      ${_marketEtiketiHTML(x.market)}
      <span class="detay-mkt-price">${tlHTML(x.fiyat)}</span>
    </div>`).join('');
  return `<button type="button" class="gizli-fiyat-ozet" aria-expanded="false" onclick="gizlenenFiyatToggle(this)">
      <span>${g.length} fiyat gizlendi${kat ? ` — diğerlerinden ${kat} kat yüksek` : ''}</span>
      <svg viewBox="0 0 24 24" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>
    </button>
    <div class="gizli-fiyat-liste" hidden>${satirlar}</div>`;
}

function gizlenenFiyatToggle(btn) {
  const liste = btn.nextElementSibling;
  if (!liste) return;
  const kapali = liste.hasAttribute('hidden');
  if (kapali) liste.removeAttribute('hidden'); else liste.setAttribute('hidden', '');
  btn.setAttribute('aria-expanded', String(kapali));
  btn.classList.toggle('acik', kapali);
}

// ── BİLDİRİM UYARILARI ────────────────────────────────────────────
// Bu harita YALNIZCA rozet sayilarini besliyor ("N kişi bu fiyatın tutmadığını
// bildirdi") — okuma. get_fiyat_bildirimleri anon'a 200 [] donuyor, o yuzden
// oturumsuzda harita bos kalir ve rozet cizilmez; bu dogru, buradan yetki
// TURETILMEZ.
let _fiyatBildirimMap = new Map();

// ── BILDIRIM YAZMA YETKISI ────────────────────────────────────────────
// GUVENLIK: yazma yetkisi = OTURUM VARLIGI, "RPC hata verdi mi" DEGIL.
// Eski kapi (get_fiyat_bildirimleri hata vermezse _bildirimYetkiVar=true)
// KIRIKTI: RPC anon'a 200 [] donduruyor, hata olmuyor, bayrak true oluyordu ve
// "Bu fiyat tutmadı" butonu oturumsuz kullaniciya da cikiyordu. DB tarafi artik
// yalnizca authenticated'a acik (policy: with check kullanici_id = auth.uid()),
// istemci de ona uyduruldu. Canli okuma: kullanici oturum acip kapatirsa da
// dogru sonuc verir (acilista yakalanan boolean degil).
function _bildirimYetkiVarMi() {
  return !!(window.pazarAuth && window.pazarAuth.user);
}

async function fiyatBildirimleriYukle() {
  let data, error;
  try {
    ({ data, error } = await window.supabaseClient.rpc('get_fiyat_bildirimleri'));
  } catch (e) {
    // AG/ISTEK HATASI — bos sonuctan AYRI dal. Rozetler cizilmez ama bu bir hata.
    console.warn('[bildirim] fiyat bildirim sayilari alinamadi, istek hatasi, rozetler cikmayacak:', e && e.message);
    return;
  }
  if (error) {
    // RPC HATASI — yine bos sonuctan AYRI dal, ayni davranisi URETMEZ.
    console.warn('[bildirim] fiyat bildirim RPC hatasi, rozetler cikmayacak:', error.message);
    return;
  }
  if (!data || !data.length) {
    // BOS SONUC — hata DEGIL (anon'a normal, girisli kullanicinin hic bildirimi
    // olmayabilir). Sessiz gec; yetki buradan TURETILMIYOR.
    return;
  }
  data.forEach(r => {
    const sid = r._sid || r.sid;
    const adet = r.adet != null ? r.adet : (r.sayi != null ? r.sayi : r.count);
    if (sid && r.market) _fiyatBildirimMap.set(sid + '|' + r.market, Number(adet) || 0);
  });
}
document.addEventListener('DOMContentLoaded', fiyatBildirimleriYukle);

// Şüpheli indirim puanları da açılışta tek sefer (876 satır / ~17 KB gzip).
// Gelmezse _puanCache null kalır ve hiçbir şüphe/gerçek-indirim rozeti çizilmez.
document.addEventListener('DOMContentLoaded', function () {
  supheliPuanlariYukle().then(function (m) {
    if (!m) return;
    // Rozetler ilk çizimden sonra gelebilir; görünen listeleri tazele.
    if (typeof uygulaCatFiltre === 'function' && window.yuklenenUrunler && window.yuklenenUrunler.length) {
      uygulaCatFiltre();
    }
  });
});

function bildirimUyariHTML(sid, market) {
  if (!sid || !market) return '';
  const n = _fiyatBildirimMap.get(sid + '|' + market);
  if (!n) return '';
  return `<div class="fiyat-uyari">${n} kişi bu fiyatın markette tutmadığını bildirdi</div>`;
}

// ── "BU FİYAT TUTMADI" BİLDİRİMİ ──────────────────────────────────
let _bildirimSecilenMarket = null;

function _bildirimMarketSec(el) {
  _bildirimSecilenMarket = el.dataset.bildirimMarket;
  Array.from(el.parentElement.querySelectorAll('.bildirim-pill')).forEach(p => {
    const secili = p === el;
    p.classList.toggle('secili', secili);
    p.setAttribute('aria-pressed', String(secili));
  });
}

async function fiyatBildirAc(urunId) {
  // OTURUM KAPISI — asil koruma DB'de (policy: to authenticated, with check
  // kullanici_id = auth.uid(); anon INSERT reddediliyor). Istemci buna uyuyor:
  // oturumsuz kullanici INSERT'e HIC gitmesin. kullanici_id istemciden
  // gonderildigi icin (asagida), session yoksa gonderilecek gecerli bir kimlik
  // de yok. Ham hata degil, anlasilir yonlendirme: modalAc dili (native
  // alert/confirm YOK). favToggle'daki (app.js:355) desenle ayni aile.
  if (!_bildirimYetkiVarMi()) {
    // NOT: modalAc cancelText okumuyor, iptal butonu statik "İptal" (index.html:640).
    const gir = await modalAc({
      title: 'Giriş gerekiyor',
      msg: 'Fiyat bildirimi için giriş yapman gerekiyor. Böylece bildirimin sana bağlanır ve tekrarları önleriz.',
      okText: 'Giriş yap'
    });
    if (gir === true && typeof window.openAuthSheet === 'function') window.openAuthSheet('login');
    return;
  }

  const u = productMap[urunId];
  if (!u) return;
  const mktler = fiyatlariTemizle(u.market_fiyatlari).gecerli;
  if (!mktler.length) return;

  _bildirimSecilenMarket = mktler[0].market;
  // data-bildirim-market -- KASITLI OLARAK "data-market" DEĞİL. Kategori/detay
  // ekranlarındaki market filtresi çipleri de "data-market" öznitelik adını
  // kullanıyor ve document.querySelectorAll('[data-market]') ile (bkz. aşağıda
  // uygulaCatFiltre içindeki döngü) global taranıyor -- aynı adı burada da
  // kullanmak bu bildirim pill'lerini o döngüye yanlışlıkla dahil eder, filtre
  // durumuna göre active/disabled/pointerEvents uygulanır ve tıklanamaz olabilirler.
  const pills = mktler.map((f, i) => `<button type="button" class="bildirim-pill${i === 0 ? ' secili' : ''}" aria-pressed="${i === 0}" data-bildirim-market="${_kacir(f.market)}" onclick="_bildirimMarketSec(this)">${MARKET_NAMES[f.market] || _kacir(f.market)}</button>`).join('');

  const sonuc = await modalAc({
    title: 'Bu fiyat tutmadı',
    msg: 'Hangi markette tutmadı?',
    bodyHtml: `<div class="bildirim-pill-wrap">${pills}</div>`,
    input: true,
    placeholder: 'Rafta gördüğün fiyat (₺) — isteğe bağlı',
    okText: 'Gönder'
  });
  if (sonuc === false) return;

  const market = _bildirimSecilenMarket;
  // 24 saatlik localStorage sogumasi — SPAM'i azaltir ama ARTIK TEK KORUMA
  // DEGIL ve guvenlik siniri de degil: yalnizca bu tarayicida, silinebilir,
  // istemci tarafi. Asil kimlik/yetki siniri DB policy'sinde (authenticated +
  // kullanici_id = auth.uid()). Bu kontrol UX icin (ayni kullaniciyi ayni
  // urunde gunde bir kez atmaya tesvik), guvenlik icin degil.
  const anahtar = 'fb_' + (u._sid || '') + '_' + market;
  const onceki = Number(localStorage.getItem(anahtar) || 0);
  if (onceki && Date.now() - onceki < 86400000) {
    toastGoster('Bu ürün için bildirimin zaten alındı');
    return;
  }

  const eslesen = mktler.find(f => f.market === market);
  let bildirilen = null;
  if (typeof sonuc === 'string' && sonuc) {
    const n = parseFloat(sonuc.replace(',', '.').replace(/[^\d.]/g, ''));
    if (!isNaN(n)) bildirilen = n;
  }

  // IKINCI SAVUNMA: modal aciktayken oturum dusmus olabilir (token suresi,
  // baska sekmede cikis). Session yoksa INSERT'i HIC atma — kullanici_id
  // istemciden gidiyor ve oturumsuz gecerli kimlik yok; ustelik DB zaten
  // reddederdi ama bos istek atmaya gerek yok.
  const _user = window.pazarAuth && window.pazarAuth.user;
  if (!_user) {
    toastGoster('Oturumun kapanmış görünüyor, tekrar giriş yap');
    return;
  }

  try {
    const { error } = await window.supabaseClient.from('fiyat_bildirim').insert({
      _sid: u._sid || null,
      market: market,
      gosterilen_fiyat: eslesen ? eslesen.fiyat : null,
      bildirilen_fiyat: bildirilen,
      kullanici_id: _user.id
    });
    if (error) { toastGoster('Bildirim gönderilemedi'); return; }
  } catch (e) { console.warn('[bildirim] fiyat bildirim penceresi acilamadi:', e && e.message);
    toastGoster('Bildirim gönderilemedi');
    return;
  }

  localStorage.setItem(anahtar, String(Date.now()));
  const k = (u._sid || '') + '|' + market;
  _fiyatBildirimMap.set(k, (_fiyatBildirimMap.get(k) || 0) + 1);
  toastGoster('Bildirimin alındı, teşekkürler');
}

function cardHTML(u) {
  const mktler  = fiyatlariTemizle(u.market_fiyatlari).gecerli.slice().sort((a,b) => a.fiyat - b.fiyat);
  const cheapest = mktler[0];
  const anaKat = ustKategori(u.ana_kategori);
  const emoji   = KAT_EMOJI[anaKat] || '📦';
  const ph = placeholderRenk(anaKat);
  const img = u.resim
    // TERS BOLU IKI KEZ (\\') olmak ZORUNDA. Sablon dizesinde \' yazilirsa JS
    // onu tek tirnaga cevirip HTML'e class='...' basiyor; oznitelik zaten tek
    // tirnakli oldugu icin JS dizesi orada KAPANIYOR ve tarayici
    // "SyntaxError: Unexpected identifier 'product'" atiyor. Sonuc: urun
    // gorseli yuklenemedigi her seferde yedek HIC cizilmiyordu, kullanici bos
    // beyaz kutu goruyordu. (Ayni satirin serit karti surumu \\' ile dogruydu;
    // olculdu: kategori ekraninda 4 kategori gezisinde 12 SyntaxError.)
    ? `<img class="product-card-img" src="${_guvenliUrl(u.resim)}" alt="" loading="lazy" onerror="this.outerHTML='<div class=\\'product-card-img-ph\\'>${ph.emoji}</div>'">`
    : `<div class="product-card-img-ph">${ph.emoji}</div>`;

  const inCart = sepet.some(s => s._id === u._id);
  let gosterilenFiyat = cheapest ? cheapest.fiyat : null;
  let gosterilenMarket = cheapest ? cheapest.market : '';
  const secililer = window.aktifMarketler || [];
  if (secililer.length > 0) {
    const uygun = mktler.filter(f => secililer.includes(f.market));
    if (uygun.length > 0) {
      gosterilenFiyat = uygun[0].fiyat;
      gosterilenMarket = uygun[0].market;
    } else {
      gosterilenFiyat = null;
      gosterilenMarket = '';
    }
  }
  const marketLbl = gosterilenMarket ? MARKET_NAMES[gosterilenMarket] || gosterilenMarket : '';
  return `<div class="product-card" tabindex="0" role="button" aria-label="${_kacir(u.ad)}" data-id="${_kacir(u._id)}" data-sid="${_kacir(u._sid || '')}" data-markets="${_kacir((u.market_fiyatlari||[]).map(f=>f.market).join(','))}" onclick="openDetay(this.dataset.id)" onkeydown="_kartTus(event, this.dataset.id)" style="cursor:pointer">
    ${favBtnHTML(u._sid)}
    ${img}
    <div class="product-card-body">
      <div class="product-name">${_kacir(u.ad)}</div>
      ${u.agirlik_hacim ? `<div class="product-unit">${_kacir(u.agirlik_hacim)}</div>` : ''}
      ${gosterilenFiyat != null
        ? `<div class="product-price">${tlHTML(gosterilenFiyat)}${marketLbl ? `<span class="product-market-lbl"> · ${_kacir(marketLbl)}</span>` : ''}</div>`
        : `<div class="kart-market-yok">Seçili markette yok</div>`}
      ${(() => {
        const bf = birimFiyatHesapla(u);
        if (!bf) return '';
        const enIyi = !!(_enIyiBirimSet && _enIyiBirimSet.has(u._id));
        // Renk tek gösterge olmasın: metin de ekleniyor.
        return `<div class="urun-birim-fiyat${enIyi ? ' en-iyi' : ''}">${birimFiyatYazi(bf)}${enIyi ? ' · en ucuz' : ''}</div>`;
      })()}
      ${(() => { const rz = tuzakRozetiHesapla(u); return rz ? tuzakRozetiHTML(rz, true) : ''; })()}
      ${urunRozetleriHTML(u, true)}
    </div>
    <button class="add-btn" data-pid="${_kacir(u._id)}" onclick="event.stopPropagation(); toggleSepet(this.dataset.pid)" style="${inCart ? 'background:#059669' : ''}">${inCart ? '✓' : '+'}</button>
  </div>`;
}

const TUZAK_CACHE_KEY = 'pazar_tuzaklar_v4';
const TUZAK_CACHE_TTL_MS = 1000 * 60 * 60 * 6;

// Tıklanabilir kartlar <div>. Klavye kullanıcısı ve ekran okuyucu için
// tabindex+role+bu tuş işleyicisi gerekiyor — 2026-08-11 denetimi: 51 öğe
// onclick taşıyor ama odaklanabilir değildi, uygulamanın ana işlevi (ürün
// detayına gitmek) klavyeye TAMAMEN kapalıydı.
// Space varsayılan olarak sayfayı kaydırır; preventDefault ile durduruluyor.
// Satır içi tetikleyiciler (profil menü satırları) için genel tuş işleyicisi.
// 2026-08-11 denetimi: 8 `.profil-item` onclick taşıyıp klavyeye kapalıydı.
// Modal ARKA PLANLARI (.mf-sheet-backdrop, .ms-sheet-backdrop,
// .auth-sheet__backdrop) BİLEREK odaklanabilir yapılmadı: arka planı tab
// sırasına sokmak ekran okuyucuda anlamsız bir durak yaratır. Klavye yolu
// Escape — modalKapat()'a bağlı dinleyici zaten var (app.js:735).
function _satirTus(e, fn) {
  if (!e) return;
  if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
    e.preventDefault();
    if (typeof fn === 'function') fn();
  }
}

function _kartTus(e, id) {
  if (!e) return;
  if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
    e.preventDefault();
    openDetay(id);
  }
}

function _stripKartHTML(u, rozet) {
  const ph = placeholderRenk(ustKategori(u.ana_kategori));
  const img = u.resim
    ? `<img class="strip-card-img" src="${_guvenliUrl(u.resim)}" alt="" loading="lazy" onerror="this.outerHTML='<div class=\\'strip-card-img-ph\\'>${ph.emoji}</div>'">`
    : `<div class="strip-card-img-ph">${ph.emoji}</div>`;
  // FIYAT kartin kahramani. Once buradaki tek kapidan gecer (enDusukFiyat,
  // market_fiyatlari uzerinden), o veremezse onceden hesaplanmis alana duser.
  // Kapsam olculdu: en_dusuk_fiyat katalogdaki 16.813 urunun %100'unde dolu.
  const fiyat = enDusukFiyat(u) ?? (u.en_dusuk_fiyat != null ? u.en_dusuk_fiyat : null);
  const bf = birimFiyatHesapla(u);
  // Birim fiyat, fiyatin AYNISI ise satiri yazma: 1 kg / 1 L urunlerde ayni
  // sayi kartta iki kez cikiyordu ("1.849,90 ₺" ve "kg basina 1.849,90 ₺").
  //
  // AMA tuzak rozeti varken ASLA gizleme. O rozet ("%100 pahali") marketler
  // arasi farki degil, AYNI URUNUN BASKA PAKET BOYUNA gore birim fiyat
  // farkini soyluyor (tuzakRozetiHesapla → digerPaketleriBul). Yani rozetin
  // dayanagi tam da bu satir; "L basina" etiketi olmadan kullanici neyin
  // %100 pahali oldugunu anlayamaz. Tekrar gorunmesi, cercevenin kaybolmasindan
  // iyidir.
  const bfTekrar = bf && fiyat != null && !rozet && Math.abs(bf.deger - fiyat) < 0.005;
  const bfYazi = bf && !bfTekrar ? birimFiyatYazi(bf) : '';
  const rozetHTML = rozet
    ? `<div class="strip-card-rozet ${rozet.tip}"><span class="lc-dot ${rozet.tip}"></span>%${rozet.yuzde} pahalı</div>`
    : '';
  // Hiyerarsi: gorsel → FIYAT → rozet → ad → birim fiyat.
  // Rozet yuvasi ISARETCI ile aciliyor; cagiranlarin ekledigi rozetler
  // (dusenler/supheli) _kartaRozetEkle ile TAM BURAYA giriyor. Oncesinde
  // kartin sonuna ekleniyorlardi ve yeni sirada en altta kalirlardi.
  return `<div class="strip-card" tabindex="0" role="button" aria-label="${_kacir(u.ad)}" data-id="${_kacir(u._id)}" onclick="openDetay(this.dataset.id)" onkeydown="_kartTus(event, this.dataset.id)">
    ${img}
    ${fiyat != null ? `<div class="strip-card-fiyat">${tl(fiyat)}</div>` : ''}
    ${rozetHTML}<!--ROZET-->
    <div class="strip-card-name">${_kacir(u.ad)}</div>
    ${bfYazi ? `<div class="strip-card-sub">${bfYazi}</div>` : ''}
  </div>`;
}

// ── VERİ TAZELİĞİ (ana sayfa) ─────────────────────────────────────────
// Kaynak anasayfa.json'un `veri_tarihi` alanı: verinin KENDİ en yeni gözlem
// tarihi (scripts/veri-tarihi.mjs). `uretim` BİLEREK kullanılmıyor — o build
// anıdır, her deploy'da tazelenir ve tazelik ölçemez; hub sayfalarında tam
// bu kusur Görev 8'de düzeltilmişti, ana sayfada aynı hataya düşmeyelim.
function veriTazelikCiz(veriTarihi) {
  const el = document.getElementById('veri-tazelik');
  if (!el) return;
  if (!veriTarihi) { el.hidden = true; return; }
  const p = String(veriTarihi).slice(0, 10).split('-').map(Number);
  if (p.length !== 3 || p.some(isNaN)) { el.hidden = true; return; }
  // Yerel Date kurucusu — toISOString().slice() YASAK (bu depoda 3 kez
  // gün kaydırdı, UTC+3'te gece yarısı penceresi bir gün geri gidiyordu).
  const veriGunu = new Date(p[0], p[1] - 1, p[2]);
  const s = new Date();
  const bugun = new Date(s.getFullYear(), s.getMonth(), s.getDate());
  const gun = Math.round((bugun - veriGunu) / 86400000);
  const tarihYazi = p[2] + ' ' + (ZAM_AYLAR[p[1] - 1] || '') + ' ' + p[0];
  const iso = String(veriTarihi).slice(0, 10);
  // Eşik 2 gün: veri işi günlük koşuyor ve tazelik kapısı da 2 günü sınır
  // sayıyor (scripts/veri_tazelik_kontrol.py). İki yer aynı sınırı görsün.
  const eski = gun >= 2;
  el.className = 'veri-tazelik' + (eski ? ' veri-tazelik--eski' : '');
  el.innerHTML = lcIcon('clock', 'lc-icon') +
    ` Fiyatlar <time datetime="${iso}">${tarihYazi}</time> verisi` +
    (eski ? ` · ${gun} gün eski` : '');
  el.hidden = false;
}

async function renderTuzaklarSeridi() {
  const wrap = document.getElementById('home-tuzaklar');
  const list = document.getElementById('home-tuzaklar-list');
  if (!wrap || !list) return;

  // ÖNCE önceden hesaplanmış havuz. Tarama build'de yapıldı (ölçüm: istemcide
  // 16.807 üründe 14.701 ms). Seçim bugünkü davranışın aynısı: karıştır + 6.
  const on = await anasayfaVeriGetir();
  if (on && on.tuzaklar && (on.tuzaklar.kirmizi || []).length) {
    const k = on.tuzaklar.kirmizi || [], s = on.tuzaklar.sari || [];
    let havuzOn = k.slice();
    if (havuzOn.length < 6) havuzOn = havuzOn.concat(s);
    _anasayfaKartlariKaydet(havuzOn.map(x => x.u));
    for (let i = havuzOn.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [havuzOn[i], havuzOn[j]] = [havuzOn[j], havuzOn[i]];
    }
    list.innerHTML = havuzOn.slice(0, 6).map(x => _stripKartHTML(x.u, x.r)).join('');
    wrap.style.display = '';
    return;
  }

  // GERİYE DÜŞÜŞ: dosya yok/bozuk — eskisi gibi istemcide tara.
  try {
    const raw = sessionStorage.getItem(TUZAK_CACHE_KEY);
    if (raw) {
      const obj = JSON.parse(raw);
      if (obj && Date.now() - obj.t < TUZAK_CACHE_TTL_MS && Array.isArray(obj.ids) && obj.ids.length) {
        const urunler = obj.ids.map(id => productMap[id]).filter(Boolean);
        if (urunler.length >= 3) {
          list.innerHTML = urunler.map(u => _stripKartHTML(u, tuzakRozetiHesapla(u))).join('');
          wrap.style.display = '';
          return;
        }
      }
    }
  } catch(e){ /* sessionStorage okunamadi/bozuk: onbellek atlanip serit bastan hesaplanacak, veri kaybi yok */ }

  await loadAllCats();

  const kirmizi = [];
  const sari = [];
  const ids = Object.keys(productMap);
  const CHUNK = 300;
  for (let i = 0; i < ids.length; i += CHUNK) {
    const son = Math.min(i + CHUNK, ids.length);
    for (let j = i; j < son; j++) {
      const u = productMap[ids[j]];
      if (!u || !u._id) continue;
      if (!u.resim) continue;
      const adL = String(u.ad || '').toLowerCase();
      if (/\b(bebelac|aptamil|hipp|nestle baby|organik|bio|gluten|konserve|hazır|superfresh|hellmann|heinz|bebek)\b/.test(adL)) continue;
      const r = tuzakRozetiHesapla(u);
      if (!r) continue;
      if (r.tip === 'kirmizi') kirmizi.push({u, r}); else sari.push({u, r});
    }
    if (kirmizi.length >= 30) break;
    await new Promise(res => setTimeout(res, 0));
  }

  let havuz = kirmizi.slice();
  if (havuz.length < 6) havuz = havuz.concat(sari);
  if (!havuz.length) { wrap.style.display = 'none'; return; }

  for (let i = havuz.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [havuz[i], havuz[j]] = [havuz[j], havuz[i]];
  }
  const secililer = havuz.slice(0, 6);

  list.innerHTML = secililer.map(x => _stripKartHTML(x.u, x.r)).join('');
  wrap.style.display = '';

  try {
    sessionStorage.setItem(TUZAK_CACHE_KEY, JSON.stringify({
      t: Date.now(),
      ids: secililer.map(x => x.u._id)
    }));
  } catch(e){ /* sessionStorage yazilamadi (kota/gizli mod): serit calisiyor, sadece bir dahaki acilista yeniden hesaplanir */ }
}

// rozetHTML → fiyatin hemen altindaki yuvaya (vurgu katmani)
// altHTML    → kartin EN ALTINA (nitelendirici satir: "yalnizca X'te satiliyor")
// Ikisi ayri, cunku yayginlik satiri urun adindan ONCE okunursa neyin
// nitelendirildigi belirsiz kaliyor.
function _kartaRozetEkle(html, rozetHTML, altHTML) {
  if (rozetHTML) {
    // Yuva isaretcisi varsa rozet TAM oraya girer. Isaretci yoksa eski
    // davranis korunur — kartin sonuna eklenir.
    if (html.includes('<!--ROZET-->')) html = html.replace('<!--ROZET-->', rozetHTML);
    else {
      const i = html.lastIndexOf('</div>');
      html = i === -1 ? html + rozetHTML : html.slice(0, i) + rozetHTML + html.slice(i);
    }
  }
  if (altHTML) {
    const i = html.lastIndexOf('</div>');
    html = i === -1 ? html + altHTML : html.slice(0, i) + altHTML + html.slice(i);
  }
  return html.replace('<!--ROZET-->', '');
}

// Şeritte gösterilen kart sayısı. RPC limiti bundan yüksek: şüpheliler
// elendikten sonra şerit yarım kalmasın (ölçüm: p_limit=6'da 6 üründen 3'ü
// şüpheliydi, p_limit=40'ta 8 temiz ürün kalıyor).
const DUSENLER_KART = 6;
const DUSENLER_RPC_LIMIT = 40;

async function renderDusenlerSeridi() {
  const wrap = document.getElementById('home-dusenler');
  const list = document.getElementById('home-dusenler-list');
  if (!wrap || !list) return;

  // ÖNCE önceden hesaplanmış liste (RPC + supheliDurum süzgeci build'de koştu).
  const on = await anasayfaVeriGetir();
  if (on && Array.isArray(on.dusenler) && on.dusenler.length) {
    _anasayfaKartlariKaydet(on.dusenler.map(x => x.u));
    const sec = on.dusenler.slice(0, DUSENLER_KART);
    list.innerHTML = sec.map(x => _kartaRozetEkle(
      _stripKartHTML(x.u, null),
      indirimRozetiHTML({ tip: x.dusus_yuzde >= 25 ? 'buyuk' : 'normal', yuzde: x.dusus_yuzde }, true)
    )).join('');
    wrap.style.display = '';
    return;
  }

  // GERİYE DÜŞÜŞ
  try {
    await supheliPuanlariYukle();
    await gecmisVeriGetir();
    const { data, error } = await window.supabaseClient.rpc('get_fiyat_dusenler', { p_limit: DUSENLER_RPC_LIMIT });
    if (error || !data || !data.length) { wrap.style.display = 'none'; return; }
    data.forEach(u => {
      if (!u._id) u._id = u.ad + '_' + (u.agirlik_hacim||'');
      productMap[u._id] = u;
    });
    // Düşenler bir fırsat şeridi; şüpheli ürün burada iki mesajı da zayıflatıyor.
    // Onlar "Bu indirimlere dikkat" bölümünde gösteriliyor.
    const temiz = data.filter(u => !supheliDurum(u)).slice(0, DUSENLER_KART);
    if (!temiz.length) { wrap.style.display = 'none'; return; }
    list.innerHTML = temiz.map(u => _kartaRozetEkle(
      _stripKartHTML(u, null),
      indirimRozetiHTML({ tip: u.dusus_yuzde >= 25 ? 'buyuk' : 'normal', yuzde: u.dusus_yuzde }, true)
    )).join('');
    wrap.style.display = '';
  } catch (e) { console.warn('[dusenler] serit cizilemedi, bolum gizlenecek:', e && e.message);
    wrap.style.display = 'none';
  }
}

// ── "Bu indirimlere dikkat" şeridi ────────────────────
const SUPHELI_SERIT_MAX = 12;   // en fazla kart
const SUPHELI_SERIT_MIN = 3;    // altındaysa bölüm hiç çizilmez (başlık dahil)
const SUPHELI_SERIT_SORGU_LIMIT = 60;

async function renderSupheliSeridi() {
  const wrap = document.getElementById('home-supheli');
  const list = document.getElementById('home-supheli-list');
  if (!wrap || !list) return;

  try {
    // ÖNCE önceden hesaplanmış liste (sorgu + supheliDurum + indirimRozeti
    // build'de koştu). Sıralama ve kesme burada, bugünküyle aynı kodla.
    const on = await anasayfaVeriGetir();
    if (on && Array.isArray(on.supheli) && on.supheli.length) {
      const ad = on.supheli.slice();
      ad.sort((a, b) => (b.puan - a.puan) || (b.yuzde - a.yuzde));
      const sec = ad.slice(0, SUPHELI_SERIT_MAX);
      if (sec.length < SUPHELI_SERIT_MIN) { wrap.style.display = 'none'; return; }
      _anasayfaKartlariKaydet(sec.map(x => x.u));
      list.innerHTML = sec.map(x => _kartaRozetEkle(
        _stripKartHTML(x.u, null), supheliRozetHTML()
      )).join('');
      wrap.style.display = '';
      return;
    }

    // GERİYE DÜŞÜŞ
    await supheliPuanlariYukle();
    await gecmisVeriGetir();
    const { data, error } = await window.supabaseClient
      .from('urunler')
      .select('*')
      .gte('indirim_supheli_puan', 4)
      .order('indirim_supheli_puan', { ascending: false })
      .limit(SUPHELI_SERIT_SORGU_LIMIT);
    if (error || !data) { wrap.style.display = 'none'; return; }

    const adaylar = [];
    data.forEach(u => {
      if (!u._id) u._id = u.ad + '_' + (u.agirlik_hacim || '');
      // İkinci süzgeç: ortada indirim iddiası yoksa bu bölümde işi yok.
      if (!supheliDurum(u)) return;
      const ir = indirimRozetiHesapla(u);
      adaylar.push({ u: u, puan: u.indirim_supheli_puan, yuzde: ir ? ir.yuzde : 0 });
    });
    adaylar.sort((a, b) => (b.puan - a.puan) || (b.yuzde - a.yuzde));
    const secilen = adaylar.slice(0, SUPHELI_SERIT_MAX);
    if (secilen.length < SUPHELI_SERIT_MIN) { wrap.style.display = 'none'; return; }

    secilen.forEach(x => { productMap[x.u._id] = x.u; });
    list.innerHTML = secilen.map(x => _kartaRozetEkle(
      _stripKartHTML(x.u, null), supheliRozetHTML()
    )).join('');
    wrap.style.display = '';
  } catch (e) { console.warn('[supheli] serit cizilemedi, bolum gizlenecek:', e && e.message);
    wrap.style.display = 'none';
  }
}

// ═══ "Bu ay en çok zamlananlar" ═════════════════════════
// ÖLÇÜT KEŞİFLE SEÇİLDİ. Denenen ve ELENEN iki yaklaşım:
//   A) seri[0] vs bugün — çapası tek güne bağlı. Ölçüm: A'nın ilk 10'unun
//      9'unda seri[0], ilk hafta medyanından %10+ sapıyordu.
//   B) ilk hafta ort. vs son hafta ort. — dayanıklı ama KAMPANYA BİTİŞİNİ
//      zam sanıyor. Palmolive gerçek geçmişi: 369,95 -> 189,95 -> 369,95 ->
//      129,95 -> 369,95. Ürünün normal fiyatı 369,95; 129,95 biten bir
//      kampanyaydı. B bunu "%185 zam" diye listeliyordu. B'nin ilk 10'unun
//      6'sı bu sınıftandı.
// SEÇİLEN: son 7 günün ortalaması, PENCERE ÖNCESİ TEPE ile karşılaştırılıyor.
// Fiyat eski bir seviyeye geri dönmüşse zam değildir; ancak daha önce hiç
// görülmemiş bir seviyeye çıkmışsa zamdır.
// Çapa tek kayda dayanmasın diye pencere öncesi en az 2 kayıt şartı var
// (ölçüm: kayıt>=1 ile 361 ürün, >=2 ile 159; >=2'de liste gözle de makul).
// MARKET BAZLI ölçüm. Önce tek bir "günlük en ucuz" serisi kullanılıyordu ve
// bu yapısal bir körlük yaratıyordu: bir market zamlanmayınca minimum onu
// izliyor, ürün eşiği hiç geçemiyordu. Sonuç, eşiği geçen 159 ürünün 153'ünün
// TEK markette satılan ürünler olması; süt/yağ/deterjan gibi her markette
// satılan temel ürünler listeye giremiyordu.
// Ölçüm (market bazlı seriye geçince): 295 ürün-market çifti, 278 ürün,
// birden çok markette satılan 6 -> 118, "biri zamlı diğeri aynı" 0 -> 91.
const ZAM_ESIK = 15;        // bu yüzdenin altındaki artış listeye girmez
const ZAM_MAX = 10;         // en fazla kaç ürün
const ZAM_MIN = 3;          // bundan azsa bölüm hiç çizilmez
const ZAM_MIN_KAYIT = 2;    // pencere öncesi en az kaç kayıt olmalı
const ZAM_MARKA_MAX = 2;    // aynı markadan en fazla kaç ürün
const ZAM_KAT_MAX = 3;      // aynı alt kategoriden en fazla kaç ürün

// Tek bir marketin KENDI 30 gunluk carry-forward serisi.
function zamMarketSerisi(sid, market) {
  if (!sid || !market || !_gecmisCache) return null;
  // _seriKur market kirilimini zaten kuruyor ve memoize ediyor — burada
  // yeniden kurmuyoruz. Dizi salt okunur kullanilmali.
  const seri = _seriKur(sid).marketSeri.get(market);
  if (!seri) return null;
  if (seri[0] == null) return null;     // pencerenin basinda fiyat bilinmiyorsa olcme
  return seri;
}

// ═══ SAF ZAM ÖLÇÜTÜ (PENCEREDEN BAĞIMSIZ) ═══════════════════════════════
// "Zam nedir" tanımı TEK YERDE: bu fonksiyon. zamMarketArtisi (30 günlük
// sabit pencere, bugüne çakılı) ve scripts/hub-uret.mjs (takvim ayı
// penceresi, node:vm üzerinden BU fonksiyonu çağırır) AYNI ölçütü kullanır.
// İKİ AYRI "zam nedir" TANIMI OLMASIN diye çekirdek buraya çıkarıldı —
// ikisi olsaydı ileride biri değişince sessizce çelişirlerdi.
//
// kayitlar: TEK market için [{t, f}] (t: 'yyyy-aa-gg', f: fiyat), sırasız olabilir.
// pencereBas / pencereSon: 'yyyy-aa-gg' — karşılaştırma aralığı [pencereBas, pencereSon].
// zirve  = pencereBas ÖNCESİ (t < pencereBas) kayıtların en yüksek fiyatı —
//          çapa pencere İÇİ veriye dayanmasın diye (bkz. zamOncekiZirve).
// sonDeger = pencereSon gününe KADAR taşınan (carry-forward) en son fiyat.
// Pencere öncesi kayıt sayısı ZAM_MIN_KAYIT'in altındaysa null (çapa kırılgan).
function zamOlcutu(kayitlar, pencereBas, pencereSon) {
  if (!Array.isArray(kayitlar) || !pencereBas || !pencereSon) return null;
  const gecerli = kayitlar.filter(k => k && k.t && k.f > 0);
  const eski = gecerli.filter(k => k.t < pencereBas);
  if (eski.length < ZAM_MIN_KAYIT) return null;
  const zirve = Math.max.apply(null, eski.map(k => k.f));
  if (!(zirve > 0)) return null;
  const icinde = gecerli.filter(k => k.t <= pencereSon).sort((a, b) => a.t < b.t ? -1 : (a.t > b.t ? 1 : 0));
  if (!icinde.length) return null;
  const sonDeger = icinde[icinde.length - 1].f;
  return { artis: ((sonDeger - zirve) / zirve) * 100, zirve: zirve, sonDeger: sonDeger, kayit: eski.length };
}

// Ölçüt TEK SERIDEKIYLE AYNI, yalnizca kapsam market: son 7 gun ortalamasi,
// o marketin pencere oncesi tepesiyle karsilastiriliyor. ZIRVE ve KAYIT
// SAYISI ESIGI zamOlcutu'ndan geliyor (paylasilan kisim); ORTALAMA mantigi
// (son 7 gunun ortalamasi) burada, degismeden kaliyor — davranis birebir ayni.
function zamMarketArtisi(sid, market) {
  const seri = zamMarketSerisi(sid, market);
  if (!seri) return null;
  const sonHafta = seri.slice(23, 30).reduce((a, b) => a + b, 0) / 7;
  const pencereBas = _zamGunISO(29);
  const pencereSon = _zamGunISO(0);
  const kayitlar = (_gecmisCache[sid] || []).filter(k => k && k.m === market);
  const olcut = zamOlcutu(kayitlar, pencereBas, pencereSon);
  if (!olcut) return null;
  return { artis: ((sonHafta - olcut.zirve) / olcut.zirve) * 100, zirve: olcut.zirve, sonHafta: sonHafta, kayit: olcut.kayit };
}

// ═══ SALINIM ELEMESİ ════════════════════════════════════
// Ölçütün ilkesi zaten şu: fiyat eski bir seviyeye geri dönmüşse zam değildir,
// HİÇ GÖRÜLMEMİŞ bir seviyeye çıktıysa zamdır. Zikzak bu ilkenin ihlal edilmiş
// hâli: seri pencerede bir seviyeye ayrılıp GERİ DÖNÜYORSA, çıkılan yer yeni
// bir seviye değil ikinci kez ziyaret edilen eski seviyedir. Basamak değil,
// salınımdır.
//
// Yeni sabit YOK. Pencere zaten ölçütün penceresi (30 gün), tolerans 0.
// TOLERANS 0 SEÇİLMEDİ, ÖLÇÜLDÜ: "ayrılıp geri dönen" 34.919 noktanın %59,4'ü
// TAM AYNI fiyata dönüyor, bir sonraki kutu %4,6 — 13x uçurum, ve bu uçurum
// "ayrıldı" eşiğine %0 ile %20 arasında tamamen duyarsız. gecmis_fiyatlar.json
// saf change-log (47.104 ardışık çiftin 0'ı aynı fiyat), fiyatların %84'ü
// ,95/,00/,90/,50 ile bitiyor. Yuvarlanacak kuruş gürültüsü yok.
//
// NEDEN: API her market zinciri için TEK temsilci mağaza döndürüyor ve temsilci
// zaman içinde değişiyor (2026-08-11 ölçümü, aynı ürün aynı anda: depots'suz
// sorgu carrefour-1012 "Acıbadem Hıper" 169,95 · depot filtreli sorgu
// carrefour-5027 "Karaköy Mını" 171,50). Mağaza değişimi geçmişimizde zam gibi
// görünüyordu: Lux Zigzag 27 -> 85,90 -> 28 -> 85,90.
//
// GELECEK — BU KURAL GEÇİCİ: scraper 2026-08-11'den beri market_fiyatlari
// içine depot_id/depot_ad yazıyor. 2-3 hafta veri birikince salınımın gerçekten
// mağaza değişimi olup olmadığı DOĞRUDAN doğrulanabilecek; o zaman bu yapısal
// kural, depot_id değişimini izleyen ölçüme dayalı kuralla değiştirilmeli.
// Ölçüm (2026-08-11): 17.668 market serisinin %22,7'si salınımlı — zincir
// bazında carrefour %28,6 · bim %24,7 · tarim_kredi %21,2 · migros %21,0 ·
// sok %16,8 · a101 %13,1. Eşiği geçen 295 üründen 64'ü (%21,7) eleniyor.
function zamSalinimVar(sid, market) {
  return _salinimVarSeri(zamMarketSerisi(sid, market));
}

function zamOncekiZirve(sid) {
  if (!sid || !_gecmisCache) return null;
  const kayitlar = _gecmisCache[sid];
  if (!Array.isArray(kayitlar) || !kayitlar.length) return null;
  const pencereBas = _yerelGunISO(29);          // yerel takvim günü, bkz. _yerelGunISO
  const eski = kayitlar.filter(k => k && k.t && k.f > 0 && k.t < pencereBas);
  if (eski.length < ZAM_MIN_KAYIT) return null;
  return { zirve: Math.max.apply(null, eski.map(k => k.f)), kayit: eski.length };
}

function _zamMarka(ad) {
  return String(ad || '').trim().split(/\s+/)[0].toLocaleLowerCase('tr');
}

// ═══ HAVUZ / SEÇİM AYRIMI ═══════════════════════════════
// zamHavuzu() ŞEHİRDEN BAĞIMSIZ: ürünün satıldığı HER market için artış
// hesaplanıp saklanır. zamSecHavuzdan() şehir filtresini, çeşitliliği ve
// ZAM_MAX'i uygular. zamAdaylari() ikisinin bileşimi — davranış değişmedi.
//
// NEDEN: havuz build zamanında bir kez hesaplanıp data/anasayfa.json'a
// yazılıyor; istemci 14 MB indirip 16.790 ürün taramak yerine hazır havuza
// AYNI seçim kodunu uyguluyor. Mantık tek yerde kaldığı için sapma olamaz.
// Şehir filtresi seçim aşamasında olduğundan önceden hesaplama onu bozmuyor.
function zamHavuzu() {
  if (!_gecmisCache) return [];
  const urunler = [];
  const gorulen = {};
  Object.values(catCache || {}).forEach(liste => (liste || []).forEach(u => {
    if (u && u._sid && !gorulen[u._sid]) { gorulen[u._sid] = 1; urunler.push(u); }
  }));
  const havuz = [];
  urunler.forEach(u => {
    // MEVSİM TUZAĞI: taze meyve/sebzede fiyat sezona göre doğal oynuyor.
    const kat = ustKategori(u.ana_kategori || '');
    if (kat === 'meyve' || kat === 'sebze') return;
    const gecerli = fiyatlariTemizle(u.market_fiyatlari).gecerli.filter(f => f.fiyat > 0);
    if (!gecerli.length) return;
    // Ürünün satıldığı HER market ölçülüyor (şehir filtresi YOK — seçimde).
    const marketArtis = {};
    let adayVar = false;
    gecerli.forEach(f => {
      if (!f.market || marketArtis[f.market] !== undefined) return;
      const r = zamMarketArtisi(u._sid, f.market);
      if (!r) { marketArtis[f.market] = null; return; }
      const kayit = { artis: r.artis, zirve: r.zirve, sonHafta: r.sonHafta, kayit: r.kayit };
      // Salınımlı seride "yeni seviye" iddiası kurulamaz — bkz. zamSalinimVar.
      // Kayıt SİLİNMİYOR, işaretleniyor: aday seçiminden düşer ama yaygınlık
      // sayımı (zamMarketDurumu) onu görmeye devam eder — canlı yolla aynı.
      if (zamSalinimVar(u._sid, f.market) !== null) kayit.salinim = true;
      else if (r.artis >= ZAM_ESIK) adayVar = true;
      marketArtis[f.market] = kayit;
    });
    if (!adayVar) return;
    havuz.push({ u: u, marketArtis: marketArtis });
  });
  return havuz;
}

function zamSecHavuzdan(havuz) {
  if (!Array.isArray(havuz) || !havuz.length) return [];
  const adaylar = [];
  havuz.forEach(x => {
    if (!x || !x.u || !x.marketArtis) return;
    const u = x.u;
    // Şehir seçiliyse o ilde bulunmayan zincirin ürünü listeye girmesin.
    let enIyi = null;
    Object.keys(x.marketArtis).forEach(m => {
      if (!marketVarMi(m)) return;
      const r = x.marketArtis[m];
      if (!r || r.salinim || r.artis < ZAM_ESIK) return;
      if (!enIyi || r.artis > enIyi.artis) {
        enIyi = { u: u, ad: u.ad, market: m, eski: r.zirve, yeni: r.sonHafta,
                  artis: r.artis, kayit: r.kayit };
      }
    });
    if (enIyi) adaylar.push(enIyi);
  });
  adaylar.sort((a, b) => b.artis - a.artis);

  // ÇEŞİTLİLİK: marka başına en fazla 2, alt kategori başına en fazla 3.
  // Kural yüzünden liste dolmazsa EŞİK DÜŞÜRÜLMEZ, daha az ürünle gösterilir.
  const secilen = [], markaSay = {}, katSay = {};
  for (const x of adaylar) {
    if (secilen.length >= ZAM_MAX) break;
    const mk = _zamMarka(x.ad);
    const ak = (x.u && x.u.ana_kategori) || '';
    if ((markaSay[mk] || 0) >= ZAM_MARKA_MAX) continue;
    if ((katSay[ak] || 0) >= ZAM_KAT_MAX) continue;
    markaSay[mk] = (markaSay[mk] || 0) + 1;
    katSay[ak] = (katSay[ak] || 0) + 1;
    secilen.push(x);
  }
  return secilen;
}

function zamAdaylari() {
  return zamSecHavuzdan(zamHavuzu());
}

function zamRozetHTML(artis, market) {
  const mk = market ? ` <span class="zam-rozet-mkt">${_kacir(MARKET_NAMES[market] || market)}</span>` : '';
  return `<span class="zam-rozet">+%${Math.round(artis)}${mk}</span>`;
}

// ═══ ZAMMIN GEREKÇESİ ═══════════════════════════════════
// KURAL: zammın SEBEBİ uydurulmaz. Döviz/maliyet/tedarik verisi elimizde yok;
// yalnızca kendi fiyat geçmişimizden çıkan olgular gösterilir.
const ZAM_KADEME_ESIK = 5;   // gün-güne bu %'nin üstü ayrı bir kademe sayılır
const ZAM_KAT_MIN = 5;       // kategoride bundan az ürün varsa bağlam gösterilmez
const ZAM_AYLAR = ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'];

// Tek kaynak _yerelGunISO — zam penceresi ile 30 günlük seri AYNI gün ızgarasını
// kullanmak zorunda, ayrışırlarsa gece yarısı ölçüm bozulur.
function _zamGunISO(n) {
  return _yerelGunISO(n);
}
function _zamTarihYazi(iso) {
  const p = String(iso).split('-');
  if (p.length !== 3) return iso;
  return Number(p[2]) + ' ' + (ZAM_AYLAR[Number(p[1]) - 1] || '');
}

// Turkce bulunma eki: unlu uyumu (a,ı,o,u -> da/ta · e,i,ö,ü -> de/te) +
// unsuz benzesmesi (sert unsuzden sonra ta/te). Rakamla bitenler okunusa gore.
const _ZAM_RAKAM_SON = { '0': 'sıfır', '1': 'bir', '2': 'iki', '3': 'üç', '4': 'dört',
                         '5': 'beş', '6': 'altı', '7': 'yedi', '8': 'sekiz', '9': 'dokuz' };
function _trBulunma(kelime) {
  let s = String(kelime || '').trim();
  if (!s) return s;
  const sonKarakter = s[s.length - 1];
  if (_ZAM_RAKAM_SON[sonKarakter]) s = _ZAM_RAKAM_SON[sonKarakter];
  const kucuk = s.toLocaleLowerCase('tr');
  const unluler = 'aeıioöuü';
  let sonUnlu = '';
  for (let i = kucuk.length - 1; i >= 0; i--) {
    if (unluler.indexOf(kucuk[i]) >= 0) { sonUnlu = kucuk[i]; break; }
  }
  const kalin = 'aıou'.indexOf(sonUnlu) >= 0;
  const sonHarf = kucuk[kucuk.length - 1];
  const sert = 'fstkçşhp'.indexOf(sonHarf) >= 0;
  return kelime + "'" + (sert ? (kalin ? 'ta' : 'te') : (kalin ? 'da' : 'de'));
}

// 30 günlük seride ardışık günler arasındaki sıçramalar. Kademeli zam
// (60 -> 90 -> 159) tek sıçrama gibi gösterilmesin diye hepsi ayrı döner.
// market verilirse O MARKETIN serisinden, verilmezse gunluk en ucuz seriden.
function zamKademeleri(sid, market) {
  const seri = market ? (zamMarketSerisi(sid, market) || []) : otuzGunlukSeri(sid);
  if (seri.length < 30) return [];
  // Kademe = O ANA KADARKI EN YUKSEK seviyeyi asan adim. Sadece "gun-gune
  // yukselis" saymak yanlisti: 1 gunluk cukurdan geri donusu ayri bir kademe
  // sanip zincirde ayni degeri iki kez yaziyordu (Garnier Pro-Retinol:
  // ... 242,50 -> 133,38 -> 242,50 ... "3 kademe" gorunuyordu, gercekte 1).
  const out = [];
  let tepe = seri[0];
  for (let i = 1; i < seri.length; i++) {
    const b = seri[i];
    if (!(b > 0)) continue;
    if (!(tepe > 0)) { tepe = b; continue; }
    const yuzde = ((b - tepe) / tepe) * 100;
    if (yuzde >= ZAM_KADEME_ESIK) {
      out.push({ tarih: _zamGunISO(29 - i), oncesi: tepe, sonrasi: b, yuzde: yuzde, gunOnce: 29 - i });
      tepe = b;
    }
  }
  return out;
}

// Ürün hangi marketlerde satılıyor, hangilerinde zamlandı.
// ÖLÇÜM NOTU: havuzdaki 159 ürünün 153'ü TEK markette satılıyor. Bunun sebebi
// yapısal: seri günlük EN UCUZ fiyatı izliyor, bir market zamlanmazsa min onu
// takip eder ve ürün zaten listeye girmez. Yani "A101'de zamlandı ama BİM'de
// aynı" vakası bu ölçütle nadiren görünür — gördüğümüzde doğru anlatıyoruz.
// marketArtis verilirse (önceden hesaplanmış havuzdan) geçmişe gerek kalmaz;
// verilmezse eskisi gibi _gecmisCache'ten hesaplanır. İkisi AYNI sonucu verir.
function zamMarketDurumu(u, marketArtis) {
  const bos = { satilan: [], zamli: [], sabit: [] };
  if (!u || !u._sid) return bos;
  if (!marketArtis) {
    if (!_gecmisCache || !Array.isArray(_gecmisCache[u._sid])) return bos;
  }
  const satilan = (fiyatlariTemizle(u.market_fiyatlari).gecerli || [])
    .map(f => f.market).filter(m => m && marketVarMi(m));
  const zamli = [], sabit = [];
  satilan.forEach(m => {
    const r = marketArtis ? marketArtis[m] : zamMarketArtisi(u._sid, m);
    if (!r) return;                 // olculemedi: ne zamli ne sabit say
    (r.artis >= ZAM_ESIK ? zamli : sabit).push(m);
  });
  return { satilan: satilan, zamli: zamli, sabit: sabit };
}

// Alt kategorinin 30 günlük ortalama değişimi. Yeterli ürün yoksa null.
function zamKategoriOrt(anaKategori) {
  if (!anaKategori) return null;
  const gorulen = {}, degisimler = [];
  Object.values(catCache || {}).forEach(liste => (liste || []).forEach(u => {
    if (!u || !u._sid || gorulen[u._sid]) return;
    if ((u.ana_kategori || '') !== anaKategori) return;
    gorulen[u._sid] = 1;
    const s = otuzGunlukSeri(u._sid);
    if (s.length < 30) return;
    const ilk = s.slice(0, 7).reduce((a, b) => a + b, 0) / 7;
    const son = s.slice(23, 30).reduce((a, b) => a + b, 0) / 7;
    if (!(ilk > 0)) return;
    degisimler.push(((son - ilk) / ilk) * 100);
  }));
  if (degisimler.length < ZAM_KAT_MIN) return null;
  return { ortalama: degisimler.reduce((a, b) => a + b, 0) / degisimler.length, adet: degisimler.length };
}

// KART: yer dar, yalnızca en güçlü tek bilgi.
function zamYayginlikHTML(u, marketArtis) {
  const d = zamMarketDurumu(u, marketArtis);
  if (!d.satilan.length) return '';
  const ad = m => MARKET_NAMES[m] || m;
  let metin;
  if (d.satilan.length === 1) {
    // Tek markette satılıyor: "başka markette aynı" DİYEMEYİZ, orada satılmıyor.
    metin = `Yalnızca ${_trBulunma(ad(d.satilan[0]))} satılıyor`;
  } else if (d.zamli.length && d.sabit.length) {
    // "aynı" iddiası YALNIZCA gerçekten ölçebildiğimiz marketler için.
    metin = `Sadece ${_trBulunma(d.zamli.map(ad).join(', '))} zamlandı · ${d.sabit.map(ad).join(', ')} aynı`;
  } else if (d.zamli.length && d.zamli.length === d.satilan.length) {
    metin = `${d.satilan.length} marketin ${d.zamli.length}'sinde zamlandı`;
  } else if (d.zamli.length) {
    // Diğer market(ler) ölçülemedi — "aynı" diyemeyiz, yalnızca olguyu söyle.
    metin = `${_trBulunma(d.zamli.map(ad).join(', '))} zamlandı`;
  } else {
    return '';
  }
  return `<div class="zam-yayginlik">${_kacir(metin)}</div>`;
}

// DETAY: tarih, kademeler, kategori bağlamı.
// Urunun EN COK zamlanan marketi. Hem detay blogu hem al/bekle bastirmasi
// bunu kullaniyor (HTML kurmadan karar verilebilsin diye ayri fonksiyon).
function zamDurumu(u) {
  if (!u || !u._sid || !_gecmisCache) return null;
  const gecerli = fiyatlariTemizle(u.market_fiyatlari).gecerli.filter(f => f.fiyat > 0);
  let enIyi = null;
  gecerli.forEach(f => {
    if (!marketVarMi(f.market)) return;
    const r = zamMarketArtisi(u._sid, f.market);
    if (!r || r.artis < ZAM_ESIK) return;
    if (!enIyi || r.artis > enIyi.artis) enIyi = { market: f.market, ...r };
  });
  return enIyi;
}

function zamDetayHTML(u) {
  const durum = zamDurumu(u);
  if (!durum) return '';
  const kad = zamKademeleri(u._sid, durum.market);
  if (!kad.length) return '';
  const son = kad[kad.length - 1];
  const satirlar = [];
  if (kad.length === 1) {
    satirlar.push(`${_trBulunma(_zamTarihYazi(son.tarih))} ${tl(son.oncesi)} → ${tl(son.sonrasi)}`);
  } else {
    const zincir = [kad[0].oncesi].concat(kad.map(k => k.sonrasi)).map(v => tl(v)).join(' → ');
    satirlar.push(`${kad.length} kademede zamlandı: ${zincir}`);
    satirlar.push(`son kademe ${_trBulunma(_zamTarihYazi(son.tarih))}`);
  }
  if (son.gunOnce > 0) satirlar.push(`${son.gunOnce} gündür bu fiyatta`);

  const kat = zamKategoriOrt(u.ana_kategori);
  let katSatir = '';
  if (kat) {
    const v = kat.ortalama;
    const mutlak = Math.abs(v).toFixed(1).replace('.', ',');
    // "%-0,4 degisim var" garip okunuyor; yon kelimeyle veriliyor.
    const yon = v >= 0.05 ? `ortalama %${mutlak} zam var`
              : (v <= -0.05 ? `fiyatlar ortalama %${mutlak} düştü` : 'fiyatlar ortalama değişmedi');
    katSatir = `<div class="zam-detay-kat">${_kacir(u.ana_kategori)} kategorisinde bu ay ${yon}</div>`;
  }
  return `<div class="zam-detay">
      <div class="zam-detay-baslik">${_kacir(MARKET_NAMES[durum.market] || durum.market)} bu zammı ne zaman yaptı</div>
      <div class="zam-detay-govde">${satirlar.join(' · ')}</div>
      ${katSatir}
    </div>`;
}

async function renderZamSeridi() {
  const wrap = document.getElementById('home-zam');
  const list = document.getElementById('home-zam-list');
  if (!wrap || !list) return;
  try {
    // ÖNCE önceden hesaplanmış havuz. Seçim (şehir filtresi + çeşitlilik +
    // ZAM_MAX) burada, istemcide, zamSecHavuzdan ile AYNI kodla yapılıyor —
    // bu yüzden şehir seçimi bozulmuyor.
    let secilen = null, havuzHarita = null;
    const on = await anasayfaVeriGetir();
    if (on && Array.isArray(on.zam) && on.zam.length) {
      havuzHarita = {};
      on.zam.forEach(x => { if (x && x.u && x.u._id) havuzHarita[x.u._id] = x.marketArtis; });
      _anasayfaKartlariKaydet(on.zam.map(x => x.u));
      secilen = zamSecHavuzdan(on.zam);
    } else {
      // GERİYE DÜŞÜŞ: dosya yok/bozuk — eskisi gibi istemcide hesapla.
      await loadAllCats();
      await gecmisVeriGetir();
      secilen = zamAdaylari();
    }
    if (secilen.length < ZAM_MIN) { wrap.style.display = 'none'; return; }
    window._zamListesi = secilen;
    secilen.forEach(x => { productMap[x.u._id] = x.u; });
    // Kartta yer dar: rozet + EN GUCLU TEK bilgi (yayginlik). Tarih/kademe/
    // kategori baglami urun detayinda.
    list.innerHTML = secilen.map(x => _kartaRozetEkle(
      _stripKartHTML(x.u, null),
      zamRozetHTML(x.artis, x.market),
      zamYayginlikHTML(x.u, havuzHarita ? havuzHarita[x.u._id] : null)
    )).join('');
    const btn = document.getElementById('home-zam-paylas');
    if (btn) btn.style.display = '';
    wrap.style.display = '';
  } catch (e) { console.warn('[zam] serit cizilemedi, bolum gizlenecek:', e && e.message);
    wrap.style.display = 'none';
  }
}

function paylasZamlar() {
  const liste = (window._zamListesi || []).slice(0, 5);
  if (!liste.length) return;
  const satirlar = liste.map(x => `${x.ad} +%${Math.round(x.artis)}`).join('\n');
  const metin = `Son 30 günde en çok zamlananlar:\n${satirlar}`;
  const url = 'https://pazarapp.net/';
  if (navigator.share) {
    navigator.share({ title: 'Pazar — Bu ay en çok zamlananlar', text: metin, url: url }).catch(() => { /* kullanici paylasim penceresini kapatti veya iptal etti: hata degil, sessiz gecmek DOGRU */ });
    return;
  }
  window.open('https://wa.me/?text=' + encodeURIComponent(metin + '\n' + url), '_blank');
}

const MEVSIM = {
  0:  ['portakal','mandalina','greyfurt','elma','lahana','kereviz','pırasa'],
  1:  ['portakal','mandalina','greyfurt','elma','lahana','pırasa','ıspanak'],
  2:  ['ıspanak','marul','dereotu','maydanoz','enginar','bakla'],
  3:  ['çilek','marul','enginar','bakla','taze soğan','dereotu'],
  4:  ['çilek','kiraz','erik','marul','salatalık','taze fasulye'],
  5:  ['kayısı','kiraz','çilek','karpuz','domates','salatalık','biber'],
  6:  ['karpuz','kavun','şeftali','üzüm','domates','biber','patlıcan'],
  7:  ['üzüm','şeftali','incir','karpuz','kavun','domates','biber'],
  8:  ['üzüm','incir','elma','armut','nar','ayva'],
  9:  ['nar','ayva','elma','armut','kestane','lahana','karnabahar'],
  10: ['nar','mandalina','elma','lahana','karnabahar','pırasa','ıspanak'],
  11: ['mandalina','portakal','elma','lahana','karnabahar','pırasa']
};

async function renderMevsimSeridi() {
  const wrap = document.getElementById('home-mevsim');
  const list = document.getElementById('home-mevsim-list');
  if (!wrap || !list) return;
  const ay = new Date().getMonth();
  const aranan = MEVSIM[ay] || [];
  if (!aranan.length) { wrap.style.display = 'none'; return; }

  await loadCat('meyve-sebze');
  const urunler = catCache['meyve-sebze'] || [];
  if (!urunler.length) { wrap.style.display = 'none'; return; }

  const norm = s => trNormalize(s || '');
  const bulundu = [];
  const eklenmis = new Set();
  for (const kelime of aranan) {
    const k = norm(kelime);
    for (const u of urunler) {
      if (eklenmis.has(u._id)) continue;
      const ag = String(u.agirlik_hacim || '').toLowerCase();
      if (!/\bkg\b|\badet\b|\bli\b|\blu\b|\bx\s*\d+\b/.test(ag)) continue;
      if (norm(u.ad).includes(k)) {
        bulundu.push(u);
        eklenmis.add(u._id);
        break;
      }
    }
  }

  if (!bulundu.length) { wrap.style.display = 'none'; return; }
  list.innerHTML = bulundu.slice(0, 8).map(u => _stripKartHTML(u, null)).join('');
  wrap.style.display = '';
}

// ── KATEGORİ GRİD ─────────────────────────────────────
function renderCatGrid() {
  document.getElementById('home-cats').innerHTML = KATEGORILER.map(k =>
    `<div class="cat-card" tabindex="0" role="button" aria-label="${k.label}" data-slug="${_kacir(k.slug)}" onclick="openCategory(this.dataset.slug)" onkeydown="_satirTus(event, () => openCategory(this.dataset.slug))">
      ${lcIcon(k.ikon, 'cat-ikon')}
      <div class="cat-card-name">${k.label}</div>
    </div>`
  ).join('');
}

// ── KATEGORİ EKRANI ───────────────────────────────────
async function openCategory(slug) {
  window._catAramaTermi = '';
  window._aktifAltKat = 'tumu';
  const ci = document.getElementById('catSearch'); if (ci) ci.value = '';
  const kat = KATEGORILER.find(k => k.slug === slug);
  document.getElementById('cat-title').textContent = kat.label;
  document.getElementById('productList').innerHTML = skeletonHTML();
  document.getElementById('countNum').textContent = '…';
  currentKategori = slug;
  currentSayfa = 1;
  toplamSayfa = 1;
  urunler = [];
  activeMarket = null;
  // Profildeki "Tercih Ettiğim Marketler" seçimi kategori filtresine VARSAYILAN gelir.
  window.aktifMarketler = tercihMarketleriOku();
  document.querySelectorAll('.filter-pill').forEach(p => {
    const m = p.dataset.market;
    p.classList.toggle('active', m === 'all' || m === 'tumu');
    p.classList.remove('disabled');
    p.style.pointerEvents = '';
    p.style.opacity = '';
  });
  showScreen('screen-cat');
  document.getElementById('screen-cat').scrollTop = 0;
  // Karttaki "gerçek indirim" / indirim rozetleri geçmişten hesaplanıyor
  // (cardHTML -> urunRozetleriHTML). Ana sayfa geçmişi indirmediği için
  // burada tetikleniyor; gelince liste bir kez yeniden çiziliyor.
  gecmisGerekli(() => {
    if (_ekranGorunur('screen-cat') && window._catUrunler) renderUrunler(window._catUrunler);
  });
  await loadKategoriSayfasi(slug, 1);
}

function renderUrunler(liste) {
  // Vurgu TÜM filtreli liste üzerinden hesaplanır (sayfa-1 değil), böylece
  // sonsuz scroll'da gelen kartlar da aynı kazananı biliyor.
  _enIyiBirimSet = enIyiBirimIdleri(liste);
  window._catUrunler = liste;
  currentSayfa = 1;
  toplamSayfa = Math.max(1, Math.ceil(liste.length / PAGE_SIZE));
  urunler = liste.slice(0, PAGE_SIZE);
  const list = document.getElementById('productList');
  if (!urunler.length) {
    const aramaVar = !!(window._catAramaTermi);
    const secililer = window.aktifMarketler || [];
    const marketAdi = secililer.map(m => MARKET_NAMES[m] || m).join(' veya ');
    if (aramaVar) {
      list.innerHTML = `<div class="empty-state">
        <div class="empty-icon">${lcIcon('search-x')}</div>
        <div class="empty-title">Sonuç bulunamadı</div>
        <div class="empty-desc">${marketAdi ? `${_kacir(marketAdi)} için bu aramaya uyan ürün yok` : 'Farklı kelimelerle dene'}</div>
      </div>`;
    } else if (marketAdi) {
      list.innerHTML = `<div class="empty-state">
        <div class="empty-icon">${lcIcon('filter-x')}</div>
        <div class="empty-title">Bu markette ürün yok</div>
        <div class="empty-desc">${_kacir(marketAdi)} için bu kategoride ürün bulunamadı</div>
        <button class="empty-cta" onclick="resetCatFilters()">Filtreleri sıfırla</button>
      </div>`;
    } else {
      list.innerHTML = `<div class="empty-state">
        <div class="empty-icon">${lcIcon('filter-x')}</div>
        <div class="empty-title">Bu filtreye uyan ürün yok</div>
        <div class="empty-desc">Filtreleri sıfırlayarak tekrar dene</div>
        <button class="empty-cta" onclick="resetCatFilters()">Filtreleri sıfırla</button>
      </div>`;
    }
  } else {
    list.innerHTML = urunler.map(cardHTML).join('');
  }
  document.getElementById('countNum').textContent = liste.length;
}

function setMarketFilter(market) {
  if (!window.aktifMarketler) window.aktifMarketler = [];
  if (market === 'all' || market === 'tumu') {
    window.aktifMarketler = [];
  } else {
    const i = window.aktifMarketler.indexOf(market);
    if (i >= 0) window.aktifMarketler.splice(i, 1);
    else window.aktifMarketler.push(market);
  }
  uygulaCatFiltre();
}

function renderAltKatBar() {
  const bar = document.getElementById('altKatBar');
  if (!bar) return;
  const tum = window.yuklenenUrunler || [];
  if (!tum.length) { bar.innerHTML = ''; return; }

  const sayilar = {};
  tum.forEach(u => {
    const k = (u.ana_kategori || '').trim();
    if (!k) return;
    sayilar[k] = (sayilar[k] || 0) + 1;
  });

  const liste = Object.entries(sayilar)
    .sort((a, b) => b[1] - a[1]);

  if (liste.length <= 1) { bar.innerHTML = ''; return; }

  const aktif = window._aktifAltKat || 'tumu';
  let html = '<button class="alt-kat-chip ' + (aktif === 'tumu' ? 'active' : '')
           + '" onclick="setAltKat(\'tumu\')">Tümü</button>';
  liste.forEach(([ad]) => {
    const adAttr = _kacir(ad);  // hem data-kat özniteliği hem metin; handler this.dataset.kat'tan okur
    html += '<button class="alt-kat-chip ' + (aktif === ad ? 'active' : '')
         + '" data-kat="' + adAttr + '" onclick="setAltKat(this.dataset.kat)">' + adAttr + '</button>';
  });
  bar.innerHTML = html;
}

function setAltKat(ad) {
  window._aktifAltKat = ad;
  renderAltKatBar();
  uygulaCatFiltre();
}

function catAra(q) {
  window._catAramaTermi = (q || '').trim().toLowerCase();
  uygulaCatFiltre();
}

function filterUrunler(secilenMarket) {
  if (secilenMarket !== undefined) window.aktifMarket = secilenMarket;
  uygulaCatFiltre();
}

const POP_KEYWORDS = {
  "meyve-sebze": ["domates","patates","soğan","muz","elma","salatalık","biber","limon","havuç","portakal","mandalina","patlıcan","kabak","marul","sarımsak","ıspanak","maydanoz","kıvırcık","çilek","armut"],
  "et": ["kıyma","tavuk göğüs","sucuk","salam","sosis","piliç but","kangal","ton balığı","hindi füme","jambon","pastırma","köfte","kuşbaşı","piliç kanat","piliç fileto","döner","kavurma","ciğer","balık"],
  "sut": ["süt","yumurta","peynir","yoğurt","beyaz peynir","kaşar","tereyağı","ayran","krema","labne","lor","kefir","süzme","kakaolu","ezine","mozarella","cheddar","çökelek","tulum","tatlandırılmış"],
  "gida": ["makarna","pirinç","un","şeker","ayçiçek yağı","tuz","bulgur","mercimek","nohut","salça","zeytinyağı","sirke","reçel","bal","fasulye","kuru fasulye","barbunya","yulaf","ketçap","mayonez"],
  "icecek": ["su","çay","kahve","cola","ayran","portakal suyu","maden suyu","limonata","soda","meyve suyu","ice tea","sprite","fanta","kakao","şalgam","gazoz","fuse tea","cappy","dimes","nescafe"],
  "temizlik": ["çamaşır deterjanı","bulaşık deterjanı","yumuşatıcı","tuvalet kağıdı","kağıt havlu","peçete","şampuan","sabun","diş macunu","çamaşır suyu","yüzey temizleyici","ped","duş jeli","deodorant","bebek bezi","ıslak mendil","cam temizleyici","saç kremi","sünger","çöp poşeti"],
  "atistirmalik": ["çikolata","bisküvi","cips","kek","kraker","gofret","sakız","şeker","kuruyemiş","fındık","fıstık","leblebi","badem","ceviz","kuru üzüm","kayısı","jelibon","draje","lokum","helva"],
  "dondurulmus": ["patates","pizza","nugget","balık","mısır","bezelye","sebze","milföy","mantı","börek","sufle","poğaça","ıspanak","gözleme","muhallebi","tatlı","ekmek","hamur","pilav","yufka"]
};
function popScore(ad, slug) {
  const kws = POP_KEYWORDS[slug] || [];
  const adLow = (ad || '').toLowerCase();
  for (let i = 0; i < kws.length; i++) {
    if (adLow.includes(kws[i])) return i;
  }
  return 999;
}
function setSiralama(deger) {
  window._catSiralama = deger;
  // Dropdown UI guncelle
  var btn = document.getElementById('catSiralamaBtn');
  var panel = document.getElementById('catSiralamaPanel');
  if (btn && panel) {
    var labelMap = {
      'populer': 'Popüler',
      'birimfiyat': 'Birim Fiyat (En Ucuz)',
      'fiyatasc': 'Fiyat (Düşük → Yüksek)',
      'fiyatdesc': 'Fiyat (Yüksek → Düşük)',
      'az': 'A-Z',
      'za': 'Z-A'
    };
    btn.querySelector('.siralama-label').innerHTML = 'Sıralama: <strong>' + (labelMap[deger] || deger) + '</strong>';
    panel.querySelectorAll('.siralama-option').forEach(function(o) {
      o.classList.toggle('active', o.dataset.value === deger);
    });
    panel.classList.remove('open');
    btn.setAttribute('aria-expanded', 'false');
  }
  uygulaCatFiltre();
}

function _acSiralamaPanel() {
  var panel = document.getElementById('catSiralamaPanel');
  var btn = document.getElementById('catSiralamaBtn');
  if (!panel || !btn) return;
  panel.classList.remove('panel-hidden');
  btn.setAttribute('aria-expanded', 'true');
  requestAnimationFrame(function() {
    requestAnimationFrame(function() {
      panel.classList.add('open');
    });
  });
}

function _kapatSiralamaPanel() {
  var panel = document.getElementById('catSiralamaPanel');
  var btn = document.getElementById('catSiralamaBtn');
  if (!panel || !btn) return;
  panel.classList.remove('open');
  btn.setAttribute('aria-expanded', 'false');
  setTimeout(function() { panel.classList.add('panel-hidden'); }, 160);
}

function _siralamaDisariTikla(e) {
  var wrap = document.getElementById('catSiralamaWrap');
  if (!wrap || !wrap.contains(e.target)) _kapatSiralamaPanel();
}

document.addEventListener('DOMContentLoaded', function() {
  var btn = document.getElementById('catSiralamaBtn');
  if (btn) btn.addEventListener('click', function(e) {
    e.stopPropagation();
    var panel = document.getElementById('catSiralamaPanel');
    if (panel.classList.contains('open')) _kapatSiralamaPanel();
    else _acSiralamaPanel();
  });

  document.addEventListener('click', _siralamaDisariTikla);
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') _kapatSiralamaPanel();
  });

  var panel = document.getElementById('catSiralamaPanel');
  if (panel) {
    panel.querySelectorAll('.siralama-option').forEach(function(opt) {
      opt.addEventListener('click', function(e) {
        e.stopPropagation();
        setSiralama(this.dataset.value);
        _kapatSiralamaPanel();
      });
    });
  }
});

function resetCatFilters() {
  if (typeof setMarketFilter === 'function') setMarketFilter('all');
  if (typeof setAltKat === 'function') setAltKat('tumu');
  const searchInput = document.querySelector('#screen-cat .cat-search-wrap input');
  if (searchInput) { searchInput.value = ''; if (typeof catAra === 'function') catAra(''); }
  uygulaCatFiltre();
}

function uygulaCatFiltre() {
  const aramaTermi = window._catAramaTermi || '';
  const tumUrunler = window.yuklenenUrunler || [];

  let filtreliler = tumUrunler;

  const altKat = window._aktifAltKat || 'tumu';
  if (altKat !== 'tumu') {
    filtreliler = filtreliler.filter(u => (u.ana_kategori || '').trim() === altKat);
  }

  if (aramaTermi.length > 0) {
    filtreliler = filtreliler.filter(u => {
      return (u.ad || '').toLowerCase().includes(aramaTermi);
    });
  }

  const secililer = window.aktifMarketler || [];
  // Seçili marketlerin hiçbirinde fiyatı olmayan ürün listeden çıkar (birleşim).
  if (secililer.length > 0) {
    filtreliler = filtreliler.filter(u =>
      (u.market_fiyatlari || []).some(f => secililer.includes(f.market) && f.fiyat != null));
  }
  document.querySelectorAll('[data-market]').forEach(pill => {
    const m = pill.dataset.market;
    if (m === 'all' || m === 'tumu') {
      pill.classList.toggle('active', secililer.length === 0);
      pill.classList.remove('disabled');
      pill.style.pointerEvents = '';
      pill.style.opacity = '';
      return;
    }
    const marketVar = tumUrunler.some(u => (u.market_fiyatlari||[]).some(f => f.market === m));
    pill.classList.toggle('disabled', !marketVar);
    pill.style.pointerEvents = marketVar ? '' : 'none';
    pill.style.opacity = marketVar ? '' : '0.35';
    pill.classList.toggle('active', secililer.includes(m));
  });

  const sir = window._catSiralama || 'populer';
  if (sir === 'birimfiyat') {
    filtreliler = filtreliler.slice().sort(function(a,b) {
      var ba = birimFiyatHesapla(a);
      var bb = birimFiyatHesapla(b);
      var birimOncelik = {kg:1, L:1, adet:2};
      var ga = ba ? (birimOncelik[ba.birim] || 3) : 4;
      var gb = bb ? (birimOncelik[bb.birim] || 3) : 4;
      if (ga !== gb) return ga - gb;
      var va = ba ? ba.deger : Infinity;
      var vb = bb ? bb.deger : Infinity;
      if (va === Infinity && vb === Infinity) return 0;
      if (va === Infinity) return 1;
      if (vb === Infinity) return -1;
      return va - vb;
    });
  } else if (sir === 'fiyatasc') {
    filtreliler = filtreliler.slice().sort(function(a,b) { return (a.en_dusuk_fiyat ?? Infinity) - (b.en_dusuk_fiyat ?? Infinity); });
  } else if (sir === 'fiyatdesc') {
    filtreliler = filtreliler.slice().sort(function(a,b) { return (b.en_dusuk_fiyat ?? -Infinity) - (a.en_dusuk_fiyat ?? -Infinity); });
  } else if (sir === 'az') {
    filtreliler = filtreliler.slice().sort(function(a,b) { return (a.ad||'').localeCompare(b.ad||'','tr'); });
  } else if (sir === 'za') {
    filtreliler = filtreliler.slice().sort(function(a,b) { return (b.ad||'').localeCompare(a.ad||'','tr'); });
  } else {
    filtreliler = filtreliler.slice().sort(function(a,b) {
      var sa = popScore(a.ad, currentKategori);
      var sb = popScore(b.ad, currentKategori);
      if (sa !== sb) return sa - sb;
      var ma = (a.market_fiyatlari || []).length;
      var mb = (b.market_fiyatlari || []).length;
      if (ma !== mb) return mb - ma;
      return (a.en_dusuk_fiyat ?? 99999) - (b.en_dusuk_fiyat ?? 99999);
    });
  }

  renderUrunler(filtreliler);
}

async function loadKategoriSayfasi(slug, sayfa) {
  if (yukleniyor) return;
  yukleniyor = true;
  try {
    if (!catCache[slug]) await loadCat(slug);
    window.yuklenenUrunler = catCache[slug] || [];
    if (sayfa === 1) renderAltKatBar();
    uygulaCatFiltre();
  } catch(e) {
    console.error('Veri yükleme hatası:', e);
  } finally {
    yukleniyor = false;
  }
}

// ── SONSUZ SCROLL ─────────────────────────────────────
const scrollObserver = new IntersectionObserver(entries => {
  if (entries[0].isIntersecting && !yukleniyor && currentSayfa < toplamSayfa) {
    yukleniyor = true;
    currentSayfa++;
    const liste = window._catUrunler || [];
    const start = (currentSayfa - 1) * PAGE_SIZE;
    const pageItems = liste.slice(start, start + PAGE_SIZE);
    urunler = urunler.concat(pageItems);
    document.getElementById('productList')
      .insertAdjacentHTML('beforeend', pageItems.map(cardHTML).join(''));
    yukleniyor = false;
  }
}, { rootMargin: '300px' });
const _sentinel = document.getElementById('scroll-sentinel');
if (_sentinel) scrollObserver.observe(_sentinel);

// ── ARAMA ─────────────────────────────────────────────
let _searchTimer = null;
let _allLoaded = false;

async function loadAllCats() {
  if (_allLoaded) return;
  await Promise.all(KATEGORILER.map(k => loadCat(k.slug)));
  _allLoaded = true;
}

function trNormalize(s) {
  return String(s || '')
    .replace(/İ/g, 'i').replace(/I/g, 'i').replace(/ı/g, 'i')
    .replace(/Ş/g, 's').replace(/ş/g, 's')
    .replace(/Ğ/g, 'g').replace(/ğ/g, 'g')
    .replace(/Ü/g, 'u').replace(/ü/g, 'u')
    .replace(/Ö/g, 'o').replace(/ö/g, 'o')
    .replace(/Ç/g, 'c').replace(/ç/g, 'c')
    .toLowerCase().trim();
}

const KART_GRUP = {
  'meyve': 'meyve', 'sebze': 'sebze',
  'et': 'et', 'tavuk': 'et', 'et tavuk': 'et', 'sarkuteri': 'et', 'balik': 'et', 'kirmizi et': 'et', 'beyaz et': 'et', 'deniz urunleri': 'et',
  'sut': 'sut', 'kahvalti': 'sut', 'sut kahvalti': 'sut',
  'temel gida': 'gida', 'gida': 'gida', 'bakliyat': 'gida', 'makarna': 'gida',
  'icecek': 'icecek', 'su': 'icecek', 'cay': 'icecek', 'kahve': 'icecek', 'kola': 'icecek',
  'temizlik': 'temizlik', 'deterjan': 'temizlik',
  'atistirmalik': 'atistirmalik', 'cips': 'atistirmalik', 'cikolata': 'atistirmalik', 'sekerleme': 'atistirmalik',
  'dondurulmus': 'dondurulmus'
};

// ── MARKETFİYATI CANLI ARAMA (POC v1) ──────────────────
let _mfLastQuery = '';
let _mfLastData = null;

function marketfiyatiAra(keywords) {
  return fetch('https://api.marketfiyati.org.tr/api/v2/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ keywords, pages: 0, size: 20 })
  })
  .then(r => r.ok ? r.json() : null)
  .catch(e => { console.warn('[arama] marketfiyati aramasi basarisiz, sonuc bos donecek:', e && e.message); return null; });
}

function mfGorsel(item) { return ''; }

function mfPlaceholderEmoji(item) { return ''; }

function mfMarketInitial(item) {
  const firstDepot = item.productDepotInfoList && item.productDepotInfoList[0];
  const name = firstDepot ? (firstDepot.marketAdi || '') : '';
  return name.charAt(0).toUpperCase() || '?';
}

async function mfUrunGorseliBul(id, title) {
  if (!window.__mfImgCache) window.__mfImgCache = {};
  if (id in window.__mfImgCache) return window.__mfImgCache[id];
  try {
    const r = await fetch('https://api.marketfiyati.org.tr/api/v2/searchSimilarProduct', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, keywords: title, pages: 0, size: 10 })
    });
    if (!r.ok) { window.__mfImgCache[id] = null; return null; }
    const j = await r.json();
    const found = j.content?.find(it => it.imageUrl)?.imageUrl || null;
    window.__mfImgCache[id] = found;
    return found;
  } catch (e) { console.warn('[gorsel] marketfiyati gorseli alinamadi, placeholder cizilecek:', e && e.message);
    window.__mfImgCache[id] = null;
    return null;
  }
}

function mfTl(n) {
  if (typeof n !== 'number' || !isFinite(n)) return '';
  return n.toFixed(2).replace('.', ',') + ' ₺';
}

async function marketfiyatiCanliAra() {
  const q = _mfLastQuery;
  if (!q) return;
  const btn = document.getElementById('mf-ara-btn');
  const out = document.getElementById('mf-results');
  btn.disabled = true;
  btn.innerText = 'Aranıyor...';
  out.innerHTML = `<div class="mf-results-title">marketfiyati.org.tr'den canlı sonuçlar</div><div class="mf-results-empty">Aranıyor: <b>${_kacir(q)}</b></div>`;
  try {
    const data = await marketfiyatiAra(q);
    if (!data) {
      out.innerHTML = `<div class="mf-results-title">marketfiyati.org.tr'den canlı sonuçlar</div><div class="mf-results-empty">❌ Şu an ulaşılamıyor. Tekrar deneyin.</div>`;
      return;
    }
    if (!Array.isArray(data.content) || data.content.length === 0) {
      out.innerHTML = `<div class="mf-results-title">marketfiyati.org.tr'den canlı sonuçlar</div><div class="mf-results-empty">Canlı aramada sonuç bulunamadı.</div>`;
      return;
    }
    _mfLastData = data.content;
    mfRenderResults(data.content);
  } finally {
    btn.disabled = false;
    btn.innerHTML = lcIcon('search') + ' marketfiyati.org.tr\'de ara';
  }
}

function mfRenderResults(list) {
  const out = document.getElementById('mf-results');
  if (!list.length) {
    out.innerHTML = `<div class="mf-results-title">marketfiyati.org.tr'den canlı sonuçlar</div><div class="mf-results-empty">Canlı aramada sonuç bulunamadı.</div>`;
    return;
  }
  const rows = list.map((it, idx) => {
    const depots = it.productDepotInfoList || [];
    const marketCount = depots.length;
    const prices = depots.map(d => Number(d.price)).filter(n => isFinite(n));
    const minPrice = prices.length ? Math.min(...prices) : NaN;
    const bestDepot = (isFinite(minPrice) && depots.find(d => Number(d.price) === minPrice)) || depots[0] || null;
    const marketAdi = bestDepot ? (bestDepot.marketAdi || '') : '';
    const depotName = bestDepot ? (bestDepot.depotName || '') : '';
    const unitPrice = bestDepot ? (bestDepot.unitPrice || '') : '';
    const price = bestDepot ? Number(bestDepot.price) : NaN;
    const title = it.title || it.name || '—';
    const meta = [it.refinedVolumeOrWeight, it.brand].filter(Boolean).join(' · ');
    const initial = mfMarketInitial(it);
    return `<div class="mf-card" tabindex="0" role="button" onclick="mfSheetAc(${idx})" onkeydown="_satirTus(event, function(){mfSheetAc(${idx})})">
      <div class="mf-market-avatar">${_kacir(initial)}</div>
      <div class="mf-card-info">
        <div class="mf-card-title">${_kacir(title)}</div>
        <div class="mf-card-meta">${_kacir(meta || (depotName || ''))}</div>
      </div>
      <div class="mf-card-right">
        <div class="mf-card-price">${isFinite(price) ? mfTl(price) : ''}</div>
        <div class="mf-card-market">${_kacir(marketAdi)}</div>
        <div class="mf-card-markets">${marketCount} markette</div>
      </div>
    </div>`;
  }).join('');
  out.innerHTML = `<div class="mf-results-title">marketfiyati.org.tr'den canlı sonuçlar</div>${rows}<div class="mf-note">Veri marketfiyati.org.tr'den · canlı, kaydedilmez</div>`;
}

function mfSheetAc(idx) {
  const it = (_mfLastData || [])[idx];
  if (!it) return;
  const title = it.title || it.name || 'Ürün';
  const depots = it.productDepotInfoList || [];
  const prices = depots.map(d => Number(d.price)).filter(n => isFinite(n));
  const minPrice = prices.length ? Math.min(...prices) : NaN;
  document.getElementById('mfSheetTitle').textContent = title;
  document.getElementById('mfSheetSub').textContent = depots.length + ' markette listelendi';
  const imgContainer = document.getElementById('mf-sheet-img');
  const initial = mfMarketInitial(it);
  if (imgContainer) {
    imgContainer.className = 'mf-sheet-img';
    imgContainer.innerHTML = '';
    if (it.id) {
      mfUrunGorseliBul(it.id, title).then(url => {
        if (url) {
          imgContainer.innerHTML = `<img src="${_guvenliUrl(url)}" alt="" loading="lazy" data-initial="${_kacir(initial || '?')}" onerror="this.parentNode.classList.add('fallback'); this.parentNode.textContent=this.dataset.initial">`;
        } else {
          imgContainer.classList.add('fallback');
          imgContainer.textContent = initial || '?';
        }
      });
    }
  }
  const html = depots.map(d => {
    const p = Number(d.price);
    const isBest = isFinite(p) && isFinite(minPrice) && p === minPrice;
    const marketAdi = d.marketAdi || '';
    const depotName = d.depotName || '';
    const unitPrice = d.unitPrice || '';
    return `<div class="mf-depot-row ${isBest ? 'best' : ''}">
      <div class="mf-depot-info">
        <div class="mf-depot-market">${_kacir(marketAdi)}</div>
        <div class="mf-depot-meta">${_kacir(depotName)}</div>
      </div>
      <div class="mf-depot-right">
        <div class="mf-depot-price">${isFinite(p) ? mfTl(p) : ''}</div>
        <div class="mf-depot-unit">${unitPrice}</div>
      </div>
    </div>`;
  }).join('');
  document.getElementById('mfDepotList').innerHTML = html || '<div class="mf-results-empty">Fiyat bilgisi yok.</div>';
  document.getElementById('mfSheetBackdrop').classList.add('open');
  document.getElementById('mfSheet').classList.add('open');
  document.getElementById('mfSheet').setAttribute('aria-hidden', 'false');
}

function mfSheetKapat() {
  document.getElementById('mfSheetBackdrop').classList.remove('open');
  document.getElementById('mfSheet').classList.remove('open');
  document.getElementById('mfSheet').setAttribute('aria-hidden', 'true');
}

document.getElementById('search').addEventListener('input', function() {
  const q = this.value.trim();
  // Arama aktifken ana sayfanın arama-dışı bölümlerini (şeritler, kategori
  // grid, mevsim, hal, tazelik) gizle: sonuç kutunun HEMEN altında görünür,
  // kullanıcı elle kaydırmak zorunda kalmaz. Gizleme CSS ile (#screen-home
  // .arama-aktif) — scrollIntoView YOK: her tuş vuruşunda ekran zıplamasın.
  // Boşalınca sınıf kalkar, gizlenen bölümler kendi (JS/inline) durumuna döner.
  document.getElementById('screen-home').classList.toggle('arama-aktif', !!q);
  document.getElementById('home-search').style.display = q ? 'block' : 'none';
  if (!q) {
    document.getElementById('mf-ara-btn').style.display = 'none';
    document.getElementById('mf-results').innerHTML = '';
    return;
  }
  clearTimeout(_searchTimer);
  _searchTimer = setTimeout(async () => {
    document.getElementById('searchList').innerHTML = skeletonHTML(3);
    await loadAllCats();
    const qn = trNormalize(q);
    if (!qn) { results = []; }
    const allProducts = KATEGORILER.flatMap(k => catCache[k.slug] || []);

    let hedefGrup = KART_GRUP[qn] || null;
    let katAdiEslesme = null;

    if (!hedefGrup) {
      const eslesenKat = allProducts.some(u => {
        const ana = trNormalize(u.ana_kategori);
        return ana.split(/\s+/).some(w => w.startsWith(qn)) || ana.startsWith(qn);
      });
      if (eslesenKat) katAdiEslesme = qn;
    }

    let results;
    if (hedefGrup) {
      results = allProducts.filter(u => ustKategori(u.ana_kategori) === hedefGrup);
    } else if (katAdiEslesme) {
      results = allProducts.filter(u => {
        const ana = trNormalize(u.ana_kategori);
        return ana.split(/\s+/).some(w => w.startsWith(qn)) || ana.startsWith(qn);
      });
    } else {
      results = allProducts.filter(u => trNormalize(u.ad).includes(qn));
    }
    results = results.slice(0, 96);
    document.getElementById('searchCount').textContent = results.length;
    document.getElementById('searchList').innerHTML = results.length
      ? results.map(cardHTML).join('')
      : `<div class="state-msg"><span class="icon">🔍</span>Sonuç bulunamadı.</div>`;
    results.forEach(u => { if (!urunler.find(x => x._id === u._id)) urunler.push(u); });
    _mfLastQuery = q;
    document.getElementById('mf-ara-btn').style.display = '';
    document.getElementById('mf-ara-btn').disabled = false;
    document.getElementById('mf-ara-btn').innerHTML = lcIcon('search') + ' marketfiyati.org.tr\'de ara';
    document.getElementById('mf-results').innerHTML = '';
  }, 350);
});

// ── SEPET ─────────────────────────────────────────────
function saveSepet() {
  localStorage.setItem('pazar_sepet', JSON.stringify(sepet));
  const badge = document.getElementById('sepetCount');
  if (badge) {
    const n = sepet.length;
    badge.textContent = n > 99 ? '99+' : n;
    badge.classList.toggle('hidden', n === 0);
  }
}

function toastGoster(mesaj) {
  const t = document.createElement('div');
  t.className = 'toast-mesaj';
  t.textContent = mesaj;
  document.body.appendChild(t);
  setTimeout(() => t.classList.add('toast-show'), 10);
  setTimeout(() => {
    t.classList.remove('toast-show');
    setTimeout(() => t.remove(), 300);
  }, 1200);
  if (navigator.vibrate) navigator.vibrate(20);
}

function toggleSepet(id) {
  if (sepet.find(s => s._id === id)) {
    sepet = sepet.filter(s => s._id !== id);
    saveSepet();
    setEkleBtns(id, false);
  } else {
    const u = productMap[id] || urunler.find(u => u._id === id);
    if (!u) return;
    sepet.push({
      _id: u._id, ad: u.ad, resim: u.resim,
      agirlik_hacim: u.agirlik_hacim, ana_kategori: u.ana_kategori,
      market_fiyatlari: u.market_fiyatlari
    });
    saveSepet();
    toastGoster('Listene eklendi');
    if (sepet.length === 1 && typeof window.installBannerGosterDene === 'function') window.installBannerGosterDene();
    document.querySelectorAll(`.add-btn[data-pid="${id}"]`).forEach(function(btn) {
      btn.classList.add('pressing');
      btn.textContent = '✓';
      btn.style.background = '#059669';
      setTimeout(function() {
        btn.classList.remove('pressing');
        btn.classList.add('added-flash');
        setTimeout(function() {
          btn.textContent = '+';
          setTimeout(function() {
            btn.classList.remove('added-flash');
          }, 600);
        }, 200);
      }, 350);
    });
  }
}

function setEkleBtns(id, inCart) {
  document.querySelectorAll(`.add-btn[data-pid="${id}"]`).forEach(btn => {
    btn.textContent = inCart ? '✓' : '+';
    btn.style.background = inCart ? '#059669' : '';
  });
}

function removeFromSepet(id) {
  sepet = sepet.filter(s => s._id !== id);
  saveSepet();
  setEkleBtns(id, false);
  renderSepet();
}

function renderSepet() {
  document.getElementById('sepetCount').textContent = sepet.length;
  renderSablonBar();
  const el = document.getElementById('sepetContent');
  if (!sepet.length) {
    el.innerHTML = `<div class="empty-state">
  <div class="empty-icon">${lcIcon('shopping-cart')}</div>
  <div class="empty-title">Listen henüz boş</div>
  <div class="empty-desc">Ürün ekleyerek market karşılaştırması yapabilirsin</div>
</div>`;
    return;
  }
  const items = sepet.map(u => {
    const emoji = KAT_EMOJI[ustKategori(u.ana_kategori)] || '📦';
    const img   = u.resim
      ? `<img src="${_guvenliUrl(u.resim)}" alt="" loading="lazy" onerror="this.onerror=null;this.parentElement.innerHTML='<div style=\'width:100%;height:120px;background:#f8f8f8;display:flex;align-items:center;justify-content:center;font-size:3rem\'>${emoji}</div>'">`
      : emoji;
    const mktF = (u.market_fiyatlari || []).filter(f => f.fiyat != null).sort((a,b) => a.fiyat - b.fiyat)[0];
    const fiyatStr = mktF
      ? `<div style="text-align:right;color:var(--primary);font-size:.82rem;font-weight:700;flex-shrink:0;margin-right:6px;line-height:1.4">
           ${tlHTML(mktF.fiyat)}<br><span style="font-size:.65rem;font-weight:500">${_kacir(MARKET_NAMES[mktF.market]||mktF.market||'?')}</span>
         </div>` : '';
    return `<div class="cart-item" tabindex="0" role="button" aria-label="${_kacir(u.ad)}" data-id="${_kacir(u._id)}" onclick="openDetay(this.dataset.id)" onkeydown="_kartTus(event, this.dataset.id)" style="cursor:pointer">
      <div class="cart-item-img">${img}</div>
      <div class="cart-item-info">
        <div class="cart-item-name">${_kacir(u.ad)}</div>
        ${u.agirlik_hacim ? `<div class="cart-item-sub">${_kacir(u.agirlik_hacim)}</div>` : ''}
      </div>
      ${fiyatStr}
      <button class="cart-del" data-id="${_kacir(u._id)}" onclick="event.stopPropagation(); removeFromSepet(this.dataset.id)">
        <svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg>
      </button>
    </div>`;
  }).join('');

  // Her ürünün en ucuz market fiyatını topla
  let toplam = 0;
  const seciliMarketler = new Set();
  sepet.forEach(function(u) {
    const mktF = (u.market_fiyatlari || []).filter(function(f){return f.fiyat != null;}).sort(function(a,b){return a.fiyat - b.fiyat;})[0];
    if (mktF) { toplam += mktF.fiyat; seciliMarketler.add(mktF.market); }
  });
  const marketSayisi = seciliMarketler.size;

  // listem-ozet: mobilde stilsiz düz blok (akış birebir aynı),
  // masaüstünde sağdaki yapışkan özet sütununun taşıyıcısı.
  el.innerHTML = `<div class="cart-list">${items}</div>
    <div class="listem-ozet">
    <div class="listem-toplam">
      <div class="listem-toplam-ust">
        <span class="listem-toplam-etiket">${marketSayisi} farklı markete giderek</span>
        <span style="color:var(--price-color)">${tlHTML(toplam)}</span>
      </div>
      <div class="listem-toplam-aciklama">Her ürünü en ucuz olduğu marketten alırsan — tek markette ödeyeceğin tutar aşağıda</div>
    </div>
    ${sepetMarketOzetiHTML()}
    <button class="btn-compare" onclick="karsilastir()">Marketleri Karşılaştır →</button>
    <button class="btn-compare" onclick="paylasSepet()" style="background:#25D366;margin-top:4px;display:flex;align-items:center;justify-content:center;gap:6px"><svg class="lc-share" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="16" height="16"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg> Listeyi Paylaş</button>
    <div id="compareOut"></div>
    </div>`;
}

function paylasSepet() {
  if (!sepet.length) return;
  const satirlar = sepet.map(u => {
    const mktF = (u.market_fiyatlari || []).filter(f => f.fiyat != null).sort((a,b) => a.fiyat - b.fiyat)[0];
    if (mktF) {
      const mktAd = MARKET_NAMES[mktF.market] || mktF.market || '';
      return `• ${u.ad} — ${tl(mktF.fiyat)} · ${mktAd}`;
    }
    return `• ${u.ad}`;
  });
  const toplam = sepet.reduce((s, u) => {
    const mktF = fiyatlariTemizle(u.market_fiyatlari).gecerli.slice().sort((a,b) => a.fiyat - b.fiyat)[0];
    return s + (mktF ? mktF.fiyat : 0);
  }, 0);
  const enPahaliToplam = sepet.reduce((s, u) => {
    const fiyatlar = fiyatlariTemizle(u.market_fiyatlari).gecerli.map(f => f.fiyat);
    return s + (fiyatlar.length ? Math.max.apply(null, fiyatlar) : 0);
  }, 0);
  const tasarruf = enPahaliToplam - toplam;

  let ozet;
  if (tasarruf > 1) {
    ozet = `~En pahalısıyla: ${tl(enPahaliToplam)}~\n*Pazar'la: ${tl(toplam)}* → ${tl(tasarruf)} tasarruf 💰`;
  } else {
    ozet = `*Toplam: ${tl(toplam)}*`;
  }

  const metin = `🛒 *Pazar Listem* — ${sepet.length} ürün\n\n${satirlar.join('\n')}\n\n${ozet}\n\n📲 Sen de dene → ${location.origin}${location.pathname}`;

  if (navigator.share) {
    navigator.share({ title: 'Pazar Listem', text: metin }).catch(() => { /* kullanici paylasim penceresini kapatti veya iptal etti: hata degil, sessiz gecmek DOGRU */ });
  } else {
    const url = 'https://wa.me/?text=' + encodeURIComponent(metin);
    window.open(url, '_blank');
  }
}

// ── KARŞILAŞTIRMA ─────────────────────────────────────
const MARKET_SIRALIYE = {
  a101:'A101', bim:'BİM', carrefour:'CarrefourSA',
  migros:'Migros', sok:'ŞOK', tarim_kredi:'Tarım Kredi',
  hakmar:'Hakmar'
};

// Bottom sheet state
let _msSecili = [];
let _msMarkets = [];

// ══ SEPETİ BÖL + DÜRÜST TOPLAM ═══════════════════════
// Karma toplam ("her ürünü en ucuz olduğu marketten al") ödenebilir bir tutar
// değil — kullanıcının 3 markete birden gitmesini varsayıyor. Burada her market
// için GERÇEKTEN ödenecek tutar hesaplanıyor; bir markette olmayan ürün başka
// marketin fiyatıyla DOLDURULMUYOR, eksik olduğu açıkça yazılıyor.
const BOLME_MIN_KAZANC = 50;

function _sepetMarketFiyati(u, market) {
  const f = fiyatlariTemizle(u.market_fiyatlari).gecerli
    .filter(x => x.market === market && x.fiyat != null)
    .sort((a, b) => a.fiyat - b.fiyat)[0];
  return f ? f.fiyat : null;
}

function marketToplamlari() {
  const liste = sepet || [];
  if (!liste.length) return [];
  // Sehir seciliyse o ilde BULUNMAYAN zincir hic aday olmasin — kullaniciyi
  // gidemeyecegi bir markete yonlendirmeyelim. Secim yoksa marketVarMi hep true.
  const marketler = new Set();
  liste.forEach(u => fiyatlariTemizle(u.market_fiyatlari).gecerli.forEach(f => {
    if (f.market && marketVarMi(f.market)) marketler.add(f.market);
  }));
  const sonuc = [];
  marketler.forEach(m => {
    let toplam = 0, varOlan = 0;
    liste.forEach(u => {
      const f = _sepetMarketFiyati(u, m);
      if (f != null) { toplam += f; varOlan++; }
    });
    sonuc.push({
      market: m, ad: MARKET_NAMES[m] || m,
      toplam: toplam, varOlan: varOlan, eksik: liste.length - varOlan
    });
  });
  // Sepetin tamamını karşılayanlar önce, sonra ucuzdan pahalıya.
  sonuc.sort((a, b) => (a.eksik - b.eksik) || (a.toplam - b.toplam));
  return sonuc;
}

function sepetBolmeOnerisi() {
  const liste = sepet || [];
  const bos = { oner: false, tekMarket: null, ikili: null, kazanc: 0 };
  if (!liste.length) return bos;
  const toplamlar = marketToplamlari();
  const tamKapsayan = toplamlar.filter(m => m.eksik === 0);
  if (!tamKapsayan.length) return bos;
  const tek = tamKapsayan[0];

  // En iyi İKİ market kombinasyonu. İkiden fazlaya asla bölmüyoruz.
  const adaylar = toplamlar.map(m => m.market);
  let enIyi = null;
  for (let i = 0; i < adaylar.length; i++) {
    for (let j = i + 1; j < adaylar.length; j++) {
      const ikili = [adaylar[i], adaylar[j]];
      let toplam = 0, kapsandi = 0;
      liste.forEach(u => {
        let en = null;
        ikili.forEach(m => {
          const f = _sepetMarketFiyati(u, m);
          if (f != null && (en == null || f < en)) en = f;
        });
        if (en != null) { toplam += en; kapsandi++; }
      });
      if (kapsandi !== liste.length) continue;   // ikisi birlikte sepeti karşılamıyorsa geçersiz
      if (!enIyi || toplam < enIyi.toplam) {
        enIyi = { marketler: ikili, adlar: ikili.map(m => MARKET_NAMES[m] || m), toplam: toplam };
      }
    }
  }
  if (!enIyi) return { oner: false, tekMarket: tek, ikili: null, kazanc: 0 };
  const kazanc = tek.toplam - enIyi.toplam;
  return { oner: kazanc >= BOLME_MIN_KAZANC, tekMarket: tek, ikili: enIyi, kazanc: kazanc > 0 ? kazanc : 0 };
}

function sepetMarketOzetiHTML() {
  const toplamlar = marketToplamlari();
  if (!toplamlar.length) return '';
  const satirlar = toplamlar.slice(0, 5).map(m => `<div class="sepet-mkt-satir">
      <span class="sepet-mkt-ad">${_kacir(m.ad)}</span>
      <span class="sepet-mkt-tutar">${tl(m.toplam)}</span>
      ${m.eksik ? `<span class="sepet-mkt-eksik">${m.eksik} ürün yok — tutar onlar olmadan, eksik</span>` : ''}
    </div>`).join('');

  const o = sepetBolmeOnerisi();
  let oneri = '';
  if (o.oner && o.ikili) {
    oneri = `<div class="sepet-mkt-oneri">
        ${o.ikili.adlar.join(' + ')} olarak iki markete bölersen ${tl(o.kazanc)} kazanırsın
        <span class="sepet-mkt-oneri-alt">tek market ${_kacir(o.tekMarket.ad)} ${tl(o.tekMarket.toplam)} · iki market ${tl(o.ikili.toplam)}</span>
      </div>`;
  } else if (o.tekMarket) {
    oneri = `<div class="sepet-mkt-oneri">
        Tek markette almak mantıklı — ${_kacir(o.tekMarket.ad)}
        ${o.kazanc > 0 ? `<span class="sepet-mkt-oneri-alt">bölmek sadece ${tl(o.kazanc)} kazandırır</span>` : ''}
      </div>`;
  }

  return `<div class="sepet-mkt">
      <div class="sepet-mkt-baslik">Tek markette ne ödersin</div>
      ${satirlar}
      ${oneri}
    </div>`;
}

function karsilastir() {
  if (!sepet.length) {
    document.getElementById('compareOut').innerHTML = `<div class="state-msg">Listeniz boş.</div>`;
    return;
  }
  // Sehir seciliyse o ilde bulunmayan zincir karsilastirmaya girmez.
  const mevcutMarketler = new Set();
  sepet.forEach(u => (u.market_fiyatlari||[]).forEach(f => {
    if (f.market && marketVarMi(f.market)) mevcutMarketler.add(f.market);
  }));
  const mktList = [...mevcutMarketler];
  if (!mktList.length) {
    document.getElementById('compareOut').innerHTML = `<div class="state-msg">Hiç market fiyatı yok.</div>`;
    return;
  }
  msSheetAc(mktList);
}

// Bir markette olmayan ürün toplama HİÇ girmez (başka marketin fiyatıyla da
// doldurulmaz). O yüzden 2 ürünlük bir toplam, 4 ürünlük bir toplamla yan yana
// dururken "daha ucuz" gibi okunmasın diye eksik sayısı da taşınıyor.
function msMarketOzetleri(mktList) {
  const sepetToplam = (sepet || []).length;
  return (mktList || []).map(m => {
    let adet = 0, minToplam = 0;
    (sepet || []).forEach(u => {
      const f = (u.market_fiyatlari || []).filter(ff => ff.market === m && ff.fiyat != null).sort((a, b) => a.fiyat - b.fiyat)[0];
      if (!f) return;
      adet++;
      minToplam += f.fiyat;
    });
    return {
      key: m,
      name: MARKET_SIRALIYE[m] || MARKET_NAMES[m] || m,
      adet: adet,
      eksik: sepetToplam - adet,
      sepetToplam: sepetToplam,
      minToplam: minToplam
    };
  });
}

function msMarketMetaHTML(m) {
  const temel = `${m.adet} ürün · ${tl(m.minToplam)}`;
  if (!m.eksik) return temel;
  return `${temel}<span class="ms-meta-eksik"> · ${m.eksik} ürün yok (tutar eksik)</span>`;
}

// Seçili marketlerin BİRLİKTE sepeti ne kadar kapsadığı.
function msSecimKapsami(secilenler) {
  const sec = secilenler || [];
  const toplam = (sepet || []).length;
  let tutar = 0, kapsanan = 0;
  (sepet || []).forEach(u => {
    let min = null;
    (u.market_fiyatlari || []).forEach(f => {
      if (f.fiyat == null) return;
      if (sec.indexOf(f.market) < 0) return;
      if (min === null || f.fiyat < min) min = f.fiyat;
    });
    if (min === null) return;
    kapsanan++;
    tutar += min;
  });
  return { toplam: toplam, kapsanan: kapsanan, eksik: toplam - kapsanan, tutar: tutar };
}

function msSheetAc(mktList) {
  _msMarkets = msMarketOzetleri(mktList);
  _msSecili = _msMarkets.map(x => x.key);

  const listEl = document.getElementById('msList');
  listEl.innerHTML = _msMarkets.map(m => {
    const harf = (m.name || '?').trim().charAt(0).toUpperCase();
    return `<div class="ms-market-row selected" data-mkt="${_kacir(m.key)}" tabindex="0" role="button" aria-pressed="true" aria-label="${_kacir(m.name)}" onclick="msSheetToggle(this.dataset.mkt, this)" onkeydown="_satirTus(event, () => msSheetToggle(this.dataset.mkt, this))">
      <div class="ms-market-avatar">${harf}</div>
      <div class="ms-market-info">
        <div class="ms-market-name">${_kacir(m.name)}</div>
        <div class="ms-market-meta">${msMarketMetaHTML(m)}</div>
      </div>
      <div class="ms-tick">✓</div>
    </div>`;
  }).join('');

  document.getElementById('msSheetSub').textContent = `${sepet.length} ürün için`;
  document.getElementById('msSheet').classList.add('open');
  document.getElementById('msSheet').setAttribute('aria-hidden', 'false');
  const b = document.getElementById('msSheetBackdrop');
  if (b) b.classList.add('open');
  msSheetGuncelle();
}

function msSheetKapat() {
  const s = document.getElementById('msSheet');
  s.classList.remove('open');
  s.setAttribute('aria-hidden', 'true');
  const b = document.getElementById('msSheetBackdrop');
  if (b) b.classList.remove('open');
}

function msSheetToggle(m, rowEl) {
  const i = _msSecili.indexOf(m);
  if (i >= 0) _msSecili.splice(i, 1);
  else _msSecili.push(m);
  const on = _msSecili.includes(m);
  if (rowEl) {
    rowEl.classList.toggle('selected', on);
    // Satır bir TOGGLE; ekran okuyucu durumu duymalı. Görsel tik (.ms-tick)
    // tek başına yeterli değil.
    rowEl.setAttribute('aria-pressed', on ? 'true' : 'false');
  }
  msSheetGuncelle();
}

function msSheetGuncelle() {
  const kapsam = msSecimKapsami(_msSecili);
  document.getElementById('msSheetTotal').textContent = tl(kapsam.tutar);
  const uyari = document.getElementById('msSheetEksik');
  if (uyari) {
    uyari.textContent = kapsam.eksik
      ? `${kapsam.eksik} ürün seçili marketlerde yok — tutar onlar olmadan`
      : '';
    uyari.style.display = kapsam.eksik ? '' : 'none';
  }
  const n = _msSecili.length;
  const btn = document.getElementById('msSheetBtn');
  btn.textContent = n === 1 ? 'Hesapla (1 market)' : `Hesapla (${n} market)`;
  btn.disabled = n === 0;
}

function msSheetHesapla() {
  if (!_msSecili.length) return;
  msSheetKapat();
  if (!document.getElementById('compareOut').querySelector('#compareResult')) {
    document.getElementById('compareOut').innerHTML = `<div id="compareResult" style="margin-top:16px"></div>`;
  }
  hesaplaSecili(_msSecili);
  setTimeout(() => {
    const r = document.getElementById('compareResult');
    if (r) r.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 50);
}

document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && document.getElementById('msSheet').classList.contains('open')) {
    msSheetKapat();
  }
});

function hesaplaSecili(seciliMarketler) {
  if (!seciliMarketler || !seciliMarketler.length) {
    document.getElementById('compareResult').innerHTML = `<div class="state-msg">En az bir market seçin.</div>`;
    return;
  }

  const mkts = {};
  for (const item of sepet) {
    for (const f of (item.market_fiyatlari || []).filter(f => f.fiyat != null)) {
      const k = f.market || 'diger';
      if (!mkts[k]) mkts[k] = { name: MARKET_NAMES[k] || k, items: {} };
      if (!(item._id in mkts[k].items) || f.fiyat < mkts[k].items[item._id])
        mkts[k].items[item._id] = f.fiyat;
    }
  }

  const atama = {};
  const atanamayan = [];
  let genelToplam = 0;

  for (const item of sepet) {
    let best = null;
    for (const k of seciliMarketler) {
      if (mkts[k] && item._id in mkts[k].items) {
        const p = mkts[k].items[item._id];
        if (!best || p < best.price) best = { key: k, name: mkts[k].name, price: p };
      }
    }
    if (best) {
      if (!atama[best.key]) atama[best.key] = { items: [], total: 0 };
      // agirlik_hacim sepette VARDI ama bu projeksiyonda dusuyordu; birim
      // fiyat gosterebilmek icin tasiniyor (bkz. _cmpItemHTML).
      atama[best.key].items.push({ ad: item.ad, resim: item.resim,
        ana_kategori: item.ana_kategori, agirlik_hacim: item.agirlik_hacim,
        fiyat: best.price });
      atama[best.key].total += best.price;
      genelToplam += best.price;
    } else {
      atanamayan.push(item);
    }
  }

  const MFROM = {
    a101:"A101'den", bim:"BİM'den", carrefour:"CarrefourSA'dan",
    migros:"Migros'tan", sok:"ŞOK'tan", tarim_kredi:"T.Kredi'den",
    hakmar:"Hakmar'dan"
  };

  const _cmpItemHTML = (it) => {
    const ph = placeholderRenk(ustKategori(it.ana_kategori));
    const img = it.resim
      ? `<img class="cmp-mkt-item-img" src="${_guvenliUrl(it.resim)}" alt="" loading="lazy" onerror="this.outerHTML='<div class=\\'cmp-mkt-item-img-ph\\'>${ph.emoji}</div>'">`
      : `<div class="cmp-mkt-item-img-ph">${ph.emoji}</div>`;
    // İkinci satır: gramaj + birim fiyat. Birim fiyat bu satıra ATANAN
    // marketin fiyatından hesaplanıyor (ürünün global minimumundan DEĞİL) —
    // aksi halde "CarrefourSA'dan alacakların" listesinde başka marketin
    // fiyatına dayanan bir ₺/kg yazardı.
    const bf = it.fiyat != null ? _birimFiyatHam(it.agirlik_hacim, it.fiyat, it.ad) : null;
    const parcalar = [];
    if (it.agirlik_hacim) parcalar.push(it.agirlik_hacim);
    if (bf) parcalar.push(birimFiyatYazi(bf));
    const meta = parcalar.length
      ? `<div class="cmp-mkt-item-meta">${parcalar.join(' · ')}</div>` : '';
    return `<div class="cmp-mkt-item">
      ${img}
      <div class="cmp-mkt-item-main">
        <div class="cmp-mkt-item-name">${_kacir(it.ad)}</div>
        ${meta}
      </div>
      <span class="cmp-mkt-item-price">${it.fiyat != null ? tl(it.fiyat) : '<span class="cmp-mkt-item-yok">—</span>'}</span>
    </div>`;
  };

  const blocks = seciliMarketler.filter(k => atama[k]).map(k => {
    const g = atama[k];
    return `<div class="cmp-mkt-block">
      <div class="cmp-mkt-name"><span class="cmp-mkt-dot m-${_marketSinifi(k)}"></span>${MFROM[k] || g.name + "'den"} alacakların:</div>
      ${g.items.map(_cmpItemHTML).join('')}
      <div class="cmp-mkt-subtotal"><span>Toplam</span><span class="cmp-mkt-subtotal-val">${tl(g.total)}</span></div>
    </div>`;
  }).join('');

  const atanamayanHtml = atanamayan.length ? `
    <div class="cmp-mkt-block" style="margin-top:12px">
      <div class="cmp-mkt-name">⚠️ Seçili marketlerde bulunmayan ürünler:</div>
      ${atanamayan.map(it => _cmpItemHTML({ ad: it.ad, resim: it.resim, ana_kategori: it.ana_kategori, agirlik_hacim: it.agirlik_hacim, fiyat: null })).join('')}
    </div>` : '';

  document.getElementById('compareResult').innerHTML =
    blocks + atanamayanHtml +
    `<div class="cmp-grand"><span>Genel Toplam</span><span>${tl(genelToplam)}</span></div>`;
}

// ── HAL.JSON CACHE — tek seferlik fetch ───────────────
let _halCache = null;
let _halPromise = null;
function halVeriGetir() {
  if (_halCache) return Promise.resolve(_halCache);
  if (_halPromise) return _halPromise;
  _halPromise = fetch('./data/hal.json')
    .then(r => r.json())
    .then(data => {
      _halCache = data;
      window.halVerisi = data;
      _halPromise = null;
      return data;
    });
  return _halPromise;
}

// ── VERİ YÜKLE (sadece hal.json — ürünler lazy) ───────
function loadData() {
  return halVeriGetir().then(halData => {
    window.halVerisi = halData;
    if (halData.urunler) {
      halMap = {};
      for (const u of halData.urunler) {
        const k = norm(u.ad);
        if (!halMap[k] || (u.fiyat != null && u.fiyat < (halMap[k].fiyat ?? 9999))) halMap[k] = u;
      }
      // #halDate elemani index.html'de YOK (2026-07-10 inline->app.js ayiklamasinda
      // dustu). Korumasiz getElementById(...).innerHTML her acilista TypeError
      // atiyor, .then govdesi burada kesiliyor ve asagidaki hicbir satir
      // calismiyordu. Hata da .catch tarafindan sessizce yutuluyordu.
      const bt = halData.bulten_tarihi || '';
      const _halDate = document.getElementById('halDate');
      if (bt && _halDate) _halDate.innerHTML =
        `<span class="hal-badge">Hal: ${bt.slice(0, 10)}</span>`;
    }
    // ?screen=hal derin baglantisi script sonunda SENKRON kosuyor, hal.json ise
    // asenkron geliyor. openHalScreen() renderHalScreen()'i hemen cagirdigi icin
    // ekran "yukleniyor"da kaliyordu ve veri gelince kimse yeniden cizmiyordu.
    // Acik olan hal ekrani veri hazir olunca bir kez yenilenir.
    const _halEkran = document.getElementById('screen-hal');
    if (_halEkran && _halEkran.style.display !== 'none') renderHalScreen();
    return _anaEkraniCiz();
  }).catch((e) => {
    console.error('[loadData] hal.json yuklenemedi veya render zinciri kirildi; kategori izgarasi ve seritler yine cizilecek:', e && e.message, e);
    return _anaEkraniCiz();
  }).then(_hazirBildir);
}

// Ana ekranin ILK cizim gecisi. Donen soz, dort seridin hepsi SONUCLANINCA
// (dolu ya da bos) settle olur -- splash'i kaldiran sinyal bu.
//
// NEDEN DOM'a bakmiyoruz: "ilk serit doldu mu" diye yoklamak cevrimdisiyken
// HIC gerceklesmiyor (olculdu: veri istekleri bloklandiginda kategori izgarasi
// 325 ms'de ciziliyor ama seritler hic dolmuyor) -- splash sonsuza kadar asili
// kalirdi. Render fonksiyonlari ise her durumda cozuluyor: veri yoksa bolumu
// gizleyip donuyorlar. Yani "settle" hem dogru hem kilitlenmez.
function _anaEkraniCiz() {
  renderCatGrid();
  saveSepet();
  // Mevsim seridi AYRI bir kategori dosyasi indiriyor (olculdu: 477 ms, digerleri
  // 429 ms) ve ekranin cok altinda kaliyor — splash onu BEKLEMIYOR.
  renderMevsimSeridi();
  // Dört şerit tek küçük dosyadan (25,9 KB gzip) besleniyor; 16.790 ürün
  // taraması build'e taşındı. idle callback'i beklemelerine gerek yok.
  return Promise.allSettled([
    renderDusenlerSeridi(),
    renderSupheliSeridi(),
    renderTuzaklarSeridi(),
    renderZamSeridi(),
  ]);
}

// Hazir sinyali TEK KEZ. loadData iki daldan da (basari/hata) buraya varir.
let _hazirBildirildi = false;
function _hazirBildir() {
  if (_hazirBildirildi) return;
  _hazirBildirildi = true;
  // Build betikleri (scripts/anasayfa-uret.mjs, hub-uret.mjs) app.js'i
  // node:vm icinde kosturuyor; orada Event/dispatchEvent YOK ve bu satir
  // "ReferenceError: Event is not defined" ile TUM BUILD'i dusuruyordu.
  // Tarayici disinda sinyal zaten kimseyi ilgilendirmiyor.
  if (typeof Event !== 'function' || typeof document === 'undefined' ||
      typeof document.dispatchEvent !== 'function') return;
  document.dispatchEvent(new Event('pazar:hazir'));
}

function openHalScreen() {
  renderHalScreen();
  showScreen('screen-hal');
}

function renderHalScreen() {
  const container = document.getElementById('halContent');
  if (!window.halVerisi) {
    container.innerHTML = '<div class="state-msg"><span class="icon">' + lcIcon('building-2') + '</span>Hal verisi yükleniyor...</div>';
    return;
  }
  const data = window.halVerisi;
  const dateStr = data.bulten_tarihi || '';
  const tarihDisplay = dateStr ? `<div style="padding:10px 14px;font-size:.75rem;color:var(--text-muted);border-bottom:1px solid var(--border);text-align:center">📅 ${dateStr}</div>` : '';
  const HAL_SEBZE = new Set(['acur','adacayi (yas-taze)','alabas(kohlrabi)','asma yapragi','bakla taze','balkabagi','bamya taze','barbunya taze','beyaz lahana','bezelye taze','biberiye','brokoli','bruksel lahanasi','deniz borulcesi(deniz otu ege otu)','dereotu (yas-taze)','domates','domates salcalik','ebegumeci','enginar','fasulye taze','fesleGen(reyhan)','hardal otu (yas-taze)','havuc','hindiba (cikori)','hindiba endivyen','hindiba radika','isirgan (yas-taze)','ispanak','kabak','kabak cerezlik','kabak cicegi','karalahana','karnabahar','kaya korugu','kekik (yas-taze)','kereviz','kereviz sap','kiris (ciris)','kisnis','kirmizi lahana','kuskonmaz','kuzukulagi','labada','madimak','mantar','marul gobokli','marul iceberg','marul kivircik','maydanoz','mercan kosk','misir taze','mizuna otu','nane','nohut taze','pakchoi','pancar','patates','patlican','pazi','pirasa','rakula','rezene (yas-taze)','roka','salatalik','salatalik tursuluk','sarimsak kuru','sarimsak taze','semizotu','sogan kuru','yesil sogan','soya filizi','salgam','sevketi bostan','tarhun','tatli patates','tere','turp','turp beyaz','turp otu','limon otu (limon grass)','zencefil','bi̇ber carli̇ston','bi̇ber dolmalik','bi̇ber salcalik (kapya)','bi̇ber si̇vri̇','bi̇beri̇ye','boruice taze','brokoli̇','bruksel lahanasi','deni̇z boruicesi̇(deni̇z otu ege otu)','ebeGumeci̇','engi̇nar','fesleGen(reyhan)','hardal otu','hi̇ndi̇ba (ci̇kori̇)','hi̇ndi̇ba endi̇vyen','hi̇ndi̇ba radi̇ka','keki̇k (yas-taze)','kerevi̇z','kerevi̇z sap','ki̇ri̇s (ci̇ri̇s)','ki̇sni̇s','ki̇rmizi lahana','kuskonmaz','marul gobokli̇','marul ki̇vi̇rci̇k','mi̇sir taze','mi̇zuna otu','pakchoi̇','pirasa','semi̇zotu','soya fi̇li̇zi̇','sevketi̇ bostan','zencefi̇l']);
  const getHalKat = ad => {
    const n = (ad||'').toLowerCase()
      .replace(/ğ/g,'g').replace(/ü/g,'u').replace(/ş/g,'s')
      .replace(/ı/g,'i').replace(/ö/g,'o').replace(/ç/g,'c').trim();
    if (HAL_SEBZE.has(n)) return 'sebze';
    const sebzeKw = ['domates','biber','patlican','kabak','salatalik','sogan','sarimsak','ispanak','marul','havuc','patates','pirasa','kereviz','enginar','bamya','roka','tere','mantar','maydanoz','dereotu','nane','lahana','karnabahar','pancar','pazi','turp','fasulye','borulce','bakla','bezelye','brokoli','semizotu','salgam'];
    return sebzeKw.some(k => n.includes(k)) ? 'sebze' : 'meyve';
  };
  const halEmojiler = { sebze: '🥦', meyve: '🍎' };
  const halRenkler = { sebze: '#E8F5E9', meyve: '#FFF3E0' };
  const products = (data.urunler || []).slice().sort((a, b) => a.ad.localeCompare(b.ad, 'tr'));
  if (!products.length) {
    container.innerHTML = tarihDisplay + '<div class="state-msg"><span class="icon">' + lcIcon('building-2') + '</span>Hal verisi bulunamadı.</div>';
    return;
  }
  const filtersHtml = `<div style="padding:8px 14px;display:flex;gap:8px">
    <button class="hal-filter-btn active" data-kat="tum" onclick="halFiltrele('tum',this)">Tümü</button>
    <button class="hal-filter-btn" data-kat="meyve" onclick="halFiltrele('meyve',this)">🍎 Meyve</button>
    <button class="hal-filter-btn" data-kat="sebze" onclick="halFiltrele('sebze',this)">🥦 Sebze</button>
  </div>`;
  const cards = products.map(u => {
    const kat = getHalKat(u.ad);
    const gorselHtml = u.gorsel
      ? `<img src="${_guvenliUrl(u.gorsel)}" alt="${_kacir(u.ad)}" loading="lazy" style="width:100%;height:80px;object-fit:cover;border-radius:12px 12px 0 0" onerror="this.outerHTML='<div style=&quot;height:80px;display:flex;align-items:center;justify-content:center;font-size:2.5rem;background:${halRenkler[kat]};border-radius:12px 12px 0 0&quot;>${halEmojiler[kat]}</div>'">`
      : `<div style="height:80px;display:flex;align-items:center;justify-content:center;font-size:2.5rem;background:${halRenkler[kat]};border-radius:12px 12px 0 0">${halEmojiler[kat]}</div>`;
    return `<div class="hal-grid-card" data-kat="${kat}">
      ${gorselHtml}
      <div style="padding:8px">
        <div style="font-size:11px;font-weight:500;color:var(--text);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;min-height:26px">${_kacir(u.ad)}</div>
        <div style="font-size:13px;font-weight:700;color:var(--primary);margin-top:4px">${tl(u.fiyat)} <span style="font-size:10px;font-weight:400">₺/kg</span></div>
        ${dateStr ? `<div style="font-size:9px;color:var(--text-muted);margin-top:2px">${dateStr}</div>` : ''}
      </div>
    </div>`;
  }).join('');
  container.innerHTML = tarihDisplay + filtersHtml + `<div class="hal-grid" id="halList">${cards}</div>`;
  document.getElementById('halSearch')?.addEventListener('input', halArama);
}

function halFiltrele(kat, btn) {
  document.querySelectorAll('.hal-filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  document.querySelectorAll('#halList .hal-grid-card').forEach(c => {
    c.style.display = kat === 'tum' || c.dataset.kat === kat ? '' : 'none';
  });
}

// ── FIRSATLAR ─────────────────────────────────────────
let _firsatAktifTab = 'ucuz';

function goFirsatlar() {
  showScreen('screen-firsatlar');
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  const nb = document.getElementById('navFirsat');
  if (nb) nb.classList.add('active');
  const ara = document.getElementById('firsatArama');
  if (ara) ara.value = '';
  window._firsatArama = '';
  renderFirsatlar(_firsatAktifTab);
}

function firsatTab(tab, btn) {
  _firsatAktifTab = tab;
  document.querySelectorAll('.firsat-tab').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  const ara = document.getElementById('firsatArama');
  if (ara) ara.value = '';
  window._firsatArama = '';
  renderFirsatlar(tab);
}

function firsatAra(q) {
  window._firsatArama = (q||'').toLowerCase().trim();
  const kartlar = document.querySelectorAll('#firsatContent .firsat-card');
  kartlar.forEach(function(k) {
    const isim = (k.querySelector('.firsat-card-name')||{}).textContent||'';
    k.style.display = (!window._firsatArama || isim.toLowerCase().includes(window._firsatArama)) ? '' : 'none';
  });
}

function renderFirsatlar(tab) {
  const container = document.getElementById('firsatContent');
  if (!container) return;
  container.innerHTML = '<div class="firsat-loading">⏳ Yükleniyor...</div>';
  const ustKategoriler = ['meyve','sebze','et','sut','gida','icecek','temizlik','atistirmalik','dondurulmus','diger'];
  const ucuzQuery = Promise.all(ustKategoriler.map(function(kat) {
    return window.supabaseClient.from('urunler')
      .select('*')
      .eq('ust_kategori', kat)
      .not('en_dusuk_fiyat', 'is', null)
      .order('en_dusuk_fiyat', { ascending: true })
      .limit(10)
      .then(function(res) { return { kat: kat, urunler: res.data || [] }; });
  }));
  // Üst sınır: fiyat_farki_yuzde 70+ = en pahalı, en ucuzun ~3.3 katı. Client'taki
  // fiyatlariTemizle "medyanın 3 katı" kuralıyla hizalı; aykırı veriler fırsat
  // diye listenin başına çıkmasın. (Ölçüm: 1224 üründen 7'si eleniyor.)
  const tasarrufSayiQuery = window.supabaseClient.from('urunler')
    .select('*', { count: 'exact', head: true })
    .gte('fiyat_farki_yuzde', 15)
    .lt('fiyat_farki_yuzde', 70);

  Promise.all([ucuzQuery, tasarrufSayiQuery]).then(function(sonuclar) {
    const ucuzGruplari = sonuclar[0];
    const tasarrufSayi = sonuclar[1].count || 0;
    let ucuzSayi = 0;
    ucuzGruplari.forEach(function(g){ ucuzSayi += Math.min(5, g.urunler.length); });
    _firsatOzetGuncelle(ucuzSayi, tasarrufSayi);

    if (tab === 'ucuz') {
      renderFirsatUcuz(container, ucuzGruplari);
    } else if (tab === 'tasarruf') {
      window.supabaseClient.from('urunler')
        .select('*')
        .gte('fiyat_farki_yuzde', 15)
        .lt('fiyat_farki_yuzde', 70)
        .order('fiyat_farki_tl', { ascending: false })
        .limit(30)
        .then(function(res) {
          renderFirsatTasarruf(container, res.data || []);
        });
    }
  });
}

function _firsatKartHtml(u, badge, badgeClass, altText) {
  if (!u._id) u._id = u.ad + '_' + (u.agirlik_hacim||'');
  productMap[u._id] = u;
  const emoji = KAT_EMOJI[ustKategori(u.ana_kategori||'')] || '📦';
  const fiyat = u.en_dusuk_fiyat != null ? tlHTML(u.en_dusuk_fiyat) : '<span class="fp"><span class="fp-l">—</span></span>';
  const imgHtml = u.resim
    ? '<img class="firsat-card-img" src="'+_guvenliUrl(u.resim)+'" alt="" loading="lazy" onerror="this.className=\'firsat-card-img-ph\';this.outerHTML=\'<div class=&quot;firsat-card-img-ph&quot;>'+emoji+'</div>\'">'
    : '<div class="firsat-card-img-ph">'+emoji+'</div>';
  const inCart = window.sepet && window.sepet.some(function(s){return s._id===u._id;});
  return '<div class="firsat-card">'
    + imgHtml
    + '<div class="firsat-card-body">'
    + '<div class="firsat-card-name">'+_kacir(u.ad||'')+'</div>'
    + '<div class="firsat-card-sub">'+_kacir(altText)+'</div>'
    // Şüpheli ürün listeden çıkarılmaz, rozetiyle görünür — kararı kullanıcı verir.
    + (supheliDurum(u) ? supheliRozetHTML() : '')
    + '</div>'
    + '<div class="firsat-card-right">'
    + '<div class="firsat-card-price">'+fiyat+'</div>'
    + '<span class="firsat-card-badge '+badgeClass+'">'+badge+'</span>'
    + '<button class="firsat-card-add" onclick="event.stopPropagation();firsatSepetEkle(this,\''+btoa(unescape(encodeURIComponent(u._id)))+'\')" style="'+(inCart?'background:#059669':'')+'">'+( inCart?'✓':'+')+'</button>'
    + '</div></div>';
}

function _firsatOzetGuncelle(ucuzSayi, tasarrufSayi) {
  const ozet = document.getElementById('firsatOzet');
  if (!ozet) return;
  ozet.innerHTML = ''
    + '<div class="firsat-ozet-chip"><div class="firsat-ozet-sayi">'+ucuzSayi+'</div><div class="firsat-ozet-lbl">En Ucuz</div></div>'
    + '<div class="firsat-ozet-chip"><div class="firsat-ozet-sayi">'+tasarrufSayi+'</div><div class="firsat-ozet-lbl">Fiyat Farkı</div></div>';
}

function renderFirsatUcuz(container, ucuzGruplari) {
  const katLabel = {'meyve':'🍎 Meyve & Sebze','sebze':'🥦 Sebze','et':'🥩 Et & Tavuk','sut':'🧀 Süt & Kahvaltı','gida':'🥫 Temel Gıda','icecek':'🥤 İçecek','temizlik':'🧴 Temizlik','atistirmalik':'🍫 Atıştırmalık','dondurulmus':'🧊 Dondurulmuş','diger':'📦 Diğer'};
  let html = '';
  ucuzGruplari.forEach(function(grup) {
    const kat = grup.kat, urunler = grup.urunler;
    if (!urunler.length) return;
    const dedupe = new Map();
    urunler.forEach(function(u) {
      const key = (u.ad||'') + '||' + (u.agirlik_hacim||'') + '||' + u.en_dusuk_fiyat;
      if (!dedupe.has(key)) {
        const kopya = Object.assign({}, u);
        kopya._enUcuzMarketler = [];
        dedupe.set(key, kopya);
      }
      const grupUrun = dedupe.get(key);
      (u.market_fiyatlari||[]).forEach(function(m) {
        if (m.fiyat === u.en_dusuk_fiyat && grupUrun._enUcuzMarketler.indexOf(m.market) === -1) {
          grupUrun._enUcuzMarketler.push(m.market);
        }
      });
    });
    const sirali = [...dedupe.values()].slice(0,5);
    if (!sirali.length) return;
    html += '<div class="firsat-section"><div class="firsat-section-title">'+(katLabel[kat]||kat)+'</div>';
    sirali.forEach(function(u) {
      let marketStr;
      if (u._enUcuzMarketler && u._enUcuzMarketler.length) {
        marketStr = u._enUcuzMarketler.map(function(m){return MARKET_NAMES[m]||m;}).join(', ');
      } else {
        const mkt = (u.market_fiyatlari||[]).slice().sort(function(a,b){return a.fiyat-b.fiyat;})[0];
        marketStr = mkt ? (MARKET_NAMES[mkt.market]||mkt.market) : '';
      }
      const altText = marketStr ? marketStr + ' · en ucuz' : '';
      html += _firsatKartHtml(u, 'EN UCUZ', 'firsat-badge-ucuz', altText);
    });
    html += '</div>';
  });
  container.innerHTML = html || '<div class="firsat-loading">Veri yükleniyor...</div>';
}

function renderFirsatTasarruf(container, tumUrunler) {
  const firsatlar = [];
  tumUrunler.forEach(function(u) {
    const fiyatlar = (u.market_fiyatlari||[]).map(function(f){return f.fiyat;}).filter(Boolean);
    if (fiyatlar.length < 2) return;
    const min = Math.min.apply(null, fiyatlar);
    const max = Math.max.apply(null, fiyatlar);
    const fark = max - min;
    const yuzde = Math.round((fark/max)*100);
    if (yuzde >= 15) firsatlar.push({u:u, min:min, max:max, fark:fark, yuzde:yuzde});
  });
  firsatlar.sort(function(a,b){return b.fark-a.fark;});
  if (!firsatlar.length) {
    container.innerHTML = `<div class="empty-state">
      <div class="empty-icon">${lcIcon('zap')}</div>
      <div class="empty-title">Şu anda fırsat yok</div>
      <div class="empty-desc">Yarın tekrar dene</div>
    </div>`;
    return;
  }
    let html = '<div class="firsat-section"><div class="firsat-section-title">' + lcIcon('heart') + ' Markete Göre Fiyat Değişiyor — Ucuzunu Bul</div>';
  firsatlar.slice(0,30).forEach(function(item) {
    const _tmz = fiyatlariTemizle(item.u.market_fiyatlari).gecerli;
    const enUcuz = _tmz.slice().sort(function(a,b){return a.fiyat-b.fiyat;})[0];
    const enPahali = _tmz.slice().sort(function(a,b){return b.fiyat-a.fiyat;})[0];
    const altText = (MARKET_NAMES[enUcuz&&enUcuz.market]||'')+' '+tl(item.min)+' · '+(MARKET_NAMES[enPahali&&enPahali.market]||'')+' '+tl(item.max);
    html += _firsatKartHtml(item.u, '%'+item.yuzde+' fark', 'firsat-badge-tasarruf', altText);
  });
  html += '</div>';
  container.innerHTML = html;
}

// ── PROFİL ────────────────────────────────────────────
function goProfil() {
  showScreen('screen-profil');
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  const nb = document.getElementById('navProfil');
  if (nb) nb.classList.add('active');
  profilGuncelle();
}

async function duzenleKullaniciAdi() {
  const user = window.pazarAuth?.user;
  if (!user) {
    if (typeof window.openAuthSheet === 'function') window.openAuthSheet('login');
    return;
  }
  const mevcut = pazarProfile?.ad || (user.user_metadata?.full_name) || (user.email ? user.email.split('@')[0] : '');
  const yeni = await modalAc({ title: 'İsmini gir', input: true, defaultValue: mevcut, okText: 'Kaydet' });
  if (!yeni) return;
  const ad = yeni.trim();
  if (!ad) return;
  if (ad.length > 30) { await modalAc({ title: 'Çok uzun', msg: 'En fazla 30 karakter.', okText: 'Tamam' }); return; }
  try {
    const { error } = await window.supabaseClient
      .from('profiles')
      .update({ ad: ad, updated_at: new Date().toISOString() })
      .eq('id', user.id);
    if (error) { await modalAc({ title: 'Kaydedilemedi', msg: error.message, okText: 'Tamam' }); return; }
    if (typeof pazarProfile === 'object' && pazarProfile) pazarProfile.ad = ad;
    if (typeof window.renderProfilAuth === 'function') window.renderProfilAuth();
  } catch (e) { console.warn('[profil] kullanici adi kaydedilemedi:', e && e.message);
    await modalAc({ title: 'Hata', msg: e.message, okText: 'Tamam' });
  }
}
function uygulaKullaniciAdi() {
  // Auth-aware: renderProfilAuth tek doğru kaynak. Eski localStorage 'kullaniciAdi' artık kullanılmıyor.
  if (typeof window.renderProfilAuth === 'function') window.renderProfilAuth();
}

// ══ PROFİL BÖLÜMLERİ ═════════════════════════════════
// Kural: verisi olmayan bölüm çizilmez. Her sayı gerçek veriden gelir.

// _sid -> ürün. catCache yüklüyse oradan, yoksa productMap'ten.
function _profilUrunBul(sid) {
  if (!sid) return null;
  for (const liste of Object.values(catCache || {})) {
    const u = (liste || []).find(x => x && x._sid === sid);
    if (u) return u;
  }
  return Object.values(productMap || {}).find(x => x && x._sid === sid) || null;
}
function _profilEnUcuz(u) {
  const g = fiyatlariTemizle(u && u.market_fiyatlari).gecerli;
  if (!g.length) return null;
  return g.slice().sort((a, b) => a.fiyat - b.fiyat)[0];
}

// A) Tasarruf özeti — paylasSepet()'teki formülün AYNISI: en pahalı - en ucuz.
function profilTasarrufHTML() {
  if (!sepet || !sepet.length) return '';
  let toplam = 0, enPahaliToplam = 0;
  sepet.forEach(u => {
    const f = fiyatlariTemizle(u.market_fiyatlari).gecerli.map(x => x.fiyat);
    if (!f.length) return;
    toplam += Math.min.apply(null, f);
    enPahaliToplam += Math.max.apply(null, f);
  });
  const tasarruf = enPahaliToplam - toplam;
  if (!(tasarruf > 1)) return '';
  return `<div class="profil-tasarruf">
      <div class="profil-tasarruf-ust">Listendeki <b>${sepet.length}</b> ürünü en ucuz marketlerden alırsan</div>
      <div class="profil-tasarruf-rakam">${tl(tasarruf)}</div>
      <div class="profil-tasarruf-alt">tasarruf edersin · en pahalısıyla ${tl(enPahaliToplam)}, en ucuzuyla ${tl(toplam)}</div>
    </div>`;
}

// A2) "Senin enflasyonun" — sepetteki ürünlerin 30 günlük değişimi.
// fiyat_gecmisi yalnızca fiyat DEĞİŞİNCE kayıt yazıyor, o yüzden "30 gün önceki
// fiyat" = 30 günden eski son kayıt (o tarihte yürürlükte olan fiyat).
// Bugünle aynı mantık: her iki tarafta da marketler arası EN UCUZ fiyat.
const ENFLASYON_MIN_URUN = 3;

function _otuzGunOncekiEnUcuz(sid) {
  if (!sid || !_gecmisCache) return null;
  const kayitlar = _gecmisCache[sid];
  if (!Array.isArray(kayitlar) || !kayitlar.length) return null;
  const limit = _yerelGunISO(30);               // yerel takvim günü, bkz. _yerelGunISO
  const sonKayit = {};
  kayitlar.forEach(k => {
    if (!k || !k.t || k.f == null || k.t > limit) return;
    const m = k.m || '?';
    if (!sonKayit[m] || k.t >= sonKayit[m].t) sonKayit[m] = k;
  });
  const fiyatlar = Object.values(sonKayit).map(k => k.f).filter(f => f > 0);
  return fiyatlar.length ? Math.min.apply(null, fiyatlar) : null;
}

function sepetEnflasyonuHesapla() {
  const liste = sepet || [];
  let eskiToplam = 0, yeniToplam = 0, katilan = 0;
  liste.forEach(u => {
    const gecerli = fiyatlariTemizle(u.market_fiyatlari).gecerli.map(f => f.fiyat).filter(f => f > 0);
    if (!gecerli.length) return;
    const bugun = Math.min.apply(null, gecerli);
    const eski = _otuzGunOncekiEnUcuz(u._sid);
    if (eski == null || !(eski > 0)) return;
    eskiToplam += eski;
    yeniToplam += bugun;
    katilan++;
  });
  if (!katilan || !(eskiToplam > 0)) {
    return { katilan: 0, toplam: liste.length, eskiToplam: 0, yeniToplam: 0, yuzde: 0, yon: 'sabit' };
  }
  const yuzde = ((yeniToplam - eskiToplam) / eskiToplam) * 100;
  return {
    katilan: katilan,
    toplam: liste.length,
    eskiToplam: eskiToplam,
    yeniToplam: yeniToplam,
    yuzde: yuzde,
    yon: yuzde > 0.05 ? 'artis' : (yuzde < -0.05 ? 'dusus' : 'sabit')
  };
}

function profilEnflasyonHTML() {
  if (!sepet || !sepet.length) return '';
  const r = sepetEnflasyonuHesapla();
  if (!r || r.katilan < ENFLASYON_MIN_URUN) return '';
  const isaret = r.yuzde > 0 ? '+' : '';
  const yuzdeYazi = isaret + r.yuzde.toFixed(1).replace('.', ',') + '%';
  const cumle = r.yon === 'dusus' ? 'ucuzladı' : (r.yon === 'artis' ? 'zamlandı' : 'değişmedi');
  return `<div class="profil-enflasyon ${r.yon}">
      <div class="profil-enflasyon-ust">Senin sepetin bu ay</div>
      <div class="profil-enflasyon-rakam">${yuzdeYazi} ${cumle}</div>
      <div class="profil-enflasyon-alt">30 gün önce ${tl(r.eskiToplam)} · bugün ${tl(r.yeniToplam)} — ${r.toplam} üründen ${r.katilan}'i hesaba katıldı</div>
      <button type="button" class="profil-enflasyon-paylas" onclick="paylasEnflasyon()">${lcIcon('share-2')} Paylaş</button>
    </div>`;
}

function paylasEnflasyon() {
  const r = sepetEnflasyonuHesapla();
  if (!r || r.katilan < ENFLASYON_MIN_URUN) return;
  const isaret = r.yuzde > 0 ? '+' : '';
  const cumle = r.yon === 'dusus' ? 'ucuzladı' : (r.yon === 'artis' ? 'zamlandı' : 'değişmedi');
  const metin = `Sepetim bu ay ${isaret}${r.yuzde.toFixed(1).replace('.', ',')}% ${cumle}. `
    + `${r.katilan} üründe 30 gün önce ${tl(r.eskiToplam)}, bugün ${tl(r.yeniToplam)}.`;
  const url = 'https://pazarapp.net/';
  if (navigator.share) {
    navigator.share({ title: 'Pazar — Senin enflasyonun', text: metin, url: url }).catch(() => { /* kullanici paylasim penceresini kapatti veya iptal etti: hata degil, sessiz gecmek DOGRU */ });
    return;
  }
  window.open('https://wa.me/?text=' + encodeURIComponent(metin + ' ' + url), '_blank');
}

// B) Kayıtlı listelerim — şablonlar localStorage'da (pazar_sablonlar).
function profilSablonlarHTML() {
  const liste = Array.isArray(sablonlar) ? sablonlar : [];
  if (!liste.length) {
    return `<div class="profil-bos">Kayıtlı listen yok — Listem'den şablon kaydedebilirsin
      <button type="button" class="profil-bos-btn" onclick="goSepet()">Listem</button></div>`;
  }
  return liste.map(s => {
    const idAttr = _kacir(String(s.id));  // öznitelik değeri; handler this.dataset.id'den okur
    const adSafe = _kacir(_sablonDisplayAd(s.ad) || 'Şablon');  // S3: metin + aria-label özniteliği (tırnak kırılması dahil)
    const sidler = (s.urunIds || []).map(x => x && x.sid).filter(Boolean);
    let toplam = 0, bulunan = 0;
    sidler.forEach(sid => {
      const u = _profilUrunBul(sid);
      const f = u && _profilEnUcuz(u);
      if (f) { toplam += f.fiyat; bulunan++; }
    });
    const tutar = bulunan ? ' · ' + tl(toplam) : '';
    return `<div class="profil-satir">
        <button type="button" class="profil-satir-ana" data-id="${idAttr}" onclick="sablonYukleUI(this.dataset.id)">
          <span class="profil-satir-ad">${adSafe}</span>
          <span class="profil-satir-alt">${sidler.length} ürün${tutar}</span>
        </button>
        <button type="button" class="profil-satir-sil" aria-label="${adSafe} şablonunu sil" data-id="${idAttr}" onclick="profilSablonSil(this.dataset.id)">${lcIcon('trash-2')}</button>
      </div>`;
  }).join('');
}

// C) Fiyat alarmlarım — Supabase fiyat_alarmlari (oturuma bağlı).
function profilAlarmlarHTML() {
  const harita = (window.pazarAlarmMap instanceof Map) ? window.pazarAlarmMap : new Map();
  if (!harita.size) {
    return `<div class="profil-bos">Fiyat alarmın yok — ürün detayından hedef fiyat kurabilirsin</div>`;
  }
  const satirlar = [];
  harita.forEach((hedef, sid) => {
    const u = _profilUrunBul(sid);
    const ad = u ? u.ad : sid;
    const f = u && _profilEnUcuz(u);
    const guncel = f ? f.fiyat : null;
    const sidAttr = _kacir(String(sid));  // öznitelik değeri; handler this.dataset.sid'den okur
    let durum;
    if (guncel == null) durum = '<span class="profil-satir-alt">Hedef ' + tl(hedef) + ' · güncel fiyat yok</span>';
    else if (guncel <= hedef) durum = '<span class="profil-satir-alt basarili">Hedefe ulaştı · ' + tl(guncel) + '</span>';
    else durum = '<span class="profil-satir-alt">Hedef ' + tl(hedef) + ' · güncel ' + tl(guncel) + ' · ' + tl(guncel - hedef) + ' uzakta</span>';
    satirlar.push(`<div class="profil-satir">
        <div class="profil-satir-ana profil-satir-ana--statik">
          <span class="profil-satir-ad">${String(ad).replace(/</g, '&lt;')}</span>
          ${durum}
        </div>
        <button type="button" class="profil-satir-sil" aria-label="Alarmı kaldır" data-sid="${sidAttr}" onclick="profilAlarmKaldir(this.dataset.sid)">${lcIcon('trash-2')}</button>
      </div>`);
  });
  return satirlar.join('');
}

// D) Katkılarım — sayı yoksa/0 ise bölüm hiç çizilmez.
function profilKatkiHTML(adet) {
  const n = Number(adet);
  if (!n || n < 1) return '';
  return `<div class="profil-katki">
      <div class="profil-katki-sayi">${n}</div>
      <div class="profil-katki-yazi">fiyat bildirimi gönderdin — bildirimlerin diğer kullanıcıları uyardı</div>
    </div>`;
}

// ═══ ŞEHİR SEÇİMİ + ZİNCİR MEVCUDİYETİ ══════════════════
// Ölçüm (2026-08-10, 81 il): a101/bim/migros/sok/tarim_kredi 81/81 ilde;
// carrefour 34/81 (%42); hakmar 8/81 (%10, yalnızca Marmara çevresi).
// Yani illerin 46'sında bugüne kadar orada BULUNMAYAN iki zincir gösteriliyordu.
// Şehir kullanıcı tarafından ELLE seçilir — konum izni istemiyoruz (KVKK).
// Seçilmemişse ilMarketleri() null döner ve HİÇBİR ŞEY filtrelenmez.
const SEHIR_KEY = 'pazar_sehir';
let _ilMarketCache = null;
let _ilMarketPromise = null;

function ilMarketVeriGetir() {
  if (_ilMarketCache) return Promise.resolve(_ilMarketCache);
  if (_ilMarketPromise) return _ilMarketPromise;
  _ilMarketPromise = fetch('./data/il_marketler.json')
    .then(r => { if (!r.ok) throw new Error('fetch failed'); return r.json(); })
    .then(d => { _ilMarketCache = d; return d; })
    .catch(e => { console.warn('[sehir] il_marketler.json yuklenemedi, sehir filtresi TUM marketleri gosterecek:', e && e.message); _ilMarketCache = { iller: {} }; return _ilMarketCache; });
  return _ilMarketPromise;
}

function sehirOku() {
  try {
    const v = localStorage.getItem(SEHIR_KEY);
    return v && String(v).trim() ? String(v) : null;
  } catch (e) { return null; /* localStorage okunamadi (gizli mod): sehir secilmemis sayilir, TUM marketler gosterilir */ }
}

function sehirSec(il) {
  try {
    if (il && String(il).trim()) localStorage.setItem(SEHIR_KEY, String(il));
    else localStorage.removeItem(SEHIR_KEY);
  } catch (e) { /* localStorage kapaliysa sessizce gec */ }
}

// null  = filtre YOK (şehir seçilmemiş ya da o il haritada yok)
// Set   = o ilde bulunan zincirler
function ilMarketleri() {
  const il = sehirOku();
  if (!il) return null;
  const harita = (_ilMarketCache && _ilMarketCache.iller) || null;
  if (!harita) return null;
  const kayit = harita[il];
  if (!kayit || !Array.isArray(kayit.marketler) || !kayit.marketler.length) return null;
  return new Set(kayit.marketler);
}

// Tek karar noktası. Şehir seçili değilse HER ZAMAN true — hiçbir şey gizlenmez.
function marketVarMi(m) {
  const s = ilMarketleri();
  if (!s) return true;
  return s.has(m);
}

function sehirPillleriUygula() {
  if (typeof document === 'undefined') return;
  document.querySelectorAll('.filter-pill[data-market]').forEach(p => {
    const m = p.getAttribute('data-market');
    if (!m || m === 'all') return;
    p.style.display = marketVarMi(m) ? '' : 'none';
  });
}

function sehirDegisti(il) {
  sehirSec(il);
  const s = ilMarketleri();
  // Seçili markette artık bulunmayan zincirler tercihten düşsün.
  if (s) {
    try {
      const eski = JSON.parse(localStorage.getItem(TERCIH_MKT_KEY) || '[]');
      const yeni = (Array.isArray(eski) ? eski : []).filter(x => s.has(x));
      if (yeni.length !== (eski || []).length) localStorage.setItem(TERCIH_MKT_KEY, JSON.stringify(yeni));
    } catch (e) { /* localStorage tercih temizligi basarisiz: sehirde olmayan market secili kalir, marketVarMi zaten sizdirmiyor */ }
  }
  sehirPillleriUygula();
  if (typeof profilBolumleriCiz === 'function') profilBolumleriCiz();
  if (typeof renderSepet === 'function' && document.getElementById('screen-sepet') &&
      document.getElementById('screen-sepet').style.display !== 'none') renderSepet();
}

function profilSehirHTML() {
  const secili = sehirOku();
  const harita = (_ilMarketCache && _ilMarketCache.iller) || {};
  const iller = Object.keys(harita).sort((a, b) => a.localeCompare(b, 'tr'));
  const secenekler = ['<option value="">Seçilmedi</option>']
    .concat(iller.map(i => `<option value="${i}"${i === secili ? ' selected' : ''}>${i}</option>`))
    .join('');
  const s = ilMarketleri();
  const eksik = s ? Object.keys(MARKET_NAMES).filter(m => !s.has(m)) : [];
  const not = !secili
    ? 'Şehrini seçersen o ilde bulunmayan marketler gizlenir'
    : (eksik.length
        ? `${eksik.map(m => MARKET_NAMES[m]).join(' ve ')} senin ilinde bulunmuyor`
        : 'Bu ildeki tüm marketler gösteriliyor');
  return `<div class="profil-sehir">
      <select class="profil-sehir-select" aria-label="Şehir seç" onchange="sehirDegisti(this.value)">${secenekler}</select>
      <div class="profil-sehir-not">${not}</div>
    </div>`;
}

// Açılışta bir kez çek. Gelene kadar ilMarketleri() null döner ve hiçbir şey
// filtrelenmez — güvenli varsayılan, yanlışlıkla market gizlenmez.
ilMarketVeriGetir().then(() => {
  sehirPillleriUygula();
  const p = typeof document !== 'undefined' && document.getElementById('screen-profil');
  if (p && p.style.display !== 'none' && typeof profilBolumleriCiz === 'function') profilBolumleriCiz();
});

// E) Tercih edilen marketler — localStorage, DB'ye yazılmaz.
const TERCIH_MKT_KEY = 'pazar_tercih_marketler';
function tercihMarketleriOku() {
  try {
    const v = JSON.parse(localStorage.getItem(TERCIH_MKT_KEY) || '[]');
    // marketVarMi: sehir degistiyse eski secimdeki olmayan zincir dısarıda kalır.
    return Array.isArray(v) ? v.filter(x => MARKET_NAMES[x] && marketVarMi(x)) : [];
  } catch (e) { return []; /* localStorage okunamadi (gizli mod): market tercihi bos sayilir, filtre uygulanmaz */ }
}
function tercihMarketToggle(m) {
  if (!MARKET_NAMES[m]) return;
  const s = tercihMarketleriOku();
  const i = s.indexOf(m);
  if (i >= 0) s.splice(i, 1); else s.push(m);
  localStorage.setItem(TERCIH_MKT_KEY, JSON.stringify(s));
  const el = typeof document !== 'undefined' && document.getElementById('profil-market-tercih-govde');
  if (el) el.innerHTML = profilMarketTercihHTML();
}
function profilMarketTercihHTML() {
  const secili = tercihMarketleriOku();
  const gorunur = Object.keys(MARKET_NAMES).filter(m => marketVarMi(m));
  const gizli = Object.keys(MARKET_NAMES).filter(m => !marketVarMi(m));
  const pills = gorunur.map(m =>
    `<button type="button" class="profil-mkt-pill${secili.includes(m) ? ' active' : ''}" aria-pressed="${secili.includes(m)}" data-mkt="${_kacir(m)}" onclick="tercihMarketToggle(this.dataset.mkt)">${MARKET_NAMES[m]}</button>`
  ).join('');
  const not = secili.length
    ? `${secili.length} market seçili — kategori ekranı bunlarla açılır`
    : 'Seçim yaparsan kategori ekranı bu marketlerle açılır';
  // Gizlenen zincirlerin aciklamasi BU BOLUMDE TEKRARLANMIYOR: "Şehrim" bolumu
  // hemen ustte ayni cumleyi yaziyor (masaustunde 129px, mobilde ~100px ara,
  // ikisi de ayni sutunda). Ayni cumleyi iki kez basmak gurultu.
  return `<div class="profil-mkt-pills">${pills}</div><div class="profil-mkt-not">${not}</div>`;
}

// Bölümleri DOM'a bas. Veri yoksa bölümün tamamı (başlık dahil) gizlenir.
function profilBolumleriCiz() {
  // Sepet enflasyonu geçmişten hesaplanıyor (_otuzGunOncekiEnUcuz). Ana sayfa
  // geçmişi indirmediği için burada tetikleniyor; gelince bölüm yenileniyor.
  // GÖRÜNÜRLÜK ŞARTI ŞART: bu fonksiyon açılışta da çağrılıyor (ekran gizliyken
  // profil bölümlerini hazırlamak için). Şartsız bırakınca 4,2 MB geçmiş her
  // sayfa açılışında iniyordu — ölçümde yakalandı.
  if (_ekranGorunur('screen-profil')) {
    gecmisGerekli(() => { if (_ekranGorunur('screen-profil')) profilBolumleriCiz(); });
  }
  const yaz = (id, html) => {
    const govde = document.getElementById(id + '-govde');
    const bolum = document.getElementById(id);
    if (!govde || !bolum) return;
    govde.innerHTML = html || '';
    bolum.style.display = html ? '' : 'none';
  };
  yaz('profil-tasarruf', profilTasarrufHTML());
  yaz('profil-enflasyon', profilEnflasyonHTML());
  yaz('profil-sablonlar', profilSablonlarHTML());
  yaz('profil-alarmlar', profilAlarmlarHTML());
  yaz('profil-sehir', profilSehirHTML());
  yaz('profil-market-tercih', profilMarketTercihHTML());
  yaz('profil-katki', profilKatkiHTML(window._profilKatkiSayi));
  const vy = document.getElementById('profilVeriTazelik');
  if (vy) vy.textContent = _profilSonSenkronYazi();
}

function _profilSonSenkronYazi() {
  const t = window._profilSonSenkron;
  if (!t) return 'Her gece 03:00’da güncellenir';
  const d = new Date(t);
  if (isNaN(d.getTime())) return 'Her gece 03:00’da güncellenir';
  const saat = Math.floor((Date.now() - d.getTime()) / 3600000);
  if (saat < 1) return 'Az önce güncellendi';
  if (saat < 24) return saat + ' saat önce güncellendi';
  return Math.floor(saat / 24) + ' gün önce güncellendi';
}

// Katkı sayısı ve son senkron: açılışta tek sefer, sessiz.
async function profilVerileriniYukle() {
  try {
    const { data } = await window.supabaseClient
      .from('urunler').select('son_senkron').order('son_senkron', { ascending: false }).limit(1);
    if (data && data[0]) window._profilSonSenkron = data[0].son_senkron;
  } catch (e) { console.warn('[profil] son_senkron okunamadi, veri tazelik damgasi cikmayacak:', e && e.message); }
  try {
    if (window.pazarAuth && window.pazarAuth.user) {
      const { data, error } = await window.supabaseClient.rpc('get_kendi_bildirim_sayim');
      if (!error && data != null) window._profilKatkiSayi = Number(data) || 0;
    }
  } catch (e) { console.warn('[profil] katki sayisi RPC hatasi, katki bolumu cikmayacak:', e && e.message); }
  if (document.getElementById('screen-profil')) profilBolumleriCiz();
}
document.addEventListener('DOMContentLoaded', profilVerileriniYukle);

async function onbellekTemizle() {
  const onay = await modalAc({
    title: 'Önbelleği temizle',
    msg: 'Kayıtlı veri silinip yeniden indirilecek. Listen, favorilerin ve alarmların etkilenmez.',
    okText: 'Temizle'
  });
  if (!onay) return;
  try {
    if (window.caches) { for (const k of await caches.keys()) await caches.delete(k); }
    if (navigator.serviceWorker) {
      const rs = await navigator.serviceWorker.getRegistrations();
      for (const r of rs) await r.unregister();
    }
  } catch (e) { /* SW kaydi silinemedi: hemen altta location.reload() var, kullanici yine tazelenmis sayfayi alir */ }
  location.reload();
}

function paylasUygulama() {
  const metin = 'Pazar — marketteki gizli zamları gör. 7 marketin günlük fiyatlarını tek ekranda karşılaştır.';
  const url = 'https://pazarapp.net/';
  if (navigator.share) {
    navigator.share({ title: 'Pazar', text: metin, url: url }).catch(() => { /* kullanici paylasim penceresini kapatti veya iptal etti: hata degil, sessiz gecmek DOGRU */ });
    return;
  }
  if (navigator.clipboard) {
    navigator.clipboard.writeText(metin + ' ' + url)
      .then(() => modalAc({ title: 'Kopyalandı', msg: 'Bağlantı panoya kopyalandı.', okText: 'Tamam', tekButon: true }))
      .catch(() => { /* kullanici paylasim penceresini kapatti veya iptal etti: hata degil, sessiz gecmek DOGRU */ });
  }
}

function profilSablonSil(id) {
  sablonSil(id);
  profilBolumleriCiz();
  if (typeof renderSablonBar === 'function') renderSablonBar();
}

async function profilAlarmKaldir(sid) {
  if (typeof window.fiyatAlarmKaldir === 'function') await window.fiyatAlarmKaldir(sid);
  profilBolumleriCiz();
}

function profilGuncelle() {
  const sepetSayi = sepet.length;
  const el = function(id){ return document.getElementById(id); };
  if (el('profilSepetSayi')) el('profilSepetSayi').textContent = sepetSayi;
  if (el('profilSepetOzet')) el('profilSepetOzet').textContent = sepetSayi > 0 ? sepetSayi + ' ürün listemde' : 'Liste boş';
  if (el('profilToplamUrun')) {
    window.supabaseClient.from('urunler')
      .select('*', { count: 'exact', head: true })
      .then(function(res) {
        if (el('profilToplamUrun')) el('profilToplamUrun').textContent = (res.count || 0).toLocaleString('tr-TR');
      });
  }
  if (el('profilHalSayi') && window.halVerisi && window.halVerisi.urunler) {
    el('profilHalSayi').textContent = window.halVerisi.urunler.length;
  }
  if (el('profilSonGuncelleme') && window.halVerisi) {
    el('profilSonGuncelleme').textContent = 'Son güncelleme: ' + (window.halVerisi.cekme_tarihi || 'Her gece 03:00').slice(0,10);
  }
  profilBolumleriCiz();
  const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
  const toggle = el('temaToggleBtn');
  if (toggle) { toggle.className = 'profil-toggle' + (isDark ? ' on' : ''); }
  if (el('temaDurum')) el('temaDurum').textContent = isDark ? 'Koyu tema aktif' : 'Açık tema aktif';
  refreshThemeSwitch();
}

function temaToggle() {
  const root = document.documentElement;
  const isDark = root.getAttribute('data-theme') !== 'light';
  root.setAttribute('data-theme', isDark ? 'light' : 'dark');
  try { localStorage.setItem('pazar_theme', isDark ? 'light' : 'dark'); } catch(e){ /* localStorage yazilamadi (gizli mod/kota): tema bu oturumda calisir, kalici olmaz */ }
  profilGuncelle();
}

function setTheme(val) {
  try { localStorage.setItem('pazar_theme', val); } catch(e){ /* localStorage yazilamadi (gizli mod/kota): tema bu oturumda calisir, kalici olmaz */ }
  applyTheme();
  refreshThemeSwitch();
}
function applyTheme() {
  var saved = 'auto';
  try { saved = localStorage.getItem('pazar_theme') || 'auto'; } catch(e){ /* localStorage okunamadi: 'auto' varsayilani zaten atanmis, tema yine dogru cizilir */ }
  var dark = saved === 'dark' || (saved === 'auto' && window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
}
function refreshThemeSwitch() {
  var cur = 'auto';
  try { cur = localStorage.getItem('pazar_theme') || 'auto'; } catch(e){ /* localStorage okunamadi: 'auto' varsayilani zaten atanmis, anahtar dogru konumda kalir */ }
  document.querySelectorAll('.theme-opt').forEach(function(b){
    b.classList.toggle('aktif', b.dataset.themeVal === cur);
  });
}

function firsatSepetEkle(btn, id) {
  try { id = decodeURIComponent(escape(atob(id))); } catch(e) { /* id base64 degil, duz metin: asagidaki productMap aramasi ham id ile zaten calisiyor */ }
  var u = null;
  if (productMap[id]) {
    u = productMap[id];
  } else {
    var tumListeler = [window.yuklenenUrunler];
    for (var i = 0; i < tumListeler.length; i++) {
      if (!tumListeler[i]) continue;
      var bulunan = tumListeler[i].find(function(x){ return x._id === id; });
      if (bulunan) { u = bulunan; break; }
    }
  }
  if (!u) { btn.textContent = '?'; return; }
  var zatenVar = sepet.some(function(s){ return s._id === id; });
  if (zatenVar) {
    sepet = sepet.filter(function(s){ return s._id !== id; });
    btn.textContent = '+';
    btn.style.background = '';
  } else {
    sepet.push({
      _id: u._id, ad: u.ad, resim: u.resim,
      agirlik_hacim: u.agirlik_hacim, ana_kategori: u.ana_kategori,
      market_fiyatlari: u.market_fiyatlari
    });
    btn.textContent = '✓';
    btn.style.background = '#059669';
  }
  saveSepet();
  var sc = document.getElementById('sepetCount');
  if (sc) sc.textContent = sepet.length;
}

function halArama() {
  const q = document.getElementById('halSearch').value.toLowerCase().trim();
  document.querySelectorAll('#halList .hal-grid-card').forEach(c => {
    const name = c.querySelector('div:nth-child(2) div:first-child').textContent.toLowerCase();
    c.style.display = name.includes(q) ? '' : 'none';
  });
}

loadData();

// ?screen= ile derin bağlantı. Ekranı doğrudan showScreen ile açmak yetmiyor —
// her ekranın kendi açıcısı önce veriyi basıyor (renderSepet gibi), o yüzden
// açıcı fonksiyon varsa o çağrılır. Bilinmeyen değer sessizce Ana Sayfa'ya düşer.
// manifest.json kısayolları list/firsat/hal kullanıyor, o adlar KORUNDU.
function ekranRotasiUygula() {
  var sorgu = new URLSearchParams(location.search);
  var ekran = String(sorgu.get('screen') || '').toLowerCase().trim();
  var rota = {
    'home':      function () { showScreen('screen-home'); },
    'anasayfa':  function () { showScreen('screen-home'); },
    'list':      function () { goSepet(); },
    'listem':    function () { goSepet(); },
    'sepet':     function () { goSepet(); },
    'firsat':    function () { goFirsatlar(); },
    'firsatlar': function () { goFirsatlar(); },
    'profil':    function () { goProfil(); },
    'favori':    function () { window.openFavoriler(); },
    'favoriler': function () { window.openFavoriler(); },
    'hal':       function () { openHalScreen(); },
    // Hub kategori sayfasından (/kategori/<slug>/) uygulamaya dönüş yolu.
    // SLUG NORMALLEŞTİRME YOK — ve bu bilinçli. Hub sayfalarını üreten
    // scripts/hub-uret.mjs, yolları TAM OLARAK bu KATEGORILER dizisinin slug
    // alanından kuruyor (/kategori/${k.slug}/), yani iki taraf aynı kaynaktan
    // besleniyor ve ölçümle doğrulandı: 8 slug birebir aynı (test_routing_
    // duzen.mjs "HUB SLUG PARITESI"). Burada kendi başına bir dönüştürme
    // (alt çizgi↔tire gibi) yazmak o tekliği bozar ve linki "çalışır görünüp
    // yanlış ekrana düşen" hale getirir — Görev 4'te bir kez yaşandı.
    // Tanınmayan kat, bilinmeyen screen ile AYNI davranışa düşüyor: sessizce
    // Ana Sayfa. Kapının burada olması şart, çünkü openCategory tanımsız
    // slug'da kat.label okurken hata atar.
    'kategori':  function () {
      var kat = String(sorgu.get('kat') || '').toLowerCase().trim();
      var bulundu = KATEGORILER.some(function (k) { return k.slug === kat; });
      if (!bulundu) { showScreen('screen-home'); return; }
      openCategory(kat);
    }
  };
  var hedef = rota[ekran];
  if (!hedef) { showScreen('screen-home'); return; }
  // Favoriler oturuma bağlı. Bu fonksiyon script sonunda senkron koşuyor, oturum
  // ise Supabase'den asenkron geri geliyor; erken çağrılırsa openFavoriler auth
  // kapısından dönüp ekranı hiç açmıyor. Auth hazır değilse bir kez bekle.
  var authGerekli = { favori: 1, favoriler: 1 };
  if (authGerekli[ekran] && !(window.pazarAuth && window.pazarAuth.ready)) {
    document.addEventListener('pazarAuthReady', function () { hedef(); }, { once: true });
    return;
  }
  hedef();
}
ekranRotasiUygula();

// ── BADGE INIT ────────────────────────────────────────
window.addEventListener('load', function() {
  sepet = JSON.parse(localStorage.getItem('pazar_sepet') || '[]');
  saveSepet();
});

// ── SERVICE WORKER ────────────────────────────────────
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js');
  let _swUpdateTimer = null;
  navigator.serviceWorker.addEventListener('message', event => {
    if (event.data?.type !== 'DATA_UPDATED') return;
    clearTimeout(_swUpdateTimer);
    _swUpdateTimer = setTimeout(() => loadData(), 300);
  });
}

if (window.matchMedia) {
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function(){ applyTheme(); });
}

(function() {
  var deferredPrompt = null;
  var DISMISS_KEY = 'pazar_install_dismissed_v1';
  var _installBannerGosterildiMi = false;

  function isStandalone() {
    return window.matchMedia('(display-mode: standalone)').matches ||
           window.navigator.standalone === true;
  }
  function isIOSSafari() {
    var ua = navigator.userAgent;
    return /iPad|iPhone|iPod/.test(ua) && !window.MSStream && /Safari/.test(ua) && !/CriOS|FxiOS/.test(ua);
  }
  function dismissed() {
    try {
      var t = localStorage.getItem(DISMISS_KEY);
      if (!t) return false;
      var gecenGun = (Date.now() - parseInt(t, 10)) / (1000 * 60 * 60 * 24);
      return gecenGun < 14;
    } catch(e) { return false; /* localStorage okunamadi: banner kapatilmamis sayilir, tekrar gosterilir */ }
  }

  window.installPWA = function() {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then(function(){ deferredPrompt = null; hideInstallBanner(); });
    } else if (isIOSSafari()) {
      document.getElementById('install-banner-sub').textContent = 'Paylaş düğmesine bas → "Ana Ekrana Ekle"';
      document.getElementById('install-banner-btn').textContent = 'Tamam';
      document.getElementById('install-banner-btn').onclick = hideInstallBanner;
    }
  };
  window.dismissInstall = function() {
    try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch(e){ /* localStorage yazilamadi: banner bu oturumda kapali kalir, bir dahakine tekrar cikar */ }
    hideInstallBanner();
  };
  function showInstallBanner() {
    document.getElementById('install-banner').classList.add('show');
  }
  function hideInstallBanner() {
    document.getElementById('install-banner').classList.remove('show');
  }

  window.installBannerGosterDene = function() {
    if (_installBannerGosterildiMi || dismissed() || isStandalone()) return;
    if (deferredPrompt || isIOSSafari()) {
      _installBannerGosterildiMi = true;
      showInstallBanner();
    }
  };

  window.addEventListener('beforeinstallprompt', function(e) {
    e.preventDefault();
    deferredPrompt = e;
    setTimeout(window.installBannerGosterDene, 30000);
  });

  window.addEventListener('load', function() {
    setTimeout(window.installBannerGosterDene, 30000);
  });

  window.addEventListener('appinstalled', function() {
    hideInstallBanner();
    try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch(e){ /* localStorage yazilamadi: banner bu oturumda kapali kalir, bir dahakine tekrar cikar */ }
  });
})();
  (function(){
    document.addEventListener('click', function(e){
      var btn = e.target.closest('.nav-btn');
      if (!btn) return;
      var icon = btn.querySelector('svg, img, .nav-icon');
      if (!icon) return;
      icon.classList.remove('pulsing');
      void icon.offsetWidth;
      icon.classList.add('pulsing');
      setTimeout(function(){ icon.classList.remove('pulsing'); }, 320);
    }, true);
    })();
  document.addEventListener('DOMContentLoaded', uygulaKullaniciAdi);

function _injectProfilIkonlari() {
  document.querySelectorAll('.profil-item-icon[data-lc]').forEach(function(el) {
    var name = el.getAttribute('data-lc');
    if (name) el.innerHTML = lcIcon(name);
  });
}
document.addEventListener('DOMContentLoaded', _injectProfilIkonlari);

function _injectStripIkonlari() {
  const t1 = document.querySelector('#home-tuzaklar .home-strip-title');
  if (t1 && t1.textContent.includes('Bugün yakaladığımız')) t1.innerHTML = lcIcon('alert-triangle','lc-icon lc-icon-lg') + ' Bugün yakaladığımız tuzaklar';
  const t2 = document.querySelector('#home-dusenler .home-strip-title');
  if (t2 && t2.textContent.includes('Bu hafta düşenler')) t2.innerHTML = lcIcon('trending-down','lc-icon lc-icon-lg') + ' Bu hafta düşenler';
  const t3 = document.querySelector('#home-mevsim .home-strip-title');
  if (t3 && t3.textContent.includes('Bu hafta mevsiminde')) t3.innerHTML = lcIcon('leaf','lc-icon lc-icon-lg') + ' Bu hafta mevsiminde';
  // Diğer bölüm başlıklarıyla aynı ağırlık; sadece ikon amber.
  const t4 = document.querySelector('#home-supheli .home-strip-title');
  if (t4 && t4.textContent.includes('Bu indirimlere dikkat')) t4.innerHTML = lcIcon('alert-triangle','lc-icon lc-icon-lg lc-amber') + ' Bu indirimlere dikkat';
  const ft = document.querySelector('.firsat-tab[onclick*="ucuz"]');
  if (ft && ft.textContent.includes('En Ucuz')) ft.innerHTML = lcIcon('coins') + ' En Ucuz';
  // Hal mini button ikon
  document.querySelectorAll('.hal-mini-icon[data-lc]').forEach(el => {
    el.innerHTML = lcIcon(el.getAttribute('data-lc'), 'lc-icon lc-icon-lg');
  });
  // En Tasarruflu tab
  const ft2 = document.querySelector('.firsat-tab[onclick*="tasarruf"]');
  if (ft2 && ft2.textContent.includes('En Tasarruflu')) ft2.innerHTML = lcIcon('heart') + ' En Tasarruflu';
  // mf-ara-btn ilk render
  const mfBtn = document.getElementById('mf-ara-btn');
  if (mfBtn && !mfBtn.querySelector('svg')) mfBtn.innerHTML = lcIcon('search') + ' marketfiyati.org.tr\'de ara';
}
document.addEventListener('DOMContentLoaded', _injectStripIkonlari);

function _offlineBannerGuncelle() {
  const el = document.getElementById('offline-banner');
  if (!el) return;
  el.classList.toggle('show', !navigator.onLine);
}
window.addEventListener('online', _offlineBannerGuncelle);
window.addEventListener('offline', _offlineBannerGuncelle);
document.addEventListener('DOMContentLoaded', _offlineBannerGuncelle);
if (document.readyState !== 'loading') _offlineBannerGuncelle();

async function bultenDurumGuncelle() {
  const el = document.getElementById('bultenDurumYazi');
  if (!el) return;
  const user = window.pazarAuth?.user;
  if (!user) { el.textContent = 'Düşen fiyatlar ve şüpheli indirimler, e-posta ile'; return; }
  try {
    const { data, error } = await window.supabaseClient.from('bulten_abonelik').select('aktif_mi').eq('user_id', user.id).maybeSingle();
    if (error) { el.textContent = 'Düşen fiyatlar ve şüpheli indirimler, e-posta ile'; return; }
    el.textContent = (data && data.aktif_mi) ? 'Açık ✓' : 'Düşen fiyatlar ve şüpheli indirimler, e-posta ile';
  } catch (e) { /* abonelik durumu okunamadi: altta notr aciklama metni yaziliyor, buton yine calisiyor */ el.textContent = 'Düşen fiyatlar ve şüpheli indirimler, e-posta ile'; }
}

window.bultenAbonelikToggle = async function() {
  const user = window.pazarAuth?.user;
  if (!user) {
    if (typeof window.openAuthSheet === 'function') window.openAuthSheet('login');
    return;
  }
  const el = document.getElementById('bultenDurumYazi');
  try {
    const { data: mevcut } = await window.supabaseClient.from('bulten_abonelik').select('aktif_mi').eq('user_id', user.id).maybeSingle();
    const yeniDurum = !(mevcut && mevcut.aktif_mi);
    const { error } = await window.supabaseClient.from('bulten_abonelik').upsert({ user_id: user.id, aktif_mi: yeniDurum }, { onConflict: 'user_id' });
    if (error) { console.warn('Bulten abonelik hatasi:', error.message); return; }
    if (el) el.textContent = yeniDurum ? 'Açık ✓' : 'Düşen fiyatlar ve şüpheli indirimler, e-posta ile';
    if (typeof toastGoster === 'function') toastGoster(yeniDurum ? 'Bülten açıldı' : 'Bülten kapatıldı');
  } catch (e) { console.warn('Bulten abonelik hatasi:', e); }
};

document.addEventListener('pazarAuthReady', bultenDurumGuncelle);
document.addEventListener('pazarAuthChange', bultenDurumGuncelle);
