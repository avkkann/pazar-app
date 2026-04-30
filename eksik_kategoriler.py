"""
marketfiyati.org.tr - Eksik Kategori Tamamlayici
Sadece su 4 kategoriyi ceker ve mevcut urunler.json dosyasina EKLER:
  - Meyve ve Sebze
  - Et, Tavuk ve Balik
  - Sut Urunleri ve Kahvaltilik
  - Temel Gida
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
    "Accept":       "application/json",
    "Connection":   "close",
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    ),
}

EKSIK_KATEGORILER = [
    ("meyve-ve-sebze",              "Meyve ve Sebze"),
    ("et-tavuk-balik",              "Et, Tavuk ve Bal\u0131k"),
    ("sut-urunleri-ve-kahvaltilik", "S\u00fct \u00dcr\u00fcnleri ve Kahvalt\u0131l\u0131k"),
    ("temel-gida",                  "Temel G\u0131da"),
]


# ---------------------------------------------------------------------------
# Selenium: sadece cookie almak icin
# ---------------------------------------------------------------------------

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
        driver.get(BASE_URL + "meyve-ve-sebze")
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


# ---------------------------------------------------------------------------
# API istekleri
# ---------------------------------------------------------------------------

def fetch_page(session, page_num, keyword):
    payload = {
        "menuCategory": True,
        "keywords":     keyword,
        "pages":        page_num,
        "size":         PAGE_SIZE,
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
            "market":            depot.get("marketAdi"),
            "depo_adi":          depot.get("depotName"),
            "fiyat":             depot.get("price"),
            "birim_fiyat":       depot.get("unitPrice"),
            "birim_fiyat_deger": depot.get("unitPriceValue"),
            "indirimli":         depot.get("discount", False),
            "indirim_orani":     depot.get("discountRatio"),
            "promosyon":         depot.get("promotionText"),
            "guncelleme":        depot.get("indexTime"),
        })

    prices = [f["fiyat"] for f in fiyatlar if f["fiyat"] is not None]

    return {
        "id":              item.get("id"),
        "ad":              item.get("title"),
        "marka":           item.get("brand"),
        "agirlik_hacim":   item.get("refinedVolumeOrWeight"),
        "ana_kategori":    item.get("main_category"),
        "kategoriler":     item.get("categories"),
        "resim":           item.get("imageUrl"),
        "en_dusuk_fiyat":  min(prices) if prices else None,
        "en_yuksek_fiyat": max(prices) if prices else None,
        "market_sayisi":   len(fiyatlar),
        "fiyatlar":        fiyatlar,
    }


def scrape_category(session, slug, keyword):
    products = []

    print(f"\n{'-' * 50}")
    print(f"Kategori: {slug}")

    print("  [Sayfa 1] API sorgusu...")
    data = fetch_page(session, 0, keyword)

    if not data:
        print("  [ATLA] Veri alinamadi.")
        return products

    total = data.get("numberOfFound", 0)
    items = data.get("content") or []
    print(f"  Toplam urun: {total} | Bu sayfada: {len(items)}")

    for item in items:
        products.append(parse_product(item))

    page = 1
    while len(products) < total:
        print(f"  [Sayfa {page + 1}] API sorgusu... ({len(products)}/{total})")
        data = fetch_page(session, page, keyword)

        if not data:
            print("  [ATLA] Daha fazla sayfa cekilemiyor.")
            break

        page_items = data.get("content") or []
        if not page_items:
            break

        for item in page_items:
            products.append(parse_product(item))

        print(f"  {len(page_items)} urun alindi.")
        page += 1
        time.sleep(1)

    print(f"  Kategori tamamlandi: {len(products)} urun")
    return products


# ---------------------------------------------------------------------------
# Mevcut JSON'u oku ve guncelle
# ---------------------------------------------------------------------------

def load_existing():
    try:
        with open(OUTPUT_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
        print(f"Mevcut dosya okundu: {data.get('toplam_urun', 0)} urun")
        return data
    except FileNotFoundError:
        print("urunler.json bulunamadi, sifirdan baslanacak.")
        return {"kaynak": "marketfiyati.org.tr", "kategoriler": [], "urunler": []}


def save(data):
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


# ---------------------------------------------------------------------------
# Ana fonksiyon
# ---------------------------------------------------------------------------

def scrape():
    print("=" * 60)
    print("Eksik Kategori Tamamlayici")
    print(f"Baslangic: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 60)

    # Mevcut veriyi yukle
    existing = load_existing()
    all_products = existing.get("urunler", [])
    existing_cats = existing.get("kategoriler", [])

    # Cookie al
    cookies = get_cookies_via_browser()

    # requests oturumu hazirla
    session = requests.Session()
    session.headers.update(HEADERS)
    session.cookies.update(cookies)

    for i, (slug, keyword) in enumerate(EKSIK_KATEGORILER):
        new_products = scrape_category(session, slug, keyword)
        all_products.extend(new_products)

        # Kategori listesine ekle (yoksa)
        if keyword not in existing_cats:
            existing_cats.append(keyword)

        # Her kategoriden sonra kaydet
        existing["kategoriler"]  = existing_cats
        existing["cekme_tarihi"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        existing["toplam_urun"]  = len(all_products)
        existing["urunler"]      = all_products
        save(existing)
        print(f"  Ara kayit: toplam {len(all_products)} urun -> {OUTPUT_FILE}")

        # Son kategori degilse 30 saniye bekle
        if i < len(EKSIK_KATEGORILER) - 1:
            print(f"  Sonraki kategori icin 30s bekleniyor...")
            time.sleep(30)

    print(f"\n{'=' * 60}")
    print(f"Tamamlandi! Toplam {len(all_products)} urun -> {OUTPUT_FILE}")
    print("=" * 60)


if __name__ == "__main__":
    scrape()
