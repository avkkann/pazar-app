"""
Antalya Hal Fiyatlari Scraper
Kaynak: antalyakomisyonculardernegi.com/hal-fiyatlari/1
Antalya Yas Sebze ve Meyve Komisyoncular Dernegi gunluk fiyat listesi.
"""

import json
import os
import re
import time
import requests
from datetime import datetime
from bs4 import BeautifulSoup

SOURCE_URL  = "https://antalyakomisyonculardernegi.com/hal-fiyatlari/1"

_BASE_DIR   = os.path.dirname(os.path.abspath(__file__))
DATA_DIR    = os.path.join(_BASE_DIR, "data")
os.makedirs(DATA_DIR, exist_ok=True)
OUTPUT_FILE = os.path.join(DATA_DIR, "hal.json")
MAX_RETRIES = 3

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "tr-TR,tr;q=0.9",
}


def fetch_with_retry(url):
    sess = requests.Session()
    sess.headers.update(HEADERS)
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            resp = sess.get(url, timeout=20)
            resp.raise_for_status()
            return resp
        except Exception as e:
            print(f"  [HATA] Deneme {attempt}/{MAX_RETRIES}: {e}")
            if attempt < MAX_RETRIES:
                time.sleep(3 * attempt)
    return None


def parse_fiyat(text):
    """'80.00 ₺' veya '₺ 80,00' gibi metni float'a cevirir. Gecersizse None."""
    if not text:
        return None
    cleaned = text.strip()
    if "bekleniyor" in cleaned.lower() or cleaned == "" or cleaned == "-":
        return None
    # Sadece rakam ve nokta/virgül kal
    numeric = re.sub(r"[^\d.,]", "", cleaned)
    if not numeric:
        return None
    # Türkçe format: 1.234,56 → 1234.56
    if "," in numeric and "." in numeric:
        numeric = numeric.replace(".", "").replace(",", ".")
    elif "," in numeric:
        numeric = numeric.replace(",", ".")
    try:
        return float(numeric)
    except ValueError:
        return None


def parse_products(soup):
    """
    ANTKOMDER sayfasindaki tabloyu parse eder.
    Baslik satiri: # | Urunler | Bugun fiyati | Onceki gun
    Bugunun fiyati "Fiyat Bekleniyor" ise onceki gunun fiyatini kullanir.
    """
    table = soup.find("table")
    if not table:
        return []

    products = []
    for row in table.find_all("tr")[1:]:   # ilk satir baslik
        cols = [td.get_text(strip=True) for td in row.find_all(["td", "th"])]
        if len(cols) < 2:
            continue
        urun_adi = cols[1].strip()
        if not urun_adi:
            continue
        bugun = parse_fiyat(cols[2]) if len(cols) > 2 else None
        dun   = parse_fiyat(cols[3]) if len(cols) > 3 else None
        fiyat = bugun if bugun is not None else dun
        if fiyat:
            products.append({
                "ad":    urun_adi,
                "fiyat": fiyat,
                "birim": "Kg",
                "sehir": "Antalya",
            })
    return products


def scrape():
    print("=" * 60)
    print("Antalya Hal Fiyatlari Scraper (ANTKOMDER)")
    print(f"Baslangic: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 60)

    print(f"\nSayfa cekiliyor: {SOURCE_URL}")
    resp = fetch_with_retry(SOURCE_URL)
    if not resp:
        print("[HATA] Sayfa alinamadi.")
        return None

    soup = BeautifulSoup(resp.content, "html.parser")

    # Bülten tarihi: tablo başlığının 3. sütunundan al ("15-05-2026 (Bugün)")
    tarih_str = ""
    table = soup.find("table")
    if table:
        header = table.find("tr")
        if header:
            cols = [c.get_text(strip=True) for c in header.find_all(["th", "td"])]
            raw = cols[2] if len(cols) > 2 else ""
            m = re.search(r"\d{2}[-./]\d{2}[-./]\d{4}", raw)
            if m:
                tarih_str = m.group(0)
    if not tarih_str:
        tarih_str = datetime.now().strftime("%Y-%m-%d")
    print(f"  Tarih: {tarih_str}")

    products = parse_products(soup)
    print(f"  {len(products)} urun parse edildi.")

    if not products:
        print("[UYARI] Hic urun bulunamadi — sayfa yapisi degismis olabilir.")

    output = {
        "kaynak":        "antalyakomisyonculardernegi.com",
        "sehir":         "Antalya",
        "bulten_tarihi": tarih_str,
        "cekme_tarihi":  datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "toplam_urun":   len(products),
        "urunler":       products,
    }

    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    print(f"\nTamamlandi: {len(products)} urun -> {OUTPUT_FILE}")
    return output


if __name__ == "__main__":
    scrape()
