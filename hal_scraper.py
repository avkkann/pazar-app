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
DATA_DIR    = os.environ.get("RAILWAY_VOLUME_MOUNT_PATH", _BASE_DIR)
os.makedirs(DATA_DIR, exist_ok=True)
OUTPUT_FILE = os.path.join(DATA_DIR, "hal_fiyatlari.json")
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
    ANTKOMDER sayfasındaki ürün bloklarını parse eder.
    Sayfa div tabanlı bir grid kullanıyor; fiyatlar ₺ sembolüyle işaretlenmiş.
    Bugünün fiyatı "Fiyat Bekleniyor" ise dünün fiyatını kullanır.
    """
    products = []

    # Strateji 1: tüm text node'larını tara, ₺ içeren satırları bul
    # Sayfayı satır bazlı işle
    all_text_blocks = []

    # Tüm olası kapsayıcıları dene
    containers = soup.find_all(["div", "li", "tr"])

    # Her container'da ürün adı + fiyat çiftini ara
    seen_names = set()

    # Önce tüm img alt / title attribute'larını topla (ürün isimleri burada olabilir)
    # Sonra fiyat metinlerini bul

    # Yaklaşım: tüm element text'lerini sıraya koy, ürün/fiyat pattern'i ara
    full_text = soup.get_text(separator="\n")
    lines = [l.strip() for l in full_text.splitlines() if l.strip()]

    i = 0
    while i < len(lines):
        line = lines[i]

        # Fiyat satırı değilse ve uzunsa ürün adı olabilir
        fiyat_match = re.search(r"\d[\d.,]*\s*₺|₺\s*\d[\d.,]*|Fiyat Bekleniyor", line, re.IGNORECASE)

        if not fiyat_match and len(line) >= 3 and len(line) <= 60:
            # Muhtemel ürün adı; peşindeki satırlarda fiyat ara
            urun_adi = line
            bugun_fiyat = None
            dun_fiyat = None

            for j in range(i + 1, min(i + 8, len(lines))):
                fmatch = re.search(r"\d[\d.,]*\s*₺|₺\s*[\d.,]+", lines[j])
                bekleniyor = "bekleniyor" in lines[j].lower()

                if bekleniyor and bugun_fiyat is None:
                    bugun_fiyat = None  # henüz yok
                elif fmatch:
                    f = parse_fiyat(lines[j])
                    if f is not None and f > 0:
                        if bugun_fiyat is None and not bekleniyor:
                            bugun_fiyat = f
                        elif dun_fiyat is None:
                            dun_fiyat = f
                            break

            # Fiyat: bugün varsa bugün, yoksa dün
            nihai_fiyat = bugun_fiyat if bugun_fiyat is not None else dun_fiyat

            if nihai_fiyat and urun_adi not in seen_names:
                # Menü / navigasyon metnini filtrele
                skip_keywords = [
                    "anasayfa", "hakkımızda", "iletişim", "menü", "fiyat listesi",
                    "hal fiyatları", "günlük", "tarih", "dernek", "komisyoncu",
                    "antalya", "copyright", "tüm haklar", "sosyal medya"
                ]
                if not any(kw in urun_adi.lower() for kw in skip_keywords):
                    seen_names.add(urun_adi)
                    products.append({
                        "ad":     urun_adi,
                        "fiyat":  nihai_fiyat,
                        "birim":  "Kg",
                        "sehir":  "Antalya",
                    })
        i += 1

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

    # Bülten tarihi: sayfadaki sütun başlıklarından al
    tarih_str = ""
    tarih_match = re.search(r"(\d{2}[-./]\d{2}[-./]\d{4})", resp.text)
    if tarih_match:
        tarih_str = tarih_match.group(1)
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
