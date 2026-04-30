"""
marketfiyati.org.tr - Sadece Meyve ve Sebze Kategorisi Scraper
Sonuclari urunler.json dosyasina kaydeder.
"""

import json
import time
import requests
import urllib3
from datetime import datetime
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.common.by import By
from webdriver_manager.chrome import ChromeDriverManager

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

API_URL     = "https://api.marketfiyati.org.tr/api/v2/searchByCategories"
BASE_URL    = "https://marketfiyati.org.tr/kategori/"
OUTPUT_FILE = "urunler.json"
PAGE_SIZE   = 48
MAX_RETRIES = 3

HEADERS = {
    "Content-Type": "application/json",
    "Accept": "application/json",
    "Connection": "close",
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    ),
}

CATEGORY_SLUG    = "meyve-ve-sebze"
CATEGORY_KEYWORD = "Meyve ve Sebze"


def get_cookies_via_browser():
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
        driver.get(BASE_URL + CATEGORY_SLUG)
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


def fetch_page(session, page_num):
    payload = {
        "menuCategory": True,
        "keywords": CATEGORY_KEYWORD,
        "pages": page_num,
        "size": PAGE_SIZE,
    }
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            resp = session.post(API_URL, json=payload, timeout=30, verify=False)
            resp.raise_for_status()
            return resp.json()
        except Exception as e:
            print(f"  [HATA] Deneme {attempt}/{MAX_RETRIES}: {e}")
            if attempt < MAX_RETRIES:
                time.sleep(5 * attempt)
    return None


def parse_product(item):
    fiyatlar = []
    for depot in item.get("productDepotInfoList") or []:
        fiyatlar.append({
            "market":        depot.get("marketAdi"),
            "depo_adi":      depot.get("depotName"),
            "fiyat":         depot.get("price"),
            "birim_fiyat":   depot.get("unitPrice"),
            "indirimli":     depot.get("discount", False),
            "indirim_orani": depot.get("discountRatio"),
            "promosyon":     depot.get("promotionText"),
            "guncelleme":    depot.get("indexTime"),
        })

    prices = [f["fiyat"] for f in fiyatlar if f["fiyat"] is not None]

    return {
        "id":             item.get("id"),
        "ad":             item.get("title"),
        "marka":          item.get("brand"),
        "agirlik_hacim":  item.get("refinedVolumeOrWeight"),
        "ana_kategori":   item.get("main_category"),
        "kategoriler":    item.get("categories"),
        "resim":          item.get("imageUrl"),
        "en_dusuk_fiyat": min(prices) if prices else None,
        "en_yuksek_fiyat":max(prices) if prices else None,
        "market_sayisi":  len(fiyatlar),
        "fiyatlar":       fiyatlar,
    }


def scrape():
    print("=" * 60)
    print("marketfiyati.org.tr - Meyve ve Sebze Scraper")
    print(f"Baslangic: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 60)

    session = requests.Session()
    session.headers.update(HEADERS)

    # Önce cookie olmadan dene, başarısız olursa tarayıcı ile al
    print("  Cookie olmadan API deneniyor...")
    test = fetch_page(session, 0)
    if not test or not test.get("content"):
        print("  Cookie gerekli, tarayici baslatiliyor...")
        cookies = get_cookies_via_browser()
        session.cookies.update(cookies)

    products = []

    print(f"\nKategori: {CATEGORY_SLUG}")
    print("  [Sayfa 1] API sorgusu...")
    data = fetch_page(session, 0)

    if not data:
        print("  [HATA] Veri alinamadi.")
        return None

    total = data.get("numberOfFound", 0)
    items = data.get("content") or []
    print(f"  Toplam urun: {total} | Bu sayfada: {len(items)}")

    for item in items:
        products.append(parse_product(item))

    page = 1
    while len(products) < total:
        print(f"  [Sayfa {page + 1}] ... ({len(products)}/{total})")
        data = fetch_page(session, page)
        if not data:
            break
        page_items = data.get("content") or []
        if not page_items:
            break
        for item in page_items:
            products.append(parse_product(item))
        page += 1
        time.sleep(1)

    output = {
        "kaynak":       "marketfiyati.org.tr",
        "kategori":     CATEGORY_KEYWORD,
        "cekme_tarihi": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "toplam_urun":  len(products),
        "urunler":      products,
    }
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    print(f"\nTamamlandi: {len(products)} urun -> {OUTPUT_FILE}")
    return output


if __name__ == "__main__":
    scrape()
