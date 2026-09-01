"""
marketfiyati.org.tr - Coklu Kategori Scraper
Sonuclari kategori bazli JSON dosyalarina kaydeder (urunler_meyve.json ... urunler_dondurulmus.json).
"""

import json
import os
import time
import requests
import urllib3
import concurrent.futures
import re
from datetime import datetime, timedelta
from urllib.parse import quote

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

API_URL     = "https://api.marketfiyati.org.tr/api/v2/searchByCategories"
BASE_URL    = "https://marketfiyati.org.tr/kategori/"
_BASE_DIR   = os.path.dirname(os.path.abspath(__file__))
DATA_DIR    = os.path.join(_BASE_DIR, "data")
os.makedirs(DATA_DIR, exist_ok=True)
PAGE_SIZE   = 48
MAX_RETRIES = 5
MAX_WORKERS = 1

# ==================== RESİM DOLDURMA (Searlo) ====================
SEARLO_URL          = "https://api.searlo.tech/api/v1/search/images"
SEARLO_TIMEOUT      = 15
SEARLO_MATCH_THRESHOLD = 0.55  # %55 eslesme esigi (2026-05: 0.65'ten dusuruldu - eksik resim ~2027, atlanan istekler kredi yiyordu)
SEARLO_API_KEY      = os.environ.get("SEARLO_API_KEY", "").strip()

def _env_dosyasindan_anahtar(env_path):
    """.env dosyasindan SEARLO_API_KEY okur.

    Iki farkli "anahtar yok" durumu AYIRT EDILIR:
      - dosya yok / icinde satir yok -> sessizce "" doner, resim adimi zaten
        "[RESIM] SEARLO_API_KEY yok" der.
      - dosya OKUNAMIYOR (izin, bozuk, dizin) -> sesli uyarir. Onceden burada
        "except: pass" vardi ve okuma hatasi "anahtar yok" gibi gorunuyordu.
    """
    if not os.path.exists(env_path):
        return ""
    try:
        with open(env_path, encoding="utf-8") as _f:
            for _line in _f:
                _line = _line.strip()
                if _line.startswith("SEARLO_API_KEY="):
                    return _line.split("=", 1)[1].strip().strip('"').strip("'")
    except Exception as e:
        print(f"[UYARI] .env okunamadi: {e} — SEARLO_API_KEY bos kalacak")
        return ""
    return ""


if not SEARLO_API_KEY:
    SEARLO_API_KEY = _env_dosyasindan_anahtar(os.path.join(_BASE_DIR, ".env"))


def _make_sid(slug_kisa, ad, gramaj=""):
    """Stable ID üretir: slug_kisa + '_' + normalize(ad)[ + '__' + normalize(gramaj)]"""
    import re
    if not ad:
        return slug_kisa + "_unknown"
    n = ad.lower()
    replacements = {'ı':'i','ğ':'g','ü':'u','ş':'s','ö':'o','ç':'c'}
    for k, v in replacements.items():
        n = n.replace(k, v)
    n = re.sub(r'[^a-z0-9]+', '-', n).strip('-')
    if gramaj:
        g = gramaj.lower()
        for k, v in replacements.items():
            g = g.replace(k, v)
        g = re.sub(r'[^a-z0-9]+', '-', g).strip('-')
        return f"{slug_kisa}_{n}__{g}"
    return f"{slug_kisa}_{n}"


def _normalize_text(s):
    if not s:
        return ""
    s = s.lower()
    s = re.sub(r"[^\w\s]", " ", s, flags=re.UNICODE)
    s = re.sub(r"\s+", " ", s).strip()
    return s


def _match_score(aranan, donen):
    a = _normalize_text(aranan)
    d = _normalize_text(donen)
    if not a or not d:
        return 0.0
    tokens = [t for t in a.split() if len(t) >= 2]
    if not tokens:
        return 0.0
    hit = sum(1 for t in tokens if t in d)
    return hit / len(tokens)


# Kalici hatalar: tekrar denemek anlamsiz, insan mudahalesi gerekir.
# (402 kredi bitti, 401 anahtar gecersiz, 403 yetki yok)
SEARLO_KALICI_KODLAR = {401, 402, 403}


def _searlo_resim_ara(urun_adi):
    """Donus: (img, title, hata).

    hata None ise istek basarili. Degilse:
      {"tur": "402"|"401"|"429"|"timeout"|"baglanti"|"bos_sonuc"|..., "kod": str, "kalici": bool}

    Onceden burada TUM hatalar yutuluyordu (status != 200 -> None, except -> None);
    cagiran taraf 402 ile timeout'u ayirt edemedigi icin Searlo kredisi 74 gun
    bitmis halde her gece 950 anlamsiz istek atildi.
    """
    if not SEARLO_API_KEY:
        return None, None, {"tur": "anahtar_yok", "kod": "", "kalici": True}
    try:
        r = requests.get(
            SEARLO_URL,
            headers={"x-api-key": SEARLO_API_KEY},
            params={"q": urun_adi},
            timeout=SEARLO_TIMEOUT,
        )
    except requests.exceptions.Timeout:
        return None, None, {"tur": "timeout", "kod": "", "kalici": False}
    except requests.exceptions.ConnectionError:
        return None, None, {"tur": "baglanti", "kod": "", "kalici": False}
    except Exception as e:
        return None, None, {"tur": "istisna", "kod": type(e).__name__, "kalici": False}

    if r.status_code != 200:
        kod = ""
        try:
            govde = r.json()
            kod = str(govde.get("code") or govde.get("error") or govde.get("message") or "")[:80]
        except Exception:
            kod = (getattr(r, "text", "") or "")[:80]
        return None, None, {
            "tur": str(r.status_code),
            "kod": kod,
            "kalici": r.status_code in SEARLO_KALICI_KODLAR,
        }

    try:
        data = r.json()
    except Exception as e:
        return None, None, {"tur": "gecersiz_json", "kod": type(e).__name__, "kalici": False}

    items = data.get("images") or data.get("items") or data.get("results") or []
    if not items or not isinstance(items, list):
        return None, None, {"tur": "bos_sonuc", "kod": "", "kalici": False}
    first = items[0]
    if not isinstance(first, dict):
        return None, None, {"tur": "bos_sonuc", "kod": "", "kalici": False}
    img = (first.get("image_url") or first.get("imageUrl") or
           first.get("original") or first.get("url") or
           first.get("thumbnail") or first.get("link"))
    if not img:
        return None, None, {"tur": "bos_sonuc", "kod": "", "kalici": False}
    return img, first.get("title", ""), None


def resimleri_doldur():
    if not SEARLO_API_KEY:
        print("\n[RESIM] SEARLO_API_KEY yok, resim doldurma atlandi.")
        return

    print("\n" + "=" * 60)
    print("RESIM DOLDURMA (Searlo)")
    print("=" * 60)

    toplam_eksik = 0
    toplam_dolduruldu = 0
    toplam_atlandi = 0
    toplam_hata = 0
    GUNLUK_LIMIT = 950
    ARDISIK_KALICI_ESIK = 5   # bu kadar ardisik kalici hata -> tum adimi iptal et
    istek_sayisi = 0
    hata_turleri = {}
    ardisik_kalici = 0
    son_kalici = None
    iptal = False

    def _hata_yaz(h):
        anahtar = h.get("tur", "?")
        if h.get("kod"):
            anahtar += " " + h["kod"]
        hata_turleri[anahtar] = hata_turleri.get(anahtar, 0) + 1

    # Iptal mesajindaki "N istek yapilmadi" gercek bir sayi olsun diye
    # planlanan toplam istek once hesaplanir.
    toplam_eksik_aday = 0
    for _slug, _kw, _dosya in CATEGORIES:
        _yol = os.path.join(DATA_DIR, f"{_dosya}.json")
        if not os.path.exists(_yol):
            continue
        try:
            with open(_yol, encoding="utf-8") as f:
                toplam_eksik_aday += sum(1 for p in json.load(f) if not p.get("resim"))
        except Exception as e:
            print(f"[UYARI] {_dosya}.json sayilamadi: {e} — iptal mesajindaki istek sayisi eksik olacak")

    for slug, keyword, dosya_adi in CATEGORIES:
        if iptal:
            break
        cat_file = os.path.join(DATA_DIR, f"{dosya_adi}.json")
        if not os.path.exists(cat_file):
            continue

        try:
            with open(cat_file, encoding="utf-8") as f:
                products = json.load(f)
        except Exception as e:
            print(f"  [HATA] {cat_file} okunamadi: {e}")
            continue

        eksikler = [p for p in products if not p.get("resim")]
        if not eksikler:
            continue

        print(f"\n  {keyword}: {len(eksikler)} eksik resim")
        kat_dolduruldu = 0
        kat_atlandi = 0
        kat_hata = 0

        for i, u in enumerate(eksikler, 1):
            if istek_sayisi >= GUNLUK_LIMIT:
                print(f"  [LIMIT] Gunluk {GUNLUK_LIMIT} istek limitine ulasildi, durduruluyor.")
                break
            ad = u.get("ad") or ""
            agirlik = u.get("agirlik_hacim") or ""
            sorgu = f"{ad} {agirlik}".strip()
            if not sorgu:
                continue

            img, title, hata = _searlo_resim_ara(sorgu)
            istek_sayisi += 1
            if hata is not None:
                _hata_yaz(hata)
                toplam_hata += 1
                kat_hata += 1
                if hata.get("kalici"):
                    ardisik_kalici += 1
                    son_kalici = hata
                    if ardisik_kalici >= ARDISIK_KALICI_ESIK:
                        iptal = True
                        break
                else:
                    ardisik_kalici = 0
                if i % 25 == 0:
                    print(f"    ... {i}/{len(eksikler)} (dolduruldu:{kat_dolduruldu}, atland:{kat_atlandi}, hata:{kat_hata})")
                time.sleep(6.5)
                continue
            ardisik_kalici = 0

            skor = _match_score(sorgu, title)
            if skor >= SEARLO_MATCH_THRESHOLD:
                u["resim"] = img
                toplam_dolduruldu += 1
                kat_dolduruldu += 1
            else:
                toplam_atlandi += 1
                kat_atlandi += 1

            if i % 25 == 0:
                print(f"    ... {i}/{len(eksikler)} (dolduruldu:{kat_dolduruldu}, atland:{kat_atlandi}, hata:{kat_hata})")

            time.sleep(6.5)

        toplam_eksik += len(eksikler)

        with open(cat_file, "w", encoding="utf-8") as f:
            json.dump(products, f, ensure_ascii=False, indent=2)
        print(f"  -> {keyword} sonuc: {kat_dolduruldu} dolduruldu, {kat_atlandi} atlandi (esik altı), {kat_hata} hata")

    if iptal:
        kalan = max(0, min(GUNLUK_LIMIT, toplam_eksik_aday) - istek_sayisi)
        kod = (son_kalici or {}).get("kod") or "(kod yok)"
        tur = (son_kalici or {}).get("tur") or "?"
        print(f"\n[RESIM] IPTAL: Searlo {tur} {kod} — kalici hata, {kalan} istek yapilmadi")

    print(f"\n[RESIM] TOPLAM: {toplam_eksik} eksik | {toplam_dolduruldu} dolduruldu | {toplam_atlandi} atlandi (esik altı) | {toplam_hata} hata")
    if hata_turleri:
        dagilim = " | ".join(f"{k}: {v}" for k, v in sorted(hata_turleri.items(), key=lambda x: -x[1]))
        print(f"[RESIM] HATA TURLERI: {dagilim}")
    print("=" * 60)


# (slug, api_keyword, dosya_adi) üçlüleri
CATEGORIES = [
    ("meyve-ve-sebze",              "Meyve ve Sebze",                "urunler_meyve"),
    ("et-tavuk-balik",              "Et, Tavuk ve Balık",            "urunler_et"),
    ("sut-urunleri-ve-kahvaltilik", "Süt Ürünleri ve Kahvaltılık",   "urunler_sut"),
    ("temel-gida",                  "Temel Gıda",                    "urunler_gida"),
    ("icecek",                      "İçecek",                        "urunler_icecek"),
    ("temizlik-ve-kisisel-bakim",   "Temizlik ve Kişisel Bakım",     "urunler_temizlik"),
    ("atistirmalik-ve-tatli",       "Atıştırmalık ve Tatlı",         "urunler_atistirmalik"),
]

# marketfiyati.org.tr kategori adlarini degistirebiliyor: 2026-07-25'te
# "Temizlik ve Kişisel Bakım" ikiye bolundu. API'ye gonderilecek isim(ler) burada
# tutulur; CATEGORIES'teki ad ana_kategori fallback'i olarak SABIT kalir, boylece
# _sid onekleri ve ana_kategori degerleri degismez.
API_KEYWORDS = {
    "urunler_temizlik": ["Temizlik Ürünleri", "Kişisel Bakım"],
}

DONDURULMUS_ANAHTAR = ['dondurul', 'donuk', 'superfresh', 'feast', 'lapestos']
DONDURULMUS_ATLA_KAT = ['dondurmalar']
DONDURULMUS_ATLA_DOSYA = ['urunler_temizlik']
DONDURULMUS_OUT = 'urunler_dondurulmus'


def dondurulmus_ayir():
    """7 kategoriden dondurulmus urunleri ayir, urunler_dondurulmus.json'a tasi."""
    print("\n" + "=" * 60)
    print("DONDURULMUS URUNLERI AYIRMA")
    print("=" * 60)

    ayrilanlar = []
    for slug, keyword, dosya_adi in CATEGORIES:
        if dosya_adi == DONDURULMUS_OUT:
            continue
        if dosya_adi in DONDURULMUS_ATLA_DOSYA:
            continue
        cat_file = os.path.join(DATA_DIR, f"{dosya_adi}.json")
        if not os.path.exists(cat_file):
            continue
        try:
            with open(cat_file, encoding="utf-8") as f:
                products = json.load(f)
        except Exception as e:
            print(f"  [HATA] {cat_file} okunamadi: {e}")
            continue

        kalanlar = []
        bu_kategori_ayrildi = 0
        for u in products:
            ad = (u.get("ad") or "").lower()
            kat = (u.get("ana_kategori") or "").lower()
            if any(k in kat for k in DONDURULMUS_ATLA_KAT):
                kalanlar.append(u)
                continue
            if any(k in ad for k in DONDURULMUS_ANAHTAR):
                u["_original_kategori"] = u.get("ana_kategori")
                u["ana_kategori"] = "Dondurulmuş Ürünler"
                u["_sid"] = _make_sid("dondurulmus", u.get("ad") or "")
                ayrilanlar.append(u)
                bu_kategori_ayrildi += 1
            else:
                kalanlar.append(u)

        if bu_kategori_ayrildi > 0:
            with open(cat_file, "w", encoding="utf-8") as f:
                json.dump(kalanlar, f, ensure_ascii=False, indent=2)
            print(f"  {keyword}: {bu_kategori_ayrildi} urun ayrildi, {len(kalanlar)} kaldi")

    out_file = os.path.join(DATA_DIR, f"{DONDURULMUS_OUT}.json")
    with open(out_file, "w", encoding="utf-8") as f:
        json.dump(ayrilanlar, f, ensure_ascii=False, indent=2)
    print(f"\n[DONDURULMUS] TOPLAM: {len(ayrilanlar)} urun -> {out_file}")
    print("=" * 60)

HEADERS = {
    "Content-Type": "application/json",
    "Accept": "application/json",
    "Connection": "close",
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    ),
}


def get_cookies_via_browser(slug):
    from selenium import webdriver
    from selenium.webdriver.chrome.service import Service
    from selenium.webdriver.chrome.options import Options
    from selenium.webdriver.support.ui import WebDriverWait
    from selenium.webdriver.support import expected_conditions as EC
    from selenium.webdriver.common.by import By
    from webdriver_manager.chrome import ChromeDriverManager

    print("Tarayici baslatiliyor (cookie alma)...")
    options = Options()
    options.add_argument("--headless=new")
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")
    options.add_argument("--window-size=1920,1080")
    options.add_argument(f"user-agent={HEADERS['User-Agent']}")
    service = Service(ChromeDriverManager().install())
    driver  = webdriver.Chrome(service=service, options=options)

    cookies = {}
    try:
        driver.get(BASE_URL + slug)
        WebDriverWait(driver, 15).until(
            EC.presence_of_element_located((By.TAG_NAME, "body"))
        )
        time.sleep(4)
        for c in driver.get_cookies():
            cookies[c["name"]] = c["value"]
        print(f"  {len(cookies)} cookie alindi.")
    finally:
        driver.quit()
    return cookies


def make_session(cookies=None):
    session = requests.Session()
    session.headers.update(HEADERS)
    if cookies:
        session.cookies.update(cookies)
    return session


def fetch_page(session, keyword, page_num):
    payload = {
        "menuCategory": True,
        "keywords":     keyword,
        "pages":        page_num,
        "size":         PAGE_SIZE,
    }
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            resp = session.post(API_URL, json=payload, timeout=60, verify=False)
            resp.raise_for_status()
            return resp.json()
        except Exception as e:
            print(f"  [HATA] Deneme {attempt}/{MAX_RETRIES}: {e}")
            if attempt < MAX_RETRIES:
                time.sleep(5 * attempt)
    return None


# app.js:654 MARKET_NAMES anahtar kumesiyle AYNI liste. Kaynak orada; market
# kodlari nadiren degisir (7 zincir) ve frontend lookup'i (MARKET_NAMES[f.market])
# calistigi icin scraper'in yazdigi kodlarla birebir ortusuyor. Yeni bir zincir ya
# da anormal bir kod gece kosusunun log'unda ERKEN gorunsun diye burada da tutulur.
BILINEN_MARKET_KODLARI = frozenset({
    "a101", "bim", "carrefour", "migros", "sok", "tarim_kredi", "hakmar",
})
# Ayni taninmayan kodu her urunde tekrar tekrar loglamamak icin (bir kod ilk
# gorulusunde tek satir uyari); modul seviyesinde, kosu boyunca birikir.
_uyarilan_market_kodlari = set()


def parse_product(item, kategori_adi, slug_kisa="urun"):
    market_fiyatlari = []
    for depot in item.get("productDepotInfoList") or []:
        fiyat = depot.get("price")
        if fiyat is not None:
            kayit = {
                "market": depot.get("marketAdi"),
                "fiyat":  fiyat,
            }
            # ERKEN UYARI (sessiz yutma yok): MARKET_NAMES'te olmayan bir market
            # kodu -> yeni zincir mi, anormal kod mu? Kacis birincil savunma; bu
            # yalnizca gece kosusu log'unda gorunen tek satirlik uyari. Ayni kod
            # yalnizca ILK gorulusunde loglanir (yukaridaki dedup seti).
            _kod = kayit["market"]
            if _kod and _kod not in BILINEN_MARKET_KODLARI and _kod not in _uyarilan_market_kodlari:
                _uyarilan_market_kodlari.add(_kod)
                print(f"[UYARI] taninmayan market kodu: {_kod}", flush=True)
            # discountlessPrice = marketin ILAN ETTIGI liste fiyati. Kayitlarin
            # ~%14'unde dolu (migros/carrefour/bim). Sadece gercek bir indirim
            # ifade ediyorsa ekle; bos alani 15 bin urunde tasimayalim.
            liste = depot.get("discountlessPrice")
            if liste is not None and fiyat is not None and liste > fiyat:
                kayit["liste_fiyat"] = liste
            # API her zincir icin TEK temsilci magaza donduruyor ve bu temsilci
            # zaman icinde degisebiliyor (2026-08-11 olcumu: ayni anda depots'suz
            # sorgu carrefour-1012 "Acibadem Hiper", depot filtreli sorgu
            # carrefour-5027 "Karakoy Mini" donuyor). Magaza degisimini ZAM
            # sanmamak icin fiyati hangi magazadan okudugumuzu kaydediyoruz.
            # liste_fiyat gibi additive: alan bos ise anahtar hic acilmiyor.
            for kaynak, hedef in (("depotId", "depot_id"), ("depotName", "depot_ad")):
                deger = depot.get(kaynak)
                if deger is None:
                    continue
                deger = str(deger).strip()
                if deger:
                    kayit[hedef] = deger
            market_fiyatlari.append(kayit)

    prices = [f["fiyat"] for f in market_fiyatlari]
    ad = item.get("title")

    return {
        "_sid":             _make_sid(slug_kisa, ad),
        "ad":               ad,
        "ana_kategori":     item.get("main_category") or kategori_adi,
        "agirlik_hacim":    item.get("refinedVolumeOrWeight"),
        "resim":            item.get("imageUrl"),
        "en_dusuk_fiyat":   min(prices) if prices else None,
        "market_fiyatlari": market_fiyatlari,
    }


def _apply_fiyat_gecmisi(yeni_urunler, cat_file):
    """Her ürüne fiyat_gecmisi listesi ekler.
    Mevcut JSON varsa _sid bazlı eşleştirir, bugünkü fiyatı merge eder, 90 günden eski kayıtları siler.
    Format: fiyat_gecmisi = [[tarih_yyyymmdd, fiyat_float], ...]"""
    eski_index = {}
    if os.path.exists(cat_file):
        try:
            with open(cat_file, "r", encoding="utf-8") as f:
                for u in json.load(f):
                    sid = u.get("_sid")
                    if sid:
                        eski_index[sid] = u
        except Exception as e:
            print(f"  [uyari] eski JSON okunamadi: {e}")

    bugun = datetime.now().strftime("%Y-%m-%d")
    limit_tarih = (datetime.now() - timedelta(days=90)).strftime("%Y-%m-%d")

    for u in yeni_urunler:
        gecmis = []
        sid = u.get("_sid")
        if sid and sid in eski_index:
            gecmis = list(eski_index[sid].get("fiyat_gecmisi") or [])

        yeni_fiyat = u.get("en_dusuk_fiyat")
        if yeni_fiyat is not None:
            if gecmis and gecmis[-1][0] == bugun:
                gecmis[-1] = [bugun, float(yeni_fiyat)]
            elif not gecmis or abs(float(gecmis[-1][1]) - float(yeni_fiyat)) > 0.01:
                gecmis.append([bugun, float(yeni_fiyat)])

        gecmis = [g for g in gecmis if g[0] >= limit_tarih]
        u["fiyat_gecmisi"] = gecmis

def _apply_agirlik_gecmisi(yeni_urunler, cat_file):
    """Her urune agirlik_hacim_gecmisi listesi ekler (sessiz altyapi, shrinkflation icin).
    Sadece deger degistiginde (veya ilk kez goruldugunde) yeni kayit eklenir.
    Suresiz saklanir (fiyat_gecmisi gibi 90 gunle SINIRLI DEGIL) cunku amac uzun vadeli karsilastirma.
    Format: agirlik_hacim_gecmisi = [[tarih_yyyymmdd, agirlik_hacim_str], ...]"""
    eski_index = {}
    if os.path.exists(cat_file):
        try:
            with open(cat_file, "r", encoding="utf-8") as f:
                for u in json.load(f):
                    sid = u.get("_sid")
                    if sid:
                        eski_index[sid] = u
        except Exception as e:
            print(f"  [uyari] eski JSON okunamadi (agirlik): {e}")

    bugun = datetime.now().strftime("%Y-%m-%d")

    for u in yeni_urunler:
        gecmis = []
        sid = u.get("_sid")
        if sid and sid in eski_index:
            gecmis = list(eski_index[sid].get("agirlik_hacim_gecmisi") or [])

        yeni_deger = u.get("agirlik_hacim")
        if yeni_deger:
            yeni_norm = str(yeni_deger).strip().lower()
            son_norm = str(gecmis[-1][1]).strip().lower() if gecmis else None
            if son_norm != yeni_norm:
                gecmis.append([bugun, yeni_deger])

        u["agirlik_hacim_gecmisi"] = gecmis


def _apply_resim_koru(yeni_urunler, cat_file):
    """API bu kez resim vermediyse dosyadaki mevcut resmi korur.

    parse_product her gece urunu sifirdan kurup resim'i item['imageUrl'] ile
    yaziyor; kaynak o gun bos donerse elde olan resim de siliniyordu. Searlo'nun
    26 Mayis'ta doldurdugu 73 resim de ertesi gece bu yuzden ucmustu.
    Kural: yeni deger BOSSA eski korunur, DOLUYSA API kazanir (kaynak
    guncellemis olabilir). agirlik_hacim_gecmisi ile ayni desen."""
    eski_index = {}
    if os.path.exists(cat_file):
        try:
            with open(cat_file, "r", encoding="utf-8") as f:
                for u in json.load(f):
                    sid = u.get("_sid")
                    if sid:
                        eski_index[sid] = u
        except Exception as e:
            print(f"  [uyari] eski JSON okunamadi (resim): {e}")

    korunan = 0
    for u in yeni_urunler:
        if u.get("resim"):
            continue
        eski = eski_index.get(u.get("_sid"))
        if eski and eski.get("resim"):
            u["resim"] = eski["resim"]
            korunan += 1
    return korunan


def _apply_ilan_indirim_gecmisi(yeni_urunler, cat_file):
    """Her urune ilan_indirim_gecmisi listesi ekler.
    "Market ne zaman, ne kadar indirim ILAN etti" tarihcesi — bizim fiyat_gecmisi'nden
    urettigimiz cikarimla karistirilmamali, bu kaynagin kendi beyani.
    Sadece ilan edilen bir indirim VARKEN (liste_fiyat dolu) ve o market icin deger
    degistiginde yeni kayit yazilir (agirlik_hacim_gecmisi deseni).
    Suresiz saklanir; amac uzun vadeli kampanya ritmi analizi.
    Format: [{"tarih","market","liste_fiyat","satis_fiyat"}, ...]"""
    eski_index = {}
    if os.path.exists(cat_file):
        try:
            with open(cat_file, "r", encoding="utf-8") as f:
                for u in json.load(f):
                    sid = u.get("_sid")
                    if sid:
                        eski_index[sid] = u
        except Exception as e:
            print(f"  [uyari] eski JSON okunamadi (ilan indirim): {e}")

    bugun = datetime.now().strftime("%Y-%m-%d")

    for u in yeni_urunler:
        gecmis = []
        sid = u.get("_sid")
        if sid and sid in eski_index:
            gecmis = list(eski_index[sid].get("ilan_indirim_gecmisi") or [])

        for mf in (u.get("market_fiyatlari") or []):
            liste = mf.get("liste_fiyat")
            if liste is None:
                continue
            market = mf.get("market")
            satis = mf.get("fiyat")
            if not market or satis is None:
                continue
            son = None
            for k in reversed(gecmis):
                if k.get("market") == market:
                    son = k
                    break
            if son and son.get("liste_fiyat") == liste and son.get("satis_fiyat") == satis:
                continue
            gecmis.append({
                "tarih":       bugun,
                "market":      market,
                "liste_fiyat": liste,
                "satis_fiyat": satis,
            })

        u["ilan_indirim_gecmisi"] = gecmis


def _kategori_sayfalarini_cek(session, api_keyword, kategori_adi, slug_kisa):
    """Tek bir API kategori adi icin butun sayfalari ceker.

    Donus: (urunler, durum). durum degerleri:
      "ok"        - veri geldi
      "ag_hatasi" - MAX_RETRIES denemenin hepsi basarisiz (data is None)
      "bos"       - istek basarili (HTTP 200) ama content bos; kategori adi
                    degismis olabilir. Ag hatasiyla ayni sey DEGILDIR.
    """
    data = fetch_page(session, api_keyword, 0)
    if data is None:
        return [], "ag_hatasi"
    if not data.get("content"):
        return [], "bos"

    total = data.get("numberOfFound", 0)
    items = data.get("content") or []
    print(f"  Toplam: {total} | Sayfa 1: {len(items)} urun")

    urunler = [parse_product(item, kategori_adi, slug_kisa) for item in items]

    page = 1
    while len(urunler) < total:
        print(f"  Sayfa {page + 1} ... ({len(urunler)}/{total})")
        data = fetch_page(session, api_keyword, page)
        if not data:
            break
        page_items = data.get("content") or []
        if not page_items:
            break
        urunler.extend(parse_product(item, kategori_adi, slug_kisa) for item in page_items)
        page += 1
        time.sleep(0.5)

    return urunler, "ok"


def scrape_category(cookies, slug, keyword, dosya_adi):
    session = make_session(cookies)
    print(f"\n--- Kategori: {keyword} ---")

    SLUG_KISA_MAP = {
        "meyve-ve-sebze": "meyve",
        "et-tavuk-balik": "et",
        "sut-urunleri-ve-kahvaltilik": "sut",
        "temel-gida": "gida",
        "icecek": "icecek",
        "temizlik-ve-kisisel-bakim": "temizlik",
        "atistirmalik-ve-tatli": "atistirmalik",
    }
    slug_kisa = SLUG_KISA_MAP.get(slug, "urun")

    # Bir kategori API'de birden fazla isme bolunmus olabilir (bkz. API_KEYWORDS).
    api_keywords = API_KEYWORDS.get(dosya_adi, [keyword])

    products = []
    gorulen_sid = set()
    for api_keyword in api_keywords:
        if len(api_keywords) > 1:
            print(f"  [API kategorisi] {api_keyword}")
        bulunan, durum = _kategori_sayfalarini_cek(session, api_keyword, keyword, slug_kisa)
        if durum == "ag_hatasi":
            print(f"  [HATA] Ag hatasi, {MAX_RETRIES} denemenin hepsi basarisiz: {api_keyword}")
        elif durum == "bos":
            print(f"  [KRITIK] Kategori bos dondu (HTTP 200, numberOfFound=0): {api_keyword}"
                  f" - kategori adi degismis olabilir")
        for u in bulunan:
            sid = u.get("_sid")
            if sid:
                if sid in gorulen_sid:
                    continue
                gorulen_sid.add(sid)
            products.append(u)

    if not products:
        print(f"  [ATLA] Hic urun alinamadi, {dosya_adi}.json onceki haliyle korundu: {keyword}")
        return []

    # Kategori için ayrı JSON kaydet
    cat_file = os.path.join(DATA_DIR, f"{dosya_adi}.json")
    _apply_fiyat_gecmisi(products, cat_file)
    _apply_agirlik_gecmisi(products, cat_file)
    _apply_ilan_indirim_gecmisi(products, cat_file)
    _korunan_resim = _apply_resim_koru(products, cat_file)
    if _korunan_resim:
        print(f"  {_korunan_resim} resim korundu (API bu kez vermedi)")
    with open(cat_file, "w", encoding="utf-8") as f:
        json.dump(products, f, ensure_ascii=False, indent=2)
    print(f"  Tamamlandi: {len(products)} urun -> {cat_file}")
    return products


def scrape():
    print("=" * 60)
    print("marketfiyati.org.tr - Coklu Kategori Scraper")
    print(f"Baslangic: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 60)

    # Cookie olmadan dene; başarısız olursa tarayıcı ile al
    print("\nCookie olmadan API deneniyor...")
    test_session = make_session()
    test = fetch_page(test_session, CATEGORIES[0][1], 0)
    cookies = {}
    if not test or not test.get("content"):
        try:
            print("Cookie gerekli, tarayici baslatiliyor...")
            cookies = get_cookies_via_browser(CATEGORIES[0][0])
        except Exception as e:
            print(f"[UYARI] Tarayici kullanilamiyor: {e}")
            print("Cookie olmadan devam ediliyor...")

    all_products = []

    with concurrent.futures.ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
        futures = {
            executor.submit(scrape_category, cookies, slug, keyword, dosya_adi): keyword
            for slug, keyword, dosya_adi in CATEGORIES
        }
        for future in concurrent.futures.as_completed(futures):
            keyword = futures[future]
            try:
                products = future.result()
                all_products.extend(products)
            except Exception as e:
                print(f"[HATA] {keyword}: {e}")
            time.sleep(1)

    print(f"\nTamamlandi: {len(all_products)} urun (8 kategori dosyasina yazildi)")
    resimleri_doldur()
    dondurulmus_ayir()
    gecmis_kaydet()
    return all_products


def gecmis_kaydet():
    """Her ürün × market için fiyat değiştiyse geçmiş_fiyatlar.json'a kayıt ekler."""
    print("\n--- Gecmis fiyat kaydi ---")
    bugun = datetime.now().strftime("%Y-%m-%d")
    gecmis_dosya = os.path.join(DATA_DIR, "gecmis_fiyatlar.json")

    if os.path.exists(gecmis_dosya):
        with open(gecmis_dosya, "r", encoding="utf-8") as f:
            gecmis = json.load(f)
    else:
        gecmis = {}

    tum_dosyalar = [d for _, _, d in CATEGORIES] + [DONDURULMUS_OUT]
    yeni_kayit = 0
    for dosya_adi in tum_dosyalar:
        yol = os.path.join(DATA_DIR, f"{dosya_adi}.json")
        if not os.path.exists(yol):
            continue
        with open(yol, "r", encoding="utf-8") as f:
            urunler = json.load(f)
        for u in urunler:
            sid = u.get("_sid")
            if not sid:
                continue
            for mf in (u.get("market_fiyatlari") or []):
                market = mf.get("market")
                fiyat = mf.get("fiyat")
                if not market or fiyat is None:
                    continue
                kayitlar = gecmis.setdefault(sid, [])
                son = None
                for k in reversed(kayitlar):
                    if k.get("m") == market:
                        son = k
                        break
                if son and son.get("t") == bugun:
                    continue
                if son and son.get("f") == fiyat:
                    continue
                kayit = {"t": bugun, "m": market, "f": fiyat}
                # depot_id ADDITIVE olarak kayda giriyor (2026-09-01).
                #
                # NEDEN: API her market zinciri icin TEK TEMSILCI magaza donduruyor
                # ve temsilci sabit degil; magaza degisimi gecmiste ZAM gibi
                # gorunuyor. depot_id 2026-08-11'den beri market_fiyatlari'nda
                # var ama fiyat GECMISINE hic yazilmiyordu -- yani calisma aninda
                # "bu iki fiyat ayni magazadan mi" sorusu CEVAPLANAMIYORDU.
                # Olcum (scripts/depot-olcum.mjs, 21 gun, 397.875 ardisik cift):
                # depot ayniyken %15+ artis orani %1,32; depot degisince %9,33
                # -- yedi kat. Bu alan olmadan o ayrim koda giremez.
                #
                # `liste_fiyat` / `agirlik_hacim_gecmisi` ile AYNI desen:
                # alan bossa anahtar HIC acilmiyor -> eski kayitlar buyumez,
                # okuyucu tarafi da yoklugu dogal karsilar.
                depot = mf.get("depot_id")
                if depot:
                    kayit["d"] = depot
                kayitlar.append(kayit)
                yeni_kayit += 1

    with open(gecmis_dosya, "w", encoding="utf-8") as f:
        json.dump(gecmis, f, ensure_ascii=False, separators=(",", ":"))
    print(f"  {yeni_kayit} yeni fiyat kaydi eklendi -> {gecmis_dosya}")


if __name__ == "__main__":
    scrape()
