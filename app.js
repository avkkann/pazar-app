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

  (function(){
    setTimeout(function(){
      var s = document.getElementById('splash');
      if (s) {
        s.classList.add('gizle');
        setTimeout(function(){ if (s) s.style.display = 'none'; }, 250);
      }
      setTimeout(onboardingBaslat, 250);
    }, 600);
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
    } catch (err) {
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
    } catch (e) { /* sessiz */ }
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
    return `<button class="fav-btn${isFav ? ' is-fav' : ''}" data-sid="${sid}" aria-pressed="${isFav ? 'true' : 'false'}" aria-label="Favoriye ekle" onclick="event.stopPropagation(); favToggle('${sid}', this)"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg></button>`;
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
      } catch(e) {}
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
    } catch (e) { el.textContent = 'Alarm kurduğun ürünler için haber al'; }
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
const KAT_EMOJI = {
  meyve:'🍎', sebze:'🥦', et:'🥩', sut:'🧀',
  gida:'🥫', icecek:'🥤', temizlik:'🧴', atistirmalik:'🍫', dondurulmus:'🧊', diger:'📦'
};
const KATEGORILER = [
  { slug:'meyve-sebze', label:'Meyve & Sebze', emoji:'🍎', img:'static/cat/meyve-sebze.png', file:'urunler_meyve' },
  { slug:'et',          label:'Et & Tavuk',    emoji:'🥩', img:'static/cat/et.png',          file:'urunler_et'    },
  { slug:'sut',         label:'Süt & Kahvaltı',emoji:'🧀', img:'static/cat/sut.png',         file:'urunler_sut'   },
  { slug:'gida',        label:'Temel Gıda',    emoji:'🥫', img:'static/cat/gida.png',        file:'urunler_gida'  },
  { slug:'icecek',      label:'İçecek',        emoji:'🥤', img:'static/cat/icecek.png',      file:'urunler_icecek'},
  { slug:'temizlik',    label:'Temizlik',       emoji:'🧴', img:'static/cat/temizlik.png',    file:'urunler_temizlik'},
  { slug:'atistirmalik',label:'Atıştırmalık',   emoji:'🍫', img:'static/cat/atistirmalik.png',file:'urunler_atistirmalik'},
  { slug:'dondurulmus', label:'Dondurulmuş',    emoji:'🧊', img:'static/cat/dondurulmus.png', file:'urunler_dondurulmus'},
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
    const sid = s.id.replace(/'/g, "\\'");
    const adSafe = (_sablonDisplayAd(s.ad) || 'Şablon').replace(/</g,'&lt;').replace(/"/g,'&quot;');
    html += '<span class="sablon-chip" '
         + 'onclick="sablonYukleUI(\'' + sid + '\')" '
         + 'oncontextmenu="event.preventDefault();sablonDuzenleUI(\'' + sid + '\');return false;" '
         + 'title="Tıkla: yükle | Sağ tık / uzun bas: düzenle">'
         + adSafe
         + ' <button class="sablon-chip-del" onclick="event.stopPropagation();sablonSilUI(\'' + sid + '\')" title="Sil">×</button>'
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
    } catch (e) {
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
    } catch (e) {
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

  const temiz    = fiyatlariTemizle(u.market_fiyatlari);
  const mktler   = temiz.gecerli.slice().sort((a, b) => a.fiyat - b.fiyat);
  const emoji    = KAT_EMOJI[ustKategori(u.ana_kategori)] || '📦';
  const imgHtml  = u.resim
    ? `<img src="${u.resim}" alt="" loading="lazy" onerror="this.onerror=null;this.parentElement.innerHTML='<div style=\'width:100%;height:120px;background:#f8f8f8;display:flex;align-items:center;justify-content:center;font-size:3rem\'>${emoji}</div>'">`
    : emoji;



  const mktRows = mktler.map((f, i) => {
    const isFirst = i === 0, isLast = i === mktler.length - 1 && mktler.length > 1;
    return `<div class="detay-mkt-row${isFirst ? ' best' : isLast ? ' worst' : ''}">
      <span class="m-tag m-${f.market || 'default'}">${MARKET_NAMES[f.market] || f.market || '?'}</span>
      <span class="detay-mkt-price">${tlHTML(f.fiyat)}${isLast ? '<span class="detay-mkt-badge">en pahalı</span>' : ''}</span>
    </div>${bildirimUyariHTML(u._sid, f.market)}`;
  }).join('');

  const inCart = sepet.some(s => s._id === urunId);
  const btnHtml = `<button id="detayEkleBtn" class="detay-btn-ekle${inCart ? ' added' : ''}"
    onclick="toggleSepet('${u._id}'); renderDetayBtn('${u._id}')">
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
      <div class="detay-name">${u.ad}</div>
      ${u.agirlik_hacim ? `<div class="detay-unit">${u.agirlik_hacim}</div>` : ''}
      ${tazelikChipHTML(u)}
    </div>
    ${(() => { const bf = birimFiyatHesapla(u); return bf ? `<div class="detay-birim-fiyat">${birimFiyatYazi(bf)}</div>` : ''; })()}
    ${(() => { const rz = tuzakRozetiHesapla(u); return rz ? tuzakRozetiHTML(rz, false) : ''; })()}
    ${urunRozetleriHTML(u, false)}
    <div class="detay-section detay-section--market">
      <div class="detay-sec-label">Market Fiyatları</div>
      <div class="detay-mkt-list">
        ${mktRows || '<div style="padding:12px 14px;font-size:.82rem;color:var(--text-muted)">Market verisi yok</div>'}
      </div>
      ${_gizlenenFiyatHTML(temiz)}
    </div>
    </div>
    <div class="detay-sag">
    ${fiyatGecmisiBlogu(u)}
    ${fiyatAlarmiBlogu(u)}
    ${btnHtml}
    ${_bildirimYetkiVar ? `<button type="button" class="fiyat-bildir-btn" onclick="fiyatBildirAc('${u._id}')"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>Bu fiyat tutmadı</button>` : ''}
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

// ── HAL EŞLEŞME — akıllı sistem ──────────────────────
// Kural 1: Sadece taze sebze/meyve kategorisi eşleşir
// Kural 2: Dondurulmuş/konserve/işlenmiş ürünler eşleşmez
// Kural 3: Birim normalleştirme (1 adet ≈ 0.2kg, 500gr = 0.5 oran)
// Kural 4: Minimum %60 kelime örtüşmesi gerekir

const HAL_UYUMSUZ = ['donuk','dondurulmus','dondurulmuş','dondurma','konserve','hazir','islenmis',
  'salca','tursu','kurutulmus','fileto','salam','sucuk','sosis','pastirma',
  'corba','pure','püre','cipsi','cips','nugget','kroket','burger','superfresh',
  'pack','paket','kutu','sis','rulo','dilim','mince','frozen',
  'recel','reçel','marmelat','meyve suyu','suyu','nektar','smoothie',
  'sirup','şurup','surup','komposto','kompoto','suzme','sikma','sıkma',
  'dondurmasi','dondurmali','dondurmalı','tatlandirici','aromali','aromalı',
  'feast','tukas','tukaş','garden','migrosone','tat','penguen',
  'lapestos','yagi','yağı'];

function halKgHesapla(ad, fiyat) {
  if (!fiyat || !ad) return fiyat;
  const n = ad.toLowerCase();
  // "500 gr", "500gr", "0.5 kg" gibi ağırlık ifadelerini bul
  const grMatch = n.match(/(\d+(?:[.,]\d+)?)\s*gr\b/);
  const kgMatch = n.match(/(\d+(?:[.,]\d+)?)\s*kg\b/);
  const adetMatch = n.match(/(\d+)\s*adet\b/);
  if (grMatch) {
    const gr = parseFloat(grMatch[1].replace(',', '.'));
    if (gr > 0 && gr < 5000) return fiyat / (gr / 1000); // kg fiyatına çevir
  }
  if (kgMatch) {
    const kg = parseFloat(kgMatch[1].replace(',', '.'));
    if (kg > 0 && kg < 50) return fiyat / kg; // kg fiyatına çevir
  }
  if (adetMatch) {
    // 1 adet ≈ 0.2kg ortalama (avokado, limon vb.)
    return fiyat / 0.2;
  }
  return fiyat; // birim yoksa olduğu gibi bırak (zaten kg fiyatı)
}

function halEsles(u) {
  // Sadece taze meyve/sebze kategorileri için çalış
  const kat = ustKategori(u.ana_kategori || '');
  if (kat !== 'meyve' && kat !== 'sebze') return null;

  const urunAdNorm = norm(u.ad);

  // Dondurulmuş/işlenmiş ürünleri atla
  if (HAL_UYUMSUZ.some(k => urunAdNorm.includes(k))) return null;

  // "Adet" birimi var → birim belirsizliği büyük (1 ananas != 1 limon), hal ile eşleşmesin
  if (/\b\d+\s*adet\b/.test(urunAdNorm)) return null;

  // Market ürün adından ağırlık/birim bilgisini temizle, ana kelimeyi al
  const temizAd = urunAdNorm
    .replace(/\d+([.,]\d+)?\s*(gr|kg|ml|lt|adet|pk|paket)\b/g, '')
    .replace(/\b(taze|gunluk|gunluk|organik|dogal|ithal|yerli|sele|demet|bag)\b/g, '')
    .trim();

  const mW = temizAd.split(/\s+/).filter(w => w.length > 2);
  if (!mW.length) return null;

  let best = null, bestSc = 0;

  for (const [key, rec] of Object.entries(halMap)) {
    const hW = key.split(/\s+/).filter(w => w.length > 2);
    if (!hW.length) continue;

    const eslesenW = hW.filter(w => mW.includes(w)).length;
    // Hal adındaki tüm kelimeler market adında varsa tam eşleşme say
    // Örn: hal="patates", market="kizartmalik patates" → 1/1 = 1.0
    const sc = eslesenW / Math.max(hW.length, mW.length);
    const scHalBazli = eslesenW / hW.length; // hal kelimelerinin market'te kapsanma oranı

    const finalSc = Math.max(sc, scHalBazli >= 1.0 ? 0.9 : 0);

    if (finalSc > bestSc) { bestSc = finalSc; best = rec; }
  }

  if (bestSc < 0.6 || !best) return null;

  // Fiyat mantık kontrolü: hal/market oranı 0.1x - 5x arasında olmalı
  const marketKgFiyat = halKgHesapla(u.ad, u.en_dusuk_fiyat);
  if (marketKgFiyat && best.fiyat) {
    const oran = best.fiyat / marketKgFiyat;
    if (oran > 5 || oran < 0.1) return null; // saçma oran → eşleşmeyi iptal et
  }

  return best;
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

async function loadCat(slug) {
  if (catCache[slug]) return catCache[slug];
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

function birimFiyatHesapla(u) {
  if (!u) return null;
  const fiyat = enDusukFiyat(u);
  if (!fiyat || fiyat <= 0) return null;
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

function fiyatAlarmiBlogu(u) {
  const sid = u && u._sid;
  if (!sid) return '';
  const aktifHedef = window.pazarAlarmMap ? window.pazarAlarmMap.get(sid) : null;
  if (aktifHedef != null) {
    return `<div class="detay-section detay-section--alarm" id="alarmBlogu-${sid}">
      <div class="detay-sec-label">Fiyat Alarmı</div>
      <div class="alarm-box alarm-active">
        <div class="alarm-active-text">${tl(aktifHedef)}'nin altına düşünce haber vereceğiz</div>
        <button class="alarm-kaldir-btn" onclick="fiyatAlarmKaldir('${sid}')">Kaldır</button>
      </div>
    </div>`;
  }
  const enDusuk = enDusukFiyat(u);
  const oneri = enDusuk ? (enDusuk * 0.95).toFixed(2) : '';
  return `<div class="detay-section detay-section--alarm" id="alarmBlogu-${sid}">
    <div class="detay-sec-label">Fiyat Alarmı</div>
    <div class="alarm-box">
      <input type="number" inputmode="decimal" step="0.01" min="0.01" class="alarm-input" id="alarmInput-${sid}" placeholder="Hedef fiyat (₺)" value="${oneri}">
      <button class="alarm-kur-btn" onclick="fiyatAlarmKur('${sid}')">Alarm Kur</button>
    </div>
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
    } catch(e) {
      _gecmisCache = {};
    }
    return _gecmisCache;
  })();
  return _gecmisYukleniyor;
}

gecmisVeriGetir();

function indirimRozetiHesapla(urun) {
  if (!urun || !urun._sid) return null;
  if (!_gecmisCache) return null;
  const kayitlar = _gecmisCache[urun._sid];
  if (!kayitlar || !Array.isArray(kayitlar) || kayitlar.length < 2) return null;

  const bugun = new Date();
  const otuzGunOnce = new Date(bugun);
  otuzGunOnce.setDate(otuzGunOnce.getDate() - 30);
  const limit = otuzGunOnce.toISOString().slice(0, 10);
  const sonAy = kayitlar.filter(k => k && k.t && k.t >= limit);
  if (sonAy.length < 2) return null;

  const zirve = Math.max(...sonAy.map(k => k.f));
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
  } catch (e) {
    return null;
  }
}

function supheliDurum(u) {
  if (!u || !u._sid || !_puanCache) return null;
  const k = _puanCache.get(u._sid);
  if (!k || k.indirim_supheli_puan == null || k.indirim_supheli_puan < 2) return null;
  const sebepler = (k.indirim_supheli_sebepler || [])
    .map(s => String(s).trim())
    .filter(s => SUPHELI_SEBEP_CUMLE[s]);
  const zamansalVar = sebepler.some(s => SUPHELI_ZAMANSAL_SEBEPLER.indexOf(s) >= 0);
  return {
    seviye: (k.indirim_supheli_puan >= 4 && zamansalVar) ? 'kutu' : 'rozet',
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
  if (!_gecmisCache) return null;
  const kayitlar = _gecmisCache[u._sid];
  if (!kayitlar || !Array.isArray(kayitlar) || kayitlar.length < 2) return null;
  const otuzGunOnce = new Date();
  otuzGunOnce.setDate(otuzGunOnce.getDate() - 30);
  const limit = otuzGunOnce.toISOString().slice(0, 10);
  const sonAy = kayitlar.filter(k => k && k.t && k.f != null && k.t >= limit);
  if (sonAy.length < 2) return null;
  const enDusuk = Math.min(...sonAy.map(k => k.f));
  if (u.en_dusuk_fiyat == null || u.en_dusuk_fiyat > enDusuk + 0.005) return null;
  return { yuzde: ir.yuzde };
}

function gercekIndirimRozetiHTML(rozet, kisa) {
  if (!rozet) return '';
  return kisa
    ? `<span class="gercek-indirim-rozet kisa">${lcIcon('leaf')} Gerçek indirim</span>`
    : `<span class="gercek-indirim-rozet">${lcIcon('leaf')} Gerçek indirim · 30 günün en düşüğü</span>`;
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
  const otuzGunOnce = new Date(bugun); otuzGunOnce.setDate(otuzGunOnce.getDate() - 30);
  const limitIso = otuzGunOnce.toISOString().slice(0, 10);
  const son30 = tumKayitlar.filter(k => k && k.t && k.f != null && k.m && k.t >= limitIso);

  // Eligibility: 7+ farklı tarih
  const farkliTarihler = new Set(son30.map(k => k.t));
  if (farkliTarihler.size < 7) {
    return _fgEmptyBlock('Fiyat geçmişi henüz yeterli değil · Birkaç hafta sonra görünür');
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
  let zirveIsareti = '';
  const _sd = typeof supheliDurum === 'function' ? supheliDurum(urun) : null;
  if (_sd && _sd.sebepler.some(s => s === 'kisa_zirve' || s === 'orta_zirve')) {
    const zi = gunler.findIndex(g => g.t === enYuksekGun.t);
    const sonraki = zi >= 0 ? gunler[zi + 1] : null;
    if (sonraki) {
      const sure = _fgGunFarki(enYuksekGun.t, sonraki.t);
      const zx = xFor(enYuksekGun.t), zy = yFor(enYuksekGun.avg);
      // Konumu halka gösterir; yazı üst kenarda ve zirvenin KARŞI tarafında
      // durur. Zirve grafiğin tepesindeyken kendi fiyat etiketi de üst kenara
      // yakın düştüğü için aynı hizaya yazmak çakışma üretiyordu.
      const sagda = zx > (padL + chartW * 0.5);
      zirveIsareti =
        '<circle cx="' + zx.toFixed(1) + '" cy="' + zy.toFixed(1) + '" r="5.5" class="fg-zirve-halka"/>'
        + '<text x="' + (sagda ? padL : (W - padR)) + '" y="9.5" text-anchor="'
        + (sagda ? 'start' : 'end') + '" class="fg-zirve-etiket">Zirve · '
        + sure + ' gün sürdü</text>';
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
  const enUcuz = temiz.reduce((a, b) => a.f < b.f ? a : b);
  const enPahali = temiz.reduce((a, b) => a.f > b.f ? a : b);
  const degisimText = yon === 'sabit'
    ? 'Son 30 günde fiyat <b>sabit</b>'
    : 'Son 30 günde <b>%' + Math.abs(degisim).toFixed(0) + ' ' + yon + '</b>';
  const ozetText = degisimText
    + ' · En ucuz: <b>' + enUcuz.f.toFixed(2).replace('.', ',') + ' ₺</b> (' + _fgTarihFormatla(enUcuz.t) + ', ' + (_FG_MKT_AD[enUcuz.m] || enUcuz.m) + ')'
    + ' · En pahalı: <b>' + enPahali.f.toFixed(2).replace('.', ',') + ' ₺</b> (' + _fgTarihFormatla(enPahali.t) + ', ' + (_FG_MKT_AD[enPahali.m] || enPahali.m) + ')';

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
    + '<div class="fg-altyazi">' + altyaziText + '</div>'
    + '<div class="fg-ozet">' + ozetText + '</div>'
    + '</div>';
}

// Lucide SVG icon helpers — inline (kütüphane yüklemeden)
const _LUCIDE_PATHS = {
  'alert-triangle': '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
  'trending-down': '<polyline points="22 17 13.5 8.5 8.5 13.5 2 7"/><polyline points="16 17 22 17 22 11"/>',
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
  'bell': '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>'
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

function birimFiyatYazi(bf) {
  if (!bf) return '';
  return bf.birim + ' başına ' + tl(bf.deger);
}

// ── AYKIRI FİYAT FİLTRESİ ─────────────────────────────────────────
// Bir markette sehven girilmiş uçuk fiyat, "en pahalı" satırını ve tasarruf
// hesabını bozuyordu. Dönüş: { gecerli: [{market,fiyat}], gizlenen: [{market,fiyat}] }
// Her ikisi de girdi sırasını korur.
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

// ── GİZLENEN FİYAT SATIRI ─────────────────────────────────────────
function _gizlenenFiyatHTML(temiz) {
  const g = temiz.gizlenen;
  if (!g.length) return '';
  const f = temiz.gecerli.map(x => x.fiyat).sort((a, b) => a - b);
  const o = Math.floor(f.length / 2);
  const med = f.length ? (f.length % 2 ? f[o] : (f[o - 1] + f[o]) / 2) : 0;
  const kat = med > 0 ? Math.round(g[0].fiyat / med) : 0;
  const satirlar = g.map(x => `<div class="detay-mkt-row gizli">
      <span class="m-tag m-${x.market || 'default'}">${MARKET_NAMES[x.market] || x.market || '?'}</span>
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
// Açılışta TEK sefer çekilir. RPC yetki hatası verirse (_bildirimYetkiVar
// false kalır) "Bu fiyat tutmadı" butonu hiç gösterilmez — kırık buton yok.
let _fiyatBildirimMap = new Map();
let _bildirimYetkiVar = false;

async function fiyatBildirimleriYukle() {
  try {
    const { data, error } = await window.supabaseClient.rpc('get_fiyat_bildirimleri');
    if (error) return;
    (data || []).forEach(r => {
      const sid = r._sid || r.sid;
      const adet = r.adet != null ? r.adet : (r.sayi != null ? r.sayi : r.count);
      if (sid && r.market) _fiyatBildirimMap.set(sid + '|' + r.market, Number(adet) || 0);
    });
    _bildirimYetkiVar = true;
  } catch (e) { /* sessiz düş */ }
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

function _bildirimMarketSec(el, market) {
  _bildirimSecilenMarket = market;
  Array.from(el.parentElement.querySelectorAll('.bildirim-pill')).forEach(p => {
    const secili = p === el;
    p.classList.toggle('secili', secili);
    p.setAttribute('aria-pressed', String(secili));
  });
}

async function fiyatBildirAc(urunId) {
  const u = productMap[urunId];
  if (!u) return;
  const mktler = fiyatlariTemizle(u.market_fiyatlari).gecerli;
  if (!mktler.length) return;

  _bildirimSecilenMarket = mktler[0].market;
  const pills = mktler.map((f, i) => `<button type="button" class="bildirim-pill${i === 0 ? ' secili' : ''}" aria-pressed="${i === 0}" onclick="_bildirimMarketSec(this, '${f.market}')">${MARKET_NAMES[f.market] || f.market}</button>`).join('');

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

  try {
    const { error } = await window.supabaseClient.from('fiyat_bildirim').insert({
      _sid: u._sid || null,
      market: market,
      gosterilen_fiyat: eslesen ? eslesen.fiyat : null,
      bildirilen_fiyat: bildirilen,
      kullanici_id: (window.pazarAuth && window.pazarAuth.user) ? window.pazarAuth.user.id : null
    });
    if (error) { toastGoster('Bildirim gönderilemedi'); return; }
  } catch (e) {
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
    ? `<img class="product-card-img" src="${u.resim}" alt="" loading="lazy" onerror="this.outerHTML='<div class=\'product-card-img-ph\'>${ph.emoji}</div>'">`
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
  return `<div class="product-card" data-urun-id="${u._id}" data-sid="${u._sid || ''}" data-markets="${(u.market_fiyatlari||[]).map(f=>f.market).join(',')}" onclick="openDetay('${u._id}')" style="cursor:pointer">
    ${favBtnHTML(u._sid)}
    ${img}
    <div class="product-card-body">
      <div class="product-name">${u.ad}</div>
      ${u.agirlik_hacim ? `<div class="product-unit">${u.agirlik_hacim}</div>` : ''}
      ${gosterilenFiyat != null
        ? `<div class="product-price">${tlHTML(gosterilenFiyat)}${marketLbl ? `<span class="product-market-lbl"> · ${marketLbl}</span>` : ''}</div>`
        : `<div class="kart-market-yok">Seçili markette yok</div>`}
      ${(() => { const bf = birimFiyatHesapla(u); return bf ? `<div class="urun-birim-fiyat">${birimFiyatYazi(bf)}</div>` : ''; })()}
      ${(() => { const rz = tuzakRozetiHesapla(u); return rz ? tuzakRozetiHTML(rz, true) : ''; })()}
      ${urunRozetleriHTML(u, true)}
    </div>
    <button class="add-btn" data-pid="${u._id}" onclick="event.stopPropagation(); toggleSepet('${u._id}')" style="${inCart ? 'background:#059669' : ''}">${inCart ? '✓' : '+'}</button>
  </div>`;
}

const TUZAK_CACHE_KEY = 'pazar_tuzaklar_v4';
const TUZAK_CACHE_TTL_MS = 1000 * 60 * 60 * 6;

function _stripKartHTML(u, rozet) {
  const ph = placeholderRenk(ustKategori(u.ana_kategori));
  const img = u.resim
    ? `<img class="strip-card-img" src="${u.resim}" alt="" loading="lazy" onerror="this.outerHTML='<div class=\\'strip-card-img-ph\\'>${ph.emoji}</div>'">`
    : `<div class="strip-card-img-ph">${ph.emoji}</div>`;
  const bf = birimFiyatHesapla(u);
  const bfYazi = bf ? birimFiyatYazi(bf) : (u.en_dusuk_fiyat != null ? tl(u.en_dusuk_fiyat) : '');
  const rozetHTML = rozet
    ? `<div class="strip-card-rozet ${rozet.tip}"><span class="lc-dot ${rozet.tip}"></span>%${rozet.yuzde} pahalı</div>`
    : '';
  return `<div class="strip-card" onclick="openDetay('${u._id}')">
    ${img}
    <div class="strip-card-name">${u.ad}</div>
    <div class="strip-card-sub">${bfYazi}</div>
    ${rozetHTML}
  </div>`;
}

async function renderTuzaklarSeridi() {
  const wrap = document.getElementById('home-tuzaklar');
  const list = document.getElementById('home-tuzaklar-list');
  if (!wrap || !list) return;

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
  } catch(e){}

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
  } catch(e){}
}

function _kartaRozetEkle(html, rozetHTML) {
  if (!rozetHTML) return html;
  const idx = html.lastIndexOf('</div>');
  if (idx === -1) return html + rozetHTML;
  return html.slice(0, idx) + rozetHTML + html.slice(idx);
}

async function renderDusenlerSeridi() {
  const wrap = document.getElementById('home-dusenler');
  const list = document.getElementById('home-dusenler-list');
  if (!wrap || !list) return;

  try {
    const { data, error } = await window.supabaseClient.rpc('get_fiyat_dusenler', { p_limit: 6 });
    if (error || !data || !data.length) { wrap.style.display = 'none'; return; }
    data.forEach(u => {
      if (!u._id) u._id = u.ad + '_' + (u.agirlik_hacim||'');
      productMap[u._id] = u;
    });
    const items = data.map(u => ({ u, r: { tip: u.dusus_yuzde >= 25 ? 'buyuk' : 'normal', yuzde: u.dusus_yuzde } }));
    // RPC _sid döndürüyor, _puanCache _sid ile bakıyor -> burada da çalışıyor.
    // Şüpheliyse "Büyük indirim" yerine şüphe rozeti çıkar.
    list.innerHTML = items.map(x => _kartaRozetEkle(
      _stripKartHTML(x.u, null),
      supheliDurum(x.u) ? supheliRozetHTML() : indirimRozetiHTML(x.r, true)
    )).join('');
    wrap.style.display = '';
  } catch (e) {
    wrap.style.display = 'none';
  }
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
    `<div class="cat-card" onclick="openCategory('${k.slug}')">
      <span class="cat-emoji">${k.emoji}</span>
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
  window.aktifMarketler = [];
  document.querySelectorAll('.filter-pill').forEach(p => {
    const m = p.dataset.market;
    p.classList.toggle('active', m === 'all' || m === 'tumu');
    p.classList.remove('disabled');
    p.style.pointerEvents = '';
    p.style.opacity = '';
  });
  showScreen('screen-cat');
  document.getElementById('screen-cat').scrollTop = 0;
  await loadKategoriSayfasi(slug, 1);
}

function renderUrunler(liste) {
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
        <div class="empty-desc">${marketAdi ? `${marketAdi} için bu aramaya uyan ürün yok` : 'Farklı kelimelerle dene'}</div>
      </div>`;
    } else if (marketAdi) {
      list.innerHTML = `<div class="empty-state">
        <div class="empty-icon">${lcIcon('filter-x')}</div>
        <div class="empty-title">Bu markette ürün yok</div>
        <div class="empty-desc">${marketAdi} için bu kategoride ürün bulunamadı</div>
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
    const adEscaped = ad.replace(/'/g, "\\'");
    const adSafe = ad.replace(/</g, '&lt;');
    html += '<button class="alt-kat-chip ' + (aktif === ad ? 'active' : '')
         + '" onclick="setAltKat(\'' + adEscaped + '\')">' + adSafe + '</button>';
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
  .catch(() => null);
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
  } catch (e) {
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
  out.innerHTML = `<div class="mf-results-title">marketfiyati.org.tr'den canlı sonuçlar</div><div class="mf-results-empty">Aranıyor: <b>${q}</b></div>`;
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
    return `<div class="mf-card" onclick="mfSheetAc(${idx})">
      <div class="mf-market-avatar">${initial}</div>
      <div class="mf-card-info">
        <div class="mf-card-title">${title}</div>
        <div class="mf-card-meta">${meta || (depotName || '')}</div>
      </div>
      <div class="mf-card-right">
        <div class="mf-card-price">${isFinite(price) ? mfTl(price) : ''}</div>
        <div class="mf-card-market">${marketAdi}</div>
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
          imgContainer.innerHTML = `<img src="${url}" alt="" loading="lazy" onerror="this.parentNode.classList.add('fallback'); this.parentNode.innerHTML='${initial || '?'}'">`;
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
        <div class="mf-depot-market">${marketAdi}</div>
        <div class="mf-depot-meta">${depotName}</div>
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
  document.getElementById('home-cats').style.display   = q ? 'none' : '';
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
      ? `<img src="${u.resim}" alt="" loading="lazy" onerror="this.onerror=null;this.parentElement.innerHTML='<div style=\'width:100%;height:120px;background:#f8f8f8;display:flex;align-items:center;justify-content:center;font-size:3rem\'>${emoji}</div>'">`
      : emoji;
    const mktF = (u.market_fiyatlari || []).filter(f => f.fiyat != null).sort((a,b) => a.fiyat - b.fiyat)[0];
    const fiyatStr = mktF
      ? `<div style="text-align:right;color:var(--primary);font-size:.82rem;font-weight:700;flex-shrink:0;margin-right:6px;line-height:1.4">
           ${tlHTML(mktF.fiyat)}<br><span style="font-size:.65rem;font-weight:500">${MARKET_NAMES[mktF.market]||mktF.market||'?'}</span>
         </div>` : '';
    return `<div class="cart-item" onclick="openDetay('${u._id}')" style="cursor:pointer">
      <div class="cart-item-img">${img}</div>
      <div class="cart-item-info">
        <div class="cart-item-name">${u.ad}</div>
        ${u.agirlik_hacim ? `<div class="cart-item-sub">${u.agirlik_hacim}</div>` : ''}
      </div>
      ${fiyatStr}
      <button class="cart-del" onclick="event.stopPropagation(); removeFromSepet('${u._id}')">
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
        <span class="listem-toplam-etiket">Toplam (en ucuz fiyatlar)</span>
        <span style="color:var(--price-color)">${tlHTML(toplam)}</span>
      </div>
      <div class="listem-toplam-aciklama">${marketSayisi} farklı marketten · En ucuz seçenekler için karşılaştır</div>
    </div>
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
    navigator.share({ title: 'Pazar Listem', text: metin }).catch(() => {});
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

function karsilastir() {
  if (!sepet.length) {
    document.getElementById('compareOut').innerHTML = `<div class="state-msg">Listeniz boş.</div>`;
    return;
  }
  const mevcutMarketler = new Set();
  sepet.forEach(u => (u.market_fiyatlari||[]).forEach(f => mevcutMarketler.add(f.market)));
  const mktList = [...mevcutMarketler];
  if (!mktList.length) {
    document.getElementById('compareOut').innerHTML = `<div class="state-msg">Hiç market fiyatı yok.</div>`;
    return;
  }
  msSheetAc(mktList);
}

function msSheetAc(mktList) {
  _msMarkets = mktList.map(m => {
    const adet = sepet.filter(u => (u.market_fiyatlari||[]).some(f => f.market === m && f.fiyat != null)).length;
    const minToplam = sepet.reduce((s, u) => {
      const f = (u.market_fiyatlari||[]).filter(ff => ff.market === m && ff.fiyat != null).sort((a,b) => a.fiyat - b.fiyat)[0];
      return s + (f ? f.fiyat : 0);
    }, 0);
    return { key: m, name: MARKET_SIRALIYE[m] || MARKET_NAMES[m] || m, adet, minToplam };
  });
  _msSecili = _msMarkets.map(x => x.key);

  const listEl = document.getElementById('msList');
  listEl.innerHTML = _msMarkets.map(m => {
    const harf = (m.name || '?').trim().charAt(0).toUpperCase();
    return `<div class="ms-market-row selected" data-mkt="${m.key}" onclick="msSheetToggle('${m.key}', this)">
      <div class="ms-market-avatar">${harf}</div>
      <div class="ms-market-info">
        <div class="ms-market-name">${m.name}</div>
        <div class="ms-market-meta">${m.adet} ürün · ${tl(m.minToplam)}</div>
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
  rowEl.classList.toggle('selected', on);
  msSheetGuncelle();
}

function msSheetGuncelle() {
  const secilenler = _msSecili;
  let total = 0;
  for (const u of sepet) {
    let min = null;
    for (const f of (u.market_fiyatlari || [])) {
      if (f.fiyat == null) continue;
      if (!secilenler.includes(f.market)) continue;
      if (min === null || f.fiyat < min) min = f.fiyat;
    }
    if (min !== null) total += min;
  }
  document.getElementById('msSheetTotal').textContent = tl(total);
  const n = secilenler.length;
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
      atama[best.key].items.push({ ad: item.ad, resim: item.resim, ana_kategori: item.ana_kategori, fiyat: best.price });
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
      ? `<img class="cmp-mkt-item-img" src="${it.resim}" alt="" loading="lazy" onerror="this.outerHTML='<div class=\\'cmp-mkt-item-img-ph\\'>${ph.emoji}</div>'">`
      : `<div class="cmp-mkt-item-img-ph">${ph.emoji}</div>`;
    return `<div class="cmp-mkt-item">
      ${img}
      <span class="cmp-mkt-item-name">${it.ad}</span>
      <span class="cmp-mkt-item-price">${it.fiyat != null ? tl(it.fiyat) : '<span style=\"color:var(--text-muted)\">—</span>'}</span>
    </div>`;
  };

  const blocks = seciliMarketler.filter(k => atama[k]).map(k => {
    const g = atama[k];
    return `<div class="cmp-mkt-block">
      <div class="cmp-mkt-name"><span class="cmp-mkt-dot m-${k}"></span>${MFROM[k] || g.name + "'den"} alacakların:</div>
      ${g.items.map(_cmpItemHTML).join('')}
      <div class="cmp-mkt-subtotal">Toplam: ${tl(g.total)}</div>
    </div>`;
  }).join('');

  const atanamayanHtml = atanamayan.length ? `
    <div class="cmp-mkt-block" style="margin-top:12px">
      <div class="cmp-mkt-name">⚠️ Seçili marketlerde bulunmayan ürünler:</div>
      ${atanamayan.map(it => _cmpItemHTML({ ad: it.ad, resim: it.resim, ana_kategori: it.ana_kategori, fiyat: null })).join('')}
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
      const bt = halData.bulten_tarihi || '';
      if (bt) document.getElementById('halDate').innerHTML =
        `<span class="hal-badge">Hal: ${bt.slice(0, 10)}</span>`;
    }
    renderCatGrid();
    saveSepet();
    renderMevsimSeridi();
    renderDusenlerSeridi();
    if ('requestIdleCallback' in window) {
requestIdleCallback(() => { renderTuzaklarSeridi(); }, { timeout: 3000 });
    } else {
setTimeout(() => { renderTuzaklarSeridi(); }, 1500);
    }
  }).catch(() => { renderCatGrid(); saveSepet(); renderMevsimSeridi(); renderDusenlerSeridi(); if ('requestIdleCallback' in window) { requestIdleCallback(() => { renderTuzaklarSeridi(); }, { timeout: 3000 }); } else { setTimeout(() => { renderTuzaklarSeridi(); }, 1500); } });
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
      ? `<img src="${u.gorsel}" alt="${u.ad}" loading="lazy" style="width:100%;height:80px;object-fit:cover;border-radius:12px 12px 0 0" onerror="this.outerHTML='<div style=&quot;height:80px;display:flex;align-items:center;justify-content:center;font-size:2.5rem;background:${halRenkler[kat]};border-radius:12px 12px 0 0&quot;>${halEmojiler[kat]}</div>'">`
      : `<div style="height:80px;display:flex;align-items:center;justify-content:center;font-size:2.5rem;background:${halRenkler[kat]};border-radius:12px 12px 0 0">${halEmojiler[kat]}</div>`;
    return `<div class="hal-grid-card" data-kat="${kat}">
      ${gorselHtml}
      <div style="padding:8px">
        <div style="font-size:11px;font-weight:500;color:var(--text);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;min-height:26px">${u.ad}</div>
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
    ? '<img class="firsat-card-img" src="'+u.resim+'" alt="" loading="lazy" onerror="this.className=\'firsat-card-img-ph\';this.outerHTML=\'<div class=&quot;firsat-card-img-ph&quot;>'+emoji+'</div>\'">'
    : '<div class="firsat-card-img-ph">'+emoji+'</div>';
  const inCart = window.sepet && window.sepet.some(function(s){return s._id===u._id;});
  return '<div class="firsat-card">'
    + imgHtml
    + '<div class="firsat-card-body">'
    + '<div class="firsat-card-name">'+(u.ad||'')+'</div>'
    + '<div class="firsat-card-sub">'+altText+'</div>'
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

function renderFirsatHal(container, tumUrunler) {
  halVeriGetir().then(function() {
    const meyveSebze = (tumUrunler||[]).filter(function(u){
      const k = ustKategori(u.ana_kategori||'');
      return k==='meyve'||k==='sebze';
    });
    const karsilastirmalar = [];
    meyveSebze.forEach(function(u) {
      if (!u.en_dusuk_fiyat) return;
      const hal = halEsles(u);
      if (!hal) return;
      const marketKg = halKgHesapla(u.ad, u.en_dusuk_fiyat);
      const tasarruf = marketKg - hal.fiyat;
      if (tasarruf > 0.5) karsilastirmalar.push({u:u, hal:hal, marketKg:marketKg, tasarruf:tasarruf});
    });
    karsilastirmalar.sort(function(a,b){return b.tasarruf-a.tasarruf;});
    if (!karsilastirmalar.length) {
      container.innerHTML = '<div class="firsat-loading">Şu an hal daha ucuz olan ürün bulunamadı.</div>';
      return;
    }
    let html = '<div class="firsat-section"><div class="firsat-section-title">' + lcIcon('building-2') + ' Marketten Değil Halden Al — Tasarruf Et</div>';
    karsilastirmalar.slice(0,20).forEach(function(item) {
      const altText = 'Hal: '+tl(item.hal.fiyat)+'/kg · Market: '+tl(item.marketKg)+'/kg';
      html += _firsatKartHtml(item.u, tl(item.tasarruf)+' ucuz', 'firsat-badge-hal', altText);
    });
    html += '</div>';
    container.innerHTML = html;
  });
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
  } catch (e) {
    await modalAc({ title: 'Hata', msg: e.message, okText: 'Tamam' });
  }
}
function uygulaKullaniciAdi() {
  // Auth-aware: renderProfilAuth tek doğru kaynak. Eski localStorage 'kullaniciAdi' artık kullanılmıyor.
  if (typeof window.renderProfilAuth === 'function') window.renderProfilAuth();
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
  try { localStorage.setItem('pazar_theme', isDark ? 'light' : 'dark'); } catch(e){}
  profilGuncelle();
}

function setTheme(val) {
  try { localStorage.setItem('pazar_theme', val); } catch(e){}
  applyTheme();
  refreshThemeSwitch();
}
function applyTheme() {
  var saved = 'auto';
  try { saved = localStorage.getItem('pazar_theme') || 'auto'; } catch(e){}
  var dark = saved === 'dark' || (saved === 'auto' && window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
}
function refreshThemeSwitch() {
  var cur = 'auto';
  try { cur = localStorage.getItem('pazar_theme') || 'auto'; } catch(e){}
  document.querySelectorAll('.theme-opt').forEach(function(b){
    b.classList.toggle('aktif', b.dataset.themeVal === cur);
  });
}

function firsatSepetEkle(btn, id) {
  try { id = decodeURIComponent(escape(atob(id))); } catch(e) {}
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

(function() {
  var params = new URLSearchParams(location.search);
  var ekran = params.get('screen');
  var hedefEkran = { list: 'screen-sepet', firsat: 'screen-firsatlar', hal: 'screen-hal' }[ekran];
  if (hedefEkran) showScreen(hedefEkran);
})();

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
    } catch(e) { return false; }
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
    try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch(e){}
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
    try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch(e){}
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
  } catch (e) { el.textContent = 'Düşen fiyatlar ve şüpheli indirimler, e-posta ile'; }
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
