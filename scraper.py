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
from datetime import datetime

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


def parse_product(item, kategori_adi):
    market_fiyatlari = []
    for depot in item.get("productDepotInfoList") or []:
        fiyat = depot.get("price")
        if fiyat is not None:
            market_fiyatlari.append({
                "market": depot.get("marketAdi"),
                "fiyat":  fiyat,
            })

    prices = [f["fiyat"] for f in market_fiyatlari]

    return {
        "ad":               item.get("title"),
        "ana_kategori":     item.get("main_category") or kategori_adi,
        "agirlik_hacim":    item.get("refinedVolumeOrWeight"),
        "resim":            item.get("imageUrl"),
        "en_dusuk_fiyat":   min(prices) if prices else None,
        "market_fiyatlari": market_fiyatlari,
    }


def scrape_category(cookies, slug, keyword, dosya_adi):
    session = make_session(cookies)
    print(f"\n--- Kategori: {keyword} ---")

    data = fetch_page(session, keyword, 0)
    if not data or not data.get("content"):
        print(f"  [ATLA] Veri alinamadi: {keyword}")
        return []

    total = data.get("numberOfFound", 0)
    items = data.get("content") or []
    print(f"  Toplam: {total} | Sayfa 1: {len(items)} urun")

    products = [parse_product(item, keyword) for item in items]

    page = 1
    while len(products) < total:
        print(f"  Sayfa {page + 1} ... ({len(products)}/{total})")
        data = fetch_page(session, keyword, page)
        if not data:
            break
        page_items = data.get("content") or []
        if not page_items:
            break
        products.extend(parse_product(item, keyword) for item in page_items)
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
    return output


if __name__ == "__main__":
    scrape()
