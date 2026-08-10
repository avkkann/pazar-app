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


def title_case(s):
    """'DOMATES' -> 'Domates', 'YER FISTIGI' -> 'Yer Fistigi'"""
    if not s:
        return s
    small = {
        've', 'veya', 'ile', 'için', 'de', 'da', 'bu', 'ne', 'ama', 'fakat',
        'kırmızı', 'beyaz', 'siyah', 'yeşil', 'sarı', 'mavi', 'turuncu', 'mor',
        'kuru', 'taze', ' Organik', 'iyi', 'tarim', 'geleneksel', 'konvansiyonel'
    }
    words = s.split()
    result = []
    for i, w in enumerate(words):
        lower_w = w.lower()
        if i == 0 or lower_w not in small:
            result.append(w.capitalize())
        else:
            result.append(lower_w)
    return ' '.join(result)


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
    MAX_PRICE = 500

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

        # Kaynak tablo kolonlari (10.08.2026 bulteninden dogrulandi):
        #   0 Urun Adi | 1 Urun Cinsi | 2 Urun Turu | 3 Ortalama Fiyat
        #   4 Islem Hacmi | 5 Birim Adi
        # Her satir bir (urun x cins x tur) kombinasyonunun O GUNKU ortalamasi;
        # "Islem Hacmi" o kombinasyonda gerceklesen miktar, yani dogru agirlik.
        ad = title_case(cols[0])
        birim = cols[5] if len(cols) > 5 else 'Kg'
        fiyat_str = cols[3] if len(cols) > 3 else ''
        fiyat = parse_fiyat(fiyat_str)

        if not fiyat:
            continue
        if fiyat > MAX_PRICE:
            continue

        products.append({
            "ad": ad,
            "cinsi": cols[1] if len(cols) > 1 else "",
            "turu": cols[2] if len(cols) > 2 else "",
            "fiyat": fiyat,
            "hacim": parse_fiyat(cols[4]) if len(cols) > 4 else None,
            "birim": birim,
            "sehir": "TR",
        })

    if not tarih_str:
        m = re.search(r'\d{2}[-./]\d{2}[-./]\d{4}', text)
        if m:
            tarih_str = m.group(0)

    return products, tarih_str


def merge_products(products):
    """Ayni isimli (urun x cins x tur) satirlarini tek urune indirger.

    Satirlarin kendisi de ciktiya ozet olarak tasinir: kac satirdan geldigi,
    toplam islem hacmi, fiyat araligi ve turler. Boylece "tek sayi" nereden
    geliyor sorusu veriden cevaplanabilir.
    """
    gruplar = {}
    for p in products:
        gruplar.setdefault(p['ad'].lower(), []).append(p)

    result = []
    for satirlar in gruplar.values():
        ilk = satirlar[0]
        fiyatlar = [s['fiyat'] for s in satirlar if s.get('fiyat')]
        hacimler = [s.get('hacim') or 0 for s in satirlar]
        turler = []
        for s in satirlar:
            t = (s.get('turu') or '').strip()
            if t and t not in turler:
                turler.append(t)
        result.append({
            'ad': ilk['ad'],
            'fiyat': round(sum(fiyatlar) / len(fiyatlar), 2),
            'birim': ilk['birim'],
            'sehir': ilk['sehir'],
            'hacim': round(sum(hacimler), 2),
            'satir_sayisi': len(satirlar),
            'fiyat_min': min(fiyatlar),
            'fiyat_max': max(fiyatlar),
            'turler': turler,
        })
    return result


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
    print("Hal Fiyatlari Scraper - TR geneli (hal.gov.tr)")
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
        'ctl00$ctl37$g_7e86b8d6_3aea_47cf_b1c1_939799a091e0$rblExcelOptions': '2',
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
        return None

    products = merge_products(products)
    print(f"  {len(products)} urun (birlesik sonrasi)")

    output = {
        "kaynak": "hal.gov.tr",
        "sehir": "TR",
        "bulten_tarihi": tarih_str or today,
        "cekme_tarihi": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "toplam_urun": len(products),
        "urunler": products,
    }

    # Mevcut hal.json'daki gorsel alanlarini koru (dosya sistemine gore, isim slug'i ile)
    import re as _re
    import unicodedata as _unicodedata

    def _slugify(ad):
        n = _unicodedata.normalize("NFKD", ad)
        n = n.encode("ascii", "ignore").decode("ascii")
        n = _re.sub(r"[^a-zA-Z0-9]+", "-", n).strip("-").lower()
        return n or "urun"

    IMAGES_DIR = os.path.join(DATA_DIR, "hal-images")
    gorsel_eklenen = 0
    for p in output["urunler"]:
        slug = _slugify(p["ad"])
        dosya_adi = slug + ".jpg"
        dosya_yolu = os.path.join(IMAGES_DIR, dosya_adi)
        if os.path.isfile(dosya_yolu):
            p["gorsel"] = "data/hal-images/" + dosya_adi
            gorsel_eklenen += 1
    print(f"  Gorsel korundu/eslendi: {gorsel_eklenen}/{len(output['urunler'])} urun")

    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    print(f"\nTamamlandi: {len(products)} urun -> {OUTPUT_FILE}")
    return output


if __name__ == "__main__":
    scrape()