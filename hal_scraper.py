"""
hal.gov.tr - Bugünün Hal Fiyatlari Scraper
Tüm sayfaları dolaşır, hal_fiyatlari.json'a kaydeder.
"""

import json
import time
import requests
from datetime import datetime
from bs4 import BeautifulSoup

BASE_URL    = "https://www.hal.gov.tr/Sayfalar/FiyatDetaylari.aspx"
OUTPUT_FILE = "hal_fiyatlari.json"
MAX_RETRIES = 3

EVENTTARGET = "ctl00$ctl37$g_7e86b8d6_3aea_47cf_b1c1_939799a091e0$gvFiyatlar"

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    ),
    "Referer": BASE_URL,
}


def get_hidden_fields(soup):
    return {
        inp["name"]: inp.get("value", "")
        for inp in soup.find_all("input", type="hidden")
        if inp.get("name")
    }


def parse_table(soup):
    tables = soup.find_all("table")
    if len(tables) < 7:
        return []

    rows = tables[6].find_all("tr")
    products = []
    for row in rows[1:]:  # ilk satır başlık
        cells = row.find_all(["td", "th"])
        if len(cells) < 6:
            continue
        texts = [c.get_text(strip=True) for c in cells]
        try:
            fiyat = float(texts[3].replace(",", ".")) if texts[3] else None
        except ValueError:
            fiyat = None
        try:
            hacim = int(texts[4]) if texts[4] else None
        except ValueError:
            hacim = None
        products.append({
            "ad":       texts[0],
            "cinsi":    texts[1],
            "turu":     texts[2],
            "fiyat":    fiyat,
            "hacim":    hacim,
            "birim":    texts[5] if len(texts) > 5 else "Kg",
        })
    return products


def get_page_links(soup):
    import re
    tables = soup.find_all("table")
    if len(tables) < 8:
        return []
    links = tables[7].find_all("a")
    page_nums = []
    for a in links:
        href = a.get("href", "")
        if "Page$" not in href:
            continue
        # Önce link metnini dene
        try:
            page_nums.append(int(a.text.strip()))
            continue
        except ValueError:
            pass
        # "..." gibi link metni varsa href'ten sayıyı çıkar
        m = re.search(r"Page\$(\d+)", href)
        if m:
            page_nums.append(int(m.group(1)))
    return page_nums


def fetch_with_retry(sess, method, url, **kwargs):
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            if method == "GET":
                resp = sess.get(url, timeout=20, **kwargs)
            else:
                resp = sess.post(url, timeout=20, **kwargs)
            resp.raise_for_status()
            return resp
        except Exception as e:
            print(f"  [HATA] Deneme {attempt}/{MAX_RETRIES}: {e}")
            if attempt < MAX_RETRIES:
                time.sleep(3 * attempt)
    return None


def scrape():
    print("=" * 60)
    print("hal.gov.tr - Hal Fiyatlari Scraper")
    print(f"Baslangic: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 60)

    sess = requests.Session()
    sess.headers.update(HEADERS)

    # Sayfa 1 (GET)
    print("\n[Sayfa 1] GET isteği...")
    resp = fetch_with_retry(sess, "GET", BASE_URL)
    if not resp:
        print("[HATA] Sayfa 1 alinамadi.")
        return None

    soup = BeautifulSoup(resp.content, "html.parser")
    hidden = get_hidden_fields(soup)

    # Bülten tarihi
    tables = soup.find_all("table")
    tarih_str = ""
    if len(tables) > 3:
        tarih_raw = tables[3].get_text(strip=True)
        tarih_str = tarih_raw.replace("Bülten Tarihi :", "").strip()[:30]
    print(f"  Bülten: {tarih_str}")

    all_products = parse_table(soup)
    print(f"  {len(all_products)} ürün alındı (sayfa 1)")

    # Kaç sayfa var?
    page_links = get_page_links(soup)
    if not page_links:
        max_page = 1
    else:
        max_page = max(page_links)

    # Eğer "..." varsa ek sayfalar keşfedilecek
    known_pages = set(page_links)
    visited = {1}

    current_page = 1
    current_hidden = hidden

    while True:
        # Sonraki sayfa numarasını bul
        next_pages = sorted(p for p in known_pages if p not in visited)
        if not next_pages:
            break

        next_page = next_pages[0]
        print(f"[Sayfa {next_page}] POST isteği...")

        payload = dict(current_hidden)
        payload["__EVENTTARGET"]   = EVENTTARGET
        payload["__EVENTARGUMENT"] = f"Page${next_page}"

        resp = fetch_with_retry(sess, "POST", BASE_URL, data=payload)
        if not resp:
            print(f"  [ATLA] Sayfa {next_page} alinamadi.")
            visited.add(next_page)
            continue

        soup = BeautifulSoup(resp.content, "html.parser")
        current_hidden = get_hidden_fields(soup)

        page_products = parse_table(soup)
        all_products.extend(page_products)
        print(f"  {len(page_products)} ürün alındı (toplam: {len(all_products)})")

        # Yeni sayfa linkleri ekle
        new_links = get_page_links(soup)
        for p in new_links:
            known_pages.add(p)

        visited.add(next_page)
        current_page = next_page
        time.sleep(1)

    output = {
        "kaynak":       "hal.gov.tr",
        "bulten_tarihi": tarih_str,
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
