"""
marketfiyati.org.tr - Coklu Kategori Scraper
Sonuclari urunler.json dosyasina kaydeder.
"""

import json
import os
import time
import requests
import urllib3
import concurrent.futures
import re
from datetime import datetime
from urllib.parse import quote

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

API_URL     = "https://api.marketfiyati.org.tr/api/v2/searchByCategories"
BASE_URL    = "https://marketfiyati.org.tr/kategori/"
_BASE_DIR   = os.path.dirname(os.path.abspath(__file__))
DATA_DIR    = os.path.join(_BASE_DIR, "data")
os.makedirs(DATA_DIR, exist_ok=True)
OUTPUT_FILE = os.path.join(DATA_DIR, "urunler.json")
PAGE_SIZE   = 48
MAX_RETRIES = 5
MAX_WORKERS = 1

# ==================== RESİM DOLDURMA (Searlo) ====================
SEARLO_URL          = "https://api.searlo.tech/api/v1/search/images"
SEARLO_TIMEOUT      = 15
SEARLO_MATCH_THRESHOLD = 0.55  # %55 eslesme esigi (2026-05: 0.65'ten dusuruldu - eksik resim ~2027, atlanan istekler kredi yiyordu)
SEARLO_API_KEY      = os.environ.get("SEARLO_API_KEY", "").strip()

if not SEARLO_API_KEY:
    _env_path = os.path.join(_BASE_DIR, ".env")
    if os.path.exists(_env_path):
        try:
            with open(_env_path, encoding="utf-8") as _f:
                for _line in _f:
                    _line = _line.strip()
                    if _line.startswith("SEARLO_API_KEY="):
                        SEARLO_API_KEY = _line.split("=", 1)[1].strip().strip('"').strip("'")
                        break
        except Exception:
            pass


def _make_sid(slug_kisa, ad):
    """Stable ID üretir: slug_kisa + '_' + normalize(ad)"""
    import re
    if not ad:
        return slug_kisa + "_unknown"
    n = ad.lower()
    replacements = {'ı':'i','ğ':'g','ü':'u','ş':'s','ö':'o','ç':'c'}
    for k, v in replacements.items():
        n = n.replace(k, v)
    n = re.sub(r'[^a-z0-9]+', '-', n).strip('-')
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


def _searlo_resim_ara(urun_adi):
    if not SEARLO_API_KEY:
        return None, None
    try:
        r = requests.get(
            SEARLO_URL,
            headers={"x-api-key": SEARLO_API_KEY},
            params={"q": urun_adi},
            timeout=SEARLO_TIMEOUT,
        )
        if r.status_code != 200:
            return None, None
        data = r.json()
        items = data.get("images") or data.get("items") or data.get("results") or []
        if not items or not isinstance(items, list):
            return None, None
        first = items[0]
        if not isinstance(first, dict):
            return None, None
        img = (first.get("image_url") or first.get("imageUrl") or
               first.get("original") or first.get("url") or
               first.get("thumbnail") or first.get("link"))
        title = first.get("title", "")
        return img, title
    except Exception:
        return None, None


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
    istek_sayisi = 0

    for slug, keyword, dosya_adi in CATEGORIES:
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

            img, title = _searlo_resim_ara(sorgu)
            istek_sayisi += 1
            if not img:
                toplam_hata += 1
                kat_hata += 1
                if i % 25 == 0:
                    print(f"    ... {i}/{len(eksikler)} (dolduruldu:{kat_dolduruldu}, atland:{kat_atlandi}, hata:{kat_hata})")
                time.sleep(6.5)
                continue

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

    print(f"\n[RESIM] TOPLAM: {toplam_eksik} eksik | {toplam_dolduruldu} dolduruldu | {toplam_atlandi} atlandi (esik altı) | {toplam_hata} hata")
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


def parse_product(item, kategori_adi, slug_kisa="urun"):
    market_fiyatlari = []
    for depot in item.get("productDepotInfoList") or []:
        fiyat = depot.get("price")
        if fiyat is not None:
            market_fiyatlari.append({
                "market": depot.get("marketAdi"),
                "fiyat":  fiyat,
            })

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

    data = fetch_page(session, keyword, 0)
    if not data or not data.get("content"):
        print(f"  [ATLA] Veri alinamadi: {keyword}")
        return []

    total = data.get("numberOfFound", 0)
    items = data.get("content") or []
    print(f"  Toplam: {total} | Sayfa 1: {len(items)} urun")

    products = [parse_product(item, keyword, slug_kisa) for item in items]

    page = 1
    while len(products) < total:
        print(f"  Sayfa {page + 1} ... ({len(products)}/{total})")
        data = fetch_page(session, keyword, page)
        if not data:
            break
        page_items = data.get("content") or []
        if not page_items:
            break
        products.extend(parse_product(item, keyword, slug_kisa) for item in page_items)
        page += 1
        time.sleep(0.5)

    # Kategori için ayrı JSON kaydet
    cat_file = os.path.join(DATA_DIR, f"{dosya_adi}.json")
    with open(cat_file, "w", encoding="utf-8") as f:
        json.dump(products, f, ensure_ascii=False, indent=2)
    print(f"  Tamamlandi: {len(products)} urun -> {cat_file}")
    return products


def scrape():
    print("=" * 60)
    print("marketfiyati.org.tr - Coklu Kategori Scraper")
    print(f"Baslangic: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 60)

    # Eski birlesik dosyayi sil
    if os.path.exists(OUTPUT_FILE):
        os.remove(OUTPUT_FILE)
        print(f"Silindi: {OUTPUT_FILE}")

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

    output = {
        "kaynak":       "marketfiyati.org.tr",
        "kategoriler":  [kw for _, kw, _ in CATEGORIES],
        "cekme_tarihi": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "toplam_urun":  len(all_products),
        "urunler":      all_products,
    }
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    print(f"\nTamamlandi: {len(all_products)} urun -> {OUTPUT_FILE}")
    resimleri_doldur()
    dondurulmus_ayir()
    gecmis_kaydet()
    return output


def gecmis_kaydet():
    """Her ürün × market için fiyat değiştiyse geçmiş_fiyatlar.json'a kayıt ekler."""
    print("\n--- Gecmis fiyat kaydi ---")
    from datetime import datetime
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
                kayitlar.append({"t": bugun, "m": market, "f": fiyat})
                yeni_kayit += 1

    with open(gecmis_dosya, "w", encoding="utf-8") as f:
        json.dump(gecmis, f, ensure_ascii=False, separators=(",", ":"))
    print(f"  {yeni_kayit} yeni fiyat kaydi eklendi -> {gecmis_dosya}")


if __name__ == "__main__":
    scrape()
