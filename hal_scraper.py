"""
Antalya Hal Fiyatlari Scraper
Kaynak: hal.gov.tr/Sayfalar/FiyatDetaylari.aspx
T.C. Ticaret Bakanlığı Hal Kayıt Sistemi gunluk fiyat listesi.
"""

import json
import os
import re
import time
import requests
from datetime import datetime
from bs4 import BeautifulSoup

SOURCE_URL = "https://www.hal.gov.tr/Sayfalar/FiyatDetaylari.aspx"

_BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(_BASE_DIR, "data")
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


def fetch_with_retry(url, method='get', **kwargs):
    sess = requests.Session()
    sess.headers.update(HEADERS)
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            if method == 'post':
                resp = sess.post(url, **kwargs)
            else:
                resp = sess.get(url, **kwargs)
            resp.raise_for_status()
            return resp
        except Exception as e:
            print(f"  [HATA] Deneme {attempt}/{MAX_RETRIES}: {e}")
            if attempt < MAX_RETRIES:
                time.sleep(3 * attempt)
    return None


def parse_excel_response(content):
    """Excel (HTML format) ciktisini parse eder."""
    try:
        text = content.decode('utf-16')
    except Exception:
        return [], ""

    soup = BeautifulSoup(text, 'html.parser')
    rows = soup.find_all('tr')
    if not rows:
        return [], ""

    products = []
    tarih_str = ""

    for row in rows[1:]:
        cols = [td.get_text(strip=True) for td in row.find_all(['td', 'th'])]
        if len(cols) < 5:
            continue

        if cols[0].startswith('Bulten Tarihi'):
            m = re.search(r'\d{2}[-./]\d{2}[-./]\d{4}', cols[0])
            if m:
                tarih_str = m.group(0)
            continue

        if cols[0] in ('Urün Adı', 'Ürün Adı', '', '12345678910...'):
            continue

        ad = cols[0]
        birim = cols[5] if len(cols) > 5 else 'Kg'
        fiyat_str = cols[3] if len(cols) > 3 else ''
        fiyat = parse_fiyat(fiyat_str)

        if ad and fiyat:
            products.append({
                "ad": ad,
                "fiyat": fiyat,
                "birim": birim,
                "sehir": "Antalya",
            })

    if not tarih_str:
        m = re.search(r'\d{2}[-./]\d{2}[-./]\d{4}', text)
        if m:
            tarih_str = m.group(0)

    return products, tarih_str


def parse_fiyat(text):
    """'80,00' gibi metni float'a cevirir."""
    if not text:
        return None
    cleaned = text.strip()
    if cleaned in ("", "-"):
        return None
    numeric = re.sub(r"[^\d.,]", "", cleaned)
    if not numeric:
        return None
    if "," in numeric and "." in numeric:
        numeric = numeric.replace(".", "").replace(",", ".")
    elif "," in numeric:
        numeric = numeric.replace(",", ".")
    try:
        return float(numeric)
    except ValueError:
        return None


def scrape():
    print("=" * 60)
    print("Antalya Hal Fiyatlari Scraper (hal.gov.tr)")
    print(f"Baslangic: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 60)

    print(f"\nSayfa cekiliyor: {SOURCE_URL}")
    resp = fetch_with_retry(SOURCE_URL)
    if not resp:
        print("[HATA] Sayfa alinamadi.")
        return None

    soup = BeautifulSoup(resp.content, 'html.parser')

    vs = soup.find('input', {'name': '__VIEWSTATE'}).get('value', '')
    vsg = soup.find('input', {'name': '__VIEWSTATEGENERATOR'}).get('value', '')
    ev = soup.find('input', {'name': '__EVENTVALIDATION'}).get('value', '')
    rd = soup.find('input', {'name': '__REQUESTDIGEST'}).get('value', '')
    date_input = soup.find('input', {'id': lambda i: i and 'dateControlDate' in i})
    btn_excel = soup.find('input', {'id': lambda i: i and 'btnExcel' in i})

    date_name = date_input.get('name')
    excel_name = btn_excel.get('name')

    today = datetime.now().strftime("%d.%m.%Y")
    print(f"  Tarih: {today}")

    data = {
        '__VIEWSTATE': vs,
        '__VIEWSTATEGENERATOR': vsg,
        '__EVENTVALIDATION': ev,
        '__REQUESTDIGEST': rd,
        date_name: today,
        excel_name: 'Export to Excel',
        '_wpcmWpid': '',
        'wpcmVal': '',
        'ctl00$ctl37$g_7e86b8d6_3aea_47cf_b1c1_939799a091e0$rblExcelOptions': '0',
    }

    print(f"\nExcel export cekiliyor...")
    resp2 = fetch_with_retry(SOURCE_URL, method='post',
                            data=data,
                            headers={'Content-Type': 'application/x-www-form-urlencoded'},
                            timeout=30)
    if not resp2:
        print("[HATA] Excel export alinamadi.")
        return None

    products, tarih_str = parse_excel_response(resp2.content)
    print(f"  {len(products)} urun parse edildi.")

    if not products:
        print("[UYARI] Hic urun bulunamadi.")

    output = {
        "kaynak": "hal.gov.tr",
        "sehir": "Antalya",
        "bulten_tarihi": tarih_str or today,
        "cekme_tarihi": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "toplam_urun": len(products),
        "urunler": products,
    }

    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    print(f"\nTamamlandi: {len(products)} urun -> {OUTPUT_FILE}")
    return output


if __name__ == "__main__":
    scrape()